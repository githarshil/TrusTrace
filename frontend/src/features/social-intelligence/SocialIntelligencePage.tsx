import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOut,
  ChatCircleDots,
  CheckCircle,
  ClockCounterClockwise,
  Info,
  MagnifyingGlass,
  Microphone,
  MicrophoneSlash,
  Newspaper,
  PaperPlaneTilt,
  PlusCircle,
  RedditLogo,
  Scales,
  ShieldCheck,
  Sparkle,
  SpeakerHigh,
  StopCircle,
  TelegramLogo,
  WarningCircle,
  Waveform,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { VoiceAssistantOrb, type VoiceAssistantPhase } from "./VoiceAssistantOrb";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { ProvenancePill, type ProvenanceLabel } from "../../components/ui/ProvenancePill";
import { StatusBadge, type EvidenceTone } from "../../components/ui/StatusBadge";
import {
  createResearchSession,
  importResearchSource,
  requestResearchVoiceSession,
  searchLiveStocks,
  streamResearchChat,
  transcribeResearchVoiceAudio,
} from "../../lib/apiClient";
import { MANDATORY_DISCLAIMER } from "../../lib/constants";
import type {
  ConnectorStatus,
  LiveStockSearchItem,
  ResearchChatMessage,
  ResearchSessionResponse,
  ResearchSourceItem,
  ResearchTimeRange,
  SocialPlatform,
  SupportedVoiceLanguage,
} from "../../types/api";

const QUICK_STOCK_PRESETS: Array<{
  ticker: string;
  company_name: string;
  exchange: "NSE" | "BSE";
}> = [
  { ticker: "RELIANCE", company_name: "Reliance Industries Limited", exchange: "NSE" },
  { ticker: "WIPRO", company_name: "Wipro Limited", exchange: "NSE" },
  { ticker: "BORORENEW", company_name: "Borosil Renewables Limited", exchange: "NSE" },
  { ticker: "TCS", company_name: "Tata Consultancy Services Limited", exchange: "NSE" },
  { ticker: "HDFCBANK", company_name: "HDFC Bank Limited", exchange: "NSE" },
];

const TIME_RANGES: Array<{ value: ResearchTimeRange; label: string }> = [
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

const DEFAULT_STARTER_QUESTIONS = [
  "Why are people talking about this stock?",
  "What are the main bullish arguments?",
  "What are the main bearish arguments?",
  "Show me contradictory claims.",
  "Are influencers making similar promises?",
  "Which claims are actually supported by evidence?",
  "What information cannot be verified?",
];

function connectorStatusMeta(status: ConnectorStatus): { label: string; tone: EvidenceTone } {
  switch (status) {
    case "COLLECTION_COMPLETE":
      return { label: "Collection complete", tone: "neutral_ok" };
    case "AVAILABLE":
      return { label: "Available", tone: "neutral_ok" };
    case "CONNECTING":
      return { label: "Connecting", tone: "attention" };
    case "REQUIRES_MANUAL_IMPORT":
      return { label: "Requires manual import", tone: "attention" };
    case "UNAVAILABLE":
      return { label: "Unavailable", tone: "unverified" };
    case "ERROR":
      return { label: "Error", tone: "attention" };
  }
}

function provenancePillLabel(src: ResearchSourceItem): ProvenanceLabel {
  if (src.provenance_kind === "REAL_OFFICIAL_API") return "Real · Live Feed";
  if (src.provenance_kind === "REAL_YOUTUBE_RSS") return "Real · YouTube Official RSS";
  if (src.provenance_kind === "REAL_PUBLIC_RSS") return "Real · Live Feed";
  if (src.provenance_kind === "USER_SUBMITTED") return "Mixed (Labelled)";
  return "Curated Demo · Mixed";
}

function PlatformIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  if (platform === "YOUTUBE") {
    return <YoutubeLogo size={size} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />;
  }
  if (platform === "REDDIT") {
    return <RedditLogo size={size} weight="duotone" className="text-[#9A5B13]" aria-hidden="true" />;
  }
  if (platform === "NEWS") {
    return <Newspaper size={size} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />;
  }
  if (platform === "X") {
    return <XLogo size={size} weight="duotone" className="text-[#161A18]" aria-hidden="true" />;
  }
  return <TelegramLogo size={size} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />;
}

