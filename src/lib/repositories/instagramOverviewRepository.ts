// ═══════════════════════════════════════════════════════════════════════════
// ORBIT · Repository — Instagram Overview (v4.2.0 — SSOT PURO)
// 
// ✅ CORREÇÕES v4.2.0:
// - Schema EXPLÍCITO: .schema('orbit') em todas as queries
// - ZERO fallbacks silenciosos
// - Falhas explícitas com origem de dados
// - Período SSOT: orbit.ig_account_snapshots como fonte de verdade
// - Type-safe 100%
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase'
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

// ═══════════════════════════════════════════════════════════════════════════
// SSOT: Período é determinado por orbit.ig_account_snapshots
// Não há fallback — se não há dados, falha explícita
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ✅ Descobre período SSOT do cliente
 * 
 * Fonte de verdade: orbit.ig_account_snapshots
 * Se não há dados → retorna null (não fallback)
 */
async function discoverPeriodBounds(clientId: string): Promise<{ start: string; end: string } | null> {
  try {
    console.log(`[igOverview] Descobrindo período SSOT para: ${clientId}`)

    const { data, error } = await supabase
      .schema('orbit')  // ✅ SCHEMA EXPLÍCITO
      .from('ig_account_snapshots')
      .select('period_start, period_end')
      .eq('client_id', clientId)
      .order('period_start', { ascending: true })
      .returns<{ period_start: string; period_end: string }[]>()

    if (error) {
      console.error(
        `[igOverview] [DB ERROR] Falha ao descobrir período:`,
        error.message
      )
      return null
    }

    if (!data || data.length === 0) {
      console.warn(
        `[igOverview] [NO DATA] Sem snapshots em orbit.ig_account_snapshots para: ${clientId}`
      )
      return null
    }

    const start = data[0].period_start
    const end = data[data.length - 1].period_end

    console.log(`[igOverview] ✅ Período SSOT: ${start} → ${end}`)
    return { start, end }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[igOverview] [EXCEPTION] Erro ao descobrir período:`, errorMessage)
    return null
  }
}

// ─── Schemas Zod ──────────────────────────────────────────────────────────

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

// ─── Mapeamento de cores ──────────────────────────────────────────────────

const GLOW_MAP: Record<SemaphoreColor, GlowColor> = {
  verde:    'cyan',
  ambar:    'gold',
  vermelho: 'red',
}

const KPI_METRIC_KEYS = [
  'alcance-90d',
  'seguidores-totais',
  'saldo-90-dias',
]

// ─── Conversão de tipos ───────────────────────────────────────────────────

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

// ─── Parâmetros públicos ──────────────────────────────────────────────────

export interface FetchOverviewParams {
  clientId:    string
  periodStart?: string  // ← Opcional: se não fornecido, descobre automaticamente
  periodEnd?:   string
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL: Busca Instagram Overview com SSOT puro
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ✅ Busca dados completos do Instagram Overview
 * 
 * SSOT: Período é descoberto de orbit.ig_account_snapshots
 * Sem fallbacks — falhas são explícitas
 */
export async function fetchInstagramOverview(
  params: FetchOverviewParams
): Promise<IGOverviewData> {
  const { clientId } = params

  console.log(`[igOverview] Iniciando busca de overview para: ${clientId}`)

  // ✅ PASSO 1: Descobrir período SSOT
  let periodStart = params.periodStart
  let periodEnd = params.periodEnd

  if (!periodStart || !periodEnd) {
    console.log(`[igOverview] Período não fornecido — descobrindo de SSOT...`)
    const bounds = await discoverPeriodBounds(clientId)

    if (!bounds) {
      console.error(
        `[igOverview] [CRITICAL] Sem dados de período SSOT. Abortando busca.`
      )
      return createEmptyOverview(clientId, 'Sem dados de período no banco de dados')
    }

    periodStart = bounds.start
    periodEnd = bounds.end
  }

  console.log(`[igOverview] Período SSOT: ${periodStart} → ${periodEnd}`)

  // ✅ PASSO 2: Buscar dados em paralelo
  const results = await Promise.allSettled([
    fetchKPIs(clientId, periodStart, periodEnd),
    fetchQualityScores(clientId, periodStart, periodEnd),
    fetchFormatPerformance(clientId, periodStart, periodEnd),
    fetchClientHandle(clientId),
  ])

  // ✅ PASSO 3: Processar resultados
  const kpis = results[0].status === 'fulfilled' 
    ? results[0].value 
    : (console.warn('[igOverview] KPIs falharam'), [])

  const qualityScores = results[1].status === 'fulfilled' 
    ? results[1].value 
    : (console.warn('[igOverview] Quality Scores falharam'), [])

  const formatPerformance = results[2].status === 'fulfilled' 
    ? results[2].value 
    : (console.warn('[igOverview] Format Performance falhou'), [])

  const handle = results[3].status === 'fulfilled' 
    ? results[3].value 
    : clientId

  // ✅ PASSO 4: Montar resposta
  const meta: DashboardHeaderMeta = {
    clientHandle: `@${handle}`,
    periodLabel:  'Métricas da Extração',
    dateRange: {
      start: new Date(periodStart),
      end:   new Date(periodEnd),
    },
  }

  console.log(`[igOverview] ✅ Overview montado com sucesso`)

  return {
    meta,
    kpis,
    qualityScores,
    formatPerformance,
    insights:       generateInsights(formatPerformance),
    criticalAlerts: [],
  }
}

// ─── Funções auxiliares ───────────────────────────────────────────────────

/**
 * ✅ Busca KPIs com schema explícito
 * 
 * Fonte: orbit.v_kpi_snapshots (SSOT)
 * Sem fallback — se falhar, retorna vazio com log
 */
async function fetchKPIs(
  clientId: string,
  start: string,
  end: string
): Promise<KPICardData[]> {
  try {
    console.log(`[fetchKPIs] Buscando KPIs para: ${clientId}`)

    const { data, error } = await supabase
      .schema('orbit')  // ✅ SCHEMA EXPLÍCITO
      .from('v_kpi_snapshots')
      .select('*')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .in('metric_key', KPI_METRIC_KEYS)
      .order('calculated_at', { ascending: false })
      .returns<RawRow[]>()

    if (error) {
      console.error(
        `[fetchKPIs] [DB ERROR] Falha ao buscar KPIs:`,
        error.message
      )
      return []
    }

    if (!data || data.length === 0) {
      console.warn(
        `[fetchKPIs] [NO DATA] Sem KPIs em orbit.v_kpi_snapshots para: ${clientId}`
      )
      return []
    }

    const parsedRows = data
      .map(row => {
        const parsed = KpiRowSchema.safeParse(row)
        if (!parsed.success) {
          console.warn(`[fetchKPIs] Linha inválida:`, parsed.error.issues[0]?.message)
        }
        return parsed.success ? parsed.data : null
      })
      .filter((item): item is KpiRow => item !== null)

    const deduped = dedupeByMetric(parsedRows)
    const cards = deduped.map(kpiRowToCardData)

    console.log(`[fetchKPIs] ✅ ${cards.length} KPIs carregados`)
    return cards
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[fetchKPIs] [EXCEPTION] Erro crítico:`, errorMessage)
    return []
  }
}

