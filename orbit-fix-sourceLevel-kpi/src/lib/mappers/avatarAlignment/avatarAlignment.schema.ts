// avatarAlignment.schema.ts
// Barreira de runtime: nenhum dado cruza o repositório sem passar por aqui.

import { z } from 'zod'
import type { AvatarAlignmentRow } from '@/types/orbit'

const healthStatusEnum = z.enum(['healthy', 'warning', 'critical', 'unknown'])

/**
 * Valida o payload cru de `select * from orbit.v_avatar_alignment`
 * ANTES de entrar no mapper. Se o Postgres devolver algo fora deste shape
 * (coluna removida, tipo trocado por migration não sincronizada), falha
 * aqui — nunca dentro do mapper com undefined silencioso.
 */
export const avatarAlignmentViewRowSchema = z.object({
  id: z.string().nullable(),
  client_id: z.string().nullable(),
  handle: z.string().nullable(),
  name: z.string().nullable(),
  expected_gender_male: z.number().nullable(),
  expected_gender_female: z.number().nullable(),
  expected_age_range: z.string().nullable(),
  expected_interest: z.string().nullable(),
  expected_geo: z.string().nullable(),
  expected_geo_pct: z.number().nullable(),
  real_gender_male: z.number().nullable(),
  real_gender_female: z.number().nullable(),
  real_age_range: z.string().nullable(),
  real_interest: z.string().nullable(),
  real_geo: z.string().nullable(),
  real_geo_pct: z.number().nullable(),
  alignment_score: z.number().nullable(),
  alignment_status: healthStatusEnum.nullable(),
})

export const avatarAlignmentViewRowListSchema = z.array(avatarAlignmentViewRowSchema)

/**
 * Valida a SAÍDA do mapper — o shape que efetivamente atravessa para a UI.
 * `satisfies z.ZodType<AvatarAlignmentRow>` amarra este schema ao tipo TS
 * real: se `AvatarAlignmentRow` mudar em orbit.ts e este schema não
 * acompanhar, o `tsc` aponta o erro aqui, em tempo de build — não em
 * produção.
 */
export const avatarAlignmentRowSchema = z.object({
  client_id: z.string().min(1),
  handle: z.string(),
  name: z.string(),
  expected_gender_male: z.number(),
  expected_gender_female: z.number(),
  expected_age_range: z.string(),
  expected_interest: z.string().nullable(),
  expected_geo: z.string(),
  expected_geo_pct: z.number(),
  real_gender_male: z.number(),
  real_gender_female: z.number(),
  real_age_range: z.string(),
  real_interest: z.string().nullable(),
  real_geo: z.string(),
  real_geo_pct: z.number(),
  alignment_score: z.number(),
  alignment_status: z.string(),
}) satisfies z.ZodType<AvatarAlignmentRow>

/**
 * Uso típico no repositório:
 *
 *   const raw = await supabase.from('v_avatar_alignment').select('*')
 *   const parsedRows = avatarAlignmentViewRowListSchema.parse(raw.data)
 *   const contract = mapAvatarAlignmentViewRowsToContract(parsedRows)
 *   // defesa em profundidade, opcional: revalida a saída antes de expor à UI
 *   contract.forEach((row) => avatarAlignmentRowSchema.parse(row))
 */