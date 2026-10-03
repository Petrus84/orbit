// ============================================================================
// ingest.ts — Coleta + limpeza + classificação de setor + captura de porte
//
// Este arquivo consolida o pipeline v2 (classificação de monetização por
// score ponderado) com os patches v3 (fator N-seguidores) discutidos nas
// mensagens anteriores, e adiciona UMA peça nova que faltava: histórico de
// seguidores entre execuções, porque "Visitas ao Perfil" (Δfollowers como
// proxy de tendência) exige múltiplos pontos no tempo — uma execução única
// nunca vai produzir isso, não importa quantas contas você raspe.
//
// Este script não inventa nenhum campo que a Apify não devolve. Onde um
// dado não é publicamente obtível (é o caso de Saves — Instagram nunca
// expõe contagem de saves de terceiros, nem via instagram-scraper nem via
// instagram-api-scraper), o campo fica null e a responsabilidade de avisar
// isso passa pro compute.ts, não pra este arquivo fingir que coletou algo.
// ============================================================================

export type {
  AccountResult,
  CleanPost,
  ProfileSnapshot,
  MonetizationCategory,
  FollowerSnapshotLine,
}
export { FOLLOWER_TIERS, tierForFollowers, normalizeHandle } from './tiers.js'
// import 'dotenv/config' // lê APIFY_TOKEN (e qualquer outra var) de .env na raiz do projeto — sem isto, process.env.APIFY_TOKEN só existe se exportado manualmente no shell, e o script aborta sempre no check abaixo
import { ApifyClient } from 'apify-client'
import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'fs'
import path from 'path'
import { tierForFollowers, normalizeHandle } from './tiers'

// ----------------------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------------------

const FRAMEWORK_VERSION = 'v3.1' // bump: paidPartnership como sinal nativo de Cat.5, domínios de afiliado BR expandidos (Cat.2)

