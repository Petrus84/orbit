/* ==========================================================================
   ORBIT · Repository — Instagram Overview (v4.3.3)

   v4.3.3 (remove fallbacks legados mortos, 01/09/2026):
   - v_kpi_snapshots, v_quality_scores, v_format_performance só existem no
     schema orbit — nunca existiram no projeto legado (supabaseLegacy). Os
     fallbacks que tentavam repetir a MESMA query contra supabaseLegacy
     eram código morto: nunca poderiam funcionar, porque essas views nunca
     existiram lá. Removidos. Se a query em orbit falhar, a função degrada
     para lista vazia — não tenta de novo contra um client que
     estruturalmente não tem a view.
   - CONFIDENCE_LEVELS agora com `as const` — sem isso, o TS infere
     `string[]` (tipo largo) e `.in('confidence_level', CONFIDENCE_LEVELS)`
     rejeita porque a coluna espera o enum literal ('L0'|'L1'|'L2').
   - `import { any, z } from 'zod'` corrigido para `import { z } from 'zod'`
     — `any` não é um export de zod, sobrou de edição manual anterior.
   - fetchPostsByFormat exportado diretamente na declaração, em vez de um
     `export { fetchPostsByFormat }` solto no fim do arquivo — elimina o
     erro de "definição circular do alias de importação" causado por chaves
     desalinhadas em edições anteriores.
   - insights volta a usar generateInsights(formatPerformance) em vez de
     array vazio hardcoded.

   v4.3.2 (correção de type safety — .overrideTypes() com merge: false, 01/09/2026):
   - 6 ocorrências de `.overrideTypes<T>()` trocadas por
     `.overrideTypes<T, { merge: false }>()` — resolve TS2322 causado pelo
     merge automático de tipos quando usado com `.maybeSingle()/.single()`.

   v4.3.1 (fechamento de dívida — .returns() → .overrideTypes(), 31/08/2026):
   - 6 ocorrências de `.maybeSingle()/.single().returns<T>()` trocadas por
     `.overrideTypes<T>()`. `PostRowRaw` (type derivado) removido — não
     usado em lugar nenhum do arquivo.

   v4.3.0 (reconciliação category/tier — 31/08/2026):
   - Novo fetchClientOnboarding(): busca a linha completa de
     orbit.client_onboarding do cliente — SSOT único pra setor/nicho/porte/
     audiência.
   - Novo fetchSectorPositioning(): monta SectorPositioning combinando
     client_onboarding + fetchLatestEngagementScoreSnapshot (reaproveitado)
     + classifyMetric() com category/tier resolvidos via
     mapSegmentToCategory/mapFollowersToTier (contentContractEngine.ts).
   - fetchCriticalAlerts agora resolve category/tier do onboarding e passa
     pra resolveEngagementScoreAlert, em vez de classificar sempre no
     fallback global.

   v4.2.0 (fechamento de dívidas — 26/08/2026):
   - criticalAlerts deixa de ser hardcoded []: chama
     fetchLatestEngagementScoreSnapshot() → resolveEngagementScoreAlert()
     (CASO G) → toCriticalAlert().
   - fetchLatestEngagementScoreSnapshot: vps_pct deixou de ler a coluna
     GERADA de ig_account_snapshots (depende de followers_total, sempre
     NULL por bloqueio deliberado em extract-demographics.ts/
     ingest-insights.ts). Passa a computar vps_pct = reach_total /
     client_onboarding.total_followers * 100 — mesma fórmula que
     orbit.v_quality_scores já usa. Classificação continua 100% em
     fn_classify_metric via classifyMetric().
   - Novo fetchSharesSummary(): shares real agregado por conta/período,
     nunca distribuído por post (ig_posts.shares é null até ORB-DEBT-043
     ser fechado).
   - Novo fetchAudienceSummary(): gênero/cidades + alcance por seguidor/
     visitas/cliques, agregados por conta/período, pega o snapshot mais
     recente do período (nunca soma múltiplas linhas). Idade fica de fora
     até o hardcode-zero de ingestão ser corrigido em outro arquivo.
   - Novo fetchPostsByFormat(): agrupa posts por formato, conectado a
     fetchFormatPerformance via postsDetail. Filtra confidence_level
     ['L0','L1'] pra evitar divergência de contagem entre card e lista.

   v4.1.0 (Sprint 2 — REFATORADO):
   - Migrado para schema orbit.*. Header handle via .select('handle')
     (instagram_account_id não existe no orbit).
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

const KPI_METRIC_KEYS = [
  'alcance-90d',
  'seguidores-totais',
  'saldo-90-dias',
  'cliques-no-link',
]

// ✅ 09/09 — REGRESSÃO CORRIGIDA: 'cliques-no-link' tinha sido removido de
// KPI_METRIC_KEYS (fora do .in() da query, a linha nunca voltava do banco)
// e KPI_ORDER (ordenação canônica) tinha desaparecido junto, voltando a
// ordenar por calculated_at desc. Resultado: o 4º KPICard do Overview
// ("Cliques no link") não aparecia mais, mesmo com dado real em
// orbit.v_kpi_snapshots. Ver CHANGELOG_08-09-2026_paridade-protótipo.md,
// item 4 — este era o comportamento correto documentado lá.
const KPI_ORDER = [
  'seguidores-totais',
  'saldo-90-dias',
  'alcance-90d',
  'cliques-no-link',
]

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
})

// ✅ 09/09 — cópia local duplicada removida; usa repairMojibake de
// @/lib/textRepair (mesma função, um único lugar, cobre caption/
// top_cities/real_geo). Ver TICKETS DE CORREÇÃO item 3.


// ── Mapas de transformação ──────────────────────────────────────────────

const GLOW_MAP: Record<SemaphoreColor, GlowColor> = {
  verde:    'cyan',
  ambar:    'gold',
  vermelho: 'red',
  // ✅ NOVO (PR-A): 'neutro' vem de ClassifiedMetric (contentContractEngine.ts),
  // não da view v_kpi_snapshots — mas o Record exige as 4 chaves de
  // SemaphoreColor agora. KPICardData.semaphore hoje só vem do banco
  // ('verde'|'ambar'|'vermelho'); este ramo existe só pra satisfazer o tipo.
  neutro:   'none',
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
    // PR-B / N11 ("Δ 0% 0%"): `delta` já é renderizado por <DeltaText> como
    // seta + percentual (ex.: "↑ 3.1%"). Este `deltaLabel` é o SUBLABEL ao
    // lado, não um segundo valor — interpolar o mesmo % de novo duplicava o
    // número (e no caso delta=0 duplicava literalmente "0% 0%"). Texto fixo
    // de comparação, sem repetir o dado.
    deltaLabel: 'vs período anterior',
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

// Ordena pela ordem canônica do protótipo (KPI_ORDER), não pela ordem de
// chegada do banco — sem isso os cards embaralham a cada snapshot novo
// porque a query vem ordenada por calculated_at desc.
function sortByCanonicalOrder(rows: KpiRow[]): KpiRow[] {
  return [...rows].sort((a, b) => {
    const keyA = a.metric_key ?? a.metric ?? 'unknown'
    const keyB = b.metric_key ?? b.metric ?? 'unknown'
    const idxA = KPI_ORDER.indexOf(keyA)
    const idxB = KPI_ORDER.indexOf(keyB)
    return (idxA === -1 ? KPI_ORDER.length : idxA) - (idxB === -1 ? KPI_ORDER.length : idxB)
  })
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

  // ✅ DIAGNÓSTICO COMPLETO
  console.log('[fetchInstagramOverview] Iniciando busca de cliente:', {
    clientId,
    clientIdTrimmed: clientId?.trim(),
    clientIdLength: clientId?.length,
    clientIdType: typeof clientId,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
  })

  const normalizedClientId = clientId?.trim()

  const { data: clientRow, error: clientError } = await supabase
    .schema('orbit')
    .from('clients')
    .select('handle')
    .eq('id', normalizedClientId)
    .maybeSingle()
    .overrideTypes<{ handle: string | null }, { merge: false }>()

  // ✅ LOG DETALHADO DO RESULTADO
  console.log('[fetchInstagramOverview] Resultado da query:', {
    clientId: normalizedClientId,
    dataReceived: clientRow,
    errorCode: clientError?.code,
    errorMessage: clientError?.message,
    errorDetails: clientError?.details,
    errorHint: clientError?.hint,
  })

  if (clientError) {
    console.error('[Repository] Erro ao buscar cliente:', {
      code: clientError.code,
      message: clientError.message,
      details: clientError.details,
      hint: clientError.hint,
      clientId: normalizedClientId,
    })
  }

  const handle = clientRow?.handle ?? normalizedClientId  // ← ÚNICA DEFINIÇÃO

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

  return sortByCanonicalOrder(dedupeByMetric(parsedRows)).map(kpiRowToCardData)
}

// PR-B / N8: ER Real, VPS e Utilidade não têm tarifário setorial hoje (ver
// Documento Técnico v8.2 §1.6 — só `polemic_score_pct` tem as 7 espécies do
// enum). Sem isso, o card mostrava o texto neutro genérico da view como se
// fosse "sem dados", quando na verdade o dado existe e só falta régua de
// comparação por setor. PROIBIDO: gravar um limiar fantasma pra essas
// métricas em orbit.ref_thresholds só pra o semáforo acender — isso é
// decisão fechada (gap #2), não implementada aqui.
const SCORE_KEYS_WITHOUT_SECTOR_TARIFARIO: readonly string[] = [
  'er_real_pct',
  'vps_pct',
  'utility_score_pct',
]

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

  return (orbitRows ?? []).map(row => {
    const scoreKey = String(row.score_key)
    return {
      id:    String(row.id),
      label: scoreKey,
      value: row.score_value != null ? toFiniteNumber(row.score_value) : 'N/A',
      // Todas as métricas deste painel são "%" (ER Real, Utilidade, VPS,
      // Polêmica) — unit vazia fazia o GlowingNumber renderizar o número
      // sem unidade nenhuma.
      unit: '%',
      statusText: SCORE_KEYS_WITHOUT_SECTOR_TARIFARIO.includes(scoreKey)
        ? 'sem recorte setorial'
        : String(row.status_text ?? 'Sem dados'),
      statusVariant: (row.status_variant as 'ok' | 'warn' | 'neutral') ?? 'neutral',
      glowColor: (glowMap[String(row.status_variant ?? 'neutral')] ?? 'none') as GlowColor,
    }
  })
}

export async function fetchPostsByFormat(
  clientId: string,
  start: string,
  end: string
): Promise<Map<string, PostSummary[]>> {
  const byFormat = new Map<string, PostSummary[]>()

  const { data, error } = await supabase
    .schema('orbit')
    .from('ig_posts')
    .select('id, content_format, published_at, likes, comments, caption, polemic_score_pct, is_boost_candidate')
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
      caption: repairMojibake(post.caption),
      polemicScorePct: post.polemic_score_pct,
      isBoostCandidate: post.is_boost_candidate ?? false,
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
  .select('id, format_name, post_count, share_count, trend_label, trend_color, period_start, period_end')
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
  if (!row) {
    return { total: null, periodLabel: 'sem dado no período', source: 'account_aggregate' }
  }
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
      // ✅ 09/09 — REGRESSÃO CORRIGIDA: o .not('reach_followers_pct', 'is', null)
      // que existia aqui descartava a linha inteira (inclusive profile_visits e
      // link_clicks, que vêm preenchidos de forma independente na ingestão —
      // ver EXTERNAL_LINK_TAPS/PROFILE_VISITS_FROM em ingest-from-zip.ts) sempre
      // que só reach_followers_pct estivesse nulo (export sem a chave
      // REACH_FROM_FOLLOWERS_PCT). Efeito visível: "Cliques no link" some do
      // AudienceSummaryPanel mesmo com dado real no snapshot mais recente.
      // Basta pegar o snapshot mais recente do período, sem exigir esse campo.
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
    topCities: (audience?.top_cities ?? []).map((city) => ({
      name: repairMojibake(city.name) ?? city.name,
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