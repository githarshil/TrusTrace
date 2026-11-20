import type {
  ClaimLedger,
  DataLabel,
  DisclosureGrade,
  HypeFlag,
  TipDirection,
} from "../types.js";

export type SocialPlatform = "YOUTUBE" | "REDDIT" | "NEWS" | "X" | "TELEGRAM";

export type ConnectorStatus =
  | "AVAILABLE"
  | "CONNECTING"
  | "COLLECTION_COMPLETE"
  | "UNAVAILABLE"
  | "REQUIRES_MANUAL_IMPORT"
  | "ERROR";

export type ResearchTimeRange = "24h" | "7d" | "30d" | "90d";

export type SourceProvenanceKind =
  | "REAL_OFFICIAL_API"
  | "REAL_YOUTUBE_RSS"
  | "REAL_PUBLIC_RSS"
  | "USER_SUBMITTED"
  | "CURATED_DEMO";

export interface SourceConnectorState {
  platform: SocialPlatform;
  display_name: string;
  status: ConnectorStatus;
  items_collected: number;
  provenance_note: string;
  availability_reason: string;
  supports_manual_import: boolean;
  last_checked_at: string;
}

export interface ResearchSourceItem {
  id: string;
  citation_key: string; // e.g., "S1", "S2"
  platform: SocialPlatform;
  creator_name: string | null;
  channel_or_handle: string | null;
  title: string;
  excerpt: string;
  published_at: string | null;
  retrieved_at: string;
  source_url: string | null;
  provenance_kind: SourceProvenanceKind;
  data_label: DataLabel;
  direction: TipDirection | null;
  claims: ClaimLedger;
  hype_flags: HypeFlag[];
  disclosure_grade: DisclosureGrade;
  missing_fields: string[];
}

export interface ClaimClusterItem {
  id: string;
  summary: string;
  direction: TipDirection | "MIXED";
  source_ids: string[];
  citation_keys: string[];
  occurrence_count: number;
  provenance_labels: DataLabel[];
}

export interface ContradictionItem {
  id: string;
  topic: string;
  side_a_summary: string;
  side_a_citations: string[];
  side_b_summary: string;
  side_b_citations: string[];
}

export interface ResearchOverview {
  total_sources: number;
  real_source_count: number;
  user_submitted_count: number;
  curated_demo_count: number;
  recurring_claims: ClaimClusterItem[];
  bullish_arguments: ClaimClusterItem[];
  bearish_arguments: ClaimClusterItem[];
  contradictory_claims: ContradictionItem[];
  hype_and_urgency_phrases: Array<{
    phrase: string;
    category: HypeFlag["category"];
    source_id: string;
    citation_key: string;
    creator_name: string | null;
  }>;
  sponsorship_disclosure_indicators: {
    clear_count: number;
    vague_count: number;
    none_count: number;
    unknown_count: number;
    summary: string;
  };
  unverified_claims: Array<{
    statement: string;
    reason: string;
    citation_key: string;
  }>;
  missing_information: string[];
}

export interface StockMarketContextSummary {
  ticker: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  latest_price: number | null;
  change_percent: number | null;
  as_of_date: string | null;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT" | "UNAVAILABLE";
  data_label: DataLabel | null;
  source_name: string | null;
}

export interface ResearchChatCitation {
  citation_key: string;
  source_id: string;
  platform: SocialPlatform;
  creator_name: string | null;
  title: string;
  source_url: string | null;
  data_label: DataLabel;
  provenance_kind: SourceProvenanceKind;
}

export interface ResearchChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  citations: ResearchChatCitation[];
  evidence_breakdown?: {
    verified_facts: string[];
    social_claims: string[];
    unverified_or_missing: string[];
  };
  guard_status?: "PASSED" | "BLOCKED_FALLBACK";
  suggested_followups?: string[];
}

export interface ResearchSession {
  session_id: string;
  ticker: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  time_range: ResearchTimeRange;
  created_at: string;
  updated_at: string;
  expires_at: string;
  stock_context: StockMarketContextSummary;
  connectors: SourceConnectorState[];
  sources: ResearchSourceItem[];
  overview: ResearchOverview;
  messages: ResearchChatMessage[];
}
