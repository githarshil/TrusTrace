import type {
  BenchmarkSummary,
  ChecksResponse,
  ClaimLedger,
  CoordinatedDemoSignalResponse,
  DemoCaseMeta,
  ExactDateTip,
  FinfluencersResponse,
  GuardedReportResponse,
  LiveQuotesResponse,
  LiveStockDetailResponse,
  LiveStockSearchItem,
  ParseResponse,
  PricesResponse,
  SebiLookupResponse,
  StockLookupItem,
  SubscribeResponse,
  SupportedVoiceLanguage,
  SyncFinfluencerResponse,
  TestAlertResponse,
  TipMarkerItem,
  VoiceReadoutResponse,
  WhatsAppProviderKind,
} from "../types/api";

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalBrowser = host === "localhost" || host === "127.0.0.1";
    const isConfiguredLocal =
      configured.includes("localhost") || configured.includes("127.0.0.1");
    // On deployed domains (e.g. Netlify), never call localhost — use relative "/api/*" proxy or non-local configured URL
    if (!isLocalBrowser) {
      return isConfiguredLocal ? "" : configured;
    }
  }
  return configured || "http://localhost:8000";
}

export const API_BASE_URL = resolveApiBaseUrl();

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  request_id: string;
  timestamp: string;
  checks: {
    database: "connected" | "not_configured" | "degraded";
    schema_baseline: string | null;
    parser_provider: "configured" | "disabled";
    voice_provider: "configured" | "disabled";
  };
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) message = errBody.error.message;
    } catch {
      // Keep default safe message
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function fetchApiHealth(): Promise<HealthResponse> {
  return apiJson<HealthResponse>("/api/health");
}

export function parseTip(params: {
  text?: string;
  influencer_name?: string;
  stock_name?: string;
  demo_case_id?: string;
  file?: File | null;
}): Promise<ParseResponse> {
  if (params.file) {
    const form = new FormData();
    form.append("file", params.file);
    if (params.text) form.append("text", params.text);
    if (params.influencer_name) form.append("influencer_name", params.influencer_name);
    if (params.stock_name) form.append("stock_name", params.stock_name);
    if (params.demo_case_id) form.append("demo_case_id", params.demo_case_id);
    return apiJson<ParseResponse>("/api/tips/parse", {
      method: "POST",
      body: form,
    });
  }

  return apiJson<ParseResponse>("/api/tips/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: params.text ?? "",
      influencer_name: params.influencer_name ?? "",
      stock_name: params.stock_name ?? "",
      demo_case_id: params.demo_case_id,
    }),
  });
}

export function lookupInfluencer(query: string): Promise<SebiLookupResponse> {
  return apiJson<SebiLookupResponse>(`/api/influencers/lookup?q=${encodeURIComponent(query)}`);
}

export async function lookupStocks(query: string): Promise<StockLookupItem[]> {
  const res = await apiJson<{ items: StockLookupItem[] }>(
    `/api/stocks/lookup?q=${encodeURIComponent(query)}`
  );
  return res.items;
}

export function fetchStockPrices(
  ticker: string,
  from?: string,
  to?: string
): Promise<PricesResponse> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();
  return apiJson<PricesResponse>(
    `/api/stocks/${encodeURIComponent(ticker)}/prices${query ? `?${query}` : ""}`
  );
}

export async function fetchTipMarkers(
  influencerId: string,
  ticker: string
): Promise<TipMarkerItem[]> {
  const res = await apiJson<{ markers: TipMarkerItem[] }>(
    `/api/influencers/${encodeURIComponent(influencerId)}/tips?ticker=${encodeURIComponent(ticker)}`
  );
  return res.markers;
}

export async function fetchExactDateTips(
  influencerId: string,
  ticker: string,
  date: string
): Promise<ExactDateTip[]> {
  const res = await apiJson<{ tips: ExactDateTip[] }>(
    `/api/influencers/${encodeURIComponent(influencerId)}/tips?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`
  );
  return res.tips;
}

export function fetchStockChecks(params: {
  ticker: string;
  asOf?: string;
  tipDate?: string;
  influencerId?: string | null;
}): Promise<ChecksResponse> {
  const qs = new URLSearchParams();
  if (params.asOf) qs.set("asOf", params.asOf);
  if (params.tipDate) qs.set("tipDate", params.tipDate);
  if (params.influencerId) qs.set("influencerId", params.influencerId);
  return apiJson<ChecksResponse>(
    `/api/stocks/${encodeURIComponent(params.ticker)}/checks?${qs.toString()}`
  );
}

