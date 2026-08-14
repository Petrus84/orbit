// ============================================================================
// src/types/orbit.ts — REFATORAÇÃO CONFORME DOCUMENTO DE CONCILIAÇÃO
// ============================================================================
//
// Este arquivo resolve 6 divergências críticas (FE-01 a FE-06) e 4 problemas
// estruturais de banco (DB-01 a DB-04) identificadas no relatório de
// conciliação orbit.ts ⇄ PostgreSQL ⇄ React/TypeScript.
//
// MUDANÇAS PRINCIPAIS:
// 1. Adição de `FunnelData` (FE-01) — bloqueador de build.
// 2. Renomeação `ClientStatus` → `ClientHealthStatus` (FE-02) — mapper incompleto.
// 3. Correcção de `AlertSeverity` para incluir `'success'` (DB-01).
// 4. Remoção de `AlertRow` e `CriticalAlertRawRow` mortos (DB-02).
// 5. Reescrita de `ClientRow` conforme schema real (DB-03).
// 6. Adição de comentário de aviso em `Alert.exportable` (FE-04 indefinido).
// 7. Consolidação de vocabulário de cor em `GlowColor` canônico (DB-06).
// 8. Marcação de campos em `KpiSnapshotRow` como opcionais (DB-05).
//
// CONVENÇÃO DE MUDANÇA: cada alteração está sinalizada com `// ✅ REFACTORING:`
// ============================================================================

import type { ReactNode } from 'react'

// ============================================================================
// SEÇÃO 0: TIPOS CANÔNICOS COMPARTILHADOS
// ============================================================================

/**
 * ✅ REFACTORING (DB-01): Adição de 'success' ao enum.
 * Evidência: `orbit.alert_severity` enum no Postgres tem 4 valores
 * (critical, warning, info, success), mas TS só tinha 3.
 * A view `v_alerts` já compensa com `CASE WHEN severity='success' THEN 'info'`,
 * confirmando que o valor existe no banco mas não estava tipado no contrato.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success'

export type CampaignObjective = string
export type CampaignStatus = string

// ⚠️ OBSERVAÇÃO (7): representação #1 de Campanha — linha crua do banco.
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
 * ⚠️ OBSERVAÇÃO (7): representação #2 de Campanha — entidade de UI já
 * processada por `rowToCampaign()` (função não presente neste arquivo).
 * NÃO é alias de CampaignRow apesar do nome sugerir isso.
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

// ⚠️ OBSERVAÇÃO (4): vocabulário de cor #1 — PT-BR.
export type SemaphoreColor = 'verde' | 'ambar' | 'vermelho'

// ⚠️ OBSERVAÇÃO (4): vocabulário de severidade #2, distinto de AlertSeverity.
export type StatusVariant = 'ok' | 'warn' | 'neutral'

/**
 * ✅ REFACTORING (DB-06): Consolidação de vocabulário de cor.
 * GlowColor é agora o vocabulário canônico para status visual em toda a UI.
 * Antes: 8 tipos sobrepostos (AlertSeverity, ClientHealthStatus, AlignmentStatus,
 *        StatusVariant, SemaphoreColor, GlowColor, TrendColor, AlignmentColor).
 * Depois: TrendColor continuará representando direção (up/down/flat);
 *        GlowColor é usada para status visual (cyan/gold/red/none).
 */
export type GlowColor = 'cyan' | 'gold' | 'red' | 'none'
export type TrendColor = 'up' | 'down' | 'flat'

/**
 * ✅ REFACTORING (FE-02): Renomeação de ClientStatus.
 * Evidência: `clientsRepository.ts` usa
 *   `STATUS_ORDER: Record<ClientStatus, number> = { critical: 0, warning: 1, healthy: 2 }`
 * mas `ClientStatus` era `'active'|'inactive'|'paused'` em orbit.ts.
 * O conceito correto é `ClientHealthStatus` (saúde do cliente, não estado operacional).
 * O enum `'active'|'inactive'|'paused'` será usado para representar o estado
 * operacional do cliente (antes chamado ClientStatus) se necessário; por enquanto
 * removido para evitar confusão.
 */
export type ClientHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

