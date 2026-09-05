/* ==========================================================================
   ORBIT · Repository — Instagram Overview (v4.2.0)

   v4.2.0 (fechamento de dívidas — 26/08/2026):
   - criticalAlerts deixa de ser hardcoded []: agora chama
     fetchLatestEngagementScoreSnapshot() → resolveEngagementScoreAlert()
     (CASO G, contentContractEngine.ts) → toCriticalAlert(). Só resolvers
     com severity 'warning'/'critical' viram card — 'info'/'success' é
     status saudável, não alerta acionável (ver fetchCriticalAlerts abaixo).
   - fetchLatestEngagementScoreSnapshot: vps_pct deixou de ler a coluna
     GERADA de orbit.ig_account_snapshots (depende de followers_total, que
     é permanentemente NULL por bloqueio de escrita em extract-demographics.ts
     e ingest-insights.ts — fonte não confiável). Passa a computar vps_pct
     com a mesma fórmula que orbit.v_quality_scores já usa com sucesso:
     reach_total / client_onboarding.total_followers * 100. Não reimplementa
     régua nenhuma (só aritmética de input, não threshold) — a classificação
     continua 100% em fn_classify_metric via classifyMetric().
   - Novo fetchSharesSummary(): shares real agregado por conta/período
     (orbit.ig_account_snapshots.interactions_shares), para uso honesto na
     tela — nunca distribuído por post (ig_posts.shares segue null até a
     ingestão ser corrigida; ver ORB-DEBT-043, não fechado por este arquivo).
   - Novo fetchAudienceSummary(): gênero e cidades (ig_audience_snapshots) +
     alcance por seguidor/visitas de perfil/cliques de link
     (ig_account_snapshots), ambos agregados por conta/período, mesma
     disciplina de fetchSharesSummary: pega o snapshot mais recente do
     período, nunca soma múltiplas linhas. Idade (age_*_pct) fica de fora
     até o bug de ingestão (hardcoded 0) ser corrigido — não expor campo
     que hoje é sempre zero fabricado.
   - Novo fetchPostsByFormat(): agrupa posts por formato (reel, carousel, etc)
     com mapeamento de labels e scores de polêmica. Suporta granularidade por
     post (diferente de fetchSharesSummary que é agregado por conta/período).
     Conectado a fetchFormatPerformance via postsDetail (Bug 2).
   - fetchFormatPerformance agora popula postsDetail chamando fetchPostsByFormat
     (Bug 2 — funcionalidade de expansão de linha).
   - fetchPostsByFormat filtra por confidence_level ['L0','L1'] (Bug 1 —
     evita divergência de contagem entre card e lista).

   v4.1.0 (Sprint 2 — REFATORADO):
   - Migrado para schema orbit.*
   - fetchKPIs agora usa orbit.v_kpi_snapshots (primary)
     com fallback para public.kpi_snapshots (legacy Sprint 1)
   - fetchQualityScores usa orbit.v_quality_scores (primary) — SEM "_calculated"
     com fallback para public.v_quality_scores (legacy)
   - fetchFormatPerformance usa orbit.v_format_performance (primary) — SEM "_calculated"
     com fallback para public.v_format_performance (legacy)
   - Header handle: .select('handle') em vez de .select('instagram_account_id')
     (campo correto em orbit.clients — instagram_account_id não existe no orbit)
   - Bounds discovery migrado para orbit.ig_account_snapshots
     com fallback para public.kpi_snapshots
   - ✅ COMENTÁRIOS CORRIGIDOS (removido "_calculated")
   - ✅ COLUNAS VALIDADAS contra dados reais do JSON

   v3.4.0: 'cliques-no-link' removido de KPI_METRIC_KEYS
   v3.3.0: deduplicação por métrica
   ========================================================================== */

import { supabase, supabaseLegacy } from '@/lib/supabase'
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
} from '@/types/orbit'

import { resolveEngagementScoreAlert, toCriticalAlert } from './contentContractEngine'

type RawRow = Record<string, unknown>

// ── Constantes de configuração ──────────────────────────────────────────

const KPI_METRIC_KEYS = [
  'alcance-90d',
  'seguidores-totais',
  'saldo-90-dias',
]

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reels',
  static_post: 'Estático',
  carousel: 'Carrossel',
  story: 'Stories',
  live: 'Live',
  igtv: 'IGTV',
}

