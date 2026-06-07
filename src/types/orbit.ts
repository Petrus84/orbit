/* ==========================================================================
   ORBIT · Domain Types
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

// ─────────────────────────────────────────────
// Primitivos de design system
// ─────────────────────────────────────────────

export type GlowColor    = 'cyan' | 'red' | 'gold' | 'none'
export type SemaphoreColor = 'verde' | 'ambar' | 'vermelho'
export type DeltaDirection = 'up' | 'down' | 'neutral'
export type TabId        = 'overview' | 'por-post' | 'audiencia'
export type TrendColor   = 'cyan' | 'red' | 'gold'

// ─────────────────────────────────────────────
// Entidade: KPI Card
// ─────────────────────────────────────────────

export interface KPICardData {
  id: string
  label: string
  value: number
  unit: string | null
  delta: number                  // percentual — positivo ↑ / negativo ↓
  deltaLabel: string
  semaphore: 'verde' | 'ambar' | 'vermelho';
  glowColor: GlowColor;
  subtitle: string;
  sourceLevel?: string;
  playRate?: number | null; // 💡 ADIÇÃO P1: videoViewCount / videoPlayCount (D-04)
}       // ex: "↓ 8 novos + 56 saíram"


// ─────────────────────────────────────────────
// Entidade: Score de Qualidade
// ─────────────────────────────────────────────

export type ScoreValueType = number | 'N/A'

export interface QualityScoreItem {
  id: string
  label: string
  value: ScoreValueType
  unit: string                   // ex: "%" ou ""
  statusText: string             // ex: "Acima do threshold 2%"
  statusVariant: 'ok' | 'warn' | 'neutral'
  glowColor: GlowColor
}

// ─────────────────────────────────────────────
// Entidade: Performance por Formato
// ─────────────────────────────────────────────

export interface FormatPerformanceRow {
  id: string
  format: string                 // ex: "Reels"
  posts: number
  shares: number
  trendLabel: string             // ex: "Candidato boost"
  trendColor: TrendColor
}

// ─────────────────────────────────────────────
// Entidade: Insight
// ─────────────────────────────────────────────

export interface InsightData {
  id: string
  text: string
}

// ─────────────────────────────────────────────
// Entidade: Alerta Crítico
// ─────────────────────────────────────────────

export interface CriticalAlertData {
  id: string
  title: string
  body: string
  severity: 'critical' | 'warning' | 'info'
}

// ─────────────────────────────────────────────
// Entidade: Header / Contexto de tela
// ─────────────────────────────────────────────

export interface DashboardHeaderMeta {
  clientHandle: string           // ex: "@cpimportstore"
  periodLabel: string            // ex: "90 dias"
  dateRange: {
    from: string                 // ISO date: "2026-02-23"
    to: string                   // ISO date: "2026-05-23"
  }
}

// ─────────────────────────────────────────────
// Aggregate: tudo que a página "visão geral IG" precisa
// ─────────────────────────────────────────────

export interface InstagramOverviewData {
  meta: DashboardHeaderMeta
  kpis: KPICardData[]
  qualityScores: QualityScoreItem[]
  formatPerformance: FormatPerformanceRow[]
  insights: InsightData[]
  criticalAlerts: CriticalAlertData[]
}

// ─────────────────────────────────────────────
// Supabase row shapes (raw — antes de transformar)
// ─────────────────────────────────────────────

export interface KpiSnapshotRow {
  id: string
  client_id: string
  period_start: string
  period_end: string
  metric_key: string
  metric_value: number
  metric_unit: string | null
  delta_pct: number
  semaphore: SemaphoreColor
  subtitle: string | null
  created_at: string
}

export interface QualityScoreRow {
  id: string
  client_id: string
  period_start: string
  period_end: string
  score_key: string
  score_value: number | null
  status_text: string
  status_variant: 'ok' | 'warn' | 'neutral'
  created_at: string
}

export interface FormatPerformanceRawRow {
  id: string
  client_id: string
  period_start: string
  period_end: string
  format_name: string
  post_count: number
  share_count: number
  trend_label: string
  trend_color: TrendColor
}

export interface AlertRow {
  id: string
  client_id: string
  title: string
  body: string
  severity: 'critical' | 'warning' | 'info'
  is_active: boolean
  created_at: string
}

// ─────────────────────────────────────────────
// Estado do hook/context
// ─────────────────────────────────────────────

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  status: FetchStatus
  error: string | null
}
