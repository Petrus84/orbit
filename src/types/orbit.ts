// ============================================================================
// src/types/orbit.ts (v1.9.0 — RECONCILIAÇÃO SSOT × CONSUMIDORES REAIS)
//
// v1.9.0 (destravar deploy — 2026-07-15):
// Este patch NÃO redesenha a arquitetura de tipos. Ele alinha o SSOT ao que
// os 26 arquivos que falhavam no `tsc --noEmit` REALMENTE consomem hoje.
// Onde havia dois formatos concorrentes (um "novo" em orbit.ts, um "antigo"
// espalhado pelos componentes/repositórios), venceu o formato usado pelo
// código real — porque reescrever orbit.ts é 1 arquivo, reescrever 20
// componentes às cegas (sem ver o source deles) é arriscado.
//
// MUDANÇAS DE RUPTURA (breaking, mas necessárias):
// - GlowColor: 'green'|'yellow' → 'cyan'|'gold' (usado em 6+ arquivos)
// - SemaphoreColor: 'green'|'yellow'|'red' → 'verde'|'ambar'|'vermelho'
// - StatusVariant: 'success'|'warning'|'danger' → 'ok'|'warn'|'neutral'
// - KPICardData, QualityScoreItem, FormatPerformanceRow, InsightData:
//   revertidos ao formato "plano" antigo (era o único usado de fato)
// - AsyncState<T>: loading:boolean + error:Error|null
//                → status:FetchStatus + error:string|null
//   (bate com o que TODOS os hooks retornam e os componentes desestruturam)
// - FunnelMetrics: reach/profileVisits/linkClicks → alcance/visitas/cliques/
//   vendas/ctrBio/taxaConv (formato que FunnelChart e as 2 telas de funil
//   realmente usam). O formato "reach-based" antigo virou FunnelActualMetrics
//   (mantido, não usado nos erros reportados, mas preservado por segurança).
// - IGOverviewData: era um shape flat de estatísticas de conta (não usado em
//   nenhum lugar que deu erro). Renomeado para IGAccountOverviewData.
//   IGOverviewData agora é o agregado real de tela: {meta, kpis,
//   qualityScores, formatPerformance, insights, criticalAlerts}.
// - TabId: adicionado 'por-post' | 'audiencia' (nomes reais das abas em PT-BR)
// - AlignmentBar: adicionado campo `color` (AlignmentColor) — mantido
//   `status` também, ambos preenchidos pelo mesmo valor.
// - MetaAdsKPI: adicionado `id: string`
// - MetaCampaignRow: adicionados roas, ctr, frequency, fatigue_percent, cpl
// - Novo: `Campaign` (alias de CampaignRow) — useMetaAds.ts importava e não
//   existia.
//
// ⚠️ NÃO MUDOU: OrbitClientHealthRow, ClientHealthStatus, Client,
// ClientMetrics, AvatarAlignmentRow, todo o bloco de Avatar (Seção 3) —
// validados contra o Supabase ao vivo em 2026-07-15, batem com o schema real.
// ============================================================================

// ============================================================================
// IMPORTS
// ============================================================================
import type { ReactNode } from 'react'

// ============================================================================
// SEÇÃO 0: TIPOS CANÔNICOS COMPARTILHADOS
// ============================================================================

/** Severidade de alerta. Fonte canônica — types/alert.ts apenas re-exporta. */
export type AlertSeverity = 'info' | 'warning' | 'critical'

export type CampaignObjective = string
export type CampaignStatus = string

