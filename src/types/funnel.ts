// src/types/funnel.ts
// ORBIT · Domain Types — Funnel Metrics (Studio Lara MKT)
// Versão: 3.0.0 (Patched)


// ─────────────────────────────────────────────
// Entidade: Funil (dados reais do período)
// ─────────────────────────────────────────────

export interface FunnelMetrics {
  /** Total de contas únicas alcançadas no período */
  alcance:   number
  /** Visitas ao perfil / landing page */
  visitas:   number
  /** Cliques no link da bio ou CTA */
  cliques:   number
  /** Conversões / vendas confirmadas */
  vendas:    number
  /** CTR bio real (%) — cliques / alcance × 100 */
  ctrBio:    number
  /** Taxa de conversão real (%) — vendas / cliques × 100 */
  taxaConv:  number
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
  /** FunnelMetrics calculado com os parâmetros simulados */
  funnel:      FunnelMetrics
  /** Variação de vendas vs funil real (%) */
  deltaVendas: number
}

// ─────────────────────────────────────────────
// Aggregate: tudo que a FunnelScreen precisa
// ─────────────────────────────────────────────

export interface FunnelScreenData {
  real:      FunnelMetrics
  simulated: SimulatedFunnelResult | null
  sliders:   SliderConfig[]
}

// ─────────────────────────────────────────────
// Supabase Row Shape (raw — antes de transformar)
// ─────────────────────────────────────────────

export interface FunnelMetricsRow {
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
