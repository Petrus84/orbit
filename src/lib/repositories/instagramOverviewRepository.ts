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
} from '@/types/orbit'

import { resolveEngagementScoreAlert, toCriticalAlert } from './contentContractEngine'

type RawRow = Record<string, unknown>

// ── Constantes de configuração ──────────────────────────────────────────

// KPI_METRIC_KEYS: alinhados com as chaves emitidas por orbit.v_kpi_snapshots
const KPI_METRIC_KEYS = [
  'alcance-90d',
  'seguidores-totais',
  'saldo-90-dias',
]

// FORMAT_LABEL: mapeamento de content_format (banco) → label (UI)
// Usado em fetchPostsByFormat para tradução de formatos de post
const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reels',
  static_post: 'Estático',
  carousel: 'Carrossel',
  story: 'Stories',
  live: 'Live',
  igtv: 'IGTV',
}

// CONFIDENCE_LEVELS: filtro de qualidade de dados de posts
// L0, L1 = confiança alta; L2+ = descartados (fonte não validada)
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
  // semaphore: apenas valores aceitos pelo enum Zod — 'info' seria descartado silenciosamente
  semaphore:     z.enum(['verde', 'ambar', 'vermelho']).nullable().optional().default('ambar'),
  subtitle:      z.string().nullable().optional().default(null),
  calculated_at: z.string().optional(),
}).refine(
  (data) => data.metric_key || data.metric,
  { message: "Deve ter 'metric_key' ou 'metric'" }
)

type KpiRow = z.infer<typeof KpiRowSchema>

