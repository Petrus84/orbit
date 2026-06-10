/* ==========================================================================
   ORBIT · Domain Types
   Versão: 1.0.1  |  Data: 2026-06-07

   MUDANÇAS v1.0.1 — apenas 2 linhas alteradas em KPICardData:
   1. subtitle: string → string | null  (revertido — banco retorna null, prototypeConstants tem null)
   2. playRate?: number | null          (mantido — campo opcional, não quebra nada)

   Nenhum outro tipo foi alterado.
   ========================================================================== */

// ─────────────────────────────────────────────
// Primitivos de design system
// ─────────────────────────────────────────────

export type GlowColor      = 'cyan' | 'red' | 'gold' | 'none'
export type SemaphoreColor = 'verde' | 'ambar' | 'vermelho'
export type DeltaDirection = 'up' | 'down' | 'neutral'
export type TabId          = 'overview' | 'por-post' | 'audiencia'
export type TrendColor     = 'cyan' | 'red' | 'gold'

// ─────────────────────────────────────────────
// Entidade: KPI Card
// ─────────────────────────────────────────────

export interface KPICardData {
  id:         string
  label:      string
  value:      number
  unit:       string | null
  delta:      number
  deltaLabel: string
  semaphore:  SemaphoreColor
  glowColor:  GlowColor
  subtitle:    string | null   // FIX v1.0.1: era 'string', deve ser 'string | null'
                               // prototypeConstants tem null em 3 dos 4 cards
                               // KpiSnapshotRow.subtitle também é string | null
  sourceLevel?: string
  playRate?:   number | null   // campo opcional — não quebra componentes existentes
}

// ─────────────────────────────────────────────
// Entidade: Score de Qualidade
// ─────────────────────────────────────────────

export type ScoreValueType = number | 'N/A'

export interface QualityScoreItem {
  id:            string
  label:         string
  value:         ScoreValueType
  unit:          string
  statusText:    string
  statusVariant: 'ok' | 'warn' | 'neutral'
  glowColor:     GlowColor
}

// ─────────────────────────────────────────────
// Entidade: Performance por Formato
// ─────────────────────────────────────────────

export interface FormatPerformanceRow {
  id:         string
  format:     string
  posts:      number
  shares:     number
  trendLabel: string
  trendColor: TrendColor
}

// ─────────────────────────────────────────────
// Entidade: Insight
// ─────────────────────────────────────────────

export interface InsightData {
  id:   string
  text: string
}

// ─────────────────────────────────────────────
// Entidade: Alerta Crítico
// ─────────────────────────────────────────────

export interface CriticalAlertData {
  id:       string
  title:    string
  body:     string
  severity: 'critical' | 'warning' | 'info'
}

// ─────────────────────────────────────────────
// Entidade: Header / Contexto de tela
// ─────────────────────────────────────────────

export interface DashboardHeaderMeta {
  clientHandle: string
  periodLabel:  string
  dateRange: {
    from: string
    to:   string
  }
}

// ─────────────────────────────────────────────
// Aggregate: tudo que a página visão geral IG precisa
// ─────────────────────────────────────────────

export interface InstagramOverviewData {
  meta:              DashboardHeaderMeta
  kpis:              KPICardData[]
  qualityScores:     QualityScoreItem[]
  formatPerformance: FormatPerformanceRow[]
  insights:          InsightData[]
  criticalAlerts:    CriticalAlertData[]
}

// ─────────────────────────────────────────────
// Supabase row shapes (raw — antes de transformar)
// ─────────────────────────────────────────────

export interface KpiSnapshotRow {
  id:           string
  client_id:    string
  period_start: string
  period_end:   string
  metric_key:   string
  metric_value: number
  metric_unit:  string | null
  delta_pct:    number
  semaphore:    SemaphoreColor
  subtitle:     string | null
  created_at:   string
}

export interface QualityScoreRow {
  id:             string
  client_id:      string
  period_start:   string
  period_end:     string
  score_key:      string
  score_value:    number | null
  status_text:    string
  status_variant: 'ok' | 'warn' | 'neutral'
  created_at:     string
  calculated_at?: string
}

export interface FormatPerformanceRawRow {
  id:           string
  client_id:    string
  period_start: string
  period_end:   string
  format_name:  string
  post_count:   number
  share_count:  number
  trend_label:  string
  trend_color:  TrendColor
}

// ✅ AlertRow corrigido:
export interface AlertRow {
  id:         string
  client_id:  string
  metric_id:  string    // ← era 'title'
  severity:   'critical' | 'warning' | 'info'
  message:    string    // ← era 'body'
  created_at: string
  // is_active removido — não existe na tabela
}
// ✅ ADICIONAR APÓS AlertRow (linha ~150):
export interface CriticalAlertRawRow {
  id:         string
  client_id:  string
  metric_id:  string
  severity:   'critical' | 'warning' | 'info'
  message:    string
  created_at: string
}

// ─────────────────────────────────────────────
// Estado do hook / context
// ─────────────────────────────────────────────

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data:   T | null
  status: FetchStatus
  error:  string | null
}