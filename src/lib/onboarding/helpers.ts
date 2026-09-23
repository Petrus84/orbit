// src/lib/onboarding/helpers.ts
import type { ClientOnboarding } from '@/types/orbit'

export const FIELD_ORDER: (keyof ClientOnboarding)[] = [
  'total_followers',
  'total_followers_source',
  'bio_links',
  'cta_type',
  'funnel_maturity',
  'q1_engagement_period_notes',
  'q2_content_proxy_notes',
  'q3_misalignment_notes',
  'audience_nucleo_fiel_pct',
  'audience_consumo_passivo_pct',
  'audience_curiosidade_externa_pct',
  'audience_alta_rotatividade_pct',
  'observed_content_clusters',
  'setor_benchmark',
  'nicho',
  'proof_mechanism',
]

// VOCAB: texto curto de ajuda por campo, mostrado como tooltip (ícone "?")
// ao lado do título de cada campo na tela de edição. Fonte: VOCABULARY.md
// (versão longa, com exemplos, mantida em docs/ — este objeto é a versão
// condensada que cabe num popover).
export const VOCAB: Record<string, string> = {
  total_followers:
    'Contagem de contas que seguem o perfil no momento da análise. Base para calcular taxa de engajamento (ex.: 100 comentários ÷ 1.000 seguidores = 10%).',
  total_followers_source:
    'manual_print_confirmado = print do Instagram Insights confirmado por alguém do time. scrape_perfil_confirmado = robô leu o perfil e confirmou.',
  bio_links:
    'URLs cadastradas na bio. O Instagram só permite 1 link nativo — por isso é comum usar um agregador (Linktree, Beacons) quando há vários destinos.',
  cta_type:
    'link_direto = aponta pro site, quer clique direto. linktree_multilink = 5+ destinos diferentes. dm_comentario = pede contato/DM antes de mandar o link. nenhum = sem CTA identificado.',
  funnel_maturity:
    "funil_basico = só sabe que houve clique, não sabe o que aconteceu depois. implementado_fragmentado = rastreamento espalhado em ferramentas que não conversam. implementado_unificado = um pixel só, do clique até a compra. Só marque 'implementado' se houver ≥1 link ativo na bio E um CTA diferente de 'nenhum'.",
  q1: 'Quando e com que frequência o público interage. Preencha com números: janela analisada (ex.: "90 dias, mai–jul/26"), cadência (ex.: "1 post a cada 4 dias") e taxa por formato (ex.: "Reels 8,7% · estáticos 3,2%").',
  q2: 'Qual formato funciona como sinal de alcance vs. conversão — e se um não vira o outro. Ex.: "Reels geram 2,3x mais shares, mas os shares não convertem em clique de bio."',
  q3: 'A hipótese central de por que a conta não performa como o cliente espera — o gap entre quem é a audiência e o que está sendo vendido, com a consequência prática. Ex.: "71,7% da audiência é feminina, mas 80% dos produtos são masculinos."',
  audience:
    '· Núcleo fiel = comenta, salva, compartilha, volta várias vezes por semana (0% = sem comunidade; >40% = pode ser bolha)\n· Consumo passivo = curte e vê stories, mas não interage além disso (>60% = gera consumo, não ação)\n· Curiosidade externa = veio pelo algoritmo, engajamento zero, não volta (>30% = tráfego de passagem)\n· Alta rotatividade = clica e sai, comentário negativo, deixa de seguir (>10% = conteúdo gerando rejeição)\nOs 4 juntos devem somar ~100%.',
  observed_content_clusters:
    'Principais temas/formatos que aparecem nos posts do período analisado (texto livre).',
  setor_benchmark:
    'Categoria de negócio, usada pra comparar com concorrentes do mesmo tipo — o que é bom engajamento pra um e-commerce é diferente do que é bom pra um criador de conteúdo.',
  nicho:
    "Descrição específica do que a conta vende ou produz — mais granular que o setor (ex.: setor 'e-commerce', nicho 'itens importados').",
  proof_mechanism:
    'Como a conta demonstra que é legítima: associação de marca, clientes ativos, prova social em números, autoridade/expertise, urgência/escassez, ou nenhuma prova visível.',
  values_affect_source:
    'De onde vieram os dados deste onboarding: preenchido manualmente aqui, extraído do Instagram Insights, ou de relatório externo.',
  values_affect_confidence:
    'Confiança do registro inteiro (campo legado). L0 = medido direto. L1 = hipótese bem fundamentada. L2 = estimativa/chute educado. Prefira classificar por seção, abaixo — um valor só não representa campos de origem diferente.',
  confidence_section:
    'L0 = medido direto (ex.: print do Insights). L1 = hipótese bem fundamentada (padrão observado em vários posts). L2 = estimativa/chute educado.',
}

