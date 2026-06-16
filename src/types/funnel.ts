// src/types/funnel.ts
// ORBIT · Domain Types — Funil Interativo + Simulador
// Versão: 1.0.0

// ─────────────────────────────────────────────
// Primitivos de estado assíncrono
// ─────────────────────────────────────────────

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data:   T
  status: FetchStatus
  error:  string | null
}

// ─────────────────────────────────────────────
// Entidade: Funil (dados reais do período)
// ─────────────────────────────────────────────

export interface FunnelData {
  /** Total de contas únicas alcançadas no período */
  alcance:  number
  /** Visitas ao perfil / landing page */
  visitas:  number
  /** Cliques no link da bio ou CTA */
  cliques:  number
  /** Conversões / vendas confirmadas */
  vendas:   number
  /** CTR bio real (%) — cliques / alcance × 100 */
  ctrBio:   number
  /** Taxa de conversão real (%) — vendas / cliques × 100 */
  taxaConv: number
}

// ─────────────────────────────────────────────
// Entidade: Passo do Funil (para renderizar cada nível)
// ─────────────────────────────────────────────

export interface FunnelStep {
  /** Identificador único do passo (ex: 'alcance', 'visitas') */
  id:         string
  /** Rótulo visível (ex: 'Alcance', 'Visitas ao Perfil') */
  label:      string
  /** Valor absoluto do passo */
  value:      number
  /** Percentual relativo ao passo anterior (taxa de passagem) */
  percentage: number
  /** Ícone representativo (nome de emoji ou identifier) */
  icon:       string
}

// ─────────────────────────────────────────────
// Entidade: Configuração de Slider do Simulador
// ─────────────────────────────────────────────

export interface SliderConfig {
  /** Identificador do slider (ex: 'ctr', 'conv', 'alcance') */
  id:        string
  /** Rótulo visível */
  label:     string
  /** Valor atual editado pelo usuário */
  current:   number
  /** Valor mínimo permitido */
  min:       number
  /** Valor máximo permitido */
  max:       number
  /** Granularidade do passo */
  step:      number
  /** Valor de referência real (vindo do banco) */
  benchmark: number
  /** Unidade de exibição (ex: '%', 'k') */
  unit:      string
}

// ─────────────────────────────────────────────
// Entidade: Resultado do Simulador
// ─────────────────────────────────────────────

export interface SimulatedFunnelResult {
  /** Parâmetros usados no cálculo */
  inputs:      { ctr: number; conv: number; alcance: number }
  /** FunnelData calculado com os parâmetros simulados */
  funnel:      FunnelData
  /** Variação de vendas vs funil real (%) */
  deltaVendas: number
}

// ─────────────────────────────────────────────
// Aggregate: tudo que a FunnelScreen precisa
// ─────────────────────────────────────────────

export interface FunnelScreenData {
  real:      FunnelData
  simulated: SimulatedFunnelResult | null
  sliders:   SliderConfig[]
}

// ─────────────────────────────────────────────
// Supabase Row Shape (raw — antes de transformar)
// ─────────────────────────────────────────────

export interface FunnelDataRow {
  id:           string
  client_id:    string
  alcance:      number
  visitas:      number
  cliques:      number
  vendas:       number
  ctr_bio:      number
  taxa_conv:    number
  period_start: string
  period_end:   string
  created_at:   string
}
