import { Microphone, Sparkle, Waveform } from "@phosphor-icons/react";
import "./VoiceAssistantOrb.css";

export type VoiceAssistantPhase = "idle" | "listening" | "thinking" | "speaking";

export interface VoiceAssistantOrbProps {
  phase: VoiceAssistantPhase;
  /** Normalized 0..1 audio amplitude from microphone or talking envelope */
  audioLevel: number;
  languageLabel: string;
  onPress: () => void;
}

const BAR_WEIGHTS = [0.52, 0.86, 1, 0.78, 0.48];

export function VoiceAssistantOrb({
  phase,
  audioLevel,
  languageLabel,
  onPress,
}: VoiceAssistantOrbProps) {
  const clamped = Math.max(0, Math.min(1, audioLevel));
  const dynamicScale =
    phase === "listening"
      ? 1.04 + clamped * 0.22
      : phase === "speaking"
        ? 1.03 + clamped * 0.18
        : 1;

  const ariaLabel =
    phase === "listening"
      ? `AI is listening while you speak in ${languageLabel}. Tap to finish speaking.`
      : phase === "speaking"
        ? `AI is speaking in ${languageLabel}. Tap to interrupt and speak.`
        : phase === "thinking"
          ? "AI is working: checking evidence and generating Sarvam voice."
          : `Tap green blob to speak in ${languageLabel}.`;

  const stateCaption =
    phase === "listening"
      ? "Speak now · Click blob when done"
      : phase === "thinking"
        ? "AI is working…"
        : phase === "speaking"
          ? "AI speaking · Tap to interrupt"
          : "Tap to speak";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className={`voice-orb-stage voice-orb-stage--${phase}`}
        data-testid="voice-assistant-orb"
        data-phase={phase}
      >
        <span
          className="voice-orb-halo"
          style={{ transform: `scale(${1 + clamped * 0.28})` }}
          aria-hidden="true"
        />
        <span className="voice-orb-ring" aria-hidden="true" />
        <span className="voice-orb-ring voice-orb-ring--delayed" aria-hidden="true" />
        {phase === "thinking" && <span className="voice-orb-orbit" aria-hidden="true" />}

        <button
          type="button"
          onClick={onPress}
          aria-label={ariaLabel}
          className="voice-orb-button"
        >
          <span
            className="voice-orb-blob"
            style={{ transform: `scale(${dynamicScale.toFixed(3)})` }}
            aria-hidden="true"
          >
            <span className="voice-orb-blob-inner" />
            <span className="voice-orb-specular" />
            <span className="voice-orb-center">
              {phase === "listening" ? (
                <span className="voice-orb-bars" aria-hidden="true">
                  {BAR_WEIGHTS.map((weight, idx) => {
                    const heightPct = Math.round(
                      28 + Math.min(1, clamped * 1.25 + 0.15) * weight * 72
                    );
                    return (
                      <span
                        key={idx}
                        className="voice-orb-bar"
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </span>
              ) : phase === "speaking" ? (
                <Waveform size={38} weight="duotone" />
              ) : phase === "thinking" ? (
                <Sparkle size={34} weight="duotone" />
              ) : (
                <Microphone size={34} weight="duotone" />
              )}
            </span>
          </span>
        </button>
      </div>

      <span
        data-testid="voice-orb-caption"
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ${
          phase === "listening"
            ? "bg-[#1F4D3A] text-white"
            : phase === "thinking"
              ? "bg-[#E6F2EC] text-[#1F4D3A]"
              : phase === "speaking"
                ? "bg-[#2A6F52] text-white"
                : "bg-white/85 text-[#4A524D]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            phase === "listening"
              ? "animate-pulse bg-[#B8D8C8]"
              : phase === "thinking"
                ? "animate-ping bg-[#4A7C64]"
                : phase === "speaking"
                  ? "animate-pulse bg-white"
                  : "bg-[#6E7771]"
          }`}
          aria-hidden="true"
        />
        <span>{stateCaption}</span>
      </span>
    </div>
  );
}

export default VoiceAssistantOrb;