// Mantido por compatibilidade — quem já importava HELP continua funcionando.
export const HELP = VOCAB

export function isFilled(id: keyof ClientOnboarding, record: Partial<ClientOnboarding>): boolean {
  const v = record[id]
  if (id === 'bio_links') return Array.isArray(v) && v.length > 0
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  return true
}

export function completeness(record: Partial<ClientOnboarding> | null): number {
  if (!record) return 0
  const filled = FIELD_ORDER.filter((id) => isFilled(id, record)).length
  return Math.round((filled / FIELD_ORDER.length) * 100)
}

export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso.replace(' ', 'T'))
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function validateAudienceSum(record: Partial<ClientOnboarding>): {
  ok: boolean
  sum: number
} {
  const ids = [
    'audience_nucleo_fiel_pct',
    'audience_consumo_passivo_pct',
    'audience_curiosidade_externa_pct',
    'audience_alta_rotatividade_pct',
  ] as const
  const vals = ids.map((id) => record[id])
  const anyFilled = vals.some((v) => v !== null && v !== undefined && (v as unknown) !== '')
  if (!anyFilled) return { ok: true, sum: 0 }
  const sum = vals.reduce((a: number, v) => a + (parseFloat(String(v)) || 0), 0)
  const ok = Math.abs(sum - 100) < 0.15
  return { ok, sum }
}

export function summarizeChanges(
  before: Partial<ClientOnboarding> | null,
  after: Partial<ClientOnboarding>
): string[] {
  const labels: Record<string, string> = {
    total_followers: 'seguidores',
    total_followers_source: 'fonte de seguidores',
    bio_links: 'links da bio',
    cta_type: 'CTA',
    funnel_maturity: 'maturidade do funil',
    q1_engagement_period_notes: 'Q1',
    q2_content_proxy_notes: 'Q2',
    q3_misalignment_notes: 'Q3',
    audience_nucleo_fiel_pct: 'núcleo fiel',
    audience_consumo_passivo_pct: 'consumo passivo',
    audience_curiosidade_externa_pct: 'curiosidade externa',
    audience_alta_rotatividade_pct: 'alta rotatividade',
    observed_content_clusters: 'clusters de conteúdo',
    setor_benchmark: 'setor/benchmark',
    nicho: 'nicho',
    proof_mechanism: 'mecanismo de prova',
    values_affect_confidence: 'confiança (legado)',
    confidence_seguidores: 'confiança — seguidores',
    confidence_bio_funil: 'confiança — bio/cta/funil',
    confidence_diagnostico: 'confiança — diagnóstico',
    confidence_audiencia: 'confiança — audiência',
    confidence_negocio: 'confiança — negócio',
  }
  const changed: string[] = []
  Object.keys(labels).forEach((id) => {
    const b = JSON.stringify((before || {})[id as keyof ClientOnboarding])
    const a = JSON.stringify((after || {})[id as keyof ClientOnboarding])
    if (b !== a) changed.push(labels[id] as string)
  })
  return changed
}