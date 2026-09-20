// src/lib/onboarding/flags.ts
// ============================================================================
// ADR-011 (20/09/2026): a psicografia (Panksepp/Schwartz) deixou de ser
// diferencial do ORBIT. Fase 1 = ocultar, sem apagar nada.
//   false -> seções psicográficas ocultas no onboarding e fora do cálculo de
//            completude. Dados em client_onboarding permanecem intactos.
//   true  -> comportamento anterior (reversão em uma linha).
// ============================================================================
export const SHOW_PSYCHOGRAPHY: boolean = false

export const PSYCHOGRAPHY_FIELDS = [
  'expected_panksepp_system',
  'real_panksepp_system',
  'expected_schwartz',
  'real_schwartz',
] as const
