// ============================================================================
// src/types/instagram.ts
// ============================================================================

export type FetchStatus = "idle" | "loading" | "success" | "error";

export type SemaphoreColor = "verde" | "ambar" | "vermelho";

export type GlowColor = "cyan" | "gold" | "red" | "none";

export type TrendColor = "gold" | "red" | "cyan";

// StatusVariant — fonte única de verdade para este projeto.
// Valores alinhados com QualityScoresPanel.tsx (que compara contra 'ok' | 'warn').
// orbit.ts deve importar este tipo em vez de redeclarar inline.
export type StatusVariant = "ok" | "warn" | "neutral";

export interface AsyncState<T> {
  data: T;
  status: FetchStatus;
  error: string | null;
}

// ── Header ────────────────────────────────────────────────────────────────
export interface DashboardHeaderMeta {
  clientHandle: string;
  periodLabel: string;
  dateRange: {
    start: Date;
    end: Date;
  };
}

// ── KPI Card ──────────────────────────────────────────────────────────────
export interface KPICardData {
  id: string;
  label: string;
  value: number;
  unit: string;
  delta: number;
  deltaLabel: string;
  semaphore: SemaphoreColor;
  glowColor: GlowColor;
  subtitle: string;
}

// ── Quality Score ─────────────────────────────────────────────────────────
export interface QualityScoreItem {
  id: string;
  label: string;
  value: number;
  unit: string;
  statusText: string;
  statusVariant: StatusVariant;
  glowColor: GlowColor;
}

// ── Format Performance ────────────────────────────────────────────────────
export interface FormatPerformanceRow {
  id: string;
  format: string;
  posts: number;
  shares: number;
  trendLabel: string;
  trendColor: TrendColor;
}

// ── Insight ───────────────────────────────────────────────────────────────
export interface InsightData {
  id: string;
  text: string;
}

// ── Critical Alert ───────────────────────────────────────────────────────
export interface CriticalAlertData {
  id: string;
  title: string;
  body: string;
  severity: "critical" | "warning" | "info";
}

// ── Root overview ─────────────────────────────────────────────────────────
export interface IGOverviewData {
  meta: DashboardHeaderMeta;
  kpis: KPICardData[];
  qualityScores: QualityScoreItem[];
  formatPerformance: FormatPerformanceRow[];
  insights: InsightData[];
  criticalAlerts: CriticalAlertData[];
}