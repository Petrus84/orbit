// src/types/metaAds.ts
// ORBIT · Domain Types — Meta Ads (Studio Lara MKT)
// Versão: 3.0.0 (Patched)

import type { CampaignObjective, CampaignStatus } from '@/types/orbit';

// ─────────────────────────────────────────────
// Entidade: KPI Card (Meta Ads) - SSOT v3.0
// ─────────────────────────────────────────────

export interface MetaAdsKPI {
  /** Identificador único necessário para chaves de renderização do React */
  id:         string
  /** Status de saúde do indicador para semáforo visual (ex: 'green' | 'amber' | 'red') */
  status:     string
  /** Rótulo visível do KPI (ex: 'ROAS', 'CTR', 'CPC', 'Frequency') */
  label:      string
  /** Valor numérico já calculado/agregado */
  value:      number
  /** Unidade de exibição (ex: 'x', '%', 'R$') */
  unit:       string
  /** Variação numérica em relação ao período/benchmark anterior (Patch C-4) */
  delta:      number
  /** Rótulo descritivo da variação (ex: '+0.3 vs. mês anterior') (Patch C-4) */
  deltaLabel: string
}

// ─────────────────────────────────────────────
// Supabase Row Shape (raw — antes de transformar)
// ─────────────────────────────────────────────

export interface CampaignRow {
  id:              string
  client_id:       string
  name:            string
  objective:       CampaignObjective
  roas:            number | null // Atualizado para aceitar nulo conforme a SSOT
  ctr:             number
  frequency:       number
  fatigue_percent: number // Ajustado para snake_case vindo do banco se aplicável, ou mantenha fatigue se a coluna crua for antiga
  status:          CampaignStatus
  cpl:             number
}
