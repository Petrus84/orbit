/* ==========================================================================
   ORBIT · Repository - Funnel (v2 Final — 5 Argumentos + Quality Score)

   Assinatura de calculateSimulatedFunnel (5 argumentos):
   1. simulatedParams: { alcance, ctrBio, taxaConv }
   2. ctrLink: number | null
   3. alcanceRealHistorico: number (âncora de escala)
   4. segmento: 'ECOMMERCE_COMMODITY' | 'PROFESSIONAL_SERVICES'
   5. erRealNativo: number | null (ER Real da View via FK)
   ========================================================================== */

import { supabase } from '../supabase'
import type { FunnelMetrics } from '../../types/funnel'

interface SimulatedParams {
  alcance: number
  ctrBio: number
  taxaConv: number
}

// ✅ TIPO DISCRIMINADO: Garante .data quando status === 'success'
export type CalculationResult =
  | { status: 'success'; data: FunnelMetrics }
  | { status: 'error'; reason: 'missing_ctr_link' | 'invalid_params'; message: string }

// ─── UTILITIES ─────────────────────────────────────────────────────────────

const createNullState = (): FunnelMetrics => ({
  alcance: 0,
  visitas: 0,
  cliques: null,
  vendas: null,
  ctrBio: 0,
  taxaConv: 0,
  erReal: null,
})

// ─── CAMADA 1: FETCH ──────────────────────────────────────────────────────

/**
 * ✅ Busca métricas reais do funil
 * Fonte: orbit.funnel_data (schema SSOT)
 */
export async function fetchFunnelMetrics(clientId: string): Promise<FunnelMetrics> {
  try {
    console.log(`[funnelRepository] Buscando métricas para: ${clientId}`)

    const { data, error } = await supabase
      .schema('orbit')
      .from('funnel_data')
      .select('id, alcance, visitas, cliques, vendas, ctr_bio, taxa_conv, period_start, period_end, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(
        `[funnelRepository] [DB ERROR] Falha ao buscar para ${clientId}:`,
        error.message
      )
      return createNullState()
    }

    if (!data) {
      console.warn(`[funnelRepository] [NO DATA] Sem registro no banco para: ${clientId}`)
      return createNullState()
    }

    console.log(`[funnelRepository] ✅ Sucesso: Métricas carregadas para ${clientId}`)

    return {
      alcance: data.alcance ?? 0,
      visitas: data.visitas ?? 0,
      cliques: data.cliques,
      vendas: data.vendas,
      ctrBio: Number(data.ctr_bio),
      taxaConv: Number(data.taxa_conv),
      erReal: null,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error(
      `[funnelRepository] [EXCEPTION] Erro crítico para ${clientId}:`,
      errorMessage
    )
    return createNullState()
  }
}

// ─── CAMADA 3: CÁLCULO (Simulação com Lei dos Rendimentos Decrescentes) ────

/**
 * ✅ Calcula funil simulado com inteligência elástica
 *
 * ASSINATURA: 5 ARGUMENTOS
 * 1. simulatedParams: { alcance, ctrBio, taxaConv }
 * 2. ctrLink: number | null
 * 3. alcanceRealHistorico: number (âncora de escala)
 * 4. segmento: 'ECOMMERCE_COMMODITY' | 'PROFESSIONAL_SERVICES'
 * 5. erRealNativo: number | null (ER Real da View via FK)
 */
