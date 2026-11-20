import { randomUUID } from "node:crypto";
import { parseClaimLedgerDeterministic } from "../claims/parser.js";
import { classifyDisclosure } from "../disclosure/classifier.js";
import { detectHypePhrases } from "../hype/detector.js";
import type { DataLabel, TipDirection } from "../types.js";
import type {
  ClaimClusterItem,
  ContradictionItem,
  ResearchOverview,
  ResearchSourceItem,
  SocialPlatform,
  SourceConnectorState,
  SourceProvenanceKind,
} from "./types.js";

export interface RawSocialSourceInput {
  platform: SocialPlatform;
  creator_name: string | null;
  channel_or_handle: string | null;
  title: string;
  text: string;
  published_at: string | null;
  retrieved_at?: string;
  source_url: string | null;
  provenance_kind: SourceProvenanceKind;
  data_label: DataLabel;
}

function sanitizeSourceUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function inferDirectionFallback(text: string): TipDirection | null {
  const lower = text.toLowerCase();
  const bullishHits =
    (lower.match(/\b(bullish|breakout|upside|rally|strong\s+growth|accumulate|multibagger|boom|long\s+term\s+growth|buy|upward|outperform)\b/g) ?? [])
      .length;
  const bearishHits =
    (lower.match(/\b(bearish|breakdown|downside|overvalued|weak\s+margin|pressure|risk|decline|sell|short|headwind|slowdown|caution)\b/g) ?? [])
      .length;
  if (bullishHits > 0 && bearishHits === 0) return "BULLISH";
  if (bearishHits > 0 && bullishHits === 0) return "BEARISH";
  if (bullishHits > bearishHits) return "BULLISH";
  if (bearishHits > bullishHits) return "BEARISH";
  return null;
}

export function analyzeSocialSource(
  input: RawSocialSourceInput,
  citationIndex: number,
  tickerHint: string
): ResearchSourceItem {
  const combinedText = `${input.title}\n${input.text}`.trim();
  const claims = parseClaimLedgerDeterministic({
    sourceText: combinedText,
    catalogue: [{ ticker: tickerHint, company_name: tickerHint }],
    userEnteredStock: tickerHint,
  });
  const hype = detectHypePhrases(combinedText);
  const disclosure = classifyDisclosure(combinedText);

  const direction: TipDirection | null =
    claims.direction.value ?? inferDirectionFallback(combinedText);

  const missingFields: string[] = [];
  if (claims.direction.status !== "EXTRACTED" && !direction) {
    missingFields.push("Direction not stated");
  }
  if (claims.stop_loss.status !== "EXTRACTED") {
    missingFields.push(
      claims.stop_loss.gated
        ? "Stop-loss gated behind paid tier"
        : "Stop-loss not stated"
    );
  }
  if (claims.deadline.status !== "EXTRACTED") {
    missingFields.push("Time horizon not stated");
  }
  if (disclosure.grade === "NONE" || disclosure.grade === "UNKNOWN") {
    missingFields.push("Sponsorship / conflict disclosure not stated");
  }

  return {
    id: `src_${randomUUID().slice(0, 10)}`,
    citation_key: `S${citationIndex}`,
    platform: input.platform,
    creator_name: input.creator_name,
    channel_or_handle: input.channel_or_handle,
    title: input.title.trim().slice(0, 220),
    excerpt: input.text.trim().slice(0, 560),
    published_at: input.published_at,
    retrieved_at: input.retrieved_at ?? new Date().toISOString(),
    source_url: sanitizeSourceUrl(input.source_url),
    provenance_kind: input.provenance_kind,
    data_label: input.data_label,
    direction,
    claims,
    hype_flags: hype.flags,
    disclosure_grade: disclosure.grade,
    missing_fields: missingFields,
  };
}

