/* ==========================================================================
   fetchSectorPositioning — card de setor (client_onboarding, direto, sem
   cálculo) + benchmarking das 3 métricas via classifyMetric().

   ⚠️ classifyMetric() hoje NÃO diferencia por categoria/segmento —
   fn_classify_metric(p_metric_name, p_value, p_category, p_tier) tem
   parâmetros de categoria/tier, mas a lógica dentro não os usa para
   filtrar linhas de ref_thresholds (sempre busca 'all'/'all'). O que volta
   aqui é comparação GLOBAL, não "do seu setor", mesmo que setorBenchmark
   diga outra coisa. Não fabrica diferenciação que a função não faz — o
   ruleDeclaration que classifyMetric já devolve já é honesto sobre isso
   ("Comparado ao benchmark global..."). Quando fn_classify_metric for
   corrigida para de fato usar p_category/p_tier (migration futura, fora
   do escopo deste arquivo), esta função não precisa mudar — só a RPC por
   baixo fica mais precisa.

   ⚠️ er_real_pct/vps_pct: mesmos metricName do CASO G
   (resolveEngagementScoreAlert). Não há linha calibrada pra esses nomes
   em nenhuma categoria/tier hoje — vão sempre voltar "classificação
   indisponível". Decisão tomada, não é bug desta função.
   ========================================================================== */

import { supabase } from '@/lib/supabase'
import { repairMojibake } from '@/lib/textRepair'
import { z } from 'zod'

import type {
  IGOverviewData,
  DashboardHeaderMeta,
  KPICardData,
  FormatPerformanceRow,
  QualityScoreItem,
  InsightData,
  SemaphoreColor,
  GlowColor,
  CriticalAlertData,
  SharesSummary,
  PostSummary,
  AudienceSummary,
  ClientOnboarding,
  SectorPositioning,
  ClassifiedMetric,
} from '@/types/orbit'

import {
  resolveEngagementScoreAlert,
  toCriticalAlert,
  mapSegmentToCategory,
  mapFollowersToTier,
  classifyMetric,
} from './contentContractEngine'

type RawRow = Record<string, unknown>

// ── Constantes de configuração ──────────────────────────────────────────

// ✅ CORRIGIDO 08/09 — paridade com o protótipo (screen-ig-overview,
// .grid4): faltava 'cliques-no-link', então o 4º KPICard simplesmente
// nunca renderizava (nunca havia dado pra ele). A ordem do array agora
// também é a ordem de exibição (ver KPI_ORDER abaixo) — antes a ordem
// final dependia de `calculated_at` do banco, por isso os cards saíam em
// ordem diferente da do protótipo (Seguidores → Saldo → Alcance →
// Cliques) a cada carga.
const KPI_METRIC_KEYS = [
  'seguidores-totais',
  'saldo-90-dias',
  'alcance-90d',
  'cliques-no-link',
]

const KPI_ORDER = new Map(KPI_METRIC_KEYS.map((key, index) => [key, index]))

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reels',
  static_post: 'Estático',
  carousel: 'Carrossel',
  story: 'Stories',
  live: 'Live',
  igtv: 'IGTV',
}

const CONFIDENCE_LEVELS = ['L0', 'L1'] as const

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

// ── Schemas (validação de dados do banco) ───────────────────────────────

const KpiRowSchema = z.object({
  id:            z.string(),
  client_id:     z.string(),
  period_start:  z.string().optional(),
  period_end:    z.string().optional(),
  metric_key:    z.string().optional(),
  metric:        z.string().optional(),
  metric_value:  z.union([z.number(), z.string()]).nullable().optional(),
  value:         z.union([z.number(), z.string()]).nullable().optional(),
  delta_pct:     z.union([z.number(), z.string()]).nullable().optional().default(0),
  semaphore:     z.enum(['verde', 'ambar', 'vermelho']).nullable().optional().default('ambar'),
  subtitle:      z.string().nullable().optional().default(null),
  calculated_at: z.string().optional(),
}).refine(
  (data) => data.metric_key || data.metric,
  { message: "Deve ter 'metric_key' ou 'metric'" }
)

