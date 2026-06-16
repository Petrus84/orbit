/* ==========================================================================
   ORBIT · Repository — Instagram Overview (v1.4.0 — CORREÇÕES COMPLETAS)
   Camada: [Supabase] ➔ [Bounds Discovery] ➔ [Views Otimizadas]
   
   CORREÇÕES APLICADAS:
   1. kpiRowToCardData() retorna KPICardData com TODOS os campos ✅
   2. fetchQualityScores() mapeia corretamente para QualityScoreItem[] ✅
   3. fetchFormatPerformance() usa TrendColor válido (sem 'green') ✅
   4. KpiRowSchema com validação .refine() para garantir metric_key OU metric ✅
   5. Tratamento de erro para clientRow (pode ser null) ✅
   ========================================================================== */
import { supabase } from '../lib/supabaseClient'
import { z } from 'zod'
import type { 
  InstagramOverviewData, 
  DashboardHeaderMeta, 
  KPICardData,
  FormatPerformanceRow,
  QualityScoreItem,
  InsightData,
  SemaphoreColor,
  GlowColor,
  TrendColor
} from '../types/orbit'

const KPI_METRIC_KEYS = ['alcance-90d', 'cliques-no-link', 'seguidores-totais', 'saldo-90-dias']

// CORREÇÃO 4: Schema Zod com validação .refine() ✅
const KpiRowSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  metric_key: z.string().optional(),
  metric: z.string().optional(),
  metric_value: z.union([z.number(), z.string()]).optional(),
  value: z.union([z.number(), z.string()]).optional(),
  delta_pct: z.union([z.number(), z.string()]).nullable().optional().default(0),
  semaphore: z.enum(['verde', 'ambar', 'vermelho']).nullable().optional().default('ambar'),
  subtitle: z.string().nullable().optional().default(null),
  calculated_at: z.string().optional()
}).refine(
  (data) => data.metric_key || data.metric,
  { message: "Deve ter 'metric_key' ou 'metric'" }
)

type KpiRow = z.infer<typeof KpiRowSchema>

// CORREÇÃO 1: Função retorna KPICardData com TODOS os campos obrigatórios ✅
function kpiRowToCardData(row: KpiRow): KPICardData {
  const key = row.metric_key ?? row.metric ?? 'unknown'
  const rawVal = row.metric_value ?? row.value ?? 0
  const numericVal = typeof rawVal === 'string' ? parseFloat(rawVal) : rawVal
  const delta = typeof row.delta_pct === 'string' ? parseFloat(row.delta_pct) : (row.delta_pct ?? 0)

  // Mapear semaphore para glowColor
  const glowColorMap: Record<SemaphoreColor, GlowColor> = {
    'verde': 'cyan',
    'ambar': 'gold',
    'vermelho': 'red'
  }

  return {
    id: row.id,
    label: key.toUpperCase().replace(/-/g, ' '),
    value: numericVal,
    unit: null, // ADICIONADO ✅
    delta: delta, // ADICIONADO ✅
    deltaLabel: `${delta > 0 ? '+' : ''}${delta}%`,
    semaphore: (row.semaphore as SemaphoreColor) ?? 'ambar', // RENOMEADO de 'status' ✅
    glowColor: glowColorMap[(row.semaphore as SemaphoreColor) ?? 'ambar'], // ADICIONADO ✅
    subtitle: row.subtitle ?? null // CORRIGIDO para null ✅
  }
}

export interface FetchOverviewParams {
  clientId: string
  periodStart: string
  periodEnd: string
  usePrototypeData?: boolean
}

// ─── FUNÇÃO PRINCIPAL COM DISCOVERY DE SAFRA ───────────────────────────────
export async function fetchInstagramOverview(
  params: FetchOverviewParams
): Promise<InstagramOverviewData> {
  const { clientId, periodStart, periodEnd, usePrototypeData = false } = params

  console.log('🔍 [Repository] Parâmetros recebidos na inicialização:', { clientId, usePrototypeData })

  if (usePrototypeData) {
    console.log('🧪 [Repository] Modo Prototype — Retornando dados simulados')
    return getPrototypeData(clientId, periodStart, periodEnd)
  }

  // ✅ Declarar ANTES do try/catch
let realStart: string = periodStart  // Fallback: usar parâmetro
let realEnd: string = periodEnd      // Fallback: usar parâmetro

try {
  const { data: bounds, error: boundsError } = await supabase
    .from('kpi_snapshots')
    .select('period_start, period_end')
    .eq('client_id', clientId)
    .order('period_start', { ascending: true })

  if (!boundsError && bounds && bounds.length > 0) {
    realStart = bounds[0].period_start  // ✅ Agora realStart existe
    realEnd = bounds[bounds.length - 1].period_end  // ✅ Agora realEnd existe
    } else {
      console.warn('⚠️ [Discovery] Nenhuma safra encontrada no banco. Aplicando fallback de segurança largo.')
    }
  } catch (err) {
    console.error('❌ [Discovery] Falha crítica ao descobrir limites de data:', err)
  }

  console.log(`🔥 [Repository] Buscando Supabase real no intervalo: ${realStart} ➔ ${realEnd}`)

  // Chamada paralela tolerante a falhas (Promise.allSettled)
  const results = await Promise.allSettled([
    fetchKPIs(clientId, realStart, realEnd),
    fetchQualityScores(clientId, realStart, realEnd),
    fetchFormatPerformance(clientId, realStart, realEnd)
  ])

  results.forEach((res, idx) => {
    if (res.status === 'rejected') {
      console.error(`❌ Query [${idx}] falhou/rejeitou:`, res.reason)
    }
  })

  const kpis = results[0].status === 'fulfilled' ? results[0].value : []
  const qualityScores = results[1].status === 'fulfilled' ? results[1].value : []
  const formatPerformance = results[2].status === 'fulfilled' ? results[2].value : []

  // CORREÇÃO 5: Busca do Handle Real com tratamento de erro ✅
  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('instagram_account_id')
    .eq('id', clientId)
    .single()

  if (clientError || !clientRow) {
    console.warn(`⚠️ Cliente ${clientId} não encontrado. Usando fallback.`)
  }

  const handle = clientRow?.instagram_account_id ?? clientId
  const meta: DashboardHeaderMeta = {
    clientHandle: `@${handle}`,
    periodLabel: 'Métricas da Extração',
    dateRange: { from: realStart, to: realEnd }
  }

  return {
    meta,
    kpis,
    qualityScores,
    formatPerformance,
    insights: generateInsights(formatPerformance),
    criticalAlerts: []
  }
}

