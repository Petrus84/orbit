// ============================================================================
// src/types/orbit.ts — VERSÃO ÚNICA GOZA DE PLENA RECONCILIAÇÃO//
//
// Este arquivo consolida DUAS versões do mesmo SSOT em momentos
// distintos (Doc.A = com AlertCounts/UseAlertsResult ao final; Doc.B = sem
// eles, com o bloco de Onboarding reordenado). Não é refatoração — é
// reconciliação: nada foi removido sem sinalização, nada foi "corrigido"
// silenciosamente. 
// LISTA COMPLETA DE OBSERVAÇÕES (pontuais, sem recomendação de próximo passo):
//
// 1) DIVERGÊNCIA REAL ENTRE OS DOIS DOCUMENTOS: `AlertCounts` e
//    `UseAlertsResult` existem no Documento A e NÃO existem no Documento B.
//    É a única diferença de conteúdo (não cosmética) entre as duas versões.
//    Os dois arquivos que deveriam ser a mesma fonte de verdade estão
//    dessincronizados — um tem um hook de contagem de alertas modelado,
//    o outro não.
//
//
// 4) Vocabulário de status/cor fragmentado em ~8 tipos que representam o
//    mesmo conceito semântico (bom/atenção/ruim), cada um com convenção
//    própria (PT vs EN, palavra vs cor): AlertSeverity, ClientHealthStatus,
//    AlignmentStatus, StatusVariant, SemaphoreColor, GlowColor, TrendColor,
//    AlignmentColor, MetaAdsKPIStatus. O próprio autor original documenta
//    isso no comentário de MetaAdsKPIStatus como "terceiro vocabulário de
//    cor no projeto" — problema identificado e conscientemente não resolvido.
//
// 5) `AvatarProfile` é declarada DUAS VEZES no mesmo arquivo (em ambos os
//    documentos). TypeScript faz merge de interfaces homônimas, então
//    compila — mas isso mascara a forma real do tipo e sugere que quem
//    editou não sabia que a interface já existia.
//
// 6) Duplicidade semântica entre `IGOverviewLegacyData` e
//    `IGAccountOverviewData`: mesmos 7 campos, nomes diferentes, ambos
//    mantidos "por segurança" sem confirmação de uso real.
//
// 7) Três representações da entidade "Campanha" — `CampaignRow` (snake_case,
//    linha crua do banco), `MetaCampaignRow extends CampaignRow` (idem +
//    campos de ads) e `Campaign` (camelCase, já processada por um
//    `rowToCampaign()` que não está neste arquivo) — sem um tipo/camada de
//    mapper explícito documentado junto às interfaces.
//
// 8) Tipos "mortos" mantidos por precaução, sem consumidor confirmado:
//    `FunnelActualMetrics`, `IGAccountOverviewData`. Acúmulo de dívida
//    técnica em vez de remoção — típico de quem tem medo de quebrar algo
//    que não entende completamente.
//
// 9) `MetaCampaignRow` foi estendido (roas, ctr, frequency, fatigue_percent,
//    cpl) por INFERÊNCIA do uso no frontend, não por verificação do schema
//    Supabase — o próprio comentário original admite isso (⚠️ "Não validado
//    contra Supabase ainda"). Isso inverte a direção de verdade esperada de
//    um SSOT (deveria nascer do schema, não do consumo).
//
// 10) `validateMetaCampaignRow` ficou defasada: não valida os campos novos
//     (roas, ctr, frequency, fatigue_percent, cpl) que a interface declara.
//     A função de type-guard não protege o que o tipo promete.
//
// 11) Mistura de idioma dentro do mesmo domínio: campos do funil em PT-BR
//     (`alcance`, `cliques`, `taxaConv`) convivem com o tipo legado em EN
//     (`reach`, `linkClicks`, `conversionRate`) sem convenção de tradução
//     única — reflexo de features implementadas por pessoas diferentes.
//
// 12) `FetchStatus` e `FetchStatusLegacy` têm o MESMO shape literal
//     (`'idle'|'loading'|'success'|'error'`) — dois nomes para o mesmo tipo,
//     sem diferença de forma que justifique a duplicação.
//
// 13) `AlertSeverity` (info/warning/critical) e `ClientHealthStatus`
//     (healthy/warning/critical/unknown) e `AlignmentStatus`
//     (healthy/warning/critical) se sobrepõem parcialmente sem hierarquia
//     comum — cada domínio (alerta, saúde de cliente, alinhamento de
//     avatar) reinventou seu próprio enum de severidade.
//
// Nada abaixo foi "corrigido" por conta própria: onde os dois documentos
// concordam, o shape foi mantido como está (é o que o código real consome,
// segundo os comentários originais). Onde divergem, ambos os shapes foram
// preservados e sinalizados.
// ============================================================================

import type { ReactNode } from 'react'

// ============================================================================
// SEÇÃO 0: TIPOS CANÔNICOS COMPARTILHADOS
// ============================================================================

/**
 * ✅ PATCH (DB-01 — guia de implantação): adicionado 'success'.
 * Evidência: enum `orbit.alert_severity` no Postgres tem 4 valores
 * (critical, warning, info, success); a view `v_alerts` já compensava com
 * `CASE WHEN severity='success' THEN 'info'`. Contrato TS agora reflete o
 * banco.
 */
/** Severidade de alerta. Fonte canônica — types/alert.ts apenas re-exporta. */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success'

/**
 * ✅ PATCH (perícia enums 14/08): 6 enums existiam no Postgres sem
 * `export type` correspondente em orbit.ts (FANTASMA real, confirmado por
 * grep — nenhuma ocorrência do nome nem dos valores neste arquivo antes
 * deste patch). Evidência: `dump_orbit.sql`, CREATE TYPE "orbit".*.
 */