export function buildResearchOverview(
  sources: ResearchSourceItem[],
  connectors: SourceConnectorState[]
): ResearchOverview {
  const realCount = sources.filter(
    (s) =>
      s.provenance_kind === "REAL_OFFICIAL_API" ||
      s.provenance_kind === "REAL_YOUTUBE_RSS" ||
      s.provenance_kind === "REAL_PUBLIC_RSS"
  ).length;
  const userSubmittedCount = sources.filter(
    (s) => s.provenance_kind === "USER_SUBMITTED"
  ).length;
  const curatedDemoCount = sources.filter(
    (s) => s.provenance_kind === "CURATED_DEMO"
  ).length;

  const bullishSources = sources.filter((s) => s.direction === "BULLISH");
  const bearishSources = sources.filter((s) => s.direction === "BEARISH");

  const bullishArguments: ClaimClusterItem[] = bullishSources.slice(0, 5).map((src, i) => ({
    id: `bull_${i + 1}`,
    summary: `${src.creator_name ?? src.platform} (${src.citation_key}): ${src.title}${
      src.claims.deadline.value ? ` [stated horizon: ${src.claims.deadline.value}]` : ""
    }`,
    direction: "BULLISH",
    source_ids: [src.id],
    citation_keys: [src.citation_key],
    occurrence_count: 1,
    provenance_labels: [src.data_label],
  }));

  const bearishArguments: ClaimClusterItem[] = bearishSources.slice(0, 5).map((src, i) => ({
    id: `bear_${i + 1}`,
    summary: `${src.creator_name ?? src.platform} (${src.citation_key}): ${src.title}${
      src.claims.deadline.value ? ` [stated horizon: ${src.claims.deadline.value}]` : ""
    }`,
    direction: "BEARISH",
    source_ids: [src.id],
    citation_keys: [src.citation_key],
    occurrence_count: 1,
    provenance_labels: [src.data_label],
  }));

  // Recurring claim themes grouped deterministically from collected evidence
  const recurringClaims: ClaimClusterItem[] = [];
  if (bullishSources.length > 0) {
    recurringClaims.push({
      id: "rec_bullish",
      summary: `${bullishSources.length} collected source${bullishSources.length === 1 ? "" : "s"} express an upward/bullish thesis`,
      direction: "BULLISH",
      source_ids: bullishSources.map((s) => s.id),
      citation_keys: bullishSources.map((s) => s.citation_key),
      occurrence_count: bullishSources.length,
      provenance_labels: [...new Set(bullishSources.map((s) => s.data_label))],
    });
  }
  if (bearishSources.length > 0) {
    recurringClaims.push({
      id: "rec_bearish",
      summary: `${bearishSources.length} collected source${bearishSources.length === 1 ? "" : "s"} raise downward/cautionary concerns`,
      direction: "BEARISH",
      source_ids: bearishSources.map((s) => s.id),
      citation_keys: bearishSources.map((s) => s.citation_key),
      occurrence_count: bearishSources.length,
      provenance_labels: [...new Set(bearishSources.map((s) => s.data_label))],
    });
  }

  const missingSlSources = sources.filter((s) => s.claims.stop_loss.status !== "EXTRACTED");
  if (missingSlSources.length > 0) {
    recurringClaims.push({
      id: "rec_missing_sl",
      summary: `${missingSlSources.length} of ${sources.length} source${sources.length === 1 ? "" : "s"} omit an open stop-loss level`,
      direction: "NEUTRAL",
      source_ids: missingSlSources.map((s) => s.id),
      citation_keys: missingSlSources.map((s) => s.citation_key),
      occurrence_count: missingSlSources.length,
      provenance_labels: [...new Set(missingSlSources.map((s) => s.data_label))],
    });
  }

  const withPriceClaim = sources.filter((s) => s.claims.target_price.status === "EXTRACTED");
  if (withPriceClaim.length > 0) {
    recurringClaims.push({
      id: "rec_price_claim",
      summary: `${withPriceClaim.length} source${withPriceClaim.length === 1 ? "" : "s"} include a creator-claimed price level (quoted claim only, not verified)`,
      direction: "MIXED",
      source_ids: withPriceClaim.map((s) => s.id),
      citation_keys: withPriceClaim.map((s) => s.citation_key),
      occurrence_count: withPriceClaim.length,
      provenance_labels: [...new Set(withPriceClaim.map((s) => s.data_label))],
    });
  }

  // Contradictory claims
  const contradictoryClaims: ContradictionItem[] = [];
  if (bullishSources.length > 0 && bearishSources.length > 0) {
    contradictoryClaims.push({
      id: "contra_direction",
      topic: "Directional outlook disagreement",
      side_a_summary: `${bullishSources.length} source${bullishSources.length === 1 ? "" : "s"} present a bullish thesis (${bullishSources.map((s) => s.citation_key).join(", ")}).`,
      side_a_citations: bullishSources.map((s) => s.citation_key),
      side_b_summary: `${bearishSources.length} source${bearishSources.length === 1 ? "" : "s"} highlight bearish or downside risks (${bearishSources.map((s) => s.citation_key).join(", ")}).`,
      side_b_citations: bearishSources.map((s) => s.citation_key),
    });
  }

  const claimedPrices = withPriceClaim
    .map((s) => ({
      key: s.citation_key,
      val: s.claims.target_price.value as number,
    }))
    .sort((a, b) => a.val - b.val);
  if (claimedPrices.length >= 2) {
    const low = claimedPrices[0];
    const high = claimedPrices[claimedPrices.length - 1];
    if (low && high && high.val > low.val * 1.15) {
      contradictoryClaims.push({
        id: "contra_price_spread",
        topic: "Wide spread in creator-claimed price levels",
        side_a_summary: `${low.key} states a creator-claimed level of ₹${low.val.toLocaleString("en-IN")}.`,
        side_a_citations: [low.key],
        side_b_summary: `${high.key} states a higher creator-claimed level of ₹${high.val.toLocaleString("en-IN")}.`,
        side_b_citations: [high.key],
      });
    }
  }

  // Hype & urgency phrases across all sources
  const hypePhrases = sources.flatMap((src) =>
    src.hype_flags.map((flag) => ({
      phrase: flag.phrase,
      category: flag.category,
      source_id: src.id,
      citation_key: src.citation_key,
      creator_name: src.creator_name,
    }))
  );

  // Sponsorship disclosure indicators
  const clearCount = sources.filter((s) => s.disclosure_grade === "CLEAR").length;
  const vagueCount = sources.filter((s) => s.disclosure_grade === "VAGUE").length;
  const noneCount = sources.filter((s) => s.disclosure_grade === "NONE").length;
  const unknownCount = sources.filter((s) => s.disclosure_grade === "UNKNOWN").length;

  const disclosureSummary =
    sources.length === 0
      ? "No sources collected yet to evaluate sponsorship disclosure wording."
      : `${clearCount} clear disclosure, ${vagueCount} vague, ${noneCount} no disclosure wording found, ${unknownCount} unclear across ${sources.length} source${sources.length === 1 ? "" : "s"}.`;

  // Unverified claims
  const unverifiedClaims: ResearchOverview["unverified_claims"] = [];
  for (const src of sources) {
    if (src.claims.target_price.status === "EXTRACTED" && src.claims.target_price.value !== null) {
      unverifiedClaims.push({
        statement: `${src.creator_name ?? src.platform} stated a price level of ₹${src.claims.target_price.value.toLocaleString("en-IN")}`,
        reason: "Creator-claimed price levels cannot be verified as future outcomes.",
        citation_key: src.citation_key,
      });
    }
    if (src.hype_flags.length > 0) {
      unverifiedClaims.push({
        statement: `${src.creator_name ?? src.platform} used promotional/urgency phrasing ("${src.hype_flags[0]?.phrase}")`,
        reason: "Promotional or certainty language is social text evidence, not verified market proof.",
        citation_key: src.citation_key,
      });
    }
  }

  // Missing information
  const missingInfoSet = new Set<string>();
  if (sources.length === 0) {
    missingInfoSet.add(
      "No social sources have been collected yet. Import a Telegram message or YouTube transcript to analyze claims."
    );
  }
  if (missingSlSources.length > 0) {
    missingInfoSet.add(
      `Open stop-loss levels were not stated in ${missingSlSources.length} of ${sources.length} source(s).`
    );
  }
  const missingDeadlineCount = sources.filter(
    (s) => s.claims.deadline.status !== "EXTRACTED"
  ).length;
  if (missingDeadlineCount > 0) {
    missingInfoSet.add(
      `Explicit time horizons were not stated in ${missingDeadlineCount} of ${sources.length} source(s).`
    );
  }
  if (noneCount + unknownCount > 0 && sources.length > 0) {
    missingInfoSet.add(
      `Sponsorship or conflict-of-interest disclosures were absent or unclear in ${noneCount + unknownCount} of ${sources.length} source(s).`
    );
  }
  for (const connector of connectors) {
    if (connector.status === "UNAVAILABLE" || connector.status === "ERROR") {
      missingInfoSet.add(
        `${connector.display_name} live collection is currently unavailable (${connector.availability_reason}).`
      );
    } else if (connector.status === "REQUIRES_MANUAL_IMPORT" && connector.items_collected === 0) {
      missingInfoSet.add(
        `${connector.display_name} requires manual user import (automated scraping is disabled by policy).`
      );
    }
  }

  return {
    total_sources: sources.length,
    real_source_count: realCount,
    user_submitted_count: userSubmittedCount,
    curated_demo_count: curatedDemoCount,
    recurring_claims: recurringClaims,
    bullish_arguments: bullishArguments,
    bearish_arguments: bearishArguments,
    contradictory_claims: contradictoryClaims,
    hype_and_urgency_phrases: hypePhrases.slice(0, 12),
    sponsorship_disclosure_indicators: {
      clear_count: clearCount,
      vague_count: vagueCount,
      none_count: noneCount,
      unknown_count: unknownCount,
      summary: disclosureSummary,
    },
    unverified_claims: unverifiedClaims.slice(0, 10),
    missing_information: [...missingInfoSet],
  };
}

