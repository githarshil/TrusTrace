import { randomUUID } from "node:crypto";
import type { AppEnv } from "../../core/env.js";
import { logWarn } from "../../core/logger.js";
import { MANDATORY_DISCLAIMER, scanSystemAuthoredText } from "../output-guard/guard.js";
import { retrieveRelevantSources } from "./researchEngine.js";
import type {
  ResearchChatCitation,
  ResearchChatMessage,
  ResearchSession,
  ResearchSourceItem,
} from "./types.js";

const CHAT_LLM_TIMEOUT_MS = 12_000;

const SAFE_CHAT_FALLBACK =
  "A candidate response did not pass Tip Autopsy's non-advisory Output Guard and was withheld. Tip Autopsy grades the quality of information around a stock — it never recommends buying, selling, holding, or setting price targets. Inspect the cited sources and missing-information list directly.";

export const DEFAULT_SUGGESTED_QUESTIONS = [
  "Why are people talking about this stock?",
  "What are the main bullish arguments?",
  "What are the main bearish arguments?",
  "Show me contradictory claims.",
  "Are influencers making similar promises?",
  "Which claims are actually supported by evidence?",
  "What information cannot be verified?",
];

function buildCitations(sources: ResearchSourceItem[]): ResearchChatCitation[] {
  return sources.map((s) => ({
    citation_key: s.citation_key,
    source_id: s.id,
    platform: s.platform,
    creator_name: s.creator_name,
    title: s.title,
    source_url: s.source_url,
    data_label: s.data_label,
    provenance_kind: s.provenance_kind,
  }));
}

function buildEvidenceBreakdown(session: ResearchSession, retrieved: ResearchSourceItem[]) {
  const verifiedFacts: string[] = [];
  const socialClaims: string[] = [];
  const unverifiedOrMissing: string[] = [];

  if (session.stock_context.latest_price !== null) {
    verifiedFacts.push(
      `${session.ticker} (${session.exchange}) reference price: ₹${session.stock_context.latest_price.toLocaleString("en-IN")}${
        session.stock_context.as_of_date ? ` as of ${session.stock_context.as_of_date}` : ""
      } (${session.stock_context.source_name ?? "market feed"}).`
    );
  } else {
    unverifiedOrMissing.push(
      `Live or snapshot market price for ${session.ticker} could not be verified in this session.`
    );
  }

  verifiedFacts.push(
    `Active session contains ${session.sources.length} source(s): ${session.overview.real_source_count} official API/RSS, ${session.overview.user_submitted_count} user-imported, and ${session.overview.curated_demo_count} curated demo.`
  );

  for (const src of retrieved.slice(0, 4)) {
    const dirLabel = src.direction ? ` (${src.direction.toLowerCase()} tone)` : "";
    socialClaims.push(
      `[${src.citation_key}] ${src.creator_name ?? src.platform} (${src.platform}): "${src.title}"${dirLabel}.`
    );
  }

  for (const gap of session.overview.missing_information.slice(0, 3)) {
    unverifiedOrMissing.push(gap);
  }

  return {
    verified_facts: verifiedFacts,
    social_claims: socialClaims,
    unverified_or_missing: unverifiedOrMissing,
  };
}

