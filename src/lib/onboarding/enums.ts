/**
 * ENUMS PARA CLIENT_ONBOARDING
 * Extraídos do Database.types.ts e dos dados reais no banco
 * SSOT (Single Source of Truth): Database.orbit.client_onboarding
 * Campos que FORAM REMOVIDOS (não existem mais na tabela):
 */

import type { Database } from '@/types/database.types'

// ============================================================================
// TIPOS DERIVADOS DO BANCO
// ============================================================================

export type ConfidenceLevel = 'L0' | 'L1' | 'L2'
export type GenderCategory = Database['orbit']['Enums']['gender_category']
export type HealthStatus = Database['orbit']['Enums']['health_status']

// ============================================================================
// TIPOS CUSTOMIZADOS (strings genéricas no banco, valores inferidos)
// ============================================================================

export type TotalFollowersSource =
  | 'manual_print_confirmado'
  | 'instagram_api'
  | 'estimate'
  | 'scrape_perfil_confirmado'

export type CTAType =
  | 'link_direto'
  | 'linktree_multilink'
  | 'dm_comentario'
  | 'nenhum'
  | 'link_bio'

export type FunnelMaturity =
  | 'nao_implementado'
  | 'funil_basico'
  | 'implementado_fragmentado'
  | 'implementado_unificado'

export type SetorBenchmark =
  | 'comercio_direto_ecommerce_social'
  | 'comissionamento_afiliados'
  | 'infoprodutor_educador_pago'
  | 'servico_consultoria_profissional'
  | 'patrocinio_publicidade_marca'
  | 'membership_assinatura_comunidade'
  | 'monetizacao_nativa_plataforma'
  | 'autoridade_personal_branding_b2b'
  | 'pre_monetizacao_a_validar'
  | 'saas_ferramenta'

export type ProofMechanism =
  | 'prova_social'
  | 'autoridade'
  | 'escassez_urgencia'
  | 'associacao_marca'
  | 'clientes_ativos_gestao'
  | 'resultado_documentado'
  | 'nenhum_observavel'

export type ValuesAffectSource =
  | 'onboarding'
  | 'client_feedback'
  | 'manual'
  | 'bio_oficial_zip_insights_decisao_canal'

  // src/lib/onboarding/enums.ts

export type PercentageValidation =
  | { ok: true; value: number | null }
  | {
      ok: false
      value: null
      reason: 'invalid_number' | 'out_of_range'
    }

/**
 * Valida um percentual individual.
 * null, undefined e string vazia representam um valor não informado.
 */
export function validatePercentage(input: unknown): PercentageValidation {
  if (input === null || input === undefined) {
    return { ok: true, value: null }
  }

  let value: number

  if (typeof input === 'number') {
    value = input
  } else if (typeof input === 'string') {
    const trimmed = input.trim()

    if (trimmed === '') {
      return { ok: true, value: null }
    }

    // Evita aceitar formatos como "0x10" ou strings parcialmente numéricas.
    const decimalPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
    if (!decimalPattern.test(trimmed)) {
      return { ok: false, value: null, reason: 'invalid_number' }
    }

    value = Number(trimmed)
  } else {
    return { ok: false, value: null, reason: 'invalid_number' }
  }

  if (!Number.isFinite(value)) {
    return { ok: false, value: null, reason: 'invalid_number' }
  }

  if (value < 0 || value > 100) {
    return { ok: false, value: null, reason: 'out_of_range' }
  }

  return { ok: true, value }
}

export const AUDIENCE_PERCENTAGE_FIELDS = [
  'audience_nucleo_fiel_pct',
  'audience_consumo_passivo_pct',
  'audience_curiosidade_externa_pct',
  'audience_alta_rotatividade_pct',
] as const

export type AudiencePercentageField =
  (typeof AUDIENCE_PERCENTAGE_FIELDS)[number]

export type AudiencePercentageInput = Partial<
  Record<AudiencePercentageField, unknown>
>

/**
 * Valida percentuais individuais e aplica a regra de soma do banco.
 *
 * Regra da tabela:
 * - se audience_nucleo_fiel_pct for NULL, o banco não exige soma de 100;
 * - caso contrário, os valores NULL dos outros campos contam como zero;
 * - a soma precisa ficar a menos de 0,1 ponto percentual de 100.
 */
