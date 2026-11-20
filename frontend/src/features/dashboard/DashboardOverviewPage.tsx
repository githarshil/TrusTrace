import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CaretRight,
  ChartLineUp,
  Coins,
  Database,
  FilmStrip,
  Image as ImageIcon,
  MagnifyingGlass,
  UsersThree,
} from "@phosphor-icons/react";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { ProvenancePill } from "../../components/ui/ProvenancePill";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { fetchBenchmarks, fetchDemoCases } from "../../lib/apiClient";
import { CURATED_DEMO_CORPUS } from "../../lib/constants";
import type { DataLabel } from "../../types/api";
import { useAutopsy } from "../workflow/AutopsyContext";

function mapDataLabel(label: DataLabel | null): "Real" | "Synthetic / Demo" | "Mixed (Labelled)" {
  if (label === "REAL") return "Real";
  if (label === "MIXED") return "Mixed (Labelled)";
  return "Synthetic / Demo";
}

function buildSparklinePoints(values: number[]): string {
  if (values.length < 2) return "4,24 152,24";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = 4 + (i / (values.length - 1)) * 148;
      const y = 34 - ((v - min) / span) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function DashboardOverviewPage() {
  const [quickInput, setQuickInput] = useState("");
  const navigate = useNavigate();
  const { state, loadDemoCase } = useAutopsy();

  const benchmarksQuery = useQuery({
    queryKey: ["meta-benchmarks"],
    queryFn: fetchBenchmarks,
  });

  const demoCasesQuery = useQuery({
    queryKey: ["demo-cases"],
    queryFn: fetchDemoCases,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate("/analyze", { state: { prefillQuery: quickInput.trim() } });
  }

  const benchmarkList = benchmarksQuery.data ?? [
    {
      key: "NIFTY_50" as const,
      label: "NIFTY 50",
      status: "COULD_NOT_VERIFY" as const,
      close: null,
      change: null,
      change_percent: null,
      as_of_date: null,
      data_label: null,
      source_name: null,
      sparkline: [],
    },
    {
      key: "SENSEX" as const,
      label: "SENSEX",
      status: "COULD_NOT_VERIFY" as const,
      close: null,
      change: null,
      change_percent: null,
      as_of_date: null,
      data_label: null,
      source_name: null,
      sparkline: [],
    },
    {
      key: "BANKNIFTY" as const,
      label: "BANKNIFTY",
      status: "COULD_NOT_VERIFY" as const,
      close: null,
      change: null,
      change_percent: null,
      as_of_date: null,
      data_label: null,
      source_name: null,
      sparkline: [],
    },
  ];

  const latestAsOf = benchmarkList.find((b) => b.as_of_date)?.as_of_date ?? undefined;
  const latestLabel = benchmarkList.find((b) => b.data_label)?.data_label ?? null;
  const latestFetchedAt = benchmarkList.find((b) => b.fetched_at)?.fetched_at ?? null;
  const isLiveFeed = benchmarkList.some((b) => b.data_freshness === "LIVE_FEED");

  return (
    <div className="space-y-4">
      {/* Top Intake Bar + Compliant Snapshot Status Pill */}
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
        <form
          onSubmit={handleSubmit}
          className="glass-card flex flex-1 flex-col gap-2 rounded-2xl p-1.5 sm:flex-row sm:items-center sm:rounded-full sm:pl-4"
        >
          <label htmlFor="quick-tip-intake" className="sr-only">
            Paste a Hinglish tip or enter an influencer and stock name
          </label>
          <div className="flex flex-1 items-center gap-2.5 px-2 sm:px-0">
            <MagnifyingGlass size={18} weight="regular" className="shrink-0 text-[#6E7771]" aria-hidden="true" />
            <input
              id="quick-tip-intake"
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Paste a Hinglish tip, or enter influencer & stock name..."
              className="h-10 w-full bg-transparent text-[15px] text-[#161A18] placeholder:text-[#6E7771] focus:outline-none sm:h-9 sm:text-[14px]"
            />
          </div>
          <Button type="submit" size="md" className="min-h-[44px] shrink-0 px-5 text-[13.5px] sm:min-h-[38px]">
            <span>Analyze</span>
            <ArrowRight size={15} weight="bold" aria-hidden="true" />
          </Button>
        </form>

        {/* Accurate provenance badge: Live Feed when fetched live, Dated Snapshot on fallback */}
        <div className="glass-card-subtle flex items-center gap-2.5 rounded-2xl px-3.5 py-2 sm:self-start xl:self-auto">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#4A7C64]" aria-hidden="true" />
          <div className="leading-tight">
            <p className="m-0 text-[12px] font-semibold text-[#161A18]">
              {isLiveFeed ? "Real · Live Feed · NSE / BSE" : "Dated Market Snapshots · NSE / BSE"}
            </p>
            <p className="tabular-nums-lining m-0 text-[11px] text-[#6E7771]">
              {isLiveFeed && latestFetchedAt
                ? `Yahoo Finance NSE · As of ${latestAsOf ?? "today"}`
                : latestAsOf
                  ? `Snapshot as of ${latestAsOf}`
                  : "Could not verify snapshot date"}
            </p>
          </div>
        </div>
      </div>

      {/* 3-Column Market Overview Strip */}
      <section aria-labelledby="market-overview-heading" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1
            id="market-overview-heading"
            className="m-0 text-[18px] font-semibold tracking-[-0.02em] text-[#161A18]"
          >
            Market Overview
          </h1>
          <ProvenancePill
            label={
              isLiveFeed
                ? "Real · Live Feed"
                : latestLabel
                  ? mapDataLabel(latestLabel)
                  : "Synthetic / Demo"
            }
            fetchedAtIso={isLiveFeed ? latestFetchedAt : null}
            asOfDate={latestAsOf}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {benchmarkList.map((indexCard) => {
            const available = indexCard.status === "AVAILABLE" && indexCard.close !== null;
            return (
              <GlassCard key={indexCard.key} compact className="flex flex-col justify-between gap-2 !p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="m-0 text-[11.5px] font-semibold tracking-[0.04em] text-[#6E7771] uppercase">
                      {indexCard.label}
                    </p>
                    <p className="tabular-nums-lining mt-0.5 mb-0 text-[21px] font-bold tracking-[-0.02em] text-[#161A18]">
                      {available
                        ? indexCard.close!.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                        : "—"}
                    </p>
                  </div>
                  {available ? (
                    <span className="tabular-nums-lining rounded-full bg-[#E6F2EC] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#1F4D3A]">
                      {indexCard.change !== null && indexCard.change >= 0 ? "+" : ""}
                      {indexCard.change_percent}%
                    </span>
                  ) : (
                    <StatusBadge tone="unverified" label="Could not verify" />
                  )}
                </div>

                <div className="flex items-end justify-between gap-2">
                  <p className="tabular-nums-lining m-0 truncate text-[11.5px] text-[#6E7771]">
                    {available && indexCard.as_of_date
                      ? `${mapDataLabel(indexCard.data_label)} · As of ${indexCard.as_of_date}`
                      : "Snapshot unavailable"}
                  </p>
                  <svg viewBox="0 0 156 40" className="h-7 w-20 shrink-0" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke="#3B8E6A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={buildSparklinePoints(indexCard.sparkline.map((s) => s.close))}
                    />
                  </svg>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* Phase 4 & 5 Real-Time Quick Access Band */}
      <section aria-label="Real-time workspaces" className="grid gap-3 md:grid-cols-3">
        <GlassCard compact className="flex items-center justify-between gap-3 !p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F2EC] text-[#1F4D3A]">
              <ChartLineUp size={20} weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <h2 className="m-0 text-[14.5px] font-semibold text-[#161A18]">
                Real-Time NSE / BSE Stocks
              </h2>
              <p className="mt-0.5 mb-0 text-[12px] text-[#4A524D]">
                Search any Indian equity live, inspect volume &amp; ranges, and launch a 5-check
                Tip Autopsy in one click.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate("/stocks")}
            className="h-9 shrink-0 px-3.5 text-[12.5px]"
          >
            <span>Open</span>
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </Button>
        </GlassCard>

        <GlassCard compact className="flex items-center justify-between gap-3 !p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDF3E4] text-[#9A5B13]">
              <Coins size={20} weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <h2 className="m-0 text-[14.5px] font-semibold text-[#161A18]">
                Pretend Money (10Y Timeline)
              </h2>
              <p className="mt-0.5 mb-0 text-[12px] text-[#4A524D]">
                Make real allocation &amp; stop-loss choices with fake money across a 10-year stock
                timeline vs. NIFTY 50.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate("/pretend-money")}
            className="h-9 shrink-0 px-3.5 text-[12.5px]"
          >
            <span>Simulate</span>
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </Button>
        </GlassCard>

        <GlassCard compact className="flex items-center justify-between gap-3 !p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F2EC] text-[#1F4D3A]">
              <UsersThree size={20} weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <h2 className="m-0 text-[14.5px] font-semibold text-[#161A18]">
                Finfluencers &amp; WhatsApp Alerts
              </h2>
              <p className="mt-0.5 mb-0 text-[12px] text-[#4A524D]">
                Track new YouTube uploads via official RSS and receive Output-Guarded AI evidence
                alerts on WhatsApp.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate("/finfluencers")}
            className="h-9 shrink-0 px-3.5 text-[12.5px]"
          >
            <span>Explore</span>
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </Button>
        </GlassCard>
      </section>

      {/* Curated Demo & In-Session Analyses Table */}
      <section aria-labelledby="demo-analyses-heading" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="demo-analyses-heading"
              className="m-0 text-[17px] font-semibold tracking-[-0.015em] text-[#161A18]"
            >
              Curated Demo &amp; In-Session Analyses
            </h2>
            <p className="mt-0.5 mb-0 text-[12.5px] text-[#6E7771]">
              Zero history is persisted across sessions. Select any curated sample to inspect the
              full five-step autopsy.
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/corpus")} className="h-8 px-3 text-[12.5px]">
            <span>View Corpus</span>
            <CaretRight size={14} weight="bold" aria-hidden="true" />
          </Button>
        </div>

        <GlassCard className="overflow-hidden p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[rgba(22,26,24,0.08)] bg-white/60 text-[11px] font-semibold tracking-[0.04em] text-[#4A524D] uppercase">
                  <th className="px-4 py-2.5">Tip / Stock &amp; Instrument</th>
                  <th className="px-3 py-2.5">Creator &amp; Media</th>
                  <th className="px-3 py-2.5">SEBI Snapshot</th>
                  <th className="px-3 py-2.5">Evidence Scope</th>
                  <th className="px-4 py-2.5 text-right">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(22,26,24,0.07)] text-[13.5px]">
                {state.inSessionRuns.map((run) => (
                  <tr key={run.id} className="bg-[#E6F2EC]/30">
                    <td className="px-4 py-2.5 font-semibold text-[#161A18]">
                      {run.instrumentName}
                      <span className="ml-2 text-[11.5px] font-medium text-[#1F4D3A]">
                        (In-session)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#4A524D]">{run.influencerName}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone="unverified" label={run.sebiStatus} />
                    </td>
                    <td className="tabular-nums-lining px-3 py-2.5 text-[12.5px] text-[#4A524D]">
                      Tip date: {run.tipDate}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] whitespace-nowrap text-[#6E7771]">
                      In-memory only
                    </td>
                  </tr>
                ))}

                {(demoCasesQuery.data ?? []).length > 0
                  ? (demoCasesQuery.data ?? []).map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-white/60">
                        <td className="max-w-[290px] px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              loadDemoCase(item);
                              navigate("/analyze");
                            }}
                            className="group flex w-full cursor-pointer flex-col text-left"
                          >
                            <span className="font-semibold text-[#161A18] group-hover:text-[#1F4D3A]">
                              {item.instrument_name}
                            </span>
                            <span className="line-clamp-1 text-[12px] text-[#6E7771]">
                              {item.coverage_note}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-[#161A18]">
                            {item.media_type === "PHOTO" ? (
                              <ImageIcon
                                size={15}
                                weight="duotone"
                                className="shrink-0 text-[#4A7C64]"
                                aria-hidden="true"
                              />
                            ) : (
                              <FilmStrip
                                size={15}
                                weight="duotone"
                                className="shrink-0 text-[#4A7C64]"
                                aria-hidden="true"
                              />
                            )}
                            <div>
                              <div className="font-medium">{item.influencer_name}</div>
                              {item.alias && (
                                <div className="text-[11.5px] text-[#6E7771]">{item.alias}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            tone={item.sebi_expected_status === "REGISTERED" ? "neutral_ok" : "unverified"}
                            label={
                              item.sebi_expected_status === "REGISTERED"
                                ? "Registered"
                                : "Not found in SEBI register"
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            tone={item.instrument_type === "DERIVATIVE" ? "unverified" : "attention"}
                            label={
                              item.instrument_type === "DERIVATIVE"
                                ? "Could not verify (Derivative)"
                                : "5-Check Equity"
                            }
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(22,26,24,0.09)] bg-[#EFECE6] px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-[#4A524D]">
                            <Database size={12} weight="regular" aria-hidden="true" />
                            Curated Demo · Mixed
                          </span>
                        </td>
                      </tr>
                    ))
                  : CURATED_DEMO_CORPUS.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-white/60">
                        <td className="px-4 py-2.5 font-semibold text-[#161A18]">
                          {item.instrument}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-[#161A18]">
                          {item.influencer}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone="unverified" label={item.corpusTag} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone="unverified" label={item.instrumentType} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-[12px] whitespace-nowrap text-[#4A524D]">
                          {item.provenance}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