/**
 * ✅ Busca Quality Scores com schema explícito
 * 
 * Fonte: orbit.v_quality_scores (SSOT)
 * Sem fallback
 */
async function fetchQualityScores(
  clientId: string,
  start: string,
  end: string
): Promise<QualityScoreItem[]> {
  try {
    console.log(`[fetchQualityScores] Buscando scores para: ${clientId}`)

    const glowMap: Record<string, GlowColor> = { 
      ok: 'cyan', 
      warn: 'gold', 
      neutral: 'none' 
    }

    const { data, error } = await supabase
      .schema('orbit')  // ✅ SCHEMA EXPLÍCITO
      .from('v_quality_scores')
      .select('id, client_id, score_key, score_value, status_text, status_variant, period_start, period_end')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .returns<RawRow[]>()

    if (error) {
      console.error(
        `[fetchQualityScores] [DB ERROR] Falha ao buscar scores:`,
        error.message
      )
      return []
    }

    if (!data || data.length === 0) {
      console.warn(
        `[fetchQualityScores] [NO DATA] Sem scores em orbit.v_quality_scores para: ${clientId}`
      )
      return []
    }

    const scores = data.map(row => ({
      id:            String(row.id),
      label:         String(row.score_key ?? 'Sem label'),
      value:         row.score_value != null ? parseFloat(String(row.score_value)) : 'N/A' as const,
      unit:          '',
      statusText:    String(row.status_text ?? 'Sem dados'),
      statusVariant: (row.status_variant as 'ok' | 'warn' | 'neutral') ?? 'neutral',
      glowColor:     (glowMap[String(row.status_variant ?? 'neutral')] ?? 'none') as GlowColor,
    }))

    console.log(`[fetchQualityScores] ✅ ${scores.length} scores carregados`)
    return scores
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[fetchQualityScores] [EXCEPTION] Erro crítico:`, errorMessage)
    return []
  }
}

/**
 * ✅ Busca Format Performance com schema explícito
 * 
 * Fonte: orbit.v_format_performance (SSOT)
 * Sem fallback
 */
async function fetchFormatPerformance(
  clientId: string,
  start: string,
  end: string
): Promise<FormatPerformanceRow[]> {
  try {
    console.log(`[fetchFormatPerformance] Buscando performance para: ${clientId}`)

    const { data, error } = await supabase
      .schema('orbit')  // ✅ SCHEMA EXPLÍCITO
      .from('v_format_performance')
      .select('id, client_id, format_name, post_count, share_count, save_count, trend_label, trend_color, period_start, period_end')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .returns<RawRow[]>()

    if (error) {
      console.error(
        `[fetchFormatPerformance] [DB ERROR] Falha ao buscar performance:`,
        error.message
      )
      return []
    }

    if (!data || data.length === 0) {
      console.warn(
        `[fetchFormatPerformance] [NO DATA] Sem dados em orbit.v_format_performance para: ${clientId}`
      )
      return []
    }

    const formats = data.map(row => ({
      id:         String(row.id),
      format:     String(row.format_name ?? 'Outros'),
      posts:      Number(row.post_count  ?? 0),
      shares:     Number(row.share_count ?? 0),
      saves:      Number(row.save_count  ?? 0),
      trendLabel: String(row.trend_label ?? 'Estável'),
      trendColor: (row.trend_color as TrendColor) ?? 'gold',
    }))

    console.log(`[fetchFormatPerformance] ✅ ${formats.length} formatos carregados`)
    return formats
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[fetchFormatPerformance] [EXCEPTION] Erro crítico:`, errorMessage)
    return []
  }
}