const SETOR_BENCHMARK_ACCOUNTS: Record<string, string[]> = {
  '1_ecommerce_direto': [
    'https://www.instagram.com/closetdamelcarvalho_/',
  ],
  '2_comissionamento_afiliados': [
    // vazio — DELIBERADAMENTE, mesmo após revisar os 3 perfis coletados via
    // instagram-niche-finder em 2026-08-04 (tapioca_agencia, firedigitalpe,
    // elienedaniel_reserva). Nenhum dos 3 qualifica:
    //   - tapioca_agencia (712k): coach de marketing digital, sem link de
    //     afiliado/cupom na bio; também está ACIMA do teto Mid-Macro (500k).
    //   - firedigitalpe (9.4k): agência de social media (serviço, não
    //     comissionamento); também está ABAIXO do piso Micro (10k).
    //   - elienedaniel_reserva (105k): encaixa na faixa Mid-Macro, mas sem
    //     external_url e sem cupom/achadinhos/vitrine na bio — nenhum sinal
    //     que o próprio classifyMonetizationModel() abaixo reconheceria.
    // Forçar qualquer um destes aqui corromperia a auditabilidade do score
    // (Cat.2 apareceria como "coletada" sem nenhuma evidência real).
    //
    // Meta desta categoria (Matriz de Progresso ORBIT, aba "Matriz de
    // Progresso"): 2 perfis Micro (10k-50k) + 1 Meso (51k-100k) +
    // 1 Mid-Macro (101k-500k) = 4 perfis mínimos. 0/4 coletados.
    //
    // Termos de busca melhores para a próxima rodada do niche-finder (os
    // usados em 04/08 — "marketing digital", "programa afiliado" — trazem
    // agências/coaches, não afiliados de fato):
    //   "cupom de desconto", "achadinhos shopee", "meu link shopee",
    //   "vitrine amazon", "code de desconto", "link na bio compre",
    //   hashtags: #achadinhos #cupomdedesconto #shopeebrasil #vitrineoficial
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

const RESULTS_LIMIT_PER_ACCOUNT = 30
const MIN_POSTS_FOR_DIAGNOSIS = 5
const MIN_POSTS_FOR_FULL_DIAGNOSIS = 10
const DELAY_BETWEEN_ACCOUNTS_MS = 3000

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'benchmark')
const FOLLOWERS_HISTORY_DIR = path.join(OUTPUT_DIR, 'followers_history')
// FOLLOWER_TIERS e tierForFollowers agora vêm de ./tiers (SSOT compartilhado
// com compute.ts) — ver header do arquivo para o motivo da mudança.

// ----------------------------------------------------------------------------
// TIPOS — POSTS
// ----------------------------------------------------------------------------

type ApifyRawPost = {
  shortCode?: string
  caption?: string
  timestamp?: string
  type?: string
  productType?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
  latestComments?: Array<{ text?: string; ownerUsername?: string }>
  /** confirmado no payload real do apify/instagram-scraper (amostra de
   *  2026-08-01, conta ricamorim): campo booleano nativo do Instagram,
   *  mais confiável que regex em #publi/#ad porque a maioria dos posts
   *  patrocinados no BR não usa a hashtag em texto — usa só a tag nativa
   *  "Parceria paga com..." que a Meta injeta, e é isso que vira este campo. */
  paidPartnership?: boolean
}

type ContentFormat = 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv' | 'unknown'

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
  paid_partnership: boolean | null // null = campo não veio no payload (ex.: fallback via instagram-api-scraper, que não confirma devolver este campo)
  anomalies: string[]
}

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

  const views: number | null = raw.videoViewCount ?? null
  const plays: number | null = raw.videoPlayCount ?? null
  if (views !== null && plays !== null && views > plays) {
    anomalies.push(`videoViewCount (${views}) > videoPlayCount (${plays}) — inconsistente, mantido bruto para revisão manual`)
  }

  if (!raw.timestamp) anomalies.push('timestamp ausente — cadência não pode ser calculada para este post')
  if (!raw.shortCode) anomalies.push('shortCode ausente')

  return {
    short_code: raw.shortCode ?? 'UNKNOWN',
    caption: raw.caption ?? null,
    timestamp: raw.timestamp ?? '',
    content_format: mapContentFormat(raw.type, raw.productType),
    likes,
    comments,
    video_view_count: views,
    video_play_count: plays,
    latest_comments: (raw.latestComments ?? []).map((c) => c.text).filter((t): t is string => Boolean(t)),
    paid_partnership: typeof raw.paidPartnership === 'boolean' ? raw.paidPartnership : null,
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
      return 'reel'
    default:
      return 'unknown'
  }
}

function classifyDiagnosisTier(validPostCount: number): 'insuficiente' | 'leve' | 'completo' {
  if (validPostCount < MIN_POSTS_FOR_DIAGNOSIS) return 'insuficiente'
  if (validPostCount < MIN_POSTS_FOR_FULL_DIAGNOSIS) return 'leve'
  return 'completo'
}

// ----------------------------------------------------------------------------
// TIPOS — PERFIL (bio, external_url, porte)
// ----------------------------------------------------------------------------

type ApifyRawProfile = {
  biography?: string
  externalUrl?: string
  externalUrls?: Array<{ url?: string }>
  followersCount?: number
  followerCount?: number
  followers?: number
  followsCount?: number
  followingCount?: number
  following?: number
  postsCount?: number
  mediaCount?: number
}

interface ProfileSnapshot {
  biography: string
  external_url: string | null
  fetched: boolean
  followers_count: number | null
  following_count: number | null
  posts_count: number | null
  follower_stats_fetched: boolean
}

const EMPTY_PROFILE: ProfileSnapshot = {
  biography: '',
  external_url: null,
  fetched: false,
  followers_count: null,
  following_count: null,
  posts_count: null,
  follower_stats_fetched: false,
}

function extractExternalUrl(raw: ApifyRawProfile): string | null {
  if (raw.externalUrl) return raw.externalUrl
  if (raw.externalUrls && raw.externalUrls.length > 0) return raw.externalUrls[0].url ?? null
  return null
}

