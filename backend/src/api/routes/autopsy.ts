import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import type { AppEnv } from "../../core/env.js";
import { AppError, buildErrorEnvelope } from "../../core/errors.js";
import { SnapshotVersionCache } from "../../core/snapshotCache.js";
import type { EvidenceRepository } from "../../db/repository.js";
import { ClaimLedgerSchema } from "../../domain/claims/parser.js";
import { getSyntheticCoordinatedDemoSignal } from "../../domain/coordinated-demo/signal.js";
import { classifyDisclosure } from "../../domain/disclosure/classifier.js";
import { detectHypePhrases } from "../../domain/hype/detector.js";
import { computeAllMarketChecks, METHODOLOGY_CONFIG_V1 } from "../../domain/market-checks/checks.js";
import { buildGuardedFactsCard } from "../../domain/output-guard/guard.js";
import { lookupSebiRegister } from "../../domain/sebi/lookup.js";
import { computeCreatorTrackRecord } from "../../domain/track-record/stats.js";
import {
  MAX_VIDEO_BYTES,
  runBoundedMultimodalParse,
  runBoundedMultimodalParseAsync,
} from "../../integrations/multimodalParser.js";
import { parseClaimLedgerWithFreeAiFallback } from "../../integrations/freeLlmClaimParser.js";
import {
  fetchLiveBenchmarkSummaries,
  fetchLiveHistoricalBars,
  normalizeIndianYahooSymbol,
  searchLiveIndianStocks,
} from "../../integrations/liveMarketFeed.js";
import { synthesizeGuardedVoiceReadout } from "../../integrations/sarvamVoice.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ParseBodySchema = z.object({
  text: z.string().max(4000).optional(),
  influencer_name: z.string().max(160).optional(),
  stock_name: z.string().max(160).optional(),
  demo_case_id: z.string().max(120).optional(),
  locale: z.string().max(24).optional(),
});

const ReportRequestSchema = z.object({
  ticker: z.string().min(1).max(64),
  tip_date: isoDate.optional(),
  as_of_date: isoDate.optional(),
  influencer_id: z.string().uuid().optional().nullable(),
  influencer_name: z.string().max(160).optional().nullable(),
  original_text: z.string().max(4000).optional().nullable(),
  claims: ClaimLedgerSchema.optional(),
});

// Strict in-memory Multer upload (NEVER diskStorage)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VIDEO_BYTES,
    files: 1,
    fields: 10,
  },
});

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

const VoiceReadoutSchema = z.object({
  guarded_text: z.string().min(1).max(600),
  language: z.enum(["en-IN", "hi-IN", "kn-IN"]).default("en-IN"),
});