export function buildGuardedReport(params: {
  ticker: string;
  tip_date: string;
  as_of_date?: string;
  influencer_id?: string | null;
  influencer_name?: string | null;
  original_text?: string | null;
  claims?: ClaimLedger;
}): Promise<GuardedReportResponse> {
  return apiJson<GuardedReportResponse>("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function fetchBenchmarks(): Promise<BenchmarkSummary[]> {
  const res = await apiJson<{ benchmarks: BenchmarkSummary[] }>("/api/meta/benchmarks");
  return res.benchmarks;
}

export async function fetchDemoCases(): Promise<DemoCaseMeta[]> {
  const res = await apiJson<{ items: DemoCaseMeta[] }>("/api/meta/demo-cases");
  return res.items;
}

export function requestVoiceReadout(params: {
  guarded_text: string;
  language: SupportedVoiceLanguage;
}): Promise<VoiceReadoutResponse> {
  return apiJson<VoiceReadoutResponse>("/api/voice/readout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function fetchCoordinatedDemoSignal(
  ticker: string
): Promise<CoordinatedDemoSignalResponse> {
  return apiJson<CoordinatedDemoSignalResponse>(
    `/api/meta/coordinated-demo?ticker=${encodeURIComponent(ticker)}`
  );
}

// Phase 4: Zero-Cost Real-Time Stocks & Finfluencer YouTube → WhatsApp Alert APIs
export function fetchLiveQuotes(tickers?: string[]): Promise<LiveQuotesResponse> {
  const qs = tickers && tickers.length > 0 ? `?tickers=${encodeURIComponent(tickers.join(","))}` : "";
  return apiJson<LiveQuotesResponse>(`/api/live/stocks/quotes${qs}`);
}

export async function searchLiveStocks(query: string): Promise<LiveStockSearchItem[]> {
  const res = await apiJson<{ items: LiveStockSearchItem[] }>(
    `/api/live/stocks/search?q=${encodeURIComponent(query)}`
  );
  return res.items;
}

export function fetchLiveStockDetail(
  ticker: string,
  range: "1d" | "1mo" | "3mo" | "6mo" = "1mo"
): Promise<LiveStockDetailResponse> {
  return apiJson<LiveStockDetailResponse>(
    `/api/live/stocks/${encodeURIComponent(ticker)}/detail?range=${encodeURIComponent(range)}`
  );
}

export function fetchFinfluencers(): Promise<FinfluencersResponse> {
  return apiJson<FinfluencersResponse>("/api/finfluencers");
}

export function syncFinfluencerVideos(influencerId: string): Promise<SyncFinfluencerResponse> {
  return apiJson<SyncFinfluencerResponse>(
    `/api/finfluencers/${encodeURIComponent(influencerId)}/sync`,
    { method: "POST" }
  );
}

export function subscribeFinfluencerWhatsApp(params: {
  influencerId: string;
  phone: string;
  provider: WhatsAppProviderKind;
  callmebot_api_key?: string;
  consent_accepted: true;
}): Promise<SubscribeResponse> {
  return apiJson<SubscribeResponse>(
    `/api/finfluencers/${encodeURIComponent(params.influencerId)}/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: params.phone,
        provider: params.provider,
        callmebot_api_key: params.callmebot_api_key || undefined,
        consent_accepted: params.consent_accepted,
      }),
    }
  );
}

export function sendFinfluencerTestAlert(params: {
  influencerId: string;
  subscription_id: string;
}): Promise<TestAlertResponse> {
  return apiJson<TestAlertResponse>(
    `/api/finfluencers/${encodeURIComponent(params.influencerId)}/test-alert`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_id: params.subscription_id }),
    }
  );
}

export function unsubscribeFinfluencerAlert(
  token: string
): Promise<{ unsubscribed: boolean; phone_masked: string | null }> {
  return apiJson<{ unsubscribed: boolean; phone_masked: string | null }>(
    "/api/finfluencers/unsubscribe",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }
  );
}

// Phase 5: Pretend Money 10-Year Historical Allocation Sandbox APIs
export function fetchTenYearTimeline(
  ticker: string
): Promise<import("../types/api").TenYearTimelineResponse> {
  return apiJson<import("../types/api").TenYearTimelineResponse>(
    `/api/live/stocks/${encodeURIComponent(ticker)}/timeline-10y`
  );
}

export function evaluatePretendMoney(params: {
  ticker: string;
  starting_wallet_inr: number;
  evaluation_date?: string;
  stop_loss_pct: number | null;
  tranches: import("../types/api").PretendTrancheInput[];
}): Promise<import("../types/api").PretendMoneyEvaluationResponse> {
  return apiJson<import("../types/api").PretendMoneyEvaluationResponse>(
    `/api/live/stocks/${encodeURIComponent(params.ticker)}/pretend-evaluate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        starting_wallet_inr: params.starting_wallet_inr,
        evaluation_date: params.evaluation_date,
        stop_loss_pct: params.stop_loss_pct,
        tranches: params.tranches,
      }),
    }
  );
}

