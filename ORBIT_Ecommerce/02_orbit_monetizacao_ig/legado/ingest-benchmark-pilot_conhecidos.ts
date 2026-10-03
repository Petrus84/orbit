/**
 * ingest-benchmark-pilot.ts
 * ============================================================================
 * Piloto de benchmark real (gatilho D — protocolo_coleta_orbit.md).
 * 20-30 contas × 2 nichos (e-commerce + creator), via Apify.
 *
 * DECISÃO EXPLÍCITA: este script NÃO grava em orbit.ig_posts nem em nenhuma
 * tabela de orbit.*. Contas de benchmark não são clientes (orbit.ig_posts
 * exige client_id NOT NULL, FK → orbit.clients). Output vai para arquivos
 * JSON locais em ./data/benchmark/<nicho>/<handle>.json — puramente staging
 * para o cálculo de correlação real (ver compute-real-correlations.ts).
 * Se, depois de validado, isso merecer virar tabela permanente, é uma
 * decisão separada — não embutida aqui.
 *
 * Actor primário: apify/instagram-scraper (mais barato)
 * Fallback: apify/instagram-api-scraper (mais estável), só se o primário
 *   falhar ou devolver 0 posts.
 *
 * ATUALIZAÇÃO (modelo_monetizacao_orbit.md) — adiciona classificação de
 * Modelo de Monetização (8 categorias) por conta, via regex sobre
 * biography/externalUrl (perfil) + captions (posts). Usa OS MESMOS dois
 * actors já declarados acima — nenhum actor novo foi introduzido — e
 * segue o mesmo padrão de transformação de dado bruto→limpo já usado em
 * validateAndClean(): toda classificação carrega a evidência que a gerou
 * e um flag de revisão manual quando o sinal é ambíguo, no lugar de
 * afirmar categoria com falsa certeza (mesma filosofia dos campos
 * `anomalies` já existentes, não um sistema paralelo).
 *
 * LIMITAÇÃO HONESTA: a Categoria 8 (Autoridade B2B) na especificação
 * completa inclui "verificação do perfil dos comentaristas mais
 * frequentes" — isso NÃO está implementado aqui. Analisar comentaristas
 * exigiria raspar N perfis adicionais por conta (custo Apify multiplicado
 * por N, sem limite claro de quantos comentaristas amostrar). Fica como
 * heurística parcial (só bio da própria conta) até isso virar uma decisão
 * separada de custo/escopo — não vou implementar silenciosamente uma
 * versão incompleta como se fosse a especificação inteira.
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

// ----------------------------------------------------------------------------
// CONFIG — preencher com as contas reais do piloto. Deixei vazio de propósito:
// não vou inventar handles de contas de terceiros.
// ----------------------------------------------------------------------------
// Atualizado em 01/08/2026 — expandido de 2 para 7 buckets. Os 2 originais
// (ecommerce, creator) cobriam só os nichos já vistos no dataset inicial
// (cpimportstore, eupetruchio84). A lista de handles fornecida abre 5 buckets
// novos que ainda não têm persona formalizada no PERSONAS object do dashboard
// (growth_gestor, social_media_freelance, embaixador, infoprodutor,
// servico_profissional) — ver Decisão SSOT no documento de análise.
const ACCOUNTS_BY_NICHO: Record<string, string[]> = {
  ecommerce: [
    'https://www.instagram.com/achadinhosdalayy/', // associado/afiliado, mesmo padrão cpimportstore
    'https://www.instagram.com/promocoes_do_dia/',
    'https://www.instagram.com/promodehomem/', // nichado (moda masculina) — comparar ER vs. genéricos
    'https://www.instagram.com/oreidapromobr/',
    'https://www.instagram.com/atacadao_de_mercadorias/', // lojista/associado — posicionamento volume, não premium
  ],

  growth_gestor: [
    // gestor que faz growth PARA associados/afiliados — não é o mesmo persona
    // "Agência" (damediascorp presta serviço fim-a-fim); aqui o modelo é
    // recrutar/escalar uma rede de contas menores. Bucket novo, 1 conta só
    // por ora — completar amostra antes de calcular benchmark (mínimo 5, ver protocolo).
    'https://www.instagram.com/cassiocanali/',
  ],

  social_media_freelance: [
    // "social media" citados sem nicho de conteúdo próprio declarado —
    // prestadores de serviço de gestão de mídia para terceiros, porte pequeno/solo.
    'https://www.instagram.com/naaldomendes/',
    'https://www.instagram.com/jeanoliveirasm/',
    'https://www.instagram.com/will.uz.social/',
    'https://www.instagram.com/patrick.vlogsz/',
    'https://www.instagram.com/elivanofss/',
    'https://www.instagram.com/socialmediadeelite/',
    'https://www.instagram.com/amandasveiga/',
    'https://www.instagram.com/gabrielsampaiob/',
  ],

  embaixador: [
    // "embaixadores" de marca — bucket novo, lógica de monetização é
    // patrocínio/comissão, não venda direta nem assinatura.
    'https://www.instagram.com/margotrobbielookalike/',
    'https://www.instagram.com/iampauloandre/',
    'https://www.instagram.com/giovanem8/',
  ],

  infoprodutor: [
    // "serviços educacionais" — persona citada desde a primeira definição
    // de Persona × Nicho, nunca formalizada por falta de conta real até agora.
    'https://www.instagram.com/profandrei.mayer/',
    'https://www.instagram.com/creators/',
  ],

  servico_profissional: [
    // Persona nova: compra é por credibilidade/autoridade profissional,
    // não por engajamento de entretenimento — precisa de benchmark próprio,
    // não faz sentido comparar ER contra e-commerce ou creator.
    'https://www.instagram.com/anabeatriz11/',
    'https://www.instagram.com/doutor.malta/',
    'https://www.instagram.com/engenheiro_matheus/',
  ],

  streamer_pvt: [
    // Persona Streamer, subtipo PVT (ver criterios_avaliacao_streaming_tipo3.md,
    // seção 3) — o Instagram aqui é só a camada TOFU pública; o scrape cobre
    // engajamento IG, não os dados de show/PVT (isso é log manual, fora do
    // Apify — plataforma de cam não expõe API pública).
    'https://www.instagram.com/cesarj_model/',
    'https://www.instagram.com/realtatanlozano/',
  ],

  creator: [
    // 'https://www.instagram.com/handle1/',
    // ... 15-20 contas de desenvolvimento pessoal/mindset, mesmo nicho do eupetruchio84
    // (bucket original — ainda vazio, pendente de handles de referência)
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
  nicho: string
  url: string
  actor_used: 'apify/instagram-scraper' | 'apify/instagram-api-scraper' | 'FAILED'
  scraped_at: string
  total_posts: number
  valid_posts: number
  diagnosis_tier: 'insuficiente' | 'leve' | 'completo'
  posts: CleanPost[]
  account_level_anomalies: string[]
  monetization: MonetizationResult
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
// MODELO DE MONETIZAÇÃO — 8 categorias (modelo_monetizacao_orbit.md, seção 1)
// Terceiro eixo do framework, ao lado de Nicho e Persona.
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
  | 'indeterminado'

interface CategoryMatch {
  category: MonetizationCategory
  evidence: string[] // o que exatamente bateu (trecho de bio, domínio, hashtag) — auditável, igual ao padrão de `anomalies`
}

interface MonetizationResult {
  primary: MonetizationCategory
  matches: CategoryMatch[] // pode ter mais de 1 — sinal de perfil híbrido ou de regra ambígua
  manual_review_recommended: boolean
  category_8_note: string // lembrete permanente de que a análise de comentaristas (spec completa da Cat.8) não roda aqui
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

function domainMatches(url: string | null, list: string[]): string | null {
  if (!url) return null
  const hit = list.find((d) => url.toLowerCase().includes(d))
  return hit ?? null
}

/**
 * Classifica o Modelo de Monetização de uma conta.
 * Ordem de checagem é do sinal MAIS específico pro MAIS genérico — um
 * registro profissional (CRM/OAB) é mais forte que um domínio agregador,
 * que por sua vez é mais forte que só uma hashtag de #publi. Cat.7
 * (nativa) só é atingida por exclusão total dos outros sinais.
 */
