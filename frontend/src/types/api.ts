export type DataLabel = "REAL" | "SYNTHETIC" | "MIXED";
export type InstrumentType = "EQUITY" | "DERIVATIVE";
export type DisclosureGrade = "CLEAR" | "VAGUE" | "NONE" | "UNKNOWN";
export type TipDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type CheckStatus = "WITHIN_NORMAL_RANGE" | "NEEDS_ATTENTION" | "COULD_NOT_VERIFY";
export type SebiLookupStatus = "REGISTERED" | "NOT_FOUND" | "UNCLEAR";

export interface SourceSpan {
  start: number;
  end: number;
  text: string;
}

export interface ClaimField<T = string | number | null> {
  value: T;
  status: "EXTRACTED" | "NOT_STATED" | "UNCLEAR";
  gated?: boolean;
  note?: string;
  evidence: SourceSpan | null;
}

export interface ClaimLedger {
  stock: ClaimField<string | null>;
  direction: ClaimField<TipDirection | null>;
  target_price: ClaimField<number | null>;
  deadline: ClaimField<string | null>;
  stop_loss: ClaimField<number | null>;
}

export interface HypeFlag {
  phrase: string;
  start: number;
  end: number;
  rule_id: string;
  category: "CERTAINTY" | "URGENCY" | "PROMOTIONAL" | "RETURN_PROMISE";
}

export interface DisclosureGradeResult {
  grade: DisclosureGrade;
  evidence: SourceSpan[];
  method_version: string;
  plain_ad_baseline_matched: boolean;
  explanation: string;
}

export interface ParseResponse {
  request_id: string;
  schema_version: string;
  extracted_text: string;
  media_intake: {
    received: boolean;
    kind: "PHOTO" | "VIDEO" | null;
    detected_mime: string | null;
    byte_length: number;
    persisted: false;
    extraction_mode:
      | "TEXT_ONLY"
      | "CURATED_DEMO_TRANSCRIPT"
      | "GEMINI_VISION_OCR"
      | "PROVIDER_UNAVAILABLE_FALLBACK";
    notice: string | null;
  };
  claims: ClaimLedger;
  hype_flags: HypeFlag[];
  hype_dictionary_version: string;
  disclosure_grade: DisclosureGradeResult;
  parser: {
    status: "COMPLETED" | "FALLBACK_STRUCTURED_ONLY";
    version: string;
    note: string | null;
  };
}

export interface SebiLookupResponse {
  request_id: string;
  influencer_id: string | null;
  query: string;
  status: SebiLookupStatus;
  matched_name: string | null;
  registration_no: string | null;
  category: string | null;
  snapshot_id: string | null;
  snapshot_date: string | null;
  data_label: DataLabel | null;
  explanation: string;
  candidates_considered: number;
}

export interface StockLookupItem {
  ticker: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  has_price_history: boolean;
  latest_price_date: string | null;
}

export interface PricesResponse {
  request_id: string;
  ticker: string;
  company_name: string;
  instrument_type: InstrumentType;
  series_scope: "SECURITY" | "UNDERLYING_INDEX";
  underlying_ticker: string | null;
  as_of_date: string | null;
  source_snapshot_id: string | null;
  source_name: string | null;
  data_label: DataLabel | null;
  series: Array<{
    trading_date: string;
    close: number;
    volume: number | null;
  }>;
}

export interface TipMarkerItem {
  tip_date: string;
  count: number;
  has_synthetic: boolean;
  data_label: DataLabel;
}

export interface ExactDateTip {
  id: string;
  influencer_id: string;
  ticker: string;
  tip_date: string;
  text: string;
  direction: TipDirection | null;
  target_price: number | null;
  deadline: string | null;
  stop_loss: number | null;
  disclosure_grade: DisclosureGrade;
  source_url: string | null;
  is_synthetic: boolean;
  data_label: DataLabel;
  snapshot_id: string;
}

export interface MarketCheckResult {
  check_id: "liquidity" | "market_cap" | "volume_spike" | "pre_tip_run_up" | "surveillance";
  label: string;
  status: CheckStatus;
  measured_value: number | string | null;
  unit: string | null;
  as_of_date: string | null;
  source_snapshot_id: string | null;
  source_name: string | null;
  data_label: DataLabel | null;
  method_version: string;
  explanation_key: string;
  explanation: string;
  reason_code: string | null;
  details?: Record<string, string | number | boolean | null>;
}