export function validateAudienceSum(
  record: AudiencePercentageInput | null | undefined
): { ok: boolean; sum: number } {
  if (!record) return { ok: true, sum: 0 }

  const parsed: Partial<Record<AudiencePercentageField, number | null>> = {}
  let allPercentagesValid = true

  for (const field of AUDIENCE_PERCENTAGE_FIELDS) {
    const result = validatePercentage(record[field])

    if (!result.ok) {
      allPercentagesValid = false
      continue
    }

    parsed[field] = result.value
  }

  const sum = AUDIENCE_PERCENTAGE_FIELDS.reduce(
    (total, field) => total + (parsed[field] ?? 0),
    0
  )

  if (!allPercentagesValid) {
    return { ok: false, sum }
  }

  // Corresponde à condição do banco: a validação da soma depende
  // especificamente de audience_nucleo_fiel_pct IS NOT NULL.
  if (parsed.audience_nucleo_fiel_pct == null) {
    return { ok: true, sum }
  }

  const difference = Math.abs(sum - 100)

  // O epsilon evita que, por arredondamento binário do JavaScript,
  // valores na fronteira exata de 0,1 sejam aceitos por engano.
  const boundaryEpsilon =
    Number.EPSILON * Math.max(100, Math.abs(sum)) * 2

  const sumIsValid =
    difference < 0.1 && 0.1 - difference > boundaryEpsilon

  return { ok: sumIsValid, sum }
}
// ============================================================================
// ENUM ARRAYS (para renderização em selects/radios)
// ============================================================================

export const ENUM_TOTAL_FOLLOWERS_SOURCE: [TotalFollowersSource, string][] = [
  ['manual_print_confirmado', 'Manual (print confirmado)'],
  ['instagram_api', 'API do Instagram'],
  ['estimate', 'Estimativa'],
  ['scrape_perfil_confirmado', 'Scrape de perfil (confirmado)'],
]

export const ENUM_CTA_TYPE: [CTAType, string][] = [
  ['link_direto', 'Link direto (checkout, WhatsApp)'],
  ['linktree_multilink', 'Linktree / multilink'],
  ['dm_comentario', 'DM / comentário'],
  ['nenhum', 'Nenhum CTA explícito'],
  ['link_bio', 'Link na bio'],
]

export const ENUM_FUNNEL_MATURITY: [FunnelMaturity, string][] = [
  ['nao_implementado', 'Não implementado'],
  ['funil_basico', 'Funil básico (landing page + email)'],
  ['implementado_fragmentado', 'Implementado (fragmentado)'],
  ['implementado_unificado', 'Implementado (unificado)'],
]

export const ENUM_SETOR_BENCHMARK: [SetorBenchmark, string][] = [
  ['comercio_direto_ecommerce_social', 'Comércio Direto / E-commerce Social'],
  ['comissionamento_afiliados', 'Comissionamento / Afiliados'],
  ['infoprodutor_educador_pago', 'Infoprodutor / Educador pago'],
  ['servico_consultoria_profissional', 'Serviço / Consultoria / Profissional'],
  ['patrocinio_publicidade_marca', 'Patrocínio / Publicidade / Marca'],
  ['membership_assinatura_comunidade', 'Membership / Assinatura / Comunidade'],
  ['monetizacao_nativa_plataforma', 'Monetização Nativa / Plataforma'],
  ['autoridade_personal_branding_b2b', 'Autoridade / Personal branding B2B'],
  ['pre_monetizacao_a_validar', 'Pré-monetização a validar'],
  ['saas_ferramenta', 'SaaS / Ferramenta'],
]

export const ENUM_PROOF_MECHANISM: [ProofMechanism, string][] = [
  ['prova_social', 'Prova social'],
  ['autoridade', 'Autoridade / Expertise'],
  ['escassez_urgencia', 'Escassez / Urgência'],
  ['associacao_marca', 'Associação com marca'],
  ['clientes_ativos_gestao', 'Clientes ativos / Gestão'],
  ['resultado_documentado', 'Resultado documentado'],
  ['nenhum_observavel', 'Nenhum observável'],
]

