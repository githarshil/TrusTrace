import type { AppEnv } from "../core/env.js";
import { logWarn } from "../core/logger.js";
import type { FinfluencerAlertRepository } from "../db/finfluencerRepository.js";
import type { EvidenceRepository } from "../db/repository.js";
import type { RawSocialSourceInput } from "../domain/research/researchEngine.js";
import type { ResearchTimeRange, SourceConnectorState } from "../domain/research/types.js";
import { fetchGoogleNewsIndiaRss, fetchRedditIndiaRss } from "./publicRssConnectors.js";
import { fetchYouTubeChannelRss } from "./youtubeMonitor.js";

const CONNECTOR_TIMEOUT_MS = 7_000;

/**
 * Verified public Indian market & financial education YouTube channels whose official
 * public Atom RSS feeds require zero API keys and zero scraping.
 */
const PUBLIC_INDIAN_FINANCE_YOUTUBE_CHANNELS: Array<{
  name: string;
  handle: string;
  channelId: string;
}> = [
  { name: "CNBC-TV18", handle: "@cnbctv18news", channelId: "UCmRbHAgG2k2vDUvb3xsEunQ" },
  { name: "ET NOW", handle: "@ETNOW", channelId: "UCI_mwTKUhicNzFrhm33MzBQ" },
  { name: "Moneycontrol", handle: "@moneycontrol", channelId: "UChU3aT0_p4T0-tP2W5X0Q5Q" },
  { name: "Groww", handle: "@Groww", channelId: "UCw5TLrz3qADabwezTEcOmgQ" },
];

function timeRangeToDays(range: ResearchTimeRange): number {
  switch (range) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
}

function matchesStockQuery(text: string, ticker: string, companyName: string): boolean {
  const haystack = text.toLowerCase();
  const cleanTicker = ticker.replace(/\.(NS|BO)$/i, "").toLowerCase();
  if (cleanTicker.length >= 2 && haystack.includes(cleanTicker)) return true;

  const companyTokens = companyName
    .toLowerCase()
    .replace(/\b(limited|ltd|india|industries|enterprises|corp|corporation|bank)\b/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4);

  return companyTokens.some((tok) => haystack.includes(tok));
}

export interface SocialCollectionResult {
  connectors: SourceConnectorState[];
  rawSources: RawSocialSourceInput[];
}

/**
 * Collects permitted social & press signals strictly from official APIs, zero-key official
 * public RSS/Atom feeds (YouTube Atom RSS, Reddit India Markets RSS, Google News India RSS),
 * and clearly-labelled curated demo corpus records.
 *
 * Non-negotiable platform rules:
 * - Zero unauthorized scraping of YouTube, Reddit, X, or Telegram.
 * - Never fabricates live API results when credentials are absent or unauthorized.
 * - Telegram is strictly manual user import only.
 */