export interface TrackRecordResult {
  status: "INTERVAL_AVAILABLE" | "NOT_ENOUGH_TIPS_TO_JUDGE";
  creator_id: string | null;
  creator_name: string | null;
  resolved_count: number;
  success_count: number;
  failure_count: number;
  excluded_count: number;
  minimum_sample_policy: number;
  credible_interval_level: number;
  credible_interval: {
    lower: number;
    upper: number;
    posterior_mean: number;
  } | null;
  matched_baseline: number;
  clears_baseline: boolean;
  prior: { alpha: number; beta: number };
  benchmark: string;
  as_of_date: string | null;
  data_label: DataLabel | null;
  method_version: string;
  explanation: string;
}

export interface ChecksResponse {
  request_id: string;
  ticker: string;
  company_name: string;
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  as_of_date: string;
  tip_date: string;
  methodology_version: string;
  checks: MarketCheckResult[];
  track_record: TrackRecordResult;
}

export interface GuardedReportResponse {
  request_id: string;
  report_version: string;
  guard_status: "PASSED" | "BLOCKED_FALLBACK";
  guard_blocked_reason: string | null;
  information_verdict_title: string;
  sections: Array<{
    section_id: string;
    title: string;
    template_id: string;
    sentence: string;
    source_snapshot_id: string | null;
    as_of_date: string | null;
    data_label: DataLabel | null;
  }>;
  creator_quoted_claim: {
    label: "Creator's claim";
    quoted_text: string | null;
    target_price_claimed: number | null;
    disclaimer: string;
  };
  provenance_summary: {
    snapshot_ids: string[];
    as_of_dates: string[];
    data_labels: DataLabel[];
  };
  mandatory_disclaimer: string;
}

export interface BenchmarkSummary {
  key: "NIFTY_50" | "SENSEX" | "BANKNIFTY";
  label: string;
  status: "AVAILABLE" | "COULD_NOT_VERIFY";
  close: number | null;
  change: number | null;
  change_percent: number | null;
  as_of_date: string | null;
  fetched_at?: string | null;
  data_freshness?: "LIVE_FEED" | "DATED_SNAPSHOT" | null;
  data_label: DataLabel | null;
  source_name: string | null;
  sparkline: Array<{ date: string; close: number }>;
}

export interface LiveStockQuote {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  sector: string | null;
  currency: string;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  day_high: number | null;
  day_low: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  volume: number | null;
  market_cap_cr: number | null;
  size_band: "LARGE" | "MID" | "SMALL" | "MICRO" | null;
  as_of_date: string;
  fetched_at: string;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT";
  data_label: "REAL" | "SYNTHETIC";
  source_name: string;
  delay_note: string;
  sparkline: Array<{ date: string; close: number }>;
}

export interface LiveQuotesResponse {
  request_id: string;
  fetched_at: string;
  feed_status: "LIVE_FEED" | "SNAPSHOT_FALLBACK" | "COULD_NOT_VERIFY";
  benchmarks: BenchmarkSummary[];
  quotes: LiveStockQuote[];
}

export interface LiveStockSearchItem {
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  instrument_type: InstrumentType;
  sector: string | null;
  source: "LIVE_SEARCH" | "CATALOGUE" | "WATCHLIST";
}

export interface LiveStockDetailResponse {
  request_id: string;
  quote: LiveStockQuote;
  range: "1d" | "1mo" | "3mo" | "6mo";
  series: Array<{
    label: string;
    trading_date: string;
    close: number;
    volume: number | null;
  }>;
  avg_daily_traded_value_cr: number | null;
}

export type WhatsAppProviderKind = "twilio" | "callmebot" | "meta_cloud" | "dry_run";

