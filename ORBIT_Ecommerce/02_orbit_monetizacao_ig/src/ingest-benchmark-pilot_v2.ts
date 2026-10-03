/**
 * ingest-benchmark-pilot.ts
 * ============================================================================
 * Piloto de benchmark real (gatilho D — protocolo_coleta_orbit.md).
 * Amostra real da Matriz Oficial ORBIT (n= x? perfis coletados até agora.
 *
 * Actor primário: apify/instagram-scraper (mais barato)
 * Fallback: apify/instagram-api-scraper (mais estável), só se o primário
 *   falhar ou devolver 0 posts.
 *
 * ============================================================================
 * ATUALIZAÇÃO (convergência com framework_arquetipos_monetizacao.md, v1.0)
 * ============================================================================
 * Esta revisão faz o código convergir com o "Framework de Arquétipos de
 * Monetização em Social Media" (relatório de consultoria fornecido) em 4
 * pontos onde a versão anterior divergia:
 *
 *  1. CLASSIFICAÇÃO POR SCORING, NÃO POR PRIORIDADE DE CHECAGEM.
 *     A versão anterior testava categorias em cascata (if/else) e o
 *     PRIMEIRO match virava a categoria primária — isso não é o que o
 *     framework pede. Seção 5.3 do framework exige: pontuar cada sinal
 *     (1 = menção implícita, 2 = CTA explícito, 3 = transação/link
 *     observável), somar por categoria, e a categoria de MAIOR SOMA vence.
 *     Secundária = 2º lugar, só se ≥60% do score do 1º (seção 5.3).
 *     Implementado agora em `classifyMonetizationModel()`.
 *
 *  2. ESTADO "A VALIDAR / PRÉ-MONETIZAÇÃO" (framework, seção 5.4).
 *     A versão anterior, na ausência de qualquer sinal positivo, caía por
 *     exclusão na Categoria 7 (Monetização Nativa) sempre que não havia
 *     link externo. Isso é um erro de classificação: ausência de sinal
 *     ≠ sinal positivo de monetização nativa. Agora, Categoria 7 só é
 *     atribuída havendo sinal POSITIVO (bônus de criador, gorjeta, "ad
 *     revenue", etc.). Sem nenhum sinal positivo em nenhuma categoria →
 *     'a_validar_pre_monetizacao', exatamente como o framework nomeia.
 *
 *  3. SEPARAÇÃO EXPLÍCITA DAS 3 CAMADAS (framework, seções 2.2-2.3).
 *     A variável antes se chamava `ACCOUNTS_BY_NICHO`, mas suas chaves
 *     sempre foram categorias de "setor de benchmark" (modelo de
 *     monetização), não nicho temático (moda, saúde, finanças...).
 *     Renomeada para `SETOR_BENCHMARK_ACCOUNTS`. O schema de saída agora
 *     grava `classification_matrix`, com `setor_benchmark` (o que este
 *     script de fato classifica), e placeholders explícitos e HONESTOS
 *     para `nicho` e `proof_mechanism` — dimensões que este script NÃO
 *     classifica automaticamente (não fingimos que sim), evitando repetir
 *     o erro de fundir as três camadas em uma coisa só.
 *
 *  4. LISTA DE CONTAS REAL, NÃO MAIS EXEMPLOS DE CELEBRIDADE.
 *     A lista curada anterior (Virginia, Bianca Andrade, Casimiro etc.)
 *     era ilustrativa. Substituída pelos 60 perfis reais já coletados e
 *     deduplicados na Base Unificada ORBIT (categorias 3 a 8). Categorias
 *     1 (E-commerce Direto) e 2 (Comissionamento/Afiliados) permanecem
 *     com array VAZIO de propósito — zero perfis foram coletados para
 *     elas até agora; não vou inventar contas de terceiros para preencher
 *     lacuna de coleta.
 *
 * LIMITAÇÃO HONESTA (mantida da versão anterior, ainda válida): a
 * Categoria 8 (Autoridade B2B) na especificação completa do framework
 * inclui "verificação do perfil dos comentaristas mais frequentes" — isso
 * NÃO está implementado aqui. Fica como heurística parcial (só bio da
 * própria conta) até isso virar decisão separada de custo/escopo.
 *
 * LIMITAÇÃO HONESTA NOVA: `maturidade_funil` (framework, seção 5.5) é
 * calculada aqui por heurística leve (presença de link + CTA de venda),
 * não por auditoria manual do funil. Está corretamente separada da
 * categoria de setor de benchmark (nunca influencia o score), mas é uma
 * aproximação, não uma medição precisa — tratar como sinal, não fato.
 *
 * Uso:
 *   APIFY_TOKEN=xxx npx tsx ingest-benchmark-pilot.ts
 *
 * Requer: npm install apify-client
 * ============================================================================
 */