export type AdsPlatform = 'meta' | 'google' | 'tiktok' | 'linkedin'
export type AssetStatus = 'active' | 'paused' | 'archived' | 'draft' | 'under_review'
export type ContentFormat = 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv'
export type FatigueCause = 'creative_saturation' | 'segmentation_issue' | 'offer_issue' | 'healthy'
export type IngestScript = 'ingest-l0-v2' | 'ingest-insights' | 'extract-demographics' | 'manual'
export type PeriodSource = 'instagram_export' | 'meta_api' | 'google_ads_api' | 'ga4_api' | 'manual_input'

/**
 * ✅ PATCH (perícia enums 14/08): enum `orbit.alert_type` no Postgres tem
 * 9 valores; o campo `OrbitAlertRow.alert_type` estava tipado como
 * `string` solto (INV-3). Fonte canônica agora aqui.
 */
export type AlertType =
  | 'ctr_below_threshold'
  | 'engagement_collapse'
  | 'avatar_misalignment'
  | 'creative_fatigue'
  | 'roas_below_minimum'
  | 'follower_churn_high'
  | 'polemic_score_high'
  | 'boost_opportunity'
  | 'budget_pace'

/**
 * ✅ PATCH (perícia enums 14/08): consolida `confidence_level` (que já
 * batia com o banco, mas estava inline sem nome) e resolve a duplicação
 * com `max_confidence_level`, que estava como `string` solto.
 * Evidência: `orbit.confidence_level` = L0, L1, L2 (maiúsculo).
 */
export type ConfidenceLevel = 'L0' | 'L1' | 'L2'

/**
 * ✅ PATCH (content contract 14/08): espelha `orbit.alert_natureza` no
 * banco (content_contract_migration.sql). contentContractEngine.ts importa
 * daqui — não redeclara.
 */
export type AlertNatureza = 'tecnica' | 'comunicacao'
// 'tecnica'     = resolvível com dado (motor de regras decide)
// 'comunicacao' = resolvível com plano de conversa, não com correção (item 28
//                 do Content Contract Tree). Nunca inferir na UI — só o
//                 resolver que gerou o alerta sabe qual dos dois é.

/**
 * ✅ PATCH (Content Contract v1.3 — 24/08/2026): `orbit.calibration_method`
 * tem 5 valores no banco — os 3 originais do engine
 * (`percentile_relative`, `percentile_based`, `percentile_based_lower_better`)
 * mais 2 introduzidos pela migração da Opção B: `empirical_percentile` e
 * `empirical_percentile_zero_inflated` (usado por `utilidade_score` e
 * `polemica_score` — dispara o tratamento de texto zero-inflated
 * obrigatório do Content Contract v1.3 §1.1, nunca tratar o zero como
 * falha). Fonte canônica agora aqui; contentContractEngine.ts importa, não
 * redeclara — antes deste patch o tipo estava local ao engine com só 3
 * valores, fora de sincronia com o enum real do Postgres.
 */
export type CalibrationMethod =
  | 'percentile_relative'
  | 'percentile_based'
  | 'percentile_based_lower_better'
  | 'empirical_percentile'
  | 'empirical_percentile_zero_inflated'


/**
 * ✅ NOVO (Content Contract v1.3 §0.1): hierarquia de fallback da régua —
 * `category + tier` → `category + all` → `global`, nesta ordem. Estado do
 * banco validado em 24/08/2026: só `1_ecommerce_direto` tem réguas por
 * tier (nano/micro/mid/macro + all); todas as demais categorias caem no
 * `global`. O texto do alerta é obrigado a declarar qual nível foi
 * realmente usado (campo `ruleDeclaration` em `ClassifiedMetric`) — nunca
 * apresentar uma régua mais específica do que a que decidiu a cor.
 */
export type ThresholdGranularity = 'category_tier' | 'category_all' | 'global'

/**
 * ✅ NOVO (Content Contract v1.3): shape de linha de `orbit.ref_thresholds`
 * pós-migração da Opção B. Substitui o `RefThresholdRow` que vivia
 * redeclarado localmente em `contentContractEngine.ts` — violava a mesma
 * regra de SSOT que este arquivo já impõe em todo o resto do projeto
 * (tipo de domínio não nasce no consumidor; ver observação de cabeçalho,
 * item sobre `AlertNatureza`). `category`/`tier` são os campos de
 * granularidade novos da migração; `confidence_score` (0–1 contínuo,
 * Content Contract v1.3 §0.2) é distinto de `ConfidenceLevel` (L0/L1/L2
 * categórico) — os dois convivem por design, não é duplicação.
 */
export type ThresholdSource = 'category' | 'category_tier' | 'global' | 'tier'

export type MetricDirection = 'higher_is_better' | 'lower_is_better' | 'signal_intensity'

export type ClientCardData = Client

/**
 * Shape canônico de orbit.ref_thresholds (pós Opção B + Content Contract v1.3).
 * `tier_normalized` é o nome da coluna no banco.
 * `tier` fica como alias opcional só para consumidores antigos.
 */
export interface RefThresholdRow {
  metric_name: string
  category: string | null
  tier_normalized: string | null
  tier?: string | null | undefined
  dataset_id: string | null
  threshold_source: ThresholdSource | null
  observation_unit: string | null
  direction: MetricDirection | null
  percentile_p10: number | null
  percentile_p25: number | null
  percentile_p50: number | null
  percentile_p75: number | null
  percentile_p90: number | null
  sample_mean: number | null
  sample_std: number | null
  sample_count: number
  confidence_score: number | null
  green_min: number | null
  green_max: number | null
  amber_min: number | null
  amber_max: number | null
  red_min: number | null
  red_max: number | null
  zero_count: number | null
  zero_rate: number | null
  notes: string | null
  benchmark_note: string | null
}
/**
 * ✅ NOVO (Content Contract v1.3): payload de retorno de
 * `classifyMetric()`/`fn_classify_metric` pós-contrato v1.3. Estende o
 * shape anterior (`semaphore`, `statusText`, `confidenceLevel`) com os 3
 * campos que o frontend precisa para não inventar transparência de régua
 * na UI: `thresholdSource` (qual nível da hierarquia §0.1 decidiu a cor),
 * `confidenceScore` (0–1 cru, pode ser `null` se a RPC não retornar),
 * `ruleDeclaration` (o texto pronto da régua usada — já no vocabulário
 * oficial do contrato, item 0.1 "Exemplos corretos"). Movido para cá pela
 * mesma razão de `RefThresholdRow`: é forma de domínio, não deveria nascer
 * dentro de `contentContractEngine.ts`.
 */
