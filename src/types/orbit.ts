/* ==========================================================================
   ORBIT · Domain Types (v1.1.0 — CORRIGIDO)
   
   Versão: 1.1.0  |  Data: 2026-06-20
   
   PATCHES APLICADOS:
   ✅ PATCH A: KPICardData.subtitle: string → string | null
   ✅ PATCH B: InstagramOverviewData → IGOverviewData + 'meta' field
   ✅ PATCH C-1: StatusVariant export adicionado
   ✅ PATCH C-2: FunnelStep.id + FunnelStep.icon adicionados
   ✅ PATCH C-3: AlignmentColor novo tipo + AlignmentBar.color corrigido
   ✅ PATCH C-4: MetaAdsKPI.delta + MetaAdsKPI.deltaLabel adicionados
   ✅ PATCH C-5: KpiSnapshotRow campos corrigidos
   ✅ PATCH C-6 BÔNUS: Campaign.cpl adicionado
   
   MUDANÇAS v1.1.0:
   1. ✅ KPICardData: Adicionados campos unit, delta, glowColor (faltavam)
   2. ✅ KPICardData: Renomeado 'status' → 'semaphore' (alinhamento com schema)
   3. ✅ KPICardData: subtitle é string | null (PATCH A aplicado)
   4. ✅ QualityScoreItem: Adicionados campos id, unit, glowColor (faltavam)
   5. ✅ QualityScoreItem: Renomeado 'key' → 'label' (consistência)
   6. ✅ ScoreValueType: Aceita 'N/A' além de number
   7. ✅ IGOverviewData: Renomeado de InstagramOverviewData (PATCH B aplicado)
   8. ✅ IGOverviewData: Campo 'meta' (não 'header') + ordem corrigida
   9. ✅ Adições: FunnelStep, FunnelData, AvatarProfile, AlignmentBar, etc
   ========================================================================== */

// ─────────────────────────────────────────────
// Primitivos de design system
// ─────────────────────────────────────────────

export type GlowColor      = 'cyan' | 'red' | 'gold' | 'none'
export type SemaphoreColor = 'verde' | 'ambar' | 'vermelho'
export type DeltaDirection = 'up' | 'down' | 'neutral'
export type TabId          = 'overview' | 'por-post' | 'audiencia'
export type TrendColor     = 'cyan' | 'red' | 'gold'
export type SourceLevel    = 'L0' | 'L1' | 'L2'
export type StatusVariant  = 'ok' | 'warn' | 'neutral'  // ✅ PATCH C-1: ADICIONADO

// ─────────────────────────────────────────────
// Entidade: KPI Card (CORRIGIDO v1.1.0 + PATCH A)
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
  subtitle:   string | null          // ✅ PATCH A: era apenas string
  sourceLevel?: SourceLevel
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
  statusVariant: StatusVariant               // ✅ PATCH C-1: Usa type exportado
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
// PATCH B: Renomeado de InstagramOverviewData → IGOverviewData
// ─────────────────────────────────────────────

/** Aggregate root da tela de overview do Instagram. */
export interface IGOverviewData {
  meta:              DashboardHeaderMeta          // ✅ PATCH B: 'meta', nunca 'header'
  kpis:              KPICardData[]
  qualityScores:     QualityScoreItem[]
  formatPerformance: FormatPerformanceRow[]
  insights:          InsightData[]
  criticalAlerts:    CriticalAlertData[]
}

// ─────────────────────────────────────────────
// ADIÇÕES v2.1: FUNIL INTERATIVO (+ PATCH C-2)
// ─────────────────────────────────────────────

export interface FunnelStep {
  id:         string    // ✅ PATCH C-2: ADICIONADO (necessário para React key)
  label:      string    // "Alcance total", "Visitas ao perfil"
  value:      number    // 443, 53, 4
  percentage: number    // 100, 12, 0.9
  color:      string    // 'blue', 'amber', 'red'
  icon?:      string    // ✅ PATCH C-2: ADICIONADO (emoji/identifier opcional)
}

export interface FunnelData {
  clientId:   string
  steps:      FunnelStep[]
  totalValue: number
  period:     string    // "90 dias", "30 dias"
}

export interface FunnelSimulatorParams {
  ctrBio:        number  // 7.5% (visita → clique na bio)
  conversionRate: number // 1.0% (clique → venda)
  monthlyReach:  number  // 500 (alcance mensal meta)
}

export interface FunnelSimulationResult {
  projectedClicks: number
  projectedSales:  number
  note:            string
}

