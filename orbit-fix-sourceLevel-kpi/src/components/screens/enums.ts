// src/lib/onboarding/enums.ts
//
// ✅ FIX (integração 12/09/2026): o rascunho original importava `AffectSource`
// e `Priority` de '@/types/orbit' — nenhum dos dois existe lá. O nome real
// do primeiro é `ValuesAffectSource` (ClientOnboarding.values_affect_source).
// `Priority` nunca existiu como tipo nomeado — é só o literal inline de
// `SchwatzValue.priority`; derivado aqui via indexed access em vez de
// inventar um tipo novo em orbit.ts sem confirmação.
import type {
  CTAType,
  FunnelMaturity,
  TotalFollowersSource,
  SetorBenchmark,
  ProofMechanism,
  PankseppSystem,
  ValuesAffectSource,
  ConfidenceLevel,
  SchwatzValue,
} from '@/types/orbit'

export type Priority = SchwatzValue['priority']

export const ENUM_TOTAL_FOLLOWERS_SOURCE: Array<[TotalFollowersSource, string]> = [
  ['manual_print_confirmado', 'Manual (print confirmado)'],
  ['instagram_api', 'Instagram API'],
  ['estimate', 'Estimativa'],
  ['scrape_perfil_confirmado', 'Scrape de perfil confirmado'],
]

export const ENUM_CTA: Array<[CTAType, string]> = [
  ['link_direto', 'Link direto'],
  ['linktree_multilink', 'Linktree / multilink'],
  ['dm_comentario', 'DM / comentário'],
  ['link_bio', 'Link na bio'],
  ['nenhum', 'Nenhum'],
]

export const ENUM_FUNNEL: Array<[FunnelMaturity, string]> = [
  ['nao_implementado', 'Não implementado'],
  ['implementado_fragmentado', 'Implementado (fragmentado)'],
  ['implementado_unificado', 'Implementado (unificado)'],
  ['funil_basico', 'Funil básico'],
]

export const ENUM_SETOR: Array<[SetorBenchmark, string]> = [
  ['comercio_direto_ecommerce_social', 'Comércio direto / e-commerce social'],
  ['comissionamento_afiliados', 'Comissionamento de afiliados'],
  ['infoprodutor_educador_pago', 'Infoprodutor / educador pago'],
  ['servico_consultoria_profissional', 'Serviço / consultoria profissional'],
  ['patrocinio_publicidade_marca', 'Patrocínio / publicidade de marca'],
  ['membership_assinatura_comunidade', 'Membership / assinatura de comunidade'],
  ['monetizacao_nativa_plataforma', 'Monetização nativa de plataforma'],
  ['autoridade_personal_branding_b2b', 'Autoridade / personal branding B2B'],
  ['saas_ferramenta', 'SaaS / ferramenta'],
  ['pre_monetizacao_a_validar', 'Pré-monetização (a validar)'],
]

export const ENUM_PROOF: Array<[ProofMechanism, string]> = [
  ['prova_social', 'Prova social'],
  ['autoridade', 'Autoridade'],
  ['escassez_urgencia', 'Escassez / urgência'],
  ['associacao_marca', 'Associação de marca'],
  ['resultado_documentado', 'Resultado documentado'],
  ['clientes_ativos_gestao', 'Clientes ativos em gestão'],
  ['nenhum_observavel', 'Nenhum observável'],
]

export const ENUM_PANKSEPP: Array<[PankseppSystem, string]> = [
  ['SEEKING', 'SEEKING'],
  ['CARE', 'CARE'],
  ['PLAY', 'PLAY'],
  ['LUST', 'LUST'],
  ['FEAR', 'FEAR'],
  ['RAGE', 'RAGE'],
  ['PANIC_GRIEF', 'PANIC_GRIEF'],
]

export const ENUM_AFFECT_SOURCE: Array<[ValuesAffectSource, string]> = [
  ['onboarding', 'Onboarding'],
  ['client_feedback', 'Feedback do cliente'],
  ['manual', 'Manual'],
  ['bio_oficial_zip_insights_decisao_canal', 'Bio oficial + zip Insights'],
]

export const ENUM_CONFIDENCE: Array<[ConfidenceLevel, string]> = [
  ['L0', 'L0 — Medido (direto da fonte)'],
  ['L1', 'L1 — Estimado (calculado a partir de dado parcial)'],
  ['L2', 'L2 — Hipótese (ainda sem confirmação)'],
]

export const ENUM_PRIORITY: Array<[Priority, string]> = [
  ['high', 'Alta'],
  ['medium', 'Média'],
  ['low', 'Baixa'],
]

export const SCHWARTZ_SUGESTOES = [
  'Poder',
  'Realização',
  'Hedonismo',
  'Estimulação',
  'Autodireção',
  'Universalismo',
  'Benevolência',
  'Tradição',
  'Conformidade',
  'Segurança',
]

export function labelFor<T extends string>(
  list: Array<[T, string]>,
  val: T | null | undefined
): string | null {
  if (!val) return null
  const hit = list.find(([v]) => v === val)
  return hit ? hit[1] : val
}