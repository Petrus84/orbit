/* ==========================================================================
   ORBIT · Funnel Calculation Utilities
   Caminho: src/lib/repositories/funnelRepository.calc.ts
   Versão: 1.0.0

   Lógica do funil (espelha computeSimulation em FunnelScreen.tsx):
   
     alcance → visitas  (× ctrBio / 100)
     visitas → cliques  (× ctrLink / 100)   ← ctrLink derivado de dados reais
     cliques → vendas   (× taxaConv / 100)
   ========================================================================== */

import type { FunnelMetrics } from '@/types/funnel'

interface SimulatedParams {
  alcance:  number  // alcance total estimado
  ctrBio:   number  // taxa de clique no bio (%)
  taxaConv: number  // taxa de conversão: clique → venda (%)
}

/**
 * Calcula funil simulado com parâmetros customizados.
 *
 * @param simulatedParams - Parâmetros ajustados pelo usuário no FunnelSimulator
 * @param ctrLink         - CTR do link em bio derivado dos dados reais
 *                          (cliques / visitas × 100). Fallback: 10.
 * @returns FunnelMetrics calculado com valores arredondados
 */
export function calculateSimulatedFunnel(
  simulatedParams: SimulatedParams,
  ctrLink: number,
): FunnelMetrics {
  const visitas = simulatedParams.alcance * (simulatedParams.ctrBio / 100)
  const cliques = visitas * (ctrLink / 100)
  const vendas  = cliques * (simulatedParams.taxaConv / 100)

  return {
    alcance:  simulatedParams.alcance,
    visitas:  Math.round(visitas),
    cliques:  Math.round(cliques),
    vendas:   Math.round(vendas),
    ctrBio:   simulatedParams.ctrBio,
    taxaConv: simulatedParams.taxaConv,
  }
}