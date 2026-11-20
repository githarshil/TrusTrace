import { randomBytes, randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import type { AppEnv } from "../../core/env.js";
import { AppError } from "../../core/errors.js";
import type { FinfluencerAlertRepository } from "../../db/finfluencerRepository.js";
import type { EvidenceRepository } from "../../db/repository.js";
import { MANDATORY_DISCLAIMER } from "../../domain/output-guard/guard.js";
import {
  DEFAULT_SUGGESTED_QUESTIONS,
  generateGroundedChatResponse,
} from "../../domain/research/researchChat.js";
import {
  analyzeSocialSource,
  buildResearchOverview,
} from "../../domain/research/researchEngine.js";
import {
  defaultResearchSessionStore,
  type ResearchSessionStore,
} from "../../domain/research/researchSessionStore.js";
import type { ResearchSession, StockMarketContextSummary } from "../../domain/research/types.js";
import { fetchLiveStockQuote } from "../../integrations/liveMarketFeed.js";
import { resolveOfficialOembedUrl } from "../../integrations/publicRssConnectors.js";
import {
  synthesizeGuardedVoiceReadout,
  transcribeAudioWithSarvam,
} from "../../integrations/sarvamVoice.js";
import { collectSocialSignals } from "../../integrations/socialConnectors.js";

// Ephemeral in-memory audio upload for Sarvam STT (never written to disk or DB)
const voiceAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const CreateSessionSchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  company_name: z.string().trim().min(1).max(120).optional(),
  exchange: z.enum(["NSE", "BSE"]).default("NSE"),
  time_range: z.enum(["24h", "7d", "30d", "90d"]).default("7d"),
});

const ImportSourceSchema = z.object({
  platform: z.enum(["YOUTUBE", "REDDIT", "NEWS", "X", "TELEGRAM"]).default("TELEGRAM"),
  creator_name: z.string().trim().max(80).optional(),
  title: z.string().trim().max(200).optional(),
  text: z.string().trim().max(5_000).optional().default(""),
  source_url: z.string().trim().max(400).optional(),
  published_at: z.string().trim().max(64).optional(),
});

const ChatRequestSchema = z.object({
  question: z.string().trim().min(2).max(1_000),
  stream: z.boolean().optional().default(false),
  language: z.enum(["en-IN", "hi-IN", "kn-IN"]).optional().default("en-IN"),
});

const VoiceSessionRequestSchema = z.object({
  action: z.enum(["init", "synthesize"]).default("init"),
  text: z.string().trim().max(1_500).optional(),
  language: z.enum(["en-IN", "hi-IN", "kn-IN"]).default("en-IN"),
});

function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function normalizeTicker(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\.(NS|BO)$/i, "")
    .replace(/[^A-Z0-9._&-]/g, "")
    .slice(0, 24);
}

async function resolveStockContext(params: {
  ticker: string;
  companyName?: string;
  exchange: "NSE" | "BSE";
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  fetchImpl?: typeof fetch;
}): Promise<StockMarketContextSummary> {
  const cleanTicker = normalizeTicker(params.ticker);
  const localStock = await params.evidenceRepo.getStockByTicker(cleanTicker);
  const resolvedCompany = params.companyName ?? localStock?.company_name ?? cleanTicker;

  if (params.config.LIVE_MARKET_ENABLED) {
    try {
      const liveQuote = await fetchLiveStockQuote(cleanTicker, {
        enabled: params.config.LIVE_MARKET_ENABLED,
        cacheTtlMs: params.config.LIVE_MARKET_CACHE_TTL_MS,
        fetchImpl: params.fetchImpl,
      });
      if (liveQuote && liveQuote.price !== null) {
        return {
          ticker: cleanTicker,
          company_name: liveQuote.company_name || resolvedCompany,
          exchange: liveQuote.exchange ?? params.exchange,
          latest_price: liveQuote.price,
          change_percent: liveQuote.change_percent,
          as_of_date: liveQuote.as_of_date,
          data_freshness: liveQuote.data_freshness,
          data_label: liveQuote.data_label,
          source_name: liveQuote.source_name,
        };
      }
    } catch {
      // Fall back to dated snapshot cleanly
    }
  }

  if (localStock) {
    const bars = await params.evidenceRepo.getPriceHistory(localStock.ticker);
    const latest = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : undefined;
    if (latest) {
      const latestClose = Number(latest.close);
      const prevClose = prev ? Number(prev.close) : null;
      const changePct =
        prevClose !== null && Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(latestClose)
          ? Number((((latestClose - prevClose) / prevClose) * 100).toFixed(2))
          : null;
      return {
        ticker: localStock.ticker,
        company_name: localStock.company_name,
        exchange: localStock.exchange,
        latest_price: Number.isFinite(latestClose) ? latestClose : null,
        change_percent: changePct,
        as_of_date: latest.trading_date,
        data_freshness: "DATED_SNAPSHOT",
        data_label: "REAL",
        source_name: "Dated Exchange Snapshot",
      };
    }
  }

  return {
    ticker: cleanTicker,
    company_name: resolvedCompany,
    exchange: params.exchange,
    latest_price: null,
    change_percent: null,
    as_of_date: null,
    data_freshness: "UNAVAILABLE",
    data_label: null,
    source_name: null,
  };
}

