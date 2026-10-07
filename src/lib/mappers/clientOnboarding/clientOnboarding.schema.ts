// clientOnboarding.schema.ts
// Barreira de runtime para orbit.client_onboarding.
// Fonte de verdade das colunas: confirmado via information_schema em 09/09/2026.
// Fonte de verdade dos valores de enum/CHECK: confirmado AO VIVO via
// pg_constraint (orbit.client_onboarding) em 11/09/2026 — ver comentários
// de cada constante abaixo. Onde este arquivo divergia do banco real, os
// valores foram corrigidos e os tipos passaram a importar de orbit.ts
// (SSOT) em vez de redeclarar a union localmente.
//
// Nota sobre campos enum do banco (USER-DEFINED no information_schema):
// - avatar_expected_gender: enum orbit.gender_category
// - cta_type, funnel_maturity, values_affect_source,
//   values_affect_confidence, setor_benchmark, proof_mechanism,
//   confidence_*, total_followers_source:
//   text com CHECK constraint (não enum nativo) — confirmado via
//   pg_constraint, não em Database["orbit"]["Enums"].
//
// Os campos text com CHECK constraint NÃO aparecem em Database["orbit"]["Enums"],
// por isso são validados aqui como z.enum — único ponto do sistema que
// realmente confere esses valores em runtime.

import { z } from 'zod'
import type { ClientOnboarding } from '@/types/orbit'

// ── Schemas de campos estruturados (JSONB no banco) ──────────────────────

const bioLinkSchema = z.object({
  url: z.string().url(),
  label: z.string(),
})

const bioLinksRowSchema = z.array(
  z.union([bioLinkSchema, z.string().url()])
).transform((links) =>
  links.map((link) => typeof link === 'string' ? { url: link, label: link } : link)
)

// ── Enums de texto (CHECK constraint no banco, não enum nativo Postgres) ─
// Todos os valores abaixo foram conferidos ao vivo em 11/09/2026 contra
// pg_get_constraintdef() de orbit.client_onboarding — não contra o shape
// assumido anteriormente neste arquivo, que estava desatualizado em 4 dos
// 8 enums de texto.

/** ✅ CORRIGIDO — pg_constraint: client_onboarding_cta_type_check (5 valores). */
const ctaTypeEnum = z.enum([
  'link_direto',
  'linktree_multilink',
  'dm_comentario',
  'nenhum',
  'link_bio',
]).nullable()

/** ✅ CORRIGIDO — pg_constraint: client_onboarding_funnel_maturity_check (4 valores). */
const funnelMaturityEnum = z.enum([
  'nao_implementado',
  'implementado_fragmentado',
  'implementado_unificado',
  'funil_basico',
]).nullable()

/** ✅ CORRIGIDO — pg_constraint: client_onboarding_values_affect_source_check (4 valores). */
const valuesAffectSourceEnum = z.enum([
  'onboarding',
  'client_feedback',
  'manual',
  'bio_oficial_zip_insights_decisao_canal',
])

/** Confirmado — pg_constraint: client_onboarding_values_affect_confidence_check. */
const confidenceLevelEnum = z.enum(['L0', 'L1', 'L2']).nullable()
const genderCategoryEnum = z.enum(['male', 'female', 'non_binary', 'mixed']).nullable()
/**
 * ✅ NOVO — este campo não era validado (z.string() solto). pg_constraint:
 * client_onboarding_setor_benchmark_check (10 valores).
 */
const setorBenchmarkEnum = z.enum([
  'comercio_direto_ecommerce_social',
  'comissionamento_afiliados',
  'infoprodutor_educador_pago',
  'servico_consultoria_profissional',
  'patrocinio_publicidade_marca',
  'membership_assinatura_comunidade',
  'monetizacao_nativa_plataforma',
  'autoridade_personal_branding_b2b',
  'pre_monetizacao_a_validar',
  'saas_ferramenta',
])

/**
 * ✅ NOVO — este campo não era validado (z.string() solto). pg_constraint:
 * client_onboarding_proof_mechanism_check (7 valores).
 */
const proofMechanismEnum = z.enum([
  'prova_social',
  'autoridade',
  'escassez_urgencia',
  'associacao_marca',
  'resultado_documentado',
  'nenhum_observavel',
  'clientes_ativos_gestao',
])

/**
 * ✅ NOVO — este campo não era validado (z.string() solto). pg_constraint:
 * client_onboarding_total_followers_source_check (4 valores — a versão
 * anterior deste projeto em orbit.ts só tinha 3, faltava
 * 'scrape_perfil_confirmado'; corrigido em ambos os arquivos).
 */