export interface ClassifiedMetric {
  // ✅ NOVO (05/09/2026 — fix bug "NaN" no SectorPositioningPanel): valor
  // numérico bruto que foi classificado, exposto direto — antes disso, o
  // único jeito de recuperar o número era fazer parse de `statusText`
  // (`Number(statusText.split(' ')[0])`), que quebra sempre que statusText
  // não começa com o número puro (ex: fallback "classificação
  // indisponível...", ou o texto zero-inflated "35% dos posts..."). Não
  // reintroduza esse parsing — use este campo.
  value: number
  semaphore: SemaphoreColor
  statusText: string
  confidenceLevel: ConfidenceLevel
  thresholdSource: ThresholdGranularity
  confidenceScore: number | null
  ruleDeclaration: string
  // ✅ NOVO (Content Contract v1.3 §1.1): presente só quando
  // `calibration_method === 'empirical_percentile_zero_inflated'`
  // (hoje: `utilidade_score`/`polemica_score`). `zeroPct` = % de posts sem
  // sinal comercial explícito na categoria/porte da régua usada;
  // `signalRangeLabel` = texto já pronto da faixa onde os posts COM sinal
  // estão (ex: "12–34"). O contrato é explícito: zero nunca é tratado como
  // falha por padrão — o resolver decide o texto, não assume.
  calibrationMethod: CalibrationMethod | null
  zeroInflated: {
    zeroPct: number
    signalRangeLabel: string
  } | null
}

/**
 * ✅ PATCH (perícia enums 14/08): enum `orbit.campaign_objective` tem 8
 * valores; estava como `string` solto (INV-3).
 */
export type CampaignObjective =
  | 'awareness'
  | 'reach'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'app_promotion'
  | 'sales'
  | 'video_views'

// ⚠️ Fora do escopo desta perícia: `campaign_status` não é um enum do
// Postgres em `dump_orbit.sql` (nenhum CREATE TYPE "orbit"."campaign_status").
// Mantido como string solto até confirmar se é enum, check constraint, ou
// texto livre no banco — não inventar valores sem essa confirmação.
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
// ⚠️ OBSERVAÇÃO (4): vocabulário de cor #2 — nomes de cor em EN.
export type GlowColor = 'cyan' | 'gold' | 'red' | 'green' | 'none'
export type TrendColor = 'up' | 'down' | 'flat'

/**
 * ⚠️ PATCH (FE-02 — guia de implantação, revisado): o guia descreve isto
 * como "renomear ClientStatus → ClientHealthStatus", mas os dois tipos já
 * coexistiam nesta versão com significados DIFERENTES: `ClientStatus` é
 * estado operacional da conta (active/inactive/paused) e
 * `ClientHealthStatus` (linha ~363) é saúde do cliente (healthy/warning/
 * critical/unknown). O bug real está em `clientsRepository.ts`, que declara
 * `STATUS_ORDER: Record<ClientStatus, number> = { critical: 0, warning: 1,
 * healthy: 2 }` usando o tipo errado — deveria ser
 * `Record<ClientHealthStatus, number>`. A correção é no repositório, não
 * aqui: `ClientStatus` NÃO foi removido, pois pode ter outros consumidores
 * (ex.: filtros operacionais) que o guia não auditou.
 */
export type ClientStatus = 'active' | 'inactive' | 'paused';
export type DeltaDirection = 'up' | 'down' | 'flat';

// ============================================================================
// SEÇÃO 0.1: TIPOS INFERIDOS
// ============================================================================

// Mapper: Transforma a direção da tendência no padrão visual Glow
export const TREND_TO_GLOW: Record<TrendColor, GlowColor> = {
  up: 'cyan',    // Ex: Crescimento positivo/Neutro alto
  flat: 'none',   // Sem alteração relevante
  down: 'red'     // Queda ou alerta
};

// Mapper: Caso ainda usem a semântica antiga de sucesso/perigo em algum ponto
export const SEVERITY_TO_GLOW: Record<'success' | 'warning' | 'danger', GlowColor> = {
  success: 'cyan',
  warning: 'gold',
  danger: 'red'
};

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
   * ✅ PATCH (FE-04 — guia de implantação): tornado opcional.
   * Regra de negócio não confirmada no banco; mapper não deve "chutar"
   * valor. Antes era `boolean` obrigatório (forçava o mapper a inventar
   * um valor); agora ausência real é representável sem type-cast forçado.
   */
  exportable?: boolean | undefined  // 🟢=true, 🟡/🔴=false — TODO: confirmar regra
  confidenceLevel?: 'L0' | 'L1' | 'L2' | undefined  // Selo L2
  personaType?: 'ecommerce' | 'creator' | 'agency' | 'infoprodutor' | undefined
  /**
   * ✅ PATCH (content contract 14/08): campos do Content Contract Tree.
   */
  natureza?: AlertNatureza | undefined
  // ausente = ainda não classificado pelo motor (contentContractEngine.ts).
  // NÃO tratar ausência como 'tecnica' por default em nenhuma camada — é
  // exatamente o que a coluna correspondente em orbit.alerts evita não
  // tendo DEFAULT. Ver orbit.alerts.natureza.
  probableCause?: string | null | undefined
  // causa nomeada pelo resolver, nunca escrita à mão na UI. `null` explícito
  // = resolver rodou e concluiu que a causa é indeterminável com o dado
  // atual (não confundir com `undefined` = resolver nem rodou ainda).