type KpiRow = z.infer<typeof KpiRowSchema>

const PostRowRawSchema = z.object({
  id:                  z.string(),
  content_format:      z.string(),
  published_at:        z.string(),
  likes:               z.number().nullable(),
  comments:            z.number().nullable(),
  caption:             z.string().nullable(),
  polemic_score_pct:   z.number().nullable(),
  is_boost_candidate:  z.boolean().nullable(),
  reach:               z.number().nullable(),
})

// ✅ NOVO (06/09/2026): blindagem contra caption com encoding corrompido
// (UTF-8 salvo/lido como Latin-1 em algum ponto do pipeline de ingest —
// causa raiz real fica no script de ingest, fora deste arquivo, mas a
// tela não deve exibir mojibake enquanto isso não for corrigido lá).
// Heurística: só tenta reparar se o texto contém os marcadores típicos de
// mojibake (Ã seguido de outro caractere, ou â€); texto normal em PT-BR
// nunca bate nesse padrão, então não há risco de "reparar" algo que já
// estava certo. Se o "reparo" falhar (texto não era mojibake de verdade),
// devolve o original sem alterar.
// ✅ 09/09 — promovida para util compartilhado (src/lib/textRepair.ts),
// já que o mesmo problema aparece fora deste arquivo (avatarRepository.ts,
// punch list item 7️⃣/real_geo). Mantém o nome local para não reescrever
// todas as chamadas abaixo.
const repairMojibakeCaption = repairMojibake


// ── Mapas de transformação ──────────────────────────────────────────────

const GLOW_MAP: Record<SemaphoreColor, GlowColor> = {
  verde:    'cyan',
  ambar:    'gold',
  vermelho: 'red',
}

// ── Funções de transformação ────────────────────────────────────────────

function kpiRowToCardData(row: KpiRow): KPICardData {
  const key       = row.metric_key ?? row.metric ?? 'unknown'
  const rawVal    = row.metric_value ?? row.value ?? 0
  const numVal    = toFiniteNumber(rawVal)
  const delta     = toFiniteNumber(row.delta_pct)
  const semaphore: SemaphoreColor = (row.semaphore as SemaphoreColor) ?? 'ambar'

  return {
    id:         row.id,
    label:      key.toUpperCase().replace(/-/g, ' '),
    value:      numVal,
    unit:       null,
    delta,
    deltaLabel: `${delta > 0 ? '+' : ''}${delta}%`,
    semaphore,
    glowColor:  GLOW_MAP[semaphore],
    subtitle:   row.subtitle ?? null,
  }
}

function dedupeByMetric(rows: KpiRow[]): KpiRow[] {
  const latestByMetric = new Map<string, KpiRow>()
  for (const row of rows) {
    const key      = row.metric_key ?? row.metric ?? 'unknown'
    const existing = latestByMetric.get(key)
    if (!existing) { latestByMetric.set(key, row); continue }
    const existingTs = existing.calculated_at ? Date.parse(existing.calculated_at) : 0
    const currentTs  = row.calculated_at ? Date.parse(row.calculated_at) : 0
    if (currentTs > existingTs) latestByMetric.set(key, row)
  }
  return Array.from(latestByMetric.values())
}

// ── Interfaces públicas ─────────────────────────────────────────────────

export interface FetchOverviewParams {
  clientId:    string
  periodStart: string
  periodEnd:   string
}

export interface EngagementScoreSnapshot {
  snapshotId: string
  erRealPct: number
  utilityScorePct: number
  polemicScorePct: number
  vpsPct: number
}

interface EngagementScoreSnapshotRow {
  id: string
  er_real_pct: number | null
  utility_score_pct: number | null
  polemic_score_pct: number | null
  reach_total: number | null
  period_end: string
}

// ── Função principal (orquestrador) ─────────────────────────────────────

