import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowSquareOut, CalendarBlank, ChartLineUp, MapPin } from "@phosphor-icons/react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "../../components/ui/GlassCard";
import { ProvenancePill } from "../../components/ui/ProvenancePill";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { fetchExactDateTips, fetchStockPrices, fetchTipMarkers } from "../../lib/apiClient";
import type { DataLabel } from "../../types/api";

interface TipTimeMachineProps {
  ticker: string;
  influencerId: string | null;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

function mapDataLabel(label: DataLabel | null): "Real" | "Synthetic / Demo" | "Mixed (Labelled)" {
  if (label === "REAL") return "Real";
  if (label === "MIXED") return "Mixed (Labelled)";
  return "Synthetic / Demo";
}

function isSafeHttpUrl(url: string | null): url is string {
  if (!url) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

export function TipTimeMachine({
  ticker,
  influencerId,
  selectedDate,
  onSelectDate,
}: TipTimeMachineProps) {
  const [range, setRange] = useState<"1M" | "ALL">("ALL");

  const pricesQuery = useQuery({
    queryKey: ["prices", ticker],
    queryFn: () => fetchStockPrices(ticker),
    enabled: Boolean(ticker),
  });

  const markersQuery = useQuery({
    queryKey: ["tip-markers", influencerId, ticker],
    queryFn: () => fetchTipMarkers(influencerId!, ticker),
    enabled: Boolean(influencerId && ticker),
  });

  const exactTipsQuery = useQuery({
    queryKey: ["exact-date-tips", influencerId, ticker, selectedDate],
    queryFn: () => fetchExactDateTips(influencerId!, ticker, selectedDate!),
    enabled: Boolean(influencerId && ticker && selectedDate),
  });

  const series = useMemo(() => {
    const all = pricesQuery.data?.series ?? [];
    if (range === "1M") return all.slice(-22);
    return all;
  }, [pricesQuery.data?.series, range]);

  const markerDates = useMemo(() => {
    const map = new Map<string, { close: number; count: number; hasSynthetic: boolean }>();
    const byDate = new Map(series.map((s) => [s.trading_date, s.close]));
    for (const marker of markersQuery.data ?? []) {
      const close = byDate.get(marker.tip_date);
      if (close !== undefined) {
        map.set(marker.tip_date, {
          close,
          count: marker.count,
          hasSynthetic: marker.has_synthetic,
        });
      }
    }
    return map;
  }, [markersQuery.data, series]);

  return (
    <GlassCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ChartLineUp size={20} weight="duotone" className="text-[#4A7C64]" aria-hidden="true" />
            <h3 className="m-0 text-[18px] font-semibold tracking-[-0.015em] text-[#161A18]">
              Tip Time Machine
            </h3>
          </div>
          <p className="mt-1 mb-0 text-[13px] text-[#4A524D]">
            {pricesQuery.data?.series_scope === "UNDERLYING_INDEX"
              ? `Showing underlying index (${pricesQuery.data.underlying_ticker}) context for ${pricesQuery.data.company_name}. Option contract premiums are not substituted.`
              : `Dated close & volume series for ${pricesQuery.data?.company_name ?? ticker}. Select a tip marker to inspect exact-date records.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Chart date range"
            className="inline-flex rounded-full bg-[#F3F0EA] p-1"
          >
            {(["1M", "ALL"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRange(opt)}
                className={`min-h-[40px] min-w-[44px] cursor-pointer rounded-full px-3.5 text-[12px] font-semibold transition-all sm:min-h-[34px] ${
                  range === opt
                    ? "bg-white text-[#161A18] shadow-[0_2px_8px_rgba(22,26,24,0.08)]"
                    : "text-[#4A524D] hover:text-[#161A18]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {pricesQuery.data && (
            <ProvenancePill
              label={mapDataLabel(pricesQuery.data.data_label)}
              asOfDate={pricesQuery.data.as_of_date ?? undefined}
            />
          )}
        </div>
      </div>

      {/* Loading / Error / Empty States */}
      {pricesQuery.isLoading && (
        <div
          aria-label="Loading chart series"
          className="skeleton-shimmer h-[260px] w-full rounded-2xl"
        />
      )}

      {pricesQuery.isError && (
        <div
          role="alert"
          className="space-y-2 rounded-2xl border border-[rgba(22,26,24,0.09)] bg-[#EEF1F4] p-5 text-[14px] text-[#4E5964]"
        >
          <StatusBadge tone="unverified" label="Could not verify" />
          <p className="mt-2 mb-0">
            Historical price series could not be loaded for {ticker}. No placeholder prices were
            invented.
          </p>
          <button
            type="button"
            onClick={() => void pricesQuery.refetch()}
            className="mt-2 inline-flex h-9 cursor-pointer items-center rounded-full border border-[rgba(22,26,24,0.14)] bg-white px-3.5 text-[12.5px] font-semibold text-[#161A18] hover:bg-[#FAF8F4]"
          >
            Retry loading snapshot
          </button>
        </div>
      )}

      {!pricesQuery.isLoading && !pricesQuery.isError && series.length === 0 && (
        <div className="rounded-2xl border border-[rgba(22,26,24,0.09)] bg-[#F3F0EA]/70 p-5 text-[14px] text-[#4A524D]">
          <StatusBadge tone="unverified" label="Could not verify" />
          <p className="mt-2 mb-0">
            No dated price history snapshot is available for this instrument.
          </p>
        </div>
      )}

      {!pricesQuery.isLoading && series.length > 0 && (
        <>
          <p className="sr-only">
            Price and volume chart for {pricesQuery.data?.company_name ?? ticker} from{" "}
            {series[0]?.trading_date} to {series[series.length - 1]?.trading_date}. Latest close:{" "}
            {series[series.length - 1]?.close}. {markersQuery.data?.length ?? 0} historical tip
            markers available in the accessible list below.
          </p>
          <div className="h-[270px] w-full rounded-2xl border border-[rgba(22,26,24,0.07)] bg-white/85 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="timeMachineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B8E6A" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#3B8E6A" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(22,26,24,0.06)" vertical={false} />
              <XAxis
                dataKey="trading_date"
                tick={{ fontSize: 11, fill: "#6E7771" }}
                tickFormatter={(d: string) => d.slice(5)}
                minTickGap={24}
              />
              <YAxis
                yAxisId="price"
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#6E7771" }}
                width={56}
              />
              <YAxis yAxisId="vol" orientation="right" hide domain={[0, "dataMax * 4"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(22,26,24,0.1)",
                  borderRadius: "12px",
                  fontSize: "12.5px",
                }}
              />
              <Bar
                yAxisId="vol"
                dataKey="volume"
                fill="#A7B8B0"
                fillOpacity={0.35}
                radius={[3, 3, 0, 0]}
                name="Volume"
              />
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke="#3B8E6A"
                strokeWidth={2.2}
                fill="url(#timeMachineFill)"
                name="Close"
              />
              {[...markerDates.entries()].map(([date, meta]) => (
                <ReferenceDot
                  key={date}
                  yAxisId="price"
                  x={date}
                  y={meta.close}
                  r={selectedDate === date ? 8 : 6}
                  fill={selectedDate === date ? "#1F4D3A" : "#4A7C64"}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  onClick={() => onSelectDate(date)}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        </>
      )}

      {/* Accessible Keyboard-Operable Tip Marker List Alternative */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="m-0 text-[13.5px] font-semibold text-[#161A18]">
            Historical Tip Markers (Accessible List)
          </h4>
          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate(null)}
              className="cursor-pointer text-[12px] font-semibold text-[#4A7C64] hover:underline"
            >
              Clear date selection
            </button>
          )}
        </div>

        {(markersQuery.data?.length ?? 0) === 0 ? (
          <p className="m-0 text-[13px] text-[#6E7771]">
            No historical curated tip markers are linked for this creator-instrument pair yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(markersQuery.data ?? []).map((marker) => {
              const isSelected = selectedDate === marker.tip_date;
              return (
                <button
                  key={marker.tip_date}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectDate(marker.tip_date)}
                  className={`tabular-nums-lining inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-all ${
                    isSelected
                      ? "border-[#1F4D3A] bg-[#E6F2EC] text-[#1F4D3A]"
                      : "border-[rgba(22,26,24,0.1)] bg-white/85 text-[#161A18] hover:border-[#4A7C64]"
                  }`}
                >
                  <MapPin size={15} weight="duotone" aria-hidden="true" />
                  <span>{marker.tip_date}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px]">
                    {marker.count} tip{marker.count === 1 ? "" : "s"}
                  </span>
                  <span className="text-[11px] font-medium text-[#6E7771]">
                    {marker.has_synthetic ? "Synthetic / Demo" : "Real"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Exact-Date Tip Details Sheet */}
      {selectedDate && (
        <div
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-[rgba(74,124,100,0.25)] bg-white/92 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarBlank size={16} weight="duotone" className="text-[#1F4D3A]" aria-hidden="true" />
              <h4 className="tabular-nums-lining m-0 text-[14.5px] font-semibold text-[#161A18]">
                Exact-Date Tips for {selectedDate}
              </h4>
            </div>
            <StatusBadge tone="unverified" label="Creator's original record" />
          </div>

          {exactTipsQuery.isLoading && (
            <div className="skeleton-shimmer h-16 w-full rounded-xl" />
          )}

          {!exactTipsQuery.isLoading && (exactTipsQuery.data?.length ?? 0) === 0 && (
            <p className="m-0 text-[13px] text-[#6E7771]">
              No tips found for this exact creator-instrument-date combination.
            </p>
          )}

          {(exactTipsQuery.data ?? []).map((tip) => (
            <article
              key={tip.id}
              className="space-y-2 rounded-xl border border-[rgba(22,26,24,0.08)] bg-[#FAF8F4] p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ProvenancePill
                  label={tip.is_synthetic ? "Synthetic / Demo" : mapDataLabel(tip.data_label)}
                  asOfDate={tip.tip_date}
                />
                {isSafeHttpUrl(tip.source_url) && (
                  <a
                    href={tip.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1F4D3A] hover:underline"
                  >
                    <span>Source link</span>
                    <ArrowSquareOut size={13} weight="bold" aria-hidden="true" />
                  </a>
                )}
              </div>
              <blockquote className="m-0 border-l-2 border-[#4A7C64] pl-3 text-[13.5px] leading-relaxed text-[#161A18]">
                {tip.text}
              </blockquote>
              <div className="tabular-nums-lining flex flex-wrap gap-3 text-[12px] text-[#4A524D]">
                <span>Direction: {tip.direction ?? "Not stated"}</span>
                <span>
                  Creator&apos;s claimed target:{" "}
                  {tip.target_price !== null ? `₹${tip.target_price}` : "Not stated"}
                </span>
                <span>
                  Stop-loss: {tip.stop_loss !== null ? `₹${tip.stop_loss}` : "Not stated"}
                </span>
                <span>Deadline: {tip.deadline ?? "Not stated"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
