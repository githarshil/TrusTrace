import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CloudArrowUp,
  FilmStrip,
  Image as ImageIcon,
  Quotes,
  ShieldCheck,
  SpeakerHigh,
  TextAa,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { TextAreaField, TextField } from "../../components/ui/Input";
import { ProgressSteps } from "../../components/ui/ProgressSteps";
import { ProvenancePill } from "../../components/ui/ProvenancePill";
import { StatusBadge, type EvidenceTone } from "../../components/ui/StatusBadge";
import {
  buildGuardedReport,
  fetchCoordinatedDemoSignal,
  fetchDemoCases,
  fetchStockChecks,
  lookupInfluencer,
  lookupStocks,
  parseTip,
  requestVoiceReadout,
} from "../../lib/apiClient";
import type { CheckStatus, ClaimLedger, DataLabel, HypeFlag, SupportedVoiceLanguage, TipDirection } from "../../types/api";
import { PauseAndPlanGate } from "../pause-plan/PauseAndPlanGate";
import { TipTimeMachine } from "../time-machine/TipTimeMachine";
import { useAutopsy } from "../workflow/AutopsyContext";

interface AnalyzeLocationState {
  prefillQuery?: string;
  selectedDemoId?: string;
  prefillStockName?: string;
  prefillInfluencerName?: string;
}

function extractQuickClaims(text: string) {
  let direction: TipDirection | "" = "";
  if (/\b(buy|bullish|long|upside|breakout|kharido|ce\b)/i.test(text)) direction = "BULLISH";
  else if (/\b(sell|bearish|short|downside|breakdown|becho|pe\b)/i.test(text)) direction = "BEARISH";

  let targetPrice = "";
  const targetMatch = /\b(?:target|tgt|t1|t2|tp)\s*[:\-=@]?\s*(?:rs\.?|₹|inr)?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/i.exec(text);
  if (targetMatch?.[1]) targetPrice = targetMatch[1].replace(/,/g, "");

  let deadline = "";
  const deadlineMatch = /\b(\d{1,3}\s*(?:day|days|week|weeks|month|months|trading\s*sessions?|din)|intraday|btst|expiry\s+\d{1,2}\s+[a-z]{3,9}|by\s+\d{1,2}\s+[a-z]{3,9}(?:\s+\d{4})?|\d{4}-\d{2}-\d{2})\b/i.exec(text);
  if (deadlineMatch?.[0]) deadline = deadlineMatch[0];

  let stopLoss = "";
  let stopLossGated = false;
  if (/\b(?:sl|stop[\s-]*loss)\s*[:.\-\s]*(?:paid|vip(?:\s*premium)?|premium|in\s*(?:vip|paid)|members\s*only|dm)\b/i.test(text)) {
    stopLossGated = true;
  } else {
    const slMatch = /\b(?:sl|stop[\s-]*loss)\s*[:.\-=@]?\s*(?:rs\.?|₹|inr)?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/i.exec(text);
    if (slMatch?.[1]) stopLoss = slMatch[1].replace(/,/g, "");
  }

  return { direction, targetPrice, deadline, stopLoss, stopLossGated };
}

function mapCheckTone(status: CheckStatus): EvidenceTone {
  if (status === "WITHIN_NORMAL_RANGE") return "neutral_ok";
  if (status === "NEEDS_ATTENTION") return "attention";
  return "unverified";
}

function mapCheckLabel(status: CheckStatus): string {
  if (status === "WITHIN_NORMAL_RANGE") return "Within normal range";
  if (status === "NEEDS_ATTENTION") return "Needs attention";
  return "Could not verify";
}

function mapDataLabel(label: DataLabel | null): "Real" | "Synthetic / Demo" | "Mixed (Labelled)" {
  if (label === "REAL") return "Real";
  if (label === "MIXED") return "Mixed (Labelled)";
  return "Synthetic / Demo";
}