import { ApifyClient } from 'apify-client'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

const FRAMEWORK_VERSION = 'v1.0' // framework_arquetipos_monetizacao.md — bump ao alterar categorias/regras de scoring


//
// ----------------------------------------------------------------------------
const SETOR_BENCHMARK_ACCOUNTS: Record<string, string[]> = {
  '1_ecommerce_direto': [
    "https://www.instagram.com/closetdamelcarvalho_/",
    "https://www.instagram.com/_donnafinaa/",
    "https://www.instagram.com/marcasdeluxobrasil/",
    "https://www.instagram.com/__moda.brasil__/",

  ],

  '2_comissionamento_afiliados': [
    // vazio — preencher com os perfis scraped 
  ],

  '3_infoprodutor': [
    'https://www.instagram.com/barberia.online_/',
    'https://www.instagram.com/marthagabriel/',
    'https://www.instagram.com/detailingacademia/',
    'https://www.instagram.com/digiprofe/',
    'https://www.instagram.com/agedigital__/',
  ],

  '4_servico_consultoria': [
    'https://www.instagram.com/carolcastrorodrigues.dra/',
    'https://www.instagram.com/dicasdesaudeecia/',
    'https://www.instagram.com/drtigresaude/',
    'https://www.instagram.com/alexandre_psicologia/',
    'https://www.instagram.com/ramielecalmonnutricionista/',
    'https://www.instagram.com/matheusmilanez/',
    'https://www.instagram.com/dricaroribeiro/',
    'https://www.instagram.com/canalsaudemn/',
    'https://www.instagram.com/dr.pedrochoy/',
    'https://www.instagram.com/sampasaudeemmovimento/',
    'https://www.instagram.com/nutri.tamarasandoval/',
  ],

  '5_patrocinio_publicidade': [
    'https://www.instagram.com/leo_iashow__/',
    'https://www.instagram.com/querubin_oficialll/',
    'https://www.instagram.com/mariahbella55_/',
    'https://www.instagram.com/leandroeavidanoseua/',
    'https://www.instagram.com/decabrandao_oficial/',
    'https://www.instagram.com/rodrigoamorimof/',
    'https://www.instagram.com/thismodernstyle/',
    'https://www.instagram.com/cristinaassiis/',
    'https://www.instagram.com/andreacantero22/',
    'https://www.instagram.com/sylwia_inspires/',
    'https://www.instagram.com/shayanhere__/',
    'https://www.instagram.com/beauty_with_ju/',
  ],

  '6_membership_comunidade': [
    'https://www.instagram.com/paraclosefriends/',
    'https://www.instagram.com/ricardocastro_/',
    'https://www.instagram.com/beyondmembers.club/',
    'https://www.instagram.com/zzsmembersclub/',
    'https://www.instagram.com/evermembersclub/',
    'https://www.instagram.com/mm_membersclub/',
  ],

  '7_monetizacao_nativa': [
    'https://www.instagram.com/memz/',
    'https://www.instagram.com/femalememes.ig/',
    'https://www.instagram.com/comedyslums/',
    'https://www.instagram.com/bien._.mexican/',
    'https://www.instagram.com/curiosidadesgm/',
    'https://www.instagram.com/clips.de.curiosidades/',
    'https://www.instagram.com/instazzin/',
    'https://www.instagram.com/cronchybread/',
    'https://www.instagram.com/memepustika/',
    'https://www.instagram.com/antisurtomemes/',
    'https://www.instagram.com/curiosidades0.2/',
    'https://www.instagram.com/curiosidades_infinita777/',
    'https://www.instagram.com/mundo_dedatos/',
    'https://www.instagram.com/memesnsjaka/',
  ],

  '8_autoridade_b2b': [
    'https://www.instagram.com/brunooliveiraoficial/',
    'https://www.instagram.com/marciogleisonn/',
    'https://www.instagram.com/felipecalculista/',
    'https://www.instagram.com/tiagoaviladesouza/',
    'https://www.instagram.com/wpcgestao/',
    'https://www.instagram.com/advogadoalderito/',
    'https://www.instagram.com/almirantepavoni/',
    'https://www.instagram.com/professoritamar/',
    'https://www.instagram.com/garcia_treinamentos/',
    'https://www.instagram.com/omestredospalcos/',
    'https://www.instagram.com/alyssoncosta/',
    'https://www.instagram.com/nexopsicossocialnr01/',
  ],
}

const RESULTS_LIMIT_PER_ACCOUNT = 30 // gatilho D: amostra mínima viável de benchmark, não histórico completo
const MIN_POSTS_FOR_DIAGNOSIS = 5    // protocolo_coleta_orbit.md, seção 2
const MIN_POSTS_FOR_FULL_DIAGNOSIS = 10
const DELAY_BETWEEN_ACCOUNTS_MS = 3000 // não martelar a API do Apify/Instagram

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'benchmark')