dataSource?: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'empty_database' | 'error' | 'estimate' | undefined
  // obrigatório expor quando = 'fallback_by_client': é o campo que existe
  // porque o Funil (funnelRepository.ts) hoje cai em FALLBACK_BY_CLIENT sem
  // marcar a origem do dado que chega à UI.

  /**
   * ✅ NOVO (schema orbit.alerts confirmado via database.types.ts):
   * campos que já existem na tabela real, mas ainda não eram expostos por
   * `Alert`/`fromOrbitRow()`. Todos opcionais/nuláveis, mesmo padrão dos
   * campos do Content Contract acima — ausência ≠ erro, é estado válido.
   */
  snapshotId?: string | undefined
  // referência ao snapshot (orbit.ig_account_snapshots ou equivalente) que
  // originou o metricValue. `undefined`/`null` = alerta ainda sem
  // proveniência registrada (ver observação sobre o gerador de
  // ctr_below_threshold — nenhuma rotina hoje preenche esta coluna).
  suggestedAction?: string | null | undefined
  resolvedAt?: string | null | undefined
  snoozedUntil?: string | null | undefined
  resolvedBy?: string | null | undefined
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
  clientHandle: string
  periodLabel: string
  dateRange: {
    start: Date
    end: Date
  }
}

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
  // ⚠️ OBSERVAÇÃO (14): campos abaixo só existiam na linhagem v1.0.1 do
  // arquivo (Documento 4), ausentes nesta linhagem até agora — adição
  // não-conflitante (superset), sem divergência de shape.
  sourceLevel?: string
  playRate?: number | null
}

export interface QualityScoreItem {
  id: string
  label: string
  value: number | string
  unit: string
  statusText: string
  statusVariant: StatusVariant
  glowColor: GlowColor
}

export interface FormatPerformanceRow {
  id: string
  format: string
  posts: number
  shares: number
  trendLabel: string
  postsDetail: PostSummary[]
  
  // ✅ CORREÇÃO (achado novo, mesma causa já documentada em DB-06 para
  // FormatPerformanceRawRow): v_format_performance.trend_color devolve uma
  // cor pronta ('cyan'|'gold'|'red'|'none'), não uma direção de tendência
  // ('up'|'down'|'flat'). O patch DB-06 corrigiu o tipo bruto
  // (FormatPerformanceRawRow) mas não propagou para este tipo de domínio,
  // consumido direto por FormatPerformanceTable.tsx via StatusPill (que já
  // exige GlowColor desde sua própria correção v1.1.0).
  trendColor: GlowColor
}

export interface SharesSummary {
  total: number | null
  periodLabel: string
  source: 'account_aggregate' // real, agregado por conta/período — nunca distribuído por post
}

export interface PostSummary {
  id: string
  publishedAt: string
  likes: number | null
  comments: number | null
  caption: string | null
  polemicScorePct: number | null
  // ✅ NOVO (06/09/2026): orbit.ig_posts.is_boost_candidate já é calculado
  // no banco (motor de boost), mas nunca tinha sido exposto na tela —
  // ficava "invisível" mesmo quando true. Ver FormatPerformanceTable.
  isBoostCandidate: boolean
}

export interface InsightData {
  id: string
  text: string
}
// APENAS A SEÇÃO QUE PRECISA MUDAR - copie e substitua em orbit.ts

export interface CriticalAlertData {
  id: string
  title: string
  body: string
  exportable: boolean  // true para 🟢, false para 🟡/🔴
  confidenceLevel?: 'L0' | 'L1' | 'L2'  // Selo L2
  personaType?: 'ecommerce' | 'creator' | 'agency' | 'infoprodutor'
  severity: AlertSeverity
  description?: string | null
  actionUrl?: string | null

  /**
   * ✅ PATCH (content contract 14/08): mesmo trio de Alert, mesma semântica.
   * Alert e CriticalAlertData são dois shapes paralelos pro mesmo conceito
   * (divergência já documentada) — até serem unificados, os dois precisam
   * do patch em espelho pra não abrir uma nova divergência entre eles.
   */
  natureza?: AlertNatureza
  probableCause?: string | null
  dataSource?: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'empty_database' | 'error' | 'estimate'
}
export interface IGOverviewData {
  meta: DashboardHeaderMeta
  kpis: KPICardData[]
  qualityScores: QualityScoreItem[]
  formatPerformance: FormatPerformanceRow[]
  sharesSummary: SharesSummary
  insights: InsightData[]
  criticalAlerts: CriticalAlertData[]
  audienceSummary: AudienceSummary
  clients: Client[]  // ⚠️ OBSERVAÇÃO (15): shape de cliente com `positioning` (nova feature)
  positioning: SectorPositioning  // ✅ mudou aqui
}

export interface AudienceCity {
  name: string
  pct: number
}

export interface AudienceSummary {
  genderFemalePct: number | null
  genderMalePct: number | null
  genderOtherPct: number | null
  topCities: AudienceCity[]
  reachFollowersPct: number | null
  profileVisits: number | null
  linkClicks: number | null
  periodLabel: string
}
/**
 * ✅ PATCH (FE-01 — guia de implantação): adicionado `FunnelData`.
 * Evidência: `src/types/funnel.ts` reexporta `FunnelData` de `orbit.ts`,
 * mas esse nome nunca existiu aqui, causando TS2305 no build.
 * NOTA: este é um tipo ADICIONAL — não substitui `FunnelMetrics` (PT-BR,
 * abaixo), que continua sendo o shape consumido por `UseFunnelResult` e
 * `CalculationResult`. Confirmar com quem mantém `funnelRepository.ts`
 * qual dos dois shapes (`FunnelData` vs `FunnelMetrics`) é o real antes de
 * apagar qualquer um — não faço essa escolha por conta própria.
 */
export interface FunnelData {
  alcance: number
  cliques: number
  conversoes: number
  taxaConv: number
  custoConversao: number
}