function classifyMonetizationModel(
  profile: ProfileSnapshot,
  posts: CleanPost[]
): MonetizationResult {
  const captions = posts.map((p) => p.caption ?? '').join(' \n ')
  const bio = profile.biography ?? ''
  const url = profile.external_url

  const matches: CategoryMatch[] = []

  // Cat 4 — Serviço/Consultoria: registro profissional na bio é o sinal mais forte de todos
  if (RX_REGISTRO_PROFISSIONAL.test(bio) || (RX_AGENDAMENTO_TEXTO.test(captions) && domainMatches(url, DOMAINS_AGENDAMENTO))) {
    matches.push({
      category: '4_servico_consultoria',
      evidence: [
        RX_REGISTRO_PROFISSIONAL.test(bio) ? `bio contém registro/título profissional: "${bio.match(RX_REGISTRO_PROFISSIONAL)?.[0]}"` : '',
        domainMatches(url, DOMAINS_AGENDAMENTO) ? `external_url é plataforma de agendamento (${domainMatches(url, DOMAINS_AGENDAMENTO)})` : '',
      ].filter(Boolean),
    })
  }

  // Cat 3 — Infoprodutor: domínio de checkout de infoproduto é sinal forte
  const infoDomain = domainMatches(url, DOMAINS_INFOPRODUTO)
  if (infoDomain || RX_INFOPRODUTO_TEXTO.test(captions)) {
    matches.push({
      category: '3_infoprodutor',
      evidence: [
        infoDomain ? `external_url aponta pra checkout de infoproduto (${infoDomain})` : '',
        RX_INFOPRODUTO_TEXTO.test(captions) ? `legenda com padrão de lançamento: "${captions.match(RX_INFOPRODUTO_TEXTO)?.[0]}"` : '',
      ].filter(Boolean),
    })
  }

  // Cat 6 — Membership
  const membershipDomain = domainMatches(url, DOMAINS_MEMBERSHIP)
  if (membershipDomain || RX_MEMBERSHIP_TEXTO.test(captions)) {
    matches.push({
      category: '6_membership_comunidade',
      evidence: [
        membershipDomain ? `external_url é plataforma de membership (${membershipDomain})` : '',
        RX_MEMBERSHIP_TEXTO.test(captions) ? `legenda com padrão de assinatura recorrente` : '',
      ].filter(Boolean),
    })
  }

  // Cat 1 — E-commerce direto: link próprio (não agregador, não infoproduto, não membership) + preço/CTA de loja
  const isKnownAggregatorOrPlatform = domainMatches(url, [...DOMAINS_AGGREGATOR, ...DOMAINS_INFOPRODUTO, ...DOMAINS_MEMBERSHIP])
  if (url && !isKnownAggregatorOrPlatform && RX_PRECO_CTA.test(captions)) {
    matches.push({
      category: '1_ecommerce_direto',
      evidence: [`external_url próprio (não agregador/infoproduto/membership) + legenda com CTA de venda direta`],
    })
  }

  // Cat 2 — Comissionamento/Afiliados: domínio agregador OU texto de cupom/achadinhos
  const aggDomain = domainMatches(url, DOMAINS_AGGREGATOR)
  if (aggDomain || RX_CUPOM_AFILIADO.test(captions)) {
    matches.push({
      category: '2_comissionamento_afiliados',
      evidence: [
        aggDomain ? `external_url é agregador de links (${aggDomain})` : '',
        RX_CUPOM_AFILIADO.test(captions) ? `legenda com padrão de afiliado: "${captions.match(RX_CUPOM_AFILIADO)?.[0]}"` : '',
      ].filter(Boolean),
    })
  }

  // Cat 5 — Patrocínio/Publicidade
  if (RX_PUBLI.test(captions)) {
    matches.push({
      category: '5_patrocinio_publicidade',
      evidence: [`legenda com marcação de publicidade paga: "${captions.match(RX_PUBLI)?.[0]}"`],
    })
  }

  // Cat 8 — Autoridade B2B (heurística PARCIAL — só bio, sem análise de comentaristas, ver nota no topo do arquivo)
  if (RX_B2B_BIO.test(bio) && !url) {
    matches.push({
      category: '8_autoridade_b2b',
      evidence: [`bio contém termo de cargo executivo/autoridade: "${bio.match(RX_B2B_BIO)?.[0]}", sem link de venda direta`],
    })
  }

  // Cat 7 — Nativa: só por exclusão total, e só se o profile-fetch de fato rodou
  // (senão "sem link" pode ser falha de coleta, não ausência real de link)
  if (matches.length === 0 && profile.fetched && !url && !RX_PUBLI.test(captions)) {
    matches.push({
      category: '7_monetizacao_nativa',
      evidence: ['sem external_url e sem padrão comercial em nenhuma legenda — confirmado por exclusão, não por sinal positivo'],
    })
  }

  if (matches.length === 0) {
    return {
      primary: 'indeterminado',
      matches: [],
      manual_review_recommended: true,
      category_8_note: 'Cat.8 nesta versão só usa bio própria; verificação do perfil dos comentaristas mais frequentes (spec completa) não está implementada.',
    }
  }

  return {
    primary: matches[0].category, // ordem de inserção já é a de prioridade (mais específico primeiro)
    matches,
    manual_review_recommended: matches.length > 1, // mais de 1 categoria batendo = perfil híbrido ou regra ambígua, precisa de olho humano
    category_8_note: 'Cat.8 nesta versão só usa bio própria; verificação do perfil dos comentaristas mais frequentes (spec completa) não está implementada.',
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

  const totalAccounts = Object.values(ACCOUNTS_BY_NICHO).flat().length
  if (totalAccounts === 0) {
    console.error(
      '❌ ACCOUNTS_BY_NICHO está vazio. Preencha as URLs de perfil em ' +
        'ecommerce/creator antes de rodar — não vou inventar contas de terceiros.'
    )
    process.exit(1)
  }

  const client = new ApifyClient({ token })
  const summary: AccountResult[] = []

  for (const [nicho, urls] of Object.entries(ACCOUNTS_BY_NICHO)) {
    if (urls.length === 0) continue
    console.log(`\n=== Nicho: ${nicho} (${urls.length} contas) ===`)

    for (const url of urls) {
      const handle = extractHandle(url)
      console.log(`→ ${handle}`)

      const { items, actorUsed } = await scrapeAccountWithFallback(client, url)
      const cleanedPosts = items.map(validateAndClean)
      const validPosts = cleanedPosts.filter((p) => p.timestamp && p.short_code !== 'UNKNOWN')

      const profile = await fetchProfileWithFallback(client, url)
      const monetization = classifyMonetizationModel(profile, cleanedPosts)

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
        nicho,
        url,
        actor_used: actorUsed,
        scraped_at: new Date().toISOString(),
        total_posts: items.length,
        valid_posts: validPosts.length,
        diagnosis_tier: classifyDiagnosisTier(validPosts.length),
        posts: cleanedPosts,
        account_level_anomalies: accountAnomalies,
        monetization,
      }

      summary.push(result)

      const dir = path.join(OUTPUT_DIR, nicho)
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
          `${monetization.manual_review_recommended ? ' (⚠️ revisão manual recomendada — sinal ambíguo/múltiplo)' : ''}`
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

  console.log(`\n=== Modelo de Monetização (classificação automática) ===`)
  const byCategory = new Map<string, string[]>()
  for (const r of summary) {
    const list = byCategory.get(r.monetization.primary) ?? []
    list.push(r.handle)
    byCategory.set(r.monetization.primary, list)
  }
  for (const [cat, handles] of byCategory.entries()) {
    console.log(`  ${cat}: ${handles.join(', ')}`)
  }
  const precisamRevisao = summary.filter((r) => r.monetization.manual_review_recommended)
  console.log(`\n⚠️  ${precisamRevisao.length} conta(s) com sinal ambíguo/múltiplo, revisão manual recomendada:`)
  if (precisamRevisao.length > 0) {
    console.log(`  → ${precisamRevisao.map((r) => `${r.handle} (${r.monetization.matches.map((m) => m.category).join(' + ')})`).join(', ')}`)
  }

  console.log(`\nManifesto salvo em: ${manifestPath}`)
  console.log(`\nPróximo passo: compute-real-correlations.ts lê este manifesto e`)
  console.log(`recalcula a matriz de correlação real, pra comparar contra a`)
  console.log(`matriz "Teórica" (simulada) de ontem.`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})