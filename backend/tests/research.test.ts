import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/core/env.js";
import { generateGroundedChatResponse } from "../src/domain/research/researchChat.js";
import { defaultResearchSessionStore } from "../src/domain/research/researchSessionStore.js";
import {
  parseGoogleNewsRss,
  parseRedditAtomRss,
  resolveOfficialOembedUrl,
} from "../src/integrations/publicRssConnectors.js";

function createTestApp(fetchImpl?: typeof fetch) {
  const config = loadEnv({
    APP_ENV: "test",
    NODE_ENV: "test",
    LIVE_MARKET_ENABLED: "false",
    YOUTUBE_MONITOR_ENABLED: "false",
    LLM_PROVIDER: "disabled",
  });
  return { app: createApp({ config, fetchImpl }), config };
}

describe("Social Signal Intelligence API (/api/research/sessions)", () => {
  it("creates a temporary research session with 5 connectors, reports honest status, and accepts manual Telegram import", async () => {
    defaultResearchSessionStore.clear();
    const { app } = createTestApp();

    const createRes = await request(app)
      .post("/api/research/sessions")
      .send({
        ticker: "WIPRO",
        company_name: "Wipro Limited",
        exchange: "NSE",
        time_range: "7d",
      })
      .expect(201);

    expect(createRes.body.session_id).toMatch(/^res_/);
    expect(createRes.body.ticker).toBe("WIPRO");
    expect(createRes.body.connectors).toHaveLength(5);

    const xConnector = createRes.body.connectors.find(
      (c: { platform: string }) => c.platform === "X"
    );
    const tgConnector = createRes.body.connectors.find(
      (c: { platform: string }) => c.platform === "TELEGRAM"
    );
    expect(xConnector.status).toBe("REQUIRES_MANUAL_IMPORT");
    expect(tgConnector.status).toBe("REQUIRES_MANUAL_IMPORT");

    const sessionId = createRes.body.session_id as string;

    const statusRes = await request(app)
      .get(`/api/research/sessions/${sessionId}/status`)
      .expect(200);
    expect(statusRes.body.connectors).toHaveLength(5);

    // Import a manual Telegram message (no scraping)
    const importRes = await request(app)
      .post(`/api/research/sessions/${sessionId}/import`)
      .send({
        platform: "TELEGRAM",
        creator_name: "Retail Signals Group",
        title: "Forwarded WIPRO bullish claim",
        text: "WIPRO breakout soon! Guaranteed double money in 15 days, target 650, SL PAID.",
      })
      .expect(201);

    expect(importRes.body.overview.user_submitted_count).toBe(1);
    expect(importRes.body.overview.hype_and_urgency_phrases.length).toBeGreaterThan(0);

    const sourcesRes = await request(app)
      .get(`/api/research/sessions/${sessionId}/sources`)
      .expect(200);
    expect(
      sourcesRes.body.sources.some(
        (s: { provenance_kind: string }) => s.provenance_kind === "USER_SUBMITTED"
      )
    ).toBe(true);

    const claimsRes = await request(app)
      .get(`/api/research/sessions/${sessionId}/claims`)
      .expect(200);
    expect(claimsRes.body.mandatory_disclaimer).toContain("not investment advice");
  });

  it("collects zero-key official Reddit India RSS & Google News India RSS and resolves YouTube/X oEmbed links safely", async () => {
    const sampleRedditXml = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>RELIANCE retail &amp; telecom earnings discussion</title>
          <link href="https://www.reddit.com/r/IndianStockMarket/comments/abc123/reliance/" />
          <author><name>/u/nifty_observer</name></author>
          <published>2026-11-20T08:00:00Z</published>
          <content type="html">Strong bullish retail growth outlook for RELIANCE over 6 months.</content>
        </entry>
      </feed>`;

    const sampleNewsXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel>
        <item>
          <title>Reliance Industries quarterly update - Mint</title>
          <link>https://www.livemint.com/market/reliance-update</link>
          <pubDate>Fri, 20 Nov 2026 09:00:00 GMT</pubDate>
          <source>Mint</source>
          <description>Reliance Industries reported steady quarterly revenue.</description>
        </item>
      </channel></rss>`;

    expect(parseRedditAtomRss(sampleRedditXml, "2026-11-21T00:00:00Z")).toHaveLength(1);
    expect(parseGoogleNewsRss(sampleNewsXml, "2026-11-21T00:00:00Z")).toHaveLength(1);

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("reddit.com")) {
        return new Response(sampleRedditXml, { status: 200 });
      }
      if (url.includes("news.google.com")) {
        return new Response(sampleNewsXml, { status: 200 });
      }
      if (url.includes("youtube.com/oembed")) {
        return new Response(
          JSON.stringify({
            title: "Reliance Results Breakdown",
            author_name: "ET NOW",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("publish.twitter.com/oembed")) {
        return new Response(
          JSON.stringify({
            author_name: "Market Desk",
            html: "<blockquote><p>RELIANCE volume surge ahead of quarterly results.</p></blockquote>",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    // SSRF guard: non-allowlisted domain must return null without fetching
    const blocked = await resolveOfficialOembedUrl("https://evil.internal.local/secret", {
      fetchImpl: mockFetch,
    });
    expect(blocked).toBeNull();

    // Allowlisted YouTube & X oEmbed resolve cleanly with zero API keys
    const ytResolved = await resolveOfficialOembedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
      fetchImpl: mockFetch,
    });
    expect(ytResolved?.platform).toBe("YOUTUBE");
    expect(ytResolved?.creator_name).toBe("ET NOW");

    const xResolved = await resolveOfficialOembedUrl("https://x.com/marketdesk/status/12345", {
      fetchImpl: mockFetch,
    });
    expect(xResolved?.platform).toBe("X");
    expect(xResolved?.text).toContain("RELIANCE volume surge");

    // End-to-end session creation populates Reddit + News RSS automatically
    defaultResearchSessionStore.clear();
    const { app } = createTestApp(mockFetch);
    const res = await request(app)
      .post("/api/research/sessions")
      .send({ ticker: "RELIANCE", company_name: "Reliance Industries Limited" })
      .expect(201);

    expect(res.body.overview.real_source_count).toBeGreaterThanOrEqual(2);
    expect(res.body.sources.some((s: { platform: string }) => s.platform === "REDDIT")).toBe(true);
    expect(res.body.sources.some((s: { platform: string }) => s.platform === "NEWS")).toBe(true);

    // URL-only import on /import auto-resolves via official zero-key X oEmbed
    const urlImport = await request(app)
      .post(`/api/research/sessions/${res.body.session_id}/import`)
      .send({
        platform: "X",
        source_url: "https://x.com/marketdesk/status/12345",
      })
      .expect(201);

    expect(urlImport.body.sources.some((s: { platform: string }) => s.platform === "X")).toBe(true);
  });

  it("answers grounded RAG chat questions via JSON and SSE streaming with source citations", async () => {
    defaultResearchSessionStore.clear();
    const { app } = createTestApp();

    const createRes = await request(app)
      .post("/api/research/sessions")
      .send({ ticker: "RELIANCE", company_name: "Reliance Industries Limited", time_range: "7d" })
      .expect(201);

    const sessionId = createRes.body.session_id as string;

    await request(app)
      .post(`/api/research/sessions/${sessionId}/import`)
      .send({
        platform: "TELEGRAM",
        creator_name: "Desk Channel A",
        text: "RELIANCE bullish breakout above resistance, upside momentum expected in 30 days.",
      })
      .expect(201);

    await request(app)
      .post(`/api/research/sessions/${sessionId}/import`)
      .send({
        platform: "YOUTUBE",
        creator_name: "Analyst Channel B",
        text: "RELIANCE bearish margin pressure and downside risk this quarter; caution advised.",
      })
      .expect(201);

    const chatJsonRes = await request(app)
      .post(`/api/research/sessions/${sessionId}/chat`)
      .send({ question: "Show me contradictory claims.", stream: false })
      .expect(200);

    expect(chatJsonRes.body.message.guard_status).toBe("PASSED");
    expect(chatJsonRes.body.message.citations.length).toBeGreaterThan(0);
    expect(chatJsonRes.body.message.content).toContain("contradict");

    const chatSseRes = await request(app)
      .post(`/api/research/sessions/${sessionId}/chat`)
      .set("Accept", "text/event-stream")
      .send({ question: "Why are people talking about this stock?", stream: true })
      .expect(200);

    expect(chatSseRes.headers["content-type"]).toContain("text/event-stream");
    expect(chatSseRes.text).toContain("event: token");
    expect(chatSseRes.text).toContain("event: done");
  });

  it("enforces deterministic Output Guard and blocks advisory candidate answers", async () => {
    defaultResearchSessionStore.clear();
    const { app, config } = createTestApp();

    const createRes = await request(app)
      .post("/api/research/sessions")
      .send({ ticker: "TCS", company_name: "Tata Consultancy Services Limited" })
      .expect(201);

    const session = defaultResearchSessionStore.get(createRes.body.session_id as string);
    expect(session).not.toBeNull();

    const guarded = await generateGroundedChatResponse({
      question: "Should I buy TCS?",
      session: session!,
      config,
      injectedCandidateText:
        "You should buy TCS now because it is undervalued and will rise fast.",
    });

    expect(guarded.assistantMessage.guard_status).toBe("BLOCKED_FALLBACK");
    expect(guarded.assistantMessage.content).not.toMatch(/\byou should buy\b/i);
    expect(guarded.mandatoryDisclaimer).toContain("not investment advice");
  });

  it("initializes voice session without exposing API secrets and guards TTS requests", async () => {
    defaultResearchSessionStore.clear();
    const { app } = createTestApp();

    const createRes = await request(app)
      .post("/api/research/sessions")
      .send({ ticker: "HDFCBANK", company_name: "HDFC Bank Limited" })
      .expect(201);

    const sessionId = createRes.body.session_id as string;

    const voiceInit = await request(app)
      .post(`/api/research/sessions/${sessionId}/voice-session`)
      .send({ action: "init", language: "kn-IN" })
      .expect(200);

    expect(voiceInit.body.voice_token).toMatch(/^vs_/);
    expect(voiceInit.body.server_tts_provider).toBe("disabled");
    expect(voiceInit.body.supported_languages.map((l: { code: string }) => l.code)).toEqual([
      "en-IN",
      "hi-IN",
      "kn-IN",
    ]);
    expect(JSON.stringify(voiceInit.body)).not.toContain("SARVAM_API_KEY");

    // Verify Sarvam bulbul:v3 API call & Sarvam saaras:v4 STT when SARVAM_API_KEY is configured
    let capturedSarvamBody: Record<string, unknown> | null = null;
    let sttCalled = false;
    const sarvamMockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.sarvam.ai/text-to-speech") {
        capturedSarvamBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(JSON.stringify({ audios: ["UklGRg=="] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://api.sarvam.ai/speech-to-text") {
        sttCalled = true;
        return new Response(
          JSON.stringify({ transcript: "Why are people talking about HDFC Bank?" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;

    const sarvamConfig = loadEnv({
      APP_ENV: "test",
      NODE_ENV: "test",
      LIVE_MARKET_ENABLED: "false",
      YOUTUBE_MONITOR_ENABLED: "false",
      LLM_PROVIDER: "disabled",
      SARVAM_API_KEY: "test_sarvam_key_never_leaked",
    });
    const sarvamApp = createApp({ config: sarvamConfig, fetchImpl: sarvamMockFetch });
    const sarvamSessionRes = await request(sarvamApp)
      .post("/api/research/sessions")
      .send({ ticker: "HDFCBANK", company_name: "HDFC Bank Limited" })
      .expect(201);

    const sttRes = await request(sarvamApp)
      .post(`/api/research/sessions/${sarvamSessionRes.body.session_id}/voice-stt`)
      .field("language", "en-IN")
      .attach("file", Buffer.from("RIFFxxxxWAVEfmt mockaudio1234567890"), {
        filename: "recording.webm",
        contentType: "audio/webm",
      })
      .expect(200);

    expect(sttCalled).toBe(true);
    expect(sttRes.body.status).toBe("READY");
    expect(sttRes.body.transcript).toBe("Why are people talking about HDFC Bank?");
    expect(JSON.stringify(sttRes.body)).not.toContain("test_sarvam_key_never_leaked");

    const ttsRes = await request(sarvamApp)
      .post(`/api/research/sessions/${sarvamSessionRes.body.session_id}/voice-session`)
      .send({
        action: "synthesize",
        text: "HDFC Bank evidence summary [S1] checked without advice.",
        language: "kn-IN",
      })
      .expect(200);

    expect(ttsRes.body.server_tts_provider).toBe("sarvam");
    expect(ttsRes.body.tts_audio.status).toBe("READY");
    expect(ttsRes.body.tts_audio.audio_base64).toBe("UklGRg==");
    expect(JSON.stringify(ttsRes.body)).not.toContain("test_sarvam_key_never_leaked");
    expect(capturedSarvamBody).toMatchObject({
      model: "bulbul:v3",
      speaker: "kavya",
      target_language_code: "kn-IN",
      output_audio_codec: "wav",
    });

    // Multilingual grounded chat works in Hindi (hi-IN) and Kannada (kn-IN) with Output Guard
    const hiChat = await request(app)
      .post(`/api/research/sessions/${sessionId}/chat`)
      .send({ question: "इस स्टॉक पर लोग क्या कह रहे हैं?", language: "hi-IN" })
      .expect(200);
    expect(hiChat.body.message.guard_status).toBe("PASSED");
    expect(hiChat.body.message.content).toContain("HDFC Bank");

    const knChat = await request(app)
      .post(`/api/research/sessions/${sessionId}/chat`)
      .send({ question: "ಈ ಸ್ಟಾಕ್ ಬಗ್ಗೆ ಜನರು ಏನು ಹೇಳುತ್ತಿದ್ದಾರೆ?", language: "kn-IN" })
      .expect(200);
    expect(knChat.body.message.guard_status).toBe("PASSED");
    expect(knChat.body.message.content).toContain("HDFC Bank");

    await request(app)
      .post(`/api/research/sessions/${sessionId}/voice-session`)
      .send({
        action: "synthesize",
        text: "Buy HDFCBANK now for guaranteed profit!",
        language: "en-IN",
      })
      .expect(422);
  });
});
