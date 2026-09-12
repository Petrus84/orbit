// avatarAlignment.mapper.ts
// Reconciliação: orbit.v_avatar_alignment (view, DB) → AvatarAlignmentRow (Contract, orbit.ts)
//
// Fonte do tipo de banco: importado direto de database.types.ts (isolamento
// de tipos). Qualquer schema drift (coluna renomeada/removida na view) quebra
// a compilação aqui, no ponto de origem, e não silenciosamente em runtime.

import type { Database } from '@/types/database.types'
import { OrbitValidationError } from '../shared/types'
import type { AvatarAlignmentRow } from '@/types/orbit'

/**
 * Row real retornada por `select * from orbit.v_avatar_alignment`.
 * Toda coluna é `T | null` porque é uma VIEW — convenção do codegen do
 * Supabase, independente de a coluna de origem ser NOT NULL.
 */
type AvatarAlignmentViewRow = Database['orbit']['Views']['v_avatar_alignment']['Row']

// Fallbacks explícitos — únicos pontos de decisão de apresentação do mapper.
const FALLBACK_TEXT = 'N/A' as const
const FALLBACK_NAME = 'Cliente sem nome' as const
const FALLBACK_PCT = 0 as const
const FALLBACK_STATUS = 'unknown' as const

/**
 * Converte uma linha crua da view para o shape exigido pela UI/domínio.
 *
 * `client_id` é a única exceção ao padrão de fallback: é a chave lógica do
 * registro. Uma linha sem `client_id` indica JOIN quebrado ou corrupção de
 * dado — mascarar isso com um fallback (`''`, `'N/A'`) esconderia um bug de
 * integridade em vez de sinalizá-lo. Por isso lança, em vez de fabricar.
 */
export function mapAvatarAlignmentViewRowToContract(
  row: AvatarAlignmentViewRow
): AvatarAlignmentRow {
  if (row.client_id === null) {
    throw new OrbitValidationError(
      'Linha de orbit.v_avatar_alignment sem client_id — JOIN incompleto ou dado corrompido.',
      { row }
    )
  }

  return {
    client_id: row.client_id,
    handle: row.handle ?? FALLBACK_TEXT,
    name: row.name ?? FALLBACK_NAME,
    expected_gender_male: row.expected_gender_male ?? FALLBACK_PCT,
    expected_gender_female: row.expected_gender_female ?? FALLBACK_PCT,
    expected_age_range: row.expected_age_range ?? FALLBACK_TEXT,
    // expected_interest/real_interest: `string | null` nos dois lados —
    // sem null hazard, repassar sem transformação.
    expected_interest: row.expected_interest,
    expected_geo: row.expected_geo ?? FALLBACK_TEXT,
    expected_geo_pct: row.expected_geo_pct ?? FALLBACK_PCT,
    real_gender_male: row.real_gender_male ?? FALLBACK_PCT,
    real_gender_female: row.real_gender_female ?? FALLBACK_PCT,
    real_age_range: row.real_age_range ?? FALLBACK_TEXT,
    real_interest: row.real_interest,
    real_geo: row.real_geo ?? FALLBACK_TEXT,
    real_geo_pct: row.real_geo_pct ?? FALLBACK_PCT,
    alignment_score: row.alignment_score ?? FALLBACK_PCT,
    // alignment_status é um union literal (`Enums["health_status"] | null`)
    // — assinalável a `string` sem cast; o `??` cobre o hazard de null.
    alignment_status: row.alignment_status ?? FALLBACK_STATUS,
    // `id` existe na view mas não faz parte do Contract — intencionalmente
    // omitido, não é um gap a corrigir.
  }
}

/**
 * Versão em lote, resiliente: linhas corrompidas (sem client_id) são
 * descartadas e logadas, em vez de derrubar a página inteira por causa de
 * um registro ruim.
 */
export function mapAvatarAlignmentViewRowsToContract(
  rows: readonly AvatarAlignmentViewRow[]
): AvatarAlignmentRow[] {
  return rows.reduce<AvatarAlignmentRow[]>((acc, row) => {
    try {
      acc.push(mapAvatarAlignmentViewRowToContract(row))
    } catch (err) {
      if (err instanceof OrbitValidationError) {
        console.warn('[AvatarAlignmentMapper] linha descartada:', err.details)
        return acc
      }
      throw err
    }

    return acc
  }, [])
}