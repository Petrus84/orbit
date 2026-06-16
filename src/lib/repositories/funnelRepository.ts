// src/lib/repositories/funnelRepository.ts
// ORBIT · Repository — Funil Interativo + Simulador
// Versão: 1.0.0

import { supabase } from '../supabaseClient'
import type { FunnelData, FunnelDataRow, SimulatedFunnelResult } from '../../types/funnel'

// ─────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────

/** Shape da linha retornada pela query (apenas colunas selecionadas) */
type FunnelDataSelect = Pick<
  FunnelDataRow,
  'alcance' | 'visitas' | 'cliques' | 'vendas' | 'ctr_bio' | 'taxa_conv'
>

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/**
 * Transforma uma linha do Supabase (snake_case) em FunnelData (camelCase)
 */
function mapRowToFunnelData(row: FunnelDataSelect): FunnelData {
  return {
    alcance:  row.alcance,
    visitas:  row.visitas,
    cliques:  row.cliques,
    vendas:   row.vendas,
    ctrBio:   row.ctr_bio,
    taxaConv: row.taxa_conv,
  }
}

// ─────────────────────────────────────────────
// fetchFunnelData
// ─────────────────────────────────────────────

/**
 * Busca os dados reais do funil de um cliente para um período específico.
 *
 * - Consulta a tabela `funnel_data` no Supabase
 * - Seleciona apenas as colunas necessárias
 * - Transforma snake_case → camelCase via mapRowToFunnelData
 *
 * @param clientId    ID do cliente
 * @param periodStart Data inicial do período (ISO string, ex: '2025-01-01')
 * @param periodEnd   Data final do período (ISO string, ex: '2025-01-31')
 * @returns           FunnelData (camelCase)
 * @throws            Error com mensagem amigável em caso de falha
 */
export async function fetchFunnelData(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<FunnelData> {
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

    return mapRowToFunnelData(data as FunnelDataSelect)
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : 'Erro desconhecido ao buscar dados do funil.'

    console.error('[funnelRepository] fetchFunnelData falhou:', message)
    throw new Error(message)
  }
}

// ─────────────────────────────────────────────
// calculateSimulatedFunnel
// ─────────────────────────────────────────────

/**
 * Calcula um FunnelData simulado a partir dos parâmetros do simulador.
 *
 * Fórmulas:
 *  - cliques = alcance × (ctr  / 100)
 *  - vendas  = cliques × (conv / 100)   →   vendas = alcance × (ctr/100) × (conv/100)
 *
 * Observação: como ainda não existe uma taxa específica de
 * "alcance → visitas" nos sliders do simulador, assumimos
 * visitas ≈ alcance (simplificação que pode ser refinada no futuro
 * caso um novo slider/benchmark seja adicionado).
 *
 * @param sliders Parâmetros simulados: { ctr, conv, alcance }
 * @returns       FunnelData calculado a partir dos parâmetros simulados
 */
export function calculateSimulatedFunnel(
  sliders: SimulatedFunnelResult['inputs']
): FunnelData {
  const { ctr, conv, alcance } = sliders

  // Garante valores dentro de faixas plausíveis
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
