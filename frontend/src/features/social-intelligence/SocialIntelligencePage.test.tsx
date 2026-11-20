import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { AutopsyProvider } from "../workflow/AutopsyContext";

const MOCK_SESSION_RESPONSE = {
  request_id: "req_test_social",
  session_id: "res_test123456",
  ticker: "RELIANCE",
  company_name: "Reliance Industries Limited",
  exchange: "NSE" as const,
  time_range: "7d" as const,
  created_at: "2026-11-21T00:00:00.000Z",
  updated_at: "2026-11-21T00:00:00.000Z",
  expires_at: "2026-11-21T00:30:00.000Z",
  stock_context: {
    ticker: "RELIANCE",
    company_name: "Reliance Industries Limited",
    exchange: "NSE" as const,
    latest_price: 2945.5,
    change_percent: 0.8,
    as_of_date: "2026-11-20",
    data_freshness: "LIVE_FEED" as const,
    data_label: "REAL" as const,
    source_name: "Yahoo Finance v8",
  },
  connectors: [
    {
      platform: "YOUTUBE" as const,
      display_name: "YouTube",
      status: "COLLECTION_COMPLETE" as const,
      items_collected: 1,
      provenance_note: "Real · YouTube Official RSS",
      availability_reason: "Collected 1 public video reference from official YouTube RSS.",
      supports_manual_import: true,
      last_checked_at: "2026-11-21T00:00:00.000Z",
    },
    {
      platform: "X" as const,
      display_name: "X",
      status: "UNAVAILABLE" as const,
      items_collected: 0,
      provenance_note: "Not Connected · Official API Key Required",
      availability_reason: "Official X API v2 credentials are not configured.",
      supports_manual_import: true,
      last_checked_at: "2026-11-21T00:00:00.000Z",
    },
    {
      platform: "TELEGRAM" as const,
      display_name: "Telegram",
      status: "REQUIRES_MANUAL_IMPORT" as const,
      items_collected: 0,
      provenance_note: "User-Submitted Manual Import (Zero Scraping)",
      availability_reason: "Automated Telegram scraping is disabled by policy.",
      supports_manual_import: true,
      last_checked_at: "2026-11-21T00:00:00.000Z",
    },
  ],
  sources: [
    {
      id: "src_yt_1",
      citation_key: "S1",
      platform: "YOUTUBE" as const,
      creator_name: "Market Insights India",
      channel_or_handle: "@marketinsights",
      title: "Reliance quarterly update discussion",
      excerpt: "Discussing Reliance Industries telecom and retail momentum without a stop-loss.",
      published_at: "2026-11-19T10:00:00.000Z",
      retrieved_at: "2026-11-21T00:00:00.000Z",
      source_url: "https://www.youtube.com/watch?v=demo123",
      provenance_kind: "REAL_YOUTUBE_RSS" as const,
      data_label: "REAL" as const,
      direction: "BULLISH" as const,
      claims: {
        stock: { value: "RELIANCE", status: "EXTRACTED" as const, evidence: null },
        direction: { value: "BULLISH" as const, status: "EXTRACTED" as const, evidence: null },
        target_price: { value: null, status: "NOT_STATED" as const, evidence: null },
        deadline: { value: null, status: "NOT_STATED" as const, evidence: null },
        stop_loss: { value: null, status: "NOT_STATED" as const, evidence: null },
      },
      hype_flags: [],
      disclosure_grade: "NONE" as const,
      missing_fields: ["Stop-loss not stated", "Time horizon not stated"],
    },
  ],
  overview: {
    total_sources: 1,
    real_source_count: 1,
    user_submitted_count: 0,
    curated_demo_count: 0,
    recurring_claims: [
      {
        id: "rec_bullish",
        summary: "1 collected source expresses an upward/bullish thesis",
        direction: "BULLISH" as const,
        source_ids: ["src_yt_1"],
        citation_keys: ["S1"],
        occurrence_count: 1,
        provenance_labels: ["REAL" as const],
      },
    ],
    bullish_arguments: [
      {
        id: "bull_1",
        summary: "Market Insights India (S1): Reliance quarterly update discussion",
        direction: "BULLISH" as const,
        source_ids: ["src_yt_1"],
        citation_keys: ["S1"],
        occurrence_count: 1,
        provenance_labels: ["REAL" as const],
      },
    ],
    bearish_arguments: [],
    contradictory_claims: [],
    hype_and_urgency_phrases: [],
    sponsorship_disclosure_indicators: {
      clear_count: 0,
      vague_count: 0,
      none_count: 1,
      unknown_count: 0,
      summary: "0 clear disclosure, 0 vague, 1 no disclosure wording found across 1 source.",
    },
    unverified_claims: [],
    missing_information: ["Open stop-loss levels were not stated in 1 of 1 source(s)."],
  },
  messages: [],
  suggested_questions: ["Why are people talking about this stock?"],
  mandatory_disclaimer:
    "This report describes historical facts and risk factors around a tip. It is not investment advice or SEBI-registered research. The decision is yours.",
};