// ----------------------------------------------------------------------------
// toNumSafe / firstNumeric — extração numérica tolerante.
//
// Achado real: nem todo payload devolve followersCount como number puro.
// A variante apify/instagram-api-scraper já foi vista devolvendo contagens
// como string ("12700") em alguns runs, e o antigo `?? ` chaining do código
// original só cobria "campo ausente", não "campo presente mas em formato
// errado" — um followersCount:"12700" (string) passava no `!== null` mas
// depois quebrava silenciosamente em qualquer conta aritmética (tierForFollowers,
// cálculo de ER) porque `"12700" >= 20000` é sempre false em JS. toNumSafe
// converte com segurança; firstNumeric tenta uma lista de chaves candidatas
// em ordem e devolve a primeira que converte para um número finito.
// ----------------------------------------------------------------------------
function toNumSafe(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const cleaned = v.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.').trim()
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function firstNumeric(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = toNumSafe(v)
    if (n !== null) return n
  }
  return null
}

function extractFollowerStats(raw: ApifyRawProfile) {
  const followers = firstNumeric(raw.followersCount, raw.followerCount, raw.followers)
  const following = firstNumeric(raw.followsCount, raw.followingCount, raw.following)
  const posts = firstNumeric(raw.postsCount, raw.mediaCount)
  return { followers, following, posts, ok: followers !== null }
}

// ----------------------------------------------------------------------------
// SETOR DE MONETIZAÇÃO — 8 categorias, score ponderado
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
  | 'a_validar_pre_monetizacao'

interface CategoryMatch {
  category: MonetizationCategory
  score: number
  evidence: string[]
}

interface MonetizationResult {
  primary: MonetizationCategory
  secondary: MonetizationCategory | null
  matches: CategoryMatch[]
  manual_review_recommended: boolean
  category_8_note: string
}

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

const DOMAINS_AGGREGATOR = ['linktr.ee', 'beacons.ai', 'linkin.bio', 'lnk.bio', 'liketoknow.it', 'ltk.']
const DOMAINS_INFOPRODUTO = ['hotmart.com', 'kiwify.com', 'eduzz.com', 'greenn.com.br', 'monetizze.com.br']
const DOMAINS_AGENDAMENTO = ['doctoralia.', 'calendly.com', 'wa.me']
const DOMAINS_MEMBERSHIP = ['patreon.com', 'finclass.com.br']
// Adicionados após revisar a Base Unificada real: 'amazon.com.br/shop/' é o
// padrão de vitrine do Programa de Associados Amazon (visto no perfil real
// digiprofe, hoje classificado só como infoprodutor — o link de afiliado
// dele nunca pontuava em nenhuma categoria antes desta lista). shope.ee é o
// domínio oficial de link curto de afiliado da Shopee; magazinevoce.com.br
// é a vitrine de afiliado do Magalu, muito comum em achadinhos BR.
const DOMAINS_AFILIADO_BR = ['amazon.com.br/shop/', 'amzn.to', 'amzn.eu', 'shope.ee', 'magazinevoce.com.br']