function HighlightedSourceText({ text, hypeFlags }: { text: string; hypeFlags: HypeFlag[] }) {
  if (!text.trim()) {
    return (
      <p className="m-0 text-[13.5px] italic text-[#6E7771]">
        No tip text or transcript was supplied. Continuing via direct influencer + stock lookup.
      </p>
    );
  }
  if (hypeFlags.length === 0) {
    return <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-[#161A18]">{text}</p>;
  }

  const segments: Array<{ key: string; content: string; flag?: HypeFlag }> = [];
  let cursor = 0;
  for (const flag of hypeFlags) {
    if (flag.start < cursor) continue;
    if (flag.start > cursor) {
      segments.push({ key: `t-${cursor}`, content: text.slice(cursor, flag.start) });
    }
    segments.push({
      key: `h-${flag.start}-${flag.end}`,
      content: text.slice(flag.start, flag.end),
      flag,
    });
    cursor = flag.end;
  }
  if (cursor < text.length) {
    segments.push({ key: `t-${cursor}`, content: text.slice(cursor) });
  }

  return (
    <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-[#161A18]">
      {segments.map((seg) =>
        seg.flag ? (
          <mark
            key={seg.key}
            title={`Hype phrase (${seg.flag.category}) — descriptive text evidence only`}
            className="rounded-md bg-[#FDF3E4] px-1 py-0.5 font-semibold text-[#9A5B13] ring-1 ring-[rgba(154,91,19,0.22)]"
          >
            {seg.content}
          </mark>
        ) : (
          <span key={seg.key}>{seg.content}</span>
        )
      )}
    </p>
  );
}

export function AnalyzeWorkspacePage() {
  const location = useLocation();
  const {
    state,
    setStep,
    setInputMode,
    setUploadedFile,
    setRawText,
    setInfluencerName,
    setStockName,
    setTipDate,
    loadDemoCase,
    setParseResult,
    updateClaims,
    setSelectedMarkerDate,
    recordSessionRun,
    resetSession,
  } = useAutopsy();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [maxUnlocked, setMaxUnlocked] = useState<number>(1);
  const [voiceLang, setVoiceLang] = useState<SupportedVoiceLanguage>("en-IN");

  // Step 1 direct claim ledger input fields (auto-fills Step 2)
  const [claimDirection, setClaimDirection] = useState<TipDirection | "">("");
  const [claimTargetPrice, setClaimTargetPrice] = useState<string>("");
  const [claimDeadline, setClaimDeadline] = useState<string>("");
  const [claimStopLoss, setClaimStopLoss] = useState<string>("");
  const [claimStopLossGated, setClaimStopLossGated] = useState<boolean>(false);

  const voiceMutation = useMutation({
    mutationFn: requestVoiceReadout,
  });

  const demoCasesQuery = useQuery({
    queryKey: ["demo-cases"],
    queryFn: fetchDemoCases,
  });

  const stocksQuery = useQuery({
    queryKey: ["stocks-lookup", state.stockName],
    queryFn: () => lookupStocks(state.stockName),
  });

  // Apply one-time navigation state prefill (from Dashboard, Real-Time Stocks, Finfluencers, or Demo Corpus)
  useEffect(() => {
    const locState = (location.state as AnalyzeLocationState | null) ?? null;
    if (!locState) return;
    if (locState.selectedDemoId && demoCasesQuery.data) {
      const found = demoCasesQuery.data.find((d) => d.id === locState.selectedDemoId);
      if (found && state.selectedDemoCaseId !== found.id) {
        loadDemoCase(found);
      }
    } else {
      if (locState.prefillStockName && !state.stockName) {
        setStockName(locState.prefillStockName);
      }
      if (locState.prefillInfluencerName && !state.influencerName) {
        setInfluencerName(locState.prefillInfluencerName);
      }
      if (locState.prefillQuery && !state.rawText) {
        setRawText(locState.prefillQuery);
      }
    }
  }, [
    demoCasesQuery.data,
    loadDemoCase,
    location.state,
    setInfluencerName,
    setRawText,
    setStockName,
    state.influencerName,
    state.rawText,
    state.selectedDemoCaseId,
    state.stockName,
  ]);

  const effectiveTicker = useMemo(() => {
    if (state.resolvedTicker) return state.resolvedTicker;
    const matched = stocksQuery.data?.[0];
    if (matched) return matched.ticker;
    return state.stockName.trim().toUpperCase().replace(/\s+/g, "_");
  }, [state.resolvedTicker, state.stockName, stocksQuery.data]);

  const coordinatedDemoQuery = useQuery({
    queryKey: ["coordinated-demo", effectiveTicker],
    queryFn: () => fetchCoordinatedDemoSignal(effectiveTicker),
    enabled: state.activeStep >= 3 && effectiveTicker.length > 0,
  });

  const sebiQuery = useQuery({
    queryKey: ["sebi-lookup", state.influencerName],
    queryFn: () => lookupInfluencer(state.influencerName),
    enabled: state.activeStep >= 3 && state.influencerName.trim().length > 0,
  });

  const checksQuery = useQuery({
    queryKey: [
      "stock-checks",
      effectiveTicker,
      state.tipDate,
      sebiQuery.data?.influencer_id ?? null,
    ],
    queryFn: () =>
      fetchStockChecks({
        ticker: effectiveTicker,
        asOf: "2026-11-19",
        tipDate: state.tipDate,
        influencerId: sebiQuery.data?.influencer_id ?? null,
      }),
    enabled: state.activeStep >= 3 && effectiveTicker.length > 0,
  });

  const reportQuery = useQuery({
    queryKey: [
      "guarded-report",
      effectiveTicker,
      state.tipDate,
      state.influencerName,
      sebiQuery.data?.influencer_id ?? null,
      state.rawText,
      state.editedClaims,
    ],
    queryFn: () =>
      buildGuardedReport({
        ticker: effectiveTicker,
        tip_date: state.tipDate,
        as_of_date: "2026-11-19",
        influencer_id: sebiQuery.data?.influencer_id ?? null,
        influencer_name: state.influencerName || null,
        original_text: state.parseResult?.extracted_text || state.rawText || null,
        claims: state.editedClaims ?? undefined,
      }),
    enabled: state.activeStep >= 4 && effectiveTicker.length > 0,
  });

  const parseMutation = useMutation({
    mutationFn: parseTip,
    onSuccess: async (parsed) => {
      setSubmitError(null);
      const stockSearchTerm = state.stockName.trim() || parsed.claims.stock.value || "";
      let resolved = state.resolvedTicker;
      if (!resolved && stockSearchTerm) {
        try {
          const matches = await lookupStocks(stockSearchTerm);
          if (matches[0]) resolved = matches[0].ticker;
        } catch {
          // Keep user-entered fallback cleanly
        }
      }
      const finalTicker = resolved || stockSearchTerm.toUpperCase().replace(/\s+/g, "_") || "UNKNOWN";

      // Merge Step 1 form claim inputs directly into claims to guarantee Step 2 is fully filled
      const mergedClaims: ClaimLedger = {
        stock: {
          value: state.stockName.trim() || parsed.claims.stock.value || null,
          status: (state.stockName.trim() || parsed.claims.stock.value) ? "EXTRACTED" : "NOT_STATED",
          evidence: parsed.claims.stock.evidence,
          note: parsed.claims.stock.note,
        },
        direction: (claimDirection || parsed.claims.direction.value) ? {
          value: (claimDirection || parsed.claims.direction.value) as TipDirection,
          status: "EXTRACTED",
          evidence: parsed.claims.direction.evidence,
        } : parsed.claims.direction,
        target_price: (claimTargetPrice || parsed.claims.target_price.value !== null) ? {
          value: claimTargetPrice ? Number(claimTargetPrice) : parsed.claims.target_price.value,
          status: "EXTRACTED",
          note: "Creator's claimed target price only; not an application conclusion.",
          evidence: parsed.claims.target_price.evidence,
        } : parsed.claims.target_price,
        deadline: (claimDeadline.trim() || parsed.claims.deadline.value) ? {
          value: claimDeadline.trim() || parsed.claims.deadline.value,
          status: "EXTRACTED",
          evidence: parsed.claims.deadline.evidence,
        } : parsed.claims.deadline,
        stop_loss: claimStopLossGated ? {
          value: null,
          status: "NOT_STATED",
          gated: true,
          note: "Stop-loss is gated behind a paid/VIP tier rather than stated openly.",
          evidence: parsed.claims.stop_loss.evidence,
        } : (claimStopLoss || parsed.claims.stop_loss.value !== null) ? {
          value: claimStopLoss ? Number(claimStopLoss) : parsed.claims.stop_loss.value,
          status: "EXTRACTED",
          gated: false,
          evidence: parsed.claims.stop_loss.evidence,
        } : parsed.claims.stop_loss,
      };

      setParseResult({ ...parsed, claims: mergedClaims }, finalTicker);
      updateClaims(mergedClaims);

      if (parsed.extracted_text && !state.rawText) {
        setRawText(parsed.extracted_text);
      }
      if (!state.stockName && mergedClaims.stock.value) {
        setStockName(mergedClaims.stock.value, finalTicker);
      }
      recordSessionRun({
        id: `${state.influencerName || "creator"}-${finalTicker}-${state.tipDate}`,
        influencerName: state.influencerName || "Not stated",
        instrumentName: state.stockName || mergedClaims.stock.value || finalTicker,
        ticker: finalTicker,
        tipDate: state.tipDate,
        inputMode: state.inputMode,
        sebiStatus: "Checked in session",
      });
      setMaxUnlocked((prev) => Math.max(prev, 2));
      setStep(2);
    },
    onError: (err: Error) => {
      // Never block structured lookup on parser failure!
      setSubmitError(
        `${err.message} — You can still continue directly to SEBI & Market Checks using your entered influencer and stock name.`
      );
    },
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setUploadedFile(file);
  }

  function handleStep1Submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let textToSubmit = state.rawText.trim();
    if (!textToSubmit && state.stockName.trim()) {
      const stock = state.stockName.trim();
      const dir = claimDirection === "BULLISH" ? "Buy now" : claimDirection === "BEARISH" ? "Sell now" : "Looking at";
      const tgt = claimTargetPrice ? `Target: ₹${claimTargetPrice}` : "";
      const dl = claimDeadline.trim() ? `in ${claimDeadline.trim()}` : "";
      const sl = claimStopLossGated ? "SL PAID in VIP group" : claimStopLoss ? `SL: ₹${claimStopLoss}` : "";
      textToSubmit = [stock, dir, tgt, dl, sl].filter(Boolean).join(" ");
      setRawText(textToSubmit);
    }

    if (!textToSubmit && !state.uploadedFile && !state.stockName.trim() && !state.selectedDemoCaseId && !claimTargetPrice) {
      setSubmitError("Upload a photo/video, paste a tip, select a demo sample, or enter stock and claim details to begin.");
      return;
    }
    setSubmitError(null);
    parseMutation.mutate({
      text: textToSubmit,
      influencer_name: state.influencerName,
      stock_name: state.stockName,
      demo_case_id: state.selectedDemoCaseId ?? undefined,
      file: state.uploadedFile,
    });
  }

  function goToStep(next: 1 | 2 | 3 | 4 | 5) {
    setMaxUnlocked((prev) => Math.max(prev, next));
    setStep(next);
  }

  const activeClaims = state.editedClaims ?? state.parseResult?.claims ?? null;

  return (
    <div className="space-y-6">
      {/* Header & Progress Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[24px] font-semibold tracking-[-0.02em] text-[#161A18]">
            Tip Autopsy Workspace
          </h1>
          <p className="mt-1 mb-0 text-[13.5px] text-[#4A524D]">
            Inspect one tip at a time with dated snapshots and neutral evidence labels.
          </p>
        </div>

        <Button
          variant="ghost"
          onClick={() => {
            resetSession();
            setMaxUnlocked(1);
            setSubmitError(null);
            setClaimDirection("");
            setClaimTargetPrice("");
            setClaimDeadline("");
            setClaimStopLoss("");
            setClaimStopLossGated(false);
          }}
        >
          <ArrowCounterClockwise size={16} weight="regular" aria-hidden="true" />
          <span>Reset Session</span>
        </Button>
      </div>

      <ProgressSteps
        activeStep={state.activeStep}
        maxUnlockedStep={maxUnlocked}
        onSelectStep={setStep}
      />

      {/* STEP 1 — MULTIMODAL & STRUCTURED INPUT */}
      {state.activeStep === 1 && (
        <form onSubmit={handleStep1Submit} className="grid gap-5 lg:grid-cols-12">
          <GlassCard className="space-y-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="m-0 text-[18px] font-semibold text-[#161A18]">
                  Step 1 — Submit Tip &amp; Claim Information
                </h2>
                <p className="mt-1 mb-0 text-[12.5px] text-[#4A524D]">
                  Enter the tip details and claim parameters below. These will automatically fill the Step 2 Claim Ledger.
                </p>
              </div>
              <StatusBadge tone="unverified" label="Processed transiently · Not saved" />
            </div>

            {/* Mode Segmented Tabs */}
            <div
              role="tablist"
              aria-label="Tip input mode"
              className="inline-flex w-full rounded-xl bg-[#F3F0EA] p-1 sm:w-auto"
            >
              {(
                [
                  { id: "text", label: "Paste Text", icon: TextAa },
                  { id: "photo", label: "Photo", icon: ImageIcon },
                  { id: "video", label: "Video", icon: FilmStrip },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={state.inputMode === id}
                  onClick={() => setInputMode(id)}
                  className={`flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-[13.5px] font-semibold transition-all sm:flex-none ${
                    state.inputMode === id
                      ? "bg-white text-[#161A18] shadow-[0_2px_8px_rgba(22,26,24,0.08)]"
                      : "text-[#4A524D] hover:text-[#161A18]"
                  }`}
                >
                  <Icon size={16} weight="regular" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Photo / Video Upload Dropzone */}
            {(state.inputMode === "photo" || state.inputMode === "video") && (
              <div className="space-y-3">
                <label
                  htmlFor="media-file-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-[rgba(22,26,24,0.18)] bg-[rgba(250,248,244,0.65)] px-5 py-6 text-center transition-colors hover:border-[#4A7C64]"
                >
                  <CloudArrowUp
                    size={28}
                    weight="duotone"
                    className="text-[#4A7C64]"
                    aria-hidden="true"
                  />
                  <span className="mt-2 text-[14px] font-semibold text-[#161A18]">
                    {state.inputMode === "photo"
                      ? "Upload Telegram / WhatsApp screenshot (.jpeg, .png, .webp · max 8 MB)"
                      : "Upload finfluencer Reel / clip (.mp4, .webm, .mov · max 25 MB)"}
                  </span>
                  <span className="mt-1 text-[12px] text-[#6E7771]">
                    Transient in-memory buffer only · Discarded immediately after parsing
                  </span>
                  <input
                    id="media-file-upload"
                    type="file"
                    accept={
                      state.inputMode === "photo"
                        ? "image/jpeg,image/png,image/webp"
                        : "video/mp4,video/webm,video/quicktime"
                    }
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>

                {state.mediaPreviewUrl && (
                  <div className="relative overflow-hidden rounded-2xl border border-[rgba(22,26,24,0.1)] bg-[#EFECE6] p-2">
                    {state.inputMode === "photo" ? (
                      <img
                        src={state.mediaPreviewUrl}
                        alt="Transient uploaded tip screenshot preview"
                        className="max-h-[220px] w-full rounded-xl object-contain"
                      />
                    ) : (
                      <video
                        src={state.mediaPreviewUrl}
                        controls
                        muted
                        playsInline
                        className="max-h-[220px] w-full rounded-xl"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      aria-label="Remove uploaded media"
                      className="absolute top-3.5 right-3.5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#161A18]/80 text-white hover:bg-[#161A18]"
                    >
                      <Trash size={16} weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <TextAreaField
              id="tip-source-text"
              label="Tip text or transcript (Hinglish / English)"
              value={state.rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                const extracted = extractQuickClaims(e.target.value);
                if (extracted.direction && !claimDirection) setClaimDirection(extracted.direction);
                if (extracted.targetPrice && !claimTargetPrice) setClaimTargetPrice(extracted.targetPrice);
                if (extracted.deadline && !claimDeadline) setClaimDeadline(extracted.deadline);
                if (extracted.stopLoss && !claimStopLoss) setClaimStopLoss(extracted.stopLoss);
                if (extracted.stopLossGated) setClaimStopLossGated(true);
              }}
              placeholder="Paste the Telegram/WhatsApp forward or caption here (e.g., Guaranteed 2x in 10 days! SL PAID...)"
              hint="Optional if you prefer direct Influencer + Stock structured lookup."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="influencer-name-input"
                label="Influencer name, handle, or SEBI reg. no."
                value={state.influencerName}
                onChange={(e) => setInfluencerName(e.target.value)}
                placeholder="e.g., Rakesh Bansal, Trading cafe India, INH100008984"
              />
              <div className="space-y-1.5">
                <TextField
                  id="stock-name-input"
                  label="Stock or instrument name"
                  value={state.stockName}
                  onChange={(e) => setStockName(e.target.value, "")}
                  placeholder="e.g., Borosil Renewables Ltd, Wipro, Sensex 82900 CE"
                  list="tip-autopsy-stock-catalogue"
                />
                <datalist id="tip-autopsy-stock-catalogue">
                  {(stocksQuery.data ?? []).map((s) => (
                    <option key={s.ticker} value={s.company_name}>
                      {s.ticker} ({s.instrument_type})
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="tip-date-input"
                type="date"
                label="Tip publication date"
                value={state.tipDate}
                onChange={(e) => setTipDate(e.target.value)}
                hint="Used for pre-tip run-up and tip-day volume checks."
              />
            </div>

            {/* CLAIM LEDGER FORM FIELDS (Pre-fills Step 2 Automatically) */}
            <div className="rounded-2xl border border-[rgba(74,124,100,0.22)] bg-[rgba(244,248,246,0.6)] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-[14.5px] font-semibold text-[#161A18] flex items-center gap-2">
                    <ShieldCheck size={18} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
                    Claim Ledger Form (Direct Entry for Step 2)
                  </h3>
                  <p className="mt-0.5 mb-0 text-[12px] text-[#4A524D]">
                    Enter the claim parameters below. These will automatically populate the Structured Claim Ledger on Step 2.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Direction Claimed */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-[#161A18] mb-1.5">
                    Direction Claimed
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#EFECE6] p-1">
                    {(["BULLISH", "BEARISH", "NEUTRAL"] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => setClaimDirection(dir === claimDirection ? "" : dir)}
                        className={`cursor-pointer rounded-lg py-1.5 text-center text-[12px] font-semibold transition-all ${
                          claimDirection === dir
                            ? dir === "BULLISH"
                              ? "bg-[#285A44] text-white shadow-sm"
                              : dir === "BEARISH"
                              ? "bg-[#8A3B14] text-white shadow-sm"
                              : "bg-[#161A18] text-white shadow-sm"
                            : "text-[#4A524D] hover:text-[#161A18]"
                        }`}
                      >
                        {dir === "BULLISH" ? "Buy / Bullish" : dir === "BEARISH" ? "Sell / Bearish" : "Neutral"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Price */}
                <div>
                  <label htmlFor="step1-target-price" className="block text-[12.5px] font-semibold text-[#161A18] mb-1.5">
                    Target Price (Creator&apos;s Claim Only)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[14px] font-semibold text-[#6E7771]">
                      ₹
                    </span>
                    <input
                      id="step1-target-price"
                      type="number"
                      step="any"
                      value={claimTargetPrice}
                      onChange={(e) => setClaimTargetPrice(e.target.value)}
                      placeholder="e.g. 680"
                      className="h-10 w-full rounded-xl border border-[rgba(22,26,24,0.16)] bg-white pl-8 pr-3 text-[13.5px] text-[#161A18] placeholder:text-[#9A9F9C] focus:border-[#4A7C64] focus:outline-none focus:ring-2 focus:ring-[#4A7C64]/20"
                    />
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <label htmlFor="step1-deadline" className="block text-[12.5px] font-semibold text-[#161A18] mb-1.5">
                    Stated Deadline / Horizon
                  </label>
                  <input
                    id="step1-deadline"
                    type="text"
                    value={claimDeadline}
                    onChange={(e) => setClaimDeadline(e.target.value)}
                    placeholder="e.g. 10 days, 2 weeks, Intraday"
                    className="h-10 w-full rounded-xl border border-[rgba(22,26,24,0.16)] bg-white px-3 text-[13.5px] text-[#161A18] placeholder:text-[#9A9F9C] focus:border-[#4A7C64] focus:outline-none focus:ring-2 focus:ring-[#4A7C64]/20"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {["Intraday", "10 days", "2 weeks", "1 month"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setClaimDeadline(preset)}
                        className="rounded-md border border-[rgba(22,26,24,0.1)] bg-white px-2 py-0.5 text-[11px] text-[#4A524D] hover:bg-[#E6F2EC] hover:text-[#1F4D3A] cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stop-Loss */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="step1-stop-loss" className="block text-[12.5px] font-semibold text-[#161A18]">
                      Stop-Loss Level
                    </label>
                    <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#9A5B13] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={claimStopLossGated}
                        onChange={(e) => {
                          setClaimStopLossGated(e.target.checked);
                          if (e.target.checked) setClaimStopLoss("");
                        }}
                        className="rounded border-[rgba(22,26,24,0.25)] text-[#4A7C64] focus:ring-[#4A7C64]"
                      />
                      <span>Gated (SL PAID)</span>
                    </label>
                  </div>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[14px] font-semibold text-[#6E7771]">
                      ₹
                    </span>
                    <input
                      id="step1-stop-loss"
                      type="number"
                      step="any"
                      disabled={claimStopLossGated}
                      value={claimStopLossGated ? "" : claimStopLoss}
                      onChange={(e) => setClaimStopLoss(e.target.value)}
                      placeholder={claimStopLossGated ? "Stop-loss hidden in VIP group" : "e.g. 590"}
                      className={`h-10 w-full rounded-xl border border-[rgba(22,26,24,0.16)] pl-8 pr-3 text-[13.5px] text-[#161A18] placeholder:text-[#9A9F9C] focus:border-[#4A7C64] focus:outline-none focus:ring-2 focus:ring-[#4A7C64]/20 ${
                        claimStopLossGated ? "bg-[#FDF3E4]/70 text-[#9A5B13] italic" : "bg-white"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-2xl border border-[rgba(154,91,19,0.28)] bg-[#FDF3E4] p-3.5 text-[13.5px] text-[#9A5B13]"
              >
                <div className="flex items-start gap-2">
                  <WarningCircle size={18} weight="duotone" className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
                {effectiveTicker && (
                  <Button
                    variant="secondary"
                    className="self-start h-9 text-[12.5px]"
                    onClick={() => goToStep(3)}
                  >
                    Continue with Influencer + Stock Lookup
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button type="submit" size="lg" disabled={parseMutation.isPending}>
                <span>{parseMutation.isPending ? "Analyzing..." : "Run Tip Autopsy"}</span>
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </Button>
            </div>
          </GlassCard>

          {/* One-Click Curated Hinglish Demo Samples Sidebar */}
          <GlassCard className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-[17px] font-semibold text-[#161A18]">
                One-Click Curated Samples
              </h2>
              <ProvenancePill label="Curated Demo · Mixed" />
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-[#4A524D]">
              Select any preloaded screenshot from <code>photos/</code> or video clip from{" "}
              <code>videos/</code> to test equity checks, derivative <em>Could not verify</em>{" "}
              scoping, gated stop-losses, and SEBI lookup.
            </p>

            <div className="space-y-2.5">
              {(demoCasesQuery.data ?? []).map((demo) => {
                const selected = state.selectedDemoCaseId === demo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      loadDemoCase(demo);
                      const extracted = extractQuickClaims(demo.sample_text);
                      setClaimDirection(extracted.direction);
                      setClaimTargetPrice(extracted.targetPrice);
                      setClaimDeadline(extracted.deadline);
                      setClaimStopLoss(extracted.stopLoss);
                      setClaimStopLossGated(extracted.stopLossGated);
                    }}
                    className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      selected
                        ? "border-[#4A7C64] bg-[#E6F2EC]/65 shadow-sm"
                        : "border-[rgba(22,26,24,0.08)] bg-white/80 hover:border-[rgba(74,124,100,0.35)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[14px] font-semibold text-[#161A18]">
                        {demo.instrument_name}
                      </p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-[#4A524D]">
                        {demo.influencer_name}
                        {demo.alias ? ` (${demo.alias})` : ""} · {demo.media_type}
                      </p>
                      <p className="mt-1 mb-0 text-[11.5px] text-[#6E7771]">{demo.coverage_note}</p>
                    </div>
                    <StatusBadge
                      tone={demo.instrument_type === "DERIVATIVE" ? "unverified" : "neutral_ok"}
                      label={demo.instrument_type}
                    />
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </form>
      )}

      {/* STEP 2 — CLAIM LEDGER & LANGUAGE AUDIT */}
      {state.activeStep === 2 && (
        <div className="space-y-5">
          {state.parseResult?.media_intake.notice && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[rgba(74,124,100,0.25)] bg-[#E6F2EC]/70 px-4 py-3 text-[13.5px] text-[#1F4D3A]">
              <span>{state.parseResult.media_intake.notice}</span>
              {state.parseResult.media_intake.extraction_mode === "GEMINI_VISION_OCR" && (
                <StatusBadge tone="neutral_ok" label="Transient Vision OCR · Image discarded" />
              )}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-12">
            {/* Structured Claim Ledger */}
            <GlassCard className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-[18px] font-semibold text-[#161A18]">
                  Step 2 — Structured Claim Ledger
                </h2>
                <StatusBadge
                  tone="unverified"
                  label={`Parser: ${state.parseResult?.parser.version ?? "claim-parser-v1"}`}
                />
              </div>

              <div className="divide-y divide-[rgba(22,26,24,0.08)] rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/85">
                {/* Stock */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="m-0 text-[12px] font-semibold text-[#6E7771] uppercase">
                      Stock / Instrument
                    </p>
                    <p className="mt-0.5 mb-0 text-[15px] font-semibold text-[#161A18]">
                      {activeClaims?.stock.value ?? "Not stated"}
                    </p>
                  </div>
                  <StatusBadge
                    tone={activeClaims?.stock.status === "EXTRACTED" ? "neutral_ok" : "unverified"}
                    label={
                      activeClaims?.stock.status === "EXTRACTED"
                        ? "Extracted from text"
                        : activeClaims?.stock.status === "UNCLEAR"
                          ? "Unclear / User entered"
                          : "Not stated"
                    }
                  />
                </div>

                {/* Direction */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="m-0 text-[12px] font-semibold text-[#6E7771] uppercase">
                      Direction Claimed
                    </p>
                    <p className="mt-0.5 mb-0 text-[15px] font-semibold text-[#161A18]">
                      {activeClaims?.direction.value ?? "Not stated"}
                    </p>
                  </div>
                  <StatusBadge
                    tone={activeClaims?.direction.status === "EXTRACTED" ? "neutral_ok" : "unverified"}
                    label={activeClaims?.direction.status === "EXTRACTED" ? "Extracted" : "Not stated"}
                  />
                </div>

                {/* Target Price (strictly labelled Creator's claim) */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="m-0 text-[12px] font-semibold text-[#6E7771] uppercase">
                      Target Price (Creator&apos;s claim only)
                    </p>
                    <p className="tabular-nums-lining mt-0.5 mb-0 text-[15px] font-semibold text-[#161A18]">
                      {activeClaims?.target_price.value !== null &&
                      activeClaims?.target_price.value !== undefined
                        ? `₹${activeClaims.target_price.value}`
                        : "Not stated"}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      activeClaims?.target_price.status === "EXTRACTED" ? "attention" : "unverified"
                    }
                    label={
                      activeClaims?.target_price.status === "EXTRACTED"
                        ? "Creator's claim"
                        : "Not stated"
                    }
                  />
                </div>

                {/* Deadline */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="m-0 text-[12px] font-semibold text-[#6E7771] uppercase">
                      Stated Deadline / Horizon
                    </p>
                    <p className="mt-0.5 mb-0 text-[15px] font-semibold text-[#161A18]">
                      {activeClaims?.deadline.value ?? "Not stated"}
                    </p>
                  </div>
                  <StatusBadge
                    tone={activeClaims?.deadline.status === "EXTRACTED" ? "neutral_ok" : "unverified"}
                    label={
                      activeClaims?.deadline.status === "EXTRACTED"
                        ? "Extracted"
                        : activeClaims?.deadline.status === "UNCLEAR"
                          ? "Unclear"
                          : "Not stated"
                    }
                  />
                </div>

                {/* Stop-Loss */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="m-0 text-[12px] font-semibold text-[#6E7771] uppercase">
                      Stop-Loss Level
                    </p>
                    <p className="tabular-nums-lining mt-0.5 mb-0 text-[15px] font-semibold text-[#161A18]">
                      {activeClaims?.stop_loss.value !== null &&
                      activeClaims?.stop_loss.value !== undefined
                        ? `₹${activeClaims.stop_loss.value}`
                        : "Not stated"}
                    </p>
                    {activeClaims?.stop_loss.gated && (
                      <p className="mt-0.5 mb-0 text-[12px] font-medium text-[#9A5B13]">
                        Gated behind paid/VIP group ({activeClaims.stop_loss.evidence?.text})
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    tone={
                      activeClaims?.stop_loss.status === "EXTRACTED" ? "neutral_ok" : "attention"
                    }
                    label={
                      activeClaims?.stop_loss.gated
                        ? "Not stated (Gated)"
                        : activeClaims?.stop_loss.status === "EXTRACTED"
                          ? "Stated"
                          : "Not stated"
                    }
                  />
                </div>
              </div>
            </GlassCard>

            {/* Quoted Source Text + Hype Detector + Disclosure Grade */}
            <div className="space-y-5 lg:col-span-5">
              <GlassCard className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Quotes size={18} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
                    <h3 className="m-0 text-[16px] font-semibold text-[#161A18]">
                      Creator&apos;s Quoted Text &amp; Hype Cues
                    </h3>
                  </div>
                  <StatusBadge
                    tone={(state.parseResult?.hype_flags.length ?? 0) > 0 ? "attention" : "neutral_ok"}
                    label={`${state.parseResult?.hype_flags.length ?? 0} hype cues`}
                  />
                </div>

                <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] p-3.5">
                  <HighlightedSourceText
                    text={state.parseResult?.extracted_text || state.rawText}
                    hypeFlags={state.parseResult?.hype_flags ?? []}
                  />
                </div>
                <p className="m-0 text-[12px] text-[#6E7771]">
                  Highlighted phrases are descriptive evidence of promotional/urgency wording—not
                  proof of manipulation.
                </p>
              </GlassCard>

              <GlassCard className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-[16px] font-semibold text-[#161A18]">
                    Sponsorship Disclosure Grade
                  </h3>
                  <StatusBadge
                    tone={
                      state.parseResult?.disclosure_grade.grade === "CLEAR"
                        ? "neutral_ok"
                        : state.parseResult?.disclosure_grade.grade === "VAGUE"
                          ? "attention"
                          : "unverified"
                    }
                    label={
                      state.parseResult?.disclosure_grade.grade === "CLEAR"
                        ? "Clear disclosure"
                        : state.parseResult?.disclosure_grade.grade === "VAGUE"
                          ? "Vague"
                          : state.parseResult?.disclosure_grade.grade === "NONE"
                            ? "None"
                            : "Unclear"
                    }
                  />
                </div>
                <p className="m-0 text-[13.5px] leading-relaxed text-[#4A524D]">
                  {state.parseResult?.disclosure_grade.explanation ??
                    "Classification unavailable without source text."}
                </p>
                <p className="m-0 text-[12px] text-[#6E7771]">
                  Method: {state.parseResult?.disclosure_grade.method_version ?? "disclosure-v1"} ·
                  Plain <code>#ad</code> baseline:{" "}
                  {state.parseResult?.disclosure_grade.plain_ad_baseline_matched
                    ? "Matched"
                    : "Not present"}
                </p>
              </GlassCard>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} weight="regular" aria-hidden="true" />
              <span>Back to Input</span>
            </Button>
            <Button size="lg" onClick={() => goToStep(3)}>
              <span>Inspect SEBI &amp; Market Checks</span>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — SEBI IDENTITY, 5 DETERMINISTIC CHECKS & TRACK RECORD */}
      {state.activeStep === 3 && (
        <div className="space-y-5">
          {/* Top Row: SEBI Snapshot + Creator Track Record */}
          <div className="grid gap-5 lg:grid-cols-12">
            <GlassCard className="space-y-3 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
                  <h2 className="m-0 text-[18px] font-semibold text-[#161A18]">
                    SEBI Register Snapshot Lookup
                  </h2>
                </div>
                {sebiQuery.data && (
                  <StatusBadge
                    tone={sebiQuery.data.status === "REGISTERED" ? "neutral_ok" : "unverified"}
                    label={
                      sebiQuery.data.status === "REGISTERED"
                        ? "Registered"
                        : sebiQuery.data.status === "NOT_FOUND"
                          ? "Not found in SEBI register"
                          : "Unclear"
                    }
                  />
                )}
              </div>

              {sebiQuery.isLoading && <div className="skeleton-shimmer h-20 w-full rounded-xl" />}

              {sebiQuery.data && (
                <>
                  <p className="m-0 text-[14px] font-medium text-[#161A18]">
                    Query: <span className="font-semibold">{sebiQuery.data.query || "Not stated"}</span>
                    {sebiQuery.data.registration_no && (
                      <span className="tabular-nums-lining ml-2 rounded-lg bg-[#E6F2EC] px-2 py-0.5 text-[12.5px] font-semibold text-[#1F4D3A]">
                        {sebiQuery.data.registration_no} ({sebiQuery.data.category})
                      </span>
                    )}
                  </p>
                  <p className="m-0 text-[13.5px] leading-relaxed text-[#4A524D]">
                    {sebiQuery.data.explanation}
                  </p>
                  <ProvenancePill
                    label={mapDataLabel(sebiQuery.data.data_label)}
                    asOfDate={sebiQuery.data.snapshot_date ?? undefined}
                  />
                </>
              )}
            </GlassCard>

            {/* Creator Track Record (Beta-Binomial Credible Interval) */}
            <GlassCard className="space-y-3 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-[18px] font-semibold text-[#161A18]">
                  Creator Track Record (vs. NIFTY 50)
                </h2>
                {checksQuery.data && (
                  <StatusBadge
                    tone={
                      checksQuery.data.track_record.status === "INTERVAL_AVAILABLE"
                        ? "neutral_ok"
                        : "unverified"
                    }
                    label={
                      checksQuery.data.track_record.status === "INTERVAL_AVAILABLE" &&
                      checksQuery.data.track_record.credible_interval
                        ? `${Math.round(checksQuery.data.track_record.credible_interval.lower * 100)}% to ${Math.round(checksQuery.data.track_record.credible_interval.upper * 100)}% (95% CI)`
                        : "Not enough tips to judge"
                    }
                  />
                )}
              </div>

              {checksQuery.isLoading && <div className="skeleton-shimmer h-20 w-full rounded-xl" />}

              {checksQuery.data && (
                <>
                  <p className="m-0 text-[13.5px] leading-relaxed text-[#4A524D]">
                    {checksQuery.data.track_record.explanation}
                  </p>
                  <div className="tabular-nums-lining flex flex-wrap gap-3 text-[12px] text-[#6E7771]">
                    <span>Resolved: {checksQuery.data.track_record.resolved_count}</span>
                    <span>Excluded: {checksQuery.data.track_record.excluded_count}</span>
                    <span>Min policy: {checksQuery.data.track_record.minimum_sample_policy}</span>
                    <span>Method: {checksQuery.data.track_record.method_version}</span>
                  </div>
                  <ProvenancePill
                    label={mapDataLabel(checksQuery.data.track_record.data_label)}
                    asOfDate={checksQuery.data.track_record.as_of_date ?? undefined}
                  />
                </>
              )}
            </GlassCard>
          </div>

          {/* Five Deterministic Market & Lateness Checks */}
          <section aria-labelledby="five-checks-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="five-checks-heading"
                className="m-0 text-[18px] font-semibold tracking-[-0.015em] text-[#161A18]"
              >
                Five Deterministic Market &amp; Lateness Checks ({checksQuery.data?.company_name ?? effectiveTicker})
              </h2>
              {checksQuery.data && (
                <StatusBadge tone="unverified" label={checksQuery.data.instrument_type} />
              )}
            </div>

            {checksQuery.isLoading && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton-shimmer h-44 rounded-2xl" />
                ))}
              </div>
            )}

            {checksQuery.data && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {checksQuery.data.checks.map((check) => (
                  <GlassCard key={check.check_id} compact className="flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <p className="m-0 text-[12.5px] font-semibold text-[#4A524D]">{check.label}</p>
                      <StatusBadge
                        tone={mapCheckTone(check.status)}
                        label={mapCheckLabel(check.status)}
                      />
                      <p className="tabular-nums-lining m-0 pt-1 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
                        {check.measured_value !== null ? String(check.measured_value) : "—"}
                        {check.unit === "x_average_volume" && check.measured_value !== null ? "x" : ""}
                        {check.unit === "percent" && check.measured_value !== null ? "%" : ""}
                        {check.unit === "INR_Cr_avg_daily_value" && check.measured_value !== null
                          ? " Cr"
                          : ""}
                      </p>
                      <p className="m-0 text-[12.5px] leading-relaxed text-[#4A524D]">
                        {check.explanation}
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-[rgba(22,26,24,0.07)] pt-2.5">
                      <ProvenancePill
                        label={mapDataLabel(check.data_label)}
                        asOfDate={check.as_of_date ?? undefined}
                      />
                      <details className="text-[11.5px] text-[#6E7771]">
                        <summary className="cursor-pointer font-semibold text-[#4A524D] hover:text-[#161A18]">
                          Method &amp; source details
                        </summary>
                        <div className="mt-1.5 space-y-1 rounded-lg bg-[#FAF8F4] p-2">
                          <p className="m-0">Method: {check.method_version}</p>
                          <p className="m-0">Source: {check.source_name ?? "Not available"}</p>
                          <p className="m-0 break-all">
                            Snapshot ID: {check.source_snapshot_id ?? "None"}
                          </p>
                        </div>
                      </details>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Optional Synthetic Coordinated-Promotion Demo Signal (Task 3.4 — Strictly Separate from 5 Core Checks) */}
            {coordinatedDemoQuery.data && (
              <details className="rounded-2xl border border-[rgba(22,26,24,0.1)] bg-[rgba(255,255,255,0.68)] p-4">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-[14px] font-semibold text-[#161A18]">
                  <span>
                    Optional Demo Signal: Cross-Channel Burst Example (Separate from Core 5 Checks)
                  </span>
                  <StatusBadge tone="unverified" label="Synthetic / Demo Only" />
                </summary>
                <div className="mt-3 space-y-3 border-t border-[rgba(22,26,24,0.08)] pt-3 text-[13px] text-[#4A524D]">
                  <p className="m-0 font-medium text-[#161A18]">
                    {coordinatedDemoQuery.data.what_this_shows}
                  </p>
                  {coordinatedDemoQuery.data.events.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {coordinatedDemoQuery.data.events.map((ev) => (
                        <div
                          key={`${ev.channel_label}-${ev.posted_at_iso}`}
                          className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] p-2.5 text-[12px]"
                        >
                          <p className="m-0 font-semibold text-[#161A18]">{ev.channel_label}</p>
                          <p className="tabular-nums-lining m-0 text-[#6E7771]">
                            {ev.posted_at_iso}
                          </p>
                          <p className="tabular-nums-lining m-0 text-[#4A524D]">
                            Phrase overlap: {Math.round(ev.phrase_overlap_jaccard * 100)}% ·
                            Synthetic
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <ul className="m-0 space-y-1 pl-4 text-[12px] text-[#6E7771]">
                    {coordinatedDemoQuery.data.limitations.map((lim) => (
                      <li key={lim}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={16} weight="regular" aria-hidden="true" />
              <span>Back to Claim Ledger</span>
            </Button>
            <Button size="lg" onClick={() => goToStep(4)}>
              <span>Open Time Machine &amp; Information Verdict</span>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — TIP TIME MACHINE & INFORMATION VERDICT (GUARDED FACTS CARD) */}
      {state.activeStep === 4 && (
        <div className="space-y-5">
          <TipTimeMachine
            ticker={effectiveTicker}
            influencerId={sebiQuery.data?.influencer_id ?? null}
            selectedDate={state.selectedMarkerDate}
            onSelectDate={setSelectedMarkerDate}
          />

          {/* Guarded Facts Card / Information Verdict */}
          <GlassCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-[#161A18]">
                  {reportQuery.data?.information_verdict_title ?? "Information & Evidence Verdict"}
                </h2>
                <p className="mt-0.5 mb-0 text-[13px] text-[#4A524D]">
                  Assembled from allowlisted templates and verified snapshot values only.
                </p>
              </div>
              {reportQuery.data && (
                <StatusBadge
                  tone={reportQuery.data.guard_status === "PASSED" ? "neutral_ok" : "attention"}
                  label={
                    reportQuery.data.guard_status === "PASSED"
                      ? "Output Guard: Passed"
                      : "Output Guard: Safe Fallback"
                  }
                />
              )}
            </div>

            {reportQuery.isLoading && <div className="skeleton-shimmer h-40 w-full rounded-2xl" />}

            {reportQuery.data && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {reportQuery.data.sections.map((section) => (
                    <article
                      key={section.section_id}
                      className="space-y-1.5 rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/88 p-4"
                    >
                      <h3 className="m-0 text-[14px] font-semibold text-[#161A18]">
                        {section.title}
                      </h3>
                      <p className="m-0 text-[13.5px] leading-relaxed text-[#4A524D]">
                        {section.sentence}
                      </p>
                      {section.as_of_date && (
                        <div className="pt-1">
                          <ProvenancePill
                            label={mapDataLabel(section.data_label)}
                            asOfDate={section.as_of_date}
                          />
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                {/* Visibly Separated Creator's Original Quoted Claim */}
                {reportQuery.data.creator_quoted_claim.quoted_text && (
                  <div className="rounded-2xl border border-[rgba(22,26,24,0.1)] bg-[#F3F0EA]/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
                        {reportQuery.data.creator_quoted_claim.label}
                      </span>
                      {reportQuery.data.creator_quoted_claim.target_price_claimed !== null && (
                        <span className="tabular-nums-lining rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold text-[#161A18]">
                          Creator&apos;s claimed target: ₹
                          {reportQuery.data.creator_quoted_claim.target_price_claimed}
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-2 mb-1 font-mono text-[13px] leading-relaxed text-[#161A18]"
                      // Escaped by backend; rendered as plain text node
                    >
                      {state.parseResult?.extracted_text || state.rawText}
                    </p>
                    <p className="m-0 text-[12px] text-[#6E7771]">
                      {reportQuery.data.creator_quoted_claim.disclaimer}
                    </p>
                  </div>
                )}

                <p className="m-0 rounded-xl border border-[rgba(74,124,100,0.2)] bg-[#E6F2EC]/60 px-4 py-3 text-[13px] font-medium text-[#1F4D3A]">
                  {reportQuery.data.mandatory_disclaimer}
                </p>

                {/* Optional Guarded Voice Readout (Task 3.3 — Reads Guarded Text Only) */}
                <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(22,26,24,0.08)] bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[#161A18]">
                      <SpeakerHigh size={17} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
                      <span>Optional Voice Readout (Guarded Text Only)</span>
                    </div>
                    <p className="m-0 text-[12px] text-[#6E7771]">
                      Reads only the already-guarded Information Verdict above. Voice outages never
                      affect the text analysis.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="voice-language-select" className="sr-only">
                      Voice readout language
                    </label>
                    <select
                      id="voice-language-select"
                      value={voiceLang}
                      onChange={(e) => setVoiceLang(e.target.value as SupportedVoiceLanguage)}
                      className="h-10 rounded-xl border border-[rgba(22,26,24,0.12)] bg-white px-3 text-[13px] font-medium text-[#161A18]"
                    >
                      <option value="en-IN">English (India)</option>
                      <option value="hi-IN">Hindi (हिन्दी)</option>
                      <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                    </select>
                    <Button
                      variant="secondary"
                      className="h-10 px-4 text-[13px]"
                      disabled={voiceMutation.isPending}
                      onClick={() => {
                        const guardedSummary = reportQuery.data.sections
                          .map((s) => s.sentence)
                          .join(" ");
                        voiceMutation.mutate({
                          guarded_text: guardedSummary,
                          language: voiceLang,
                        });
                      }}
                    >
                      {voiceMutation.isPending ? "Preparing..." : "Play Summary"}
                    </Button>
                  </div>
                </div>

                {voiceMutation.data && (
                  <div
                    aria-live="polite"
                    className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] px-3.5 py-2.5 text-[12.5px] text-[#4A524D]"
                  >
                    <p className="m-0">{voiceMutation.data.message}</p>
                    {voiceMutation.data.status === "READY" && voiceMutation.data.audio_base64 && (
                      <audio
                        controls
                        className="mt-2 w-full"
                        src={`data:${voiceMutation.data.mime_type ?? "audio/wav"};base64,${voiceMutation.data.audio_base64}`}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(3)}>
              <ArrowLeft size={16} weight="regular" aria-hidden="true" />
              <span>Back to Checks</span>
            </Button>
            <Button size="lg" onClick={() => goToStep(5)}>
              <span>Proceed to Pause &amp; Plan</span>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5 — PAUSE & PLAN PRE-COMMITMENT GATE */}
      {state.activeStep === 5 && <PauseAndPlanGate />}
    </div>
  );
}
