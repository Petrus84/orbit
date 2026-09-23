// src/lib/onboarding/enums.ts
//
// ✅ FIX (integração 12/09/2026): o rascunho original importava `AffectSource`
// e `Priority` de '@/types/orbit' — nenhum dos dois existe lá. O nome real
// do primeiro é `ValuesAffectSource` (ClientOnboarding.values_affect_source).
// `Priority` nunca existiu como tipo nomeado — é só o literal inline de
// `SchwatzValue.priority`; derivado aqui via indexed access em vez de
// inventar um tipo novo em orbit.ts sem confirmação.
//
// ✅ UX (copy otimizada — 15/09/2026): rótulos reescritos em linguagem
// mais natural para o cliente final (menos jargão de schema, mais frase
// de produto).
//
// ⚠️ FIX (19/09/2026): a rodada de 15/09 tinha invertido L0/L2 partindo do
// texto do ENUM_CONFIDENCE anterior ("L0 — sem confirmação", "L2 —
// confirmado") como fonte da verdade. Esse texto é que estava errado — é
// o mesmo bug propagado, não a correção dele. A fonte real é o uso em
// contentContractEngine.ts (15+ atribuições: dado direto/real_snapshot →
// L0; fallback sem breakdown ou amostra insuficiente → L2) e o próprio
// KPICard.tsx, que sempre pintou L0 de verde. L0 = Medido (direto da
// fonte, melhor). L1 = Estimado. L2 = Hipótese (pior, ainda sem
// confirmação) — convenção padrão de camadas de dado (L0 = bruto/medido,
// como em sensoriamento remoto), confirmada com o cliente nesta rodada.
import type {
  CTAType,
  FunnelMaturity,
  TotalFollowersSource,
  SetorBenchmark,
  ProofMechanism,
  ValuesAffectSource,
  ConfidenceLevel,
} from '@/types/orbit'

export const ENUM_TOTAL_FOLLOWERS_SOURCE: Array<[TotalFollowersSource, string]> = [
  ['manual_print_confirmado', 'Confirmado manualmente (com print)'],
  ['instagram_api', 'Conectado à plataforma (API)'],
  ['estimate', 'Estimativa baseada em dados'],
  ['scrape_perfil_confirmado', 'Verificado pelo perfil (dados públicos)'],
]

export const ENUM_CTA: Array<[CTAType, string]> = [
  ['link_direto', 'Link direto no post'],
  ['linktree_multilink', 'Linktree ou agregador de links'],
  ['dm_comentario', 'Contato via DM ou comentários'],
  ['link_bio', 'Link na bio do perfil'],
  ['nenhum', 'Sem chamada para ação identificada'],
]

export const ENUM_FUNNEL: Array<[FunnelMaturity, string]> = [
  ['nao_implementado', 'Sem funil de vendas estruturado'],
  ['implementado_fragmentado', 'Funil em desenvolvimento (múltiplas plataformas)'],
  ['implementado_unificado', 'Funil integrado e organizado'],
  ['funil_basico', 'Funil básico funcionando'],
]

export const ENUM_SETOR: Array<[SetorBenchmark, string]> = [
  ['comercio_direto_ecommerce_social', 'Venda direta / e-commerce nas redes'],
  ['comissionamento_afiliados', 'Renda por indicações (afiliados)'],
  ['infoprodutor_educador_pago', 'Cursos, treinamentos e conteúdo pago'],
  ['servico_consultoria_profissional', 'Serviços e consultoria profissional'],
  ['patrocinio_publicidade_marca', 'Parcerias e publicidade de marcas'],
  ['membership_assinatura_comunidade', 'Comunidade ou assinatura mensal'],
  ['monetizacao_nativa_plataforma', 'Ganhos diretos da plataforma (ads, tips)'],
  ['autoridade_personal_branding_b2b', 'Autoridade e parcerias B2B'],
  ['saas_ferramenta', 'Software ou ferramenta SaaS'],
  ['pre_monetizacao_a_validar', 'Em fase de teste (modelo ainda incerto)'],
]

export const ENUM_PROOF: Array<[ProofMechanism, string]> = [
  ['prova_social', 'Comunidade engajada (comentários, compartilhamentos)'],
  ['autoridade', 'Reconhecimento e expertise na área'],
  ['escassez_urgencia', 'Oferta limitada ou prazo curto'],
  ['associacao_marca', 'Parcerias com marcas conhecidas'],
  ['resultado_documentado', 'Resultados comprovados (cases, antes/depois)'],
  ['clientes_ativos_gestao', 'Clientes ativos trabalhando com você'],
  ['nenhum_observavel', 'Sem elementos de prova visíveis'],
]

export const ENUM_AFFECT_SOURCE: Array<[ValuesAffectSource, string]> = [
  ['onboarding', 'Informações do seu cadastro'],
  ['client_feedback', 'Feedback que você nos passou'],
  ['manual', 'Dados inseridos manualmente'],
  ['bio_oficial_zip_insights_decisao_canal', 'Análise da sua bio + dados públicos'],
]

export const ENUM_CONFIDENCE: Array<[ConfidenceLevel, string]> = [
  ['L0', 'Medido — direto da fonte, sem estimativa'],
  ['L1', 'Estimado — calculado a partir de dado parcial'],
  ['L2', 'Hipótese — ainda sem confirmação'],
]

export function labelFor<T extends string>(
  list: Array<[T, string]>,
  val: T | null | undefined
): string | null {
  if (!val) return null
  const hit = list.find(([v]) => v === val)
  return hit ? hit[1] : val
}