// PostRowRaw: schema para linhas brutas de ig_posts (antes de transformação)
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

  // ── Bounds discovery: tenta orbit primeiro, cai para legacy ──────────────
  try {
    const { data: orbitBounds, error: orbitBoundsError } = await supabase
      .from('ig_account_snapshots')          // orbit.ig_account_snapshots
      .select('period_start, period_end')
      .eq('client_id', clientId)
      .order('period_start', { ascending: true })
      .returns<{ period_start: string; period_end: string }[]>()

    if (!orbitBoundsError && orbitBounds && orbitBounds.length > 0) {
      realStart = orbitBounds[0].period_start
      realEnd   = orbitBounds[orbitBounds.length - 1].period_end
    } else {
      // Fallback para public.kpi_snapshots (legacy Sprint 1)
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
  const criticalAlerts: CriticalAlertData[] = results[4].status === 'fulfilled' ? results[4].value : []

  // ── Header: busca handle em orbit.clients (campo correto) ────────────────
  // MUDANÇA v4.0.0: 'instagram_account_id' → 'handle'
  // (instagram_account_id não existe em orbit.clients)
  const { data: clientRow, error: clientError } = await supabase
    .from('clients')                         // orbit.clients
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
  // Primary: orbit.v_kpi_snapshots
  const { data: orbitData, error: orbitError } = await supabase
    .from('v_kpi_snapshots')               // orbit.v_kpi_snapshots (sem _calculated)
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

    // Fallback: public.kpi_snapshots (legacy Sprint 1)
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

  // Primary: orbit.v_quality_scores (SEM "_calculated")
  const { data: orbitRows, error: orbitError } = await supabase
    .from('v_quality_scores')   // orbit.v_quality_scores (SEM "_calculated")
    .select('id, score_key, score_value, status_text, status_variant')
    .eq('client_id', clientId)
    .returns<RawRow[]>()

  let rows: RawRow[] | null = orbitRows

  if (orbitError) {
    console.warn(`[fetchQualityScores] orbit view indisponível (${orbitError.message}). Fallback legacy...`)

    // Fallback: public.v_quality_scores (legacy)
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

/* ==========================================================================
   fetchPostsByFormat — agrupa posts por formato (reel, carousel, etc)
   com mapeamento de labels (FORMAT_LABEL) e scores de polêmica.
   Diferente de fetchSharesSummary (agregado por conta/período), esta
   função retorna granularidade por post individual, permitindo análise
   de performance por formato e por publicação.

   Retorna Map<string, PostSummary[]> onde:
   - Chave: label do formato (ex: "Reels", "Carrossel")
   - Valor: array de posts daquele formato, ordenados por data decrescente

   ⚠️ FILTRO confidence_level (Bug 1): filtra por ['L0','L1'] para garantir
   consistência de contagem entre card (fetchFormatPerformance) e lista
   (fetchPostsByFormat). Sem esse filtro, card e lista divergem.

   ⚠️ NOTA: ig_posts.shares segue null até correção de ingestão (ORB-DEBT-043).
   Não incluído em PostSummary — use fetchSharesSummary para agregado real.
   ========================================================================== */

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
    // Valida linha com schema
    const parsed = PostRowRawSchema.safeParse(row)
    if (!parsed.success) {
      console.warn('[fetchPostsByFormat] Linha inválida descartada:', parsed.error.message)
      continue
    }

    const post = parsed.data

    // Mapeia content_format para label legível (ex: "reel" → "Reels")
    const label = FORMAT_LABEL[post.content_format] ?? post.content_format

    // Transforma para PostSummary (camelCase) — importado de @/types/orbit
    const summary: PostSummary = {
      id: post.id,
      publishedAt: post.published_at,
      likes: post.likes,
      comments: post.comments,
      polemicScorePct: post.polemic_score_pct,
    }

    // Agrupa por formato
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
  // Primary: orbit.v_format_performance (SEM "_calculated")
  const { data: orbitRows, error: orbitError } = await supabase
    .from('v_format_performance') // orbit.v_format_performance (SEM "_calculated")
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

  // Bug 2: Busca posts detalhados por formato para expansão de linha
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

/* ==========================================================================
   fetchSharesSummary — shares real, agregado por conta/período
   (orbit.ig_account_snapshots.interactions_shares). Existe pra sustentar a
   tela sem forçar granularidade por post que a fonte não tem (ig_posts.shares
   é null hoje, ORB-DEBT-043 — não fechado por este arquivo, é dívida de
   ingest-from-zip.ts). Pega o snapshot mais recente do período com o campo
   preenchido, não soma múltiplas linhas (períodos de snapshot se sobrepõem
   no schema real — somar duplicaria contagem).
   ========================================================================== */

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

function generateInsights(formats: FormatPerformanceRow[]): InsightData[] {
  return formats
    .filter(f => f.posts > 0 && f.shares > 0)
    .map(f => ({
      id:   `insight-${f.id}`,
      text: `O formato ${f.format} gerou ${f.shares} interações em ${f.posts} publicação(ões).`,
    }))
}

/* ==========================================================================
   fetchCriticalAlerts — fecha o hardcoded criticalAlerts: [] que existia
   desde antes desta revisão. Chama fetchLatestEngagementScoreSnapshot()
   (abaixo) → resolveEngagementScoreAlert() (CASO G, contentContractEngine.ts)
   → toCriticalAlert(). Não é 1:1 direto: o resolver também pode concluir
   "Engajamento saudável" (severity 'info'/'success') — isso é status, não
   alerta acionável, e não vira card. Essa filtragem é decisão própria desta
   função, não do Content Contract nem do resolver — documentado aqui pra
   não ser assumido silenciosamente em outro lugar.
   ========================================================================== */

async function fetchCriticalAlerts(clientId: string): Promise<CriticalAlertData[]> {
  try {
    const snapshot = await fetchLatestEngagementScoreSnapshot(clientId)
    if (!snapshot) return [] // sem os 4 campos completos — REGRA-11, não roda o resolver sobre input parcial

    const draft = await resolveEngagementScoreAlert(snapshot)

    if (draft.severity === 'info' || draft.severity === 'success') return []

    return [toCriticalAlert(draft)]
  } catch (err) {
    console.error('[fetchCriticalAlerts] falha ao resolver CASO G:', err)
    return []
  }
}

/* ==========================================================================
   fetchLatestEngagementScoreSnapshot — conexão pro CASO G do Content
   Contract Engine (resolveEngagementScoreAlert / contentContractEngine.ts).

   ⚠️ Decisão de camada: este arquivo NÃO importa `EngagementScoreInput` de
   contentContractEngine.ts. Repository não deve depender de tipo de camada
   de negócio (five-layer architecture: Screen → Hook → Repository →
   Supabase → DB) — o inverso já acontece em outros pontos do projeto
   (ex: alertsRepository.ts importa AlertDraft do engine), mas isso é uma
   exceção já aceita pra escrita de alertas, não motivo pra replicar aqui
   também. `EngagementScoreSnapshot` abaixo é estruturalmente idêntico a
   `EngagementScoreInput` — TypeScript aceita a passagem direta pro resolver
   por tipagem estrutural, sem acoplamento de import.

   ⚠️ CORREÇÃO (fechamento 26/08/2026): vps_pct deixou de vir direto de
   orbit.ig_account_snapshots.vps_pct. Essa é uma coluna GENERATED que
   depende de followers_total NA MESMA TABELA — e followers_total é
   permanentemente NULL (bloqueio deliberado de escrita em
   extract-demographics.ts:287 e ingest-insights.ts:260, fonte considerada
   não confiável). Ler essa coluna aqui fazia vps_pct ser sempre null pra
   este resolver, mesmo quando orbit.v_quality_scores (outra view, mesma
   métrica) já produzia valor real via join com
   orbit.client_onboarding.total_followers — fonte confiável, alimentada no
   onboarding do cliente. Esta função agora replica esse mesmo cálculo
   (reach_total / total_followers * 100), não a coluna gerada. Isso NÃO é
   reimplementar régua/threshold — é aritmética de input, igual ao que a
   view já faz; a classificação continua 100% em fn_classify_metric via
   classifyMetric() dentro do engine.

   ⚠️ Nomes de coluna (er_real_pct, utility_score_pct, polemic_score_pct)
   vêm do comentário do próprio contentContractEngine.ts (CASO G,
   "Scores de orbit.ig_account_snapshots") — não foram confirmados aqui
   contra dump_orbit.sql, que não estava disponível nesta sessão. Se algum
   nome divergir, o Supabase retorna erro explícito (`error.message` abaixo)
   em vez de mascarar — não inventa valor pra coluna que não existe.

   ⚠️ REGRA-11: se QUALQUER um dos 4 campos (er_real_pct, utility_score_pct,
   polemic_score_pct, vps_pct calculado) vier `null`, a função devolve `null`
   inteiro em vez de montar um input parcial com zero fabricado —
   resolveEngagementScoreAlert não deve rodar sobre dado incompleto
   disfarçado de completo. O caller (fetchCriticalAlerts acima;
   syncClientAlerts.ts em outro fluxo) decide o que fazer com `null` (hoje:
   não gera alerta pra esse caso).
   ========================================================================== */

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
  // Fonte confiável de followers (onboarding manual), a mesma que
  // orbit.v_quality_scores já usa via join. Query separada em vez de embed
  // do PostgREST (client_onboarding(...)) de propósito: embed depende do
  // PostgREST reconhecer a FK no schema cache, não confirmado nesta sessão
  // — duas queries simples é o caminho que não depende dessa confirmação.
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
      .from('ig_account_snapshots')          // orbit.ig_account_snapshots
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

  if (!data) return null // sem nenhuma linha para o cliente ainda — não fabricar snapshot vazio

  const { er_real_pct, utility_score_pct, polemic_score_pct, reach_total } = data

  const vpsPct =
    reach_total != null && totalFollowers != null && totalFollowers > 0
      ? Math.round((reach_total / totalFollowers) * 100 * 10000) / 10000
      : null

  if (er_real_pct == null || utility_score_pct == null || polemic_score_pct == null || vpsPct == null) {
    // REGRA-11: um ou mais dos 4 campos ausentes (vps_pct calculado incluso)
    // — não roda o resolver sobre input parcial.
    return null
  }

  return {
    erRealPct: er_real_pct,
    utilityScorePct: utility_score_pct,
    polemicScorePct: polemic_score_pct,
    vpsPct,
  }
}

// ── Exports públicos ────────────────────────────────────────────────────

export { fetchPostsByFormat }