const RX_PRECO_CTA = /\b(compre no site|compre agora|link na bio|loja oficial|R\$\s?\d)/i
const RX_CUPOM_AFILIADO = /\b(cupom|c[oó]digo de desconto|achadinhos?|compre o look|link nos stories|minha vitrine|meu link (da )?shopee)/i
const RX_INFOPRODUTO_TEXTO = /\b(vagas? (abertas?|limitadas?)|turma fechada|imers[aã]o|mentoria|inscri[cç][oõ]es abertas|[uú]ltimos dias|carrinho aberto)/i
const RX_REGISTRO_PROFISSIONAL = /\b(CRM[\s\-\/]?\d|CRO[\s\-\/]?\d|CRN[\s\-\/]?\d|OAB[\s\-\/]?\d|CREA[\s\-\/]?\d|Dr\.|Dra\.|Advogad[oa]|Nutricionista|Odontolog)/i
const RX_AGENDAMENTO_TEXTO = /\b(agende sua consulta|marque sua avalia[cç][aã]o|agendamento)/i
const RX_PUBLI = /(#publi\b|#ad\b|#parceriapaga|paid_?partnership)/i
const RX_MEMBERSHIP_TEXTO = /\b(comunidade fechada|clube de assinantes|assinatura mensal|assinatura anual)/i
const RX_B2B_BIO = /\b(founder|co-?founder|CEO|conselheiro|presidente da|s[oó]cio(?:-fundador)?)\b/i
const RX_NATIVA_TEXTO = /\b(b[oô]nus de criador|fundo de criadores|creator fund|monetizad[oa] pel[oa] (instagram|tiktok|meta)|gorjetas?|presentes? virtuais?|ad revenue|receita de an[uú]ncios)/i

function domainMatches(url: string | null, list: string[]): string | null {
  if (!url) return null
  const hit = list.find((d) => url.toLowerCase().includes(d))
  return hit ?? null
}

function classifyMonetizationModel(profile: ProfileSnapshot, posts: CleanPost[]): MonetizationResult {
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

  const regMatch = bio.match(RX_REGISTRO_PROFISSIONAL)?.[0]
  if (regMatch) addSignal('4_servico_consultoria', 2, `bio contém registro/título profissional: "${regMatch}"`)
  const agendaDomain = domainMatches(url, DOMAINS_AGENDAMENTO)
  if (RX_AGENDAMENTO_TEXTO.test(captions) && agendaDomain) {
    addSignal('4_servico_consultoria', 3, `link ativo de agendamento (${agendaDomain}) + legenda com CTA de agendamento`)
  }

  const infoDomain = domainMatches(url, DOMAINS_INFOPRODUTO)
  if (infoDomain) addSignal('3_infoprodutor', 3, `external_url aponta pra checkout de infoproduto (${infoDomain})`)
  const infoTexto = captions.match(RX_INFOPRODUTO_TEXTO)?.[0]
  if (infoTexto) addSignal('3_infoprodutor', 2, `legenda com padrão de lançamento: "${infoTexto}"`)

  const membershipDomain = domainMatches(url, DOMAINS_MEMBERSHIP)
  if (membershipDomain) addSignal('6_membership_comunidade', 3, `external_url é plataforma de membership (${membershipDomain})`)
  if (RX_MEMBERSHIP_TEXTO.test(captions)) addSignal('6_membership_comunidade', 2, 'legenda com padrão de assinatura recorrente')

  const isKnownAggregatorOrPlatform = domainMatches(url, [...DOMAINS_AGGREGATOR, ...DOMAINS_INFOPRODUTO, ...DOMAINS_MEMBERSHIP, ...DOMAINS_AFILIADO_BR])
  const precoCta = captions.match(RX_PRECO_CTA)?.[0]
  if (url && !isKnownAggregatorOrPlatform && precoCta) {
    addSignal('1_ecommerce_direto', 3, `external_url próprio (não agregador/infoproduto/membership) + legenda com CTA de venda: "${precoCta}"`)
  } else if (precoCta) {
    addSignal('1_ecommerce_direto', 1, `legenda com CTA de venda ("${precoCta}") sem link próprio confirmado`)
  }

  const aggDomain = domainMatches(url, DOMAINS_AGGREGATOR)
  if (aggDomain) addSignal('2_comissionamento_afiliados', 3, `external_url é agregador de links (${aggDomain})`)
  const afiliadoBrDomain = domainMatches(url, DOMAINS_AFILIADO_BR)
  if (afiliadoBrDomain) addSignal('2_comissionamento_afiliados', 3, `external_url é vitrine/link de afiliado BR (${afiliadoBrDomain})`)
  const cupomTexto = captions.match(RX_CUPOM_AFILIADO)?.[0]
  if (cupomTexto) addSignal('2_comissionamento_afiliados', 2, `legenda com padrão de afiliado: "${cupomTexto}"`)

  // paidPartnership nativo (campo estruturado, não regex) é o sinal mais
  // forte disponível para Cat.5 — mais confiável que #publi/#ad em texto,
  // que a amostra real mostrou ser raro mesmo em posts efetivamente pagos.
  const anyPostFlaggedPartnership = posts.some((p) => p.paid_partnership === true)
  if (anyPostFlaggedPartnership) {
    addSignal('5_patrocinio_publicidade', 3, 'tag nativa "parceria paga" (paidPartnership=true) presente em ao menos 1 post da amostra')
  }
  const publiTexto = captions.match(RX_PUBLI)?.[0]
  if (publiTexto) addSignal('5_patrocinio_publicidade', 2, `legenda com marcação de publicidade paga: "${publiTexto}"`)

  const b2bMatch = bio.match(RX_B2B_BIO)?.[0]
  if (b2bMatch && !url) addSignal('8_autoridade_b2b', 1, `bio contém termo de cargo executivo/autoridade: "${b2bMatch}", sem link de venda direta`)

  const nativaTexto = captions.match(RX_NATIVA_TEXTO)?.[0] ?? bio.match(RX_NATIVA_TEXTO)?.[0]
  if (nativaTexto) addSignal('7_monetizacao_nativa', 2, `bio/legenda menciona monetização nativa de plataforma: "${nativaTexto}"`)

  const ranked: CategoryMatch[] = Array.from(scores.entries())
    .map(([category, v]) => ({ category, score: v.score, evidence: v.evidence }))
    .sort((a, b) => b.score - a.score)

  const category8Note =
    'Cat.8 nesta versão só usa bio própria; verificação do perfil dos comentaristas mais frequentes (spec completa) não está implementada.'

  if (ranked.length === 0) {
    return { primary: 'a_validar_pre_monetizacao', secondary: null, matches: [], manual_review_recommended: true, category_8_note: category8Note }
  }

  const primary = ranked[0]
  const secondaryCandidate = ranked[1]
  const secondary = secondaryCandidate && secondaryCandidate.score >= 0.6 * primary.score ? secondaryCandidate.category : null

  return { primary: primary.category, secondary, matches: ranked, manual_review_recommended: secondary !== null, category_8_note: category8Note }
}

function estimateFunnelMaturity(profile: ProfileSnapshot, captions: string): ClassificationMatrixEntry['maturidade_funil'] {
  if (!profile.fetched) return 'indeterminado'
  const hasLink = Boolean(profile.external_url)
  const hasExplicitCta = RX_PRECO_CTA.test(captions) || RX_AGENDAMENTO_TEXTO.test(captions) || RX_INFOPRODUTO_TEXTO.test(captions)
  if (hasLink && hasExplicitCta) return 'implementado'
  if (hasLink || hasExplicitCta) return 'parcial'
  return 'nao_implementado'
}

function buildClassificationMatrix(monetization: MonetizationResult, profile: ProfileSnapshot, captions: string): ClassificationMatrixEntry {
  return {
    setor_benchmark_primario: monetization.primary,
    setor_benchmark_secundario: monetization.secondary,
    nicho: 'não classificado nesta versão — dimensão separada do setor de benchmark',
    proof_mechanism: 'não classificado nesta versão — dimensão separada do setor de benchmark',
    maturidade_funil: estimateFunnelMaturity(profile, captions),
    rede: 'instagram',
    data_classificacao: new Date().toISOString(),
    versao_framework: FRAMEWORK_VERSION,
  }
}

// ----------------------------------------------------------------------------
// ENGAJAMENTO NORMALIZADO POR PORTE (ER real por conta, base do estimador de reach)
// ----------------------------------------------------------------------------

interface AccountEngagementStats {
  sample_size: number
  median_er: number | null
  mean_er: number | null
  er_per_post: Array<{ short_code: string; er: number; content_format: ContentFormat }>
  /** true quando a ER usou o ponto médio do tier de porte como substituto
   *  de followers reais (ver nota abaixo). false em todo o resto,
   *  incluindo quando não há ER nenhuma (sample_size=0). */
  is_estimated: boolean
}

const EMPTY_ENGAGEMENT: AccountEngagementStats = {
  sample_size: 0, median_er: null, mean_er: null, er_per_post: [], is_estimated: false,
}

/**
 * ER fallback-by-tier.
 *
 * Quando followers_count não foi capturado (profile-fetch falhou ou o
 * payload não trouxe o campo), a ER "real" (likes/followers) não pode ser
 * calculada — followers é o denominador. Em vez de devolver silenciosamente
 * sample_size=0 (que esconde a diferença entre "conta sem engajamento" e
 * "conta sem porte conhecido"), este fallback tenta inferir o tier da conta
 * a partir do próprio volume de likes observado (proxy: uma conta nano/micro
 * raramente sustenta média de likes na casa de milhares; uma conta mega
 * raramente fica abaixo de centenas) e usa o PONTO MÉDIO do tier resultante
 * como denominador — nunca um número de followers real inventado.
 *
 * Isto é deliberadamente conservador: o resultado vem sempre com
 * is_estimated=true e confidence textual "estimativa por tier via volume de
 * likes — não é ER real", e nunca deve ser exibido como número exato (mesma
 * regra do resto do pipeline: display pronto, nunca ponto pelado).
 */
function inferTierFromLikesVolume(medianLikes: number): FollowerTierDefLike {
  // pontos médios ilustrativos dos tiers definidos em tiers.ts — recalculado
  // aqui só para servir de proxy de ORDEM DE GRANDEZA, não de calibração.
  if (medianLikes < 200) return { key: 'nano', mid: 10_000 }
  if (medianLikes < 1_500) return { key: 'mid', mid: 40_000 }
  if (medianLikes < 8_000) return { key: 'macro', mid: 100_000 }
  return { key: 'mega', mid: 300_000 }
}
interface FollowerTierDefLike { key: string; mid: number }

function computeAccountEngagement(posts: CleanPost[], followers: number | null): AccountEngagementStats {
  const likesPosts = posts.filter((p) => p.likes !== null && p.likes! >= 0)

  if (followers && followers > 0) {
    const erList = likesPosts.map((p) => ({
      short_code: p.short_code,
      er: ((p.likes ?? 0) + (p.comments ?? 0)) / followers,
      content_format: p.content_format,
    }))
    if (erList.length === 0) return EMPTY_ENGAGEMENT
    const values = erList.map((e) => e.er).sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    return { sample_size: erList.length, median_er: median, mean_er: mean, er_per_post: erList, is_estimated: false }
  }

  // followers desconhecido — fallback por tier inferido via volume de likes,
  // sempre marcado is_estimated=true.
  if (likesPosts.length === 0) return EMPTY_ENGAGEMENT
  const likeValues = likesPosts.map((p) => p.likes as number).sort((a, b) => a - b)
  const midIdx = Math.floor(likeValues.length / 2)
  const medianLikes = likeValues.length % 2 === 0 ? (likeValues[midIdx - 1] + likeValues[midIdx]) / 2 : likeValues[midIdx]
  const tierGuess = inferTierFromLikesVolume(medianLikes)

  const erList = likesPosts.map((p) => ({
    short_code: p.short_code,
    er: ((p.likes ?? 0) + (p.comments ?? 0)) / tierGuess.mid,
    content_format: p.content_format,
  }))
  const values = erList.map((e) => e.er).sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
  const mean = values.reduce((s, v) => s + v, 0) / values.length

  return { sample_size: erList.length, median_er: median, mean_er: mean, er_per_post: erList, is_estimated: true }
}

// ----------------------------------------------------------------------------
// RESULTADO FINAL POR CONTA
// ----------------------------------------------------------------------------

interface AccountResult {
  handle: string
  setor_benchmark_key: string
  url: string
  actor_used: 'apify/instagram-scraper' | 'apify/instagram-api-scraper' | 'FAILED'
  scraped_at: string
  total_posts: number
  valid_posts: number
  diagnosis_tier: 'insuficiente' | 'leve' | 'completo'
  posts: CleanPost[]
  followers_count: number | null
  following_count: number | null
  posts_count: number | null
  follower_tier: string | null
  engagement: AccountEngagementStats
  external_url: string | null
  account_level_anomalies: string[]
  monetization: MonetizationResult
  classification_matrix: ClassificationMatrixEntry
}

// ----------------------------------------------------------------------------
// APIFY — actor primário com fallback
// ----------------------------------------------------------------------------

function buildInput(profileUrl: string) {
  return { addParentData: false, directUrls: [profileUrl], resultsType: 'posts' as const, resultsLimit: RESULTS_LIMIT_PER_ACCOUNT }
}

async function runActor(client: ApifyClient, actorId: string, profileUrl: string): Promise<ApifyRawPost[]> {
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
    if (items.length > 0) return { items, actorUsed: 'apify/instagram-scraper' }
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
  // normalizeHandle aplicado JÁ NA FONTE (não só no consumidor em
  // compute.ts) — garante que o handle gravado no manifesto, no nome do
  // arquivo JSON por conta e no histórico de seguidores seja sempre o
  // mesmo valor canônico, independente de capitalização na URL original.
  return normalizeHandle(match ? match[1] : profileUrl)
}

function buildProfileInput(profileUrl: string) {
  return { directUrls: [profileUrl], resultsType: 'details' as const, resultsLimit: 1 }
}

async function fetchProfileWithFallback(client: ApifyClient, profileUrl: string): Promise<ProfileSnapshot> {
  for (const actorId of ['apify/instagram-scraper', 'apify/instagram-api-scraper'] as const) {
    try {
      const run = await client.actor(actorId).call(buildProfileInput(profileUrl))
      const { items } = await client.dataset(run.defaultDatasetId).listItems()
      const raw = items[0] as unknown as ApifyRawProfile | undefined
      if (raw) {
        const { followers, following, posts, ok } = extractFollowerStats(raw)
        if (!ok) {
          console.warn(`  ⚠️  ${actorId} devolveu perfil sem followersCount reconhecível para ${profileUrl} — checar payload real`)
        }
        return {
          biography: raw.biography ?? '',
          external_url: extractExternalUrl(raw),
          fetched: true,
          followers_count: followers,
          following_count: following,
          posts_count: posts,
          follower_stats_fetched: ok,
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  profile-fetch via ${actorId} falhou para ${profileUrl}: ${(err as Error).message}`)
    }
  }
  console.warn(`  ⚠️  não foi possível obter bio/porte de ${profileUrl}`)
  return EMPTY_PROFILE
}

// ----------------------------------------------------------------------------
// HISTÓRICO DE SEGUIDORES — a peça que faltava pra Δfollowers virar tendência
// real e não um artefato de horas do mesmo dia (como no scrap.zip). Cada
// execução deste script, em dias diferentes, ACRESCENTA uma linha; nunca
// sobrescreve. compute.ts lê esse arquivo pra calcular a tendência.
// ----------------------------------------------------------------------------

interface FollowerSnapshotLine {
  handle: string
  followers_count: number
  scraped_at: string
}

function appendFollowerSnapshot(handle: string, followersCount: number | null, scrapedAt: string) {
  if (followersCount === null) return
  if (!existsSync(FOLLOWERS_HISTORY_DIR)) mkdirSync(FOLLOWERS_HISTORY_DIR, { recursive: true })
  const filePath = path.join(FOLLOWERS_HISTORY_DIR, `${handle}.jsonl`)
  const line: FollowerSnapshotLine = { handle, followers_count: followersCount, scraped_at: scrapedAt }
  appendFileSync(filePath, JSON.stringify(line) + '\n', 'utf-8')
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
    console.error('❌ SETOR_BENCHMARK_ACCOUNTS está vazio. Preencha as URLs antes de rodar — não vou inventar contas de terceiros.')
    process.exit(1)
  }

  console.log(`Total de contas nesta rodada: ${totalAccounts}`)
  for (const [setor, urls] of Object.entries(SETOR_BENCHMARK_ACCOUNTS)) {
    if (urls.length === 0) console.log(`  ⚠️  ${setor}: 0 contas — sem coleta ainda`)
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
      const engagement = computeAccountEngagement(validPosts, profile.followers_count)
      const tier = tierForFollowers(profile.followers_count)

      const accountAnomalies: string[] = []
      if (validPosts.length < MIN_POSTS_FOR_DIAGNOSIS) {
        accountAnomalies.push(`Apenas ${validPosts.length} posts válidos — abaixo do mínimo (${MIN_POSTS_FOR_DIAGNOSIS}). Amostra insuficiente, não entra no cálculo de benchmark.`)
      }
      if (!profile.fetched) {
        accountAnomalies.push('profile-fetch falhou — classificação de monetização baseada só em captions, sem bio/externalUrl')
      }
      if (!profile.follower_stats_fetched) {
        accountAnomalies.push('followersCount não encontrado no payload — conta não entra em nenhuma célula de benchmark de porte')
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
        followers_count: profile.followers_count,
        following_count: profile.following_count,
        posts_count: profile.posts_count,
        follower_tier: tier?.key ?? null,
        engagement,
        external_url: profile.external_url,
        account_level_anomalies: accountAnomalies,
        monetization,
        classification_matrix: classificationMatrix,
      }

      summary.push(result)
      appendFollowerSnapshot(handle, profile.followers_count, result.scraped_at)

      const dir = path.join(OUTPUT_DIR, setorKey)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, `${handle}.json`), JSON.stringify(result, null, 2), 'utf-8')

      const anomalyCount = cleanedPosts.reduce((n, p) => n + p.anomalies.length, 0)
      console.log(
        `  ✓ ${validPosts.length}/${items.length} posts válidos (${result.diagnosis_tier}) via ${actorUsed}` +
          `${anomalyCount ? `, ${anomalyCount} anomalias sinalizadas` : ''}` +
          `${tier ? `, tier=${tier.key}` : ', tier=desconhecido'}`
      )
      console.log(
        `    → Monetização: ${monetization.primary}${monetization.secondary ? ` + ${monetization.secondary} (secundária)` : ''}` +
          `${monetization.manual_review_recommended ? ' (⚠️ revisão manual recomendada)' : ''}`
      )

      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_ACCOUNTS_MS))
    }
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(summary, null, 2), 'utf-8')

  const insuficientes = summary.filter((r) => r.diagnosis_tier === 'insuficiente')
  const semPorte = summary.filter((r) => r.follower_tier === null)
  console.log(`\n=== Resumo do piloto ===`)
  console.log(`Contas raspadas: ${summary.length}`)
  console.log(`Contas com amostra insuficiente (<${MIN_POSTS_FOR_DIAGNOSIS} posts): ${insuficientes.length}`)
  if (insuficientes.length > 0) console.log(`  → ${insuficientes.map((r) => r.handle).join(', ')}`)
  console.log(`Contas sem porte identificado (não entram em célula de benchmark): ${semPorte.length}`)
  if (semPorte.length > 0) console.log(`  → ${semPorte.map((r) => r.handle).join(', ')}`)

  const aValidar = summary.filter((r) => r.monetization.primary === 'a_validar_pre_monetizacao')
  console.log(`\n📋 ${aValidar.length} conta(s) sem sinal positivo de monetização — 'a_validar_pre_monetizacao'`)

  console.log(`\nManifesto salvo em: ${manifestPath}`)
  console.log(`Histórico de seguidores em: ${FOLLOWERS_HISTORY_DIR}/<handle>.jsonl (acumula a cada execução)`)
  console.log(`\nPróximo passo: rodar compute.ts para gerar as 4 estimativas de métricas ocultas.`)
  console.log(`Lembrete: 'Visitas ao Perfil' só produz tendência real depois de pelo menos 2 execuções`)
  console.log(`deste script em dias diferentes — uma execução isolada não tem histórico suficiente.`)
}

// Guarda de execução direta — ANTES desta correção, main() rodava como
// side-effect de módulo sempre que ingest.ts era importado (por exemplo,
// se compute.ts importasse FOLLOWER_TIERS daqui). Isso disparava uma
// raspagem real na Apify — com custo e chamadas de rede reais — só por
// causa de um import de tipo. Agora main() só roda quando o arquivo é
// executado diretamente (`npx tsx ingest.ts`), nunca quando importado.
const isDirectRun = process.argv[1] !== undefined && process.argv[1].endsWith('ingest.ts')
if (isDirectRun) {
  main().catch((err) => {
    console.error('Erro fatal:', err)
    process.exit(1)
  })
}
