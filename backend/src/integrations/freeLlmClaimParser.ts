import { z } from "zod";
import {
  CLAIM_PARSER_VERSION,
  ClaimLedgerSchema,
  parseClaimLedgerDeterministic,
  validateSpanAgainstSource,
  type CatalogueStockCandidate,
} from "../domain/claims/parser.js";
import type { ClaimLedger, SourceSpan, TipDirection } from "../domain/types.js";
import { logWarn } from "../core/logger.js";

const FREE_LLM_TIMEOUT_MS = 10_000;
const GEMINI_VISION_OCR_TIMEOUT_MS = 12_000;

const RawVisionOcrSchema = z.object({
  extracted_text: z.string().max(4000).default(""),
});

const BOUNDED_VISION_OCR_PROMPT = `You are a strictly bounded verbatim OCR transcriber for Indian retail stock-tip screenshots (English or Hinglish).
Rules:
1. Transcribe ONLY the exact visible text in the image verbatim, preserving stock/index names, numbers, prices, dates, hashtags, disclosures, and gated stop-loss cues (such as "SL PAID", "SL. VIP PREMIUM").
2. Return ONLY a valid JSON object matching this exact schema: { "extracted_text": string }.
3. Do NOT invent missing fields, summarize, translate, calculate anything, or output investment advice or commentary.
4. If no text is legible in the image, return { "extracted_text": "" }.`;

/**
 * Bounded transient Gemini 2.5 Flash Vision OCR extractor.
 * - Accepts an in-memory image buffer (JPEG, PNG, WebP) and returns ONLY verbatim visible text.
 * - Never persists the image or logs image bytes or raw extracted user text.
 */
export async function extractTextFromPhotoWithGeminiVision(params: {
  buffer: Buffer;
  mimeType: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    params.apiKey
  )}`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: BOUNDED_VISION_OCR_PROMPT },
              {
                inlineData: {
                  mimeType: params.mimeType,
                  data: params.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(GEMINI_VISION_OCR_TIMEOUT_MS),
    });

    if (!response.ok) {
      logWarn("gemini_vision_ocr.http_error", { status: response.status });
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      logWarn("gemini_vision_ocr.empty_response", {});
      return null;
    }

    const parsedJson = JSON.parse(rawText) as unknown;
    const validated = RawVisionOcrSchema.safeParse(parsedJson);
    if (!validated.success) {
      logWarn("gemini_vision_ocr.schema_invalid", {});
      return null;
    }

    const cleaned = validated.data.extracted_text.trim();
    return cleaned.length > 0 ? cleaned : null;
  } catch (err) {
    logWarn("gemini_vision_ocr.fallback_triggered", {
      reason: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

const RawLlmExtractionSchema = z.object({
  stock: z.string().nullable().optional(),
  stock_quote: z.string().nullable().optional(),
  direction: z.enum(["BULLISH", "BEARISH", "NEUTRAL"]).nullable().optional(),
  direction_quote: z.string().nullable().optional(),
  target_price: z.number().positive().nullable().optional(),
  target_quote: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  deadline_quote: z.string().nullable().optional(),
  stop_loss: z.number().positive().nullable().optional(),
  stop_loss_gated: z.boolean().optional(),
  stop_loss_quote: z.string().nullable().optional(),
});

const BOUNDED_EXTRACTION_PROMPT = `You are a strictly bounded structured claim extractor for Indian retail stock tips (English or Hinglish).
Rules:
1. Extract ONLY what is explicitly stated in the provided source text. NEVER invent, guess, or recommend a target price, stop-loss, deadline, or action.
2. Return ONLY a valid JSON object matching this exact schema:
{
  "stock": string | null,
  "stock_quote": exact verbatim substring from source text | null,
  "direction": "BULLISH" | "BEARISH" | "NEUTRAL" | null,
  "direction_quote": exact verbatim substring | null,
  "target_price": positive number | null,
  "target_quote": exact verbatim substring | null,
  "deadline": string | null,
  "deadline_quote": exact verbatim substring | null,
  "stop_loss": positive number | null,
  "stop_loss_gated": boolean,
  "stop_loss_quote": exact verbatim substring | null
}
3. If stop-loss is gated behind a paid/VIP tier (e.g. "SL PAID", "SL VIP"), set stop_loss to null and stop_loss_gated to true.
4. Do NOT output investment advice, ratings, SEBI conclusions, or commentary.`;

function findGroundedSpan(sourceText: string, quote: string | null | undefined): SourceSpan | null {
  if (!quote || !quote.trim()) return null;
  const trimmed = quote.trim();
  const idx = sourceText.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx < 0) return null;
  return validateSpanAgainstSource(sourceText, {
    start: idx,
    end: idx + trimmed.length,
    text: sourceText.slice(idx, idx + trimmed.length),
  });
}

async function callGeminiFreeTier(
  sourceText: string,
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${BOUNDED_EXTRACTION_PROMPT}\n\nSOURCE TEXT:\n"""\n${sourceText.slice(0, 3500)}\n"""`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(FREE_LLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini returned empty response");
  return JSON.parse(rawText);
}