function synthesizeDeterministicRagAnswer(
  question: string,
  session: ResearchSession,
  retrieved: ResearchSourceItem[],
  language: "en-IN" | "hi-IN" | "kn-IN" = "en-IN"
): { content: string; followups: string[] } {
  const lower = question.toLowerCase();
  const { overview, ticker, company_name: companyName } = session;

  if (language === "hi-IN") {
    if (session.sources.length === 0) {
      return {
        content: `${companyName} (${ticker}) के इस अस्थायी सत्र में अभी कोई सोशल स्रोत एकत्र नहीं हुआ है। नीचे दिए गए मैनुअल इम्पोर्ट से टेलीग्राम संदेश या यूट्यूब लिंक जोड़ें ताकि हम तथ्यों के आधार पर चर्चा कर सकें।`,
        followups: DEFAULT_SUGGESTED_QUESTIONS.slice(0, 3),
      };
    }
    const lines: string[] = [
      `${companyName} (${ticker}) के लिए कुल ${session.sources.length} स्रोत जाँचे गए हैं (तेज़ी के दावे: ${overview.bullish_arguments.length}, मंदी की चिंताएँ: ${overview.bearish_arguments.length})। ये केवल सोशल दावे हैं, निवेश सलाह नहीं।`,
    ];
    for (const src of retrieved.slice(0, 2)) {
      lines.push(`• [${src.citation_key}] ${src.creator_name ?? src.platform}: "${src.title}"।`);
    }
    if (overview.missing_information.length > 0) {
      lines.push(`अपूर्ण जानकारी: ${overview.missing_information[0]}`);
    }
    return {
      content: lines.join("\n"),
      followups: DEFAULT_SUGGESTED_QUESTIONS.slice(0, 3),
    };
  }

  if (language === "kn-IN") {
    if (session.sources.length === 0) {
      return {
        content: `${companyName} (${ticker}) ಗಾಗಿ ಈ ತಾತ್ಕಾಲಿಕ ಸೆಷನ್‌ನಲ್ಲಿ ಇನ್ನೂ ಯಾವುದೇ ಸಾಮಾಜಿಕ ಮೂಲಗಳು ಸಂಗ್ರಹವಾಗಿಲ್ಲ. ಪುರಾವೆ ಆಧಾರಿತ ವಿಶ್ಲೇಷಣೆಗಾಗಿ ಟೆಲಿಗ್ರಾಮ್ ಸಂದೇಶ ಅಥವಾ ಯೂಟ್ಯೂಬ್ ಲಿಂಕ್ ಅನ್ನು ಮ್ಯಾನ್ಯುವಲ್ ಇಂಪೋರ್ಟ್ ಮೂಲಕ ಸೇರಿಸಿ.`,
        followups: DEFAULT_SUGGESTED_QUESTIONS.slice(0, 3),
      };
    }
    const lines: string[] = [
      `${companyName} (${ticker}) ಗಾಗಿ ಒಟ್ಟು ${session.sources.length} ಮೂಲಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ (ಧನಾತ್ಮಕ ವಾದಗಳು: ${overview.bullish_arguments.length}, ಎಚ್ಚರಿಕೆಯ ವಾದಗಳು: ${overview.bearish_arguments.length}). ಇವು ಕೇವಲ ಸಾಮಾಜಿಕ ಹಕ್ಕುಗಳು, ಹೂಡಿಕೆ ಸಲಹೆಯಲ್ಲ.`,
    ];
    for (const src of retrieved.slice(0, 2)) {
      lines.push(`• [${src.citation_key}] ${src.creator_name ?? src.platform}: "${src.title}".`);
    }
    if (overview.missing_information.length > 0) {
      lines.push(`ಲಭ್ಯವಿಲ್ಲದ ಮಾಹಿತಿ: ${overview.missing_information[0]}`);
    }
    return {
      content: lines.join("\n"),
      followups: DEFAULT_SUGGESTED_QUESTIONS.slice(0, 3),
    };
  }

  if (session.sources.length === 0) {
    return {
      content: `No social sources have been collected yet for ${companyName} (${ticker}) in this temporary session. Official connectors that require credentials or manual import are marked accordingly in the Source Collection Panel. Paste a Telegram message or authorized YouTube transcript to analyze claims and ask evidence-backed questions.`,
      followups: [
        "What information cannot be verified?",
        "Which sources are currently connected?",
      ],
    };
  }

  const lines: string[] = [];

  if (/\b(bull|positive|upside|optimis)\b/i.test(lower)) {
    if (overview.bullish_arguments.length === 0) {
      lines.push(
        `No explicitly bullish claims were identified across the ${session.sources.length} collected source(s) for ${companyName} (${ticker}).`
      );
    } else {
      lines.push(
        `Across the collected social sources for ${companyName} (${ticker}), ${overview.bullish_arguments.length} source(s) present upward/bullish claims (treated strictly as unverified creator opinions, not facts):`
      );
      for (const arg of overview.bullish_arguments.slice(0, 3)) {
        lines.push(`• ${arg.summary}`);
      }
    }
  } else if (/\b(bear|negative|downside|risk|concern|against)\b/i.test(lower)) {
    if (overview.bearish_arguments.length === 0) {
      lines.push(
        `No explicitly bearish arguments were found among the ${session.sources.length} collected source(s) for ${companyName} (${ticker}). That absence of dissenting posts is itself a gap worth noting.`
      );
    } else {
      lines.push(
        `Collected sources highlighting cautionary or bearish claims for ${companyName} (${ticker}):`
      );
      for (const arg of overview.bearish_arguments.slice(0, 3)) {
        lines.push(`• ${arg.summary}`);
      }
    }
  } else if (/\b(contradict\w*|conflict\w*|disagree\w*|both\s+sides)\b/i.test(lower)) {
    if (overview.contradictory_claims.length === 0) {
      lines.push(
        `No direct contradictions were detected across the ${session.sources.length} collected source(s) for ${companyName} (${ticker}). Import additional viewpoints to compare conflicting claims.`
      );
    } else {
      lines.push(`Detected contradictory claims for ${companyName} (${ticker}):`);
      for (const c of overview.contradictory_claims) {
        lines.push(`• ${c.topic}: ${c.side_a_summary} Meanwhile, ${c.side_b_summary}`);
      }
    }
  } else if (/\b(hype|promis|urgenc|similar|disclos|sponsor)\b/i.test(lower)) {
    lines.push(
      `Language & disclosure audit across ${session.sources.length} source(s) for ${companyName} (${ticker}): ${overview.sponsorship_disclosure_indicators.summary}`
    );
    if (overview.hype_and_urgency_phrases.length > 0) {
      const samplePhrases = overview.hype_and_urgency_phrases
        .slice(0, 4)
        .map((h) => `"${h.phrase}" (${h.citation_key})`)
        .join(", ");
      lines.push(
        `Urgency or promotional phrasing observed as descriptive text evidence: ${samplePhrases}.`
      );
    } else {
      lines.push(`No urgency or certainty hype phrases were flagged in the inspected excerpts.`);
    }
  } else if (/\b(verif|missing|gap|cannot|evidence|support)\b/i.test(lower)) {
    lines.push(
      `Evidence boundary for ${companyName} (${ticker}): social posts are claims and opinions, not verified market facts.`
    );
    if (overview.unverified_claims.length > 0) {
      lines.push(
        `Unverified claims noted: ${overview.unverified_claims
          .slice(0, 3)
          .map((u) => `${u.statement} (${u.citation_key})`)
          .join("; ")}.`
      );
    }
    if (overview.missing_information.length > 0) {
      lines.push(`Key missing information: ${overview.missing_information.slice(0, 3).join(" ")}`);
    }
  } else {
    // General overview question (e.g. "Why are people talking about this stock?")
    lines.push(
      `In this session for ${companyName} (${ticker}), ${session.sources.length} source(s) were inspected (${overview.real_source_count} official API/RSS, ${overview.user_submitted_count} user-imported, ${overview.curated_demo_count} curated demo).`
    );
    for (const src of retrieved.slice(0, 3)) {
      lines.push(
        `• [${src.citation_key}] ${src.creator_name ?? src.platform} (${src.platform}): "${src.title}".`
      );
    }
    if (overview.missing_information.length > 0) {
      lines.push(`Information gaps: ${overview.missing_information[0]}`);
    }
  }

  return {
    content: lines.join("\n"),
    followups: DEFAULT_SUGGESTED_QUESTIONS.filter(
      (q) => q.toLowerCase() !== question.trim().toLowerCase()
    ).slice(0, 3),
  };
}

