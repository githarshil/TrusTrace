import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppEnv } from "../core/env.js";
import { SnapshotVersionCache } from "../core/snapshotCache.js";
import { getSupabaseAdminClient } from "./supabase.js";
import {
  DEMO_DATASET,
  type BenchmarkBarRecord,
  type CuratedTipRecord,
  type DemoCaseMeta,
  type InfluencerRecord,
  type SnapshotRecord,
  type StockRecord,
} from "../ingestion/demoCorpus.js";
import {
  SEBI_SNAPSHOT_JSON_PATH,
  type PersistedSebiSnapshotFile,
} from "../ingestion/importSebiRegister.js";
import type {
  PriceBar,
  StockInfoSnapshot,
  SurveillanceSnapshot,
} from "../domain/market-checks/checks.js";
import type { DataLabel, SebiRegisterEntryRecord } from "../domain/types.js";
import { normalizeIdentifier } from "../domain/sebi/lookup.js";

export interface EvidenceRepository {
  listSnapshots(): Promise<SnapshotRecord[]>;
  listDemoCases(): Promise<DemoCaseMeta[]>;
  listBenchmarks(): Promise<Record<"NIFTY_50" | "SENSEX" | "BANKNIFTY", BenchmarkBarRecord[]>>;
  listSebiEntries(): Promise<{
    entries: SebiRegisterEntryRecord[];
    snapshotId: string | null;
    snapshotDate: string | null;
    dataLabel: DataLabel | null;
  }>;
  listInfluencers(): Promise<InfluencerRecord[]>;
  findInfluencerByQuery(query: string): Promise<InfluencerRecord | null>;
  findInfluencerById(id: string): Promise<InfluencerRecord | null>;
  searchStocks(query: string): Promise<StockRecord[]>;
  getStockByTicker(ticker: string): Promise<StockRecord | null>;
  getPriceHistory(ticker: string, fromDate?: string, toDate?: string): Promise<PriceBar[]>;
  getStockInfo(ticker: string): Promise<StockInfoSnapshot | null>;
  getSurveillance(ticker: string): Promise<SurveillanceSnapshot[]>;
  getTipsByInfluencer(params: {
    influencerId: string;
    ticker?: string;
    date?: string;
  }): Promise<CuratedTipRecord[]>;
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const __repoDir = path.dirname(fileURLToPath(import.meta.url));

function loadLocalSebiSnapshotFile(): PersistedSebiSnapshotFile | null {
  const candidates = [
    SEBI_SNAPSHOT_JSON_PATH,
    path.resolve(__repoDir, "../../src/ingestion/data/sebi_register_snapshot.json"),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as PersistedSebiSnapshotFile;
      if (parsed && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        return parsed;
      }
    } catch {
      // Try next candidate path
    }
  }
  return null;
}

/**
 * In-memory validated snapshot repository backed by the curated demo corpus &
 * official dated SEBI snapshot file, with automatic live Supabase PostgreSQL reads
 * when SUPABASE_SERVICE_ROLE_KEY is configured.
 */
