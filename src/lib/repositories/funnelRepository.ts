// src/lib/repositories/funnelRepository.ts
// Versão: 3.0.0 (ORIGINAL)

import { supabase } from '@/lib/supabase'
import type { FunnelMetrics, SimulatedFunnelResult, FunnelMetricsRow } from '../../types/funnel'

type FunnelDataSelect = Pick<
  FunnelMetricsRow,
  'alcance' | 'visitas' | 'cliques' | 'vendas' | 'ctr_bio' | 'taxa_conv'
>

function mapRowToFunnelMetrics(row: FunnelDataSelect): FunnelMetrics {
  return {
    alcance: row.alcance,
    visitas: row.visitas,
    cliques: row.cliques,
    vendas: row.vendas,
    ctrBio: row.ctr_bio,
    taxaConv: row.taxa_conv,
  }
}

export async function fetchFunnelData(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<FunnelMetrics> {
  try {
    const { data, error } = await supabase
      .from('funnel_data')
      .select('alcance, visitas, cliques, vendas, ctr_bio, taxa_conv')
      .eq('client_id', clientId)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[funnelRepository] fetchFunnelData — erro do Supabase:', error.message)
      throw new Error(error.message)
    }

    if (!data) {
      const message = 'Nenhum dado de funil encontrado para o período informado.'
      console.error('[funnelRepository] fetchFunnelData —', message)
      throw new Error(message)
    }

    return mapRowToFunnelMetrics(data as FunnelDataSelect)
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : 'Erro desconhecido ao buscar dados do funil.'
    console.error('[funnelRepository] fetchFunnelData falhou:', message)
    throw new Error(message)
  }
}

export function calculateSimulatedFunnel(
  sliders: SimulatedFunnelResult['inputs']
): FunnelMetrics {
  const { ctr, conv, alcance } = sliders
  
  const safeAlcance = Math.max(0, alcance)
  const safeCtr     = Math.max(0, Math.min(100, ctr))
  const safeConv    = Math.max(0, Math.min(100, conv))

  const visitas = safeAlcance
  const cliques = safeAlcance * (safeCtr / 100)
  const vendas  = cliques * (safeConv / 100)

  return {
    alcance:  Math.round(safeAlcance),
    visitas:  Math.round(visitas),
    cliques:  Math.round(cliques),
    vendas:   Math.round(vendas),
    ctrBio:   Number(safeCtr.toFixed(2)),
    taxaConv: Number(safeConv.toFixed(2)),
  }
}