/**
 * Formato "flat" real do funil (PT-BR) — ⚠️ OBSERVAÇÃO (11): mistura de
 * idioma com FunnelActualMetrics abaixo (EN).
 */
export interface FunnelMetrics {
  alcance: number
  visitas: number
  // ✅ CORRIGIDO 09/09 (TICKETS item 7) — number | null pra distinguir
  // "sem dado no período" de "zero real". Antes NULL do banco já virava 0
  // dentro de funnelRepository.ts, então o componente nunca sabia a
  // diferença.
  cliques: number | null
  vendas: number | null
  // ✅ CORRIGIDO 09/09 (TICKETS item 4) — "ctrBio" era usado pra
  // alcance→visitas (taxa de visita ao perfil), não pra CTR do link. Split
  // em 2 campos com nome correto; profileVisitRate = visitas/alcance,
  // linkCtrPct = cliques/visitas (o que o texto do insight já descrevia).
  profileVisitRate: number
  linkCtrPct: number
  taxaConv: number
}

// ⚠️ OBSERVAÇÃO (8): tipo morto — nenhum arquivo com erro depende dele;
// mantido "por segurança/rastreabilidade" sem consumidor confirmado.
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

export interface UseFunnelResult extends AsyncState<FunnelMetrics> {
  params: SimulatedFunnelParams
  setParams: (params: SimulatedFunnelParams) => void
  lastUpdated: Date | null
  refetch: () => void
  // ✅ CORRIGIDO 09/09 (TICKETS item 8) — client_onboarding.setor_benchmark,
  // pra FunnelScreen parar de passar `setor={null}` fixo pro simulador.
  setor: SetorBenchmark | null
}

export interface FunnelMetricsRow {
  reach_total: number | null
  profile_visits: number | null
  link_clicks: number | null
  period_start: string
  period_end: string
}
/**
 * ✅ NOVO: shape de retorno de fetchSectorPositioning()
 * (instagramOverviewRepository.ts). Derivado diretamente do objeto que a
 * função monta — cada campo mapeado 1:1 com o tipo real da coluna
 * correspondente em ClientOnboarding, e erReal/vps/polemicScore usando
 * ClassifiedMetric (já existente) porque vêm de classifyMetric().
 */
export interface SectorPositioning {
  setorBenchmark: SetorBenchmark | null
  nicho: string | null
  funnelMaturity: FunnelMaturity | null
  proofMechanism: ProofMechanism | null
  erReal: ClassifiedMetric | null
  erRealValue: number | null
  vps: ClassifiedMetric | null
  vpsValue: number | null
  polemicScore: ClassifiedMetric | null
  polemicScoreValue: number | null
  engagementPeriodNotes: string | null
  contentProxyNotes: string | null
  misalignmentNotes: string | null
  observedContentClusters: string | null
  audienceComposition: {
  nucleoFielPct: number | null
  consumoPassivoPct: number | null
  curiosidadeExternaPct: number | null
  altaRotatividadePct: number | null
  }
}

// ============================================================================
// SEÇÃO 1: TIPOS EXISTENTES
// ============================================================================

export type TabId =
  | 'overview'
  | 'metrics'
  | 'health'
  | 'alerts'
  | 'settings'
  | 'por-post'
  | 'audiencia'

// ⚠️ OBSERVAÇÃO (6): shape idêntico a IGAccountOverviewData (Seção 0.1).
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
 * SSOT: orbit.v_client_health (view calculada). Nunca ler
 * clients.health_status (coluna estática, deprecated — R-03).
 * ⚠️ OBSERVAÇÃO (13): 4º valor 'unknown' não existe em AlignmentStatus,
 * apesar de ambos modelarem "saúde/status" de forma similar.
 */
export type ClientHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'


