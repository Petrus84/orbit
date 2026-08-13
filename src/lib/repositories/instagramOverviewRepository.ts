/* ==========================================================================
   ORBIT · Repository — Instagram Overview (v4.1.0)

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
  TrendColor,
} from '../../types/orbit'

// Raw row shapes used by the view queries
interface QualityRow {
  id: string
  score_key: string
  score_value: number | string | null
  status_text?: string | null
  status_variant?: 'ok' | 'warn' | 'neutral' | null
  period_start?: string | null
  period_end?: string | null
}

interface FormatRow {
  id: string
  format_name: string
  post_count: number | null
  share_count: number | null
  trend_label?: string | null
  trend_color?: 'up' | 'down' | 'flat' | null
}

// KPI_METRIC_KEYS: alinhados com as chaves emitidas por orbit.v_kpi_snapshots
const KPI_METRIC_KEYS = [
  'alcance-90d',
  'seguidores-totais',
  'saldo-90-dias',
]

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

const GLOW_MAP: Record<SemaphoreColor, GlowColor> = {
  verde:    'cyan',
  ambar:    'gold',
  vermelho: 'red',
}

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

export interface FetchOverviewParams {
  clientId:    string
  periodStart: string
  periodEnd:   string
}

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
  ])

  results.forEach((res, idx) => {
    if (res.status === 'rejected') {
      console.error(`[Repository] Query[${idx}] rejeitada:`, res.reason)
    }
  })

  const kpis              = results[0].status === 'fulfilled' ? results[0].value : []
  const qualityScores     = results[1].status === 'fulfilled' ? results[1].value : []
  const formatPerformance = results[2].status === 'fulfilled' ? results[2].value : []

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
    insights:       generateInsights(formatPerformance),
    criticalAlerts: [],
  }
}

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
        .returns<unknown[]>()

  let rows: unknown[] | null = orbitData

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
      .returns<unknown[]>()

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
    .returns<QualityRow[]>()

  let rows: QualityRow[] | null = orbitRows

  if (orbitError) {
    console.warn(`[fetchQualityScores] orbit view indisponível (${orbitError.message}). Fallback legacy...`)

    // Fallback: public.v_quality_scores (legacy)
    const { data: calcRows, error: calcError } = await supabaseLegacy
      .from('v_quality_scores')
      .select('id, score_key, score_value, status_text, status_variant')
      .eq('client_id', clientId)
      .returns<QualityRow[]>()

    if (!calcError) {
      rows = calcRows
    } else {
      const { data: legacyRows, error: legacyError } = await supabaseLegacy
        .from('v_quality_scores')
        .select('id, score_key, score_value, status_text, status_variant')
        .eq('client_id', clientId)
        .gte('period_start', start)
        .lte('period_end', end)
        .returns<QualityRow[]>()

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
    .returns<FormatRow[]>()

  let rows: FormatRow[] | null = orbitRows

  if (orbitError) {
    console.warn(`[fetchFormatPerformance] orbit view indisponível (${orbitError.message}). Fallback legacy...`)

    const { data: calcRows, error: calcError } = await supabaseLegacy
      .from('v_format_performance')
      .select('id, format_name, post_count, share_count, trend_label, trend_color')
      .eq('client_id', clientId)
      .returns<FormatRow[]>()

    if (!calcError) {
      rows = calcRows
    } else {
      const { data: legacyRows, error: legacyError } = await supabaseLegacy
        .from('v_format_performance')
        .select('id, format_name, post_count, share_count, trend_label, trend_color')
        .eq('client_id', clientId)
        .gte('period_start', start)
        .lte('period_end', end)
        .returns<FormatRow[]>()

      if (legacyError) { console.error('[fetchFormatPerformance]', legacyError.message); return [] }
      rows = legacyRows
    }
  }

  return (rows ?? []).map(row => ({
    id:         String(row.id),
    format:     String(row.format_name ?? 'Outros'),
    posts:      Number(row.post_count  ?? 0),
    shares:     Number(row.share_count ?? 0),
    trendLabel: String(row.trend_label ?? 'Estável'),
    trendColor: (row.trend_color as TrendColor) ?? 'gold',
  }))
}

function generateInsights(formats: FormatPerformanceRow[]): InsightData[] {
  return formats
    .filter(f => f.posts > 0 && f.shares > 0)
    .map(f => ({
      id:   `insight-${f.id}`,
      text: `O formato ${f.format} gerou ${f.shares} interações em ${f.posts} publicação(ões).`,
    }))
}
