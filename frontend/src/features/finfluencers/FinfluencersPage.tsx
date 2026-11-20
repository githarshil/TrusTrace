import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  BellRinging,
  CheckCircle,
  MagnifyingGlass,
  PaperPlaneTilt,
  ShieldCheck,
  UsersThree,
  WarningCircle,
  WhatsappLogo,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { TextField } from "../../components/ui/Input";
import { ProvenancePill } from "../../components/ui/ProvenancePill";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  fetchFinfluencers,
  sendFinfluencerTestAlert,
  subscribeFinfluencerWhatsApp,
  syncFinfluencerVideos,
  unsubscribeFinfluencerAlert,
} from "../../lib/apiClient";
import type {
  FinfluencerDirectoryItem,
  SubscriptionSummary,
  TestAlertResponse,
  VideoAnalysisItem,
  WhatsAppProviderKind,
} from "../../types/api";

function formatPublishedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function mapDisclosureTone(
  grade: VideoAnalysisItem["disclosure_grade"]
): { tone: "neutral_ok" | "attention" | "unverified"; label: string } {
  if (grade === "CLEAR") return { tone: "neutral_ok", label: "Clear disclosure" };
  if (grade === "VAGUE") return { tone: "attention", label: "Vague disclosure" };
  if (grade === "NONE") return { tone: "unverified", label: "No disclosure found" };
  return { tone: "unverified", label: "Unclear" };
}