export interface ClientMetrics {
  engagement_real: number
  ctr_link: number
  follower_balance: number
  polemic_score_pct: number
  follower_churn_pct: number
  segment: {
    // ✅ PATCH (perícia enums 14/08): faltava 'non_binary' — orbit.gender_category
    // tem 4 valores no Postgres, só 3 estavam cobertos aqui.
    gender_dominant: 'male' | 'female' | 'non_binary' | 'mixed'
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
  avatar?: string | undefined
  status: ClientHealthStatus
  metrics: ClientMetrics
  snapshotCount?: number
  lastSnapshotDate?: string | null
  lastUpdated: string
}


// ============================================================================
// SEÇÃO 2: RAW ROW CONTRACTS — REPOSITÓRIOS
// ============================================================================

export interface OrbitClientHealthRow {
  client_id: string | null
  handle: string | null
  avatar_name: string | null
  metric_count: number | null
  avg_quality_score: number | null
  health_status: ClientHealthStatus | null // ✅ PATCH (perícia enums 14/08): era `string` solto
  last_updated: string | null
  days_since_update: number | null
  max_confidence_level: ConfidenceLevel | null // ✅ PATCH (perícia enums 14/08): era `string` solto
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
  alert_type: AlertType // ✅ PATCH (perícia enums 14/08): era `string` solto
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
  confidence_level: ConfidenceLevel | null // ✅ PATCH (perícia enums 14/08): era literal inline, agora usa o type nomeado
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

export type RawRow = Record<string, unknown>

export interface FetchOverviewParams {
  clientId: string
  periodStart: string
  periodEnd: string
}

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

/**
 * ⚠️ OBSERVAÇÃO (9): campos abaixo (client_id, roas, ctr, cpc, frequency,
 * fatigue, fatigue_percent, cpl) foram adicionados por inferência do
 * consumo no frontend, SEM confirmação contra o schema real do Supabase.
 * ⚠️ OBSERVAÇÃO (10): validateMetaCampaignRow (abaixo) não valida
 * roas/ctr/frequency/fatigue_percent/cpl — a validação está incompleta
 * em relação ao que a interface promete.
 */
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
// SEÇÃO 3: TIPOS DE AVATAR
// ============================================================================

export type AlignmentStatus = 'healthy' | 'warning' | 'critical'
// ⚠️ OBSERVAÇÃO (4): vocabulário de cor #3 — palavras em EN diferentes de
// GlowColor e SemaphoreColor, para o mesmo conceito de severidade.
export type AlignmentColor = 'success' | 'warning' | 'danger'
// ⚠️ OBSERVAÇÃO (12): shape idêntico a FetchStatus — duplicata sem motivo
// de forma diferente.
export type FetchStatusLegacy = 'idle' | 'loading' | 'success' | 'error'

export interface GenderSplit {
  male: number
  female: number
}

// AvatarProfile  declarada apenas aqui sem gendersplit. 

export interface AvatarProfile {
  ageRange: string
  interest: string
  geo: string
  gender: { male: number; female: number }
  interestSource?: 'instagram_insights' | 'client_feedback' | 'manual' | null
  interestConfidence?: 'L0' | 'L1' | 'L2' | null
}


export interface AvatarRecommendation {
  id: string
  title: string
  description: string
  icon?: string // '🎯' | '📅' | '📍' | '🔄' conforme o layout exibe
  type?: AlignmentStatus
}

export interface AlignmentBar {
  label: string
  expected: number
  real: number
  variance: number
  status: AlignmentStatus
  color: AlignmentColor
}

export interface AvatarAlignment {
  id: string
  clientId: string
  expected: AvatarProfile
  real: AvatarProfile
  score: number
  status: AlignmentStatus
  bars: AlignmentBar[]
  recommendations: AvatarRecommendation[]
  recommendation: AvatarRecommendation | null
  realInterestSource?: 'instagram_insights' | 'client_feedback' | 'manual' | null
  realInterestConfidence?: 'L0' | 'L1' | 'L2' | null
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
 * ⚠️ OBSERVAÇÃO (4): vocabulário de cor #4 — 'green'/'amber'/'red'/'gray',
 * o próprio autor original chama de "terceiro vocabulário de cor no
 * projeto" e registra que não normalizou por falta de visibilidade do
 * componente consumidor.
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

// ============================================================================
// SEÇÃO 10: ONBOARDING — Tipos e Interfaces
// ✅ RECONCILIADO contra orbit.client_onboarding (schema real, confirmado
// via information_schema.columns + pg_constraint em 2026-07-28).
// ============================================================================

export interface BioLink {
  url: string
  label: string
}

/**
 * ✅ PATCH (verificação ao vivo pg_constraint, 11/09/2026):
 * `client_onboarding_cta_type_check` no Postgres tem 5 valores — faltava
 * 'link_bio'. Query: information_schema/pg_constraint em orbit.client_onboarding.
 */
export type CTAType =
  | 'link_direto'
  | 'linktree_multilink'
  | 'dm_comentario'
  | 'nenhum'
  | 'link_bio'

/**
 * ✅ PATCH (verificação ao vivo pg_constraint, 11/09/2026):
 * `client_onboarding_funnel_maturity_check` no Postgres tem 4 valores —
 * faltava 'funil_basico'.
 */
export type FunnelMaturity =
  | 'nao_implementado'
  | 'implementado_fragmentado'
  | 'implementado_unificado'
  | 'funil_basico'

/**
 * ✅ PATCH (verificação ao vivo pg_constraint, 11/09/2026):
 * `client_onboarding_proof_mechanism_check` no Postgres tem 7 valores —
 * faltava 'clientes_ativos_gestao'.
 */
export type ProofMechanism =
  | 'prova_social'
  | 'autoridade'
  | 'escassez_urgencia'
  | 'associacao_marca'
  | 'resultado_documentado'
  | 'nenhum_observavel'
  | 'clientes_ativos_gestao'

/** ⚠️ CORRIGIDO: schema real usa 'PANIC_GRIEF', não 'PANIC'; 'mixed' não
 * existe na CHECK constraint do banco — removido. */
export type PankseppSystem =
  | 'SEEKING' | 'RAGE' | 'FEAR' | 'LUST' | 'CARE' | 'PANIC_GRIEF' | 'PLAY'

export interface SchwatzValue {
  value: string
  priority: 'high' | 'medium' | 'low'
}

/**
 * ✅ PATCH (verificação ao vivo pg_constraint, 11/09/2026):
 * `client_onboarding_values_affect_source_check` no Postgres tem 4 valores —
 * faltava 'bio_oficial_zip_insights_decisao_canal'.
 */
export type ValuesAffectSource =
  | 'onboarding'
  | 'client_feedback'
  | 'manual'
  | 'bio_oficial_zip_insights_decisao_canal'

/**
 * ✅ PATCH (verificação ao vivo pg_constraint, 11/09/2026):
 * `client_onboarding_total_followers_source_check` no Postgres tem 4
 * valores — a union inline em `ClientOnboarding.total_followers_source`
 * tinha só 3 (faltava 'scrape_perfil_confirmado'). Nomeado aqui para virar
 * a fonte única — `ClientOnboarding` referencia este tipo em vez de repetir
 * a union inline.
 */
export type TotalFollowersSource =
  | 'manual_print_confirmado'
  | 'instagram_api'
  | 'estimate'
  | 'scrape_perfil_confirmado'

/** SSOT: orbit.client_onboarding (schema confirmado 2026-07-28). */
export interface ClientOnboarding {
  client_id: string
  total_followers: number
  total_followers_source: TotalFollowersSource
  bio_links: BioLink[]
  cta_type: CTAType | null
  funnel_maturity: FunnelMaturity | null
  q1_engagement_period_notes: string | null
  q2_content_proxy_notes: string | null
  q3_misalignment_notes: string | null
  audience_nucleo_fiel_pct: number | null
  audience_consumo_passivo_pct: number | null
  audience_curiosidade_externa_pct: number | null
  audience_alta_rotatividade_pct: number | null
  // ⚠️ Coluna real é `text`, não jsonb — string livre, não Record.
  observed_content_clusters: string | null
  setor_benchmark: SetorBenchmark | null
  nicho: string | null
  proof_mechanism: ProofMechanism | null
  expected_panksepp_system: PankseppSystem | null
  real_panksepp_system: PankseppSystem | null
  expected_schwartz: Record<string, SchwatzValue> | null
  real_schwartz: Record<string, SchwatzValue> | null
  values_affect_source: ValuesAffectSource
  values_affect_confidence: 'L0' | 'L1' | 'L2'
  updated_by: string
  updated_at: string
}

export interface OnboardingStep {
  id: number
  title: string
  description: string
  icon: string
}

// ============================================================================
// SEÇÃO 11: ALERTAS — CONTAGEM 
// Presente apenas no Documento A. Ausente no Documento B. Mantido aqui e
// sinalizado — decidir se B esqueceu de incorporar, ou se A adicionou algo
// que ainda não deveria estar em produção, é uma decisão de quem conhece o
// hook `useAlerts` real; este arquivo apenas expõe o conflito.
// ============================================================================

/**
 * 📌 PATCH (FE-05 — guia de implantação, status DOCUMENTADO, não resolvido):
 * o guia descreve isto como "divergência de campo `total`" e recomenda
 * mover para arquivo local do hook `useAlerts.ts`. ⚠️ DIVERGÊNCIA: o shape
 * real abaixo NÃO TEM campo `total` — só `critical`/`warning`/`info`. Não
 * migrei nem apaguei este tipo porque (a) o guia não é o SSOT sobre o shape
 * real de `AlertCounts`, e (b) mover exigiria confirmar todos os
 * consumidores atuais de `orbit.AlertCounts`, o que está fora do escopo
 * deste arquivo. Deixado como estava, sinalizado.
 */
export interface AlertCounts {
  critical: number
  warning: number
  info: number
}

export interface UseAlertsResult {
  alerts: CriticalAlertData[]
  counts: AlertCounts
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  lastUpdated: Date | null
  refetch: () => Promise<void> | void
}

// ============================================================================
// SEÇÃO 12: GAPS RESOLVIDOS PELA LINHAGEM v1.0.1 (Documento 4) + ADRs
// (rodada de reconciliação nº2 — comparação contra orbit.ts v1.0.1 e o
// documento de arquitetura com LEI ZERO / ADR1-5). Nada aqui foi fundido
// silenciosamente com o que já existia nas Seções 0-11; onde há choque de
// shape, os dois tipos convivem, flagados.
// ============================================================================

// ⚠️ OBSERVAÇÃO (15) — GAP FECHADO: `SetorBenchmark` era importado por
// funnelRepository.calc.ts e avatarRepository.ts mas nunca existiu em
// nenhuma das duas linhagens de orbit.ts (TS2305 no relatório forense).
// Valores conforme o próprio relatório forense (Documento 6, avatarRepository
// Erro #2) — não confirmados contra tabela/enum do Supabase.
// ✅ PATCH (verificação ao vivo pg_constraint, 11/09/2026):
// `client_onboarding_setor_benchmark_check` no Postgres tem 10 valores —
// faltava 'saas_ferramenta'.
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
  | 'saas_ferramenta'

// ⚠️ OBSERVAÇÃO (16) — GAP FECHADO: `CalculationResult` vivia apenas local
// em funnelRepository.calc.ts (fora do SSOT). Centralizado aqui conforme o
// próprio relatório forense recomendava; shape reproduzido como descrito,
// não verificado contra o arquivo fonte.
export type CalculationResult =
  | { status: 'success'; data: FunnelMetrics; isSaturated: boolean; razaoEscala: number }
  | { status: 'error'; reason: 'missing_ctr_link' | 'invalid_params'; message: string }

/**
 * ⚠️ OBSERVAÇÃO (17) — GAP FECHADO: nenhuma das duas linhagens tinha um
 * tipo para rastrear de qual schema um dado veio. LEI ZERO (documento de
 * arquitetura do usuário): "banco de dados é orbit; qualquer outro é
 * cemitério" (public.* = legado/Sprint 1). O ADR 5 exige que repositórios
 * com fallback (ex.: instagramOverviewRepository) retornem `{ data, source }`
 * — sem este tipo, esse fallback não é tipado, é invisível pro TS.
 */
export type DataSource = 'orbit' | 'public'

export interface SourcedResult<T> {
  data: T
  source: DataSource
}

/**
 * ⚠️ OBSERVAÇÃO (18) — DIVERGÊNCIA NÃO RESOLVIDA: shape real de linha de
 * alerta segundo a linhagem v1.0.1 (Documento 4, comentário "✅ AlertRow
 * corrigido: metric_id ← era 'title', message ← era 'body', is_active
 * removido — não existe na tabela"). Este shape é INCOMPATÍVEL com
 * `OrbitAlertRow`/`LegacyAlertRow` (Seção 2), que assumem title/description/
 * metric_name/metric_value/threshold_value/action_url. Um dos dois está
 * errado em relação ao schema real — não decidido aqui, apenas exposto.
 */
/**
 * ✅ PATCH (DB-02 — guia de implantação): `AlertRow` e `CriticalAlertRawRow`
 * removidos. Eram duplicatas literais entre si, sem consumidor confirmado,
 * e incompatíveis com o shape real de `v_alerts` (ver `Alert` e
 * `OrbitAlertRow`/`LegacyAlertRow` acima, que TÊM validadores e refletem a
 * view real). Mapeadores devem usar `Alert` diretamente.
 */

/**
 * ⚠️ OBSERVAÇÃO (20) — GAP FECHADO parcialmente: segunda lineage de raw-row
 * para KPI/Quality/Format, DIVERGENTE de RawKPIRow/RawQualityRow/RawFormatRow
 * (Seção 2) — nomes de campo diferentes (metric_key/metric_value/created_at
 * vs metric/value). Nenhuma das duas foi marcada como obsoleta em nenhum
 * documento recebido; convivem aqui como duas gerações não reconciliadas
 * do mesmo raw shape.
 */
/**
 * ✅ PATCH (DB-05 — guia de implantação): `metric_unit`, `delta_pct`,
 * `semaphore`, `subtitle` tornados opcionais — colunas não existem em
 * `orbit.metric_history`; mapper pode deixar `undefined`.
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
 * ✅ PATCH (DB-06 — guia de implantação): `trend_color`: `TrendColor` →
 * `GlowColor`. Evidência: `v_format_performance.trend_color` retorna valor
 * fixo de cor (ex.: 'gold'), não uma direção (up/down/flat). Bug histórico
 * em `StatusPill.tsx` decorria desta tipagem errada.
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
  trend_color: GlowColor
}

/**
 * ⚠️ OBSERVAÇÃO (21) — GAP FECHADO: `ClientDemographics`/`ClientRow` não
 * existiam em nenhuma seção anterior. Trazem uma TERCEIRA representação de
 * "esperado vs real" de avatar, distinta de `AvatarProfile` (objeto
 * GenderSplit) e de `ClientOnboarding` (Panksepp/Schwartz) — aqui o
 * "esperado" é `string | null` solto (avatar_gender_expected) e o "real" é
 * um objeto estruturado (ClientDemographics['gender']). Três shapes
 * concorrentes para o mesmo conceito de negócio, nenhum marcado como fonte
 * de verdade única.
 */
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

/**
 * ✅ PATCH (DB-03 — guia de implantação): `ClientRow` reescrito conforme
 * schema real de `orbit.clients` (dump SQL citado no guia). Campos como
 * `agency_id`, `is_business_account`, `ctr_threshold_meta`,
 * `benchmark_cpm_l2` não existem na tabela real e foram substituídos pelos
 * campos confirmados abaixo. `ClientDemographics` permanece declarada
 * acima (observação 21 original) para referência de forma, mas o shape
 * "real"/JSON usado aqui é o documentado no guia (`Record<string, number>`
 * / array de `{name, pct}`), não uma referência a `ClientDemographics`.
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
  avatar_gender_real: Record<string, number> | null
  avatar_age_range_real: Record<string, number> | null
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

/**
 * ⚠️ OBSERVAÇÃO (22) — DIVERGÊNCIA NÃO RESOLVIDA: `DashboardHeaderMeta`
 * já existe na Seção 0.1 com `dateRange: { start: Date; end: Date }`. A
 * linhagem v1.0.1 usa `dateRange: { from: string; to: string }`. Não
 * escolhi um — a versão da Seção 0.1 permanece a exportada sob esse nome;
 * este comentário só registra que a segunda forma existe em produção
 * (Documento 4) e não foi reconciliada.
 */

// ⚠️ OBSERVAÇÃO (23): nomes divergentes SEM divergência de shape entre as
// duas linhagens — alias, não merge.
export type InstagramOverviewData = IGOverviewData
export type UseInstagramOverviewReturn = UseInstagramOverviewResult

// ============================================================================
// SEÇÃO 13: FUNIL — TIPOS ESTENDIDOS (Refatoração v2.0)
// ✅ PATCH (Refatoração Funil 06/09/2026): adicionado suporte a Ticket Médio,
// Drop-off, Diagnóstico de Gargalo e CTA de Salvar Meta.
// ============================================================================

/**
 * ✅ NOVO: Estende FunnelMetrics com dados financeiros
 * Ticket Médio (R$) permite calcular Faturamento Estimado (R$)
 */
export interface FunnelMetricsExtended extends FunnelMetrics {
  ticketMedio: number  // R$ — valor médio por venda
  faturamentoEstimado?: number  // R$ — calculado (vendas × ticketMedio)
}

/**
 * ✅ NOVO: Dados de uma etapa do funil com drop-off
 * Usado por FunnelChart para renderizar queda % entre etapas
 */
export interface FunnelStepDataExtended {
  isLast?: boolean
  label: string
  value: number | string // ✅ TICKETS item 7 — '—' quando a etapa não tem dado no período (não confundir com 0 real)
  percentage: number  // relativo à primeira etapa (alcance = 100%)
  color: string  // Token CSS, ex: 'var(--blue)'
  dropoffPct?: number | undefined  // ✅ NOVO: queda % da etapa anterior
  dropoffLabel?: string | undefined  // ✅ NOVO: label legível (ex: "↓ 45.2% queda")
}

/**
 * ✅ NOVO: Diagnóstico de gargalo quando simulação = cenário atual
 * Usado por FunnelResult para exibir ação acionável
 */
export interface BottleneckDiagnosis {
  detected: boolean
  type: 'zero_clicks' | 'zero_conversions' | 'low_ctr' | 'low_conversion' | 'none'
  message: string  // Texto pronto para exibir
  suggestedAction: string  // CTA sugerido
  severity: 'critical' | 'warning' | 'info'
}

/**
 * ✅ NOVO: Meta de funil para salvar
 * Usado por FunnelSimulator para persistir cenário simulado
 */
export interface FunnelGoal {
  id?: string
  clientId: string
  name: string  // Ex: "Meta: 150 vendas/mês"
  description?: string
  targetMetrics: FunnelMetricsExtended
  baselineMetrics: FunnelMetrics
  createdAt: string
  updatedAt?: string
  createdBy?: string
  isActive: boolean
}

/**
 * ✅ NOVO: Resultado de simulação com diagnóstico
 * Estende SimulatedFunnelResult com análise de gargalo
 */
export interface SimulatedFunnelResultExtended extends SimulatedFunnelResult {
  faturamentoSimulado?: number  // R$ — calculado
  bottleneck?: BottleneckDiagnosis
  goalSaveStatus?: 'idle' | 'saving' | 'success' | 'error'
}


// ============================================================================
// FIM DO ARQUIVO (marcador real desta vez — nada é colado depois dele)
// ============================================================================