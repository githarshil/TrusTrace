import { logWarn } from "../core/logger.js";
import type { RawSocialSourceInput } from "../domain/research/researchEngine.js";
import type { ResearchTimeRange, SocialPlatform } from "../domain/research/types.js";
import { fetchPublicYouTubeTranscriptOrMetadata } from "./youtubeMonitor.js";

const PUBLIC_FEED_TIMEOUT_MS = 6_000;
const USER_AGENT = "TipAutopsyEvidenceMonitor/1.0 (+https://tipautopsy.app)";

function decodeEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)));
}

function stripHtmlTags(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractXmlTag(block: string, tag: string): string | null {
  const escaped = tag.replace(":", "\\:");
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const m = re.exec(block);
  return m?.[1] ? decodeEntities(m[1]).trim() : null;
}

function extractXmlAttr(block: string, tag: string, attr: string): string | null {
  const escaped = tag.replace(":", "\\:");
  const re = new RegExp(`<${escaped}[^>]*\\s${attr}="([^"]+)"[^>]*\\/?>`, "i");
  const m = re.exec(block);
  return m?.[1] ? decodeEntities(m[1]).trim() : null;
}

function mapTimeRangeToRedditParam(range: ResearchTimeRange): "day" | "week" | "month" | "year" {
  switch (range) {
    case "24h":
      return "day";
    case "7d":
      return "week";
    case "30d":
      return "month";
    case "90d":
      return "year";
  }
}

/**
 * Parses Reddit's official public Atom RSS search feed for Indian retail investing subreddits.
 */
export function parseRedditAtomRss(xml: string, retrievedAtIso: string): RawSocialSourceInput[] {
  const items: RawSocialSourceInput[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";
    const title = stripHtmlTags(extractXmlTag(block, "title") ?? "");
    const link = extractXmlAttr(block, "link", "href");
    const authorBlock = extractXmlTag(block, "author") ?? "";
    const authorName = stripHtmlTags(extractXmlTag(authorBlock, "name") ?? "") || "Reddit user";
    const published =
      extractXmlTag(block, "published") ?? extractXmlTag(block, "updated") ?? null;
    const rawContent = extractXmlTag(block, "content") ?? "";
    const excerpt = stripHtmlTags(rawContent)
      .replace(/\bsubmitted by\b[\s\S]*$/i, "")
      .trim();

    if (!title) continue;
    const safeLink =
      link && /^https:\/\/(www\.)?reddit\.com\//i.test(link) ? link : null;

    items.push({
      platform: "REDDIT",
      creator_name: authorName,
      channel_or_handle: authorName.startsWith("/u/") ? authorName : `u/${authorName}`,
      title: title.slice(0, 200),
      text: (excerpt.length >= 15 ? excerpt : title).slice(0, 560),
      published_at: published,
      retrieved_at: retrievedAtIso,
      source_url: safeLink,
      provenance_kind: "REAL_PUBLIC_RSS",
      data_label: "REAL",
    });
  }

  return items;
}

/**
 * Fetches official public Reddit Atom RSS across Indian stock-market communities (zero API key).
 */
export async function fetchRedditIndiaRss(params: {
  ticker: string;
  companyName: string;
  timeRange: ResearchTimeRange;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ items: RawSocialSourceInput[]; ok: boolean; errorReason?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const limit = params.limit ?? 5;
  const cleanTicker = params.ticker.replace(/\.(NS|BO)$/i, "").trim();
  const shortCompany = params.companyName
    .replace(/\b(limited|ltd|india|industries|enterprises|corp|corporation)\b/gi, "")
    .trim();
  const query = shortCompany && shortCompany.toLowerCase() !== cleanTicker.toLowerCase()
    ? `${cleanTicker} OR "${shortCompany}"`
    : cleanTicker;
  const tParam = mapTimeRangeToRedditParam(params.timeRange);

  const url = `https://www.reddit.com/r/IndianStockMarket+IndianStreetBets+IndiaInvestments/search.rss?q=${encodeURIComponent(
    query
  )}&restrict_sr=1&sort=new&t=${tParam}`;

  try {
    const res = await fetchImpl(url, {
      headers: {
        Accept: "application/atom+xml, application/xml, text/xml",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(PUBLIC_FEED_TIMEOUT_MS),
    });

    if (!res.ok) {
      logWarn("research.reddit_rss_http_error", { status: res.status, ticker: cleanTicker });
      return {
        items: [],
        ok: false,
        errorReason: `Reddit public RSS returned HTTP ${res.status}.`,
      };
    }

    const xml = await res.text();
    const parsed = parseRedditAtomRss(xml, new Date().toISOString()).slice(0, limit);
    return { items: parsed, ok: true };
  } catch (err) {
    logWarn("research.reddit_rss_error", {
      ticker: cleanTicker,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return {
      items: [],
      ok: false,
      errorReason: "Reddit public RSS timed out or was unreachable.",
    };
  }
}

/**
 * Parses Google News official RSS 2.0 XML for dated Indian financial press headlines.
 */
export function parseGoogleNewsRss(xml: string, retrievedAtIso: string): RawSocialSourceInput[] {
  const items: RawSocialSourceInput[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] ?? "";
    const title = stripHtmlTags(extractXmlTag(block, "title") ?? "");
    const link = extractXmlTag(block, "link");
    const pubDateRaw = extractXmlTag(block, "pubDate");
    const sourcePublisher = stripHtmlTags(extractXmlTag(block, "source") ?? "") || "Financial Press";
    const description = stripHtmlTags(extractXmlTag(block, "description") ?? "");

    if (!title) continue;
    let publishedIso: string | null = null;
    if (pubDateRaw) {
      const parsedDate = Date.parse(pubDateRaw);
      if (!Number.isNaN(parsedDate)) {
        publishedIso = new Date(parsedDate).toISOString();
      }
    }

    const safeLink = link && /^https?:\/\//i.test(link) ? link : null;

    items.push({
      platform: "NEWS",
      creator_name: sourcePublisher,
      channel_or_handle: sourcePublisher,
      title: title.slice(0, 200),
      text: (description.length >= 20 ? description : title).slice(0, 560),
      published_at: publishedIso,
      retrieved_at: retrievedAtIso,
      source_url: safeLink,
      provenance_kind: "REAL_PUBLIC_RSS",
      data_label: "REAL",
    });
  }

  return items;
}

/**
 * Fetches official Google News India RSS (zero API key, dated press coverage).
 */
export async function fetchGoogleNewsIndiaRss(params: {
  ticker: string;
  companyName: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ items: RawSocialSourceInput[]; ok: boolean; errorReason?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const limit = params.limit ?? 5;
  const cleanTicker = params.ticker.replace(/\.(NS|BO)$/i, "").trim();
  const query = `${params.companyName} ${cleanTicker} NSE stock`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=en-IN&gl=IN&ceid=IN:en`;

  try {
    const res = await fetchImpl(url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(PUBLIC_FEED_TIMEOUT_MS),
    });

    if (!res.ok) {
      logWarn("research.google_news_rss_http_error", { status: res.status, ticker: cleanTicker });
      return {
        items: [],
        ok: false,
        errorReason: `Google News India RSS returned HTTP ${res.status}.`,
      };
    }

    const xml = await res.text();
    const parsed = parseGoogleNewsRss(xml, new Date().toISOString()).slice(0, limit);
    return { items: parsed, ok: true };
  } catch (err) {
    logWarn("research.google_news_rss_error", {
      ticker: cleanTicker,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return {
      items: [],
      ok: false,
      errorReason: "Google News India RSS timed out or was unreachable.",
    };
  }
}

export interface ResolvedOembedSource {
  platform: SocialPlatform;
  creator_name: string;
  title: string;
  text: string;
  source_url: string;
}

function extractYouTubeVideoId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = urlObj.pathname.replace(/^\//, "").split("/")[0];
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
    const v = urlObj.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{6,20}$/.test(v)) return v;
    const shortsMatch = /^\/shorts\/([A-Za-z0-9_-]{6,20})/.exec(urlObj.pathname);
    if (shortsMatch?.[1]) return shortsMatch[1];
  }
  return null;
}

/**
 * Resolves a user-pasted YouTube or X URL using strictly allowlisted official zero-key
 * oEmbed endpoints (never fetches arbitrary domains — SSRF safe).
 */
export async function resolveOfficialOembedUrl(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<ResolvedOembedSource | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  // 1. Official YouTube zero-key oEmbed + public timedtext captions
  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be"
  ) {
    const videoId = extractYouTubeVideoId(parsed);
    const canonicalUrl = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : parsed.toString();

    try {
      const oembedRes = await fetchImpl(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
        {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(PUBLIC_FEED_TIMEOUT_MS),
        }
      );
      if (!oembedRes.ok) return null;
      const meta = (await oembedRes.json()) as { title?: string; author_name?: string };
      const title = (meta.title ?? "YouTube video").trim();
      const author = (meta.author_name ?? "YouTube Creator").trim();

      let bodyText = title;
      if (videoId) {
        const transcript = await fetchPublicYouTubeTranscriptOrMetadata(
          { video_id: videoId, title, description: "" },
          { fetchImpl }
        );
        if (transcript.text.trim().length > title.length) {
          bodyText = transcript.text.trim();
        }
      }

      return {
        platform: "YOUTUBE",
        creator_name: author,
        title,
        text: bodyText,
        source_url: canonicalUrl,
      };
    } catch {
      return null;
    }
  }

  // 2. Official X/Twitter zero-key publish.twitter.com oEmbed
  if (
    host === "x.com" ||
    host === "www.x.com" ||
    host === "twitter.com" ||
    host === "www.twitter.com"
  ) {
    try {
      const oembedRes = await fetchImpl(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(
          parsed.toString()
        )}&omit_script=true`,
        {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(PUBLIC_FEED_TIMEOUT_MS),
        }
      );
      if (!oembedRes.ok) return null;
      const meta = (await oembedRes.json()) as { author_name?: string; html?: string };
      const author = (meta.author_name ?? "Public X Account").trim();
      const text = stripHtmlTags(meta.html ?? "").trim();
      if (text.length < 5) return null;

      return {
        platform: "X",
        creator_name: author,
        title: `${author} on X: ${text.slice(0, 96)}`,
        text,
        source_url: parsed.toString(),
      };
    } catch {
      return null;
    }
  }

  return null;
}
