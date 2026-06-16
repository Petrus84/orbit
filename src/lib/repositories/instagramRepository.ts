// ============================================================================
// src/lib/repositories/instagramRepository.ts
// ============================================================================
import { supabase } from "../supabaseClient";
import {
  CriticalAlertData,
  FormatPerformanceRow,
  GlowColor,
  IGOverviewData,
  InsightData,
  KPICardData,
  QualityScoreItem,
  SemaphoreColor,
  StatusVariant,
  TrendColor,
} from "../../types/instagram";

// ── Raw Supabase row shapes (snake_case) ──────────────────────────────────

interface RawKPIRow {
  id: string;
  metric: string;
  value: number;
  semaphore: SemaphoreColor;
  delta_pct: number;
  period_start: string;
  period_end: string;
}

interface RawQualityRow {
  id: string;
  score_key: string;
  score_value: number;
  status_text: string;
  status_variant: StatusVariant;
}

interface RawFormatRow {
  id: string;
  format_name: string;
  post_count: number;
  share_count: number;
  trend_label: string;
  trend_color: TrendColor;
}

// ── Label / unit / glow config maps ──────────────────────────────────────

const KPI_META: Record<
  string,
  { label: string; unit: string; deltaLabel: string; subtitle: string }
> = {
  reach_90d: {
    label: "Alcance 90d",
    unit: "",
    deltaLabel: "vs período anterior",
    subtitle: "Contas únicas alcançadas",
  },
  link_clicks: {
    label: "Cliques no Link",
    unit: "",
    deltaLabel: "vs período anterior",
    subtitle: "Cliques na bio + stories",
  },
  total_followers: {
    label: "Seguidores Totais",
    unit: "",
    deltaLabel: "crescimento",
    subtitle: "Base acumulada",
  },
  follower_balance_90d: {
    label: "Saldo 90 Dias",
    unit: "",
    deltaLabel: "ganhos - perdas",
    subtitle: "Novos − cancelamentos",
  },
};

const SEMAPHORE_TO_GLOW: Record<SemaphoreColor, GlowColor> = {
  verde: "cyan",
  ambar: "gold",
  vermelho: "red",
};

const QUALITY_META: Record<
  string,
  { label: string; unit: string; glowColor: GlowColor }
> = {
  utility: { label: "Utilidade", unit: "/10", glowColor: "cyan" },
  relevance: { label: "Relevância", unit: "/10", glowColor: "gold" },
  authenticity: { label: "Autenticidade", unit: "/10", glowColor: "cyan" },
  coherence: { label: "Coerência", unit: "/10", glowColor: "gold" },
};

// ── Transform helpers ─────────────────────────────────────────────────────

function toKPI(row: RawKPIRow): KPICardData {
  const meta = KPI_META[row.metric] ?? {
    label: row.metric,
    unit: "",
    deltaLabel: "variação",
    subtitle: "",
  };

  return {
    id: row.id,
    label: meta.label,
    value: row.value,
    unit: meta.unit,
    delta: row.delta_pct,
    deltaLabel: meta.deltaLabel,
    semaphore: row.semaphore,
    glowColor: SEMAPHORE_TO_GLOW[row.semaphore] ?? "none",
    subtitle: meta.subtitle,
  };
}

function toQualityScore(row: RawQualityRow): QualityScoreItem {
  const meta = QUALITY_META[row.score_key] ?? {
    label: row.score_key,
    unit: "",
    glowColor: "none" as GlowColor,
  };

  return {
    id: row.id,
    label: meta.label,
    value: row.score_value,
    unit: meta.unit,
    statusText: row.status_text,
    statusVariant: row.status_variant,
    glowColor: meta.glowColor,
  };
}

function toFormatRow(row: RawFormatRow): FormatPerformanceRow {
  return {
    id: row.id,
    format: row.format_name,
    posts: row.post_count,
    shares: row.share_count,
    trendLabel: row.trend_label,
    trendColor: row.trend_color,
  };
}

// ── Auto-generate insights from KPIs ─────────────────────────────────────

function deriveInsights(kpis: KPICardData[]): InsightData[] {
  const insights: InsightData[] = [];

  for (const kpi of kpis) {
    if (kpi.semaphore === "vermelho") {
      insights.push({
        id: `insight-${kpi.id}`,
        text: `${kpi.label} está em nível crítico (${kpi.delta > 0 ? "+" : ""}${kpi.delta}% vs período anterior).`,
      });
    }
    if (kpi.semaphore === "ambar") {
      insights.push({
        id: `insight-warn-${kpi.id}`,
        text: `${kpi.label} requer atenção — variação de ${kpi.delta > 0 ? "+" : ""}${kpi.delta}%.`,
      });
    }
  }

  return insights;
}