export interface CampaignRow {
  id: string
  meta_campaign_id: string
  name: string
  objective: CampaignObjective
  status: CampaignStatus
  budget_monthly: number | null
  budget_lifetime: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export type FatigueStatus = 'CRÍTICO' | 'ESTÁVEL'

/**
 * v1.9.1 (correção — 2026-07-15, com source real de metaAdsRepository.ts):
 * `Campaign` NÃO é um alias de `CampaignRow`. É a entidade de UI já
 * processada por `rowToCampaign()` — nomes em camelCase, fatiguePercent
 * derivado, fatigueStatus calculado, diagnosis/actionRequired textuais.
 * useMetaAds.ts e metaAdsRepository.ts importam este tipo de `types/orbit`.
 */
export interface Campaign {
  id: string
  name: string
  objective: CampaignObjective
  roas: number | null
  ctr: number | null
  frequency: number | null
  fatiguePercent: number
  fatigueStatus: FatigueStatus
  status: CampaignStatus
  cpl: number | null
  diagnosis: string
  actionRequired: string
}

// v1.9.0: 'verde'/'ambar'/'vermelho' — é o que SemaphoreIndicator.tsx,
// instagramRepository.ts e instagramOverviewRepository.ts usam de fato.
export type SemaphoreColor = 'verde' | 'ambar' | 'vermelho'

// v1.9.0: 'cyan'/'gold' — é o que GlassCard, StatusPill, GlowingNumber e
// os repositórios usam de fato. 'green'/'yellow' nunca era consumido.
export type StatusVariant = 'ok' | 'warn' | 'neutral'
export type GlowColor = 'cyan' | 'gold' | 'red' | 'none'
export type TrendColor = 'up' | 'down' | 'flat'

// ============================================================================
// SEÇÃO 0.1: TIPOS INFERIDOS
// ============================================================================

export interface AlertAction {
  type: 'link' | 'dismiss' | 'resolve'
  label: string
  url?: string
}

export interface Alert {
  id: string
  clientId: string
  clientName: string
  clientHandle: string
  type: string
  severity: AlertSeverity
  title: string
  description: string | null
  metricName: string | null
  metricValue: number | null
  thresholdValue: number | null
  isResolved: boolean
  createdAt: string          // ⚠️ STRING, não Date — ver patch de alertsRepository.ts
  action: AlertAction | null
}

/** Fetch status usado por TODOS os hooks (useFunnel, useInstagramOverview, etc). */
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * v1.9.0: reformulado para bater com o retorno real de todos os hooks.
 * Antes: { data, loading: boolean, error: Error | null }
 * Agora: { data, status: FetchStatus, error: string | null }
 * Isso resolve ~15 erros em cascata (page.tsx, Header.tsx, FunnelScreen*,
 * useFunnel.ts, useInstagramOverview.ts) sem tocar em nenhum desses arquivos.
 */
export interface AsyncState<T> {
  data: T | null
  status: FetchStatus
  error: string | null
}

/**
 * Estatísticas brutas de conta IG (formato antigo, "flat").
 * Renomeado de IGOverviewData — nenhum arquivo com erro usa este shape;
 * mantido por segurança caso algo mais no projeto (sem erro hoje) dependa dele.
 */
export interface IGAccountOverviewData {
  followers: number
  engagement_rate: number
  posts_count: number
  stories_count: number
  avg_likes: number
  avg_comments: number
  last_updated: string
}

// v1.9.0: formato real usado por instagramOverviewRepository.ts e
// instagramRepository.ts ao montar a resposta de fetchInstagramOverview().
export interface DashboardHeaderMeta {
  clientHandle: string
  periodLabel: string
  dateRange: {
    start: Date
    end: Date
  }
}

// v1.9.0: revertido ao formato "plano" — é o único usado (KPICard.tsx,
// instagramRepository.ts, instagramOverviewRepository.ts).
export interface KPICardData {
  id: string
  label: string
  value: number
  unit: string | null
  delta: number
  deltaLabel: string
  semaphore: SemaphoreColor
  glowColor: GlowColor
  subtitle: string | null
}

// v1.9.0: value aceita number OU 'N/A' (QualityScoresPanel.tsx trata os dois).
export interface QualityScoreItem {
  id: string
  label: string
  value: number | string
  unit: string
  statusText: string
  statusVariant: StatusVariant
  glowColor: GlowColor
}

// v1.9.0: revertido ao formato "plano" — format/posts/shares.
export interface FormatPerformanceRow {
  id: string
  format: string
  posts: number
  shares: number
  trendLabel: string
  trendColor: TrendColor
}

// v1.9.0: revertido — só `text` é consumido (InsightCard.tsx).
export interface InsightData {
  id: string
  text: string
}

// v1.9.0: `body` é o campo real consumido (CriticalAlert.tsx). description/
// actionUrl viram opcionais para não quebrar quem já monta sem eles.
export interface CriticalAlertData {
  id: string
  title: string
  body: string
  severity: AlertSeverity
  description?: string | null
  actionUrl?: string | null
}

/**
 * Agregado real da tela de overview (era chamado IGOverviewData).
 * Formato consumido por instagramOverviewRepository.ts e instagramRepository.ts.
 */
export interface IGOverviewData {
  meta: DashboardHeaderMeta
  kpis: KPICardData[]
  qualityScores: QualityScoreItem[]
  formatPerformance: FormatPerformanceRow[]
  insights: InsightData[]
  criticalAlerts: CriticalAlertData[]
}

/**
 * Formato "flat" real do funil, usado por FunnelChart, FunnelScreen,
 * FunnelScreenWrapper e funnelRepository.ts/.calc.ts.
 * Substituiu o antigo FunnelMetrics baseado em reach/profileVisits/linkClicks
 * (preservado abaixo como FunnelActualMetrics).
 */
export interface FunnelMetrics {
  alcance: number
  visitas: number
  cliques: number
  vendas: number
  ctrBio: number
  taxaConv: number
}

/**
 * Formato anterior de FunnelMetrics (baseado nos nomes de coluna do banco).
 * Nenhum arquivo com erro depende dele — mantido por segurança/rastreabilidade.
 */
export interface FunnelActualMetrics {
  reach: number
  profileVisits: number
  linkClicks: number
  ctrBio: number
  conversionRate: number
}

export interface SliderConfig {
  key: keyof SimulatedFunnelParams
  label: string
  min: number
  max: number
  step: number
  unit: '%' | 'absolute'
}

export interface SimulatedFunnelResult {
  reachSimulated: number
  profileVisitsSimulated: number
  linkClicksSimulated: number
  conversionsSimulated: number
}

/** Alias de compat — barrel funnel.ts exporta este nome. */
export type FunnelScreenData = FunnelMetrics

/**
 * v1.9.0: data agora é FunnelMetrics (não FunnelScreenData aninhado) —
 * bate com o que useFunnel.ts calcula e com o que os componentes leem
 * direto de `data.ctrBio`, `data.alcance` etc.
 */
export interface UseFunnelResult extends AsyncState<FunnelMetrics> {
  params: SimulatedFunnelParams
  setParams: (params: SimulatedFunnelParams) => void
  refetch: () => void
}

export interface FunnelMetricsRow {
  reach_total: number | null
  profile_visits: number | null
  link_clicks: number | null
  period_start: string
  period_end: string
}

// ============================================================================
// SEÇÃO 1: TIPOS EXISTENTES
// ============================================================================

// v1.9.0: adicionadas 'por-post' e 'audiencia' (nomes reais das abas em
// Header.tsx / instagram/page.tsx). Mantidas as antigas por segurança.
export type TabId =
  | 'overview'
  | 'metrics'
  | 'health'
  | 'alerts'
  | 'settings'
  | 'por-post'
  | 'audiencia'

export interface IGOverviewLegacyData {
  followers: number
  engagement_rate: number
  posts_count: number
  stories_count: number
  avg_likes: number
  avg_comments: number
  last_updated: string
}

/**
 * Status de saúde do cliente.
 * SSOT: orbit.v_client_health (view calculada). Nunca ler clients.health_status
 * (coluna estática, deprecated — R-03).
 * Validado ao vivo em 2026-07-15: metric_count=0 → NULL propagation OK.
 */
export type ClientHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

export interface ClientMetrics {
  engagement_real: number
  ctr_link: number
  follower_balance: number
  polemic_score_pct: number
  follower_churn_pct: number
  segment: {
    gender_dominant: 'male' | 'female' | 'mixed'
    gender_pct: number
    age_range: string
    top_city: string
    top_city_pct: number
  }
}

export interface Client {
  id: string
  handle: string
  name: string
  avatar?: string
  status: ClientHealthStatus
  metrics: ClientMetrics
  lastUpdated: string
}

// ============================================================================
// SEÇÃO 2: RAW ROW CONTRACTS — REPOSITÓRIOS
// ============================================================================

// ── 2.1: clientsRepository.ts ──────────────────────────────────────────────

export interface OrbitClientHealthRow {
  client_id: string | null
  handle: string | null
  avatar_name: string | null
  metric_count: number | null
  avg_quality_score: number | null
  health_status: string | null
  last_updated: string | null
  days_since_update: number | null
  max_confidence_level: string | null
}

export function validateOrbitClientHealthRow(
  row: unknown
): row is OrbitClientHealthRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    (r.client_id === null || typeof r.client_id === 'string') &&
    (r.handle === null || typeof r.handle === 'string') &&
    (r.avatar_name === null || typeof r.avatar_name === 'string') &&
    (r.metric_count === null || typeof r.metric_count === 'number') &&
    (r.avg_quality_score === null || typeof r.avg_quality_score === 'number') &&
    (r.health_status === null || typeof r.health_status === 'string') &&
    (r.last_updated === null || typeof r.last_updated === 'string') &&
    (r.days_since_update === null || typeof r.days_since_update === 'number') &&
    (r.max_confidence_level === null || typeof r.max_confidence_level === 'string')
  )
}

