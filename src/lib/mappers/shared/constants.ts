// shared/constants.ts
// Fallbacks centralizados para todos os mappers ORBIT.
// Centralizar aqui garante que uma mudança de convenção de apresentação
// ("N/A" → "—") acontece num único lugar, não em 5 mappers.

/** Texto exibido quando um campo de texto nullable não tem valor real. */
export const FALLBACK_TEXT = 'N/A' as const

/** Nome exibido quando um cliente não tem nome cadastrado. */
export const FALLBACK_NAME = 'Cliente sem nome' as const

/** Percentual padrão para campos numéricos nullable sem valor real. */
export const FALLBACK_PCT = 0 as const

/** Status de saúde padrão quando o campo é null. */
export const FALLBACK_STATUS = 'unknown' as const

/**
 * Sentinela de data "sem data registrada" — epoch ISO, nunca `new Date()`.
 * Usar a data atual como fallback mentiria dizendo que o registro foi
 * atualizado agora, quando na verdade nunca teve data gravada.
 * Consumidores devem tratar este valor como "sem data", não como uma data real.
 */
export const FALLBACK_DATE_UNKNOWN = '1970-01-01T00:00:00.000Z' as const

/**
 * Autor de auditoria padrão quando `updated_by` não foi preenchido.
 * Indicativo de registro criado antes do campo existir, não de ação real do sistema.
 */
export const FALLBACK_UPDATED_BY = 'sistema' as const

/** Contagem de amostra padrão para thresholds sem calibração ainda. */
export const FALLBACK_SAMPLE_COUNT = 0 as const