export function calculateSimulatedFunnel(
  simulatedParams: SimulatedParams,
  ctrLink: number | null,
  alcanceRealHistorico: number,
  segmento: 'ECOMMERCE_COMMODITY' | 'PROFESSIONAL_SERVICES',
  erRealNativo: number | null
): CalculationResult {
  // ✅ Validação 1: CTR Link
  if (ctrLink === null || ctrLink === undefined) {
    console.error('[funnelRepository] ❌ CTR Link ausente — não há dados reais do banco')
    return {
      status: 'error',
      reason: 'missing_ctr_link',
      message: 'Dados de CTR do link em bio não disponíveis.',
    }
  }

  if (typeof ctrLink !== 'number' || isNaN(ctrLink) || ctrLink < 0 || ctrLink > 100) {
    console.error(`[funnelRepository] ❌ CTR Link inválido: ${ctrLink}`)
    return {
      status: 'error',
      reason: 'invalid_params',
      message: `CTR Link deve estar entre 0 e 100. Recebido: ${ctrLink}`,
    }
  }

  // ✅ Validação 2: Parâmetros simulados
  if (!simulatedParams || typeof simulatedParams !== 'object') {
    console.error('[funnelRepository] ❌ Parâmetros simulados inválidos')
    return {
      status: 'error',
      reason: 'invalid_params',
      message: 'Parâmetros simulados não fornecidos',
    }
  }

  const { alcance, ctrBio, taxaConv } = simulatedParams

  if (
    typeof alcance !== 'number' ||
    alcance < 0 ||
    typeof ctrBio !== 'number' ||
    ctrBio < 0 ||
    ctrBio > 100 ||
    typeof taxaConv !== 'number' ||
    taxaConv < 0 ||
    taxaConv > 100
  ) {
    console.error('[funnelRepository] ❌ Parâmetros fora do intervalo válido', {
      alcance,
      ctrBio,
      taxaConv,
    })
    return {
      status: 'error',
      reason: 'invalid_params',
      message: 'Parâmetros devem ser números entre 0 e 100',
    }
  }

  // ✅ INTELIGÊNCIA ELÁSTICA: Lei dos Rendimentos Decrescentes
  const limits = {
    ECOMMERCE_COMMODITY: { maxCTR: 3.0, maxConv: 2.0, alpha: 0.15 },
    PROFESSIONAL_SERVICES: { maxCTR: 10.0, maxConv: 6.0, alpha: 0.45 },
  }[segmento]

  // Razão de escala em relação à âncora histórica
  const razaoEscala = alcance / (alcanceRealHistorico || 1)

  let ctrBioAjustado = ctrBio
  let taxaConvAjustada = taxaConv

  if (razaoEscala > 1) {
    const scoreQualidade = erRealNativo ?? 1.0
    const fatorFriccao = Math.pow(razaoEscala, limits.alpha - scoreQualidade * 0.02)

    ctrBioAjustado = ctrBio / fatorFriccao
    taxaConvAjustada = taxaConv / fatorFriccao

    console.log(
      `[funnelRepository] 📊 Fricção aplicada: razão=${razaoEscala.toFixed(2)}, fator=${fatorFriccao.toFixed(3)}, scoreQualidade=${scoreQualidade}`
    )
  }

  // Trava os sliders nos limites que o nicho suporta
  const ctrBioFinal = Math.min(ctrBioAjustado, limits.maxCTR)
  const taxaConvFinal = Math.min(taxaConvAjustada, limits.maxConv)

  // Cálculo linear final
  const visitas = alcance * (ctrBioFinal / 100)
  const cliques = visitas * ((ctrLink ?? 10) / 100)
  const vendas = cliques * (taxaConvFinal / 100)

  const result: FunnelMetrics = {
    alcance: Math.round(alcance),
    visitas: Math.round(visitas),
    cliques: Math.round(cliques),
    vendas: Math.round(vendas),
    ctrBio: parseFloat(ctrBioFinal.toFixed(2)),
    taxaConv: parseFloat(taxaConvFinal.toFixed(2)),
    erReal: erRealNativo,
  }

  console.log('[funnelRepository] ✅ Funil simulado calculado com sucesso', {
    alcance: result.alcance,
    visitas: result.visitas,
    cliques: result.cliques,
    vendas: result.vendas,
    ctrBioFinal: result.ctrBio,
    taxaConvFinal: result.taxaConv,
  })

  return {
    status: 'success',
    data: result,
  }
}

/**
 * ✅ Versão simplificada (retorna null em caso de erro)
 */
export function calculateSimulatedFunnelOrNull(
  simulatedParams: SimulatedParams,
  ctrLink: number | null,
  alcanceRealHistorico: number,
  segmento: 'ECOMMERCE_COMMODITY' | 'PROFESSIONAL_SERVICES',
  erRealNativo: number | null
): FunnelMetrics | null {
  const result = calculateSimulatedFunnel(
    simulatedParams,
    ctrLink,
    alcanceRealHistorico,
    segmento,
    erRealNativo
  )
  return result.status === 'success' ? result.data : null
}