export function createEvidenceRepository(config: AppEnv): EvidenceRepository {
  const supabase = getSupabaseAdminClient(config);
  const sebiSnapshotCache = new SnapshotVersionCache({ maxEntries: 8, defaultTtlMs: 300_000 });
  const localSebiSnapshot = loadLocalSebiSnapshotFile();

  return {
    async listSnapshots(): Promise<SnapshotRecord[]> {
      if (supabase) {
        const { data, error } = await supabase
          .from("data_snapshot")
          .select("*")
          .order("as_of_date", { ascending: false });
        if (!error && data && data.length > 0) {
          return data as SnapshotRecord[];
        }
      }
      if (localSebiSnapshot) {
        const withoutDemoSebi = DEMO_DATASET.snapshots.filter(
          (s) => s.dataset_key !== "sebi_register"
        );
        return [
          {
            id: localSebiSnapshot.snapshot_id,
            dataset_key: localSebiSnapshot.dataset_key,
            source_name: localSebiSnapshot.source_name,
            source_url: localSebiSnapshot.source_url,
            as_of_date: localSebiSnapshot.as_of_date,
            retrieved_at: localSebiSnapshot.retrieved_at,
            data_label: localSebiSnapshot.data_label,
            version: localSebiSnapshot.version,
            checksum: localSebiSnapshot.checksum,
            row_count: localSebiSnapshot.row_count,
            validation_status: localSebiSnapshot.validation_status,
            notes: localSebiSnapshot.notes,
          },
          ...withoutDemoSebi,
        ];
      }
      return DEMO_DATASET.snapshots;
    },

    async listDemoCases(): Promise<DemoCaseMeta[]> {
      return DEMO_DATASET.demoCases;
    },

    async listBenchmarks() {
      if (supabase) {
        const { data, error } = await supabase
          .from("benchmark_history")
          .select("benchmark_key, trading_date, close, snapshot_id, data_snapshot(source_name, data_label)")
          .order("trading_date", { ascending: true });
        if (!error && data && data.length > 0) {
          const grouped: Record<"NIFTY_50" | "SENSEX" | "BANKNIFTY", BenchmarkBarRecord[]> = {
            NIFTY_50: [],
            SENSEX: [],
            BANKNIFTY: [],
          };
          const rows = data as unknown as Array<{
            benchmark_key: "NIFTY_50" | "SENSEX" | "BANKNIFTY";
            trading_date: string;
            close: string | number;
            snapshot_id: string;
            data_snapshot:
              | { source_name: string; data_label: DataLabel }
              | Array<{ source_name: string; data_label: DataLabel }>
              | null;
          }>;
          for (const row of rows) {
            if (row.benchmark_key in grouped) {
              const snap = unwrapRelation(row.data_snapshot);
              grouped[row.benchmark_key].push({
                benchmark_key: row.benchmark_key,
                trading_date: row.trading_date,
                close: Number(row.close),
                snapshot_id: row.snapshot_id,
                source_name: snap?.source_name ?? "Supabase Benchmark Snapshot",
                data_label: snap?.data_label ?? "SYNTHETIC",
              });
            }
          }
          if (grouped.NIFTY_50.length > 0) return grouped;
        }
      }
      return DEMO_DATASET.benchmarks;
    },

    async listSebiEntries() {
      if (supabase) {
        // Select the latest valid sebi_register snapshot (preferring REAL over MIXED/SYNTHETIC)
        const { data: snaps, error: snapErr } = await supabase
          .from("data_snapshot")
          .select("id, as_of_date, data_label")
          .eq("dataset_key", "sebi_register")
          .in("validation_status", ["VALID", "PARTIAL"])
          .order("as_of_date", { ascending: false })
          .limit(10);

        const chosenSnap =
          !snapErr && snaps && snaps.length > 0
            ? ((snaps as Array<{ id: string; as_of_date: string; data_label: DataLabel }>).find(
                (s) => s.data_label === "REAL"
              ) ?? (snaps[0] as { id: string; as_of_date: string; data_label: DataLabel }))
            : null;

        if (chosenSnap) {
          const cacheKey = SnapshotVersionCache.buildKey({
            namespace: "sebi_register",
            snapshotVersion: chosenSnap.id,
            params: {},
          });
          const cached = sebiSnapshotCache.get<{
            entries: SebiRegisterEntryRecord[];
            snapshotId: string | null;
            snapshotDate: string | null;
            dataLabel: DataLabel | null;
          }>(cacheKey);
          if (cached) return cached;

          // Paginate in 1,000-row chunks so Supabase's default row cap never truncates the register
          const allEntries: SebiRegisterEntryRecord[] = [];
          const pageSize = 1000;
          for (let offset = 0; offset < 20_000; offset += pageSize) {
            const { data, error } = await supabase
              .from("sebi_register_entry")
              .select("id, snapshot_id, name, normalized_name, registration_no, category, snapshot_date")
              .eq("snapshot_id", chosenSnap.id)
              .order("registration_no", { ascending: true })
              .range(offset, offset + pageSize - 1);

            if (error || !data || data.length === 0) break;
            allEntries.push(...(data as SebiRegisterEntryRecord[]));
            if (data.length < pageSize) break;
          }

          if (allEntries.length > 0) {
            const result = {
              entries: allEntries,
              snapshotId: chosenSnap.id,
              snapshotDate: chosenSnap.as_of_date,
              dataLabel: chosenSnap.data_label,
            };
            sebiSnapshotCache.set(cacheKey, result);
            return result;
          }
        }
      }

      if (localSebiSnapshot) {
        return {
          entries: localSebiSnapshot.entries,
          snapshotId: localSebiSnapshot.snapshot_id,
          snapshotDate: localSebiSnapshot.as_of_date,
          dataLabel: localSebiSnapshot.data_label,
        };
      }

      const sebiSnap = DEMO_DATASET.snapshots.find((s) => s.dataset_key === "sebi_register");
      return {
        entries: DEMO_DATASET.sebiEntries,
        snapshotId: sebiSnap?.id ?? null,
        snapshotDate: sebiSnap?.as_of_date ?? null,
        dataLabel: sebiSnap?.data_label ?? "MIXED",
      };
    },

    async listInfluencers(): Promise<InfluencerRecord[]> {
      if (supabase) {
        const { data, error } = await supabase.from("influencer").select("*");
        if (!error && data && data.length > 0) {
          return data as InfluencerRecord[];
        }
      }
      return DEMO_DATASET.influencers;
    },

    async findInfluencerByQuery(query: string): Promise<InfluencerRecord | null> {
      const norm = normalizeIdentifier(query);
      if (!norm) return null;
      const all = await this.listInfluencers();
      const compact = query.replace(/\s+/g, "").toUpperCase();
      return (
        all.find(
          (inf) =>
            normalizeIdentifier(inf.normalized_name || inf.name) === norm ||
            (inf.sebi_registration_no && inf.sebi_registration_no.toUpperCase() === compact) ||
            inf.aliases.some((alias) => normalizeIdentifier(alias) === norm)
        ) ?? null
      );
    },

    async findInfluencerById(id: string): Promise<InfluencerRecord | null> {
      const all = await this.listInfluencers();
      return all.find((inf) => inf.id === id) ?? null;
    },

    async searchStocks(query: string): Promise<StockRecord[]> {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) return DEMO_DATASET.stocks;
      const normalized = normalizeIdentifier(query);
      return DEMO_DATASET.stocks.filter((stock) => {
        if (stock.ticker.toLowerCase().includes(trimmed)) return true;
        if (stock.company_name.toLowerCase().includes(trimmed)) return true;
        if (normalizeIdentifier(stock.company_name).includes(normalized)) return true;
        return stock.aliases.some((a) => a.toLowerCase().includes(trimmed));
      });
    },

    async getStockByTicker(ticker: string): Promise<StockRecord | null> {
      const upper = ticker.trim().toUpperCase();
      const direct = DEMO_DATASET.stocks.find((s) => s.ticker.toUpperCase() === upper);
      if (direct) return direct;
      const byName = await this.searchStocks(ticker);
      return byName[0] ?? null;
    },

    async getPriceHistory(ticker: string, fromDate?: string, toDate?: string): Promise<PriceBar[]> {
      const upper = ticker.trim().toUpperCase();
      let bars: PriceBar[] = [];

      if (supabase) {
        let query = supabase
          .from("price_history")
          .select("trading_date, close, volume, snapshot_id, data_snapshot(source_name, data_label)")
          .eq("ticker", upper)
          .order("trading_date", { ascending: true });
        if (fromDate) query = query.gte("trading_date", fromDate);
        if (toDate) query = query.lte("trading_date", toDate);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const rows = data as unknown as Array<{
            trading_date: string;
            close: string | number;
            volume: number;
            snapshot_id: string;
            data_snapshot:
              | { source_name: string; data_label: DataLabel }
              | Array<{ source_name: string; data_label: DataLabel }>
              | null;
          }>;
          bars = rows.map((row) => {
            const snap = unwrapRelation(row.data_snapshot);
            return {
              trading_date: row.trading_date,
              close: Number(row.close),
              volume: Number(row.volume),
              snapshot_id: row.snapshot_id,
              source_name: snap?.source_name ?? "Supabase Price Snapshot",
              data_label: snap?.data_label ?? "SYNTHETIC",
            };
          });
          return bars;
        }
      }

      const demoBars = DEMO_DATASET.pricesByTicker[upper] ?? [];
      return demoBars.filter((bar) => {
        if (fromDate && bar.trading_date < fromDate) return false;
        if (toDate && bar.trading_date > toDate) return false;
        return true;
      });
    },

    async getStockInfo(ticker: string): Promise<StockInfoSnapshot | null> {
      const upper = ticker.trim().toUpperCase();
      return DEMO_DATASET.stockInfoByTicker[upper] ?? null;
    },

    async getSurveillance(ticker: string): Promise<SurveillanceSnapshot[]> {
      const upper = ticker.trim().toUpperCase();
      return DEMO_DATASET.surveillanceByTicker[upper] ?? [];
    },

    async getTipsByInfluencer(params: {
      influencerId: string;
      ticker?: string;
      date?: string;
    }): Promise<CuratedTipRecord[]> {
      const tickerUpper = params.ticker?.trim().toUpperCase();
      return DEMO_DATASET.tips.filter((tip) => {
        if (tip.influencer_id !== params.influencerId) return false;
        if (tickerUpper && tip.ticker.toUpperCase() !== tickerUpper) return false;
        if (params.date && tip.tip_date !== params.date) return false;
        return true;
      });
    },
  };
}