export const ENUM_VALUES_AFFECT_SOURCE: [ValuesAffectSource, string][] = [
  ['onboarding', 'Onboarding'],
  ['client_feedback', 'Feedback do cliente'],
  ['manual', 'Manual (entrevista/formulário)'],
  ['bio_oficial_zip_insights_decisao_canal', 'Bio oficial + ZIP insights'],
]

// Do Database.types.ts — Enums tipados
export const ENUM_CONFIDENCE: [ConfidenceLevel, string][] = [
  ['L0', 'L0 — Dado direto confirmado'],
  ['L1', 'L1 — Raciocínio fundamentado'],
  ['L2', 'L2 — Depende de dado ausente'],
]

export const ENUM_GENDER_CATEGORY: [GenderCategory, string][] = [
  ['male', 'Masculino'],
  ['female', 'Feminino'],
  ['non_binary', 'Não-binário'],
  ['mixed', 'Misto'],
]

// ============================================================================
// HELPER: Buscar label de um enum
// ============================================================================
// ============================================================================
// MAPA DE SETORES → CURIOSIDADES (do dossiê setorial)
// ============================================================================

export const CURIOSIDADES_POR_SETOR: Record<SetorBenchmark, {
  titulo: string
  texto: string
  fonte: string
}> = {
  comercio_direto_ecommerce_social: {
    titulo: '54% dos consumidores compraram pelas redes',
    texto: 'Instagram lidera pesquisas (75%), mas TikTok ganha em conversão dentro da plataforma (24%).',
    fonte: 'CNDL/SPC Brasil, 2026',
  },
  comissionamento_afiliados: {
    titulo: 'Comissões dependem de atribuição clara',
    texto: 'Links rastreáveis e chamadas específicas ajudam a relacionar conteúdo e conversão.',
    fonte: 'Referência operacional de afiliados',
  },
  infoprodutor_educador_pago: {
    titulo: '70% dos infoprodutores reportam aumento de renda',
    texto: 'Criadores que usam "Fórmula de Lançamento" (funil + automação) têm conversão 3x maior.',
    fonte: 'FGV ECMI / Hotmart, 2026',
  },
  servico_consultoria_profissional: {
    titulo: '73% dos pequenos negócios têm perfil em redes',
    texto: 'Instagram 64%, Facebook 41%, LinkedIn 6%. Mas só 27% conectam conteúdo à marca de forma forte.',
    fonte: 'Sebrae, 2024',
  },
  autoridade_personal_branding_b2b: {
    titulo: 'Autoridade B2B exige consistência de posicionamento',
    texto: 'Conteúdo especializado e provas de resultado ajudam a qualificar oportunidades comerciais.',
    fonte: 'Referência operacional de branding B2B',
  },
  pre_monetizacao_a_validar: {
    titulo: 'A proposta ainda está em validação',
    texto: 'Sinais de interesse e conversas com a audiência ajudam a orientar os primeiros testes de oferta.',
    fonte: 'Referência operacional de pré-monetização',
  },
  patrocinio_publicidade_marca: {
    titulo: '71% descobrem marcas por publis de creators',
    texto: '75% gostam de publicidade de criadores. Mas 70% não gostam quando vira SÓ publi. Autenticidade vence.',
    fonte: '#Publi 2026 (Brasil)',
  },
  monetizacao_nativa_plataforma: {
    titulo: 'YouTube lidera em renda (28,6% dos criadores)',
    texto: 'Mas maioria combina: anúncios + presentes + afiliação + publis. Monetização nativa raramente é fonte única.',
    fonte: 'ShortGenius, 2026',
  },
  membership_assinatura_comunidade: {
    titulo: 'Comunidades crescem como modelo de receita',
    texto: 'Assinaturas e memberships oferecem receita recorrente e relacionamento mais próximo.',
    fonte: 'Inferência — Tendência 2026',
  },
  saas_ferramenta: {
    titulo: 'SaaS para criadores é mercado em expansão',
    texto: 'Ferramentas de analytics, agendamento e automação são cada vez mais adotadas.',
    fonte: 'Inferência — Mercado 2026',
  },
}