async function callGroqFreeTier(
  sourceText: string,
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const response = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BOUNDED_EXTRACTION_PROMPT },
        { role: "user", content: sourceText.slice(0, 3500) },
      ],
    }),
    signal: AbortSignal.timeout(FREE_LLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("Groq returned empty response");
  return JSON.parse(rawText);
}

export interface BoundedAiParseResult {
  claims: ClaimLedger;
  engine: "FREE_LLM_GEMINI" | "FREE_LLM_GROQ" | "DETERMINISTIC_FALLBACK";
  parserVersion: string;
  note: string | null;
}

/**
 * Runs free-tier bounded AI Claim Ledger extraction (Gemini or Groq) when configured,
 * verifying every extracted field against Zod and verbatim source spans, and falling back
 * deterministically whenever the provider is disabled, unavailable, or returns invalid spans.
 */
export async function parseClaimLedgerWithFreeAiFallback(params: {
  sourceText: string;
  catalogue: CatalogueStockCandidate[];
  userEnteredStock?: string;
  llmProvider: string;
  llmApiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<BoundedAiParseResult> {
  const deterministic = parseClaimLedgerDeterministic({
    sourceText: params.sourceText,
    catalogue: params.catalogue,
    userEnteredStock: params.userEnteredStock,
  });

  const provider = params.llmProvider.toLowerCase();
  if (
    !params.sourceText.trim() ||
    !params.llmApiKey ||
    (provider !== "gemini" && provider !== "groq")
  ) {
    return {
      claims: deterministic,
      engine: "DETERMINISTIC_FALLBACK",
      parserVersion: CLAIM_PARSER_VERSION,
      note: null,
    };
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const rawObj =
      provider === "gemini"
        ? await callGeminiFreeTier(params.sourceText, params.llmApiKey, fetchImpl)
        : await callGroqFreeTier(params.sourceText, params.llmApiKey, fetchImpl);

    const parsed = RawLlmExtractionSchema.safeParse(rawObj);
    if (!parsed.success) {
      throw new Error("LLM payload failed Zod claim schema validation");
    }

    const ai = parsed.data;
    const stockSpan = findGroundedSpan(params.sourceText, ai.stock_quote);
    const dirSpan = findGroundedSpan(params.sourceText, ai.direction_quote);
    const tgtSpan = findGroundedSpan(params.sourceText, ai.target_quote);
    const deadSpan = findGroundedSpan(params.sourceText, ai.deadline_quote);
    const slSpan = findGroundedSpan(params.sourceText, ai.stop_loss_quote);

    // Only accept AI fields that are grounded verbatim in sourceText; otherwise retain deterministic/NOT_STATED
    const merged: ClaimLedger = {
      stock:
        deterministic.stock.status === "EXTRACTED"
          ? deterministic.stock
          : ai.stock && stockSpan
            ? {
                value: ai.stock.trim(),
                status: "EXTRACTED",
                evidence: stockSpan,
              }
            : deterministic.stock,
      direction:
        deterministic.direction.status === "EXTRACTED"
          ? deterministic.direction
          : ai.direction && dirSpan
            ? {
                value: ai.direction as TipDirection,
                status: "EXTRACTED",
                evidence: dirSpan,
              }
            : deterministic.direction,
      target_price:
        deterministic.target_price.status === "EXTRACTED"
          ? deterministic.target_price
          : typeof ai.target_price === "number" && tgtSpan
            ? {
                value: ai.target_price,
                status: "EXTRACTED",
                note: "Creator's claimed target price only; not an application conclusion.",
                evidence: tgtSpan,
              }
            : deterministic.target_price,
      deadline:
        deterministic.deadline.status === "EXTRACTED"
          ? deterministic.deadline
          : ai.deadline && deadSpan
            ? {
                value: ai.deadline.trim(),
                status: "EXTRACTED",
                evidence: deadSpan,
              }
            : deterministic.deadline,
      stop_loss:
        deterministic.stop_loss.status === "EXTRACTED" || deterministic.stop_loss.gated
          ? deterministic.stop_loss
          : ai.stop_loss_gated && slSpan
            ? {
                value: null,
                status: "NOT_STATED",
                gated: true,
                note: "Stop-loss is gated behind a paid/VIP tier rather than stated openly.",
                evidence: slSpan,
              }
            : typeof ai.stop_loss === "number" && slSpan
              ? {
                  value: ai.stop_loss,
                  status: "EXTRACTED",
                  gated: false,
                  evidence: slSpan,
                }
              : deterministic.stop_loss,
    };

    return {
      claims: ClaimLedgerSchema.parse(merged),
      engine: provider === "gemini" ? "FREE_LLM_GEMINI" : "FREE_LLM_GROQ",
      parserVersion: `${CLAIM_PARSER_VERSION}+${provider}`,
      note: "Bounded free-tier AI assisted Claim Ledger extraction with verbatim source-span validation.",
    };
  } catch (err) {
    logWarn("free_llm_parser.fallback_triggered", {
      provider,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return {
      claims: deterministic,
      engine: "DETERMINISTIC_FALLBACK",
      parserVersion: CLAIM_PARSER_VERSION,
      note: "Free-tier AI parser unavailable; used deterministic Hinglish Claim Ledger parser.",
    };
  }
}