const CONFIDENCE_LEVELS = ['L0', 'L1']

// ── Schemas (validação de dados do banco) ───────────────────────────────

const KpiRowSchema = z.object({
  id:            z.string(),
  client_id:     z.string(),
  period_start:  z.string().optional(),
  period_end:    z.string().optional(),
  metric_key:    z.string().optional(),
  metric:        z.string().optional(),
  metric_value:  z.union([z.number(), z.string()]).optional(),
  value:         z.union([z.number(), z.string()]).optional(),
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
  polemic_score_pct:   z.number().nullable(),
})

type PostRowRaw = z.infer<typeof PostRowRawSchema>

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
  const numVal    = typeof rawVal === 'string' ? parseFloat(rawVal) : rawVal
  const delta     = typeof row.delta_pct === 'string'
    ? parseFloat(row.delta_pct)
    : (row.delta_pct ?? 0)
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

// ── Função principal (orquestrador) ─────────────────────────────────────

export async function fetchInstagramOverview(
  params: FetchOverviewParams
): Promise<IGOverviewData> {
  const { clientId, periodStart, periodEnd } = params

  let realStart = periodStart
  let realEnd   = periodEnd

  try {
    const { data: orbitBounds, error: orbitBoundsError } = await supabase
      .from('ig_account_snapshots')
      .select('period_start, period_end')
      .eq('client_id', clientId)
      .order('period_start', { ascending: true })
      .returns<{ period_start: string; period_end: string }[]>()

    if (!orbitBoundsError && orbitBounds && orbitBounds.length > 0) {
      realStart = orbitBounds[0].period_start
      realEnd   = orbitBounds[orbitBounds.length - 1].period_end
    } else {
      const { data: legacyBounds } = await supabaseLegacy
        .from('kpi_snapshots')
        .select('period_start, period_end')
        .eq('client_id', clientId)
        .order('period_start', { ascending: true })
        .returns<{ period_start: string; period_end: string }[]>()

      if (legacyBounds && legacyBounds.length > 0) {
        realStart = legacyBounds[0].period_start
        realEnd   = legacyBounds[legacyBounds.length - 1].period_end
      } else {
        console.warn('[Discovery] Nenhuma safra encontrada em orbit nem legacy.')
      }
    }
  } catch (err) {
    console.error('[Discovery] Falha ao descobrir limites de data:', err)
  }

  const results = await Promise.allSettled([
    fetchKPIs(clientId, realStart, realEnd),
    fetchQualityScores(clientId, realStart, realEnd),
    fetchFormatPerformance(clientId, realStart, realEnd),
    fetchSharesSummary(clientId, realStart, realEnd),
    fetchAudienceSummary(clientId, realStart, realEnd),
    fetchCriticalAlerts(clientId),
  ])

  results.forEach((res, idx) => {
    if (res.status === 'rejected') {
      console.error(`[Repository] Query[${idx}] rejeitada:`, res.reason)
    }
  })

  const kpis              = results[0].status === 'fulfilled' ? results[0].value : []
  const qualityScores     = results[1].status === 'fulfilled' ? results[1].value : []
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

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('handle')
    .eq('id', clientId)
    .single()
    .returns<{ handle: string | null }>()

  if (clientError || !clientRow) {
    console.warn(`[Repository] Cliente ${clientId} não encontrado em orbit.clients.`)
  }

  const handle = clientRow?.handle ?? clientId

  const meta: DashboardHeaderMeta = {
    clientHandle: `@${handle}`,
    periodLabel:  'Métricas da Extração',
    dateRange: {
      start: new Date(realStart),
      end:   new Date(realEnd),
    },
  }

  return {
    meta,
    kpis,
    qualityScores,
    formatPerformance,
    sharesSummary,
    audienceSummary,
    insights:       generateInsights(formatPerformance),
    criticalAlerts,
  }
}

// ── Funções de busca (queries ao banco) ──────────────────────────────────

