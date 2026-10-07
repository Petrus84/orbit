// ============================================================================
// src/lib/repositories/onboardingRepository.ts
// Fetch and persist the SSOT columns from orbit.client_onboarding.
// ============================================================================

import { supabase } from '@/lib/supabase'
import type { ClientOnboarding, ClientOnboardingWrite } from '@/types/orbit'
import type { Json } from '@/types/database.types'
import { mapClientOnboardingRowToContract } from '@/lib/mappers/clientOnboarding/clientOnboarding.mapper'
import { clientOnboardingTableRowSchema } from '@/lib/mappers/clientOnboarding/clientOnboarding.schema'

// ============================================================================
// ✅ FUNÇÃO DE VALIDAÇÃO (AGORA DEFINIDA!)
// ============================================================================

/**
 * Valida se os dados do onboarding estão corretos
 * Retorna true se tudo está OK, false se há problemas
 */
export type FetchClientOnboardingResult =
  | { status: 'found'; data: ClientOnboarding }
  | { status: 'not_found' }

// ============================================================================
// ✅ FUNÇÕES DE REPOSITÓRIO
// ============================================================================

/**
 * Busca dados de onboarding de um cliente
 * Retorna os dados ou null se não existirem
 */
export async function fetchClientOnboarding(
  clientId: string
): Promise<FetchClientOnboardingResult> {
  const { data, error } = await supabase
    .schema('orbit')
    .from('client_onboarding')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { status: 'not_found' }

  const parsed = clientOnboardingTableRowSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Dados de onboarding incompatíveis: ${parsed.error.message}`)
  }

  return { status: 'found', data: mapClientOnboardingRowToContract(parsed.data) }
}

/**
 * Salva ou atualiza dados de onboarding
 * Retorna true se sucesso, false se falha
 */
export async function upsertClientOnboarding(onboarding: ClientOnboardingWrite): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('orbit')
      .from('client_onboarding')
      .upsert(
        {
          client_id: onboarding.client_id,
          total_followers: onboarding.total_followers,
          total_followers_source: onboarding.total_followers_source,
          bio_links: (onboarding.bio_links ?? []) as unknown as Json,
          cta_type: onboarding.cta_type,
          funnel_maturity: onboarding.funnel_maturity,
          q1_engagement_period_notes: onboarding.q1_engagement_period_notes,
          q2_content_proxy_notes: onboarding.q2_content_proxy_notes,
          q3_misalignment_notes: onboarding.q3_misalignment_notes,
          audience_nucleo_fiel_pct: onboarding.audience_nucleo_fiel_pct,
          audience_consumo_passivo_pct: onboarding.audience_consumo_passivo_pct,
          audience_curiosidade_externa_pct: onboarding.audience_curiosidade_externa_pct,
          audience_alta_rotatividade_pct: onboarding.audience_alta_rotatividade_pct,
          observed_content_clusters: onboarding.observed_content_clusters,
          setor_benchmark: onboarding.setor_benchmark,
          nicho: onboarding.nicho,
          proof_mechanism: onboarding.proof_mechanism,
          values_affect_source: onboarding.values_affect_source,
          values_affect_confidence: onboarding.values_affect_confidence,
          confidence_seguidores: onboarding.confidence_seguidores,
          confidence_bio_funil: onboarding.confidence_bio_funil,
          confidence_diagnostico: onboarding.confidence_diagnostico,
          confidence_audiencia: onboarding.confidence_audiencia,
          confidence_negocio: onboarding.confidence_negocio,
          avatar_expected_age_min: onboarding.avatar_expected_age_min,
          avatar_expected_age_max: onboarding.avatar_expected_age_max,
          avatar_expected_gender: onboarding.avatar_expected_gender,
          avatar_expected_gender_pct: onboarding.avatar_expected_gender_pct,
        },
        { onConflict: 'client_id' }
      )

    if (error) {
      console.error('[onboardingRepository] Erro ao salvar:', error.message)
      return false
    }

    console.info('[onboardingRepository] Onboarding salvo com sucesso')
    return true
  } catch (err) {
    console.error('[onboardingRepository] Exceção:', err)
    return false
  }
}