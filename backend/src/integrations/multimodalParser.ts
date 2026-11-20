import { AppError } from "../core/errors.js";
import { CLAIM_PARSER_VERSION, parseClaimLedgerDeterministic } from "../domain/claims/parser.js";
import { classifyDisclosure } from "../domain/disclosure/classifier.js";
import { detectHypePhrases } from "../domain/hype/detector.js";
import type { ClaimLedger, DisclosureGradeResult, HypeFlag } from "../domain/types.js";
import type { DemoCaseMeta, StockRecord } from "../ingestion/demoCorpus.js";
import { extractTextFromPhotoWithGeminiVision } from "./freeLlmClaimParser.js";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

export type ValidatedMediaKind = "PHOTO" | "VIDEO";

/**
 * Verifies uploaded media strictly by magic bytes (never trusting filename extensions alone).
 */
export function detectMediaMagicBytes(buffer: Buffer): {
  kind: ValidatedMediaKind;
  detectedMime: string;
} | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: "PHOTO", detectedMime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { kind: "PHOTO", detectedMime: "image/png" };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { kind: "PHOTO", detectedMime: "image/webp" };
  }

  // MP4 / QuickTime MOV: offset 4..8 == "ftyp"
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return { kind: "VIDEO", detectedMime: "video/mp4" };
  }

  // WebM / Matroska: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { kind: "VIDEO", detectedMime: "video/webm" };
  }

  return null;
}

export interface MultimodalParseOutput {
  extracted_text: string;
  media_intake: {
    received: boolean;
    kind: ValidatedMediaKind | null;
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

/**
 * Bounded transient multimodal + Claim Ledger parser.
 * - Validates magic bytes and size caps for uploaded photos/videos.
 * - Zero-fills ephemeral buffers immediately in finally{} (never written to disk/DB).
 * - Never infers SEBI registration or stock identity from arbitrary uploaded filenames.
 * - Falls back cleanly to user-entered influencer + stock lookup when cloud OCR/ASR/LLM is disabled.
 */
export function runBoundedMultimodalParse(params: {
  text?: string;
  influencerName?: string;
  stockName?: string;
  demoCaseId?: string;
  file?: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
  catalogue: StockRecord[];
  demoCases: DemoCaseMeta[];
  llmProvider: string;
}): MultimodalParseOutput {
  const { file, catalogue, demoCases } = params;
  let mediaKind: ValidatedMediaKind | null = null;
  let detectedMime: string | null = null;
  let byteLength = 0;

  try {
    if (file) {
      byteLength = file.buffer.length;
      const detected = detectMediaMagicBytes(file.buffer);
      if (!detected) {
        throw new AppError({
          code: "UNSUPPORTED_MEDIA_TYPE",
          message:
            "Unsupported or corrupted media file. Upload a valid JPEG, PNG, WebP photo or MP4, WebM, MOV video.",
          statusCode: 415,
          retryable: false,
        });
      }
      if (detected.kind === "PHOTO" && byteLength > MAX_IMAGE_BYTES) {
        throw new AppError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Uploaded photo exceeds the 8 MB limit.",
          statusCode: 413,
          retryable: false,
        });
      }
      if (detected.kind === "VIDEO" && byteLength > MAX_VIDEO_BYTES) {
        throw new AppError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Uploaded video exceeds the 25 MB limit.",
          statusCode: 413,
          retryable: false,
        });
      }
      mediaKind = detected.kind;
      detectedMime = detected.detectedMime;
    }

    // Resolve source text: explicit pasted text OR explicitly selected curated demo transcript
    let sourceText = (params.text ?? "").trim();
    let extractionMode: MultimodalParseOutput["media_intake"]["extraction_mode"] = "TEXT_ONLY";
    let mediaNotice: string | null = null;
    let parserStatus: MultimodalParseOutput["parser"]["status"] = "COMPLETED";
    let parserNote: string | null = null;

    if (!sourceText && params.demoCaseId) {
      const matchedDemo = demoCases.find((d) => d.id === params.demoCaseId);
      if (matchedDemo) {
        sourceText = matchedDemo.sample_text;
        extractionMode = "CURATED_DEMO_TRANSCRIPT";
        mediaKind = matchedDemo.media_type;
        mediaNotice =
          "Loaded curated demo transcript/OCR text for this preloaded corpus asset. SEBI and market checks remain deterministic.";
      }
    } else if (file && !sourceText) {
      // Cloud OCR/ASR is disabled or unavailable -> graceful fallback without blocking lookup!
      extractionMode = "PROVIDER_UNAVAILABLE_FALLBACK";
      parserStatus = "FALLBACK_STRUCTURED_ONLY";
      mediaNotice =
        params.llmProvider === "disabled"
          ? "Media verified in memory and discarded immediately. Cloud OCR/ASR extraction is disabled in this environment — edit or paste visible text below, or continue directly with your entered influencer and stock names."
          : "Media extraction provider unavailable — continuing with your entered influencer and stock names.";
      parserNote = "Structured influencer + stock lookup remains fully available.";
    }

    const claims = parseClaimLedgerDeterministic({
      sourceText,
      catalogue: catalogue.map((s) => ({
        ticker: s.ticker,
        company_name: s.company_name,
        aliases: s.aliases,
      })),
      userEnteredStock: params.stockName,
    });

    const hype = detectHypePhrases(sourceText);
    const disclosure = classifyDisclosure(sourceText);

    return {
      extracted_text: sourceText,
      media_intake: {
        received: Boolean(file),
        kind: mediaKind,
        detected_mime: detectedMime,
        byte_length: byteLength,
        persisted: false,
        extraction_mode: extractionMode,
        notice: mediaNotice,
      },
      claims,
      hype_flags: hype.flags,
      hype_dictionary_version: hype.dictionary_version,
      disclosure_grade: disclosure,
      parser: {
        status: parserStatus,
        version: CLAIM_PARSER_VERSION,
        note: parserNote,
      },
    };
  } finally {
    // Discard transient uploaded media bytes immediately — never persist to disk, DB, or logs
    if (file?.buffer && Buffer.isBuffer(file.buffer)) {
      file.buffer.fill(0);
    }
  }
}