// ----------------------------------------------------------------------------
// TIPOS — schema canônico, batendo com orbit.ig_posts + o que já existe no
// diagnostico_orbit_contas.jsx (short/caption/date/tipo/likes/comments/views/plays)
// ----------------------------------------------------------------------------

type ApifyRawPost = {
  shortCode?: string
  caption?: string
  timestamp?: string
  type?: string          // "Image" | "Video" | "Sidecar"
  productType?: string   // "clips" costuma indicar Reels
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  latestComments?: Array<{ text?: string; ownerUsername?: string }>
}

type ContentFormat =
  | 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv' | 'unknown'

interface CleanPost {
  short_code: string
  caption: string | null
  timestamp: string
  content_format: ContentFormat
  likes: number | null
  comments: number | null
  video_view_count: number | null
  video_play_count: number | null
  latest_comments: string[]
  anomalies: string[]
}

interface AccountResult {
  handle: string
  setor_benchmark_key: string // chave usada em SETOR_BENCHMARK_ACCOUNTS (ex.: '4_servico_consultoria')
  url: string
  actor_used: 'apify/instagram-scraper' | 'apify/instagram-api-scraper' | 'FAILED'
  scraped_at: string
  total_posts: number
  valid_posts: number
  diagnosis_tier: 'insuficiente' | 'leve' | 'completo'
  posts: CleanPost[]
  account_level_anomalies: string[]
  monetization: MonetizationResult
  classification_matrix: ClassificationMatrixEntry
}

// ----------------------------------------------------------------------------
// PERFIL (biography/externalUrl) — necessário pra classificação de
// Modelo de Monetização, que os posts sozinhos não entregam.
// ----------------------------------------------------------------------------

type ApifyRawProfile = {
  biography?: string
  externalUrl?: string
  externalUrls?: Array<{ url?: string }>
}

interface ProfileSnapshot {
  biography: string
  external_url: string | null
  fetched: boolean // false quando o profile-fetch falhou — classificador precisa saber disso pra não tratar ausência de link como sinal de Categoria 7
}

const EMPTY_PROFILE: ProfileSnapshot = { biography: '', external_url: null, fetched: false }

// ----------------------------------------------------------------------------
// VALIDAÇÃO / ANOMALIAS
// Achado direto do seu dataset: eupetruchio84 tem um post com likesCount=-1.
// Guard aqui evita que isso contamine qualquer correlação calculada depois.
// ----------------------------------------------------------------------------

function validateAndClean(raw: ApifyRawPost): CleanPost {
  const anomalies: string[] = []

  let likes: number | null = raw.likesCount ?? null
  if (likes !== null && likes < 0) {
    anomalies.push(`likesCount negativo (${likes}) — provável post removido/oculto, zerado para null`)
    likes = null
  }

  let comments: number | null = raw.commentsCount ?? null
  if (comments !== null && comments < 0) {
    anomalies.push(`commentsCount negativo (${comments}) — zerado para null`)
    comments = null
  }

  let views: number | null = raw.videoViewCount ?? null
  let plays: number | null = raw.videoPlayCount ?? null
  if (views !== null && plays !== null && views > plays) {
    // views (retenção) não deveria exceder plays (impressões do player)
    anomalies.push(`videoViewCount (${views}) > videoPlayCount (${plays}) — inconsistente, mantido bruto para revisão manual`)
  }

  if (!raw.timestamp) {
    anomalies.push('timestamp ausente — cadência não pode ser calculada para este post')
  }

  if (!raw.shortCode) {
    anomalies.push('shortCode ausente')
  }

  return {
    short_code: raw.shortCode ?? 'UNKNOWN',
    caption: raw.caption ?? null,
    timestamp: raw.timestamp ?? '',
    content_format: mapContentFormat(raw.type, raw.productType),
    likes,
    comments,
    video_view_count: views,
    video_play_count: plays,
    latest_comments: (raw.latestComments ?? [])
      .map((c) => c.text)
      .filter((t): t is string => Boolean(t)),
    anomalies,
  }
}

function mapContentFormat(type?: string, productType?: string): ContentFormat {
  if (productType === 'clips') return 'reel'
  switch (type) {
    case 'Image':
      return 'static_post'
    case 'Sidecar':
      return 'carousel'
    case 'Video':
      return 'reel' // Apify raramente distingue Reels de vídeo de feed fora de productType
    default:
      return 'unknown'
  }
}

function classifyDiagnosisTier(validPostCount: number): AccountResult['diagnosis_tier'] {
  if (validPostCount < MIN_POSTS_FOR_DIAGNOSIS) return 'insuficiente'
  if (validPostCount < MIN_POSTS_FOR_FULL_DIAGNOSIS) return 'leve'
  return 'completo'
}