export interface VideoAnalysisItem {
  id: string;
  influencer_id: string;
  video_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  published_at: string;
  transcript_source: "CAPTIONS" | "METADATA_ONLY";
  detected_ticker: string | null;
  claim_ledger_json: ClaimLedger;
  hype_flags_json: HypeFlag[];
  disclosure_grade: DisclosureGrade;
  guarded_report_json: GuardedReportResponse;
  guard_status: "PASSED" | "BLOCKED_FALLBACK";
  whatsapp_summary_text: string;
  analyzed_at: string;
}

export interface FinfluencerDirectoryItem {
  id: string;
  name: string;
  handle: string | null;
  aliases: string[];
  avatar_initials: string;
  bio_summary: string | null;
  youtube_channel_id: string | null;
  youtube_handle: string | null;
  youtube_channel_url: string | null;
  has_realtime_youtube_feed: boolean;
  sebi_status: SebiLookupStatus;
  sebi_registration_no: string | null;
  sebi_category: string | null;
  sebi_snapshot_date: string | null;
  sebi_explanation: string;
  active_subscriber_count: number;
  latest_videos: VideoAnalysisItem[];
}

export interface FinfluencersResponse {
  request_id: string;
  fetched_at: string;
  twilio_whatsapp_configured?: boolean;
  whatsapp_meta_configured: boolean;
  llm_provider: string;
  items: FinfluencerDirectoryItem[];
}

export interface SubscriptionSummary {
  id: string;
  influencer_id: string;
  influencer_name: string;
  phone_masked: string;
  provider: WhatsAppProviderKind;
  is_active: boolean;
  consent_given_at: string;
  unsubscribe_token: string;
}

export interface SubscribeResponse {
  request_id: string;
  subscription: SubscriptionSummary;
  message: string;
}

export interface TestAlertResponse {
  request_id: string;
  video_id: string;
  video_title: string;
  delivery_status: "SENT" | "DRY_RUN_PREVIEW" | "FAILED" | "BLOCKED_BY_GUARD";
  provider: WhatsAppProviderKind;
  phone_masked: string;
  message_preview: string;
  wa_me_url: string | null;
  error_code: string | null;
}

export interface SyncFinfluencerResponse {
  request_id: string;
  influencer_id: string;
  influencer_name: string;
  fetched_from_rss: number;
  newly_analyzed: number;
  alerts_dispatched: number;
  videos: VideoAnalysisItem[];
}

export interface DemoCaseMeta {
  id: string;
  influencer_id: string;
  influencer_name: string;
  alias: string | null;
  ticker: string;
  instrument_name: string;
  instrument_type: InstrumentType;
  underlying_ticker: string | null;
  media_type: "PHOTO" | "VIDEO";
  media_path: string;
  tip_date: string;
  sample_text: string;
  sebi_expected_status: "REGISTERED" | "NOT_FOUND";
  data_label: DataLabel;
  coverage_note: string;
}

export type SupportedVoiceLanguage = "en-IN" | "hi-IN" | "kn-IN";

export interface VoiceReadoutResponse {
  request_id: string;
  status: "READY" | "DISABLED" | "UNAVAILABLE";
  language: SupportedVoiceLanguage;
  audio_base64: string | null;
  mime_type: string | null;
  guard_verified: true;
  message: string;
}

export interface CoordinatedDemoSignalResponse {
  request_id: string;
  feature_scope: "OPTIONAL_SYNTHETIC_DEMO_ONLY";
  is_synthetic: true;
  data_label: "SYNTHETIC";
  ticker: string;
  window_minutes: number;
  distinct_channels_in_window: number;
  median_phrase_overlap: number;
  status: "BURST_CLUSTER_OBSERVED_DEMO" | "NO_SYNTHETIC_CLUSTER_FOR_TICKER";
  events: Array<{
    channel_label: string;
    posted_at_iso: string;
    ticker: string;
    phrase_overlap_jaccard: number;
    is_synthetic: true;
  }>;
  what_this_shows: string;
  limitations: string[];
}

export interface TenYearTimelineBar {
  trading_date: string;
  close: number;
  volume: number | null;
  benchmark_close: number;
}

export interface TenYearTimelineMilestone {
  kind:
    | "TEN_YEAR_START"
    | "TEN_YEAR_LOW"
    | "TEN_YEAR_HIGH"
    | "SHARPEST_RUNUP_PEAK"
    | "DEEPEST_DRAWDOWN_TROUGH";
  label: string;
  trading_date: string;
  close: number;
  description: string;
}

