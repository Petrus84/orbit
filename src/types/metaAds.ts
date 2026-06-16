// src/types/metaAds.ts
// ORBIT · Domain Types — Meta Ads (Studio Lara MKT)
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
// Enums / Unions de domínio
// ─────────────────────────────────────────────

/** Objetivo configurado para a campanha no Meta Ads Manager */
export type CampaignObjective = 'awareness' | 'leads' | 'conversion' | 'retargeting'

/** Status de saúde da campanha — alimenta o indicador verde/âmbar/vermelho */
export type CampaignStatus = 'healthy' | 'warning' | 'critical'

// ─────────────────────────────────────────────
// Entidade: Campanha (Meta Ads)
// ─────────────────────────────────────────────

export interface Campaign {
  /** Identificador único da campanha */
  id:        string
  /** Nome da campanha */
  name:      string
  /** Objetivo configurado no Meta Ads Manager */
  objective: CampaignObjective
  /** Return on Ad Spend (ex: 2.5 = 2.5x) */
  roas:      number
  /** Click-through rate (%) */
  ctr:       number
  /** Frequência média de exibição por usuário alcançado */
  frequency: number
  /** Índice de fadiga do criativo (0–100) — usado no indicador visual */
  fatigue:   number
  /** Status de saúde da campanha (verde/âmbar/vermelho) */
  status:    CampaignStatus
  /** Custo por lead (R$) */
  cpl:       number
}

// ─────────────────────────────────────────────
// Entidade: KPI Card (Meta Ads)
// ─────────────────────────────────────────────

export interface MetaAdsKPI {
  /** Rótulo visível do KPI (ex: 'ROAS', 'CTR', 'CPC', 'Frequency') */
  label:      string
  /** Valor numérico já calculado/agregado */
  value:      number
  /** Unidade de exibição (ex: 'x', '%', 'R$') */
  unit:       string
  /** Variação numérica em relação ao período/benchmark anterior */
  delta:      number
  /** Rótulo descritivo da variação (ex: '+0.3 vs. mês anterior') */
  deltaLabel: string
}

// ─────────────────────────────────────────────
// Supabase Row Shape (raw — antes de transformar)
// ─────────────────────────────────────────────

export interface CampaignRow {
  id:        string
  client_id: string
  name:      string
  objective: CampaignObjective
  roas:      number
  ctr:       number
  frequency: number
  fatigue:   number
  status:    CampaignStatus
  cpl:       number
}