// ----------------------------------------------------------------------------
// SETOR DE BENCHMARK — 8 categorias (framework_arquetipos_monetizacao.md,
// seção 4). Esse é o único eixo que este script classifica automaticamente.
// "Nicho" e "proof_mechanism" são dimensões IRMÃS, deliberadamente FORA do
// escopo deste classificador (framework, seção 2) — ver ClassificationMatrixEntry.
//
// Cada regex-list abaixo é uma LISTA VIVA, não exaustiva — comece com o que
// veio das amostras reais (Hotmart/Kiwify/Eduzz, Linktree/Beacons, etc.) e
// vá expandindo conforme aparecerem falsos negativos nos pilotos.
// ----------------------------------------------------------------------------

type MonetizationCategory =
  | '1_ecommerce_direto'
  | '2_comissionamento_afiliados'
  | '3_infoprodutor'
  | '4_servico_consultoria'
  | '5_patrocinio_publicidade'
  | '6_membership_comunidade'
  | '7_monetizacao_nativa'
  | '8_autoridade_b2b'
  | 'a_validar_pre_monetizacao' // framework, seção 5.4 — nunca forçar em categoria sem sinal positivo

interface CategoryMatch {
  category: MonetizationCategory
  score: number      // soma dos pesos dos sinais que bateram nesta categoria (framework, seção 5.3)
  evidence: string[] // o que exatamente bateu (trecho de bio, domínio, hashtag) — auditável, igual ao padrão de `anomalies`
}

interface MonetizationResult {
  primary: MonetizationCategory
  secondary: MonetizationCategory | null // só preenchido se score ≥ 60% do primário (framework, seção 5.3)
  matches: CategoryMatch[]               // todas as categorias com score > 0, ordenadas por score desc
  manual_review_recommended: boolean     // true quando há secundária (perfil híbrido) OU classificação 'a_validar_pre_monetizacao'
  category_8_note: string // lembrete permanente de que a análise de comentaristas (spec completa da Cat.8) não roda aqui
}

// Framework, seção 2.3 — matriz multidimensional. `nicho` e `proof_mechanism`
// são gravados como placeholders HONESTOS (este script não os classifica),
// nunca fundidos ao `setor_benchmark_primario`. `maturidade_funil` é
// heurística leve, propositalmente sem influência no score de setor.
interface ClassificationMatrixEntry {
  setor_benchmark_primario: MonetizationCategory
  setor_benchmark_secundario: MonetizationCategory | null
  nicho: string
  proof_mechanism: string
  maturidade_funil: 'nao_implementado' | 'parcial' | 'implementado' | 'indeterminado'
  rede: 'instagram'
  data_classificacao: string
  versao_framework: string
}

// --- domínios/plataformas conhecidos por categoria (expandir conforme achados reais) ---
const DOMAINS_AGGREGATOR = ['linktr.ee', 'beacons.ai', 'linkin.bio', 'lnk.bio', 'liketoknow.it', 'ltk.']
const DOMAINS_INFOPRODUTO = ['hotmart.com', 'kiwify.com', 'eduzz.com', 'greenn.com.br', 'monetizze.com.br']
const DOMAINS_AGENDAMENTO = ['doctoralia.', 'calendly.com', 'wa.me'] // wa.me só conta como sinal de cat.4 se combinado com título profissional na bio
const DOMAINS_MEMBERSHIP = ['patreon.com', 'finclass.com.br']