export function SocialIntelligencePage() {
  // Stock selection & search state
  const [searchQuery, setSearchQuery] = useState("RELIANCE");
  const [selectedTicker, setSelectedTicker] = useState("RELIANCE");
  const [selectedCompany, setSelectedCompany] = useState("Reliance Industries Limited");
  const [selectedExchange, setSelectedExchange] = useState<"NSE" | "BSE">("NSE");
  const [timeRange, setTimeRange] = useState<ResearchTimeRange>("7d");
  const [searchResults, setSearchResults] = useState<LiveStockSearchItem[]>([]);
  const [isSearchingStocks, setIsSearchingStocks] = useState(false);

  // Active temporary research session state
  const [session, setSession] = useState<ResearchSessionResponse | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Manual import state (Telegram / YouTube transcript / X post)
  const [showImportForm, setShowImportForm] = useState(false);
  const [importPlatform, setImportPlatform] = useState<SocialPlatform>("TELEGRAM");
  const [importCreator, setImportCreator] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importText, setImportText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Evidence explorer filter & citation highlight
  const [platformFilter, setPlatformFilter] = useState<"ALL" | SocialPlatform>("ALL");
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const sourceCardRefs = useRef<Record<string, HTMLElement | null>>({});

  // AI Research Chatbot state
  const [messages, setMessages] = useState<ResearchChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingDraft, setStreamingDraft] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Voice interaction & real-time Voice Assistant Mode state
  const [assistantMode, setAssistantMode] = useState<"text" | "voice">("text");
  const [voiceLanguage, setVoiceLanguage] = useState<SupportedVoiceLanguage>("en-IN");
  const [handsFreeLoop, setHandsFreeLoop] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribingStt, setIsTranscribingStt] = useState(false);
  const [isSynthesizingVoice, setIsSynthesizingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const shouldSubmitAfterSttRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const assistantModeRef = useRef<"text" | "voice">("text");
  const handsFreeRef = useRef(false);

  useEffect(() => {
    assistantModeRef.current = assistantMode;
  }, [assistantMode]);

  useEffect(() => {
    handsFreeRef.current = handsFreeLoop;
  }, [handsFreeLoop]);

  function stopAudioMeter() {
    if (meterFrameRef.current !== null) {
      window.cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  }

  function startMicAudioMeterWithStream(stream: MediaStream) {
    if (typeof AudioContext === "undefined") return;
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const centered = ((dataArray[i] ?? 128) - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        setAudioLevel(Math.min(1, rms * 4.5));
        meterFrameRef.current = window.requestAnimationFrame(tick);
      };
      meterFrameRef.current = window.requestAnimationFrame(tick);
    } catch {
      // Non-fatal: green blob still animates smoothly via CSS keyframes
    }
  }

  // Smooth organic talking amplitude envelope while assistant is speaking
  useEffect(() => {
    if (!isSpeaking) return;
    const interval = window.setInterval(() => {
      const t = Date.now() / 160;
      const wave = 0.42 + 0.36 * Math.abs(Math.sin(t)) + 0.18 * Math.abs(Math.cos(t * 1.7));
      setAudioLevel(Math.min(1, wave));
    }, 90);
    return () => {
      window.clearInterval(interval);
      setAudioLevel(0);
    };
  }, [isSpeaking]);

  // Live stock search debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2 || trimmed.toUpperCase() === selectedTicker) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsSearchingStocks(true);
      void searchLiveStocks(trimmed)
        .then((items) => setSearchResults(items.slice(0, 6)))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearchingStocks(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery, selectedTicker]);

  // Cleanup audio/recording on unmount
  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      stopAudioMeter();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const filteredSources = useMemo(() => {
    if (!session) return [];
    if (platformFilter === "ALL") return session.sources;
    return session.sources.filter((s) => s.platform === platformFilter);
  }, [session, platformFilter]);

  function selectStockPreset(ticker: string, companyName: string, exchange: "NSE" | "BSE") {
    setSelectedTicker(ticker);
    setSelectedCompany(companyName);
    setSelectedExchange(exchange);
    setSearchQuery(ticker);
    setSearchResults([]);
  }

  async function handleStartResearch() {
    const tickerToUse = (selectedTicker || searchQuery).trim().toUpperCase();
    if (!tickerToUse) {
      setSessionError("Enter or select an NSE/BSE stock ticker to start research.");
      return;
    }
    setIsStartingSession(true);
    setSessionError(null);
    setChatError(null);
    setVoiceNotice(null);
    try {
      const created = await createResearchSession({
        ticker: tickerToUse,
        company_name: selectedCompany || tickerToUse,
        exchange: selectedExchange,
        time_range: timeRange,
      });
      setSession(created);
      setMessages(created.messages);
      setPlatformFilter("ALL");
      setHighlightedSourceId(null);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Could not start research session.");
    } finally {
      setIsStartingSession(false);
    }
  }

  async function handleManualImport(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    const hasUrl = /^https?:\/\//i.test(importUrl.trim());
    if (importText.trim().length < 5 && !hasUrl) {
      setImportError(
        "Paste at least 5 characters of message/transcript text, or enter a public YouTube or X URL."
      );
      return;
    }
    setIsImporting(true);
    setImportError(null);
    try {
      const updated = await importResearchSource({
        sessionId: session.session_id,
        platform: importPlatform,
        creator_name: importCreator.trim() || undefined,
        title: importTitle.trim() || undefined,
        text: importText.trim(),
        source_url: importUrl.trim() || undefined,
      });
      setSession(updated);
      setImportCreator("");
      setImportTitle("");
      setImportText("");
      setImportUrl("");
      setShowImportForm(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not import source.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleCitationClick(sourceId: string) {
    setPlatformFilter("ALL");
    setHighlightedSourceId(sourceId);
    const el = sourceCardRefs.current[sourceId];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function stopPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSynthesizingVoice(false);
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }

  async function handleSendQuestion(questionOverride?: string, autoSpeak = false) {
    if (!session) return;
    const question = (questionOverride ?? chatInput).trim();
    if (question.length < 2 || isStreaming) return;

    stopPlayback();
    setChatError(null);
    setChatInput("");
    setVoiceTranscript("");

    const optimisticUserMsg: ResearchChatMessage = {
      id: `local_u_${Date.now()}`,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
      citations: [],
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsStreaming(true);
    setStreamingDraft("");

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const result = await streamResearchChat({
        sessionId: session.session_id,
        question,
        language: voiceLanguage,
        signal: controller.signal,
        onToken(delta) {
          setStreamingDraft((prev) => prev + delta);
        },
      });
      setMessages((prev) => [...prev, result.message]);
      if (autoSpeak || assistantModeRef.current === "voice") {
        void handleSpeakMessage(result.message, true);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setChatError(
          err instanceof Error ? err.message : "Could not complete evidence-grounded chat."
        );
      }
    } finally {
      setIsStreaming(false);
      setStreamingDraft("");
      chatAbortRef.current = null;
    }
  }

  function handleInterruptGeneration() {
    chatAbortRef.current?.abort();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    stopAudioMeter();
    stopPlayback();
    setIsListening(false);
    setIsTranscribingStt(false);
    setIsStreaming(false);
    setStreamingDraft("");
  }

  async function handleToggleMicrophone(autoSubmitOnStop = false) {
    if (!session) return;

    // Second click (user finished speaking): stop recording and convert via Sarvam STT
    if (isListening) {
      shouldSubmitAfterSttRef.current = autoSubmitOnStop || assistantModeRef.current === "voice";
      setIsListening(false);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        stopAudioMeter();
      }
      return;
    }

    stopPlayback();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceNotice(
        "Voice microphone input is not supported in this browser. Text chat continues working normally."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      shouldSubmitAfterSttRef.current = autoSubmitOnStop || assistantModeRef.current === "voice";

      const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMime || "audio/webm";
        const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopAudioMeter();

        if (audioBlob.size < 32) {
          setVoiceNotice("Recording was too short. Click the green blob, speak, then click again.");
          return;
        }

        setIsTranscribingStt(true);
        setVoiceNotice(null);

        void transcribeResearchVoiceAudio({
          sessionId: session.session_id,
          audioBlob,
          language: voiceLanguage,
        })
          .then((sttRes) => {
            setIsTranscribingStt(false);
            if (sttRes.status === "READY" && sttRes.transcript) {
              setVoiceTranscript(sttRes.transcript);
              setChatInput(sttRes.transcript);
              if (shouldSubmitAfterSttRef.current) {
                void handleSendQuestion(sttRes.transcript, true);
              }
            } else {
              setVoiceNotice(
                sttRes.message || "Could not transcribe speech. Try again or type your question."
              );
            }
          })
          .catch(() => {
            setIsTranscribingStt(false);
            setVoiceNotice("Could not reach Sarvam STT service. Text chat remains available.");
          });
      };

      mediaRecorderRef.current = recorder;
      setVoiceNotice(null);
      setVoiceTranscript("");
      setIsListening(true);
      startMicAudioMeterWithStream(stream);
      recorder.start(250);
    } catch {
      setIsListening(false);
      stopAudioMeter();
      setVoiceNotice(
        "Microphone permission was denied or unavailable. Text chat remains fully available."
      );
    }
  }

  async function handleSpeakMessage(msg: ResearchChatMessage, allowAutoRelisten = false) {
    if (!session) return;
    if (isSpeaking && speakingMessageId === msg.id) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setVoiceNotice(null);
    setIsSynthesizingVoice(true);
    setSpeakingMessageId(msg.id);

    const onSpeechComplete = () => {
      setIsSynthesizingVoice(false);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      if (allowAutoRelisten && assistantModeRef.current === "voice" && handsFreeRef.current) {
        window.setTimeout(() => {
          if (assistantModeRef.current === "voice" && handsFreeRef.current) {
            handleToggleMicrophone(true);
          }
        }, 350);
      }
    };

    try {
      const voiceRes = await requestResearchVoiceSession({
        sessionId: session.session_id,
        action: "synthesize",
        text: msg.content.slice(0, 1_500),
        language: voiceLanguage,
      });

      if (voiceRes.tts_audio?.status === "READY" && voiceRes.tts_audio.audio_base64) {
        const audio = new Audio(
          `data:${voiceRes.tts_audio.mime_type ?? "audio/wav"};base64,${voiceRes.tts_audio.audio_base64}`
        );
        audioRef.current = audio;
        audio.onended = onSpeechComplete;
        audio.onerror = () => {
          setIsSynthesizingVoice(false);
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setVoiceNotice("Could not play Sarvam audio stream. Guarded text response remains visible.");
        };
        setIsSynthesizingVoice(false);
        setIsSpeaking(true);
        await audio.play();
        return;
      }

      setVoiceNotice(
        voiceRes.tts_audio?.message ??
          "Sarvam TTS is currently unavailable. Guarded text response remains available above."
      );
      setIsSynthesizingVoice(false);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } catch {
      setVoiceNotice(
        "Could not reach Sarvam TTS service. Guarded text response remains available."
      );
      setIsSynthesizingVoice(false);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }

  const voicePhase: VoiceAssistantPhase = isListening
    ? "listening"
    : isTranscribingStt || isStreaming || isSynthesizingVoice
      ? "thinking"
      : isSpeaking
        ? "speaking"
        : "idle";

  const voiceLangLabel =
    voiceLanguage === "hi-IN"
      ? "हिन्दी / Hinglish"
      : voiceLanguage === "kn-IN"
        ? "ಕನ್ನಡ (Kannada)"
        : "English (IN)";

  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  function handleOrbPress() {
    if (isSpeaking) {
      // Instant barge-in: interrupt playback and start recording again
      stopPlayback();
      void handleToggleMicrophone(true);
      return;
    }
    if (isStreaming || isTranscribingStt || isSynthesizingVoice) {
      handleInterruptGeneration();
      return;
    }
    void handleToggleMicrophone(true);
  }

  const starterQuestions = session?.suggested_questions ?? DEFAULT_STARTER_QUESTIONS;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
      {/* A. Stock Research Header */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[740px] space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(74,124,100,0.22)] bg-[#E6F2EC] px-3 py-1 text-[12px] font-semibold text-[#1F4D3A]">
                <Sparkle size={14} weight="duotone" aria-hidden="true" />
                <span>Evidence-Backed Social Research Workspace</span>
              </div>
              <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.025em] text-[#161A18] sm:text-[34px]">
                Social Signal Intelligence
              </h1>
              <p className="text-[15px] leading-[1.55] text-[#4A524D]">
                Explore what creators and investors are saying. Investigate their claims. Ask
                questions backed by evidence.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(22,26,24,0.09)] bg-[#FAF8F4] px-3 py-1.5 text-[12px] font-medium text-[#4A524D]">
              <ClockCounterClockwise size={14} weight="regular" aria-hidden="true" />
              <span>Temporary session · Zero scraping · Output Guard active</span>
            </div>
          </div>

          {/* Stock Search, Exchange, Time-Range & Start Research Controls */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="relative md:col-span-5">
              <label
                htmlFor="social-stock-search"
                className="mb-1.5 block text-[12.5px] font-semibold text-[#4A524D]"
              >
                Stock Search (NSE / BSE)
              </label>
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#6E7771]"
                  aria-hidden="true"
                />
                <input
                  id="social-stock-search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedTicker(e.target.value.trim().toUpperCase());
                    setSelectedCompany(e.target.value.trim().toUpperCase());
                  }}
                  placeholder="Search RELIANCE, WIPRO, TCS, HDFCBANK..."
                  className="h-11 w-full rounded-xl border border-[rgba(22,26,24,0.09)] bg-white pr-3.5 pl-9 text-[15px] text-[#161A18] placeholder:text-[#6E7771] transition-colors hover:border-[rgba(22,26,24,0.22)] focus:border-[#4A7C64] focus:shadow-[0_0_0_3px_rgba(74,124,100,0.16)] focus:outline-none"
                  aria-label="Search NSE or BSE stock"
                />
              </div>
              {searchResults.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Matching stocks"
                  className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-[14px] border border-[rgba(22,26,24,0.1)] bg-white/95 p-1.5 shadow-lg backdrop-blur-md"
                >
                  {searchResults.map((item) => (
                    <li key={`${item.ticker}-${item.exchange}`}>
                      <button
                        type="button"
                        onClick={() =>
                          selectStockPreset(item.ticker, item.company_name, item.exchange)
                        }
                        className="flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13.5px] transition hover:bg-[#E6EFEA]"
                      >
                        <span className="font-semibold text-[#161A18]">
                          {item.ticker}{" "}
                          <span className="font-normal text-[#4A524D]">— {item.company_name}</span>
                        </span>
                        <span className="rounded-full bg-[#F3F0EA] px-2 py-0.5 text-[11px] font-semibold text-[#4A524D]">
                          {item.exchange}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {isSearchingStocks && (
                <p className="mt-1 text-[11.5px] text-[#6E7771]">Searching NSE/BSE catalogue…</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="social-exchange-select"
                className="mb-1.5 block text-[12.5px] font-semibold text-[#4A524D]"
              >
                Exchange
              </label>
              <select
                id="social-exchange-select"
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value as "NSE" | "BSE")}
                className="h-11 w-full rounded-[12px] border border-[rgba(22,26,24,0.12)] bg-white px-3 text-[14.5px] font-medium text-[#161A18] focus:border-[#4A7C64] focus:outline-none"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="social-timerange-select"
                className="mb-1.5 block text-[12.5px] font-semibold text-[#4A524D]"
              >
                Time Range
              </label>
              <select
                id="social-timerange-select"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as ResearchTimeRange)}
                className="h-11 w-full rounded-[12px] border border-[rgba(22,26,24,0.12)] bg-white px-3 text-[14.5px] font-medium text-[#161A18] focus:border-[#4A7C64] focus:outline-none"
              >
                {TIME_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end md:col-span-3">
              <Button
                variant="primary"
                onClick={() => void handleStartResearch()}
                disabled={isStartingSession}
                className="w-full"
              >
                <Sparkle size={18} weight="bold" aria-hidden="true" />
                <span>{isStartingSession ? "Starting Research…" : "Start Research"}</span>
              </Button>
            </div>
          </div>

          {/* Quick stock selection chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[12px] font-medium text-[#6E7771]">Quick select:</span>
            {QUICK_STOCK_PRESETS.map((preset) => {
              const isSelected = selectedTicker === preset.ticker;
              return (
                <button
                  key={preset.ticker}
                  type="button"
                  onClick={() =>
                    selectStockPreset(preset.ticker, preset.company_name, preset.exchange)
                  }
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition ${
                    isSelected
                      ? "border-[#1F4D3A] bg-[#1F4D3A] text-white"
                      : "border-[rgba(22,26,24,0.1)] bg-white/80 text-[#161A18] hover:border-[#4A7C64] hover:bg-[#E6EFEA]"
                  }`}
                >
                  <span>
                    {preset.ticker} — {preset.exchange}
                  </span>
                </button>
              );
            })}
          </div>

          {sessionError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-[12px] border border-[rgba(154,91,19,0.25)] bg-[#FDF3E4] px-3.5 py-2.5 text-[13.5px] text-[#9A5B13]"
            >
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <span>{sessionError}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Active Session Banner */}
      {session && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[rgba(74,124,100,0.22)] bg-white/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[17px] font-bold text-[#161A18]">
              {session.ticker} — {session.exchange}
            </span>
            <span className="text-[14px] text-[#4A524D]">{session.company_name}</span>
            {session.stock_context.latest_price !== null && (
              <span className="tabular-nums-lining rounded-full bg-[#F3F0EA] px-2.5 py-0.5 text-[13px] font-semibold text-[#161A18]">
                ₹{session.stock_context.latest_price.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProvenancePill
              label={
                session.stock_context.data_freshness === "LIVE_FEED"
                  ? "Real · Live Feed"
                  : session.stock_context.data_freshness === "DATED_SNAPSHOT"
                    ? "Real · Dated Snapshot"
                    : "Mixed (Labelled)"
              }
              asOfDate={session.stock_context.as_of_date ?? undefined}
            />
          </div>
        </div>
      )}

      {/* B. Source Collection Panel */}
      <section aria-labelledby="source-collection-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="source-collection-heading"
              className="text-[20px] font-semibold tracking-[-0.02em] text-[#161A18]"
            >
              Source Collection Panel
            </h2>
            <p className="text-[13.5px] text-[#4A524D]">
              Official APIs and authorized user imports only. Unavailable connectors are shown
              honestly and never fabricated.
            </p>
          </div>
          {session && (
            <Button
              variant="secondary"
              onClick={() => setShowImportForm((prev) => !prev)}
              className="h-10 px-4 text-[13.5px]"
            >
              <PlusCircle size={18} weight="duotone" aria-hidden="true" />
              <span>{showImportForm ? "Close Manual Import" : "Import Telegram / Transcript"}</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            session?.connectors ?? [
              {
                platform: "REDDIT" as const,
                display_name: "Reddit India Markets",
                status: "AVAILABLE" as const,
                items_collected: 0,
                provenance_note: "Real · Official Public RSS (Zero Key)",
                availability_reason:
                  "Fetches real retail investor discussions from r/IndianStockMarket & r/IndianStreetBets with zero API key.",
                supports_manual_import: true,
                last_checked_at: "",
              },
              {
                platform: "NEWS" as const,
                display_name: "Financial News RSS",
                status: "AVAILABLE" as const,
                items_collected: 0,
                provenance_note: "Real · Google News India RSS (Zero Key)",
                availability_reason:
                  "Fetches dated Indian financial press headlines for factual cross-checking with zero API key.",
                supports_manual_import: false,
                last_checked_at: "",
              },
              {
                platform: "YOUTUBE" as const,
                display_name: "YouTube",
                status: "AVAILABLE" as const,
                items_collected: 0,
                provenance_note: "Real · Official Atom RSS + Zero-Key oEmbed",
                availability_reason:
                  "Polls official YouTube Atom RSS feeds and supports pasting any YouTube URL to auto-fetch metadata & captions.",
                supports_manual_import: true,
                last_checked_at: "",
              },
              {
                platform: "X" as const,
                display_name: "X",
                status: "REQUIRES_MANUAL_IMPORT" as const,
                items_collected: 0,
                provenance_note: "Zero-Key oEmbed Link / Manual Import",
                availability_reason:
                  "Paste any public x.com post link to resolve via X's free official oEmbed endpoint (no paid X key needed).",
                supports_manual_import: true,
                last_checked_at: "",
              },
              {
                platform: "TELEGRAM" as const,
                display_name: "Telegram",
                status: "REQUIRES_MANUAL_IMPORT" as const,
                items_collected: 0,
                provenance_note: "Manual Message Import Only (No Automated Scraping)",
                availability_reason:
                  "Paste forwarded Telegram tips directly into your active temporary research session.",
                supports_manual_import: true,
                last_checked_at: "",
              },
            ]
          ).map((conn) => {
            const meta = connectorStatusMeta(conn.status);
            return (
              <GlassCard key={conn.platform} className="flex flex-col justify-between gap-3 p-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F0EA]">
                        <PlatformIcon platform={conn.platform} size={20} />
                      </span>
                      <div>
                        <h3 className="text-[15.5px] font-semibold text-[#161A18]">
                          {conn.display_name}
                        </h3>
                        <p className="tabular-nums-lining text-[12px] text-[#6E7771]">
                          {conn.items_collected} source{conn.items_collected === 1 ? "" : "s"}{" "}
                          collected
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={meta.tone} label={meta.label} />
                  </div>
                  <p className="text-[13px] leading-[1.45] text-[#4A524D]">
                    {conn.availability_reason}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[rgba(22,26,24,0.07)] pt-2.5">
                  <span className="text-[11.5px] font-medium text-[#6E7771]">
                    {conn.provenance_note}
                  </span>
                  {session && conn.supports_manual_import && (
                    <button
                      type="button"
                      onClick={() => {
                        setImportPlatform(conn.platform);
                        setShowImportForm(true);
                      }}
                      className="shrink-0 text-[12px] font-semibold text-[#1F4D3A] underline-offset-2 hover:underline"
                    >
                      Manual import
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Manual Import Form (Telegram messages, YouTube transcripts, X public posts) */}
        {session && showImportForm && (
          <GlassCard className="border-[rgba(74,124,100,0.28)] p-5">
            <form onSubmit={(e) => void handleManualImport(e)} className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#161A18]">
                    Manual User-Submitted Content Import
                  </h3>
                  <p className="text-[13px] text-[#4A524D]">
                    Kept in temporary session memory only. Never scraped or permanently stored.
                  </p>
                </div>
                <StatusBadge tone="unverified" label="User-Submitted · Temporary" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="import-platform"
                    className="mb-1 block text-[12.5px] font-semibold text-[#4A524D]"
                  >
                    Platform
                  </label>
                  <select
                    id="import-platform"
                    value={importPlatform}
                    onChange={(e) => setImportPlatform(e.target.value as SocialPlatform)}
                    className="h-11 w-full rounded-[12px] border border-[rgba(22,26,24,0.12)] bg-white px-3 text-[14px] text-[#161A18]"
                  >
                    <option value="TELEGRAM">Telegram (Manual Paste)</option>
                    <option value="YOUTUBE">YouTube (Paste URL or Transcript)</option>
                    <option value="X">X (Paste x.com URL or Excerpt)</option>
                    <option value="REDDIT">Reddit (Post Excerpt)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="import-creator"
                    className="mb-1 block text-[12.5px] font-semibold text-[#4A524D]"
                  >
                    Creator / Channel Name (Optional)
                  </label>
                  <input
                    id="import-creator"
                    value={importCreator}
                    onChange={(e) => setImportCreator(e.target.value)}
                    placeholder="e.g., Market Pulse Telegram"
                    className="h-11 w-full rounded-xl border border-[rgba(22,26,24,0.09)] bg-white px-3.5 text-[14.5px] text-[#161A18] placeholder:text-[#6E7771] focus:border-[#4A7C64] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="import-url"
                    className="mb-1 block text-[12.5px] font-semibold text-[#4A524D]"
                  >
                    Original Source Link (Optional)
                  </label>
                  <input
                    id="import-url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border border-[rgba(22,26,24,0.09)] bg-white px-3.5 text-[14.5px] text-[#161A18] placeholder:text-[#6E7771] focus:border-[#4A7C64] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="import-title"
                  className="mb-1 block text-[12.5px] font-semibold text-[#4A524D]"
                >
                  Short Title / Summary (Optional)
                </label>
                <input
                  id="import-title"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder={`e.g., Forwarded ${session.ticker} discussion`}
                  className="h-11 w-full rounded-xl border border-[rgba(22,26,24,0.09)] bg-white px-3.5 text-[14.5px] text-[#161A18] placeholder:text-[#6E7771] focus:border-[#4A7C64] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="import-text"
                  className="mb-1 block text-[12.5px] font-semibold text-[#4A524D]"
                >
                  Message or Transcript Content
                </label>
                <textarea
                  id="import-text"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste the forwarded Telegram message, YouTube transcript excerpt, or public post text here..."
                  rows={4}
                  className="min-h-[112px] w-full resize-y rounded-2xl border border-[rgba(22,26,24,0.09)] bg-white px-4 py-3 text-[14.5px] leading-relaxed text-[#161A18] placeholder:text-[#6E7771] focus:border-[#4A7C64] focus:outline-none"
                />
              </div>

              {importError && (
                <p role="alert" className="text-[13px] font-medium text-[#9A5B13]">
                  {importError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowImportForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isImporting}>
                  {isImporting ? "Analyzing & Importing…" : "Add to Research Session"}
                </Button>
              </div>
            </form>
          </GlassCard>
        )}
      </section>

      {/* Main Split Workspace: AI Research Chatbot (Central Feature) + Research Overview */}
      {session && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* E & F. AI Research Chatbot + Voice Interaction */}
          <GlassCard className="flex flex-col gap-4 p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(22,26,24,0.08)] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1F4D3A] text-white">
                  <ChatCircleDots size={20} weight="duotone" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[18px] font-semibold text-[#161A18]">
                    AI Evidence Research Assistant
                  </h2>
                  <p className="text-[12.5px] text-[#4A524D]">
                    Grounded strictly in this session’s collected sources · Output Guard enforced
                  </p>
                </div>
              </div>

              {/* Mode toggle (Text / Voice Assistant Mode) + Language selector (English / Hindi / Kannada) */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="tablist"
                  aria-label="Assistant interaction mode"
                  className="inline-flex h-9 items-center rounded-full border border-[rgba(22,26,24,0.1)] bg-[#F3F0EA] p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={assistantMode === "text"}
                    onClick={() => {
                      handleInterruptGeneration();
                      setAssistantMode("text");
                    }}
                    className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition ${
                      assistantMode === "text"
                        ? "bg-white text-[#161A18] shadow-sm"
                        : "text-[#4A524D] hover:text-[#161A18]"
                    }`}
                  >
                    <ChatCircleDots size={14} weight="duotone" aria-hidden="true" />
                    <span>Text</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={assistantMode === "voice"}
                    onClick={() => setAssistantMode("voice")}
                    className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition ${
                      assistantMode === "voice"
                        ? "bg-[#1F4D3A] text-white shadow-sm"
                        : "text-[#4A524D] hover:text-[#161A18]"
                    }`}
                  >
                    <Waveform size={14} weight="duotone" aria-hidden="true" />
                    <span>Voice Mode</span>
                  </button>
                </div>

                <label htmlFor="voice-lang-select" className="sr-only">
                  Voice language
                </label>
                <select
                  id="voice-lang-select"
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value as SupportedVoiceLanguage)}
                  className="h-9 rounded-full border border-[rgba(22,26,24,0.12)] bg-white px-3 text-[12.5px] font-medium text-[#161A18]"
                >
                  <option value="en-IN">Voice: English (IN)</option>
                  <option value="hi-IN">Voice: हिन्दी / Hinglish</option>
                  <option value="kn-IN">Voice: ಕನ್ನಡ (Kannada)</option>
                </select>
                {(isSpeaking || isStreaming || isListening) && (
                  <button
                    type="button"
                    onClick={handleInterruptGeneration}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[rgba(154,91,19,0.28)] bg-[#FDF3E4] px-3 text-[12px] font-semibold text-[#9A5B13]"
                  >
                    <StopCircle size={15} weight="duotone" aria-hidden="true" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>

            {assistantMode === "voice" ? (
              /* Real-Time Voice Assistant Mode Stage with Animated Green Talking Blob */
              <div
                data-testid="voice-assistant-mode-stage"
                className="flex flex-col items-center gap-4 rounded-[18px] border border-[rgba(74,124,100,0.22)] bg-gradient-to-b from-[#FAF8F4] via-[#F2F7F4] to-[#E6EFEA]/65 px-4 py-6 text-center"
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(31,77,58,0.2)] bg-white/85 px-3 py-1 text-[12px] font-semibold text-[#1F4D3A]">
                    <Waveform size={14} weight="duotone" aria-hidden="true" />
                    <span>
                      {voicePhase === "listening"
                        ? `AI is listening (${voiceLangLabel}) · Click blob when done`
                        : voicePhase === "thinking"
                          ? isTranscribingStt
                            ? `AI is working · Converting speech to text (Sarvam STT)…`
                            : isSynthesizingVoice
                              ? `AI is working · Generating Sarvam ${voiceLangLabel} voice…`
                              : "AI is working · Checking evidence & Output Guard…"
                          : voicePhase === "speaking"
                            ? `AI speaking (${voiceLangLabel}) · Tap blob to speak`
                            : `Tap green blob to talk (${voiceLangLabel})`}
                    </span>
                  </span>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(22,26,24,0.09)] bg-white/80 px-3 py-1 text-[11.5px] font-medium text-[#4A524D]">
                    <input
                      type="checkbox"
                      checked={handsFreeLoop}
                      onChange={(e) => setHandsFreeLoop(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#1F4D3A]"
                    />
                    <span>Hands-Free Loop</span>
                  </label>
                </div>

                <VoiceAssistantOrb
                  phase={voicePhase}
                  audioLevel={audioLevel}
                  languageLabel={voiceLangLabel}
                  onPress={handleOrbPress}
                />

                {isListening && (
                  <button
                    type="button"
                    onClick={() => void handleToggleMicrophone(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#161A18] px-4 text-[12.5px] font-semibold text-[#FAF8F4] shadow-sm transition hover:bg-[#29302C]"
                  >
                    <PaperPlaneTilt size={14} weight="bold" aria-hidden="true" />
                    <span>Done Speaking — Convert to Text</span>
                  </button>
                )}

                {/* Live speech transcript or grounded assistant caption */}
                <div className="w-full max-w-[540px] space-y-2.5">
                  {voiceTranscript && (
                    <div className="rounded-[12px] border border-[rgba(74,124,100,0.25)] bg-white/90 px-3.5 py-2 text-[13.5px] text-[#161A18]">
                      <span className="font-semibold text-[#1F4D3A]">You: </span>
                      {voiceTranscript}
                    </div>
                  )}

                  {isStreaming && (
                    <div className="rounded-[14px] border border-[rgba(74,124,100,0.22)] bg-white/90 p-3.5 text-left text-[13.5px] text-[#161A18]">
                      <p className="mb-1 text-[11.5px] font-semibold text-[#1F4D3A]">
                        Preparing grounded answer…
                      </p>
                      <p className="whitespace-pre-line leading-[1.5]">
                        {streamingDraft || "Inspecting collected session sources…"}
                      </p>
                    </div>
                  )}

                  {!isStreaming && latestAssistantMessage && (
                    <div className="rounded-[14px] border border-[rgba(22,26,24,0.09)] bg-white/95 p-3.5 text-left">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="font-semibold text-[#1F4D3A]">
                          Tip Autopsy Voice Response ({voiceLangLabel})
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F2EC] px-2 py-0.5 text-[11px] font-semibold text-[#1F4D3A]">
                          <ShieldCheck size={12} weight="duotone" aria-hidden="true" />
                          {latestAssistantMessage.guard_status === "PASSED"
                            ? "Guard Verified"
                            : "Safe Fallback"}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-[13.5px] leading-[1.55] text-[#161A18]">
                        {latestAssistantMessage.content}
                      </p>
                      {latestAssistantMessage.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {latestAssistantMessage.citations.map((cit) => (
                            <button
                              key={cit.source_id}
                              type="button"
                              onClick={() => handleCitationClick(cit.source_id)}
                              className="inline-flex items-center gap-1 rounded-full border border-[rgba(31,77,58,0.22)] bg-[#E6F2EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1F4D3A] hover:bg-[#DCECE4]"
                            >
                              <span>[{cit.citation_key}]</span>
                              <span className="max-w-[130px] truncate">
                                {cit.creator_name ?? cit.platform}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick tap-to-ask prompts in Voice Mode (also works when mic is unavailable) */}
                  <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                    {starterQuestions.slice(0, 4).map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={isStreaming}
                        onClick={() => void handleSendQuestion(q, true)}
                        className="rounded-full border border-[rgba(22,26,24,0.1)] bg-white/90 px-3 py-1.5 text-[12px] font-medium text-[#161A18] transition hover:border-[#4A7C64] hover:bg-[#E6F2EC] disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {voiceNotice && (
                  <div
                    role="status"
                    className="flex max-w-[520px] items-center gap-2 rounded-[12px] border border-[rgba(78,89,100,0.2)] bg-[#EEF1F4] px-3 py-2 text-left text-[12.5px] text-[#4E5964]"
                  >
                    <Info size={16} weight="duotone" aria-hidden="true" />
                    <span>{voiceNotice}</span>
                  </div>
                )}
              </div>
            ) : (
              <>

            {/* Starter Question Pills */}
            <div className="flex flex-wrap gap-1.5">
              {starterQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void handleSendQuestion(q)}
                  className="rounded-full border border-[rgba(22,26,24,0.1)] bg-[#FAF8F4] px-3 py-1.5 text-[12.5px] font-medium text-[#161A18] transition hover:border-[#4A7C64] hover:bg-[#E6F2EC] disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Conversation Feed */}
            <div
              role="log"
              aria-live="polite"
              aria-label="Research conversation history"
              className="flex min-h-[300px] max-h-[520px] flex-col gap-3 overflow-y-auto rounded-[16px] border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4]/85 p-3.5"
            >
              {messages.length === 0 && !isStreaming && (
                <div className="my-auto flex flex-col items-center gap-2 py-8 text-center">
                  <Sparkle size={28} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
                  <p className="max-w-[440px] text-[14px] text-[#4A524D]">
                    Ask a question about{" "}
                    <strong className="text-[#161A18]">
                      {session.company_name} ({session.ticker})
                    </strong>{" "}
                    or click a suggested prompt above. Every answer separates verified facts from
                    unverified social claims and cites exact sources.
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <article
                  key={msg.id}
                  className={`flex flex-col gap-2 rounded-[14px] p-3.5 ${
                    msg.role === "user"
                      ? "ml-auto max-w-[85%] bg-[#161A18] text-[#FAF8F4]"
                      : "mr-auto w-full border border-[rgba(22,26,24,0.09)] bg-white text-[#161A18]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span
                      className={
                        msg.role === "user"
                          ? "font-semibold text-[#B8D8C8]"
                          : "font-semibold text-[#1F4D3A]"
                      }
                    >
                      {msg.role === "user" ? "You" : "Tip Autopsy Evidence Assistant"}
                    </span>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2">
                        {msg.guard_status && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F2EC] px-2 py-0.5 text-[11px] font-semibold text-[#1F4D3A]">
                            <ShieldCheck size={12} weight="duotone" aria-hidden="true" />
                            {msg.guard_status === "PASSED" ? "Guard Verified" : "Safe Fallback"}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleSpeakMessage(msg)}
                          aria-label={
                            isSpeaking && speakingMessageId === msg.id
                              ? "Stop spoken response"
                              : "Listen to guarded response"
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-[rgba(22,26,24,0.1)] bg-[#FAF8F4] px-2.5 py-0.5 text-[11.5px] font-medium text-[#161A18] hover:border-[#4A7C64]"
                        >
                          {isSpeaking && speakingMessageId === msg.id ? (
                            <>
                              <StopCircle size={13} weight="bold" aria-hidden="true" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <SpeakerHigh size={13} weight="duotone" aria-hidden="true" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="whitespace-pre-line text-[14px] leading-[1.55]">{msg.content}</p>

                  {/* Verified Facts vs. Social Claims vs. Unverified/Missing Breakdown */}
                  {msg.role === "assistant" && msg.evidence_breakdown && (
                    <div className="grid grid-cols-1 gap-2 rounded-[12px] bg-[#FAF8F4] p-2.5 text-[12px] sm:grid-cols-3">
                      <div>
                        <p className="mb-1 font-semibold text-[#2A6F52]">Verified Facts</p>
                        <ul className="space-y-1 text-[#4A524D]">
                          {msg.evidence_breakdown.verified_facts.slice(0, 2).map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-[#9A5B13]">
                          Social Claims (Opinions)
                        </p>
                        <ul className="space-y-1 text-[#4A524D]">
                          {msg.evidence_breakdown.social_claims.length > 0 ? (
                            msg.evidence_breakdown.social_claims.slice(0, 2).map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))
                          ) : (
                            <li>• None collected yet.</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-[#4E5964]">Unverified / Missing</p>
                        <ul className="space-y-1 text-[#4A524D]">
                          {msg.evidence_breakdown.unverified_or_missing.slice(0, 2).map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Clickable Source Citations */}
                  {msg.role === "assistant" && msg.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11.5px] font-semibold text-[#6E7771]">Sources:</span>
                      {msg.citations.map((cit) => (
                        <button
                          key={cit.source_id}
                          type="button"
                          onClick={() => handleCitationClick(cit.source_id)}
                          className="inline-flex items-center gap-1 rounded-full border border-[rgba(31,77,58,0.22)] bg-[#E6F2EC] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#1F4D3A] transition hover:bg-[#DCECE4]"
                        >
                          <span>[{cit.citation_key}]</span>
                          <span className="max-w-[140px] truncate">
                            {cit.creator_name ?? cit.platform}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggested Follow-up Questions */}
                  {msg.role === "assistant" &&
                    msg.suggested_followups &&
                    msg.suggested_followups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 border-t border-[rgba(22,26,24,0.06)] pt-2">
                        {msg.suggested_followups.map((follow) => (
                          <button
                            key={follow}
                            type="button"
                            disabled={isStreaming}
                            onClick={() => void handleSendQuestion(follow)}
                            className="rounded-full bg-[#F3F0EA] px-2.5 py-1 text-[11.5px] font-medium text-[#4A524D] hover:bg-[#E6EFEA] hover:text-[#161A18]"
                          >
                            {follow}
                          </button>
                        ))}
                      </div>
                    )}
                </article>
              ))}

              {isStreaming && (
                <article className="mr-auto w-full rounded-[14px] border border-[rgba(74,124,100,0.22)] bg-white p-3.5 text-[14px] text-[#161A18]">
                  <p className="mb-1 text-[11.5px] font-semibold text-[#1F4D3A]">
                    Tip Autopsy Evidence Assistant · Streaming grounded answer…
                  </p>
                  <p className="whitespace-pre-line leading-[1.55]">
                    {streamingDraft || "Inspecting collected session evidence…"}
                  </p>
                </article>
              )}
            </div>

            {/* Live Voice Transcription & Notices */}
            {voiceTranscript && (
              <div className="rounded-[12px] border border-[rgba(74,124,100,0.24)] bg-[#E6F2EC]/70 px-3 py-2 text-[12.5px] text-[#1F4D3A]">
                <span className="font-semibold">Voice transcription:</span> {voiceTranscript}
              </div>
            )}
            {voiceNotice && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-[12px] border border-[rgba(78,89,100,0.2)] bg-[#EEF1F4] px-3 py-2 text-[12.5px] text-[#4E5964]"
              >
                <Info size={16} weight="duotone" aria-hidden="true" />
                <span>{voiceNotice}</span>
              </div>
            )}
            {chatError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-[12px] border border-[rgba(154,91,19,0.25)] bg-[#FDF3E4] px-3 py-2 text-[13px] text-[#9A5B13]"
              >
                <WarningCircle size={16} weight="duotone" aria-hidden="true" />
                <span>{chatError}</span>
              </div>
            )}

            {/* Chat Input + Microphone Button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendQuestion();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => handleToggleMicrophone(false)}
                aria-label={isListening ? "Stop voice input" : "Ask question using voice"}
                aria-pressed={isListening}
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                  isListening
                    ? "border-[#1F4D3A] bg-[#1F4D3A] text-white"
                    : "border-[rgba(22,26,24,0.14)] bg-white text-[#161A18] hover:border-[#4A7C64]"
                }`}
              >
                {isListening ? (
                  <MicrophoneSlash size={20} weight="bold" aria-hidden="true" />
                ) : (
                  <Microphone size={20} weight="duotone" aria-hidden="true" />
                )}
              </button>

              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about claims, contradictions, hype, or missing evidence…"
                aria-label="Ask the AI research assistant"
                disabled={isStreaming}
                className="h-11 w-full rounded-xl border border-[rgba(22,26,24,0.09)] bg-white px-3.5 text-[14.5px] text-[#161A18] placeholder:text-[#6E7771] transition-colors hover:border-[rgba(22,26,24,0.22)] focus:border-[#4A7C64] focus:shadow-[0_0_0_3px_rgba(74,124,100,0.16)] focus:outline-none disabled:bg-[#F3F0EA] disabled:opacity-55"
              />

              <Button
                type="submit"
                variant="primary"
                disabled={isStreaming || chatInput.trim().length < 2}
                aria-label="Send question"
                className="shrink-0 px-4"
              >
                <PaperPlaneTilt size={18} weight="bold" aria-hidden="true" />
                <span className="hidden sm:inline">Ask</span>
              </Button>
            </form>
              </>
            )}

            <p className="text-[11.5px] leading-[1.45] text-[#6E7771]">{MANDATORY_DISCLAIMER}</p>
          </GlassCard>

          {/* C. Research Overview */}
          <GlassCard className="flex flex-col gap-4 p-5 lg:col-span-5">
            <div className="flex items-center justify-between gap-2 border-b border-[rgba(22,26,24,0.08)] pb-3">
              <div className="flex items-center gap-2">
                <Scales size={20} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
                <h2 className="text-[18px] font-semibold text-[#161A18]">Research Overview</h2>
              </div>
              <span className="tabular-nums-lining rounded-full bg-[#F3F0EA] px-2.5 py-1 text-[12px] font-semibold text-[#4A524D]">
                {session.overview.total_sources} source
                {session.overview.total_sources === 1 ? "" : "s"}
              </span>
            </div>

            {/* Source Provenance Counts (No Trust Score / No Stock Risk Score) */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[12px] bg-[#E6F2EC]/70 p-2.5">
                <p className="tabular-nums-lining text-[18px] font-bold text-[#1F4D3A]">
                  {session.overview.real_source_count}
                </p>
                <p className="text-[11.5px] font-medium text-[#4A524D]">Official API/RSS</p>
              </div>
              <div className="rounded-[12px] bg-[#FAF8F4] p-2.5">
                <p className="tabular-nums-lining text-[18px] font-bold text-[#161A18]">
                  {session.overview.user_submitted_count}
                </p>
                <p className="text-[11.5px] font-medium text-[#4A524D]">User Imported</p>
              </div>
              <div className="rounded-[12px] bg-[#EFECE6] p-2.5">
                <p className="tabular-nums-lining text-[18px] font-bold text-[#4A524D]">
                  {session.overview.curated_demo_count}
                </p>
                <p className="text-[11.5px] font-medium text-[#4A524D]">Curated Demo</p>
              </div>
            </div>

            {/* Recurring Claims */}
            <div className="space-y-1.5">
              <h3 className="text-[13.5px] font-semibold text-[#161A18]">Recurring Claims</h3>
              {session.overview.recurring_claims.length > 0 ? (
                <ul className="space-y-1.5 text-[13px] text-[#4A524D]">
                  {session.overview.recurring_claims.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[10px] border border-[rgba(22,26,24,0.07)] bg-white/80 px-3 py-2"
                    >
                      {item.summary}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-[#6E7771]">
                  No recurring claims collected yet for this stock.
                </p>
              )}
            </div>

            {/* Bullish vs. Bearish Arguments (Claims Only) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[12px] border border-[rgba(22,26,24,0.08)] bg-white/80 p-3">
                <h3 className="mb-1.5 text-[13px] font-semibold text-[#1F4D3A]">
                  Bullish Arguments (Claims)
                </h3>
                {session.overview.bullish_arguments.length > 0 ? (
                  <ul className="space-y-1.5 text-[12.5px] text-[#4A524D]">
                    {session.overview.bullish_arguments.map((arg) => (
                      <li key={arg.id}>• {arg.summary}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-[#6E7771]">None observed in session.</p>
                )}
              </div>

              <div className="rounded-[12px] border border-[rgba(22,26,24,0.08)] bg-white/80 p-3">
                <h3 className="mb-1.5 text-[13px] font-semibold text-[#9A5B13]">
                  Bearish Arguments (Claims)
                </h3>
                {session.overview.bearish_arguments.length > 0 ? (
                  <ul className="space-y-1.5 text-[12.5px] text-[#4A524D]">
                    {session.overview.bearish_arguments.map((arg) => (
                      <li key={arg.id}>• {arg.summary}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-[#6E7771]">None observed in session.</p>
                )}
              </div>
            </div>

            {/* Contradictory Claims */}
            {session.overview.contradictory_claims.length > 0 && (
              <div className="space-y-1.5 rounded-[12px] border border-[rgba(154,91,19,0.2)] bg-[#FDF3E4]/65 p-3">
                <h3 className="text-[13px] font-semibold text-[#9A5B13]">Contradictory Claims</h3>
                {session.overview.contradictory_claims.map((c) => (
                  <div key={c.id} className="text-[12.5px] text-[#4A524D]">
                    <p className="font-semibold text-[#161A18]">{c.topic}</p>
                    <p>{c.side_a_summary}</p>
                    <p>{c.side_b_summary}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Hype & Urgency + Sponsorship Disclosures */}
            <div className="space-y-2 rounded-[12px] border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] p-3">
              <div>
                <h3 className="text-[13px] font-semibold text-[#161A18]">
                  Sponsorship Disclosure Indicators
                </h3>
                <p className="text-[12.5px] text-[#4A524D]">
                  {session.overview.sponsorship_disclosure_indicators.summary}
                </p>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-[#161A18]">
                  Hype & Urgency Phrases
                </h3>
                {session.overview.hype_and_urgency_phrases.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {session.overview.hype_and_urgency_phrases.map((h, idx) => (
                      <span
                        key={`${h.source_id}-${idx}`}
                        className="rounded-full bg-[#FDF3E4] px-2.5 py-0.5 text-[11.5px] font-medium text-[#9A5B13]"
                      >
                        “{h.phrase}” ({h.citation_key})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[#6E7771]">
                    No urgency/certainty hype phrases detected.
                  </p>
                )}
              </div>
            </div>

            {/* Unverified Claims & Missing Information */}
            <div className="space-y-2">
              {session.overview.unverified_claims.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-[#161A18]">Unverified Claims</h3>
                  <ul className="mt-1 space-y-1 text-[12.5px] text-[#4A524D]">
                    {session.overview.unverified_claims.slice(0, 4).map((u, i) => (
                      <li key={i}>
                        • {u.statement} ({u.citation_key}) —{" "}
                        <span className="text-[#6E7771]">{u.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-[13px] font-semibold text-[#161A18]">Missing Information</h3>
                <ul className="mt-1 space-y-1 text-[12.5px] text-[#4A524D]">
                  {session.overview.missing_information.map((gap, i) => (
                    <li key={i}>• {gap}</li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* D. Evidence Explorer */}
      {session && (
        <section aria-labelledby="evidence-explorer-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="evidence-explorer-heading"
                className="text-[20px] font-semibold tracking-[-0.02em] text-[#161A18]"
              >
                Evidence Explorer
              </h2>
              <p className="text-[13.5px] text-[#4A524D]">
                Individual source references with provenance, publication timestamps, and extracted
                claims. Opinions are never presented as verified facts.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by platform">
              {(["ALL", "REDDIT", "NEWS", "YOUTUBE", "X", "TELEGRAM"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={platformFilter === tab}
                  onClick={() => setPlatformFilter(tab)}
                  className={`h-9 rounded-full px-3.5 text-[12.5px] font-semibold transition ${
                    platformFilter === tab
                      ? "bg-[#161A18] text-[#FAF8F4]"
                      : "border border-[rgba(22,26,24,0.1)] bg-white/80 text-[#4A524D] hover:text-[#161A18]"
                  }`}
                >
                  {tab === "ALL" ? `All (${session.sources.length})` : tab}
                </button>
              ))}
            </div>
          </div>

          {filteredSources.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="text-[14.5px] font-medium text-[#161A18]">
                No sources collected for this filter yet.
              </p>
              <p className="mt-1 text-[13px] text-[#4A524D]">
                Use <strong>Import Telegram / Transcript</strong> above to add user-submitted
                messages or authorized transcripts to this temporary session.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredSources.map((src) => {
                const isHighlighted = highlightedSourceId === src.id;
                return (
                  <article
                    key={src.id}
                    ref={(el) => {
                      sourceCardRefs.current[src.id] = el;
                    }}
                    className={`rounded-[18px] border bg-white/85 p-4 shadow-sm transition ${
                      isHighlighted
                        ? "border-[#1F4D3A] ring-2 ring-[rgba(74,124,100,0.28)]"
                        : "border-[rgba(22,26,24,0.09)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 items-center rounded-full bg-[#1F4D3A] px-2.5 text-[11.5px] font-bold text-white">
                          {src.citation_key}
                        </span>
                        <PlatformIcon platform={src.platform} size={17} />
                        <span className="text-[13.5px] font-semibold text-[#161A18]">
                          {src.creator_name ?? src.platform}
                        </span>
                      </div>
                      <ProvenancePill
                        label={provenancePillLabel(src)}
                        asOfDate={src.published_at?.slice(0, 10)}
                      />
                    </div>

                    <h3 className="mt-2.5 text-[15px] font-semibold text-[#161A18]">{src.title}</h3>
                    <p className="mt-1.5 rounded-[10px] bg-[#FAF8F4] p-2.5 text-[13px] leading-[1.5] text-[#4A524D]">
                      “{src.excerpt}”
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="rounded-full bg-[#EEF1F4] px-2.5 py-0.5 font-semibold text-[#4E5964]">
                        Direction: {src.direction ?? "Not stated"}
                      </span>
                      <span className="rounded-full bg-[#EEF1F4] px-2.5 py-0.5 font-semibold text-[#4E5964]">
                        Disclosure: {src.disclosure_grade}
                      </span>
                      {src.claims.target_price.value !== null && (
                        <span className="rounded-full bg-[#FDF3E4] px-2.5 py-0.5 font-semibold text-[#9A5B13]">
                          Creator’s claim: ₹{src.claims.target_price.value.toLocaleString("en-IN")}
                        </span>
                      )}
                      {src.missing_fields.slice(0, 2).map((mf) => (
                        <span
                          key={mf}
                          className="rounded-full border border-[rgba(22,26,24,0.08)] bg-white px-2 py-0.5 text-[#6E7771]"
                        >
                          {mf}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(22,26,24,0.07)] pt-2.5 text-[12px] text-[#6E7771]">
                      <span className="tabular-nums-lining">
                        Retrieved {src.retrieved_at.slice(0, 10)}
                        {src.published_at ? ` · Published ${src.published_at.slice(0, 10)}` : ""}
                      </span>
                      {src.source_url ? (
                        <a
                          href={src.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#1F4D3A] hover:underline"
                        >
                          <span>Open original source</span>
                          <ArrowSquareOut size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#6E7771]">
                          <CheckCircle size={13} aria-hidden="true" />
                          <span>User / Curated text excerpt</span>
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default SocialIntelligencePage;