export function hasVolumeData(row: OrbitClientHealthRow): boolean {
  return row.metric_count !== null && row.metric_count > 0
}

export function isReallyCritical(row: OrbitClientHealthRow): boolean {
  return (
    row.health_status === 'critical' &&
    row.metric_count !== null &&
    row.metric_count > 0
  )
}

// ── 2.2: alertsRepository.ts ───────────────────────────────────────────────

function isClientsJoinShape(
  value: unknown
): value is { name: string; handle: string } {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.name === 'string' && typeof v.handle === 'string'
}

export interface OrbitAlertRow {
  id: string
  client_id: string
  alert_type: string
  severity: AlertSeverity
  title: string
  description: string | null
  metric_name: string | null
  metric_value: number | null
  threshold_value: number | null
  action_url: string | null
  is_resolved: boolean
  created_at: string
  clients: {
    name: string
    handle: string
  } | null
}

export function validateOrbitAlertRow(row: unknown): row is OrbitAlertRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.client_id === 'string' &&
    typeof r.alert_type === 'string' &&
    typeof r.severity === 'string' &&
    typeof r.title === 'string' &&
    (r.description === null || typeof r.description === 'string') &&
    (r.metric_name === null || typeof r.metric_name === 'string') &&
    (r.metric_value === null || typeof r.metric_value === 'number') &&
    (r.threshold_value === null || typeof r.threshold_value === 'number') &&
    (r.action_url === null || typeof r.action_url === 'string') &&
    typeof r.is_resolved === 'boolean' &&
    typeof r.created_at === 'string' &&
    (r.clients === null || isClientsJoinShape(r.clients))
  )
}

