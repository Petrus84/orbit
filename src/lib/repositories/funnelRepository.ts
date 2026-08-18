/* =============================================================================
   ORBIT · Repository — Funil Interativo + Simulador
   Caminho: src/lib/repositories/funnelRepository.ts
   Versão: 4.0.0 + ContentContractEngine Integration
   
   v4.0.0:
   - Usa supabase (orbit.funnel_data confirmado em produção)
   - Fallback hardcoded com dados do @cpimportstore quando DB retorna vazio
   - Integração com ContentContractEngine para marcar dataSource
   ============================================================================= */

import { supabase } from '../supabase'
import { buildFunnelInsight } from './contentContractEngine'
import type { FunnelMetrics , InsightData } from '../../types/orbit'
import type { AlertContractFields } from './contentContractEngine'

// ✅ SHAPE LOCAL: Mapeia a linha bruta de orbit.funnel_data
interface FunnelDataRow {
  id: string
  client_id: string
  alcance: number
  visitas: number
  cliques: number | null
  vendas: number | null
  ctr_bio: string | number
  taxa_conv: string | number
  period_start: string
  period_end: string
  created_at: string
}

// ✅ MAPPER: FunnelDataRow → FunnelMetrics (domínio)
function mapRowToFunnelMetrics(row: FunnelDataRow): FunnelMetrics {
  return {
    alcance: row.alcance,
    visitas: row.visitas ?? 0,
    cliques: row.cliques ?? 0,
    vendas: row.vendas ?? 0,
    ctrBio: typeof row.ctr_bio === 'string' ? parseFloat(row.ctr_bio) : row.ctr_bio,
    taxaConv: typeof row.taxa_conv === 'string' ? parseFloat(row.taxa_conv) : row.taxa_conv,
  }
}

// ✅ FALLBACK: Dados reais verificados de @cpimportstore (Feb-Mai 2026)
const FALLBACK_CPIMPORTSTORE: FunnelMetrics = {
  alcance: 443,
  visitas: 53,
  cliques: 4,
  vendas: 0,
  ctrBio: 7.5,
  taxaConv: 0,
}

const FALLBACK_DEFAULT: FunnelMetrics = {
  alcance: 1000,
  visitas: 120,
  cliques: 12,
  vendas: 2,
  ctrBio: 12,
  taxaConv: 16.7,
}

// ✅ HELPER: Normaliza Date | string para ISO
function toISOString(date: Date | string): string {
  if (typeof date === 'string') return date
  return date.toISOString()
}

// ============================================================================
// FUNÇÃO PRINCIPAL: Busca dados reais + integra ContentContractEngine
// ============================================================================

export async function fetchFunnelData(
  clientId: string,
  periodStart: Date | string,
  periodEnd: Date | string
): Promise<{
  metrics: FunnelMetrics
  insight: InsightData & AlertContractFields
}> {
  try {
    const { data, error } = await supabase
      .from('funnel_data')
      .select('id, client_id, alcance, visitas, cliques, vendas, ctr_bio, taxa_conv, period_start, period_end, created_at')
      .eq('client_id', clientId)
      .gte('period_start', toISOString(periodStart))
      .lte('period_end', toISOString(periodEnd))
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    // ❌ ERRO: Supabase retornou erro
    if (error) {
      console.warn('[funnelRepository] Supabase error:', error.message)
      const metrics = clientId.includes('c4722cfc') ? FALLBACK_CPIMPORTSTORE : FALLBACK_DEFAULT
      const insight = buildFunnelInsight({
        reach: metrics.alcance,
        ctrBio: metrics.ctrBio,
        dataSource: 'fallback_by_error',
        fallbackClientId: clientId,
        errorMessage: error.message,
      })
      return { metrics, insight }
    }

    // ❌ VAZIO: Sem dados no período
    if (!data) {
      console.warn('[funnelRepository] No data for period:', { clientId, periodStart, periodEnd })
      const metrics = clientId.includes('c4722cfc') ? FALLBACK_CPIMPORTSTORE : FALLBACK_DEFAULT
      const insight = buildFunnelInsight({
        reach: metrics.alcance,
        ctrBio: metrics.ctrBio,
        dataSource: 'fallback_by_empty',
        fallbackClientId: clientId,
      })
      return { metrics, insight }
    }

    // ✅ SUCESSO: Dados reais
    const metrics = mapRowToFunnelMetrics(data as FunnelDataRow)
    const insight = buildFunnelInsight({
      reach: metrics.alcance,
      ctrBio: metrics.ctrBio,
      dataSource: 'real_snapshot',
    })
    return { metrics, insight }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[funnelRepository] Exception:', message)
    const metrics = clientId.includes('c4722cfc') ? FALLBACK_CPIMPORTSTORE : FALLBACK_DEFAULT
    const insight = buildFunnelInsight({
      reach: metrics.alcance,
      ctrBio: metrics.ctrBio,
      dataSource: 'fallback_by_error',
      fallbackClientId: clientId,
      errorMessage: message,
    })
    return { metrics, insight }
  }
}

// ============================================================================
// SIMULADOR: Calcula funil com parâmetros customizados
// ============================================================================

export interface SimulatedFunnelParams {
  alcance: number
  ctrBio: number
  taxaConv: number
}

export function calculateSimulatedFunnel(
  params: SimulatedFunnelParams,
  ctrLink: number
): FunnelMetrics {
  const visitas = Math.round(params.alcance * (params.ctrBio / 100))
  const cliques = Math.round(visitas * (ctrLink / 100))
  const vendas = Math.round(cliques * (params.taxaConv / 100))

  return {
    alcance: params.alcance,
    visitas,
    cliques,
    vendas,
    ctrBio: params.ctrBio,
    taxaConv: params.taxaConv,
  }
}

// ============================================================================
// EXPORT: Função de cálculo isolada (compatível com FunnelSimulator)
// ============================================================================

export { calculateSimulatedFunnel as calculateSimulatedFunnelFromParams }