/**
 * Async variant of the bounded multimodal parser that performs transient in-memory
 * Gemini 2.5 Flash Vision OCR on uploaded photos (JPEG/PNG/WebP) when configured,
 * then unconditionally zeroes the buffer in finally{} and feeds verbatim text into
 * the deterministic Claim Ledger, Hype Detector, and Disclosure Grader.
 */
export async function runBoundedMultimodalParseAsync(params: {
  text?: string;
  influencerName?: string;
  stockName?: string;
  demoCaseId?: string;
  file?: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
  catalogue: StockRecord[];
  demoCases: DemoCaseMeta[];
  llmProvider: string;
  llmApiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<MultimodalParseOutput> {
  const { file, catalogue, demoCases } = params;
  let mediaKind: ValidatedMediaKind | null = null;
  let detectedMime: string | null = null;
  let byteLength = 0;

  try {
    if (file) {
      byteLength = file.buffer.length;
      const detected = detectMediaMagicBytes(file.buffer);
      if (!detected) {
        throw new AppError({
          code: "UNSUPPORTED_MEDIA_TYPE",
          message:
            "Unsupported or corrupted media file. Upload a valid JPEG, PNG, WebP photo or MP4, WebM, MOV video.",
          statusCode: 415,
          retryable: false,
        });
      }
      if (detected.kind === "PHOTO" && byteLength > MAX_IMAGE_BYTES) {
        throw new AppError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Uploaded photo exceeds the 8 MB limit.",
          statusCode: 413,
          retryable: false,
        });
      }
      if (detected.kind === "VIDEO" && byteLength > MAX_VIDEO_BYTES) {
        throw new AppError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Uploaded video exceeds the 25 MB limit.",
          statusCode: 413,
          retryable: false,
        });
      }
      mediaKind = detected.kind;
      detectedMime = detected.detectedMime;
    }

    let sourceText = (params.text ?? "").trim();
    let extractionMode: MultimodalParseOutput["media_intake"]["extraction_mode"] = "TEXT_ONLY";
    let mediaNotice: string | null = null;
    let parserStatus: MultimodalParseOutput["parser"]["status"] = "COMPLETED";
    let parserNote: string | null = null;

    if (!sourceText && params.demoCaseId) {
      const matchedDemo = demoCases.find((d) => d.id === params.demoCaseId);
      if (matchedDemo) {
        sourceText = matchedDemo.sample_text;
        extractionMode = "CURATED_DEMO_TRANSCRIPT";
        mediaKind = matchedDemo.media_type;
        mediaNotice =
          "Loaded curated demo transcript/OCR text for this preloaded corpus asset. SEBI and market checks remain deterministic.";
      }
    } else if (
      file &&
      !sourceText &&
      mediaKind === "PHOTO" &&
      detectedMime &&
      params.llmProvider.toLowerCase() === "gemini" &&
      params.llmApiKey
    ) {
      const ocrText = await extractTextFromPhotoWithGeminiVision({
        buffer: file.buffer,
        mimeType: detectedMime,
        apiKey: params.llmApiKey,
        fetchImpl: params.fetchImpl,
      });

      if (ocrText) {
        sourceText = ocrText;
        extractionMode = "GEMINI_VISION_OCR";
        parserStatus = "COMPLETED";
        mediaNotice =
          "Screenshot text extracted transiently in memory via Gemini Vision OCR. Uploaded image bytes were discarded immediately and never stored.";
        parserNote = "Verbatim OCR text parsed through deterministic Claim Ledger and source-span checks.";
      } else {
        extractionMode = "PROVIDER_UNAVAILABLE_FALLBACK";
        parserStatus = "FALLBACK_STRUCTURED_ONLY";
        mediaNotice =
          "Media verified in memory and discarded immediately. Screenshot OCR returned no legible text or provider was unavailable — edit or paste visible text below, or continue directly with your entered influencer and stock names.";
        parserNote = "Structured influencer + stock lookup remains fully available.";
      }
    } else if (file && !sourceText) {
      extractionMode = "PROVIDER_UNAVAILABLE_FALLBACK";
      parserStatus = "FALLBACK_STRUCTURED_ONLY";
      mediaNotice =
        params.llmProvider === "disabled"
          ? "Media verified in memory and discarded immediately. Cloud OCR/ASR extraction is disabled in this environment — edit or paste visible text below, or continue directly with your entered influencer and stock names."
          : mediaKind === "VIDEO"
            ? "Video verified in memory and discarded immediately. Automated video ASR is unavailable — paste the spoken/caption text below, or continue directly with your entered influencer and stock names."
            : "Media extraction provider unavailable — continuing with your entered influencer and stock names.";
      parserNote = "Structured influencer + stock lookup remains fully available.";
    }

    const claims = parseClaimLedgerDeterministic({
      sourceText,
      catalogue: catalogue.map((s) => ({
        ticker: s.ticker,
        company_name: s.company_name,
        aliases: s.aliases,
      })),
      userEnteredStock: params.stockName,
    });

    const hype = detectHypePhrases(sourceText);
    const disclosure = classifyDisclosure(sourceText);

    return {
      extracted_text: sourceText,
      media_intake: {
        received: Boolean(file),
        kind: mediaKind,
        detected_mime: detectedMime,
        byte_length: byteLength,
        persisted: false,
        extraction_mode: extractionMode,
        notice: mediaNotice,
      },
      claims,
      hype_flags: hype.flags,
      hype_dictionary_version: hype.dictionary_version,
      disclosure_grade: disclosure,
      parser: {
        status: parserStatus,
        version: CLAIM_PARSER_VERSION,
        note: parserNote,
      },
    };
  } finally {
    // Discard transient uploaded media bytes immediately — never persist to disk, DB, or logs
    if (file?.buffer && Buffer.isBuffer(file.buffer)) {
      file.buffer.fill(0);
    }
  }
}