export interface LegacyAlertRow {
  id: string
  client_id: string
  title: string
  description: string
  severity: AlertSeverity
  created_at: string
  clients: {
    name: string
    handle: string
  } | null
}

export function validateLegacyAlertRow(row: unknown): row is LegacyAlertRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.client_id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.description === 'string' &&
    typeof r.severity === 'string' &&
    typeof r.created_at === 'string' &&
    (r.clients === null || isClientsJoinShape(r.clients))
  )
}

// ── 2.3: avatarRepository.ts ───────────────────────────────────────────────

export interface AvatarAlignmentRow {
  client_id: string
  handle: string
  name: string
  expected_gender_male: number
  expected_gender_female: number
  expected_age_range: string
  expected_interest: string | null
  expected_geo: string
  expected_geo_pct: number
  real_gender_male: number
  real_gender_female: number
  real_age_range: string
  real_interest: string | null
  real_geo: string
  real_geo_pct: number
  alignment_score: number
  alignment_status: string
}

export function validateAvatarAlignmentRow(
  row: unknown
): row is AvatarAlignmentRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.client_id === 'string' &&
    typeof r.handle === 'string' &&
    typeof r.name === 'string' &&
    typeof r.expected_gender_male === 'number' &&
    typeof r.expected_gender_female === 'number' &&
    typeof r.expected_age_range === 'string' &&
    (r.expected_interest === null || typeof r.expected_interest === 'string') &&
    typeof r.expected_geo === 'string' &&
    typeof r.expected_geo_pct === 'number' &&
    typeof r.real_gender_male === 'number' &&
    typeof r.real_gender_female === 'number' &&
    typeof r.real_age_range === 'string' &&
    (r.real_interest === null || typeof r.real_interest === 'string') &&
    typeof r.real_geo === 'string' &&
    typeof r.real_geo_pct === 'number' &&
    typeof r.alignment_score === 'number' &&
    typeof r.alignment_status === 'string'
  )
}

export interface AvatarValidationRow {
  client_id: string
  validation_date: string
  observed_interest: string | null
  observed_geo_primary: string | null
  observed_geo_pct: number | null
  source: 'client_feedback' | 'manual' | 'inferred' | null
  confidence_level: 'L0' | 'L1' | 'L2' | null
  notes: string | null
}

export function validateAvatarValidationRow(
  row: unknown
): row is AvatarValidationRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  const validSources = ['client_feedback', 'manual', 'inferred', null]
  const validConfidenceLevels = ['L0', 'L1', 'L2', null]
  return (
    typeof r.client_id === 'string' &&
    typeof r.validation_date === 'string' &&
    (r.observed_interest === null || typeof r.observed_interest === 'string') &&
    (r.observed_geo_primary === null || typeof r.observed_geo_primary === 'string') &&
    (r.observed_geo_pct === null || typeof r.observed_geo_pct === 'number') &&
    (validSources as unknown[]).includes(r.source) &&
    (validConfidenceLevels as unknown[]).includes(r.confidence_level) &&
    (r.notes === null || typeof r.notes === 'string')
  )
}