async function callGroundedLlm(params: {
  question: string;
  session: ResearchSession;
  retrieved: ResearchSourceItem[];
  language: "en-IN" | "hi-IN" | "kn-IN";
  config: AppEnv;
  fetchImpl: typeof fetch;
}): Promise<string | null> {
  const { config, question, session, retrieved, language, fetchImpl } = params;
  if (!config.LLM_API_KEY || config.LLM_PROVIDER === "disabled") return null;
  if (config.LLM_PROVIDER !== "gemini" && config.LLM_PROVIDER !== "groq") return null;

  const languageDirective =
    language === "hi-IN"
      ? "Respond naturally in clear Hindi (Devanagari) suitable for spoken voice readout."
      : language === "kn-IN"
        ? "Respond naturally in clear Kannada (ಕನ್ನಡ) suitable for spoken voice readout."
        : "Respond naturally in clear, concise Indian English suitable for spoken voice readout.";

  const evidenceContext = retrieved
    .map(
      (s) =>
        `[${s.citation_key}] Platform=${s.platform} | Provenance=${s.data_label} | Creator=${
          s.creator_name ?? "Unknown"
        } | Direction=${s.direction ?? "Not stated"} | Disclosure=${
          s.disclosure_grade
        } | Title="${s.title}" | Excerpt="${s.excerpt.slice(0, 300)}"`
    )
    .join("\n");

  const systemPrompt = `You are Tip Autopsy's Social Signal Intelligence research assistant.
NON-NEGOTIABLE RULES:
1. We grade the information, not the investment.
2. NEVER recommend buying, selling, holding, avoiding, entering, or exiting any stock.
3. NEVER use the words "buy", "sell", "hold", "avoid", "target", "undervalued", "overvalued", "will rise", "will fall", "scammer", or "fraud" in your own prose (or their Hindi/Kannada equivalents).
4. Clearly distinguish verified market facts from unverified social-media claims and opinions.
5. Cite ONLY the provided session sources using [S1], [S2], etc. Never invent sources or statistics.
6. Keep answers concise (3-5 sentences), calm, neutral, and factual.
7. ${languageDirective}`;

  const userPrompt = `Stock: ${session.company_name} (${session.ticker}, ${session.exchange})
Market context: price=${session.stock_context.latest_price ?? "Could not verify"}, as_of=${session.stock_context.as_of_date ?? "N/A"}
Missing info: ${session.overview.missing_information.join("; ") || "None"}

COLLECTED SOURCES:
${evidenceContext || "No sources collected yet."}

USER QUESTION:
${question}`;

  try {
    if (config.LLM_PROVIDER === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        config.LLM_API_KEY
      )}`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 420 },
        }),
        signal: AbortSignal.timeout(CHAT_LLM_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    }

    if (config.LLM_PROVIDER === "groq") {
      const res = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          max_tokens: 420,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(CHAT_LLM_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content?.trim() ?? null;
    }
  } catch (err) {
    logWarn("research_chat.llm_fallback", {
      provider: config.LLM_PROVIDER,
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
  return null;
}

export async function generateGroundedChatResponse(params: {
  question: string;
  session: ResearchSession;
  config: AppEnv;
  language?: "en-IN" | "hi-IN" | "kn-IN";
  fetchImpl?: typeof fetch;
  /** Test-only hook to verify Output Guard enforcement on adversarial candidate answers */
  injectedCandidateText?: string;
}): Promise<{
  assistantMessage: ResearchChatMessage;
  mandatoryDisclaimer: string;
}> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const language = params.language ?? "en-IN";
  const retrieved = retrieveRelevantSources(params.question, params.session.sources, 5);
  const citations = buildCitations(retrieved);
  const breakdown = buildEvidenceBreakdown(params.session, retrieved);

  let candidateContent = params.injectedCandidateText ?? null;
  let followups = DEFAULT_SUGGESTED_QUESTIONS.filter(
    (q) => q.toLowerCase() !== params.question.trim().toLowerCase()
  ).slice(0, 3);

  if (!candidateContent) {
    candidateContent = await callGroundedLlm({
      question: params.question,
      session: params.session,
      retrieved,
      language,
      config: params.config,
      fetchImpl,
    });
  }

  if (!candidateContent) {
    const deterministic = synthesizeDeterministicRagAnswer(
      params.question,
      params.session,
      retrieved,
      language
    );
    candidateContent = deterministic.content;
    followups = deterministic.followups;
  }

  // Mandatory deterministic Output Guard check on every generated chat response
  const guardScan = scanSystemAuthoredText(candidateContent);
  const guardStatus: "PASSED" | "BLOCKED_FALLBACK" = guardScan.passed
    ? "PASSED"
    : "BLOCKED_FALLBACK";

  const finalContent = guardScan.passed ? candidateContent : SAFE_CHAT_FALLBACK;

  const assistantMessage: ResearchChatMessage = {
    id: `msg_${randomUUID().slice(0, 10)}`,
    role: "assistant",
    content: finalContent,
    created_at: new Date().toISOString(),
    citations,
    evidence_breakdown: breakdown,
    guard_status: guardStatus,
    suggested_followups: followups,
  };

  return {
    assistantMessage,
    mandatoryDisclaimer: MANDATORY_DISCLAIMER,
  };
}