async function fetchKPIs(
  clientId: string,
  start: string,
  end: string
): Promise<KPICardData[]> {
  const { data: orbitData, error: orbitError } = await supabase
    .from('v_kpi_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)
    .in('metric_key', KPI_METRIC_KEYS)
    .order('calculated_at', { ascending: false })
    .returns<RawRow[]>()

  let rows: RawRow[] | null = orbitData

  if (orbitError) {
    console.warn(`[fetchKPIs] orbit.v_kpi_snapshots indisponível (${orbitError.message}). Fallback legacy...`)

    const { data: fallback, error: fallbackError } = await supabaseLegacy
      .from('kpi_snapshots')
      .select('id, client_id, metric, value, period_start, period_end, calculated_at, semaphore, subtitle, delta_pct')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .in('metric', KPI_METRIC_KEYS)
      .order('calculated_at', { ascending: false })
      .returns<RawRow[]>()

    if (fallbackError) throw new Error(`[fetchKPIs] ${fallbackError.message}`)
    rows = fallback
  }

  if (!rows) return []

  const parsedRows = rows
    .map(row => {
      const parsed = KpiRowSchema.safeParse(row)
      return parsed.success ? parsed.data : null
    })
    .filter((item): item is KpiRow => item !== null)

  return dedupeByMetric(parsedRows).map(kpiRowToCardData)
}

async function fetchQualityScores(
  clientId: string,
  start: string,
  end: string
): Promise<QualityScoreItem[]> {
  const glowMap: Record<string, GlowColor> = { ok: 'cyan', warn: 'gold', neutral: 'none' }

  const { data: orbitRows, error: orbitError } = await supabase
    .from('v_quality_scores')
    .select('id, score_key, score_value, status_text, status_variant')
    .eq('client_id', clientId)
    .returns<RawRow[]>()

  let rows: RawRow[] | null = orbitRows

  if (orbitError) {
    console.warn(`[fetchQualityScores] orbit view indisponível (${orbitError.message}). Fallback legacy...`)

    const { data: calcRows, error: calcError } = await supabaseLegacy
      .from('v_quality_scores')
      .select('id, score_key, score_value, status_text, status_variant')
      .eq('client_id', clientId)
      .returns<RawRow[]>()

    if (!calcError) {
      rows = calcRows
    } else {
      const { data: legacyRows, error: legacyError } = await supabaseLegacy
        .from('v_quality_scores')
        .select('id, score_key, score_value, status_text, status_variant')
        .eq('client_id', clientId)
        .gte('period_start', start)
        .lte('period_end', end)
        .returns<RawRow[]>()

      if (legacyError) { console.error('[fetchQualityScores]', legacyError.message); return [] }
      rows = legacyRows
    }
  }

  return (rows ?? []).map(row => ({
    id:            String(row.id),
    label:         String(row.score_key),
    value:         row.score_value != null ? parseFloat(String(row.score_value)) : 'N/A',
    unit:          '',
    statusText:    String(row.status_text ?? 'Sem dados'),
    statusVariant: (row.status_variant as 'ok' | 'warn' | 'neutral') ?? 'neutral',
    glowColor:     (glowMap[String(row.status_variant ?? 'neutral')] ?? 'none') as GlowColor,
  }))
}

async function fetchPostsByFormat(
  clientId: string,
  start: string,
  end: string
): Promise<Map<string, PostSummary[]>> {
  const byFormat = new Map<string, PostSummary[]>()

  const { data, error } = await supabase
    .from('ig_posts')
    .select('id, content_format, published_at, likes, comments, polemic_score_pct')
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

    const summary: PostSummary = {
      id: post.id,
      publishedAt: post.published_at,
      likes: post.likes,
      comments: post.comments,
      polemicScorePct: post.polemic_score_pct,
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
    .from('v_format_performance')
    .select('id, format_name, post_count, share_count, trend_label, trend_color')
    .eq('client_id', clientId)
    .returns<RawRow[]>()

  let rows: RawRow[] | null = orbitRows

  if (orbitError) {
    console.warn(`[fetchFormatPerformance] orbit view indisponível (${orbitError.message}). Fallback legacy...`)

    const { data: calcRows, error: calcError } = await supabaseLegacy
      .from('v_format_performance')
      .select('id, format_name, post_count, share_count, trend_label, trend_color')
      .eq('client_id', clientId)
      .returns<RawRow[]>()

    if (!calcError) {
      rows = calcRows
    } else {
      const { data: legacyRows, error: legacyError } = await supabaseLegacy
        .from('v_format_performance')
        .select('id, format_name, post_count, share_count, trend_label, trend_color')
        .eq('client_id', clientId)
        .gte('period_start', start)
        .lte('period_end', end)
        .returns<RawRow[]>()

      if (legacyError) { console.error('[fetchFormatPerformance]', legacyError.message); return [] }
      rows = legacyRows
    }
  }

  const postsByFormat = await fetchPostsByFormat(clientId, start, end)

  return (rows ?? []).map(row => {
    const label = String(row.format_name ?? 'Outros')
    return {
      id:          String(row.id),
      format:      label,
      posts:       Number(row.post_count  ?? 0),
      shares:      Number(row.share_count ?? 0),
      trendLabel:  String(row.trend_label ?? 'Estável'),
      trendColor:  (row.trend_color as GlowColor) ?? 'gold',
      postsDetail: postsByFormat.get(label) ?? [],
    }
  })
}

async function fetchSharesSummary(
  clientId: string,
  start: string,
  end: string
): Promise<SharesSummary> {
  const { data, error } = await supabase
    .from('ig_account_snapshots')
    .select('interactions_shares, period_start, period_end')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)
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
      .from('ig_audience_snapshots')
      .select('gender_female_pct, gender_male_pct, gender_other_pct, top_cities, period_start, period_end')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<AudienceRowRaw>(),
    supabase
      .from('ig_account_snapshots')
      .select('reach_followers_pct, profile_visits, link_clicks')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .not('reach_followers_pct', 'is', null)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<AccountReachRowRaw>(),
  ])

  const audience = audienceRes.data
  const account  = accountRes.data

  return {
    genderFemalePct: audience?.gender_female_pct ?? null,
    genderMalePct: audience?.gender_male_pct ?? null,
    genderOtherPct: audience?.gender_other_pct ?? null,
    topCities: audience?.top_cities ?? [],
    reachFollowersPct: account?.reach_followers_pct ?? null,
    profileVisits: account?.profile_visits ?? null,
    linkClicks: account?.link_clicks ?? null,
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

async function fetchCriticalAlerts(clientId: string): Promise<CriticalAlertData[]> {
  try {
    const snapshot = await fetchLatestEngagementScoreSnapshot(clientId)
    if (!snapshot) return []

    const draft = await resolveEngagementScoreAlert(snapshot)

    if (draft.severity === 'info' || draft.severity === 'success') return []

    return [toCriticalAlert(draft)]
  } catch (err) {
    console.error('[fetchCriticalAlerts] falha ao resolver CASO G:', err)
    return []
  }
}

export interface EngagementScoreSnapshot {
  erRealPct: number
  utilityScorePct: number
  polemicScorePct: number
  vpsPct: number
}

interface EngagementScoreSnapshotRow {
  er_real_pct: number | null
  utility_score_pct: number | null
  polemic_score_pct: number | null
  reach_total: number | null
  period_end: string
}

async function fetchTotalFollowers(clientId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('client_onboarding')
    .select('total_followers')
    .eq('client_id', clientId)
    .maybeSingle()
    .returns<{ total_followers: number | null }>()

  if (error || !data) return null
  return data.total_followers ?? null
}

export async function fetchLatestEngagementScoreSnapshot(
  clientId: string
): Promise<EngagementScoreSnapshot | null> {
  const [{ data, error }, totalFollowers] = await Promise.all([
    supabase
      .from('ig_account_snapshots')
      .select('er_real_pct, utility_score_pct, polemic_score_pct, reach_total, period_end')
      .eq('client_id', clientId)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<EngagementScoreSnapshotRow>(),
    fetchTotalFollowers(clientId),
  ])

  if (error) {
    throw new Error(
      `[instagramOverviewRepository] falha ao buscar snapshot de engagement score para ${clientId}: ${error.message}`
    )
  }

  if (!data) return null

  const { er_real_pct, utility_score_pct, polemic_score_pct, reach_total } = data

  const vpsPct =
    reach_total != null && totalFollowers != null && totalFollowers > 0
      ? Math.round((reach_total / totalFollowers) * 100 * 10000) / 10000
      : null

  if (er_real_pct == null || utility_score_pct == null || polemic_score_pct == null || vpsPct == null) {
    return null
  }

  return {
    erRealPct: er_real_pct,
    utilityScorePct: utility_score_pct,
    polemicScorePct: polemic_score_pct,
    vpsPct,
  }
}

export { fetchPostsByFormat }