export function FinfluencersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [sebiFilter, setSebiFilter] = useState<"ALL" | "REGISTERED" | "NOT_FOUND">("ALL");
  const [expandedCreatorId, setExpandedCreatorId] = useState<string | null>(null);
  const [previewAlertVideoId, setPreviewAlertVideoId] = useState<string | null>(null);

  // Opt-in WhatsApp Subscribe modal state (strictly transient in-memory)
  const [subscribeTarget, setSubscribeTarget] = useState<FinfluencerDirectoryItem | null>(null);
  const [phoneInput, setPhoneInput] = useState("+91");
  const [provider, setProvider] = useState<WhatsAppProviderKind>("callmebot");
  const [callMeBotKey, setCallMeBotKey] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionSummary | null>(null);
  const [testAlertResult, setTestAlertResult] = useState<TestAlertResponse | null>(null);
  const [unsubscribeMessage, setUnsubscribeMessage] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const finfluencersQuery = useQuery({
    queryKey: ["finfluencers-directory"],
    queryFn: fetchFinfluencers,
  });

  const syncMutation = useMutation({
    mutationFn: (influencerId: string) => syncFinfluencerVideos(influencerId),
    onSuccess: (data) => {
      setSyncNotice(
        `Synced ${data.influencer_name}: checked ${data.fetched_from_rss} official YouTube RSS upload${
          data.fetched_from_rss === 1 ? "" : "s"
        }, analyzed ${data.newly_analyzed} new video${
          data.newly_analyzed === 1 ? "" : "s"
        }, dispatched ${data.alerts_dispatched} guarded WhatsApp alert${
          data.alerts_dispatched === 1 ? "" : "s"
        }.`
      );
      setExpandedCreatorId(data.influencer_id);
      void queryClient.invalidateQueries({ queryKey: ["finfluencers-directory"] });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribeFinfluencerWhatsApp,
    onSuccess: (data) => {
      setActiveSubscription(data.subscription);
      setTestAlertResult(null);
      setUnsubscribeMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["finfluencers-directory"] });
      // Automatically dispatch the first Output-Guarded WhatsApp alert immediately upon subscription
      if (data.subscription.provider !== "dry_run") {
        testAlertMutation.mutate({
          influencerId: data.subscription.influencer_id,
          subscription_id: data.subscription.id,
        });
      }
    },
  });

  const testAlertMutation = useMutation({
    mutationFn: sendFinfluencerTestAlert,
    onSuccess: (data) => {
      setTestAlertResult(data);
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: unsubscribeFinfluencerAlert,
    onSuccess: (data) => {
      if (data.unsubscribed) {
        setUnsubscribeMessage(
          `Unsubscribed ${data.phone_masked ?? "your number"}. You will no longer receive alerts for this creator.`
        );
        setActiveSubscription(null);
        setTestAlertResult(null);
        void queryClient.invalidateQueries({ queryKey: ["finfluencers-directory"] });
      }
    },
  });

  useEffect(() => {
    if (!subscribeTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSubscribeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [subscribeTarget]);

  function openSubscribeModal(creator: FinfluencerDirectoryItem) {
    setSubscribeTarget(creator);
    setPhoneInput("+91");
    setProvider(finfluencersQuery.data?.twilio_whatsapp_configured ? "twilio" : "callmebot");
    setCallMeBotKey("");
    setConsentAccepted(false);
    setActiveSubscription(null);
    setTestAlertResult(null);
    setUnsubscribeMessage(null);
    subscribeMutation.reset();
    testAlertMutation.reset();
  }

  function closeSubscribeModal() {
    setSubscribeTarget(null);
    setCallMeBotKey("");
  }

  function handleSubscribeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscribeTarget || !consentAccepted) return;
    subscribeMutation.mutate({
      influencerId: subscribeTarget.id,
      phone: phoneInput.trim(),
      provider,
      callmebot_api_key: provider === "callmebot" ? callMeBotKey.trim() : undefined,
      consent_accepted: true,
    });
  }

  const creators = useMemo(() => {
    const items = finfluencersQuery.data?.items ?? [];
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (sebiFilter === "REGISTERED" && item.sebi_status !== "REGISTERED") return false;
      if (sebiFilter === "NOT_FOUND" && item.sebi_status !== "NOT_FOUND") return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.handle ?? "").toLowerCase().includes(q) ||
        (item.youtube_handle ?? "").toLowerCase().includes(q) ||
        item.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [finfluencersQuery.data?.items, searchQuery, sebiFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UsersThree size={22} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-[#161A18]">
              Finfluencers &amp; Real-Time YouTube Alerts
            </h1>
            <ProvenancePill
              label="Real · YouTube Official RSS"
              fetchedAtIso={finfluencersQuery.data?.fetched_at ?? null}
            />
          </div>
          <p className="mt-1 mb-0 text-[13.5px] text-[#4A524D]">
            Monitor finfluencers&apos; new YouTube uploads in real time via official zero-cost Atom
            RSS feeds, inspect bounded AI Claim Ledgers &amp; deterministic evidence, and subscribe
            for Output-Guarded WhatsApp alerts.
          </p>
        </div>
      </div>

      {/* Search + SEBI Snapshot Filter Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="glass-card flex flex-1 items-center gap-2.5 rounded-2xl px-4 py-1.5">
          <MagnifyingGlass
            size={18}
            weight="regular"
            className="shrink-0 text-[#6E7771]"
            aria-hidden="true"
          />
          <label htmlFor="finfluencer-search" className="sr-only">
            Search finfluencers by name, handle, or alias
          </label>
          <input
            id="finfluencer-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search finfluencer name, YouTube handle, or channel alias..."
            className="h-9 w-full bg-transparent text-[14px] text-[#161A18] placeholder:text-[#6E7771] focus:outline-none"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by SEBI register snapshot status"
          className="inline-flex rounded-xl bg-[#F3F0EA] p-1"
        >
          {(
            [
              { id: "ALL", label: "All Creators" },
              { id: "REGISTERED", label: "SEBI Registered" },
              { id: "NOT_FOUND", label: "Not Found in Snapshot" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSebiFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${
                sebiFilter === tab.id
                  ? "bg-white text-[#161A18] shadow-[0_2px_8px_rgba(22,26,24,0.08)]"
                  : "text-[#4A524D] hover:text-[#161A18]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Sync Status Notice */}
      {syncNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(31,77,58,0.18)] bg-[#E6F2EC]/85 px-4 py-2.5 text-[13px] text-[#1F4D3A]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={17} weight="duotone" className="shrink-0" aria-hidden="true" />
            <span>{syncNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            aria-label="Dismiss sync notice"
            className="rounded-lg p-1 hover:bg-black/5"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* Creator Directory Cards */}
      {finfluencersQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer h-56 rounded-2xl" />
          ))}
        </div>
      ) : creators.length === 0 ? (
        <GlassCard className="py-10 text-center">
          <UsersThree size={32} weight="duotone" className="mx-auto text-[#4A7C64]" />
          <p className="mt-2 mb-0 text-[14px] font-medium text-[#161A18]">
            No tracked finfluencers matched your filter.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {creators.map((creator) => {
            const isExpanded = expandedCreatorId === creator.id;
            const isSyncingThis =
              syncMutation.isPending && syncMutation.variables === creator.id;

            return (
              <GlassCard key={creator.id} className="flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  {/* Top Row: Identity + SEBI Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(31,77,58,0.16)] bg-[#E6F2EC] text-[14px] font-bold text-[#1F4D3A]"
                      >
                        {creator.avatar_initials}
                      </div>
                      <div className="min-w-0">
                        <h2 className="m-0 text-[16.5px] font-semibold text-[#161A18]">
                          {creator.name}
                        </h2>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[#6E7771]">
                          {creator.youtube_handle && <span>{creator.youtube_handle}</span>}
                          {creator.youtube_channel_url && (
                            <a
                              href={creator.youtube_channel_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[#1F4D3A] hover:underline"
                            >
                              <YoutubeLogo size={14} weight="duotone" aria-hidden="true" />
                              <span>Channel</span>
                              <ArrowSquareOut size={11} weight="regular" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <StatusBadge
                      tone={creator.sebi_status === "REGISTERED" ? "neutral_ok" : "unverified"}
                      label={
                        creator.sebi_status === "REGISTERED" && creator.sebi_registration_no
                          ? `Registered · ${creator.sebi_registration_no}`
                          : "Not found in SEBI register"
                      }
                    />
                  </div>

                  {creator.bio_summary && (
                    <p className="m-0 text-[13px] leading-relaxed text-[#4A524D]">
                      {creator.bio_summary}
                    </p>
                  )}

                  {/* Neutral SEBI Note + Real-Time RSS Status */}
                  <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                        creator.has_realtime_youtube_feed
                          ? "border border-[rgba(31,77,58,0.16)] bg-[#E6F2EC] text-[#1F4D3A]"
                          : "border border-[rgba(22,26,24,0.09)] bg-[#EFECE6] text-[#4A524D]"
                      }`}
                    >
                      <YoutubeLogo size={13} weight="duotone" aria-hidden="true" />
                      {creator.has_realtime_youtube_feed
                        ? "Official YouTube RSS Active"
                        : "Curated Corpus Only"}
                    </span>
                    <span className="tabular-nums-lining rounded-full border border-[rgba(22,26,24,0.08)] bg-white/75 px-2.5 py-0.5 font-medium text-[#4A524D]">
                      {creator.active_subscriber_count} alert subscriber
                      {creator.active_subscriber_count === 1 ? "" : "s"}
                    </span>
                    {creator.sebi_snapshot_date && (
                      <span className="tabular-nums-lining text-[#6E7771]">
                        SEBI snapshot: {creator.sebi_snapshot_date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(22,26,24,0.08)] pt-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => openSubscribeModal(creator)}
                    className="h-10 px-4 text-[13px]"
                  >
                    <WhatsappLogo size={16} weight="duotone" aria-hidden="true" />
                    <span>Subscribe WhatsApp Alerts</span>
                  </Button>

                  {creator.has_realtime_youtube_feed && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      disabled={isSyncingThis}
                      onClick={() => syncMutation.mutate(creator.id)}
                      className="h-10 px-3.5 text-[13px]"
                    >
                      <ArrowsClockwise
                        size={15}
                        weight="regular"
                        className={isSyncingThis ? "animate-spin" : ""}
                        aria-hidden="true"
                      />
                      <span>{isSyncingThis ? "Syncing RSS..." : "Sync Latest YouTube"}</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => setExpandedCreatorId(isExpanded ? null : creator.id)}
                    className="ml-auto h-9 px-3 text-[12.5px]"
                  >
                    <span>
                      {isExpanded
                        ? "Hide Videos"
                        : `Videos (${creator.latest_videos.length})`}
                    </span>
                  </Button>
                </div>

                {/* Expandable Real-Time Analyzed YouTube Videos Feed */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-[rgba(22,26,24,0.08)] pt-3">
                    {creator.latest_videos.length === 0 ? (
                      <div className="rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] p-3.5 text-[13px] text-[#4A524D]">
                        {creator.has_realtime_youtube_feed
                          ? "No videos analyzed yet. Click 'Sync Latest YouTube' above to fetch and analyze this creator's latest official YouTube RSS uploads in real time."
                          : "No public YouTube Atom RSS channel ID is linked for this creator yet. You can still analyze their tips directly in New Analysis."}
                      </div>
                    ) : (
                      creator.latest_videos.map((video) => {
                        const disclosure = mapDisclosureTone(video.disclosure_grade);
                        const showWaPreview = previewAlertVideoId === video.id;

                        return (
                          <article
                            key={video.id}
                            className="space-y-2.5 rounded-2xl border border-[rgba(22,26,24,0.09)] bg-white/88 p-3.5"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row">
                              {video.thumbnail_url && (
                                <img
                                  src={video.thumbnail_url}
                                  alt={video.title}
                                  loading="lazy"
                                  className="h-20 w-36 shrink-0 rounded-xl object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full bg-[#E6F2EC] px-2 py-0.5 text-[10.5px] font-semibold text-[#1F4D3A]">
                                    Real · YouTube RSS
                                  </span>
                                  <span className="rounded-full bg-[#EFECE6] px-2 py-0.5 text-[10.5px] font-semibold text-[#4A524D]">
                                    {video.transcript_source === "CAPTIONS"
                                      ? "Captions Analyzed"
                                      : "Title & Description Only"}
                                  </span>
                                  <span className="tabular-nums-lining text-[11px] text-[#6E7771]">
                                    {formatPublishedAt(video.published_at)}
                                  </span>
                                </div>
                                <a
                                  href={video.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-[13.5px] font-semibold text-[#161A18] hover:text-[#1F4D3A] hover:underline"
                                >
                                  {video.title}
                                </a>
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <StatusBadge
                                    tone={disclosure.tone}
                                    label={disclosure.label}
                                    className="!h-6 !text-[11px]"
                                  />
                                  <StatusBadge
                                    tone={
                                      video.hype_flags_json.length > 0 ? "attention" : "neutral_ok"
                                    }
                                    label={`${video.hype_flags_json.length} hype cue${
                                      video.hype_flags_json.length === 1 ? "" : "s"
                                    }`}
                                    className="!h-6 !text-[11px]"
                                  />
                                  <span className="rounded-full border border-[rgba(22,26,24,0.09)] bg-[#FAF8F4] px-2.5 py-0.5 text-[11px] font-semibold text-[#161A18]">
                                    Stock: {video.detected_ticker ?? "Not stated"}
                                  </span>
                                  <span className="rounded-full border border-[rgba(22,26,24,0.09)] bg-[#FAF8F4] px-2.5 py-0.5 text-[11px] font-medium text-[#4A524D]">
                                    Stop-Loss:{" "}
                                    {video.claim_ledger_json.stop_loss.status === "EXTRACTED"
                                      ? `₹${video.claim_ledger_json.stop_loss.value}`
                                      : video.claim_ledger_json.stop_loss.gated
                                        ? "Gated (Paid)"
                                        : "Not stated"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Guarded Information Verdict Summary */}
                            <div className="rounded-xl border border-[rgba(22,26,24,0.07)] bg-[#FAF8F4] p-2.5 text-[12px] leading-relaxed text-[#4A524D]">
                              <p className="m-0 font-semibold text-[#161A18]">
                                Output-Guarded Information Verdict ({video.guard_status})
                              </p>
                              <ul className="mt-1 mb-0 list-disc space-y-0.5 pl-4">
                                {(video.guarded_report_json.sections ?? []).slice(0, 3).map((s) => (
                                  <li key={s.section_id}>{s.sentence}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewAlertVideoId(showWaPreview ? null : video.id)
                                }
                                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1F4D3A] hover:underline"
                              >
                                <WhatsappLogo size={14} weight="duotone" aria-hidden="true" />
                                <span>
                                  {showWaPreview
                                    ? "Hide WhatsApp Alert Preview"
                                    : "Preview Output-Guarded WhatsApp Alert"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  navigate("/analyze", {
                                    state: {
                                      prefillInfluencerName: creator.name,
                                      prefillStockName: video.detected_ticker ?? undefined,
                                      prefillQuery: video.title,
                                    },
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#161A18] hover:text-[#1F4D3A]"
                              >
                                <span>Open Full Autopsy</span>
                                <ArrowRight size={13} weight="bold" aria-hidden="true" />
                              </button>
                            </div>

                            {showWaPreview && (
                              <pre className="m-0 overflow-x-auto rounded-xl border border-[rgba(31,77,58,0.18)] bg-[#E6F2EC]/60 p-3 font-sans text-[12px] leading-relaxed whitespace-pre-wrap text-[#161A18]">
                                {video.whatsapp_summary_text}
                              </pre>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Opt-In Subscribe for Automated WhatsApp Alerts Modal */}
      {subscribeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscribe-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,26,24,0.32)] p-4 backdrop-blur-sm"
        >
          <div className="max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-[24px] border border-[rgba(255,255,255,0.85)] bg-[#FAF8F4]/98 p-6 shadow-[0_24px_60px_-12px_rgba(22,26,24,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BellRinging
                    size={20}
                    weight="duotone"
                    className="text-[#1F4D3A]"
                    aria-hidden="true"
                  />
                  <h2
                    id="subscribe-modal-title"
                    className="m-0 text-[18px] font-bold text-[#161A18]"
                  >
                    WhatsApp Evidence Alerts · {subscribeTarget.name}
                  </h2>
                </div>
                <p className="mt-1 mb-0 text-[12.5px] text-[#4A524D]">
                  Receive an automated, Output-Guarded WhatsApp facts card whenever a new YouTube
                  upload is analyzed—at ₹0 cost.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close subscription dialog"
                onClick={closeSubscribeModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(22,26,24,0.09)] bg-white text-[#161A18]"
              >
                <X size={17} weight="bold" />
              </button>
            </div>

            {unsubscribeMessage && (
              <div className="mt-4 rounded-xl border border-[rgba(31,77,58,0.2)] bg-[#E6F2EC] p-3 text-[13px] text-[#1F4D3A]">
                {unsubscribeMessage}
              </div>
            )}

            {activeSubscription ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-[rgba(31,77,58,0.2)] bg-[#E6F2EC]/70 p-4">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1F4D3A]">
                    <CheckCircle size={18} weight="duotone" aria-hidden="true" />
                    <span>Subscription Active ({activeSubscription.phone_masked})</span>
                  </div>
                  <p className="mt-1 mb-0 text-[12.5px] text-[#4A524D]">
                    Delivery mode: <strong>{activeSubscription.provider}</strong>. Your phone
                    number is AES-256-GCM encrypted server-side and never exposed in logs.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={testAlertMutation.isPending}
                    onClick={() =>
                      testAlertMutation.mutate({
                        influencerId: subscribeTarget.id,
                        subscription_id: activeSubscription.id,
                      })
                    }
                  >
                    <PaperPlaneTilt size={16} weight="duotone" aria-hidden="true" />
                    <span>
                      {testAlertMutation.isPending
                        ? "Sending Guarded Alert..."
                        : "Send Test Alert Now"}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={unsubscribeMutation.isPending}
                    onClick={() =>
                      unsubscribeMutation.mutate(activeSubscription.unsubscribe_token)
                    }
                  >
                    <span>One-Click Unsubscribe</span>
                  </Button>
                </div>

                {testAlertMutation.isError && (
                  <div className="rounded-xl border border-[rgba(154,91,19,0.25)] bg-[#FDF3E4] p-3 text-[12.5px] text-[#9A5B13]">
                    {testAlertMutation.error instanceof Error
                      ? testAlertMutation.error.message
                      : "Could not dispatch test alert."}
                  </div>
                )}

                {testAlertResult && (
                  <div className="space-y-2.5 rounded-2xl border border-[rgba(22,26,24,0.09)] bg-white p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge
                        tone={
                          testAlertResult.delivery_status === "SENT" ||
                          testAlertResult.delivery_status === "DRY_RUN_PREVIEW"
                            ? "neutral_ok"
                            : "attention"
                        }
                        label={`Status: ${testAlertResult.delivery_status}`}
                      />
                      {testAlertResult.wa_me_url && (
                        <a
                          href={testAlertResult.wa_me_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1F4D3A] hover:underline"
                        >
                          <WhatsappLogo size={14} weight="duotone" aria-hidden="true" />
                          <span>Open in WhatsApp</span>
                          <ArrowSquareOut size={12} />
                        </a>
                      )}
                    </div>
                    {testAlertResult.error_code && (
                      <div className="rounded-xl border border-[rgba(154,91,19,0.22)] bg-[#FDF3E4] px-3 py-2 text-[12px] text-[#9A5B13]">
                        <strong>Error ({testAlertResult.error_code}):</strong>{" "}
                        {testAlertResult.error_code === "TWILIO_NOT_CONFIGURED"
                          ? "Backend has not loaded TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN yet. Restart the backend server (npm run dev in backend/) so it reloads backend/.env."
                          : testAlertResult.error_code === "TWILIO_ERR_63015"
                            ? "This WhatsApp number has not joined your Twilio WhatsApp Sandbox yet. Send your sandbox join code to +1 415 523 8886 on WhatsApp first."
                            : "Check your Twilio credentials or Sandbox join status and retry."}
                      </div>
                    )}
                    <pre className="m-0 max-h-56 overflow-y-auto rounded-xl bg-[#FAF8F4] p-3 font-sans text-[12px] leading-relaxed whitespace-pre-wrap text-[#161A18]">
                      {testAlertResult.message_preview}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubscribeSubmit} className="mt-4 space-y-4">
                <TextField
                  id="whatsapp-phone"
                  label="WhatsApp Number (E.164 format)"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+919876543210"
                  hint="Stored encrypted (AES-256-GCM) solely for delivering Output-Guarded alerts."
                  required
                />

                <fieldset className="space-y-2 border-0 p-0">
                  <legend className="text-[13px] font-semibold text-[#161A18]">
                    Zero-Cost Delivery Mode
                  </legend>
                  <div className="grid gap-2">
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12.5px] ${
                        provider === "twilio"
                          ? "border-[#4A7C64] bg-[#E6F2EC]/55"
                          : "border-[rgba(22,26,24,0.09)] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="wa-provider"
                        value="twilio"
                        checked={provider === "twilio"}
                        onChange={() => setProvider("twilio")}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-semibold text-[#161A18]">
                          Twilio WhatsApp Automation{" "}
                          {finfluencersQuery.data?.twilio_whatsapp_configured
                            ? "(Connected)"
                            : "(Requires TWILIO_ACCOUNT_SID & AUTH_TOKEN in backend .env)"}
                        </span>
                        <p className="mt-0.5 mb-0 text-[#4A524D]">
                          Dispatches Output-Guarded alerts via Twilio Programmable Messaging
                          (WhatsApp Sandbox <code>whatsapp:+14155238886</code> or your Twilio
                          WhatsApp sender).
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12.5px] ${
                        provider === "callmebot"
                          ? "border-[#4A7C64] bg-[#E6F2EC]/55"
                          : "border-[rgba(22,26,24,0.09)] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="wa-provider"
                        value="callmebot"
                        checked={provider === "callmebot"}
                        onChange={() => setProvider("callmebot")}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-semibold text-[#161A18]">
                          CallMeBot Free WhatsApp (₹0 · Instant Real Delivery)
                        </span>
                        <p className="mt-0.5 mb-0 text-[#4A524D]">
                          1. Save <strong>+34 644 71 81 99</strong> and send{" "}
                          <code>I allow callmebot to send me messages</code> on WhatsApp. 2. Paste
                          the free API key you receive below.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12.5px] ${
                        provider === "dry_run"
                          ? "border-[#4A7C64] bg-[#E6F2EC]/55"
                          : "border-[rgba(22,26,24,0.09)] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="wa-provider"
                        value="dry_run"
                        checked={provider === "dry_run"}
                        onChange={() => setProvider("dry_run")}
                        className="mt-1"
                      />
                      <div>
                        <span className="font-semibold text-[#161A18]">
                          Instant Preview / Dry-Run Mode (Zero Setup)
                        </span>
                        <p className="mt-0.5 mb-0 text-[#4A524D]">
                          Generates the exact Output-Guarded WhatsApp alert preview and a one-click{" "}
                          <code>wa.me</code> link immediately with no external API key.
                        </p>
                      </div>
                    </label>

                    {finfluencersQuery.data?.whatsapp_meta_configured && (
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12.5px] ${
                          provider === "meta_cloud"
                            ? "border-[#4A7C64] bg-[#E6F2EC]/55"
                            : "border-[rgba(22,26,24,0.09)] bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="wa-provider"
                          value="meta_cloud"
                          checked={provider === "meta_cloud"}
                          onChange={() => setProvider("meta_cloud")}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-semibold text-[#161A18]">
                            Official Meta WhatsApp Cloud API (Free Sandbox)
                          </span>
                          <p className="mt-0.5 mb-0 text-[#4A524D]">
                            Dispatches via the configured Meta Cloud API free developer tier.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                </fieldset>

                {provider === "callmebot" && (
                  <TextField
                    id="callmebot-key"
                    label="Your Free CallMeBot API Key"
                    value={callMeBotKey}
                    onChange={(e) => setCallMeBotKey(e.target.value)}
                    placeholder="e.g. 1234567"
                    hint="Encrypted at rest using AES-256-GCM; never logged or displayed again."
                    required
                  />
                )}

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[rgba(22,26,24,0.09)] bg-white/80 p-3 text-[12px] leading-relaxed text-[#4A524D]">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                    required
                  />
                  <span>
                    I explicitly opt in to store my encrypted WhatsApp destination solely to
                    receive automated, Output-Guarded Tip Autopsy evidence alerts for{" "}
                    <strong>{subscribeTarget.name}</strong>. I understand alerts are not investment
                    advice and can be revoked in one click at any time.
                  </span>
                </label>

                {subscribeMutation.isError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-[rgba(154,91,19,0.25)] bg-[#FDF3E4] p-3 text-[12.5px] text-[#9A5B13]"
                  >
                    <WarningCircle size={16} weight="duotone" className="mt-0.5 shrink-0" />
                    <span>
                      {subscribeMutation.error instanceof Error
                        ? subscribeMutation.error.message
                        : "Could not save subscription."}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" onClick={closeSubscribeModal}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!consentAccepted || subscribeMutation.isPending}
                  >
                    <ShieldCheck size={16} weight="duotone" aria-hidden="true" />
                    <span>
                      {subscribeMutation.isPending
                        ? "Saving Encrypted Alert..."
                        : "Confirm Opt-In Subscription"}
                    </span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