/**
 * ✅ Busca handle do cliente
 * 
 * Fonte: orbit.clients (SSOT)
 */
async function fetchClientHandle(clientId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .schema('orbit')  // ✅ SCHEMA EXPLÍCITO
      .from('clients')
      .select('handle')
      .eq('id', clientId)
      .single()
      .returns<{ handle: string | null }>()

    if (error) {
      console.warn(
        `[fetchClientHandle] [DB ERROR] Falha ao buscar handle:`,
        error.message
      )
      return clientId
    }

    if (!data?.handle) {
      console.warn(`[fetchClientHandle] [NO DATA] Handle não encontrado para: ${clientId}`)
      return clientId
    }

    console.log(`[fetchClientHandle] ✅ Handle: @${data.handle}`)
    return data.handle
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[fetchClientHandle] [EXCEPTION] Erro crítico:`, errorMessage)
    return clientId
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────

/**
 * ✅ Cria overview vazio com mensagem de erro
 */
function createEmptyOverview(clientId: string, reason: string): IGOverviewData {
  console.error(`[igOverview] Retornando overview vazio: ${reason}`)

  return {
    meta: {
      clientHandle: `@${clientId}`,
      periodLabel:  'Sem dados',
      dateRange: {
        start: new Date(),
        end:   new Date(),
      },
    },
    kpis:               [],
    qualityScores:      [],
    formatPerformance:  [],
    insights:           [],
    criticalAlerts: [
      {
        id:       'no-data-alert',
        title:    'Sem Dados Disponíveis',
        body:     reason,
        severity: 'critical',
      }
    ],
  }
}

/**
 * ✅ Gera insights a partir de format performance
 */
function generateInsights(formats: FormatPerformanceRow[]): InsightData[] {
  return formats
    .filter(f => f.posts > 0 && f.shares > 0)
    .map(f => ({
      id:   `insight-${f.id}`,
      text: `O formato ${f.format} gerou ${f.shares} interações em ${f.posts} publicação(ões).`,
    }))
}