// ── 2.3b: clientsRepository.ts — enriquecimento de client card (R-07) ─────

export interface IgAccountSnapshotEnrichmentRow {
  client_id: string
  period_start: string
  period_end: string
  link_ctr_pct: number | null
  followers_net: number | null
}

export function validateIgAccountSnapshotEnrichmentRow(
  row: unknown
): row is IgAccountSnapshotEnrichmentRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.client_id === 'string' &&
    typeof r.period_start === 'string' &&
    typeof r.period_end === 'string' &&
    (r.link_ctr_pct === null || typeof r.link_ctr_pct === 'number') &&
    (r.followers_net === null || typeof r.followers_net === 'number')
  )
}

export interface TopCityEntry {
  name: string
  pct: number
}

export interface IgAudienceSnapshotRow {
  client_id: string
  period_start: string
  period_end: string
  gender_male_pct: number | null
  gender_female_pct: number | null
  gender_other_pct: number | null
  age_13_17_pct: number | null
  age_18_24_pct: number | null
  age_25_34_pct: number | null
  age_35_44_pct: number | null
  age_45_54_pct: number | null
  age_55_plus_pct: number | null
  top_cities: TopCityEntry[] | null
}

export function validateIgAudienceSnapshotRow(
  row: unknown
): row is IgAudienceSnapshotRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.client_id === 'string' &&
    typeof r.period_start === 'string' &&
    typeof r.period_end === 'string' &&
    (r.gender_male_pct === null || typeof r.gender_male_pct === 'number') &&
    (r.gender_female_pct === null || typeof r.gender_female_pct === 'number') &&
    (r.gender_other_pct === null || typeof r.gender_other_pct === 'number') &&
    (r.top_cities === null || Array.isArray(r.top_cities))
  )
}

// ── 2.4: funnelRepository.ts / .calc.ts ────────────────────────────────────

export interface SimulatedFunnelParams {
  alcance: number
  ctrBio: number
  taxaConv: number
}

export interface SnapshotSelect {
  reach_total: number | null
  profile_visits: number | null
  link_clicks: number | null
}

export function validateSnapshotSelect(row: unknown): row is SnapshotSelect {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    (r.reach_total === null || typeof r.reach_total === 'number') &&
    (r.profile_visits === null || typeof r.profile_visits === 'number') &&
    (r.link_clicks === null || typeof r.link_clicks === 'number')
  )
}

// ── 2.5: instagramOverviewRepository.ts ────────────────────────────────────

export type RawRow = Record<string, unknown>

export interface FetchOverviewParams {
  clientId: string
  periodStart: string
  periodEnd: string
}

// ── 2.6: instagramRepository.ts (legado — ver nota no final do arquivo) ───

export interface RawKPIRow {
  id: string
  metric: string
  value: number
  semaphore: SemaphoreColor
  delta_pct: number
  period_start: string
  period_end: string
}

export function validateRawKPIRow(row: unknown): row is RawKPIRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.metric === 'string' &&
    typeof r.value === 'number' &&
    typeof r.semaphore === 'string' &&
    typeof r.delta_pct === 'number' &&
    typeof r.period_start === 'string' &&
    typeof r.period_end === 'string'
  )
}

export interface RawQualityRow {
  id: string
  score_key: string
  score_value: number
  status_text: string
  status_variant: StatusVariant
}

export function validateRawQualityRow(row: unknown): row is RawQualityRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.score_key === 'string' &&
    typeof r.score_value === 'number' &&
    typeof r.status_text === 'string' &&
    typeof r.status_variant === 'string'
  )
}

export interface RawFormatRow {
  id: string
  format_name: string
  post_count: number
  share_count: number
  trend_label: string
  trend_color: TrendColor
}

export function validateRawFormatRow(row: unknown): row is RawFormatRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.format_name === 'string' &&
    typeof r.post_count === 'number' &&
    typeof r.share_count === 'number' &&
    typeof r.trend_label === 'string' &&
    typeof r.trend_color === 'string'
  )
}

export interface RawAudienceRow {
  id: string
  client_id: string
  age_range: string
  gender_split: number
  top_city: string
  recorded_at: string
}

