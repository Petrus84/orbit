// ============================================================================
// src/lib/repositories/onboardingRepository.ts
// Versão: 1.1.0
// ============================================================================

import { supabase } from '@/lib/supabase'
import type { ClientOnboarding } from '@/types/orbit'

// ============================================================================
// ✅ FUNÇÃO DE VALIDAÇÃO (AGORA DEFINIDA!)
// ============================================================================

/**
 * Valida se os dados do onboarding estão corretos
 * Retorna true se tudo está OK, false se há problemas
 */
function validateClientOnboarding(data: unknown): data is ClientOnboarding {
  // Verificação 1: Certificar que é um objeto
  if (!data || typeof data !== 'object') {
    console.warn('❌ Validação: dados não são um objeto')
    return false
  }

  const obj = data as Record<string, unknown>

  // Verificação 2: client_id não pode estar vazio
  if (!obj.client_id || typeof obj.client_id !== 'string') {
    console.warn('❌ Validação: client_id está vazio ou não é string')
    return false
  }

  // Verificação 3: total_followers não pode ser negativo
  if (typeof obj.total_followers !== 'number' || obj.total_followers < 0) {
    console.warn('❌ Validação: total_followers não é número ou é negativo')
    return false
  }

  // Verificação 4: Se houver percentuais de audiência, devem somar 100%
  const nucleo = typeof obj.audience_nucleo_fiel_pct === 'number' ? obj.audience_nucleo_fiel_pct : 0
  const consumo = typeof obj.audience_consumo_passivo_pct === 'number' ? obj.audience_consumo_passivo_pct : 0
  const curiosidade = typeof obj.audience_curiosidade_externa_pct === 'number' ? obj.audience_curiosidade_externa_pct : 0
  const rotatividade = typeof obj.audience_alta_rotatividade_pct === 'number' ? obj.audience_alta_rotatividade_pct : 0

  const total = nucleo + consumo + curiosidade + rotatividade

  if (total > 0 && Math.abs(total - 100) > 0.1) {
    console.warn(`❌ Validação: soma de audiência é ${total}%, deve ser 100%`)
    return false
  }

  // ✅ Tudo OK!
  return true
}

// ============================================================================
// ✅ FUNÇÕES DE REPOSITÓRIO
// ============================================================================

/**
 * Busca dados de onboarding de um cliente
 * Retorna os dados ou null se não existirem
 */
export async function fetchClientOnboarding(clientId: string): Promise<ClientOnboarding | null> {
  try {
    const { data, error } = await supabase
      .schema('orbit')
      .from('client_onboarding')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle()

    if (error) {
      console.error('[onboardingRepository] Erro ao buscar onboarding:', error.message)
      return null
    }

    if (!data) {
      console.warn(`[onboardingRepository] Nenhum onboarding encontrado para ${clientId}`)
      return null
    }

    // ✅ AGORA A FUNÇÃO EXISTE!
    if (!validateClientOnboarding(data)) {
      console.error('[onboardingRepository] Validação falhou:', data)
      return null
    }

    return data as ClientOnboarding
  } catch (err) {
    console.error('[onboardingRepository] Exceção:', err)
    return null
  }
}

/**
 * Salva ou atualiza dados de onboarding
 * Retorna true se sucesso, false se falha
 */
export async function upsertClientOnboarding(onboarding: ClientOnboarding): Promise<boolean> {
  try {
    const { error } = await supabase
      .schema('orbit')
      .from('client_onboarding')
      .upsert(onboarding, { onConflict: 'client_id' })

    if (error) {
      console.error('[onboardingRepository] Erro ao salvar:', error.message)
      return false
    }

    console.info('[onboardingRepository] ✅ Onboarding salvo com sucesso')
    return true
  } catch (err) {
    console.error('[onboardingRepository] Exceção:', err)
    return false
  }
}