export function createAutopsyRouter(params: {
  config: AppEnv;
  repo: EvidenceRepository;
  fetchImpl?: typeof fetch;
}): Router {
  const { config, repo, fetchImpl } = params;
  const router = Router();
  const snapshotCache = new SnapshotVersionCache({ maxEntries: 250, defaultTtlMs: 300_000 });
  const liveMarketActive =
    config.LIVE_MARKET_ENABLED && (config.NODE_ENV !== "test" || Boolean(fetchImpl));

  const providerRateLimit = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: Math.min(config.RATE_LIMIT_MAX_REQUESTS, 40),
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      res
        .status(429)
        .json(
          buildErrorEnvelope(
            "RATE_LIMITED",
            "Too many parsing or voice requests. Please pause briefly and try again.",
            req.requestId ?? "req_unknown",
            true
          )
        );
    },
  });

  // 1. POST /api/tips/parse (JSON or multipart/form-data photo/video)
  router.post(
    "/tips/parse",
    providerRateLimit,
    (req, res, next) => {
      if (req.is("multipart/form-data")) {
        memoryUpload.single("file")(req, res, (err: unknown) => {
          if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            next(
              new AppError({
                code: "PAYLOAD_TOO_LARGE",
                message: "Uploaded media file exceeds the maximum allowed size (25 MB).",
                statusCode: 413,
                retryable: false,
              })
            );
            return;
          }
          if (err) {
            next(
              new AppError({
                code: "VALIDATION_ERROR",
                message: "Could not process the uploaded media request.",
                statusCode: 400,
                retryable: false,
              })
            );
            return;
          }
          next();
        });
        return;
      }
      next();
    },
    asyncRoute(async (req, res) => {
      const body = ParseBodySchema.parse(req.body ?? {});
      const [catalogue, demoCases] = await Promise.all([
        repo.searchStocks(""),
        repo.listDemoCases(),
      ]);

      const parsed = await runBoundedMultimodalParseAsync({
        text: body.text,
        influencerName: body.influencer_name,
        stockName: body.stock_name,
        demoCaseId: body.demo_case_id,
        file: req.file
          ? {
              buffer: req.file.buffer,
              mimetype: req.file.mimetype,
              size: req.file.size,
            }
          : undefined,
        catalogue,
        demoCases,
        llmProvider: config.LLM_PROVIDER,
        llmApiKey: config.LLM_API_KEY,
        fetchImpl,
      });

      // Optionally enhance Claim Ledger via bounded free-tier AI (Gemini / Groq) when configured
      if (
        parsed.extracted_text.trim().length > 0 &&
        (config.LLM_PROVIDER === "gemini" || config.LLM_PROVIDER === "groq") &&
        config.LLM_API_KEY
      ) {
        const aiEnhanced = await parseClaimLedgerWithFreeAiFallback({
          sourceText: parsed.extracted_text,
          catalogue: catalogue.map((s) => ({
            ticker: s.ticker,
            company_name: s.company_name,
            aliases: s.aliases,
          })),
          userEnteredStock: body.stock_name,
          llmProvider: config.LLM_PROVIDER,
          llmApiKey: config.LLM_API_KEY,
          fetchImpl,
        });
        parsed.claims = aiEnhanced.claims;
        parsed.parser.version = aiEnhanced.parserVersion;
        if (aiEnhanced.note) {
          parsed.parser.note = aiEnhanced.note;
        }
      }

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        schema_version: "parse-v1",
        ...parsed,
      });
    })
  );

  // 2. GET /api/influencers/lookup?q=&asOf=
  router.get(
    "/influencers/lookup",
    asyncRoute(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const [sebiData, influencers] = await Promise.all([
        repo.listSebiEntries(),
        repo.listInfluencers(),
      ]);

      const result = lookupSebiRegister({
        query: q,
        entries: sebiData.entries,
        aliases: influencers,
        snapshotDate: sebiData.snapshotDate,
        snapshotId: sebiData.snapshotId,
        dataLabel: sebiData.dataLabel,
      });

      const matchedCreator = await repo.findInfluencerByQuery(q);

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        influencer_id: matchedCreator?.id ?? null,
        ...result,
      });
    })
  );

  // 3. GET /api/stocks/lookup?q=
  router.get(
    "/stocks/lookup",
    asyncRoute(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const [matches, liveMatches] = await Promise.all([
        repo.searchStocks(q),
        liveMarketActive && q.trim().length >= 2
          ? searchLiveIndianStocks(q, { enabled: true, fetchImpl })
          : Promise.resolve([]),
      ]);

      const localItems = await Promise.all(
        matches.map(async (stock) => {
          const bars = await repo.getPriceHistory(stock.ticker);
          return {
            ticker: stock.ticker,
            company_name: stock.company_name,
            exchange: stock.exchange,
            instrument_type: stock.instrument_type,
            underlying_ticker: stock.underlying_ticker,
            has_price_history: bars.length > 0,
            latest_price_date: bars[bars.length - 1]?.trading_date ?? null,
          };
        })
      );

      const seenTickers = new Set(localItems.map((i) => i.ticker.toUpperCase()));
      const mergedItems = [...localItems];
      for (const live of liveMatches) {
        if (seenTickers.has(live.ticker.toUpperCase())) continue;
        seenTickers.add(live.ticker.toUpperCase());
        mergedItems.push({
          ticker: live.ticker,
          company_name: live.company_name,
          exchange: live.exchange,
          instrument_type: "EQUITY",
          underlying_ticker: null,
          has_price_history: true,
          latest_price_date: new Date().toISOString().slice(0, 10),
        });
      }

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        items: mergedItems,
      });
    })
  );

  // 4. GET /api/stocks/:ticker/prices?from=&to=
  router.get(
    "/stocks/:ticker/prices",
    asyncRoute(async (req, res) => {
      const rawTicker = String(req.params.ticker ?? "");
      const from = typeof req.query.from === "string" ? isoDate.parse(req.query.from) : undefined;
      const to = typeof req.query.to === "string" ? isoDate.parse(req.query.to) : undefined;

      const stock = await repo.getStockByTicker(rawTicker);
      if (!stock) {
        // Attempt real-time NSE/BSE equity lookup via zero-cost Yahoo Finance v8 when live market is active
        if (liveMarketActive) {
          const { canonicalTicker } = normalizeIndianYahooSymbol(rawTicker);
          const liveHistory = await fetchLiveHistoricalBars(canonicalTicker, {
            enabled: true,
            range: "3mo",
            fetchImpl,
          });
          if (liveHistory && liveHistory.bars.length > 0) {
            const filtered = liveHistory.bars.filter((bar) => {
              if (from && bar.trading_date < from) return false;
              if (to && bar.trading_date > to) return false;
              return true;
            });
            const latest = filtered[filtered.length - 1] ?? liveHistory.bars[liveHistory.bars.length - 1];
            res.status(200).json({
              request_id: req.requestId ?? "req_unknown",
              ticker: canonicalTicker,
              company_name: liveHistory.companyName ?? canonicalTicker,
              instrument_type: "EQUITY",
              series_scope: "SECURITY",
              underlying_ticker: null,
              as_of_date: latest?.trading_date ?? null,
              source_snapshot_id: latest?.snapshot_id ?? null,
              source_name: latest?.source_name ?? null,
              data_label: latest?.data_label ?? "REAL",
              data_freshness: "LIVE_FEED",
              series: filtered.map((bar) => ({
                trading_date: bar.trading_date,
                close: Number(bar.close),
                volume: bar.volume,
              })),
            });
            return;
          }
        }
        throw new AppError({
          code: "DATA_NOT_AVAILABLE",
          message: "No matching stock or instrument was found in the dated catalogue.",
          statusCode: 404,
          retryable: false,
        });
      }

      // For derivatives, return the underlying index series clearly labelled as underlying context
      if (stock.instrument_type === "DERIVATIVE" && stock.underlying_ticker) {
        const benchmarks = await repo.listBenchmarks();
        const underlyingKey = stock.underlying_ticker as keyof typeof benchmarks;
        const rawUnderlying = benchmarks[underlyingKey] ?? [];
        const filtered = rawUnderlying.filter((bar) => {
          if (from && bar.trading_date < from) return false;
          if (to && bar.trading_date > to) return false;
          return true;
        });
        const latest = filtered[filtered.length - 1];
        res.status(200).json({
          request_id: req.requestId ?? "req_unknown",
          ticker: stock.ticker,
          company_name: stock.company_name,
          instrument_type: stock.instrument_type,
          series_scope: "UNDERLYING_INDEX",
          underlying_ticker: stock.underlying_ticker,
          as_of_date: latest?.trading_date ?? null,
          source_snapshot_id: latest?.snapshot_id ?? null,
          source_name: latest?.source_name ?? null,
          data_label: latest?.data_label ?? null,
          series: filtered.map((bar) => ({
            trading_date: bar.trading_date,
            close: bar.close,
            volume: null,
          })),
        });
        return;
      }

      const bars = await repo.getPriceHistory(stock.ticker, from, to);
      const latest = bars[bars.length - 1];
      const cacheKey = SnapshotVersionCache.buildKey({
        namespace: "prices",
        snapshotVersion: latest?.snapshot_id ?? "empty",
        params: { ticker: stock.ticker, from, to },
      });

      const cached = snapshotCache.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        res.status(200).json({ request_id: req.requestId ?? "req_unknown", ...cached });
        return;
      }

      const payload = {
        ticker: stock.ticker,
        company_name: stock.company_name,
        instrument_type: stock.instrument_type,
        series_scope: "SECURITY" as const,
        underlying_ticker: null,
        as_of_date: latest?.trading_date ?? null,
        source_snapshot_id: latest?.snapshot_id ?? null,
        source_name: latest?.source_name ?? null,
        data_label: latest?.data_label ?? null,
        series: bars.map((bar) => ({
          trading_date: bar.trading_date,
          close: Number(bar.close),
          volume: bar.volume,
        })),
      };
      snapshotCache.set(cacheKey, payload);

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...payload,
      });
    })
  );

  // 5. GET /api/influencers/:id/tips?ticker=&date=
  router.get(
    "/influencers/:id/tips",
    asyncRoute(async (req, res) => {
      const influencerId = String(req.params.id ?? "");
      const ticker = typeof req.query.ticker === "string" ? req.query.ticker : undefined;
      const date = typeof req.query.date === "string" ? isoDate.parse(req.query.date) : undefined;

      const tips = await repo.getTipsByInfluencer({ influencerId, ticker, date });

      if (!date) {
        // Return date markers grouped cleanly for the Tip Time Machine
        const byDate = new Map<string, { tip_date: string; count: number; has_synthetic: boolean; data_label: string }>();
        for (const tip of tips) {
          const existing = byDate.get(tip.tip_date);
          if (existing) {
            existing.count += 1;
            existing.has_synthetic = existing.has_synthetic || tip.is_synthetic;
          } else {
            byDate.set(tip.tip_date, {
              tip_date: tip.tip_date,
              count: 1,
              has_synthetic: tip.is_synthetic,
              data_label: tip.data_label,
            });
          }
        }
        res.status(200).json({
          request_id: req.requestId ?? "req_unknown",
          mode: "MARKERS",
          markers: [...byDate.values()].sort((a, b) => a.tip_date.localeCompare(b.tip_date)),
        });
        return;
      }

      // Exact-date marker selection returns ONLY tips matching creator + ticker + date
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        mode: "EXACT_DATE",
        date,
        tips: tips.map((t) => ({
          id: t.id,
          influencer_id: t.influencer_id,
          ticker: t.ticker,
          tip_date: t.tip_date,
          text: t.text,
          direction: t.direction,
          target_price: t.target_price,
          deadline: t.deadline,
          stop_loss: t.stop_loss,
          disclosure_grade: t.disclosure_grade,
          source_url: t.source_url,
          is_synthetic: t.is_synthetic,
          data_label: t.data_label,
          snapshot_id: t.snapshot_id,
        })),
      });
    })
  );

  // 6. GET /api/stocks/:ticker/checks?asOf=&tipDate=&influencerId=
  router.get(
    "/stocks/:ticker/checks",
    asyncRoute(async (req, res) => {
      const rawTicker = String(req.params.ticker ?? "");
      const stock = await repo.getStockByTicker(rawTicker);

      const asOf =
        typeof req.query.asOf === "string" && req.query.asOf
          ? isoDate.parse(req.query.asOf)
          : "2026-11-19";
      const tipDate =
        typeof req.query.tipDate === "string" && req.query.tipDate
          ? isoDate.parse(req.query.tipDate)
          : "2026-11-10";
      const influencerId =
        typeof req.query.influencerId === "string" && req.query.influencerId
          ? req.query.influencerId
          : null;

      const instrumentType = stock?.instrument_type ?? "EQUITY";
      const [initialBars, initialStockInfo, surveillance, benchmarks] = stock
        ? await Promise.all([
            repo.getPriceHistory(stock.ticker),
            repo.getStockInfo(stock.ticker),
            repo.getSurveillance(stock.ticker),
            repo.listBenchmarks(),
          ])
        : [[], null, [], await repo.listBenchmarks()];
      let bars = initialBars;
      let stockInfo = initialStockInfo;

      let resolvedCompanyName = stock?.company_name ?? rawTicker;
      if (!stock && liveMarketActive && instrumentType === "EQUITY") {
        const liveHistory = await fetchLiveHistoricalBars(rawTicker, {
          enabled: true,
          range: "3mo",
          fetchImpl,
        });
        if (liveHistory && liveHistory.bars.length > 0) {
          bars = liveHistory.bars;
          if (liveHistory.stockInfo) stockInfo = liveHistory.stockInfo;
          if (liveHistory.companyName) resolvedCompanyName = liveHistory.companyName;
        }
      }

      const effectiveAsOf =
        typeof req.query.asOf === "string" && req.query.asOf
          ? asOf
          : bars[bars.length - 1]?.trading_date ?? asOf;
      const effectiveTipDate =
        typeof req.query.tipDate === "string" && req.query.tipDate
          ? tipDate
          : bars[bars.length - 1]?.trading_date ?? tipDate;

      const checks = computeAllMarketChecks({
        instrumentType,
        bars,
        stockInfo,
        surveillanceEntries: surveillance,
        circuitBand: stockInfo?.circuit_band ?? stock?.circuit_band ?? null,
        asOfDate: effectiveAsOf,
        tipDate: effectiveTipDate,
        config: METHODOLOGY_CONFIG_V1,
      });

      let creatorTips = influencerId ? await repo.getTipsByInfluencer({ influencerId }) : [];
      const creatorRecord = influencerId ? await repo.findInfluencerById(influencerId) : null;
      const pricesByTicker: Record<string, { trading_date: string; close: number | string }[]> = {};
      const uniqueTickers = [...new Set(creatorTips.map((t) => t.ticker).filter(Boolean))];
      await Promise.all(
        uniqueTickers.map(async (t) => {
          pricesByTicker[t] = await repo.getPriceHistory(t);
        })
      );

      const niftySeries = benchmarks.NIFTY_50;
      const trackRecord = computeCreatorTrackRecord({
        creatorId: creatorRecord?.id ?? influencerId,
        creatorName: creatorRecord?.name ?? null,
        tips: creatorTips,
        pricesByTicker,
        niftySeries,
        asOfDate: niftySeries[niftySeries.length - 1]?.trading_date ?? asOf,
        dataLabel: creatorTips.some((t) => t.is_synthetic) ? "SYNTHETIC" : null,
      });

      creatorTips = [];

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ticker: stock?.ticker ?? normalizeIndianYahooSymbol(rawTicker).canonicalTicker,
        company_name: resolvedCompanyName,
        instrument_type: instrumentType,
        underlying_ticker: stock?.underlying_ticker ?? null,
        as_of_date: effectiveAsOf,
        tip_date: effectiveTipDate,
        methodology_version: METHODOLOGY_CONFIG_V1.version,
        checks,
        track_record: trackRecord,
      });
    })
  );

  // 7. POST /api/report (Guarded Information Verdict / Facts Card)
  router.post(
    "/report",
    asyncRoute(async (req, res) => {
      const body = ReportRequestSchema.parse(req.body ?? {});
      const stock = await repo.getStockByTicker(body.ticker);
      const asOfDate = body.as_of_date ?? "2026-11-19";
      const tipDate = body.tip_date ?? "2026-11-10";
      const originalText = body.original_text ?? "";

      const [catalogue, sebiData, influencers, benchmarks] = await Promise.all([
        repo.searchStocks(""),
        repo.listSebiEntries(),
        repo.listInfluencers(),
        repo.listBenchmarks(),
      ]);

      const influencerQuery = body.influencer_name ?? "";
      const matchedCreator = body.influencer_id
        ? await repo.findInfluencerById(body.influencer_id)
        : await repo.findInfluencerByQuery(influencerQuery);

      const sebiResult = lookupSebiRegister({
        query: influencerQuery || matchedCreator?.name || "",
        entries: sebiData.entries,
        aliases: influencers,
        snapshotDate: sebiData.snapshotDate,
        snapshotId: sebiData.snapshotId,
        dataLabel: sebiData.dataLabel,
      });

      const parsedClaims =
        body.claims ??
        runBoundedMultimodalParse({
          text: originalText,
          influencerName: influencerQuery || undefined,
          stockName: stock?.company_name ?? body.ticker,
          catalogue,
          demoCases: [],
          llmProvider: config.LLM_PROVIDER,
        }).claims;

      const hype = detectHypePhrases(originalText);
      const disclosure = classifyDisclosure(originalText);

      const instrumentType = stock?.instrument_type ?? "EQUITY";
      const [initialReportBars, initialReportStockInfo, surveillance] = stock
        ? await Promise.all([
            repo.getPriceHistory(stock.ticker),
            repo.getStockInfo(stock.ticker),
            repo.getSurveillance(stock.ticker),
          ])
        : [[], null, []];
      let bars = initialReportBars;
      let stockInfo = initialReportStockInfo;

      let reportCompanyName = stock?.company_name ?? body.ticker;
      if (!stock && liveMarketActive && instrumentType === "EQUITY") {
        const liveHistory = await fetchLiveHistoricalBars(body.ticker, {
          enabled: true,
          range: "3mo",
          fetchImpl,
        });
        if (liveHistory && liveHistory.bars.length > 0) {
          bars = liveHistory.bars;
          if (liveHistory.stockInfo) stockInfo = liveHistory.stockInfo;
          if (liveHistory.companyName) reportCompanyName = liveHistory.companyName;
        }
      }

      const marketChecks = computeAllMarketChecks({
        instrumentType,
        bars,
        stockInfo,
        surveillanceEntries: surveillance,
        circuitBand: stockInfo?.circuit_band ?? stock?.circuit_band ?? null,
        asOfDate: body.as_of_date ?? bars[bars.length - 1]?.trading_date ?? asOfDate,
        tipDate: body.tip_date ?? bars[bars.length - 1]?.trading_date ?? tipDate,
      });

      const creatorTips = matchedCreator
        ? await repo.getTipsByInfluencer({ influencerId: matchedCreator.id })
        : [];
      const pricesByTicker: Record<string, { trading_date: string; close: number | string }[]> = {};
      const uniqueTickers = [...new Set(creatorTips.map((t) => t.ticker).filter(Boolean))];
      await Promise.all(
        uniqueTickers.map(async (t) => {
          pricesByTicker[t] = await repo.getPriceHistory(t);
        })
      );

      const trackRecord = computeCreatorTrackRecord({
        creatorId: matchedCreator?.id ?? null,
        creatorName: matchedCreator?.name ?? (influencerQuery || null),
        tips: creatorTips,
        pricesByTicker,
        niftySeries: benchmarks.NIFTY_50,
        asOfDate: benchmarks.NIFTY_50[benchmarks.NIFTY_50.length - 1]?.trading_date ?? asOfDate,
        dataLabel: creatorTips.some((t) => t.is_synthetic) ? "SYNTHETIC" : null,
      });

      const report = buildGuardedFactsCard({
        instrumentDisplayName: reportCompanyName,
        claims: parsedClaims,
        hypeFlags: hype.flags,
        disclosure,
        sebi: sebiResult,
        marketChecks,
        trackRecord,
        originalCreatorText: originalText.trim() ? originalText : null,
      });

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...report,
      });
    })
  );

  // 8. Supporting meta endpoints
  router.get(
    "/meta/demo-cases",
    asyncRoute(async (req, res) => {
      const cases = await repo.listDemoCases();
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        items: cases,
      });
    })
  );

  router.get(
    "/meta/benchmarks",
    asyncRoute(async (req, res) => {
      if (liveMarketActive) {
        const live = await fetchLiveBenchmarkSummaries({
          enabled: true,
          cacheTtlMs: config.LIVE_MARKET_CACHE_TTL_MS,
          fetchImpl,
        });
        if (live && live.some((b) => b.status === "AVAILABLE")) {
          res.status(200).json({
            request_id: req.requestId ?? "req_unknown",
            fetched_at: new Date().toISOString(),
            data_freshness: "LIVE_FEED",
            benchmarks: live,
          });
          return;
        }
      }

      const benchmarks = await repo.listBenchmarks();
      const summarize = (key: "NIFTY_50" | "SENSEX" | "BANKNIFTY", label: string) => {
        const series = benchmarks[key];
        const latest = series[series.length - 1];
        const prev = series[series.length - 2];
        if (!latest || !prev) {
          return {
            key,
            label,
            status: "COULD_NOT_VERIFY" as const,
            close: null,
            change: null,
            change_percent: null,
            as_of_date: null,
            fetched_at: null,
            data_freshness: null,
            data_label: null,
            source_name: null,
            sparkline: [] as Array<{ date: string; close: number }>,
          };
        }
        const change = Number((latest.close - prev.close).toFixed(2));
        const changePercent = Number(((change / prev.close) * 100).toFixed(2));
        return {
          key,
          label,
          status: "AVAILABLE" as const,
          close: latest.close,
          change,
          change_percent: changePercent,
          as_of_date: latest.trading_date,
          fetched_at: null,
          data_freshness: "DATED_SNAPSHOT" as const,
          data_label: latest.data_label,
          source_name: latest.source_name,
          sparkline: series.slice(-15).map((b) => ({ date: b.trading_date, close: b.close })),
        };
      };

      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        fetched_at: null,
        data_freshness: "DATED_SNAPSHOT",
        benchmarks: [
          summarize("NIFTY_50", "NIFTY 50"),
          summarize("SENSEX", "SENSEX"),
          summarize("BANKNIFTY", "BANKNIFTY"),
        ],
      });
    })
  );

  router.get(
    "/meta/snapshots",
    asyncRoute(async (req, res) => {
      const snapshots = await repo.listSnapshots();
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        snapshots,
      });
    })
  );

  // 9. Optional Sarvam Voice Readout (Task 3.3 — strictly guarded text only)
  router.post(
    "/voice/readout",
    providerRateLimit,
    asyncRoute(async (req, res) => {
      const body = VoiceReadoutSchema.parse(req.body ?? {});
      const result = await synthesizeGuardedVoiceReadout({
        guardedText: body.guarded_text,
        language: body.language,
        apiKey: config.SARVAM_API_KEY,
      });
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...result,
      });
    })
  );

  // 10. Optional Synthetic Coordinated-Promotion Demo Signal (Task 3.4 — strictly separate from 5 core checks)
  router.get(
    "/meta/coordinated-demo",
    asyncRoute(async (req, res) => {
      const ticker = typeof req.query.ticker === "string" ? req.query.ticker : "";
      const signal = getSyntheticCoordinatedDemoSignal(ticker);
      res.status(200).json({
        request_id: req.requestId ?? "req_unknown",
        ...signal,
      });
    })
  );

  return router;
}