export function validateRawAudienceRow(row: unknown): row is RawAudienceRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.client_id === 'string' &&
    typeof r.age_range === 'string' &&
    typeof r.gender_split === 'number' &&
    typeof r.top_city === 'string' &&
    typeof r.recorded_at === 'string'
  )
}

export interface DateBounds {
  earliest: Date
  latest: Date
}

// ── 2.7: metaAdsRepository.ts ──────────────────────────────────────────────

// v1.9.0: adicionados os campos que metaAdsRepository.ts lê de fato.
// ⚠️ Não validado contra Supabase ainda — se orbit.meta_campaigns não tiver
// estas colunas, o SELECT vai quebrar em runtime mesmo com o build passando.
// Rodar: select column_name from information_schema.columns where
// table_schema='orbit' and table_name='meta_campaigns' antes de confiar 100%.
export interface MetaCampaignRow extends CampaignRow {
  client_id: string
  roas: number | null
  ctr: number | null
  cpc: number
  frequency: number | null
  fatigue: number
  fatigue_percent: number | null
  cpl: number | null
}

export function validateMetaCampaignRow(row: unknown): row is MetaCampaignRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.client_id === 'string' &&
    typeof r.cpc === 'number' &&
    typeof r.fatigue === 'number'
  )
}

// ============================================================================
// SEÇÃO 3: TIPOS DE AVATAR (inalterado)
// ============================================================================

export type AlignmentStatus = 'healthy' | 'warning' | 'critical'
export type AlignmentColor = 'success' | 'warning' | 'danger'
export type FetchStatusLegacy = 'idle' | 'loading' | 'success' | 'error'

export interface GenderSplit {
  male: number
  female: number
}

export interface AvatarProfile {
  gender: GenderSplit
  ageRange: string
  interest: string
  geo: string
}

// v1.9.0: adicionado `color` — AlignmentBar.tsx lê `bar.color`, não
// `bar.status`. Ambos ficam preenchidos com o mesmo valor mapeado via
// ALIGNMENT_STATUS_COLOR (ver avatarRepository.ts patch).
// ✅ 1. ADICIONADO: Interface rica para estruturar os cards de recomendação do HTML
export interface AvatarRecommendation {
  id: string
  title: string
  description: string
  icon?: string // '🎯' | '📅' | '📍' | '🔄' conforme o layout exibe
  type?: AlignmentStatus
}

// ✅ 2. ATUALIZADO: Incluindo a governança de onboarding diretamente no perfil do camelo
export interface AvatarProfile {
  gender: { male: number; female: number }
  ageRange: string
  interest: string
  geo: string
  // Rastreabilidade injetada no perfil do avatar real conforme as regras de negócio
  interestSource?: 'instagram_insights' | 'client_feedback' | 'manual' | null
  interestConfidence?: 'L0' | 'L1' | 'L2' | null
}

export interface AlignmentBar {
  label: string
  expected: number
  real: number
  variance: number
  status: AlignmentStatus
  color: AlignmentColor
}

// ✅ 3. ATUALIZADO: Expandindo para suportar a lista plural do HTML e as propriedades de onboarding
export interface AvatarAlignment {
  id: string
  clientId: string
  expected: AvatarProfile
  real: AvatarProfile
  score: number
  status: AlignmentStatus
  bars: AlignmentBar[]
  
  // 🎯 AJUSTE DE CONTRATO: Suporta o formato unificado do HTML sem usar any
  recommendations: AvatarRecommendation[] 
  recommendation: AvatarRecommendation | null
  
  // Mantidos no nível da raiz caso alguma função de auditoria legada faça a leitura direta
  realInterestSource?: 'instagram_insights' | 'client_feedback' | 'manual' | null
  realInterestConfidence?: 'L0' | 'L1' | 'L2' | null
  // 🎯 CONTRATO EXPANDIDO: Injeção da Inteligência Panksepp e Diagnósticos da UI
  unconsciousDesireMapped: string
  misalignmentHypothesis: string
}

export interface AlignmentCalculation {
  genderVariance: number
  ageVariance: number
  interestVariance: number
  geoVariance: number
  compositeScore: number
}

export interface AvatarProfileResult {
  expected: AvatarProfile
  real: AvatarProfile
}

export interface RepositoryError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// ─── Constantes de Governança mantidas intactas ──────────────────────────────

