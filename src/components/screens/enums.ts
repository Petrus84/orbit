// src/lib/onboarding/enums.ts
// Values accepted by orbit.client_onboarding.
import type {
  CTAType,
  FunnelMaturity,
  TotalFollowersSource,
  SetorBenchmark,
  ProofMechanism,
  ValuesAffectSource,
  ConfidenceLevel,
} from "@/types/orbit";

export const ENUM_TOTAL_FOLLOWERS_SOURCE: Array<
  [TotalFollowersSource, string]
> = [
  ["manual_print_confirmado", "Manual (print confirmado)"],
  ["instagram_api", "Conexão oficial com o Instagram"],
  ["estimate", "Estimativa"],
  ["scrape_perfil_confirmado", "Leitura do perfil confirmada"],
];

export const ENUM_CTA: Array<[CTAType, string]> = [
  ["link_direto", "Link direto"],
  ["linktree_multilink", "Página com vários links (Linktree)"],
  ["dm_comentario", "Mensagem ou comentário"],
  ["link_bio", "Link na bio"],
  ["nenhum", "Nenhum"],
];

export const ENUM_FUNNEL: Array<[FunnelMaturity, string]> = [
  ["nao_implementado", "Ainda não montado"],
  ["implementado_fragmentado", "Montado, em partes soltas"],
  ["implementado_unificado", "Montado e integrado"],
  ["funil_basico", "Caminho de venda básico"],
];

export const ENUM_SETOR: Array<[SetorBenchmark, string]> = [
  ["comercio_direto_ecommerce_social", "Comércio direto pelas redes sociais"],
  ["comissionamento_afiliados", "Comissão por indicação (afiliados)"],
  ["infoprodutor_educador_pago", "Cursos e conteúdo digital pago"],
  ["servico_consultoria_profissional", "Serviços e consultoria"],
  ["patrocinio_publicidade_marca", "Publis e parcerias com marcas"],
  ["membership_assinatura_comunidade", "Assinatura e comunidade paga"],
  ["monetizacao_nativa_plataforma", "Ganhos pela própria plataforma"],
  ["autoridade_personal_branding_b2b", "Marca pessoal para vender a empresas"],
  ["saas_ferramenta", "Software ou ferramenta online"],
  ["pre_monetizacao_a_validar", "Ainda sem receita, validando a ideia"],
];

export const ENUM_PROOF: Array<[ProofMechanism, string]> = [
  ["prova_social", "Prova social"],
  ["autoridade", "Autoridade"],
  ["escassez_urgencia", "Vagas limitadas e prazo curto"],
  ["associacao_marca", "Associação de marca"],
  ["resultado_documentado", "Resultado documentado"],
  ["clientes_ativos_gestao", "Clientes atendidos hoje"],
  ["nenhum_observavel", "Ainda não mostro prova do resultado"],
];

export const ENUM_AFFECT_SOURCE: Array<[ValuesAffectSource, string]> = [
  ["onboarding", "Onboarding"],
  ["client_feedback", "Feedback do cliente"],
  ["manual", "Manual"],
  [
    "bio_oficial_zip_insights_decisao_canal",
    "Bio oficial e arquivo de dados do Instagram",
  ],
];

export const ENUM_CONFIDENCE: Array<[ConfidenceLevel, string]> = [
  ["L0", "Medido: dado direto confirmado"],
  ["L1", "Estimado: raciocínio fundamentado"],
  ["L2", "Hipótese: depende de dado ausente"],
];
