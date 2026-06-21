/* ==========================================================================
   ORBIT · Repository — Instagram Overview (v3.2.0)
   
   v3.2.0: Prototype/mock completamente removido.
           fetchInstagramOverview sempre lê do Supabase real.
   ========================================================================== */

import { supabase } from '../../lib/supabaseClient'
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

type RawRow = Record<string, unknown>

const KPI_METRIC_KEYS = [
  'alcance-90d',
  'cliques-no-link',
  'seguidores-totais',
  'saldo-90-dias',
]

const KpiRowSchema = z.object({
  id:            z.string(),
  client_id:     z.string(),
  period_start:  z.string(),
  period_end:    z.string(),
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

  try {
    const { data: bounds, error: boundsError } = await supabase
      .from('kpi_snapshots')
      .select('period_start, period_end')
      .eq('client_id', clientId)
      .order('period_start', { ascending: true })
      .returns<{ period_start: string; period_end: string }[]>()

    if (!boundsError && bounds && bounds.length > 0) {
      realStart = bounds[0].period_start
      realEnd   = bounds[bounds.length - 1].period_end
    } else {
      console.warn('[Discovery] Nenhuma safra encontrada. Usando período informado como fallback.')
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

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('instagram_account_id')
    .eq('id', clientId)
    .single()
    .returns<{ instagram_account_id: string | null }>()

  if (clientError || !clientRow) {
    console.warn(`[Repository] Cliente ${clientId} não encontrado no banco.`)
  }

  const handle = clientRow?.instagram_account_id ?? clientId

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

async function fetchKPIs(clientId: string, start: string, end: string): Promise<KPICardData[]> {
  const { data: rawData, error } = await supabase
    .from('v_kpi_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)
    .in('metric_key', KPI_METRIC_KEYS)
    .order('calculated_at', { ascending: false })
    .returns<RawRow[]>()

  let rows: RawRow[] | null = rawData

  if (error) {
    console.warn(`[fetchKPIs] View indisponível (${error.message}). Fallback para tabela base...`)

    const { data: fallback, error: fallbackError } = await supabase
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

  return rows
    .map(row => {
      const parsed = KpiRowSchema.safeParse(row)
      return parsed.success ? kpiRowToCardData(parsed.data) : null
    })
    .filter((item): item is KPICardData => item !== null)
}

async function fetchQualityScores(clientId: string, start: string, end: string): Promise<QualityScoreItem[]> {
  const { data: rows, error } = await supabase
    .from('v_quality_scores')
    .select('id, score_key, score_value, status_text, status_variant')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)
    .returns<RawRow[]>()

  if (error) {
    console.error('[fetchQualityScores] Erro:', error.message)
    return []
  }

  const glowMap: Record<string, GlowColor> = { ok: 'cyan', warn: 'gold', neutral: 'none' }

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

async function fetchFormatPerformance(clientId: string, start: string, end: string): Promise<FormatPerformanceRow[]> {
  const { data: rows, error } = await supabase
    .from('v_format_performance')
    .select('id, format_name, post_count, share_count, trend_label, trend_color')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)
    .returns<RawRow[]>()

  if (error) {
    console.error('[fetchFormatPerformance] Erro:', error.message)
    return []
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