// ─── CONSULTA DE KPIS COM FALLBACK TÁTICO E ORDENAÇÃO POR CALCULATED_AT ───
async function fetchKPIs(clientId: string, start: string, end: string): Promise<KPICardData[]> {
  let response = await supabase
    .from('v_kpi_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)
    .in('metric_key', KPI_METRIC_KEYS)
    .order('calculated_at', { ascending: false })

  if (response.error) {
    console.warn(`⚠️ View v_kpi_snapshots indisponível (${response.error.message}). Acionando fallback...`)
    response = await supabase
      .from('kpi_snapshots')
      .select('id, client_id, metric, value, period_start, period_end, source_level, calculated_at, semaphore, subtitle, delta_pct')
      .eq('client_id', clientId)
      .gte('period_start', start)
      .lte('period_end', end)
      .in('metric', KPI_METRIC_KEYS)
      .order('calculated_at', { ascending: false })
  }

  if (response.error) throw new Error(`[fetchKPIs] ${response.error.message}`)
  if (!response.data) return []

  return response.data
    .map(row => {
      const parsed = KpiRowSchema.safeParse(row)
      return parsed.success ? kpiRowToCardData(parsed.data) : null
    })
    .filter((item): item is KPICardData => item !== null)
}

// CORREÇÃO 2: Consulta de Scores com mapeamento completo para QualityScoreItem ✅
async function fetchQualityScores(clientId: string, start: string, end: string): Promise<QualityScoreItem[]> {
  const { data, error } = await supabase
    .from('v_quality_scores')
    .select('id, score_key, score_value, status_text, status_variant')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)

  if (error) {
    console.error('[fetchQualityScores] Erro na view de qualidade:', error.message)
    return []
  }

  // Mapear status_variant para glowColor
  const glowColorMap: Record<string, GlowColor> = {
    'ok': 'cyan',
    'warn': 'gold',
    'neutral': 'none'
  }

  return (data ?? []).map(row => ({
    id: row.id, // ADICIONADO ✅
    label: row.score_key, // RENOMEADO de 'key' ✅
    value: row.score_value !== null ? parseFloat(String(row.score_value)) : 'N/A', // Aceita 'N/A' ✅
    unit: '', // ADICIONADO ✅
    statusText: row.status_text ?? 'Sem dados',
    statusVariant: (row.status_variant as 'ok' | 'warn' | 'neutral') ?? 'neutral',
    glowColor: glowColorMap[row.status_variant ?? 'neutral'] as GlowColor // ADICIONADO ✅
  }))
}

// CORREÇÃO 3: Consulta de Performance com TrendColor válido ✅
async function fetchFormatPerformance(clientId: string, start: string, end: string): Promise<FormatPerformanceRow[]> {
  const { data, error } = await supabase
    .from('v_format_performance')
    .select('id, format_name, post_count, share_count, trend_label, trend_color')
    .eq('client_id', clientId)
    .gte('period_start', start)
    .lte('period_end', end)

  if (error) {
    console.error('[fetchFormatPerformance] Erro na view de performance:', error.message)
    return []
  }

  return (data ?? []).map(row => ({
    id: row.id,
    format: row.format_name ?? 'Outros',
    posts: row.post_count ?? 0,
    shares: row.share_count ?? 0,
    trendLabel: row.trend_label ?? 'Estável',
    trendColor: (row.trend_color as TrendColor) ?? 'gold' // CORRIGIDO: usa TrendColor type ✅
  }))
}

function generateInsights(formats: FormatPerformanceRow[]): InsightData[] {
  return formats
    .filter(f => f.posts > 0 && f.shares > 0)
    .map(f => ({
      id: `insight-${f.id}`,
      text: `O formato ${f.format} gerou um acumulado de ${f.shares} interações monitoradas através de ${f.posts} publicação(ões).`
    }))
}

function getPrototypeData(clientId: string, start: string, end: string): InstagramOverviewData {
  return {
    meta: { clientHandle: '@mock_store', periodLabel: '90 dias', dateRange: { from: start, to: end } },
    kpis: [],
    qualityScores: [],
    formatPerformance: [],
    insights: [],
    criticalAlerts: []
  }
}