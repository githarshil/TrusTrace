import type { AppEnv } from "../../core/env.js";
import { logInfo, logWarn } from "../../core/logger.js";
import type {
  FinfluencerAlertRepository,
  VideoAnalysisRecord,
} from "../../db/finfluencerRepository.js";
import type { EvidenceRepository } from "../../db/repository.js";
import { classifyDisclosure } from "../disclosure/classifier.js";
import { detectHypePhrases } from "../hype/detector.js";
import { computeAllMarketChecks, METHODOLOGY_CONFIG_V1 } from "../market-checks/checks.js";
import { buildGuardedFactsCard } from "../output-guard/guard.js";
import { lookupSebiRegister } from "../sebi/lookup.js";
import { computeCreatorTrackRecord } from "../track-record/stats.js";
import { parseClaimLedgerWithFreeAiFallback } from "../../integrations/freeLlmClaimParser.js";
import {
  DEFAULT_INDIAN_WATCHLIST,
  fetchLiveHistoricalBars,
  searchLiveIndianStocks,
} from "../../integrations/liveMarketFeed.js";
import {
  buildGuardedWhatsAppSummary,
  decryptSensitiveField,
  sendGuardedWhatsAppAlert,
} from "../../integrations/whatsappNotifier.js";
import {
  fetchPublicYouTubeTranscriptOrMetadata,
  fetchYouTubeChannelRss,
  type YouTubeRssVideoItem,
} from "../../integrations/youtubeMonitor.js";
import type { InfluencerRecord } from "../../ingestion/demoCorpus.js";

export interface SyncInfluencerResult {
  influencer_id: string;
  influencer_name: string;
  fetched_from_rss: number;
  newly_analyzed: number;
  alerts_dispatched: number;
  videos: VideoAnalysisRecord[];
}

async function resolveDetectedTicker(params: {
  extractedStockName: string | null;
  sourceText: string;
  evidenceRepo: EvidenceRepository;
  config: AppEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ ticker: string | null; companyName: string }> {
  const localCatalogue = await params.evidenceRepo.searchStocks("");

  const candidates = [
    ...localCatalogue.map((s) => ({
      ticker: s.ticker,
      company_name: s.company_name,
      aliases: s.aliases,
    })),
    ...DEFAULT_INDIAN_WATCHLIST.map((w) => ({
      ticker: w.ticker,
      company_name: w.company_name,
      aliases: [w.ticker, w.company_name.replace(/\s+(Ltd|Limited)$/i, "")],
    })),
  ];

  // 1. Check extracted stock name or verbatim source text against curated + watchlist Indian stocks
  const searchSpace = [params.extractedStockName, params.sourceText].filter(Boolean).join(" ");
  for (const item of candidates) {
    const terms = [item.ticker, item.company_name, ...item.aliases]
      .filter((t) => t.trim().length >= 3)
      .sort((a, b) => b.length - a.length);
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(searchSpace)) {
        return { ticker: item.ticker, companyName: item.company_name };
      }
    }
  }

  // 2. If AI extracted a stock name not in local watchlist, try zero-cost Yahoo Finance Indian search
  if (params.extractedStockName && params.config.LIVE_MARKET_ENABLED) {
    const liveMatches = await searchLiveIndianStocks(params.extractedStockName, {
      enabled: true,
      fetchImpl: params.fetchImpl,
    });
    if (liveMatches[0]) {
      return {
        ticker: liveMatches[0].ticker,
        companyName: liveMatches[0].company_name,
      };
    }
  }

  return {
    ticker: null,
    companyName: params.extractedStockName ?? "Unspecified Security",
  };
}