export interface TenYearTimelineResponse {
  request_id: string;
  ticker: string;
  yahoo_symbol: string;
  company_name: string;
  exchange: "NSE" | "BSE";
  sector: string | null;
  currency: string;
  start_date: string;
  end_date: string;
  fetched_at: string;
  as_of_date: string;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT";
  data_label: "REAL" | "SYNTHETIC";
  source_name: string;
  snapshot_id: string;
  delay_note: string;
  series: TenYearTimelineBar[];
  milestones: TenYearTimelineMilestone[];
}

export interface PretendTrancheInput {
  id: string;
  entry_date: string;
  amount_inr: number;
  label?: string;
}

export interface EvaluatedTrancheResult {
  id: string;
  label: string;
  requested_entry_date: string;
  actual_entry_date: string;
  amount_inr: number;
  entry_price: number;
  units_allocated: number;
  status: "ACTIVE_AT_EVAL" | "STOP_LOSS_TRIGGERED" | "AFTER_EVAL_DATE";
  stopped_out_date: string | null;
  stopped_out_price: number | null;
  eval_date: string;
  eval_price: number;
  final_value_inr: number;
  net_change_inr: number;
  return_pct: number;
  holding_days: number;
  cagr_pct: number | null;
  peak_value_inr: number;
  trough_value_inr: number;
  max_drawdown_pct: number;
  max_drawdown_date: string | null;
  benchmark_entry_close: number;
  benchmark_eval_close: number;
  benchmark_final_value_inr: number;
  benchmark_return_pct: number;
  fixed_reference_final_value_inr: number;
}

export interface PretendPortfolioCurvePoint {
  trading_date: string;
  stock_close: number;
  deployed_capital_inr: number;
  portfolio_value_inr: number;
  nifty_equivalent_inr: number;
}

export interface GuardedPretendObservation {
  id: string;
  title: string;
  sentence: string;
  guard_passed: boolean;
}

export interface PretendMoneyEvaluationResponse {
  request_id: string;
  data_freshness: "LIVE_FEED" | "DATED_SNAPSHOT";
  data_label: "REAL" | "SYNTHETIC";
  source_name: string;
  as_of_date: string;
  fetched_at: string;
  ticker: string;
  company_name: string;
  starting_wallet_inr: number;
  evaluation_date: string;
  stop_loss_pct: number | null;
  total_allocated_inr: number;
  unallocated_cash_inr: number;
  stopped_out_cash_inr: number;
  active_equity_value_inr: number;
  total_portfolio_value_inr: number;
  total_net_change_inr: number;
  total_return_pct: number;
  portfolio_cagr_pct: number | null;
  worst_tranche_drawdown_pct: number;
  worst_drawdown_date: string | null;
  stopped_out_tranche_count: number;
  nifty_equivalent_portfolio_inr: number;
  nifty_equivalent_return_pct: number;
  fixed_reference_portfolio_inr: number;
  tranches: EvaluatedTrancheResult[];
  equity_curve: PretendPortfolioCurvePoint[];
  guard_status: "PASSED" | "BLOCKED_FALLBACK";
  observations: GuardedPretendObservation[];
  mandatory_disclaimer: string;
}

// Phase 7: Social Signal Intelligence Types
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
  citation_key: string;
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

export interface ResearchSessionResponse {
  request_id: string;
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
  suggested_questions: string[];
  mandatory_disclaimer: string;
}

export interface ResearchChatResponse {
  request_id: string;
  session_id: string;
  message: ResearchChatMessage;
  mandatory_disclaimer: string;
}

export interface ResearchVoiceSessionResponse {
  request_id: string;
  session_id: string;
  voice_token: string;
  expires_in_seconds: number;
  server_tts_provider: "sarvam" | "disabled";
  supported_languages: Array<{ code: SupportedVoiceLanguage; label: string }>;
  tts_audio?: {
    status: "READY" | "DISABLED" | "UNAVAILABLE";
    language: SupportedVoiceLanguage;
    audio_base64: string | null;
    mime_type: string | null;
    message: string;
  };
}