function deriveCriticalAlerts(kpis: KPICardData[]): CriticalAlertData[] {
  return kpis
    .filter((k) => k.semaphore === "vermelho")
    .map((k) => ({
      id: `alert-${k.id}`,
      title: k.label,
      body: `${k.delta > 0 ? "+" : ""}${k.delta}% vs período anterior — intervenção necessária.`,
      severity: "critical" as const,
    }));
}

// ── fetchInstagramOverview ────────────────────────────────────────────────

export async function fetchInstagramOverview(
  clientId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<IGOverviewData> {
  const start = new Date(periodStart).toISOString();
  const end = new Date(periodEnd).toISOString();

  // Parallel queries
  const [kpiRes, qualityRes, formatRes] = await Promise.all([
    supabase
      .from("kpi_snapshots")
      .select("id, metric, value, semaphore, delta_pct, period_start, period_end")
      .eq("client_id", clientId)
      .gte("period_start", start)
      .lte("period_end", end)
      .returns<RawKPIRow[]>(),

    supabase
      .from("quality_scores")
      .select("id, score_key, score_value, status_text, status_variant")
      .eq("client_id", clientId)
      .returns<RawQualityRow[]>(),

    supabase
      .from("format_performance")
      .select("id, format_name, post_count, share_count, trend_label, trend_color")
      .eq("client_id", clientId)
      .gte("period_start", start)
      .lte("period_end", end)
      .returns<RawFormatRow[]>(),
  ]);

  if (kpiRes.error) {
    console.error("[instagramRepository] fetchKPIs:", kpiRes.error.message);
    throw new Error(kpiRes.error.message);
  }
  if (qualityRes.error) {
    console.error("[instagramRepository] fetchQuality:", qualityRes.error.message);
    throw new Error(qualityRes.error.message);
  }
  if (formatRes.error) {
    console.error("[instagramRepository] fetchFormat:", formatRes.error.message);
    throw new Error(formatRes.error.message);
  }

  const kpis = (kpiRes.data ?? []).map(toKPI);
  const qualityScores = (qualityRes.data ?? []).map(toQualityScore);
  const formatPerformance = (formatRes.data ?? []).map(toFormatRow);

  return {
    meta: {
      clientHandle: "",           // caller can inject from client context
      periodLabel: "Últimos 90 dias",
      dateRange: { start: periodStart, end: periodEnd },
    },
    kpis,
    qualityScores,
    formatPerformance,
    insights: deriveInsights(kpis),
    criticalAlerts: deriveCriticalAlerts(kpis),
  };
}

// ── fetchIGPerformance ────────────────────────────────────────────────────

export async function fetchIGPerformance(
  clientId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<FormatPerformanceRow[]> {
  const { data, error } = await supabase
    .from("format_performance")
    .select("id, format_name, post_count, share_count, trend_label, trend_color")
    .eq("client_id", clientId)
    .gte("period_start", new Date(periodStart).toISOString())
    .lte("period_end", new Date(periodEnd).toISOString())
    .returns<RawFormatRow[]>();

  if (error) {
    console.error("[instagramRepository] fetchIGPerformance:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(toFormatRow);
}

// ── fetchIGAudience ───────────────────────────────────────────────────────
// Shape TBD — returns raw rows until audience types are defined.

export interface RawAudienceRow {
  id: string;
  client_id: string;
  age_range: string;
  gender_split: number;
  top_city: string;
  recorded_at: string;
}

export async function fetchIGAudience(
  clientId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RawAudienceRow[]> {
  const { data, error } = await supabase
    .from("ig_audience_snapshots")
    .select("id, client_id, age_range, gender_split, top_city, recorded_at")
    .eq("client_id", clientId)
    .gte("recorded_at", new Date(periodStart).toISOString())
    .lte("recorded_at", new Date(periodEnd).toISOString())
    .order("recorded_at", { ascending: false })
    .returns<RawAudienceRow[]>();

  if (error) {
    console.error("[instagramRepository] fetchIGAudience:", error.message);
    throw new Error(error.message);
  }

  return data ?? [];
}

// ── discoverDateBounds ────────────────────────────────────────────────────
// Returns the earliest and latest period available for a given client.

export interface DateBounds {
  earliest: Date;
  latest: Date;
}

export async function discoverDateBounds(
  clientId: string
): Promise<DateBounds | null> {
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("period_start, period_end")
    .eq("client_id", clientId)
    .order("period_start", { ascending: true })
    .limit(1)
    .returns<{ period_start: string; period_end: string }[]>();

  if (error || !data || data.length === 0) {
    console.error(
      "[instagramRepository] discoverDateBounds:",
      error?.message ?? "no data"
    );
    return null;
  }

  const { data: latest, error: latestErr } = await supabase
    .from("kpi_snapshots")
    .select("period_end")
    .eq("client_id", clientId)
    .order("period_end", { ascending: false })
    .limit(1)
    .returns<{ period_end: string }[]>();

  if (latestErr || !latest || latest.length === 0) return null;

  return {
    earliest: new Date(data[0].period_start),
    latest: new Date(latest[0].period_end),
  };
}