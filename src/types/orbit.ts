/* ==========================================================================
   ORBIT · Domain Types (v1.1.0 — CORRIGIDO)
   Versão: 1.1.0  |  Data: 2026-06-12

   MUDANÇAS v1.1.0:
   1. ✅ KPICardData: Adicionados campos unit, delta, glowColor (faltavam)
   2. ✅ KPICardData: Renomeado 'status' → 'semaphore' (alinhamento com schema)
   3. ✅ KPICardData: subtitle é string | null (não apenas string)
   4. ✅ QualityScoreItem: Adicionados campos id, unit, glowColor (faltavam)
   5. ✅ QualityScoreItem: Renomeado 'key' → 'label' (consistência)
   6. ✅ ScoreValueType: Aceita 'N/A' além de number
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
// Entidade: KPI Card (CORRIGIDO v1.1.0)
// ─────────────────────────────────────────────

export interface KPICardData {
  id:         string
  label:      string
  value:      number
  unit:       string | null          // ✅ ADICIONADO (faltava)
  delta:      number                 // ✅ ADICIONADO (faltava)
  deltaLabel: string
  semaphore:  SemaphoreColor         // ✅ RENOMEADO de 'status'
  glowColor:  GlowColor              // ✅ ADICIONADO (faltava)
  subtitle:   string | null          // ✅ CORRIGIDO (era apenas string)
  sourceLevel?: string
  playRate?:   number | null
}

// ─────────────────────────────────────────────
// Entidade: Score de Qualidade (CORRIGIDO v1.1.0)
// ─────────────────────────────────────────────

export type ScoreValueType = number | 'N/A'  // ✅ ADICIONADO 'N/A'

export interface QualityScoreItem {
  id:            string                      // ✅ ADICIONADO (faltava)
  label:         string                      // ✅ RENOMEADO de 'key'
  value:         ScoreValueType
  unit:          string                      // ✅ ADICIONADO (faltava)
  statusText:    string
  statusVariant: 'ok' | 'warn' | 'neutral'
  glowColor:     GlowColor                   // ✅ ADICIONADO (faltava)
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
    start: Date
    end:   Date
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

export interface AlertRow {
  id:         string
  client_id:  string
  metric_id:  string
  severity:   'critical' | 'warning' | 'info'
  message:    string
  created_at: string
}

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

// ─────────────────────────────────────────────
// Entidade: Dados Demográficos do Cliente
// ─────────────────────────────────────────────

export interface ClientDemographics {
  gender: {
    male_pct: number
    female_pct: number
    other_pct: number
    updated_at: string
  }
  ageRange: {
    '18-24': number
    '25-34': number
    '35-44': number
    '45-54': number
    '55+': number
    updated_at: string
  }
  cities: {
    name: string
    pct: number
  }[]
  countries: {
    name: string
    pct: number
  }[]
}

// ─────────────────────────────────────────────
// Entidade: Cliente (Supabase Row)
// ─────────────────────────────────────────────

export interface ClientRow {
  id: string
  agency_id: string
  name: string
  instagram_account_id: string | null
  meta_ads_account_id: string | null
  is_business_account: boolean
  
  // Dados esperados (planejamento)
  avatar_gender_expected: string | null
  avatar_age_range_expected: string | null
  avatar_city_expected: string | null
  
  // Dados reais (extraídos do Instagram)
  avatar_gender_real: ClientDemographics['gender'] | null
  avatar_age_range_real: ClientDemographics['ageRange'] | null
  avatar_cities_real: ClientDemographics['cities'] | null
  avatar_countries_real: ClientDemographics['countries'] | null
  demographics_updated_at: string | null
  
  // Benchmarks
  benchmark_cpm_l2: number | null
  benchmark_engagement_l2: number | null
  benchmark_input_by: string | null
  benchmark_updated_at: string | null
  
  // Thresholds
  ctr_threshold_meta: number
  ctr_threshold_google: number
  cpa_alert_multiplier: number
  freq_alert_threshold: number
  
  // Timestamps
  created_at: string
  updated_at: string
}