export const ALIGNMENT_STATUS_LABEL: Record<AlignmentStatus, string> = {
  healthy: 'Bem Alinhado',
  warning: 'Atenção',
  critical: 'Crítico',
} as const

export const ALIGNMENT_STATUS_COLOR: Record<AlignmentStatus, AlignmentColor> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'danger',
} as const

export const ALIGNMENT_THRESHOLDS = {
  healthy: 85,
  warning: 70,
  critical: 0,
} as const

export const VARIANCE_THRESHOLDS = {
  healthy: 15,
  warning: 30,
  critical: 100,
} as const


// ============================================================================
// SEÇÃO 4: TIPOS DE HOOK
// ============================================================================

export interface UseClientsResult extends AsyncState<Client[]> {
  refetch: () => void
}

export interface UseInstagramOverviewResult extends AsyncState<IGOverviewData> {
  lastUpdated: Date | null
  refetch: () => void
}

export interface UseClientHealthResult extends AsyncState<Client> {
  healthStatus: ClientHealthStatus
  lastChecked: Date | null
  refetch: () => void
}

export interface UseAvatarAlignmentResult extends AsyncState<AvatarAlignment> {
  alignmentStatus: AlignmentStatus
  lastChecked: Date | null
  refetch: () => void
}

// ============================================================================
// SEÇÃO 5: TIPOS DE CONTEXTO
// ============================================================================

export interface UseOrbitDashboardResult extends UseInstagramOverviewResult {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  clientId?: string
  currentClient?: Client | null
  alertCount?: number
}

export interface OrbitDashboardContextType extends UseOrbitDashboardResult {
  selectClient: (clientId: string) => Promise<void>
  clearSelection: () => void
  refreshAllData: () => Promise<void>
  refreshClientData: (clientId: string) => Promise<void>
  isRefreshing: boolean
}

export interface OrbitDashboardProviderProps {
  children: ReactNode
  initialTab?: TabId
  autoRefreshInterval?: number
}

// ============================================================================
// SEÇÃO 6: TIPOS UTILITÁRIOS
// ============================================================================

export interface ClientFilters {
  status?: ClientHealthStatus | ClientHealthStatus[]
  searchTerm?: string
  sortBy?: 'name' | 'engagement' | 'lastUpdated'
  sortOrder?: 'asc' | 'desc'
}

export interface AvatarFilters {
  alignmentStatus?: AlignmentStatus | AlignmentStatus[]
  scoreMin?: number
  scoreMax?: number
  searchTerm?: string
  sortBy?: 'name' | 'score' | 'lastUpdated'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ClientUpdateEvent {
  clientId: string
  timestamp: Date
  changes: Partial<Client>
}

export interface AvatarUpdateEvent {
  clientId: string
  timestamp: Date
  changes: Partial<AvatarAlignment>
}

export interface AlertConfig {
  enabled: boolean
  thresholds: {
    engagementMin?: number
    engagementMax?: number
    reachMin?: number
  }
  notifyOn?: ('critical' | 'warning' | 'info')[]
}

export interface AvatarAlignmentConfig {
  enabled: boolean
  thresholds: {
    scoreMin?: number
  }
  notifyOn?: ('critical' | 'warning' | 'info')[]
}

// ============================================================================
// SEÇÃO 7: TIPOS DE ERRO
// ============================================================================

export class OrbitError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'OrbitError'
    Object.setPrototypeOf(this, OrbitError.prototype)
  }
}

export class OrbitValidationError extends OrbitError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'OrbitValidationError'
    Object.setPrototypeOf(this, OrbitValidationError.prototype)
  }
}

export class OrbitNotFoundError extends OrbitError {
  constructor(resourceType: string, resourceId: string) {
    super(
      `${resourceType} não encontrado: ${resourceId}`,
      'NOT_FOUND',
      404,
      { resourceType, resourceId }
    )
    this.name = 'OrbitNotFoundError'
    Object.setPrototypeOf(this, OrbitNotFoundError.prototype)
  }
}

// ============================================================================
// SEÇÃO 8: TIPOS DE MAPEAMENTO
// ============================================================================

export interface ClientMapper {
  toDomain(row: OrbitClientHealthRow): Client
  toDomainBatch(rows: OrbitClientHealthRow[]): Client[]
  toRepository(client: Client): OrbitClientHealthRow
}

export interface AvatarAlignmentMapper {
  toDomain(row: AvatarAlignmentRow): AvatarAlignment
  toDomainBatch(rows: AvatarAlignmentRow[]): AvatarAlignment[]
  toRepository(alignment: AvatarAlignment): AvatarAlignmentRow
}

