import { AppError } from "../core/errors.js";
import { logWarn } from "../core/logger.js";
import { withBoundedTimeout } from "../core/snapshotCache.js";
import { scanSystemAuthoredText } from "../domain/output-guard/guard.js";

export type SupportedVoiceLanguage = "en-IN" | "hi-IN" | "kn-IN";

export interface VoiceReadoutResult {
  status: "READY" | "DISABLED" | "UNAVAILABLE";
  language: SupportedVoiceLanguage;
  audio_base64: string | null;
  mime_type: string | null;
  guard_verified: true;
  message: string;
}

export interface VoiceSttResult {
  status: "READY" | "DISABLED" | "UNAVAILABLE";
  language: SupportedVoiceLanguage;
  transcript: string | null;
  message: string;
}

const MAX_VOICE_CHARS = 1_500;
const VOICE_TIMEOUT_MS = 12_000;

function normalizeForSpeech(raw: string): string {
  return raw
    .replace(/\[S\d+\]/g, "")
    .replace(/[•*#`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_VOICE_CHARS);
}

/**
 * Sarvam Voice TTS adapter (`bulbul:v3`, English / Hindi / Kannada).
 * Safety invariants:
 * 1. Re-scans text with the mandatory Output Guard before any external call.
 * 2. Never invents new facts or advice; reads only already-guarded evidence text.
 * 3. Disabled or failed provider never blocks the core text experience.
 */
export async function synthesizeGuardedVoiceReadout(params: {
  guardedText: string;
  language: SupportedVoiceLanguage;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<VoiceReadoutResult> {
  const rawTrimmed = params.guardedText.trim().slice(0, MAX_VOICE_CHARS);
  if (!rawTrimmed) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Guarded summary text is required for voice readout.",
      statusCode: 400,
      retryable: false,
    });
  }

  // Defense-in-depth: re-verify text through Output Guard so voice can never emit advice
  const scan = scanSystemAuthoredText(rawTrimmed);
  if (!scan.passed) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message:
        "Voice readout blocked by Output Guard: only guarded, non-advisory evidence text may be synthesized.",
      statusCode: 422,
      retryable: false,
    });
  }

  if (!params.apiKey) {
    return {
      status: "DISABLED",
      language: params.language,
      audio_base64: null,
      mime_type: null,
      guard_verified: true,
      message:
        "Sarvam TTS is currently disabled (SARVAM_API_KEY not configured in backend/.env). Read the guarded text response above.",
    };
  }

  const speechSafeText = normalizeForSpeech(rawTrimmed);
  const doFetch = params.fetchImpl ?? fetch;

  try {
    const response = await withBoundedTimeout(
      doFetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": params.apiKey,
        },
        body: JSON.stringify({
          text: speechSafeText,
          target_language_code: params.language,
          speaker: "kavya",
          model: "bulbul:v3",
          pace: 1.0,
          enable_preprocessing: true,
          output_audio_codec: "wav",
        }),
      }),
      VOICE_TIMEOUT_MS,
      "sarvam_tts"
    );

    if (!response.ok) {
      logWarn("voice.provider_http_error", {
        status_code: response.status,
        language: params.language,
      });
      return {
        status: "UNAVAILABLE",
        language: params.language,
        audio_base64: null,
        mime_type: null,
        guard_verified: true,
        message:
          "Voice provider returned an error. The guarded text facts card remains available.",
      };
    }

    const payload = (await response.json()) as { audios?: string[] };
    const firstAudio = payload.audios?.[0];
    if (!firstAudio) {
      return {
        status: "UNAVAILABLE",
        language: params.language,
        audio_base64: null,
        mime_type: null,
        guard_verified: true,
        message: "Voice provider returned an empty audio stream. Use the text facts card.",
      };
    }

    return {
      status: "READY",
      language: params.language,
      audio_base64: firstAudio,
      mime_type: "audio/wav",
      guard_verified: true,
      message: `Guarded voice summary generated in ${params.language}.`,
    };
  } catch {
    logWarn("voice.provider_unavailable", { language: params.language });
    return {
      status: "UNAVAILABLE",
      language: params.language,
      audio_base64: null,
      mime_type: null,
      guard_verified: true,
      message:
        "Voice provider timed out or was unreachable. Core text analysis is unaffected.",
    };
  }
}

/**
 * Sarvam Speech-to-Text adapter (`saaras:v4`, English / Hindi / Kannada).
 * Audio buffers remain strictly in RAM and are never persisted to disk, DB, or logs.
 */
export async function transcribeAudioWithSarvam(params: {
  audioBuffer: Buffer;
  mimeType: string;
  language: SupportedVoiceLanguage;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<VoiceSttResult> {
  if (!params.audioBuffer || params.audioBuffer.length < 16) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Recorded audio clip is empty. Please speak and try again.",
      statusCode: 400,
      retryable: false,
    });
  }

  if (!params.apiKey) {
    return {
      status: "DISABLED",
      language: params.language,
      transcript: null,
      message:
        "Sarvam STT is currently disabled (SARVAM_API_KEY not configured in backend/.env). Type your question instead.",
    };
  }

  const cleanMime = params.mimeType.split(";")[0]?.trim() || "audio/webm";
  const ext = cleanMime.includes("mp4") || cleanMime.includes("m4a")
    ? "m4a"
    : cleanMime.includes("ogg")
      ? "ogg"
      : cleanMime.includes("wav")
        ? "wav"
        : cleanMime.includes("mpeg") || cleanMime.includes("mp3")
          ? "mp3"
          : "webm";

  const form = new FormData();
  const blob = new Blob([new Uint8Array(params.audioBuffer)], { type: cleanMime });
  form.append("file", blob, `voice-query.${ext}`);
  form.append("model", "saaras:v4");
  form.append("mode", "transcribe");
  form.append("language_code", params.language);

  const doFetch = params.fetchImpl ?? fetch;

  try {
    const response = await withBoundedTimeout(
      doFetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: {
          "api-subscription-key": params.apiKey,
        },
        body: form,
      }),
      VOICE_TIMEOUT_MS,
      "sarvam_stt"
    );

    if (!response.ok) {
      logWarn("voice.stt_http_error", {
        status_code: response.status,
        language: params.language,
      });
      return {
        status: "UNAVAILABLE",
        language: params.language,
        transcript: null,
        message: "Sarvam STT returned an error. Try speaking again or use text chat.",
      };
    }

    const payload = (await response.json()) as { transcript?: string };
    const transcript = (payload.transcript ?? "").trim();
    if (!transcript) {
      return {
        status: "UNAVAILABLE",
        language: params.language,
        transcript: null,
        message: "No speech was detected in the recording. Click the green blob and try again.",
      };
    }

    return {
      status: "READY",
      language: params.language,
      transcript,
      message: `Transcribed in ${params.language} via Sarvam STT.`,
    };
  } catch {
    logWarn("voice.stt_unavailable", { language: params.language });
    return {
      status: "UNAVAILABLE",
      language: params.language,
      transcript: null,
      message: "Sarvam STT timed out or was unreachable. Text chat remains available.",
    };
  }
}