// Phase 7: Social Signal Intelligence APIs
export function createResearchSession(params: {
  ticker: string;
  company_name?: string;
  exchange?: "NSE" | "BSE";
  time_range?: import("../types/api").ResearchTimeRange;
}): Promise<import("../types/api").ResearchSessionResponse> {
  return apiJson<import("../types/api").ResearchSessionResponse>("/api/research/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function fetchResearchSession(
  sessionId: string
): Promise<import("../types/api").ResearchSessionResponse> {
  return apiJson<import("../types/api").ResearchSessionResponse>(
    `/api/research/sessions/${encodeURIComponent(sessionId)}`
  );
}

export function importResearchSource(params: {
  sessionId: string;
  platform: import("../types/api").SocialPlatform;
  creator_name?: string;
  title?: string;
  text?: string;
  source_url?: string;
  published_at?: string;
}): Promise<import("../types/api").ResearchSessionResponse> {
  return apiJson<import("../types/api").ResearchSessionResponse>(
    `/api/research/sessions/${encodeURIComponent(params.sessionId)}/import`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: params.platform,
        creator_name: params.creator_name || undefined,
        title: params.title || undefined,
        text: params.text ?? "",
        source_url: params.source_url || undefined,
        published_at: params.published_at || undefined,
      }),
    }
  );
}

export async function streamResearchChat(params: {
  sessionId: string;
  question: string;
  language?: SupportedVoiceLanguage;
  onToken: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<import("../types/api").ResearchChatResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/research/sessions/${encodeURIComponent(params.sessionId)}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({
        question: params.question,
        stream: true,
        language: params.language ?? "en-IN",
      }),
      signal: params.signal,
    }
  );

  if (!response.ok) {
    let message = `Chat request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) message = errBody.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const json = (await response.json()) as import("../types/api").ResearchChatResponse;
    params.onToken(json.message.content);
    return json;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: import("../types/api").ResearchChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const lines = frame.split("\n");
      let eventType = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        const parsed = JSON.parse(dataStr) as {
          delta?: string;
          response?: import("../types/api").ResearchChatResponse;
        };
        if (eventType === "token" && typeof parsed.delta === "string") {
          params.onToken(parsed.delta);
        } else if (eventType === "done" && parsed.response) {
          finalPayload = parsed.response;
        }
      } catch {
        // ignore malformed partial frame
      }
    }
  }

  if (!finalPayload) {
    throw new Error("Chat stream closed without a completed evidence payload.");
  }
  return finalPayload;
}

export function requestResearchVoiceSession(params: {
  sessionId: string;
  action: "init" | "synthesize";
  text?: string;
  language?: SupportedVoiceLanguage;
}): Promise<import("../types/api").ResearchVoiceSessionResponse> {
  return apiJson<import("../types/api").ResearchVoiceSessionResponse>(
    `/api/research/sessions/${encodeURIComponent(params.sessionId)}/voice-session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: params.action,
        text: params.text,
        language: params.language ?? "en-IN",
      }),
    }
  );
}

export function transcribeResearchVoiceAudio(params: {
  sessionId: string;
  audioBlob: Blob;
  language: SupportedVoiceLanguage;
}): Promise<{
  request_id: string;
  session_id: string;
  status: "READY" | "DISABLED" | "UNAVAILABLE";
  language: SupportedVoiceLanguage;
  transcript: string | null;
  message: string;
}> {
  const form = new FormData();
  form.append("file", params.audioBlob, "recording.webm");
  form.append("language", params.language);
  return apiJson(
    `/api/research/sessions/${encodeURIComponent(params.sessionId)}/voice-stt`,
    {
      method: "POST",
      body: form,
    }
  );
}
