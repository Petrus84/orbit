/* ============================================================================
   ORBIT · Domain Types (v1.2.0 — CONSOLIDADO)
   
   Versão: 1.2.0  |  Data: 2026-07-02
   Status: ✅ PRONTO PARA PRODUÇÃO
   
   PATCHES APLICADOS:
   ✅ PATCH A: KPICardData.subtitle: string → string | null
   ✅ PATCH B: InstagramOverviewData → IGOverviewData + 'meta' field
   ✅ PATCH C-1: StatusVariant export adicionado
   ✅ PATCH C-2: FunnelStep.id + FunnelStep.icon adicionados
   ✅ PATCH C-3: AlignmentColor novo tipo + AlignmentBar.color corrigido
   ✅ PATCH C-4: MetaAdsKPI.delta + MetaAdsKPI.deltaLabel adicionados
   ✅ PATCH C-5: KpiSnapshotRow campos corrigidos
   ✅ PATCH C-6 BÔNUS: Campaign.cpl adicionado
   ============================================================================ */

export type GlowColor      = 'cyan' | 'red' | 'gold' | 'none'
export type SemaphoreColor = 'verde' | 'ambar' | 'vermelho'
export type DeltaDirection = 'up' | 'down' | 'neutral'
export type TabId          = 'overview' | 'por-post' | 'audiencia'
export type TrendColor     = 'cyan' | 'red' | 'gold'
export type SourceLevel    = 'L0' | 'L1' | 'L2'
export type StatusVariant  = 'ok' | 'warn' | 'neutral'
export type AlertSeverity  = 'critical' | 'warning' | 'info'
export type ClientStatus   = 'critical' | 'warning' | 'healthy'
export type AlignmentStatus = 'critical' | 'warning' | 'healthy'
export type AlignmentColor = 'green' | 'amber' | 'red'

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data:   T | null
  status: FetchStatus
  error:  string | null
}

export interface KPICardData {
  id:         string
  label:      string
  value:      number
  unit:       string | null
  delta:      number
  deltaLabel: string
  semaphore:  SemaphoreColor
  glowColor:  GlowColor
  subtitle:   string | null
  sourceLevel?: SourceLevel
  playRate?:   number | null
}

export type ScoreValueType = number | 'N/A'

export interface QualityScoreItem {
  id:            string
  label:         string
  value:         ScoreValueType
  unit:          string
  statusText:    string
  statusVariant: StatusVariant
  glowColor:     GlowColor
}

export interface FormatPerformanceRow {
  id:         string
  format:     string
  posts:      number
  shares:     number
  trendLabel: string
  trendColor: TrendColor
}

export interface InsightData {
  id:   string
  text: string
}

export interface CriticalAlertData {
  id:       string
  title:    string
  body:     string
  severity: 'critical' | 'warning' | 'info'
}

export interface DashboardHeaderMeta {
  clientHandle: string
  periodLabel:  string
  dateRange: {
    start: Date
    end:   Date
  }
}

export interface IGOverviewData {
  meta:              DashboardHeaderMeta
  kpis:              KPICardData[]
  qualityScores:     QualityScoreItem[]
  formatPerformance: FormatPerformanceRow[]
  insights:          InsightData[]
  criticalAlerts:    CriticalAlertData[]
}

export interface FunnelStep {
  id:         string
  label:      string
  value:      number
  percentage: number
  color:      string
  icon?:      string
}

export interface FunnelData {
  clientId:   string
  steps:      FunnelStep[]
  totalValue: number
  period:     string
}

export interface FunnelMetrics {
  alcance:  number
  visitas:  number
  cliques:  number
  vendas:   number
  ctrBio:   number
  taxaConv: number
}

export interface SliderConfig {
  id:        string
  label:     string
  current:   number
  min:       number
  max:       number
  step:      number
  benchmark: number
  unit:      string
}

export interface SimulatedFunnelResult {
  inputs:      { ctr: number; conv: number; alcance: number }
  funnel:      FunnelMetrics
  deltaVendas: number
}

export interface FunnelScreenData {
  real:      FunnelMetrics
  simulated: SimulatedFunnelResult | null
  sliders:   SliderConfig[]
}

export interface UseFunnelResult {
  data:        FunnelMetrics | null
  status:      'idle' | 'loading' | 'success' | 'error'
  error:       string | null
  lastUpdated: Date | null
  refetch:     () => void
}

export interface FunnelMetricsRow {
  id:           string
  client_id:    string
  alcance:      number
  visitas:      number
  cliques:      number
  vendas:       number
  ctr_bio:      number
  taxa_conv:    number
  period_start: string
  period_end:   string
  created_at:   string
}

export interface GenderSplit {
  male:   number
  female: number
}

export interface AvatarProfile {
  gender:    GenderSplit
  ageRange:  string
  interest:  string
  geo:       string
}

export interface AlignmentBar {
  label:    string
  expected: number
  real:     number
  variance: number
  color:    AlignmentColor
}