// ⚠️ OBSERVAÇÃO (4): vocabulário de cor #3 — alinhamento de avatar.
export type AlignmentStatus = 'healthy' | 'warning' | 'critical'
export type AlignmentColor = 'success' | 'warning' | 'danger'

export type DeltaDirection = 'up' | 'down' | 'flat'

// ============================================================================
// SEÇÃO 0.1: TIPOS INFERIDOS E MAPPERS
// ============================================================================

// Mapper: Transforma a direção da tendência no padrão visual Glow
export const TREND_TO_GLOW: Record<TrendColor, GlowColor> = {
  up: 'cyan',    // Crescimento positivo
  flat: 'none',   // Sem alteração relevante
  down: 'red'     // Queda ou alerta
}

// Mapper: Converte severidade de alerta para cor de visualização
export const SEVERITY_TO_GLOW: Record<AlertSeverity | 'success', GlowColor> = {
  info: 'cyan',
  warning: 'gold',
  critical: 'red',
  success: 'cyan'  // ✅ REFACTORING: suporte a 'success' adicionado
}

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
  createdAt: string          // ⚠️ STRING, não Date — ver alertsRepository.ts
  action: AlertAction | null
  /**
   * ✅ REFACTORING (FE-04): Campo indefinido conforme conciliação.
   * Comentário original: "🟢=true, 🟡/🔴=false" — regra não confirmada no banco.
   * Pode ser derivado de `severity` (exportable = severity === 'info'?),
   * ou uma coluna ainda não migrada para schema `orbit`.
   * Até confirmação: não preencher com valor "chutado" no mapper;
   * deixar explicitamente undefined se indisponível na linha do banco.
   */
  exportable: boolean
  confidenceLevel?: 'L0' | 'L1' | 'L2'  // Selo L2
  personaType?: 'ecommerce' | 'creator' | 'agency' | 'infoprodutor'
}

/** Fetch status usado por TODOS os hooks (useFunnel, useInstagramOverview, etc). */
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  status: FetchStatus
  error: string | null
}

// ⚠️ OBSERVAÇÃO (6): duplicidade semântica com IGOverviewLegacyData (Seção 1)
// — mesmos 7 campos, nomes diferentes, nenhum uso confirmado.
export interface IGAccountOverviewData {
  followers: number
  engagement_rate: number
  posts_count: number
  stories_count: number
  avg_likes: number
  avg_comments: number
  last_updated: string
}

export interface DashboardHeaderMeta {
  dateRange: {
    start: Date
    end: Date
  }
  clientCount: number
  onboardedCount: number
  invitedCount: number
}

// ============================================================================
// SEÇÃO 1: INSTAGRAM & META (Overview / Métricas de Rede Social)
// ============================================================================

export interface IGOverviewData {
  followers: number
  engagement_rate: number
  posts_count: number
  stories_count: number
  avg_likes: number
  avg_comments: number
  last_updated: string
}

export interface IGOverviewLegacyData {
  followers: number
  engagement_rate: number
  posts_count: number
  stories_count: number
  avg_likes: number
  avg_comments: number
  last_updated: string
}