// --- padrões textuais por categoria ---
const RX_PRECO_CTA = /\b(compre no site|compre agora|link na bio|loja oficial|R\$\s?\d)/i
const RX_CUPOM_AFILIADO = /\b(cupom|c[oó]digo de desconto|achadinhos?|compre o look|link nos stories)/i
const RX_INFOPRODUTO_TEXTO = /\b(vagas? (abertas?|limitadas?)|turma fechada|imers[aã]o|mentoria|inscri[cç][oõ]es abertas|[uú]ltimos dias|carrinho aberto)/i
const RX_REGISTRO_PROFISSIONAL = /\b(CRM[\s\-\/]?\d|CRO[\s\-\/]?\d|CRN[\s\-\/]?\d|OAB[\s\-\/]?\d|CREA[\s\-\/]?\d|Dr\.|Dra\.|Advogad[oa]|Nutricionista|Odontolog)/i
const RX_AGENDAMENTO_TEXTO = /\b(agende sua consulta|marque sua avalia[cç][aã]o|agendamento)/i
const RX_PUBLI = /(#publi\b|#ad\b|#parceriapaga|paid_?partnership)/i
const RX_MEMBERSHIP_TEXTO = /\b(comunidade fechada|clube de assinantes|assinatura mensal|assinatura anual)/i
const RX_B2B_BIO = /\b(founder|co-?founder|CEO|conselheiro|presidente da|s[oó]cio(?:-fundador)?)\b/i
// Sinal POSITIVO de monetização nativa de plataforma — antes o código caía
// aqui por EXCLUSÃO (sem link = nativa), o que o framework não sustenta.
const RX_NATIVA_TEXTO = /\b(b[oô]nus de criador|fundo de criadores|creator fund|monetizad[oa] pel[oa] (instagram|tiktok|meta)|gorjetas?|presentes? virtuais?|ad revenue|receita de an[uú]ncios)/i

function domainMatches(url: string | null, list: string[]): string | null {
  if (!url) return null
  const hit = list.find((d) => url.toLowerCase().includes(d))
  return hit ?? null
}

/**
 * Classifica o Setor de Benchmark (Modelo de Monetização) de uma conta.
 *
 * Implementa o método de scoring do framework (seção 5.3), não mais uma
 * cascata de prioridade:
 *   - cada sinal soma pontos à categoria correspondente, ponderado por
 *     força de evidência: 1 = menção implícita, 2 = CTA explícito,
 *     3 = transação/link ativo observável;
 *   - categoria com MAIOR soma = primária;
 *   - segunda categoria entra como secundária SE seu score for ≥ 60% do
 *     score da primária (perfil híbrido, sinalizado para revisão manual);
 *   - se NENHUMA categoria pontuar, o perfil vai para
 *     'a_validar_pre_monetizacao' (framework, seção 5.4) — nunca forçado
 *     em categoria por conveniência.
 */
function classifyMonetizationModel(
  profile: ProfileSnapshot,
  posts: CleanPost[]
): MonetizationResult {
  const captions = posts.map((p) => p.caption ?? '').join(' \n ')
  const bio = profile.biography ?? ''
  const url = profile.external_url

  const scores = new Map<MonetizationCategory, { score: number; evidence: string[] }>()
  const addSignal = (category: MonetizationCategory, points: number, evidence: string) => {
    if (!evidence) return
    const entry = scores.get(category) ?? { score: 0, evidence: [] }
    entry.score += points
    entry.evidence.push(evidence)
    scores.set(category, entry)
  }

  // Cat 4 — Serviço/Consultoria
  const regMatch = bio.match(RX_REGISTRO_PROFISSIONAL)?.[0]
  if (regMatch) {
    addSignal('4_servico_consultoria', 2, `bio contém registro/título profissional: "${regMatch}"`) // CTA/identidade explícita
  }
  const agendaDomain = domainMatches(url, DOMAINS_AGENDAMENTO)
  if (RX_AGENDAMENTO_TEXTO.test(captions) && agendaDomain) {
    addSignal('4_servico_consultoria', 3, `link ativo de agendamento (${agendaDomain}) + legenda com CTA de agendamento`) // transação observável
  }

  // Cat 3 — Infoprodutor
  const infoDomain = domainMatches(url, DOMAINS_INFOPRODUTO)
  if (infoDomain) {
    addSignal('3_infoprodutor', 3, `external_url aponta pra checkout de infoproduto (${infoDomain})`)
  }
  const infoTexto = captions.match(RX_INFOPRODUTO_TEXTO)?.[0]
  if (infoTexto) {
    addSignal('3_infoprodutor', 2, `legenda com padrão de lançamento: "${infoTexto}"`)
  }

  // Cat 6 — Membership
  const membershipDomain = domainMatches(url, DOMAINS_MEMBERSHIP)
  if (membershipDomain) {
    addSignal('6_membership_comunidade', 3, `external_url é plataforma de membership (${membershipDomain})`)
  }
  if (RX_MEMBERSHIP_TEXTO.test(captions)) {
    addSignal('6_membership_comunidade', 2, 'legenda com padrão de assinatura recorrente')
  }

  // Cat 1 — E-commerce direto: link próprio (não agregador/infoproduto/membership) + preço/CTA de loja
  const isKnownAggregatorOrPlatform = domainMatches(url, [...DOMAINS_AGGREGATOR, ...DOMAINS_INFOPRODUTO, ...DOMAINS_MEMBERSHIP])
  const precoCta = captions.match(RX_PRECO_CTA)?.[0]
  if (url && !isKnownAggregatorOrPlatform && precoCta) {
    addSignal('1_ecommerce_direto', 3, `external_url próprio (não agregador/infoproduto/membership) + legenda com CTA de venda: "${precoCta}"`)
  } else if (precoCta) {
    addSignal('1_ecommerce_direto', 1, `legenda com CTA de venda ("${precoCta}") sem link próprio confirmado`) // menção implícita, mais fraca
  }

  // Cat 2 — Comissionamento/Afiliados
  const aggDomain = domainMatches(url, DOMAINS_AGGREGATOR)
  if (aggDomain) {
    addSignal('2_comissionamento_afiliados', 3, `external_url é agregador de links (${aggDomain})`)
  }
  const cupomTexto = captions.match(RX_CUPOM_AFILIADO)?.[0]
  if (cupomTexto) {
    addSignal('2_comissionamento_afiliados', 2, `legenda com padrão de afiliado: "${cupomTexto}"`)
  }

  // Cat 5 — Patrocínio/Publicidade
  const publiTexto = captions.match(RX_PUBLI)?.[0]
  if (publiTexto) {
    addSignal('5_patrocinio_publicidade', 3, `legenda com marcação de publicidade paga: "${publiTexto}"`) // tag oficial da plataforma = sinal forte
  }

  // Cat 8 — Autoridade B2B (heurística PARCIAL — só bio, sem análise de comentaristas, ver nota no topo do arquivo)
  const b2bMatch = bio.match(RX_B2B_BIO)?.[0]
  if (b2bMatch && !url) {
    addSignal('8_autoridade_b2b', 1, `bio contém termo de cargo executivo/autoridade: "${b2bMatch}", sem link de venda direta`) // monetização indireta = sinal mais fraco por natureza
  }

  // Cat 7 — Monetização Nativa: agora exige SINAL POSITIVO, não mais exclusão
  const nativaTexto = captions.match(RX_NATIVA_TEXTO)?.[0] ?? bio.match(RX_NATIVA_TEXTO)?.[0]
  if (nativaTexto) {
    addSignal('7_monetizacao_nativa', 2, `bio/legenda menciona monetização nativa de plataforma: "${nativaTexto}"`)
  }

  const ranked: CategoryMatch[] = Array.from(scores.entries())
    .map(([category, v]) => ({ category, score: v.score, evidence: v.evidence }))
    .sort((a, b) => b.score - a.score)

  const category8Note =
    'Cat.8 nesta versão só usa bio própria; verificação do perfil dos comentaristas mais frequentes (spec completa) não está implementada.'

  if (ranked.length === 0) {
    // Framework, seção 5.4: nunca forçar categoria sem sinal positivo.
    return {
      primary: 'a_validar_pre_monetizacao',
      secondary: null,
      matches: [],
      manual_review_recommended: true,
      category_8_note: category8Note,
    }
  }

  const primary = ranked[0]
  const secondaryCandidate = ranked[1]
  const secondary =
    secondaryCandidate && secondaryCandidate.score >= 0.6 * primary.score ? secondaryCandidate.category : null

  return {
    primary: primary.category,
    secondary,
    matches: ranked,
    manual_review_recommended: secondary !== null, // perfil híbrido = precisa de olho humano
    category_8_note: category8Note,
  }
}

/**
 * Heurística LEVE de maturidade de funil (framework, seção 5.5).
 * Propositalmente NUNCA usada para influenciar o score de setor de
 * benchmark — é um atributo transversal, registrado à parte.
 */
function estimateFunnelMaturity(profile: ProfileSnapshot, captions: string): ClassificationMatrixEntry['maturidade_funil'] {
  if (!profile.fetched) return 'indeterminado'
  const hasLink = Boolean(profile.external_url)
  const hasExplicitCta = RX_PRECO_CTA.test(captions) || RX_AGENDAMENTO_TEXTO.test(captions) || RX_INFOPRODUTO_TEXTO.test(captions)
  if (hasLink && hasExplicitCta) return 'implementado'
  if (hasLink || hasExplicitCta) return 'parcial'
  return 'nao_implementado'
}

function buildClassificationMatrix(
  monetization: MonetizationResult,
  profile: ProfileSnapshot,
  captions: string
): ClassificationMatrixEntry {
  return {
    setor_benchmark_primario: monetization.primary,
    setor_benchmark_secundario: monetization.secondary,
    // Dimensões IRMÃS ao setor de benchmark (framework, seção 2) — este
    // script não as classifica; gravar honestamente como não-classificadas
    // em vez de inferir/adivinhar, para não fundir camadas (seção 2.2).
    nicho: 'não classificado nesta versão — dimensão separada do setor de benchmark (framework, seção 2)',
    proof_mechanism: 'não classificado nesta versão — dimensão separada do setor de benchmark (framework, seção 2)',
    maturidade_funil: estimateFunnelMaturity(profile, captions),
    rede: 'instagram',
    data_classificacao: new Date().toISOString(),
    versao_framework: FRAMEWORK_VERSION,
  }
}

// ----------------------------------------------------------------------------
// APIFY — actor primário com fallback
// ----------------------------------------------------------------------------

function buildInput(profileUrl: string) {
  // Sem searchType/searchLimit — eram parâmetros mortos quando directUrls
  // está preenchido, retirados de propósito.
  return {
    addParentData: false,
    directUrls: [profileUrl],
    resultsType: 'posts' as const,
    resultsLimit: RESULTS_LIMIT_PER_ACCOUNT,
  }
}

async function runActor(
  client: ApifyClient,
  actorId: string,
  profileUrl: string
): Promise<ApifyRawPost[]> {
  const run = await client.actor(actorId).call(buildInput(profileUrl))
  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  return items as unknown as ApifyRawPost[]
}

async function scrapeAccountWithFallback(
  client: ApifyClient,
  profileUrl: string
): Promise<{ items: ApifyRawPost[]; actorUsed: AccountResult['actor_used'] }> {
  try {
    const items = await runActor(client, 'apify/instagram-scraper', profileUrl)
    if (items.length > 0) {
      return { items, actorUsed: 'apify/instagram-scraper' }
    }
    console.warn(`  ⚠️  instagram-scraper devolveu 0 posts para ${profileUrl}, tentando fallback...`)
  } catch (err) {
    console.warn(`  ⚠️  instagram-scraper falhou para ${profileUrl}: ${(err as Error).message} — tentando fallback...`)
  }

  try {
    const items = await runActor(client, 'apify/instagram-api-scraper', profileUrl)
    return { items, actorUsed: 'apify/instagram-api-scraper' }
  } catch (err) {
    console.error(`  ❌ fallback também falhou para ${profileUrl}: ${(err as Error).message}`)
    return { items: [], actorUsed: 'FAILED' }
  }
}

function extractHandle(profileUrl: string): string {
  const match = profileUrl.match(/instagram\.com\/([^/?]+)/)
  return match ? match[1] : profileUrl
}

// ----------------------------------------------------------------------------
// PROFILE FETCH (bio/externalUrl) — reusa os MESMOS 2 actors já declarados
// acima, só muda resultsType para 'details'. Comentário honesto: o nome
// exato do campo (`externalUrl` vs `externalUrls[0].url`) varia entre
// versões do actor — verificar contra uma chamada real antes de confiar
// cegamente; deixei os dois caminhos cobertos abaixo por precaução, não
// porque testei os dois contra o payload real.
// ----------------------------------------------------------------------------

function buildProfileInput(profileUrl: string) {
  return {
    directUrls: [profileUrl],
    resultsType: 'details' as const,
    resultsLimit: 1,
  }
}

function extractExternalUrl(raw: ApifyRawProfile): string | null {
  if (raw.externalUrl) return raw.externalUrl
  if (raw.externalUrls && raw.externalUrls.length > 0) {
    return raw.externalUrls[0].url ?? null
  }
  return null
}

async function fetchProfileWithFallback(
  client: ApifyClient,
  profileUrl: string
): Promise<ProfileSnapshot> {
  for (const actorId of ['apify/instagram-scraper', 'apify/instagram-api-scraper'] as const) {
    try {
      const run = await client.actor(actorId).call(buildProfileInput(profileUrl))
      const { items } = await client.dataset(run.defaultDatasetId).listItems()
      const raw = items[0] as unknown as ApifyRawProfile | undefined
      if (raw) {
        return {
          biography: raw.biography ?? '',
          external_url: extractExternalUrl(raw),
          fetched: true,
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  profile-fetch via ${actorId} falhou para ${profileUrl}: ${(err as Error).message}`)
    }
  }
  console.warn(`  ⚠️  não foi possível obter bio/externalUrl de ${profileUrl} — classificação de monetização ficará limitada a captions`)
  return EMPTY_PROFILE
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main() {
  const token = process.env.APIFY_TOKEN
  if (!token) {
    console.error('❌ APIFY_TOKEN não definido no ambiente. Abortando.')
    process.exit(1)
  }

  const totalAccounts = Object.values(SETOR_BENCHMARK_ACCOUNTS).flat().length
  if (totalAccounts === 0) {
    console.error(
      '❌ SETOR_BENCHMARK_ACCOUNTS está vazio. Preencha as URLs de perfil ' +
        'antes de rodar — não vou inventar contas de terceiros.'
    )
    process.exit(1)
  }

  console.log(`Total de contas nesta rodada: ${totalAccounts}`)
  for (const [setor, urls] of Object.entries(SETOR_BENCHMARK_ACCOUNTS)) {
    if (urls.length === 0) {
      console.log(`  ⚠️  ${setor}: 0 contas — sem coleta ainda`)
    }
  }

  const client = new ApifyClient({ token })
  const summary: AccountResult[] = []

  for (const [setorKey, urls] of Object.entries(SETOR_BENCHMARK_ACCOUNTS)) {
    if (urls.length === 0) continue
    console.log(`\n=== Setor de Benchmark: ${setorKey} (${urls.length} contas) ===`)

    for (const url of urls) {
      const handle = extractHandle(url)
      console.log(`→ ${handle}`)

      const { items, actorUsed } = await scrapeAccountWithFallback(client, url)
      const cleanedPosts = items.map(validateAndClean)
      const validPosts = cleanedPosts.filter((p) => p.timestamp && p.short_code !== 'UNKNOWN')

      const profile = await fetchProfileWithFallback(client, url)
      const monetization = classifyMonetizationModel(profile, cleanedPosts)
      const captions = cleanedPosts.map((p) => p.caption ?? '').join(' \n ')
      const classificationMatrix = buildClassificationMatrix(monetization, profile, captions)

      const accountAnomalies: string[] = []
      if (validPosts.length < MIN_POSTS_FOR_DIAGNOSIS) {
        accountAnomalies.push(
          `Apenas ${validPosts.length} posts válidos — abaixo do mínimo (${MIN_POSTS_FOR_DIAGNOSIS}). ` +
            `Amostra insuficiente, não entra no cálculo de correlação/benchmark.`
        )
      }
      if (!profile.fetched) {
        accountAnomalies.push('profile-fetch falhou — classificação de monetização baseada só em captions, sem bio/externalUrl')
      }

      const result: AccountResult = {
        handle,
        setor_benchmark_key: setorKey,
        url,
        actor_used: actorUsed,
        scraped_at: new Date().toISOString(),
        total_posts: items.length,
        valid_posts: validPosts.length,
        diagnosis_tier: classifyDiagnosisTier(validPosts.length),
        posts: cleanedPosts,
        account_level_anomalies: accountAnomalies,
        monetization,
        classification_matrix: classificationMatrix,
      }

      summary.push(result)

      const dir = path.join(OUTPUT_DIR, setorKey)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(
        path.join(dir, `${handle}.json`),
        JSON.stringify(result, null, 2),
        'utf-8'
      )

      const anomalyCount = cleanedPosts.reduce((n, p) => n + p.anomalies.length, 0)
      console.log(
        `  ✓ ${validPosts.length}/${items.length} posts válidos (${result.diagnosis_tier}) ` +
          `via ${actorUsed}${anomalyCount ? `, ${anomalyCount} anomalias sinalizadas` : ''}`
      )
      console.log(
        `    → Monetização: ${monetization.primary}` +
          `${monetization.secondary ? ` + ${monetization.secondary} (secundária)` : ''}` +
          `${monetization.manual_review_recommended ? ' (⚠️ revisão manual recomendada)' : ''}`
      )

      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_ACCOUNTS_MS))
    }
  }

  // Manifesto do piloto
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(summary, null, 2), 'utf-8')

  const insuficientes = summary.filter((r) => r.diagnosis_tier === 'insuficiente')
  console.log(`\n=== Resumo do piloto ===`)
  console.log(`Contas raspadas: ${summary.length}`)
  console.log(`Contas com amostra insuficiente (<${MIN_POSTS_FOR_DIAGNOSIS} posts): ${insuficientes.length}`)
  if (insuficientes.length > 0) {
    console.log(`  → ${insuficientes.map((r) => r.handle).join(', ')}`)
  }

  console.log(`\n=== Setor de Benchmark (classificação automática, primária) ===`)
  const byCategory = new Map<string, string[]>()
  for (const r of summary) {
    const list = byCategory.get(r.monetization.primary) ?? []
    list.push(r.handle)
    byCategory.set(r.monetization.primary, list)
  }
  for (const [cat, handles] of byCategory.entries()) {
    console.log(`  ${cat}: ${handles.join(', ')}`)
  }

  const aValidar = summary.filter((r) => r.monetization.primary === 'a_validar_pre_monetizacao')
  console.log(`\n📋 ${aValidar.length} conta(s) sem sinal positivo de monetização — 'a_validar_pre_monetizacao':`)
  if (aValidar.length > 0) {
    console.log(`  → ${aValidar.map((r) => r.handle).join(', ')}`)
  }

  const precisamRevisao = summary.filter((r) => r.monetization.secondary !== null)
  console.log(`\n⚠️  ${precisamRevisao.length} conta(s) com categoria secundária (perfil híbrido), revisão manual recomendada:`)
  if (precisamRevisao.length > 0) {
    console.log(
      `  → ${precisamRevisao
        .map((r) => `${r.handle} (${r.monetization.primary} + ${r.monetization.secondary})`)
        .join(', ')}`
    )
  }

  console.log(`\nManifesto salvo em: ${manifestPath}`)
  console.log(`\nPróximo passo: compute-real-correlations.ts lê este manifesto e`)
  console.log(`recalcula a matriz de correlação real, pra comparar contra a`)
  console.log(`matriz "Teórica" (simulada) de ontem.`)
  console.log(`\nLembrete de coleta: categorias 1 (E-commerce Direto) e 2`)
  console.log(`(Comissionamento/Afiliados) seguem sem nenhum perfil — priorizar`)
  console.log(`próximo scrap antes do próximo cálculo de correlação, ou a`)
  console.log(`matriz real ficará incompleta em 2 das 8 categorias.`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})