function serializeSessionResponse(session: ResearchSession, requestId: string) {
  return {
    request_id: requestId,
    session_id: session.session_id,
    ticker: session.ticker,
    company_name: session.company_name,
    exchange: session.exchange,
    time_range: session.time_range,
    created_at: session.created_at,
    updated_at: session.updated_at,
    expires_at: session.expires_at,
    stock_context: session.stock_context,
    connectors: session.connectors,
    sources: session.sources,
    overview: session.overview,
    messages: session.messages,
    suggested_questions: DEFAULT_SUGGESTED_QUESTIONS,
    mandatory_disclaimer: MANDATORY_DISCLAIMER,
  };
}

export interface ResearchRouterOptions {
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  alertRepo: FinfluencerAlertRepository;
  sessionStore?: ResearchSessionStore;
  fetchImpl?: typeof fetch;
}

export function createResearchRouter(options: ResearchRouterOptions): Router {
  const router = Router();
  const store = options.sessionStore ?? defaultResearchSessionStore;

  function requireSession(sessionId: string): ResearchSession {
    const found = store.get(sessionId);
    if (!found) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Research session was not found or has expired. Start a new research session.",
        statusCode: 404,
        retryable: false,
      });
    }
    return found;
  }

  // POST /api/research/sessions
  router.post(
    "/research/sessions",
    asyncRoute(async (req, res) => {
      const parsed = CreateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Provide a valid NSE/BSE ticker and time range to start research.",
          statusCode: 400,
          retryable: false,
        });
      }

      const cleanTicker = normalizeTicker(parsed.data.ticker);
      if (!cleanTicker) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Ticker symbol could not be parsed.",
          statusCode: 400,
          retryable: false,
        });
      }

      const stockContext = await resolveStockContext({
        ticker: cleanTicker,
        companyName: parsed.data.company_name,
        exchange: parsed.data.exchange,
        config: options.config,
        evidenceRepo: options.evidenceRepo,
        fetchImpl: options.fetchImpl,
      });

      const collection = await collectSocialSignals({
        ticker: stockContext.ticker,
        companyName: stockContext.company_name,
        timeRange: parsed.data.time_range,
        config: options.config,
        evidenceRepo: options.evidenceRepo,
        alertRepo: options.alertRepo,
        fetchImpl: options.fetchImpl,
      });

      const analyzedSources = collection.rawSources.map((raw, idx) =>
        analyzeSocialSource(raw, idx + 1, stockContext.ticker)
      );

      const overview = buildResearchOverview(analyzedSources, collection.connectors);
      const nowIso = new Date().toISOString();
      const session: ResearchSession = {
        session_id: `res_${randomUUID().slice(0, 12)}`,
        ticker: stockContext.ticker,
        company_name: stockContext.company_name,
        exchange: stockContext.exchange,
        time_range: parsed.data.time_range,
        created_at: nowIso,
        updated_at: nowIso,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        stock_context: stockContext,
        connectors: collection.connectors,
        sources: analyzedSources,
        overview,
        messages: [],
      };

      const saved = store.save(session);
      res.status(201).json(serializeSessionResponse(saved, req.requestId ?? "req_unknown"));
    })
  );

  // GET /api/research/sessions/:session_id
  router.get(
    "/research/sessions/:session_id",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      res.json(serializeSessionResponse(session, req.requestId ?? "req_unknown"));
    })
  );

  // GET /api/research/sessions/:session_id/status
  router.get(
    "/research/sessions/:session_id/status",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      res.json({
        request_id: req.requestId ?? "req_unknown",
        session_id: session.session_id,
        ticker: session.ticker,
        updated_at: session.updated_at,
        expires_at: session.expires_at,
        total_sources: session.sources.length,
        connectors: session.connectors,
      });
    })
  );

  // GET /api/research/sessions/:session_id/sources
  router.get(
    "/research/sessions/:session_id/sources",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      res.json({
        request_id: req.requestId ?? "req_unknown",
        session_id: session.session_id,
        ticker: session.ticker,
        sources: session.sources,
      });
    })
  );

  // GET /api/research/sessions/:session_id/claims
  router.get(
    "/research/sessions/:session_id/claims",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      res.json({
        request_id: req.requestId ?? "req_unknown",
        session_id: session.session_id,
        ticker: session.ticker,
        overview: session.overview,
        mandatory_disclaimer: MANDATORY_DISCLAIMER,
      });
    })
  );

  // POST /api/research/sessions/:session_id/import
  router.post(
    "/research/sessions/:session_id/import",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      const parsed = ImportSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Provide message/transcript text or a valid public YouTube/X link to import.",
          statusCode: 400,
          retryable: false,
        });
      }

      let resolvedPlatform = parsed.data.platform;
      let resolvedCreator = parsed.data.creator_name;
      let resolvedTitle = parsed.data.title;
      let resolvedText = parsed.data.text.trim();
      let resolvedUrl = parsed.data.source_url?.trim() || null;

      // Zero-key official oEmbed resolution for allowlisted YouTube/X URLs when text is omitted
      if (resolvedUrl && resolvedText.length < 5) {
        const oembed = await resolveOfficialOembedUrl(resolvedUrl, {
          fetchImpl: options.fetchImpl,
        });
        if (oembed) {
          resolvedPlatform = oembed.platform;
          resolvedCreator = resolvedCreator || oembed.creator_name;
          resolvedTitle = resolvedTitle || oembed.title;
          resolvedText = oembed.text;
          resolvedUrl = oembed.source_url;
        }
      }

      if (resolvedText.length < 5) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message:
            "Provide at least 5 characters of message/transcript text, or paste a valid public YouTube or X post URL.",
          statusCode: 400,
          retryable: false,
        });
      }

      const nextCitationIndex = session.sources.length + 1;
      const defaultTitle =
        resolvedTitle ||
        `User-imported ${resolvedPlatform} excerpt: ${resolvedText.slice(0, 72)}`;

      const importedSource = analyzeSocialSource(
        {
          platform: resolvedPlatform,
          creator_name: resolvedCreator || `User-submitted ${resolvedPlatform} source`,
          channel_or_handle: resolvedCreator || null,
          title: defaultTitle,
          text: resolvedText,
          published_at: parsed.data.published_at || null,
          retrieved_at: new Date().toISOString(),
          source_url: resolvedUrl,
          provenance_kind: "USER_SUBMITTED",
          data_label: "MIXED",
        },
        nextCitationIndex,
        session.ticker
      );

      const updatedSources = [importedSource, ...session.sources];
      const updatedConnectors = session.connectors.map((conn) => {
        if (conn.platform !== resolvedPlatform) return conn;
        const count = updatedSources.filter((s) => s.platform === conn.platform).length;
        return {
          ...conn,
          status: "COLLECTION_COMPLETE" as const,
          items_collected: count,
          availability_reason:
            conn.platform === "TELEGRAM"
              ? `Includes ${count} manually imported Telegram message(s) in this temporary session (zero scraping).`
              : `Includes ${count} source(s) including user-submitted URL/transcript content.`,
          last_checked_at: new Date().toISOString(),
        };
      });

      const updatedOverview = buildResearchOverview(updatedSources, updatedConnectors);
      const saved = store.save({
        ...session,
        connectors: updatedConnectors,
        sources: updatedSources,
        overview: updatedOverview,
      });

      res.status(201).json(serializeSessionResponse(saved, req.requestId ?? "req_unknown"));
    })
  );

  // POST /api/research/sessions/:session_id/chat
  router.post(
    "/research/sessions/:session_id/chat",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      const parsed = ChatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Enter a question between 2 and 1,000 characters.",
          statusCode: 400,
          retryable: false,
        });
      }

      const userMessage = {
        id: `msg_${randomUUID().slice(0, 10)}`,
        role: "user" as const,
        content: parsed.data.question,
        created_at: new Date().toISOString(),
        citations: [],
      };

      const { assistantMessage, mandatoryDisclaimer } = await generateGroundedChatResponse({
        question: parsed.data.question,
        session,
        config: options.config,
        language: parsed.data.language,
        fetchImpl: options.fetchImpl,
      });

      store.save({
        ...session,
        messages: [...session.messages, userMessage, assistantMessage].slice(-30),
      });

      const responsePayload = {
        request_id: req.requestId ?? "req_unknown",
        session_id: session.session_id,
        message: assistantMessage,
        mandatory_disclaimer: mandatoryDisclaimer,
      };

      const wantsStream =
        parsed.data.stream === true ||
        (req.headers.accept ?? "").includes("text/event-stream");

      if (wantsStream) {
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");

        const words = assistantMessage.content.split(/(\s+)/);
        for (let i = 0; i < words.length; i += 4) {
          const chunk = words.slice(i, i + 4).join("");
          res.write(`event: token\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        }
        res.write(`event: done\ndata: ${JSON.stringify({ response: responsePayload })}\n\n`);
        res.end();
        return;
      }

      res.json(responsePayload);
    })
  );

  // POST /api/research/sessions/:session_id/voice-session
  router.post(
    "/research/sessions/:session_id/voice-session",
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      const parsed = VoiceSessionRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Invalid voice session request parameters.",
          statusCode: 400,
          retryable: false,
        });
      }

      const ephemeralToken = `vs_${randomBytes(16).toString("hex")}`;
      const serverTtsProvider = options.config.SARVAM_API_KEY ? "sarvam" : "disabled";
      const supportedLanguages = [
        { code: "en-IN" as const, label: "English (India)" },
        { code: "hi-IN" as const, label: "हिन्दी / Hinglish" },
        { code: "kn-IN" as const, label: "ಕನ್ನಡ (Kannada)" },
      ];

      if (parsed.data.action === "synthesize" && parsed.data.text) {
        const ttsResult = await synthesizeGuardedVoiceReadout({
          guardedText: parsed.data.text,
          language: parsed.data.language,
          apiKey: options.config.SARVAM_API_KEY,
          fetchImpl: options.fetchImpl,
        });
        res.json({
          request_id: req.requestId ?? "req_unknown",
          session_id: session.session_id,
          voice_token: ephemeralToken,
          expires_in_seconds: 300,
          server_tts_provider: serverTtsProvider,
          supported_languages: supportedLanguages,
          tts_audio: {
            status: ttsResult.status,
            language: ttsResult.language,
            audio_base64: ttsResult.audio_base64,
            mime_type: ttsResult.mime_type,
            message: ttsResult.message,
          },
        });
        return;
      }

      res.json({
        request_id: req.requestId ?? "req_unknown",
        session_id: session.session_id,
        voice_token: ephemeralToken,
        expires_in_seconds: 300,
        server_tts_provider: serverTtsProvider,
        supported_languages: supportedLanguages,
      });
    })
  );

  // POST /api/research/sessions/:session_id/voice-stt
  router.post(
    "/research/sessions/:session_id/voice-stt",
    voiceAudioUpload.single("file"),
    asyncRoute(async (req, res) => {
      const session = requireSession(String(req.params.session_id));
      const uploaded = req.file;
      if (!uploaded || !uploaded.buffer || uploaded.buffer.length === 0) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Audio recording file is required for speech-to-text.",
          statusCode: 400,
          retryable: false,
        });
      }

      const rawLang =
        typeof (req.body as { language?: unknown })?.language === "string"
          ? (req.body as { language: string }).language
          : "en-IN";
      const parsedLang = z.enum(["en-IN", "hi-IN", "kn-IN"]).safeParse(rawLang);
      const language = parsedLang.success ? parsedLang.data : "en-IN";

      const sttResult = await transcribeAudioWithSarvam({
        audioBuffer: uploaded.buffer,
        mimeType: uploaded.mimetype || "audio/webm",
        language,
        apiKey: options.config.SARVAM_API_KEY,
        fetchImpl: options.fetchImpl,
      });

      res.json({
        request_id: req.requestId ?? "req_unknown",
        session_id: session.session_id,
        status: sttResult.status,
        language: sttResult.language,
        transcript: sttResult.transcript,
        message: sttResult.message,
      });
    })
  );

  return router;
}
