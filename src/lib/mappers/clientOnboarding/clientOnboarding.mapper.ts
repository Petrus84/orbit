// clientOnboarding.mapper.ts
// Reconciliação: orbit.client_onboarding (tabela, DB) → ClientOnboarding (Contract, orbit.ts)
//
// Fonte do tipo de banco: importado direto de database.types.ts (isolamento
// de tipos). Qualquer schema drift (coluna renomeada/removida na tabela)
// quebra a compilação aqui, no ponto de origem, e não silenciosamente em
// runtime.

import type { Database } from '@/types/database.types'
import type { ClientOnboarding } from '@/types/orbit'
import type { ValidatedClientOnboardingTableRow } from './clientOnboarding.schema'

type ClientOnboardingTableRow = Database['orbit']['Tables']['client_onboarding']['Row']
export function mapClientOnboardingRowToContract(
  row: ValidatedClientOnboardingTableRow
): ClientOnboarding {
  return {
    client_id: row.client_id,
    total_followers: row.total_followers,
    total_followers_source: row.total_followers_source,
    bio_links: row.bio_links,
    cta_type: row.cta_type,
    funnel_maturity: row.funnel_maturity,
    q1_engagement_period_notes: row.q1_engagement_period_notes,
    q2_content_proxy_notes: row.q2_content_proxy_notes,
    q3_misalignment_notes: row.q3_misalignment_notes,
    audience_nucleo_fiel_pct: row.audience_nucleo_fiel_pct,
    audience_consumo_passivo_pct: row.audience_consumo_passivo_pct,
    audience_curiosidade_externa_pct: row.audience_curiosidade_externa_pct,
    audience_alta_rotatividade_pct: row.audience_alta_rotatividade_pct,
    observed_content_clusters: row.observed_content_clusters,
    setor_benchmark: row.setor_benchmark,
    nicho: row.nicho,
    proof_mechanism: row.proof_mechanism,
    values_affect_source: row.values_affect_source,
    values_affect_confidence: row.values_affect_confidence,
    confidence_seguidores: row.confidence_seguidores,
    confidence_bio_funil: row.confidence_bio_funil,
    confidence_diagnostico: row.confidence_diagnostico,
    confidence_audiencia: row.confidence_audiencia,
    confidence_negocio: row.confidence_negocio,
    avatar_expected_age_min: row.avatar_expected_age_min,
    avatar_expected_age_max: row.avatar_expected_age_max,
    avatar_expected_gender: row.avatar_expected_gender,
    avatar_expected_gender_pct: row.avatar_expected_gender_pct,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  }
}

export function mapClientOnboardingRowsToContract(
  rows: readonly ValidatedClientOnboardingTableRow[]
): ClientOnboarding[] {
  return rows.map(mapClientOnboardingRowToContract)
}

export type { ClientOnboardingTableRow }