export async function fetchInstagramOverview(
  params: FetchOverviewParams
): Promise<IGOverviewData> {
  const { clientId, periodStart, periodEnd } = params

  const results = await Promise.allSettled([
    fetchKPIs(clientId, periodStart, periodEnd),
    fetchQualityScores(clientId, periodStart, periodEnd),
    fetchFormatPerformance(clientId, periodStart, periodEnd),
    fetchSharesSummary(clientId, periodStart, periodEnd),
    fetchAudienceSummary(clientId, periodStart, periodEnd),
    fetchCriticalAlerts(clientId, periodStart, periodEnd),
    fetchSectorPositioning(clientId, periodStart, periodEnd),
  ])

  results.forEach((res, idx) => {
    if (res.status === 'rejected') {
      console.error(`[Repository] Query[${idx}] rejeitada:`, res.reason)
    }
  })

  const kpis = results[0].status === 'fulfilled' ? results[0].value : []
  const qualityScores = results[1].status === 'fulfilled' ? results[1].value : []
  const formatPerformance = results[2].status === 'fulfilled' ? results[2].value : []
  const sharesSummary: SharesSummary = results[3].status === 'fulfilled'
    ? results[3].value
    : { total: null, periodLabel: 'erro ao buscar', source: 'account_aggregate' }
  const audienceSummary: AudienceSummary = results[4].status === 'fulfilled'
    ? results[4].value
    : {
        genderFemalePct: null,
        genderMalePct: null,
        genderOtherPct: null,
        topCities: [],
        reachFollowersPct: null,
        profileVisits: null,
        linkClicks: null,
        periodLabel: 'erro ao buscar',
      }
  const criticalAlerts: CriticalAlertData[] = results[5].status === 'fulfilled' ? results[5].value : []
  const positioning: SectorPositioning | null = results[6].status === 'fulfilled'
    ? results[6].value
    : null

  const { data: clientRow, error: clientError } = await supabase
    .schema('orbit')
    .from('clients')
    .select('handle')
    .eq('id', clientId)
    .single()
    .overrideTypes<{ handle: string | null }, { merge: false }>()

  if (clientError || !clientRow) {
    console.warn(`[Repository] Cliente ${clientId} não encontrado em orbit.clients.`)
  }

  const handle = clientRow?.handle ?? clientId

  const meta: DashboardHeaderMeta = {
    clientHandle: `@${handle}`,
    periodLabel:  'Métricas da Extração',
    dateRange: {
      start: new Date(periodStart),
      end:   new Date(periodEnd),
    },
  }

  return {
    meta,
    clients: [],
    kpis,
    qualityScores,
    formatPerformance,
    sharesSummary,
    audienceSummary,
    insights:       generateInsights(formatPerformance),
    criticalAlerts,
    positioning: positioning as SectorPositioning,
  }
}

// ── Funções de busca (queries ao banco) ──────────────────────────────────