/**
 * Deterministic lexical + metadata retriever for RAG over active session sources.
 */
export function retrieveRelevantSources(
  question: string,
  sources: ResearchSourceItem[],
  topK = 5
): ResearchSourceItem[] {
  if (sources.length <= topK) return sources;

  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const wantsBullish = /\b(bull|positive|upside|optimis|for|why)\b/i.test(question);
  const wantsBearish = /\b(bear|negative|risk|downside|against|concern|warn)\b/i.test(question);
  const wantsHype = /\b(hype|promis|urgenc|guarant|sponsor|disclos)\b/i.test(question);
  const wantsContradiction = /\b(contradict|disagree|conflict|both\s+sides)\b/i.test(question);

  const scored = sources.map((src) => {
    const haystack = `${src.title} ${src.excerpt} ${src.creator_name ?? ""} ${src.platform}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 2;
    }
    if (wantsBullish && src.direction === "BULLISH") score += 3;
    if (wantsBearish && src.direction === "BEARISH") score += 3;
    if (wantsHype && (src.hype_flags.length > 0 || src.disclosure_grade !== "CLEAR")) score += 3;
    if (wantsContradiction && src.direction !== null) score += 2;
    // Slight preference for real or user-submitted evidence over curated demo when tied
    if (src.provenance_kind !== "CURATED_DEMO") score += 0.5;
    return { src, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.src);
}