const totalFollowersSourceEnum = z.enum([
  'manual_print_confirmado',
  'instagram_api',
  'estimate',
  'scrape_perfil_confirmado',
])

// ── Schema de entrada (row crua do banco) ────────────────────────────────

export const clientOnboardingTableRowSchema = z.object({
  // NOT NULL no banco
  client_id: z.string().uuid(),
  total_followers: z.number().int(),
  total_followers_source: totalFollowersSourceEnum,
  bio_links: z.array(bioLinkSchema),

  // Nullable no banco
  cta_type: ctaTypeEnum,
  funnel_maturity: funnelMaturityEnum,
  q1_engagement_period_notes: z.string().nullable(),
  q2_content_proxy_notes: z.string().nullable(),
  q3_misalignment_notes: z.string().nullable(),
  // pg_constraint: audience_split_sum — quando nucleo_fiel_pct não é null,
  // A soma é validada na tela com a mesma condição e tolerância do banco.
  audience_nucleo_fiel_pct: z.number().nullable(),
  audience_consumo_passivo_pct: z.number().nullable(),
  audience_curiosidade_externa_pct: z.number().nullable(),
  audience_alta_rotatividade_pct: z.number().nullable(),
  observed_content_clusters: z.string().nullable(),
  setor_benchmark: setorBenchmarkEnum.nullable(),
  nicho: z.string().nullable(),
  proof_mechanism: proofMechanismEnum.nullable(),
  values_affect_source: valuesAffectSourceEnum.nullable(),
  values_affect_confidence: confidenceLevelEnum,
  confidence_seguidores: confidenceLevelEnum,
  confidence_bio_funil: confidenceLevelEnum,
  confidence_diagnostico: confidenceLevelEnum,
  confidence_audiencia: confidenceLevelEnum,
  confidence_negocio: confidenceLevelEnum,
  avatar_expected_age_min: z.number().int().min(13).nullable(),
  avatar_expected_age_max: z.number().int().max(120).nullable(),
  avatar_expected_gender: genderCategoryEnum,
  avatar_expected_gender_pct: z.number().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.string().nullable(),
})

export const clientOnboardingTableRowListSchema = z.array(
  clientOnboardingTableRowSchema
)

/** Tipo validado — é o que clientOnboarding.mapper.ts recebe como entrada. */
export type ValidatedClientOnboardingTableRow = z.infer<
  typeof clientOnboardingTableRowSchema
>

/**
 * Schema de saída — valida o shape que atravessa para a UI.
 * `satisfies z.ZodType<ClientOnboarding>` amarra ao tipo TS real:
 * se ClientOnboarding mudar em orbit.ts sem atualização aqui, o tsc aponta.
 */
export const clientOnboardingContractSchema = z.object({
  client_id: z.string().uuid(),
  total_followers: z.number().int(),
  total_followers_source: totalFollowersSourceEnum,
  bio_links: bioLinksRowSchema,
  cta_type: ctaTypeEnum,
  funnel_maturity: funnelMaturityEnum,
  q1_engagement_period_notes: z.string().nullable(),
  q2_content_proxy_notes: z.string().nullable(),
  q3_misalignment_notes: z.string().nullable(),
  audience_nucleo_fiel_pct: z.number().nullable(),
  audience_consumo_passivo_pct: z.number().nullable(),
  audience_curiosidade_externa_pct: z.number().nullable(),
  audience_alta_rotatividade_pct: z.number().nullable(),
  observed_content_clusters: z.string().nullable(),
  setor_benchmark: setorBenchmarkEnum.nullable(),
  nicho: z.string().nullable(),
  proof_mechanism: proofMechanismEnum.nullable(),
  values_affect_source: valuesAffectSourceEnum.nullable(),
  values_affect_confidence: confidenceLevelEnum,
  confidence_seguidores: confidenceLevelEnum,
  confidence_bio_funil: confidenceLevelEnum,
  confidence_diagnostico: confidenceLevelEnum,
  confidence_audiencia: confidenceLevelEnum,
  confidence_negocio: confidenceLevelEnum,
  avatar_expected_age_min: z.number().int().min(13).nullable(),
  avatar_expected_age_max: z.number().int().max(120).nullable(),
  avatar_expected_gender: genderCategoryEnum,
  avatar_expected_gender_pct: z.number().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.string().nullable(),
}) satisfies z.ZodType<ClientOnboarding>