// ─────────────────────────────────────────────
// ADIÇÕES v2.1: AVATAR ALIGNMENT (+ PATCH C-3)
// ─────────────────────────────────────────────

/** Cores para barras de alinhamento de avatar — var(--green/amber/red) no HTML */
export type AlignmentColor = 'green' | 'amber' | 'red'  // ✅ PATCH C-3: NOVO TIPO

export interface AvatarProfile {
  clientId: string
  
  // Dados esperados (cadastrados pelo gestor)
  genderExpected:        string
  genderExpectedPercent: number
  ageRangeExpected:      string
  ageRangeExpectedPercent: number
  cityExpected:          string
  cityExpectedPercent:   number
  
  // Dados reais (da API do Instagram)
  genderReal:            string
  genderRealPercent:     number
  ageRangeReal:          string
  ageRangeRealPercent:   number
  cityReal:              string
  cityRealPercent:       number
  
  // Score agregado
  alignmentScore:  number
  alignmentStatus: 'critical' | 'warning' | 'healthy'
  
  // Diagnóstico
  diagnosis:       string
  recommendation:  string
}

export interface AlignmentBar {
  label:    string
  expected: number
  real:     number
  variance: number
  color:    AlignmentColor  // ✅ PATCH C-3: Mudado de GlowColor para AlignmentColor
}

export interface AlignmentCalculation {
  scoreGender:  number
  scoreAgeRange: number
  scoreCity:    number
  scoreTotal:   number
  formula:      string
}

// ─────────────────────────────────────────────
// ADIÇÕES v2.1: CLIENTE (Carteira)
// ─────────────────────────────────────────────

export interface ClientCard {
  id:      string
  name:    string
  handle:  string
  status:  'critical' | 'warning' | 'healthy'
  metrics: {
    followerBalance: number
    engagement:      number
    ctr:             number
  }
  alerts:  number
}

// ─────────────────────────────────────────────
// ADIÇÕES v2.1: META ADS (+ PATCH C-4 + C-6)
// ─────────────────────────────────────────────

export interface Campaign {
  id:              string
  name:            string
  objective:       string
  roas:            number | null
  ctr:             number
  frequency:       number
  fatiguePercent:  number
  fatigueStatus:   'healthy' | 'warning' | 'critical'
  diagnosis:       'saudavel' | 'saturacao_criativo' | 'problema_segmentacao'
  actionRequired:  string
  cpl?:            number    // ✅ PATCH C-6 BÔNUS: ADICIONADO (custo por lead)
}

export interface MetaAdsKPI {
  id:         string
  label:      string
  value:      number
  unit:       string
  delta:      number        // ✅ PATCH C-4: ADICIONADO (variação vs período anterior)
  deltaLabel: string        // ✅ PATCH C-4: ADICIONADO (ex: '+0.3 vs. mês anterior')
  status:     'ok' | 'warn' | 'error'
  benchmark?: number
}

export interface Creative {
  id:            string
  name:          string
  clientId:      string
  format:        string
  ctr:           number
  roas?:         number
  fatiguePercent: number
  status:        'healthy' | 'warning' | 'critical'
  action:        'manter' | 'monitorar' | 'substituir' | 'pausar'
}

// ─────────────────────────────────────────────
// ADIÇÕES v2.1: GOOGLE ADS
// ─────────────────────────────────────────────

export interface GoogleAdsKPI {
  id:        string
  label:     string
  value:     number
  unit:      string
  status:    'ok' | 'warn' | 'error'
  benchmark?: number
}

export interface SearchQuery {
  query:        string
  clicks:       number
  conversions:  number
  cpa:          number
}

// ─────────────────────────────────────────────
// Supabase row shapes (raw — antes de transformar)
// PATCH C-5: KpiSnapshotRow CORRIGIDO
// ─────────────────────────────────────────────

export interface KpiSnapshotRow {
  id:           string
  client_id:    string
  period_start: string
  period_end:   string
  metric:       string          // ✅ PATCH C-5: Mudado de 'metric_key' (coluna real: 'metric')
  value:        number          // ✅ PATCH C-5: Mudado de 'metric_value' (coluna real: 'value')
  value_text:   string | null   // ✅ PATCH C-5: Mudado de 'metric_unit' (coluna real: 'value_text')
  delta_pct:    number
  semaphore:    SemaphoreColor
  subtitle:     string | null
  post_id:      string | null   // ✅ PATCH C-5: ADICIONADO (FK posts — necessário para KPIs por post)
  ad_id:        string | null   // ✅ PATCH C-5: ADICIONADO (FK ads_metrics)
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
  status_variant: StatusVariant
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