export async function analyzeAndStoreYouTubeVideo(params: {
  influencer: InfluencerRecord;
  video: YouTubeRssVideoItem;
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  alertRepo: FinfluencerAlertRepository;
  fetchImpl?: typeof fetch;
}): Promise<{ analysis: VideoAnalysisRecord; isNew: boolean }> {
  const existing = await params.alertRepo.getVideoAnalysisByVideoId(params.video.video_id);
  if (existing) {
    return { analysis: existing, isNew: false };
  }

  const transcript = await fetchPublicYouTubeTranscriptOrMetadata(params.video, {
    fetchImpl: params.fetchImpl,
  });

  const [catalogue, sebiData, allInfluencers, benchmarks] = await Promise.all([
    params.evidenceRepo.searchStocks(""),
    params.evidenceRepo.listSebiEntries(),
    params.evidenceRepo.listInfluencers(),
    params.evidenceRepo.listBenchmarks(),
  ]);

  const extendedCatalogue = [
    ...catalogue.map((s) => ({
      ticker: s.ticker,
      company_name: s.company_name,
      aliases: s.aliases,
    })),
    ...DEFAULT_INDIAN_WATCHLIST.filter(
      (w) => !catalogue.some((c) => c.ticker === w.ticker)
    ).map((w) => ({
      ticker: w.ticker,
      company_name: w.company_name,
      aliases: [w.company_name.replace(/\s+(Ltd|Limited)$/i, "")],
    })),
  ];

  // Bounded free-tier AI Claim Ledger extraction (with deterministic fallback)
  const aiParse = await parseClaimLedgerWithFreeAiFallback({
    sourceText: transcript.text,
    catalogue: extendedCatalogue,
    llmProvider: params.config.LLM_PROVIDER,
    llmApiKey: params.config.LLM_API_KEY,
    fetchImpl: params.fetchImpl,
  });

  const hype = detectHypePhrases(transcript.text);
  const disclosure = classifyDisclosure(transcript.text);
  const sebi = lookupSebiRegister({
    query: params.influencer.name,
    entries: sebiData.entries,
    aliases: allInfluencers,
    snapshotDate: sebiData.snapshotDate,
    snapshotId: sebiData.snapshotId,
    dataLabel: sebiData.dataLabel,
  });

  const resolved = await resolveDetectedTicker({
    extractedStockName: aiParse.claims.stock.value,
    sourceText: transcript.text,
    evidenceRepo: params.evidenceRepo,
    config: params.config,
    fetchImpl: params.fetchImpl,
  });

  const publishedDate = params.video.published_at.slice(0, 10);
  let bars = resolved.ticker ? await params.evidenceRepo.getPriceHistory(resolved.ticker) : [];
  let stockInfo = resolved.ticker ? await params.evidenceRepo.getStockInfo(resolved.ticker) : null;
  const surveillance = resolved.ticker
    ? await params.evidenceRepo.getSurveillance(resolved.ticker)
    : [];

  // Fetch real-time Yahoo Finance daily history when live market is enabled and ticker resolved
  if (resolved.ticker && params.config.LIVE_MARKET_ENABLED) {
    const liveHistory = await fetchLiveHistoricalBars(resolved.ticker, {
      enabled: true,
      range: "3mo",
      fetchImpl: params.fetchImpl,
    });
    if (liveHistory && liveHistory.bars.length > 0) {
      bars = liveHistory.bars;
      if (liveHistory.stockInfo) {
        stockInfo = liveHistory.stockInfo;
      }
    }
  }

  const asOfDate =
    bars[bars.length - 1]?.trading_date ?? new Date().toISOString().slice(0, 10);

  const marketChecks = computeAllMarketChecks({
    instrumentType: "EQUITY",
    bars,
    stockInfo,
    surveillanceEntries: surveillance,
    circuitBand: stockInfo?.circuit_band ?? null,
    asOfDate,
    tipDate: publishedDate,
    config: METHODOLOGY_CONFIG_V1,
  });

  const creatorTips = await params.evidenceRepo.getTipsByInfluencer({
    influencerId: params.influencer.id,
  });
  const pricesByTicker: Record<string, { trading_date: string; close: number | string }[]> = {};
  for (const ticker of [...new Set(creatorTips.map((t) => t.ticker).filter(Boolean))]) {
    pricesByTicker[ticker] = await params.evidenceRepo.getPriceHistory(ticker);
  }

  const trackRecord = computeCreatorTrackRecord({
    creatorId: params.influencer.id,
    creatorName: params.influencer.name,
    tips: creatorTips,
    pricesByTicker,
    niftySeries: benchmarks.NIFTY_50,
    asOfDate: benchmarks.NIFTY_50[benchmarks.NIFTY_50.length - 1]?.trading_date ?? asOfDate,
    dataLabel: creatorTips.some((t) => t.is_synthetic) ? "SYNTHETIC" : null,
  });

  // Build mandatory Output-Guarded Information Verdict
  const guardedReport = buildGuardedFactsCard({
    instrumentDisplayName: resolved.companyName,
    claims: aiParse.claims,
    hypeFlags: hype.flags,
    disclosure,
    sebi,
    marketChecks,
    trackRecord,
    originalCreatorText: params.video.title,
  });

  // Build mandatory Output-Guarded WhatsApp Alert message
  const waSummary = buildGuardedWhatsAppSummary({
    influencerName: params.influencer.name,
    videoTitle: params.video.title,
    videoUrl: params.video.video_url,
    publishedAtIso: params.video.published_at,
    transcriptSource: transcript.source,
    detectedTicker: resolved.ticker,
    sebi,
    report: guardedReport,
  });

  const saved = await params.alertRepo.saveVideoAnalysis({
    influencer_id: params.influencer.id,
    video_id: params.video.video_id,
    title: params.video.title,
    video_url: params.video.video_url,
    thumbnail_url: params.video.thumbnail_url,
    published_at: params.video.published_at,
    transcript_source: transcript.source,
    detected_ticker: resolved.ticker,
    claim_ledger_json: aiParse.claims,
    hype_flags_json: hype.flags,
    disclosure_grade: disclosure.grade,
    guarded_report_json: guardedReport,
    guard_status: waSummary.guardStatus,
    whatsapp_summary_text: waSummary.text,
  });

  return { analysis: saved, isNew: true };
}