export interface DataTransformStrategy<TInput, TOutput> {
  transform(input: TInput): TOutput
  validate(input: TInput): boolean
  reverse?(output: TOutput): TInput
}

// ============================================================================
// SEÇÃO 9: TIPOS DE MÉTRICAS DE ADS (MetaAdsKPI)
// ============================================================================

/**
 * v1.9.1 (correção — 2026-07-15, com source real de metaAdsRepository.ts):
 * O shape "agregado de campanha" (campaignId/spend/impressions/...) que
 * estava aqui antes NUNCA foi consumido por nenhum arquivo real — era
 * especulativo. O shape real é o de card de KPI simples, construído em
 * fetchCampaignMetrics()/buildEmptyKPIs().
 *
 * ⚠️ status usa vocabulário próprio ('green'/'amber'/'red'/'gray') — é o
 * TERCEIRO vocabulário de cor no projeto, distinto de SemaphoreColor
 * ('verde'/'ambar'/'vermelho') e de GlowColor ('cyan'/'gold'/'red'/'none').
 * Não normalizei para SemaphoreColor porque não tenho o componente que
 * consome isso (o card de KPI da tela Meta Ads) — mudar o vocabulário aqui
 * sem ver quem lê `status` do lado do componente pode quebrar em runtime
 * mesmo com o build passando. Fica registrado como próxima limpeza.
 */
export type MetaAdsKPIStatus = 'green' | 'amber' | 'red' | 'gray'

export interface MetaAdsKPI {
  id: string
  status: MetaAdsKPIStatus
  label: string
  value: number
  unit: string
  delta: number
  deltaLabel: string
}

// src/types/orbit.ts (adicionar ao final)

// ============================================================================
// SEÇÃO 10: ONBOARDING — Tipos e Interfaces
// ============================================================================

export type PankseppSystem =
  | 'SEEKING'
  | 'RAGE'
  | 'FEAR'
  | 'LUST'
  | 'CARE'
  | 'PANIC'
  | 'PLAY'
  | 'mixed'

export interface SchwatzValue {
  value: string
  priority: 'high' | 'medium' | 'low'
}

export interface ClientOnboarding {
  client_id: string
  
  // Seguidores
  total_followers: number
  total_followers_source: 'manual_print_confirmado' | 'instagram_api' | 'estimate'
  total_followers_updated_at: string
  
  // Bio
  has_bio_link: boolean
  bio_link_url: string | null
  
  // Perguntas qualitativas
  q1_engagement_period_notes: string | null
  q2_content_proxy_notes: string | null
  q3_misalignment_notes: string | null
  
  // Split de audiência (%)
  audience_nucleo_fiel_pct: number
  audience_consumo_passivo_pct: number
  audience_curiosidade_externa_pct: number
  audience_alta_rotatividade_pct: number
  
  // Evidência bruta (contexto, não fórmula)
  observed_content_clusters: Record<string, string[]> | null
  
  // Eixos com peso real
  expected_panksepp_system: PankseppSystem
  real_panksepp_system: PankseppSystem
  expected_schwartz: Record<string, SchwatzValue> | null
  real_schwartz: Record<string, SchwatzValue> | null
  
  // Metadata
  updated_by: string
  updated_at: string
}

export interface OnboardingFormData {
  // Step 1: Seguidores
  total_followers: number
  total_followers_source: ClientOnboarding['total_followers_source']
  
  // Step 2: Bio
  has_bio_link: boolean
  bio_link_url: string
  
  // Step 3: Perguntas
  q1_engagement_period_notes: string
  q2_content_proxy_notes: string
  q3_misalignment_notes: string
  
  // Step 4: Split de Audiência
  audience_nucleo_fiel_pct: number
  audience_consumo_passivo_pct: number
  audience_curiosidade_externa_pct: number
  audience_alta_rotatividade_pct: number
  
  // Step 5: Panksepp
  expected_panksepp_system: PankseppSystem
  real_panksepp_system: PankseppSystem
  
  // Step 6: Schwartz
  expected_schwartz: Record<string, SchwatzValue>
  real_schwartz: Record<string, SchwatzValue>
}

export interface OnboardingStep {
  id: number
  title: string
  description: string
  icon: string
}


// ============================================================================
// FIM DO ARQUIVO
// ============================================================================


export interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
}

export interface UseAlertsResult {
  alerts: CriticalAlertData[];
  counts: AlertCounts;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void> | void;
}