async function fetchKPIs(
  clientId: string,
  start: string,
  end: string
): Promise<KPICardData[]> {
  const { data: orbitData, error: orbitError } = await supabase
    .schema('orbit')
    .from('v_kpi_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .lte('period_start', end)
    .gte('period_end', start)
    .in('metric_key', KPI_METRIC_KEYS)
    .order('calculated_at', { ascending: false })
    .returns<RawRow[]>()

  if (orbitError) {
    console.warn(`[fetchKPIs] orbit.v_kpi_snapshots indisponível (${orbitError.message}).`)
    return []
  }

  if (!orbitData) return []

  const parsedRows = orbitData
    .map(row => {
      const parsed = KpiRowSchema.safeParse(row)
      return parsed.success ? parsed.data : null
    })
    .filter((item): item is KpiRow => item !== null)

  // ✅ CORRIGIDO 08/09 — ordena pela ordem canônica do protótipo
  // (KPI_ORDER), não pela ordem de chegada do banco (que seguia
  // `calculated_at desc` e podia embaralhar os 4 cards a cada snapshot
  // novo). Ordenar o KpiRow bruto (por metric_key) antes de mapear pro
  // shape de exibição — mais robusto que tentar recuperar a key a partir
  // do label já formatado. Chave desconhecida (não deveria acontecer, dado
  // o filtro `.in('metric_key', KPI_METRIC_KEYS)` acima) vai pro fim.
  const orderedRows = dedupeByMetric(parsedRows).sort((a, b) => {
    const keyA = a.metric_key ?? a.metric ?? ''
    const keyB = b.metric_key ?? b.metric ?? ''
    const orderA = KPI_ORDER.get(keyA) ?? Number.MAX_SAFE_INTEGER
    const orderB = KPI_ORDER.get(keyB) ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })

  return orderedRows.map(kpiRowToCardData)
}

async function fetchQualityScores(
  clientId: string,
  start: string,
  end: string,
): Promise<QualityScoreItem[]> {
  const glowMap: Record<string, GlowColor> = { ok: 'cyan', warn: 'gold', neutral: 'none' }

  const { data: orbitRows, error: orbitError } = await supabase
    .schema('orbit')
    .from('v_quality_scores')
    .select('id, score_key, score_value, status_text, status_variant, period_start, period_end')
    .eq('client_id', clientId)
    .lte('period_start', end)
    .gte('period_end', start)
    .returns<RawRow[]>()

  if (orbitError) {
    console.error('[fetchQualityScores]', orbitError.message)
    return []
  }

  return (orbitRows ?? []).map(row => ({
    id:            String(row.id),
    label:         String(row.score_key),
    value:         row.score_value != null ? toFiniteNumber(row.score_value) : 'N/A',
    unit:          '',
    statusText:    String(row.status_text ?? 'Sem dados'),
    statusVariant: (row.status_variant as 'ok' | 'warn' | 'neutral') ?? 'neutral',
    glowColor:     (glowMap[String(row.status_variant ?? 'neutral')] ?? 'none') as GlowColor,
  }))
}

export async function fetchPostsByFormat(
  clientId: string,
  start: string,
  end: string
): Promise<Map<string, PostSummary[]>> {
  const byFormat = new Map<string, PostSummary[]>()

  // Resolver handle do cliente (para classificação self_reference)
  const { data: clientRow, error: clientError } = await supabase
    .schema('orbit')
    .from('clients')
    .select('handle')
    .eq('id', clientId)
    .single()
    .overrideTypes<{ handle: string | null }, { merge: false }>()

  if (clientError) {
    console.warn(`[fetchPostsByFormat] Não consegui resolver handle do cliente ${clientId}:`, clientError.message)
  }

  const handle = clientRow?.handle ?? null

  const { data, error } = await supabase
    .schema('orbit')
    .from('ig_posts')
    .select('id, content_format, published_at, likes, comments, caption, polemic_score_pct, is_boost_candidate, reach')
    .eq('client_id', clientId)
    .gte('published_at', start)
    .lte('published_at', end)
    .in('confidence_level', CONFIDENCE_LEVELS)
    .order('published_at', { ascending: false })
    .returns<RawRow[]>()

  if (error) {
    console.error('[fetchPostsByFormat]', error.message)
    return byFormat
  }

  if (!data) return byFormat

  for (const row of data) {
    const parsed = PostRowRawSchema.safeParse(row)
    if (!parsed.success) {
      console.warn('[fetchPostsByFormat] Linha inválida descartada:', parsed.error.message)
      continue
    }

    const post = parsed.data
    const label = FORMAT_LABEL[post.content_format] ?? post.content_format

    // Classificar reach com self_reference (histórico da conta, não mercado global)
    let reachClassification: ClassifiedMetric | null = null
    if (post.reach != null && handle != null) {
      try {
        reachClassification = await classifyMetric('reach', post.reach, 'self_reference', handle)
      } catch (err) {
        console.warn(`[fetchPostsByFormat] Falha ao classificar reach do post ${post.id}:`, err)
        reachClassification = null
      }
    }

    const summary: PostSummary = {
      id: post.id,
      publishedAt: post.published_at,
      likes: post.likes,
      comments: post.comments,
      caption: repairMojibakeCaption(post.caption),
      polemicScorePct: post.polemic_score_pct,
      isBoostCandidate: post.is_boost_candidate ?? false,
      reach: post.reach,
      reachClassification,
    }

    const list = byFormat.get(label) ?? []
    list.push(summary)
    byFormat.set(label, list)
  }

  return byFormat
}

async function fetchFormatPerformance(
  clientId: string,
  start: string,
  end: string
): Promise<FormatPerformanceRow[]> {
  const { data: orbitRows, error: orbitError } = await supabase
    .schema('orbit')
    .from('v_format_performance')
  // ✅ CORRIGIDO 08/09 — save_count já existe na view (confirmado em
  // database.types.ts) mas nunca era selecionado; coluna Saves do
  // protótipo ficava impossível de preencher.
  .select('id, format_name, post_count, share_count, save_count, trend_label, trend_color, period_start, period_end')
    .eq('client_id', clientId)
  .lte('period_start', end)
  .gte('period_end', start)
    .returns<RawRow[]>()

  if (orbitError) {
    console.error('[fetchFormatPerformance]', orbitError.message)
    return []
  }

  const postsByFormat = await fetchPostsByFormat(clientId, start, end)

  return (orbitRows ?? []).map(row => {
    const label = String(row.format_name ?? 'Outros')
    return {
      id:          String(row.id),
      format:      label,
      posts:       toFiniteNumber(row.post_count),
      shares:      toFiniteNumber(row.share_count),
      saves:       toFiniteNumber(row.save_count),
      trendLabel:  String(row.trend_label ?? 'Estável'),
      trendColor:  (row.trend_color as GlowColor) ?? 'gold',
      postsDetail: postsByFormat.get(label) ?? [],
    }
  })
}

async function fetchSharesSummary(
  clientId: string,
  start: string,
  end: string,
): Promise<SharesSummary> {
  const { data, error } = await supabase
    .schema('orbit')
    .from('ig_account_snapshots')
    .select('interactions_shares, period_start, period_end')
    .eq('client_id', clientId)
    .lte('period_start', end)
    .gte('period_end', start)
    .not('interactions_shares', 'is', null)
    .order('period_end', { ascending: false })
    .limit(1)
    .returns<{ interactions_shares: number; period_start: string; period_end: string }[]>()

  if (error || !data || data.length === 0) {
    return { total: null, periodLabel: 'sem dado no período', source: 'account_aggregate' }
  }

  const row = data[0]
  return {
    total: row.interactions_shares,
    periodLabel: `${row.period_start} – ${row.period_end}`,
    source: 'account_aggregate',
  }
}

interface AudienceRowRaw {
  gender_female_pct: number | null
  gender_male_pct: number | null
  gender_other_pct: number | null
  top_cities: { name: string; pct: number }[] | null
  period_start: string
  period_end: string
}

interface AccountReachRowRaw {
  reach_followers_pct: number | null
  profile_visits: number | null
  link_clicks: number | null
}

async function fetchAudienceSummary(
  clientId: string,
  start: string,
  end: string
): Promise<AudienceSummary> {
  const [audienceRes, accountRes] = await Promise.all([
    supabase
      .schema('orbit')
      .from('ig_audience_snapshots')
      .select('gender_female_pct, gender_male_pct, gender_other_pct, top_cities, period_start, period_end')
      .eq('client_id', clientId)
      .lte('period_start', end)
      .gte('period_end', start)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<AudienceRowRaw, { merge: false }>(),
    supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .select('reach_followers_pct, profile_visits, link_clicks')
      .eq('client_id', clientId)
      .lte('period_start', end)
      .gte('period_end', start)
      .not('reach_followers_pct', 'is', null)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<AccountReachRowRaw, { merge: false }>(),
  ])

  const audience = audienceRes.data
  const account  = accountRes.data

  return {
    genderFemalePct: toFiniteNumber(audience?.gender_female_pct),
    genderMalePct: toFiniteNumber(audience?.gender_male_pct),
    genderOtherPct: toFiniteNumber(audience?.gender_other_pct),
    // ✅ CORRIGIDO 09/09 (punch list item 5️⃣) — mesmo reparo de mojibake já
    // aplicado a captions ("SÃ£o Paulo" → "São Paulo"). A causa raiz é no
    // ingest (fora deste repo); isto é mitigação client-side, não o fix
    // definitivo — a query de validação mostrou snapshots com nomes
    // corretos E corrompidos coexistindo, ou seja, o bug do ingest é
    // intermitente, não constante.
    topCities: (audience?.top_cities ?? []).map((city) => ({
      name: repairMojibakeCaption(city.name) ?? city.name,
      pct: toFiniteNumber(city.pct),
    })),
    reachFollowersPct: toFiniteNumber(account?.reach_followers_pct),
    profileVisits: toFiniteNumber(account?.profile_visits),
    linkClicks: toFiniteNumber(account?.link_clicks),
    periodLabel: audience
      ? `${audience.period_start} – ${audience.period_end}`
      : 'sem dado no período',
  }
}

function generateInsights(formats: FormatPerformanceRow[]): InsightData[] {
  return formats
    .filter(f => f.posts > 0 && f.shares > 0)
    .map(f => ({
      id:   `insight-${f.id}`,
      text: `O formato ${f.format} gerou ${f.shares} interações em ${f.posts} publicação(ões).`,
    }))
}

// ── client_onboarding (SSOT único de setor/nicho/porte/audiência) ────────

export async function fetchClientOnboarding(
  clientId: string
): Promise<ClientOnboarding | null> {
  const { data, error } = await supabase
    .schema('orbit')
    .from('client_onboarding')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
    .overrideTypes<ClientOnboarding, { merge: false }>()

  if (error || !data) return null
  return data
}

/* ==========================================================================
   fetchSectorPositioning — card de setor (client_onboarding, direto, sem
   cálculo) + benchmarking das 3 métricas via classifyMetric().

   ⚠️ classifyMetric() hoje NÃO diferencia por categoria/segmento —
   fn_classify_metric(p_metric_name, p_value) não tem parâmetro de
   categoria (confirmado no prosrc real da função). O que volta aqui é
   comparação GLOBAL, não "do seu setor", mesmo que setorBenchmark diga
   outra coisa. Não fabrica diferenciação que a função não faz — o
   ruleDeclaration que classifyMetric já devolve já é honesto sobre isso
   ("Comparado ao benchmark global..."). Quando fn_classify_metric ganhar
   parâmetro de categoria (migration futura, fora do escopo deste arquivo),
   esta função não precisa mudar — só a RPC por baixo fica mais precisa.

   ⚠️ er_real_pct/vps_pct: mesmos metricName do CASO G
   (resolveEngagementScoreAlert). Não há linha calibrada pra esses nomes
   em nenhuma categoria/tier hoje — vão sempre voltar "classificação
   indisponível". Decisão tomada, não é bug desta função.
   ========================================================================== */

export async function fetchSectorPositioning(
  clientId: string,
  start: string,
  end: string,
): Promise<SectorPositioning | null> {
  const [onboarding, snapshot] = await Promise.all([
    fetchClientOnboarding(clientId),
    fetchLatestEngagementScoreSnapshot(clientId, start, end),
  ])

  if (!onboarding) return null

  const category = mapSegmentToCategory(onboarding.setor_benchmark)
  const tier     = mapFollowersToTier(onboarding.total_followers)

  const safeCategory = category ?? 'all'
  const safeTier = tier ?? 'all'

  const [erReal, vps, polemicScore] = snapshot
    ? await Promise.all([
        classifyMetric('er_real_pct', snapshot.erRealPct, safeCategory, safeTier),
        classifyMetric('vps_pct', snapshot.vpsPct, safeCategory, safeTier),
        classifyMetric('polemic_score_pct', snapshot.polemicScorePct, safeCategory, safeTier),
      ])
    : [null, null, null]

  return {
    setorBenchmark: onboarding.setor_benchmark,
    nicho: onboarding.nicho,
    funnelMaturity: onboarding.funnel_maturity,
    proofMechanism: onboarding.proof_mechanism,
    erReal,
    erRealValue: snapshot?.erRealPct ?? null,
    vps,
    vpsValue: snapshot?.vpsPct ?? null,
    polemicScore,
    polemicScoreValue: snapshot?.polemicScorePct ?? null,
    engagementPeriodNotes: onboarding.q1_engagement_period_notes,
    contentProxyNotes: onboarding.q2_content_proxy_notes,
    misalignmentNotes: onboarding.q3_misalignment_notes,
    observedContentClusters: onboarding.observed_content_clusters,
    audienceComposition: {
      nucleoFielPct: onboarding.audience_nucleo_fiel_pct,
      consumoPassivoPct: onboarding.audience_consumo_passivo_pct,
      curiosidadeExternaPct: onboarding.audience_curiosidade_externa_pct,
      altaRotatividadePct: onboarding.audience_alta_rotatividade_pct,
    },
  }
}

// ── CASO G (engagement score) ─────────────────────────────────────────────

async function fetchCriticalAlerts(
  clientId: string,
  start: string,
  end: string,
): Promise<CriticalAlertData[]> {
  try {
    const [snapshot, onboarding] = await Promise.all([
      fetchLatestEngagementScoreSnapshot(clientId, start, end),
      fetchClientOnboarding(clientId),
    ])
    if (!snapshot) return []

    const category = mapSegmentToCategory(onboarding?.setor_benchmark ?? null)
    const tier     = mapFollowersToTier(onboarding?.total_followers ?? null)

    const draft = await resolveEngagementScoreAlert(snapshot, category, tier)

    if (draft.severity === 'info' || draft.severity === 'success') return []

    return [toCriticalAlert(draft)]
  } catch (err) {
    console.error('[fetchCriticalAlerts] falha ao resolver CASO G:', err)
    return []
  }
}

async function fetchTotalFollowers(clientId: string): Promise<number | null> {
  const { data, error } = await supabase
    .schema('orbit')
    .from('client_onboarding')
    .select('total_followers')
    .eq('client_id', clientId)
    .maybeSingle()
    .overrideTypes<{ total_followers: number | null }, { merge: false }>()

  if (error || !data) return null
  return data.total_followers ?? null
}

export async function fetchLatestEngagementScoreSnapshot(
  clientId: string,
  start: string,
  end: string,
): Promise<EngagementScoreSnapshot | null> {
  const [{ data, error }, totalFollowers] = await Promise.all([
    supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .select('id, er_real_pct, utility_score_pct, polemic_score_pct, reach_total, period_end')
      .eq('client_id', clientId)
      .lte('period_start', end)
      .gte('period_end', start)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<EngagementScoreSnapshotRow, { merge: false }>(),
    fetchTotalFollowers(clientId),
  ])

  if (error) {
    throw new Error(
      `[instagramOverviewRepository] falha ao buscar snapshot de engagement score para ${clientId}: ${error.message}`
    )
  }

  if (!data) return null

  const { id, er_real_pct, utility_score_pct, polemic_score_pct, reach_total } = data

  const vpsPct =
    reach_total != null && totalFollowers != null && totalFollowers > 0
      ? Math.round((reach_total / totalFollowers) * 100 * 10000) / 10000
      : null

  if (er_real_pct == null || utility_score_pct == null || polemic_score_pct == null || vpsPct == null) {
    return null
  }

  return {
    snapshotId: id,
    erRealPct: er_real_pct,
    utilityScorePct: utility_score_pct,
    polemicScorePct: polemic_score_pct,
    vpsPct,
  }
}