vi.mock("../../lib/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/apiClient")>();
  return {
    ...actual,
    searchLiveStocks: vi.fn().mockResolvedValue([]),
    createResearchSession: vi.fn().mockResolvedValue(MOCK_SESSION_RESPONSE),
    streamResearchChat: vi.fn().mockImplementation(async ({ onToken }) => {
      onToken("Grounded summary citing [S1].");
      return {
        request_id: "req_chat_1",
        session_id: "res_test123456",
        message: {
          id: "msg_a_1",
          role: "assistant" as const,
          content: "Grounded summary citing [S1].",
          created_at: "2026-11-21T00:01:00.000Z",
          citations: [
            {
              citation_key: "S1",
              source_id: "src_yt_1",
              platform: "YOUTUBE" as const,
              creator_name: "Market Insights India",
              title: "Reliance quarterly update discussion",
              source_url: "https://www.youtube.com/watch?v=demo123",
              data_label: "REAL" as const,
              provenance_kind: "REAL_YOUTUBE_RSS" as const,
            },
          ],
          evidence_breakdown: {
            verified_facts: ["RELIANCE reference price: ₹2,945.5"],
            social_claims: ['[S1] Market Insights India: "Reliance quarterly update discussion".'],
            unverified_or_missing: ["Open stop-loss levels were not stated."],
          },
          guard_status: "PASSED" as const,
          suggested_followups: ["What information cannot be verified?"],
        },
        mandatory_disclaimer: MOCK_SESSION_RESPONSE.mandatory_disclaimer,
      };
    }),
  };
});

function renderAtRoute(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AutopsyProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppRoutes />
        </MemoryRouter>
      </AutopsyProvider>
    </QueryClientProvider>
  );
}

describe("Social Signal Intelligence page and StickyBubblyNav integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Social Intelligence pill in the floating navbar with active state on /social-intelligence", async () => {
    renderAtRoute("/social-intelligence");

    expect(await screen.findByRole("heading", { name: "Social Signal Intelligence" })).toBeInTheDocument();

    const navPill = screen.getByRole("menuitem", { name: "Social Intelligence", hidden: true });
    expect(navPill).toHaveAttribute("aria-current", "page");
  });

  it("starts a research session, renders source cards, evidence explorer, and grounded chatbot with citations", async () => {
    renderAtRoute("/social-intelligence");

    const startBtn = await screen.findByRole("button", { name: /Start Research/i });
    fireEvent.click(startBtn);

    expect(await screen.findByText("Collection complete")).toBeInTheDocument();
    expect(screen.getByText("Requires manual import")).toBeInTheDocument();
    expect(screen.getByText("Reliance quarterly update discussion")).toBeInTheDocument();

    const starterBtn = screen.getByRole("button", {
      name: "Why are people talking about this stock?",
    });
    fireEvent.click(starterBtn);

    await waitFor(() => {
      expect(screen.getByText("Grounded summary citing [S1].")).toBeInTheDocument();
    });
    expect(screen.getByText("Guard Verified")).toBeInTheDocument();

    // Voice button gracefully falls back to text when SpeechRecognition is unavailable in jsdom
    const micBtn = screen.getByRole("button", { name: /Ask question using voice/i });
    fireEvent.click(micBtn);
    expect(
      screen.getByText(/Voice microphone input is not supported in this browser/i)
    ).toBeInTheDocument();

    // Switch to Voice Mode with animated green talking blob + Kannada language option
    const voiceModeTab = screen.getByRole("tab", { name: /Voice Mode/i });
    fireEvent.click(voiceModeTab);
    expect(screen.getByTestId("voice-assistant-mode-stage")).toBeInTheDocument();
    expect(screen.getByTestId("voice-assistant-orb")).toBeInTheDocument();

    const langSelect = screen.getByLabelText(/Voice language/i);
    fireEvent.change(langSelect, { target: { value: "kn-IN" } });
    expect(screen.getByText(/Tap green blob to talk \(ಕನ್ನಡ \(Kannada\)\)/i)).toBeInTheDocument();
  });
});