export interface AvatarAlignment {
  id:             string
  clientId:       string
  expected:       AvatarProfile
  real:           AvatarProfile
  score:          number
  status:         AlignmentStatus
  bars:           AlignmentBar[]
  recommendation: string
}

export interface AlignmentCalculation {
  scoreGender:   number
  scoreAgeRange: number
  scoreCity:     number
  scoreTotal:    number
  formula:       string
}

export const ALIGNMENT_STATUS_LABEL: Record<AlignmentStatus, string> = {
  healthy:  'Saudável',
  warning:  'Atenção',
  critical: 'Crítico',
}

export const ALIGNMENT_THRESHOLDS = {
  critical: 50,
  warning:  75,
} as const

export interface ClientMetrics {
  follower_balance: number
  engagement_real:  number
  ctr_link:         number
}

export interface Client {
  id:        string
  name:      string
  handle:    string
  avatarUrl: string | null
  status:    ClientStatus
  metrics:   ClientMetrics
}

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

export interface ClientDemographics {
  gender: {
    male_pct:   number
    female_pct: number
    other_pct:  number
    updated_at: string
  }
  ageRange: {
    '18-24': number
    '25-34': number
    '35-44': number
    '45-54': number
    '55+':   number
    updated_at: string
  }
  cities: {
    name: string
    pct:  number
  }[]
  countries: {
    name: string
    pct:  number
  }[]
}

export interface ClientRow {
  id:                           string
  agency_id:                    string
  name:                         string
  instagram_account_id:         string | null
  meta_ads_account_id:          string | null
  is_business_account:          boolean
  avatar_gender_expected:       string | null
  avatar_age_range_expected:    string | null
  avatar_city_expected:         string | null
  avatar_gender_real:           ClientDemographics['gender'] | null
  avatar_age_range_real:        ClientDemographics['ageRange'] | null
  avatar_cities_real:           ClientDemographics['cities'] | null
  avatar_countries_real:        ClientDemographics['countries'] | null
  demographics_updated_at:      string | null
  benchmark_cpm_l2:             number | null
  benchmark_engagement_l2:      number | null
  benchmark_input_by:           string | null
  benchmark_updated_at:         string | null
  ctr_threshold_meta:           number
  ctr_threshold_google:         number
  cpa_alert_multiplier:         number
  freq_alert_threshold:         number
  created_at:                   string
  updated_at:                   string
}

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

export type CampaignObjective = 
  | 'OUTREACH' 
  | 'TRAFFIC' 
  | 'ENGAGEMENT' 
  | 'LEADS' 
  | 'APP_PROMOTION' 
  | 'SALES'

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export interface Campaign {
  id:              string
  name:            string
  objective:       CampaignObjective
  roas:            number | null
  ctr:             number
  frequency:       number
  fatiguePercent:  number
  fatigueStatus:   string
  status:          CampaignStatus
  cpl:             number
  diagnosis?:      string
  actionRequired?: string
}

export interface MetaAdsKPI {
  id:         string
  status:     string
  label:      string
  value:      number
  unit:       string
  delta:      number
  deltaLabel: string
}

export interface CampaignRow {
  id:              string
  client_id:       string
  name:            string
  objective:       CampaignObjective
  roas:            number | null
  ctr:             number
  frequency:       number
  fatigue_percent: number
  status:          CampaignStatus
  cpl:             number
}

export interface AlertAction {
  label:   string
  onClick: () => void
  variant: 'primary' | 'secondary' | 'danger'
}

export interface Alert {
  id:          string
  clientId:    string
  clientName:  string
  clientHandle: string
  title:       string
  description: string
  severity:    AlertSeverity
  createdAt:   Date
}

export interface KpiSnapshotRow {
  id:           string
  client_id:    string
  period_start: string
  period_end:   string
  metric:       string
  value:        number
  value_text:   string | null
  delta_pct:    number
  semaphore:    SemaphoreColor
  subtitle:     string | null
  post_id:      string | null
  ad_id:        string | null
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

export const STATUS_LABEL: Record<ClientStatus, string> = {
  critical: 'Crítico',
  warning:  'Atenção',
  healthy:  'Saudável',
}

export const SEMAPHORE_LABEL: Record<SemaphoreColor, string> = {
  verde:    'Saudável',
  ambar:    'Atenção',
  vermelho: 'Crítico',
}

export const ALIGNMENT_THRESHOLDS_FULL = {
  critical: 50,
  warning:  75,
} as const

export const ALERT_SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Crítico',
  warning:  'Aviso',
  info:     'Informativo',
}

export const CAMPAIGN_OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  OUTREACH:       'Alcance',
  TRAFFIC:        'Tráfego',
  ENGAGEMENT:     'Engajamento',
  LEADS:          'Leads',
  APP_PROMOTION:  'Promoção de App',
  SALES:          'Vendas',
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  ACTIVE:   'Ativa',
  PAUSED:   'Pausada',
  ARCHIVED: 'Arquivada',
}

export interface FunnelSimulatorParams {
  ctrBio:         number
  conversionRate: number
  monthlyReach:   number
}

export interface FunnelSimulationResult {
  projectedClicks: number
  projectedSales:  number
  note:            string
}