export async function dispatchAlertsForVideo(params: {
  analysis: VideoAnalysisRecord;
  config: AppEnv;
  alertRepo: FinfluencerAlertRepository;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const subs = await params.alertRepo.listActiveSubscriptions(params.analysis.influencer_id);
  let dispatched = 0;

  for (const sub of subs) {
    const alreadySent = await params.alertRepo.hasDeliveryLog(sub.id, params.analysis.id);
    if (alreadySent) continue;

    try {
      const phoneE164 = decryptSensitiveField(
        sub.phone_encrypted,
        params.config.SUBSCRIPTION_ENCRYPTION_KEY
      );
      const callMeBotApiKey = sub.provider_config_encrypted
        ? decryptSensitiveField(
            sub.provider_config_encrypted,
            params.config.SUBSCRIPTION_ENCRYPTION_KEY
          )
        : null;

      const delivery = await sendGuardedWhatsAppAlert({
        phoneE164,
        provider: sub.provider,
        message: params.analysis.whatsapp_summary_text,
        callMeBotApiKey,
        twilioAccountSid: params.config.TWILIO_ACCOUNT_SID,
        twilioAuthToken: params.config.TWILIO_AUTH_TOKEN,
        twilioWhatsAppFrom: params.config.TWILIO_WHATSAPP_FROM,
        metaAccessToken: params.config.META_WHATSAPP_ACCESS_TOKEN,
        metaPhoneNumberId: params.config.META_WHATSAPP_PHONE_NUMBER_ID,
        fetchImpl: params.fetchImpl,
      });

      await params.alertRepo.recordDeliveryLog({
        subscription_id: sub.id,
        video_analysis_id: params.analysis.id,
        provider: sub.provider,
        delivery_status: delivery.status,
        message_preview: delivery.messagePreview,
        error_code: delivery.errorCode,
      });

      if (delivery.status === "SENT" || delivery.status === "DRY_RUN_PREVIEW") {
        dispatched += 1;
      }
    } catch (err) {
      logWarn("youtube_pipeline.dispatch_error", {
        subscription_id: sub.id,
        video_id: params.analysis.video_id,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return dispatched;
}

export async function syncInfluencerYouTubeFeed(params: {
  influencer: InfluencerRecord;
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  alertRepo: FinfluencerAlertRepository;
  dispatchToSubscribers: boolean;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<SyncInfluencerResult> {
  if (!params.influencer.youtube_channel_id) {
    const existing = await params.alertRepo.listVideoAnalyses(
      params.influencer.id,
      params.limit ?? 5
    );
    return {
      influencer_id: params.influencer.id,
      influencer_name: params.influencer.name,
      fetched_from_rss: 0,
      newly_analyzed: 0,
      alerts_dispatched: 0,
      videos: existing,
    };
  }

  const rssItems = await fetchYouTubeChannelRss(params.influencer.youtube_channel_id, {
    limit: params.limit ?? 4,
    fetchImpl: params.fetchImpl,
  });

  let newlyAnalyzed = 0;
  let alertsDispatched = 0;

  for (const video of rssItems) {
    const { analysis, isNew } = await analyzeAndStoreYouTubeVideo({
      influencer: params.influencer,
      video,
      config: params.config,
      evidenceRepo: params.evidenceRepo,
      alertRepo: params.alertRepo,
      fetchImpl: params.fetchImpl,
    });

    if (isNew) {
      newlyAnalyzed += 1;
      // Dispatch automated WhatsApp alerts only for newly detected videos (avoiding backfill spam)
      if (params.dispatchToSubscribers) {
        alertsDispatched += await dispatchAlertsForVideo({
          analysis,
          config: params.config,
          alertRepo: params.alertRepo,
          fetchImpl: params.fetchImpl,
        });
      }
    }
  }

  const latestVideos = await params.alertRepo.listVideoAnalyses(
    params.influencer.id,
    params.limit ?? 6
  );

  // Ensure any newly subscribed user who hasn't received the most recent video alert yet receives it on sync
  if (params.dispatchToSubscribers && latestVideos[0]) {
    alertsDispatched += await dispatchAlertsForVideo({
      analysis: latestVideos[0],
      config: params.config,
      alertRepo: params.alertRepo,
      fetchImpl: params.fetchImpl,
    });
  }

  logInfo("youtube_pipeline.sync_completed", {
    influencer_id: params.influencer.id,
    fetched_from_rss: rssItems.length,
    newly_analyzed: newlyAnalyzed,
    alerts_dispatched: alertsDispatched,
  });

  return {
    influencer_id: params.influencer.id,
    influencer_name: params.influencer.name,
    fetched_from_rss: rssItems.length,
    newly_analyzed: newlyAnalyzed,
    alerts_dispatched: alertsDispatched,
    videos: latestVideos,
  };
}

export async function pollAllTrackedFinfluencers(params: {
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  alertRepo: FinfluencerAlertRepository;
  dispatchToSubscribers: boolean;
  fetchImpl?: typeof fetch;
}): Promise<SyncInfluencerResult[]> {
  const influencers = await params.evidenceRepo.listInfluencers();
  const withYouTube = influencers.filter((inf) => Boolean(inf.youtube_channel_id));
  const results: SyncInfluencerResult[] = [];
  for (const influencer of withYouTube) {
    const res = await syncInfluencerYouTubeFeed({
      influencer,
      config: params.config,
      evidenceRepo: params.evidenceRepo,
      alertRepo: params.alertRepo,
      dispatchToSubscribers: params.dispatchToSubscribers,
      limit: 3,
      fetchImpl: params.fetchImpl,
    });
    results.push(res);
  }
  return results;
}