export async function collectSocialSignals(params: {
  ticker: string;
  companyName: string;
  timeRange: ResearchTimeRange;
  config: AppEnv;
  evidenceRepo: EvidenceRepository;
  alertRepo: FinfluencerAlertRepository;
  fetchImpl?: typeof fetch;
}): Promise<SocialCollectionResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const nowIso = new Date().toISOString();
  const daysBack = timeRangeToDays(params.timeRange);
  const cutoffMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const rawSources: RawSocialSourceInput[] = [];

  // Run zero-key official Reddit India RSS & Google News India RSS in parallel (skip in test unless custom fetchImpl is provided)
  const shouldFetchPublicRss =
    params.config.APP_ENV !== "test" || params.fetchImpl !== undefined;

  const [redditResult, newsResult] = shouldFetchPublicRss
    ? await Promise.all([
        fetchRedditIndiaRss({
          ticker: params.ticker,
          companyName: params.companyName,
          timeRange: params.timeRange,
          limit: 5,
          fetchImpl,
        }),
        fetchGoogleNewsIndiaRss({
          ticker: params.ticker,
          companyName: params.companyName,
          limit: 5,
          fetchImpl,
        }),
      ])
    : [
        { items: [] as RawSocialSourceInput[], ok: true },
        { items: [] as RawSocialSourceInput[], ok: true },
      ];

  for (const item of redditResult.items) {
    rawSources.push(item);
  }
  for (const item of newsResult.items) {
    rawSources.push(item);
  }

  // 1. YouTube Connector (Official YouTube Data API v3 if configured + Official Zero-Key Atom RSS feeds)
  let ytStatus: SourceConnectorState["status"] = "AVAILABLE";
  let ytReason = "Connected via zero-key official YouTube Atom RSS feeds.";
  let ytProvenance = "Real · YouTube Official RSS (Zero Key)";
  let ytCount = 0;

  if (params.config.YOUTUBE_DATA_API_KEY) {
    try {
      const publishedAfter = new Date(cutoffMs).toISOString();
      const query = `${params.companyName} ${params.ticker} NSE stock`;
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&order=relevance&publishedAfter=${encodeURIComponent(
        publishedAfter
      )}&q=${encodeURIComponent(query)}&key=${encodeURIComponent(
        params.config.YOUTUBE_DATA_API_KEY
      )}`;

      const res = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
      });

      if (res.ok) {
        const body = (await res.json()) as {
          items?: Array<{
            id?: { videoId?: string };
            snippet?: {
              title?: string;
              description?: string;
              channelTitle?: string;
              publishedAt?: string;
            };
          }>;
        };
        for (const item of body.items ?? []) {
          const videoId = item.id?.videoId;
          const title = item.snippet?.title;
          if (!videoId || !title) continue;
          rawSources.push({
            platform: "YOUTUBE",
            creator_name: item.snippet?.channelTitle ?? "YouTube Creator",
            channel_or_handle: item.snippet?.channelTitle ?? null,
            title,
            text: item.snippet?.description || title,
            published_at: item.snippet?.publishedAt ?? null,
            retrieved_at: nowIso,
            source_url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
            provenance_kind: "REAL_OFFICIAL_API",
            data_label: "REAL",
          });
          ytCount += 1;
        }
        ytStatus = "COLLECTION_COMPLETE";
        ytProvenance = "Real · YouTube Data API v3";
        ytReason =
          ytCount > 0
            ? `Collected ${ytCount} public video reference(s) via official YouTube Data API v3.`
            : "Official YouTube Data API v3 returned 0 matching videos for this time range.";
      } else {
        logWarn("research.youtube_api_error", { status: res.status });
        ytStatus = "ERROR";
        ytReason = `Official YouTube Data API v3 returned HTTP ${res.status}. Using zero-key official RSS feeds.`;
      }
    } catch {
      ytStatus = "ERROR";
      ytReason = "Official YouTube Data API v3 timed out. Using zero-key official RSS feeds.";
    }
  }

  // Zero-key official YouTube Atom RSS across tracked finfluencers + verified Indian finance channels
  try {
    const influencers = await params.evidenceRepo.listInfluencers();
    const rssChannelTargets: Array<{ name: string; handle: string | null; channelId: string }> = [];

    for (const inf of influencers) {
      const analyzed = await params.alertRepo.listVideoAnalyses(inf.id, 6);
      for (const vid of analyzed) {
        const matchText = `${vid.title} ${vid.detected_ticker ?? ""}`;
        if (!matchesStockQuery(matchText, params.ticker, params.companyName)) continue;
        if (rawSources.some((s) => s.source_url === vid.video_url)) continue;
        rawSources.push({
          platform: "YOUTUBE",
          creator_name: inf.name,
          channel_or_handle: inf.youtube_handle ?? inf.handle ?? null,
          title: vid.title,
          text: vid.whatsapp_summary_text || vid.title,
          published_at: vid.published_at,
          retrieved_at: nowIso,
          source_url: vid.video_url,
          provenance_kind: "REAL_YOUTUBE_RSS",
          data_label: "REAL",
        });
        ytCount += 1;
      }

      if (inf.youtube_channel_id) {
        rssChannelTargets.push({
          name: inf.name,
          handle: inf.youtube_handle ?? inf.handle ?? null,
          channelId: inf.youtube_channel_id,
        });
      }
    }

    if (params.config.YOUTUBE_MONITOR_ENABLED) {
      for (const pub of PUBLIC_INDIAN_FINANCE_YOUTUBE_CHANNELS) {
        if (!rssChannelTargets.some((c) => c.channelId === pub.channelId)) {
          rssChannelTargets.push(pub);
        }
      }

      const rssResults = await Promise.allSettled(
        rssChannelTargets.map(async (channel) => ({
          channel,
          videos: await fetchYouTubeChannelRss(channel.channelId, {
            limit: 6,
            fetchImpl,
          }),
        }))
      );

      for (const res of rssResults) {
        if (res.status !== "fulfilled") continue;
        for (const vid of res.value.videos) {
          if (!matchesStockQuery(`${vid.title} ${vid.description}`, params.ticker, params.companyName)) {
            continue;
          }
          if (rawSources.some((s) => s.source_url === vid.video_url)) continue;
          rawSources.push({
            platform: "YOUTUBE",
            creator_name: res.value.channel.name,
            channel_or_handle: res.value.channel.handle,
            title: vid.title,
            text: vid.description || vid.title,
            published_at: vid.published_at,
            retrieved_at: nowIso,
            source_url: vid.video_url,
            provenance_kind: "REAL_YOUTUBE_RSS",
            data_label: "REAL",
          });
          ytCount += 1;
        }
      }
    }
  } catch {
    // Non-fatal: RSS feed check failure should not break session creation
  }

  // Include matching curated demo corpus tips clearly labelled as CURATED_DEMO / SYNTHETIC
  try {
    const curatedCases = await params.evidenceRepo.listDemoCases();
    for (const demo of curatedCases) {
      if (
        !matchesStockQuery(
          `${demo.ticker} ${demo.instrument_name} ${demo.sample_text}`,
          params.ticker,
          params.companyName
        )
      ) {
        continue;
      }
      rawSources.push({
        platform: demo.media_type === "VIDEO" ? "YOUTUBE" : "TELEGRAM",
        creator_name: demo.influencer_name,
        channel_or_handle: demo.alias ?? null,
        title: `Curated Demo Case: ${demo.influencer_name} on ${demo.instrument_name}`,
        text: demo.sample_text,
        published_at: `${demo.tip_date}T09:15:00.000Z`,
        retrieved_at: nowIso,
        source_url: null,
        provenance_kind: "CURATED_DEMO",
        data_label: demo.data_label,
      });
      if (demo.media_type === "VIDEO") ytCount += 1;
    }
  } catch {
    // Ignore demo corpus lookup failures
  }

  if (ytCount > 0) {
    ytStatus = "COLLECTION_COMPLETE";
    if (!params.config.YOUTUBE_DATA_API_KEY) {
      ytReason = `Collected ${ytCount} video reference(s) via zero-key official YouTube Atom RSS / curated corpus. You can also paste any YouTube URL to auto-import its metadata & captions.`;
    }
  } else if (!params.config.YOUTUBE_DATA_API_KEY) {
    ytStatus = "AVAILABLE";
    ytReason =
      "Checked zero-key official YouTube Atom RSS feeds (0 recent mentions for this stock). Paste any YouTube video URL in Manual Import to fetch its title and captions with zero API key.";
  }

  // 2. X (Twitter) Official API v2 OR Zero-Key Official oEmbed Link Import
  let xStatus: SourceConnectorState["status"] = "REQUIRES_MANUAL_IMPORT";
  let xReason =
    "Official X search API requires a paid X_BEARER_TOKEN. Paste any public x.com post URL or text in Manual Import to resolve via X's free official oEmbed endpoint (zero scraping).";
  let xCount = 0;

  if (params.config.X_BEARER_TOKEN) {
    try {
      const cleanTicker = params.ticker.replace(/\.(NS|BO)$/i, "");
      const query = `(${cleanTicker} OR "${params.companyName}") -is:retweet lang:en`;
      const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(
        query
      )}&max_results=10&tweet.fields=created_at,author_id&expansions=author_id&user.fields=name,username`;

      const res = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${params.config.X_BEARER_TOKEN}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
      });

      if (res.ok) {
        const body = (await res.json()) as {
          data?: Array<{ id: string; text: string; created_at?: string; author_id?: string }>;
          includes?: { users?: Array<{ id: string; name: string; username: string }> };
        };
        const userMap = new Map((body.includes?.users ?? []).map((u) => [u.id, u]));
        for (const post of body.data ?? []) {
          const author = post.author_id ? userMap.get(post.author_id) : undefined;
          const handle = author?.username ? `@${author.username}` : null;
          rawSources.push({
            platform: "X",
            creator_name: author?.name ?? handle ?? "Public X Account",
            channel_or_handle: handle,
            title: post.text.slice(0, 110),
            text: post.text,
            published_at: post.created_at ?? null,
            retrieved_at: nowIso,
            source_url: author?.username
              ? `https://x.com/${encodeURIComponent(author.username)}/status/${encodeURIComponent(post.id)}`
              : `https://x.com/i/web/status/${encodeURIComponent(post.id)}`,
            provenance_kind: "REAL_OFFICIAL_API",
            data_label: "REAL",
          });
          xCount += 1;
        }
        xStatus = "COLLECTION_COMPLETE";
        xReason =
          xCount > 0
            ? `Collected ${xCount} public post reference(s) via official X API v2 recent search.`
            : "Official X API v2 returned 0 recent public posts matching this stock.";
      } else if (res.status === 401 || res.status === 403) {
        xStatus = "UNAVAILABLE";
        xReason = `Official X API v2 rejected access (HTTP ${res.status}). Use zero-key X oEmbed URL import instead.`;
      } else {
        xStatus = "ERROR";
        xReason = `Official X API v2 returned HTTP ${res.status}.`;
      }
    } catch {
      xStatus = "ERROR";
      xReason = "Official X API v2 request timed out or was unreachable.";
    }
  }

  // 3. Telegram Connector — strictly Manual User Import (Zero Scraping)
  const telegramDemoCount = rawSources.filter((s) => s.platform === "TELEGRAM").length;

  const connectors: SourceConnectorState[] = [
    {
      platform: "REDDIT",
      display_name: "Reddit India Markets",
      status: !redditResult.ok
        ? "ERROR"
        : redditResult.items.length > 0
          ? "COLLECTION_COMPLETE"
          : "AVAILABLE",
      items_collected: redditResult.items.length,
      provenance_note: "Real · Official Public RSS (Zero Key)",
      availability_reason: !redditResult.ok
        ? (redditResult.errorReason ?? "Could not reach Reddit public RSS.")
        : redditResult.items.length > 0
          ? `Collected ${redditResult.items.length} retail discussion(s) from r/IndianStockMarket & r/IndianStreetBets official RSS.`
          : "Connected via official Reddit public RSS (0 matching posts in this time range).",
      supports_manual_import: true,
      last_checked_at: nowIso,
    },
    {
      platform: "NEWS",
      display_name: "Financial News RSS",
      status: !newsResult.ok
        ? "ERROR"
        : newsResult.items.length > 0
          ? "COLLECTION_COMPLETE"
          : "AVAILABLE",
      items_collected: newsResult.items.length,
      provenance_note: "Real · Google News India RSS (Zero Key)",
      availability_reason: !newsResult.ok
        ? (newsResult.errorReason ?? "Could not reach Google News India RSS.")
        : newsResult.items.length > 0
          ? `Collected ${newsResult.items.length} dated financial press reference(s) for factual cross-checking.`
          : "Connected via official Google News India RSS (0 matching headlines).",
      supports_manual_import: false,
      last_checked_at: nowIso,
    },
    {
      platform: "YOUTUBE",
      display_name: "YouTube",
      status: ytStatus,
      items_collected: ytCount,
      provenance_note: ytProvenance,
      availability_reason: ytReason,
      supports_manual_import: true,
      last_checked_at: nowIso,
    },
    {
      platform: "X",
      display_name: "X",
      status: xStatus,
      items_collected: xCount,
      provenance_note: params.config.X_BEARER_TOKEN
        ? "Real · Official X API v2"
        : "Zero-Key oEmbed Link / Manual Import",
      availability_reason: xReason,
      supports_manual_import: true,
      last_checked_at: nowIso,
    },
    {
      platform: "TELEGRAM",
      display_name: "Telegram",
      status: "REQUIRES_MANUAL_IMPORT",
      items_collected: telegramDemoCount,
      provenance_note: "User-Submitted Manual Import (Zero Scraping)",
      availability_reason:
        "Automated Telegram scraping is permanently disabled by policy. Paste forwarded Telegram messages into this temporary session.",
      supports_manual_import: true,
      last_checked_at: nowIso,
    },
  ];

  return { connectors, rawSources };
}
