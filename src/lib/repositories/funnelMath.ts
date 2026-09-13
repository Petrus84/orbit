/* ==========================================================================
   ORBIT · funnelMath.ts
   Fonte ÚNICA de verdade para a matemática do funil/simulador.

   Antes desta consolidação existiam TRÊS cópias do mesmo cálculo
   (FunnelScreen.computeSimulation, funnelRepository.ts:calculateSimulatedFunnel,
   funnelRepository.calc.ts:calculateSimulatedFunnel) e uma quarta versão
   "paralela" só para exibição (o degradado em FunnelSimulator.tsx) que
   nunca alimentava o resultado real. Isso é o que permitia o simulador
   mostrar um aviso de saturação e, ao mesmo tempo, calcular vendas como
   função linear pura — os dois nunca se falavam.

   Modelo de rendimento decrescente:
   Em vez de aplicar log(x) diretamente (que exige clamps arbitrários perto
   de zero e não tem um "ponto neutro" natural), usamos decaimento por lei
   de potência sobre a razão de escala (alcance simulado / alcance real
   histórico do cliente):

     friccao = razaoEscala ^ alpha        (razaoEscala > 1)
     ctrEfetivo   = ctrBioAlvo   / friccao
     convEfetivo  = taxaConvAlvo / friccao

   alpha vem do engajamento nativo do cliente: perfis mais engajados têm
   público "quente" mais concentrado, então saturam mais rápido (alpha
   maior → friccao cresce mais rápido → decaimento mais acentuado).
   Sem engajamento real conectado ainda, cai num benchmark de 1.5%
   (mesmo fallback que FunnelSimulator já usava). ============================================================================= */

export interface FunnelSimInput {
  alcance: number
  ctrBio: number
  taxaConv: number
}

export interface FunnelSimResult {
  alcanceSimulado: number
  ctrBio: number
  taxaConv: number
  visitas: number
  cliques: number
  vendas: number
}

export interface SaturationContext {
  /** Alcance real histórico do cliente (base de comparação da escala). */
  alcanceRealHistorico: number
  /** Engajamento nativo real (%), quando disponível. null → usa benchmark. */
  erRealNativo: number | null
}

export interface SaturationOutput {
  razaoEscala: number
  isSaturated: boolean
  friccao: number
  engajamentoEfetivo: number
  ctrEfetivo: number
  convEfetivo: number
}

const BENCHMARK_ENGAJAMENTO = 1.5
const ALPHA_BASE = 0.25
const ALPHA_MIN = 0.1
const SATURATION_THRESHOLD = 1.5

/**
 * Calcula o quanto o CTR-alvo e a taxa de conversão-alvo devem ser
 * degradados quando o alcance simulado ultrapassa o alcance real
 * historicamente observado (público "quente" se esgota, o resto é
 * público frio com rendimento marginal menor).
 */
export function computeSaturation(
  state: FunnelSimInput,
  ctx: SaturationContext
): SaturationOutput {
  const razaoEscala = state.alcance / (ctx.alcanceRealHistorico || 1)
  const isSaturated = razaoEscala > SATURATION_THRESHOLD
  const engajamentoEfetivo =
    ctx.erRealNativo !== null && ctx.erRealNativo > 0 ? ctx.erRealNativo : BENCHMARK_ENGAJAMENTO

  const alphaDinamico = Math.max(ALPHA_MIN, ALPHA_BASE - engajamentoEfetivo * 0.02)
  const friccao = razaoEscala > 1 ? Math.pow(razaoEscala, alphaDinamico) : 1

  return {
    razaoEscala,
    isSaturated,
    friccao,
    engajamentoEfetivo,
    ctrEfetivo: state.ctrBio / friccao,
    convEfetivo: state.taxaConv / friccao,
  }
}

/**
 * Roda o funil completo — alcance → visitas → cliques → vendas — aplicando
 * o decaimento de saturação de verdade (não só como aviso visual).
 *
 * @param state    Parâmetros ajustados pelo usuário no simulador.
 * @param ctrLink  CTR do link na bio (cliques / visitas × 100), derivado do
 *                 funil real. Não sofre decaimento por escala aqui porque
 *                 é uma taxa condicionada a quem já visitou o perfil, não
 *                 ao tamanho do alcance frio — mas fica isolado nesta
 *                 função, então dá pra revisar essa decisão sem tocar no
 *                 resto do cálculo.
 * @param ctx      Contexto de saturação (alcance real histórico + engajamento).
 */
export function runFunnelSimulation(
  state: FunnelSimInput,
  ctrLink: number,
  ctx: SaturationContext
): { result: FunnelSimResult; saturation: SaturationOutput } {
  const saturation = computeSaturation(state, ctx)

  const visitas = state.alcance * (saturation.ctrEfetivo / 100)
  const cliques = visitas * (ctrLink / 100)
  const vendas = cliques * (saturation.convEfetivo / 100)

  // ⚠️ Antes: Math.round() era aplicado aqui, dentro do cálculo. Isso fazia
  // um cenário real de 0,13 vendas esperadas (alcance baixo, funil com 4
  // etapas multiplicativas — qualquer uma pequena já derruba o produto)
  // virar "0" antes mesmo de sair desta função, sem nenhum jeito de
  // recuperar o valor real na tela depois. Mantemos os floats aqui; quem
  // decide como exibir 0,13 (arredondar, mostrar "< 1", etc.) é a camada
  // de apresentação (FunnelResult.tsx), não o cálculo.
  return {
    result: {
      alcanceSimulado: state.alcance,
      ctrBio: state.ctrBio,
      taxaConv: state.taxaConv,
      visitas,
      cliques,
      vendas,
    },
    saturation,
  }
}