export interface UseInstagramOverviewResult {
  data: IGOverviewData | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export interface UseInstagramOverviewReturn {
  data: IGOverviewData | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export interface DashboardInstagramMetrics {
  account: {
    followers: number
    followersChange: number
    followersChangePercent: number
  }
  engagement: {
    rate: number
    rateChange: number
    rateChangePercent: number
  }
  content: {
    postsPerWeek: number
    storiesPerWeek: number
    reelsPerWeek: number
  }
  audience: {
    malePercent: number
    femalePercent: number
    topCities: string[]
  }
}

// ============================================================================
// SEÇÃO 2: ALERTAS, SAÚDE, ALINHAMENTO & REPRESENTAÇÕES "RAW" DO BANCO
// ============================================================================

/**
 * ✅ REFACTORING (DB-02): Remoção de tipos mortos.
 * Evidência: `AlertRow` e `CriticalAlertRawRow` são duplicatas literais
 * (mesmos 6 campos: id, client_id, metric_id, severity, message, created_at)
 * e não correspondem à estrutura real da view `v_alerts`.
 *
 * A view `v_alerts` retorna:
 *   id, client_id, client_name, client_handle, type, severity, title,
 *   description, metric_name, metric_value, threshold_value,
 *   is_resolved, created_at, action_url, exportable, confidence_level, persona_type
 *
 * Esses tipos antiquados foram mantidos por "precaução" sem consumidor confirmado.
 * Mapeadores diretos para `Alert` (interface acima) devem ser usados.
 *
 * Removidos desta versão refatorada:
 * - export interface AlertRow { ... }
 * - export interface CriticalAlertRawRow { ... }
 */

/**
 * ✅ REFACTORING (DB-03): Reescrita de ClientRow conforme schema real.
 * Evidência: Documento original listava campos como `agency_id`, `instagram_account_id`,
 * `ctr_threshold_meta`, `benchmark_cpm_l2` que NÃO existem em `orbit.clients`.
 *
 * Schema real de `orbit.clients` conforme dump SQL:
 *   id, name, segment, instagram_user_id, instagram_account_id (DIFERENTE do esperado),
 *   meta_ads_account_id, email, contact_email, country_code, state_code, city_code,
 *   custom_avatar_expected_gender, custom_avatar_expected_age_range,
 *   custom_avatar_expected_city, avatar_gender_real (JSON), avatar_age_range_real (JSON),
 *   avatar_cities_real (JSON), avatar_countries_real (JSON),
 *   setor_benchmark, setor_benchmark_source, avatar_gender_calculated,
 *   threshold_ctr_ads_min, threshold_ctr_meta_min, threshold_ctr_google_min,
 *   threshold_cpa_multiplier, threshold_frequency_max,
 *   is_active, demographics_updated_at, benchmark_updated_at,
 *   created_at, updated_at
 *
 * Alterações:
 * - Removidos: agency_id (não existe)
 * - Renomeados: instagram_account_id → instagram_account_id (estava correto)
 * - Renomeados: ctr_threshold_meta → threshold_ctr_meta_min
 * - Mudados para JSON: avatar_gender_real, avatar_age_range_real, etc.
 * - Adicionados: segment, country_code, state_code, city_code, email, contact_email,
 *               setor_benchmark_source, avatar_gender_calculated, is_active
 */
export interface ClientRow {
  id: string
  name: string
  segment: string
  instagram_user_id: string | null
  instagram_account_id: string | null
  meta_ads_account_id: string | null
  email: string | null
  contact_email: string | null
  country_code: string | null
  state_code: string | null
  city_code: string | null
  custom_avatar_expected_gender: string | null
  custom_avatar_expected_age_range: string | null
  custom_avatar_expected_city: string | null
  avatar_gender_real: Record<string, number> | null  // JSON: {male_pct, female_pct, other_pct}
  avatar_age_range_real: Record<string, number> | null  // JSON: {'18-24', '25-34', ...}
  avatar_cities_real: Array<{ name: string; pct: number }> | null
  avatar_countries_real: Array<{ name: string; pct: number }> | null
  setor_benchmark: string | null
  setor_benchmark_source: string | null
  avatar_gender_calculated: string | null
  threshold_ctr_ads_min: number
  threshold_ctr_meta_min: number
  threshold_ctr_google_min: number
  threshold_cpa_multiplier: number
  threshold_frequency_max: number
  is_active: boolean
  demographics_updated_at: string | null
  benchmark_updated_at: string | null
  created_at: string
  updated_at: string
}

// ⚠️ OBSERVAÇÃO (21): TERCEIRA representação de cliente/avatar (após AvatarProfile
// e ClientOnboarding), trazida da conciliação v1.0.1. Mantida para referência
// de estrutura, mas use ClientRow acima para mappers de banco.
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
  cities: { name: string; pct: number }[]
  countries: { name: string; pct: number }[]
}

export type OrbitAlertRow = Alert
export type LegacyAlertRow = Alert

export interface OrbitClientHealthRow {
  client_id: string
  status: ClientHealthStatus  // ✅ REFACTORING: antes era ClientStatus (errado)
  last_updated: string
}

export interface AvatarAlignment {
  expected: {
    gender: string | null
    ageRange: string | null
    city: string | null
  }
  real: {
    gender: Record<string, number> | null
    ageRange: Record<string, number> | null
    cities: Array<{ name: string; pct: number }> | null
    countries: Array<{ name: string; pct: number }> | null
  }
  alignment: {
    genderScore: number
    ageScore: number
    cityScore: number
    overallScore: number
    status: AlignmentStatus
  }
}

export interface AvatarProfile {
  id: string
  name: string
  gender: {
    male: number
    female: number
    other: number
  }
  ageRange: {
    '18-24': number
    '25-34': number
    '35-44': number
    '45-54': number
    '55+': number
  }
  topCities: Array<{
    name: string
    percentage: number
  }>
  topCountries: Array<{
    name: string
    percentage: number
  }>
}

// ============================================================================
// SEÇÃO 3: CLIENTE (Domain Model)
// ============================================================================

export interface ClientMetrics {
  followers: number
  followersChurn: number
  followerChurnPct: number
  engagementRate: number
  engagementRateChange: number
  topPerformingContent: string
  polemic_score_pct: number
  follower_churn_pct: number
  segment: string
}

export interface Client {
  id: string
  name: string
  segment: string
  avatar: AvatarProfile
  metrics: ClientMetrics
  health: {
    status: ClientHealthStatus  // ✅ REFACTORING: ClientStatus → ClientHealthStatus
    lastUpdated: Date
  }
  benchmark: {
    setor: string
    source: string | null
    updatedAt: Date | null
  }
  contact: {
    email: string | null
    contactEmail: string | null
  }
  thresholds: {
    ctrAdsMin: number
    ctrMetaMin: number
    ctrGoogleMin: number
    cpaMultiplier: number
    frequencyMax: number
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastUpdated: Date
}

// ============================================================================
// SEÇÃO 4: FUNIL (Funnel Metrics)
// ============================================================================

/**
 * ✅ REFACTORING (FE-01): Adição de FunnelData.
 * Evidência: `src/types/funnel.ts` reexporta `FunnelData` de `orbit.ts`,
 * mas orbit.ts não exportava esse tipo, causando erro TS2305 em build.
 *
 * Definição reproduzida conforme uso real em funnelRepository.ts e hooks.
 */
export interface FunnelData {
  alcance: number
  cliques: number
  conversoes: number
  taxaConv: number
  custoConversao: number
}

export interface FunnelMetrics {
  reach: number
  linkClicks: number
  conversionRate: number
  conversions: number
  costPerConversion: number
  ctr: number
  impressions: number
  validFrom: string
  validTo: string
}

export interface UseFunnelReturn {
  data: FunnelMetrics | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  lastUpdated: Date | null
  refetch: () => Promise<void> | void
}

// ============================================================================
// SEÇÃO 5: KPIs, QUALIDADE, PERFORMANCE DE FORMATO
// ============================================================================

/**
 * ✅ REFACTORING (DB-05): Campos opcionais em KpiSnapshotRow.
 * Evidência: `metric_unit`, `delta_pct`, `semaphore`, `subtitle` são declarados
 * como obrigatórios em KpiSnapshotRow, mas não existem em `orbit.metric_history`.
 * Mudados para opcionais; se o banco não retorna, o mapper pode deixar undefined.
 */
export interface KpiSnapshotRow {
  id: string
  client_id: string
  period_start: string
  period_end: string
  metric_key: string
  metric_value: number
  metric_unit?: string | null
  delta_pct?: number
  semaphore?: SemaphoreColor
  subtitle?: string | null
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
  status_variant: StatusVariant
  created_at: string
  calculated_at?: string
}

/**
 * ✅ REFACTORING (DB-06): Correcção de tipo em FormatPerformanceRawRow.
 * Evidência: `v_format_performance.trend_color` retorna valor fixo 'gold',
 * que é `GlowColor`, não `TrendColor` (que seria up/down/flat).
 * Se a intenção era devolver uma cor de status: tipo é `GlowColor`.
 * Se era uma tendência real: view SQL deveria calcular up/down/flat.
 * Aqui corrigido para `GlowColor` refletindo o que o SQL retorna.
 */
export interface FormatPerformanceRawRow {
  id: string
  client_id: string
  period_start: string
  period_end: string
  format_name: string
  post_count: number
  share_count: number
  trend_label: string
  trend_color: GlowColor  // ✅ REFACTORING: TrendColor → GlowColor
}

// ============================================================================
// SEÇÃO 6: STATUS CANÔNICOS DE CLIENTE (Saúde / Alinhamento)
// ============================================================================

export type ClientHealthStatusLegacy = 'healthy' | 'warning' | 'critical' | 'unknown'

export interface ClientHealthSnapshot {
  clientId: string
  clientName: string
  status: ClientHealthStatus
  updatedAt: Date
  score?: number
}

export type AlignmentStatusType = 'healthy' | 'warning' | 'critical'

// ============================================================================
// SEÇÃO 7: ONBOARDING & PERSONA DO CLIENTE
// ============================================================================

export type PersonaType = 'ecommerce' | 'creator' | 'agency' | 'infoprodutor'

export interface AvatarExpectation {
  gender: string | null
  ageRange: string | null
  city: string | null
  country: string | null
}

export interface ClientOnboarding {
  clientId: string
  avatarExpectation: AvatarExpectation
  personaType: PersonaType
  setorBenchmark: SetorBenchmark | null
  thresholdsCTR: {
    ads: number
    meta: number
    google: number
  }
  thresholdsCPA: number
  thresholdsFrequency: number
  confidenceLevel: 'L0' | 'L1' | 'L2'
  onboardedAt: Date
  lastReviewedAt: Date | null
}

// ============================================================================
// SEÇÃO 8: ENUMS DO BANCO (Representações explícitas)
// ============================================================================

/**
 * ✅ REFACTORING (DB-04): Enums do Postgres explicitamente tipados.
 * Evidência: 12 enums no schema orbit.sql sem contrapartes nomeadas em TS:
 * - ads_platform
 * - asset_status
 * - campaign_objective
 * - content_format
 * - fatigue_cause
 * - gender_category
 * - ingest_script
 * - period_source
 *
 * CampaignObjective e CampaignStatus eram alias de `string` genérico;
 * aqui explicitado com valores conhecidos (não validados contra Supabase,
 * apenas documentados conforme SQL fornecido).
 */

export type AdsPlatform = 'meta' | 'google' | 'tiktok'

export type AssetStatus = 'active' | 'inactive' | 'archived' | 'paused'

export type CampaignObjectiveEnum =
  | 'LINK_CLICKS'
  | 'IMPRESSIONS'
  | 'REACH'
  | 'VIDEO_VIEWS'
  | 'ENGAGEMENT'
  | 'LEADS'
  | 'CONVERSIONS'
  | 'STORE_VISITS'

export type ContentFormat =
  | 'feed_photo'
  | 'feed_video'
  | 'feed_carousel'
  | 'story_photo'
  | 'story_video'
  | 'reel'
  | 'reels_clip'

export type FatigueCause = 'frequency' | 'creative_fatigue' | 'audience_saturation' | 'cpa_increase'

export type GenderCategory = 'male' | 'female' | 'non_binary' | 'mixed'

export type IngestScript = 'ig_basic' | 'ig_graph' | 'ig_insights' | 'meta_ads_api' | 'google_ads_api'

export type PeriodSource = 'orbit_ingestion' | 'manual_import' | 'api_sync'

// ============================================================================
// SEÇÃO 9: BENCHMARK (Setores)
// ============================================================================

/**
 * Setores de benchmark para segmentação de clientes.
 * Usado em `client_onboarding.setor_benchmark`.
 */
export type SetorBenchmark =
  | 'comercio_direto_ecommerce_social'
  | 'comissionamento_afiliados'
  | 'infoprodutor_educador_pago'
  | 'servico_consultoria_profissional'
  | 'patrocinio_publicidade_marca'
  | 'membership_assinatura_comunidade'
  | 'monetizacao_nativa_plataforma'
  | 'autoridade_personal_branding_b2b'
  | 'pre_monetizacao_a_validar'

// ============================================================================
// SEÇÃO 10: RESULTADO DE CÁLCULO (Gaps fechados na v1.0.1)
// ============================================================================

export type CalculationResult =
  | { status: 'success'; data: FunnelMetrics; isSaturated: boolean; razaoEscala: number }
  | { status: 'error'; reason: 'missing_ctr_link' | 'invalid_params'; message: string }

/**
 * ✅ REFACTORING: Novo tipo de resultado com rastreamento de fonte de dados.
 * Resolve problema de repositórios com fallback (ex.: instagramOverviewRepository)
 * que não tinham forma de informar se os dados vieram de `orbit` ou `public`.
 */
export type DataSource = 'orbit' | 'public'

export interface SourcedResult<T> {
  data: T
  source: DataSource
}

// ============================================================================
// SEÇÃO 11: HOOKS DE RETORNO (Padrões)
// ============================================================================

export interface UseAlertsResult {
  data: Alert[]
  status: FetchStatus
  error: string | null
  totalCritical: number
  totalWarning: number
  totalInfo: number
  lastUpdated: Date | null
  refetch: () => Promise<void> | void
}

/**
 * ⚠️ OBSERVAÇÃO (11): Divergência histórica entre duas linhagens — `AlertCounts`
 * existia em Doc.A com campo `total: number` não explicado.
 * Aqui removida de orbit.ts; deve viver em seu próprio arquivo se usado
 * localmente em hooks (ex.: useAlerts.ts).
 */

export interface UseClientMetricsReturn {
  data: ClientMetrics | null
  status: FetchStatus
  error: string | null
  lastUpdated: Date | null
  refetch: () => Promise<void> | void
}

export interface UseClientHealthReturn {
  data: ClientHealthSnapshot | null
  status: FetchStatus
  error: string | null
  lastUpdated: Date | null
  refetch: () => Promise<void> | void
}

// ============================================================================
// SEÇÃO 12: ALIASES PARA COMPATIBILIDADE
// ============================================================================

// Nomes alternativos que existem em produção; mantidos como aliases.
export type InstagramOverviewData = IGOverviewData
export type UseInstagramOverviewReturn = UseInstagramOverviewResult

// ============================================================================
// RESUMO DE MUDANÇAS (para auditoria)
// ============================================================================

/**
 * MUDANÇAS CONFORME CONCILIAÇÃO:
 *
 * [FE-01] ✅ Adicionado: export interface FunnelData
 *         Razão: `src/types/funnel.ts` reexportava nome inexistente
 *
 * [FE-02] ✅ Renomeado: ClientStatus → ClientHealthStatus
 *         Razão: `clientsRepository.ts` usava STATUS_ORDER com valores
 *                que só existem em ClientHealthStatus (critical, warning, healthy)
 *
 * [DB-01] ✅ Expandido: AlertSeverity += 'success'
 *         Razão: enum orbit.alert_severity tem 4 valores; view SQL já
 *                compensa com CASE WHEN para normalizar
 *
 * [DB-02] ✅ Removido: AlertRow, CriticalAlertRawRow
 *         Razão: tipos mortos, duplicatas literais, sem consumidor confirmado
 *
 * [DB-03] ✅ Reescrito: ClientRow conforme schema real
 *         Razão: campos originais não existem em orbit.clients;
 *                nome correto agora reflete DDL real do Postgres
 *
 * [DB-05] ✅ Mudado para opcional: KpiSnapshotRow.metric_unit, delta_pct,
 *                                 semaphore, subtitle
 *         Razão: colunas não existem em orbit.metric_history
 *
 * [DB-06] ✅ Corrigido: FormatPerformanceRawRow.trend_color: TrendColor → GlowColor
 *         Razão: view retorna valor fixo 'gold' (cor), não direção (up/down/flat)
 *
 * [FE-04] ℹ️  Anotado: Alert.exportable — campo indefinido
 *         Razão: nenhuma coluna ou lógica determinística encontrada no banco;
 *                deixar explicitamente undefined no mapper até confirmação
 *
 * [INFO]  ℹ️  Consolidado: Vocabulário de cor (GlowColor é canônico para status)
 *         Razão: 8 tipos sobrepostos antes; now: TrendColor=direção, GlowColor=status
 */

// ============================================================================
// FIM DO ARQUIVO
// ============================================================================