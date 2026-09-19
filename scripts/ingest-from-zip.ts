import dotenv from 'dotenv'
import * as fs from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientId } from './lib/resolveClientId'
import {
resolveIntMetric,
resolveIntMetricOrNull,
resolveStringMetric,
resolvePercentMetric,
logMissingKey,
} from './lib/metric-key-dictionary'
import AdmZip from 'adm-zip'
import { createHash } from 'crypto'

dotenv.config({ path: '.env.local' })

/* ── CLI args ───────────────────────────────────────────────────────────── */
function argVal(flag: string): string | undefined {
const eq = process.argv.find(a => a.startsWith(`--${flag}=`))
if (eq) return eq.split('=').slice(1).join('=')
const idx = process.argv.indexOf(`--${flag}`)
const next = process.argv[idx + 1]
if (idx >= 0 && next && !next.startsWith('--')) {
  return next
}
return undefined
}

const ZIP_PATH = argVal('zip')
const CLIENT_USERNAME = argVal('client')
const DRY_RUN = process.argv.includes('--dry-run')

if (!ZIP_PATH || !fs.existsSync(ZIP_PATH)) {
console.error('❌ --zip="/caminho/para/export.zip" é obrigatório e precisa existir')
process.exit(1)
}
if (!CLIENT_USERNAME) {
console.error('❌ --client=<handle> é obrigatório (ex: --client cpimportstore)')
process.exit(1)
}

const supabase: SupabaseClient = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ── Caminhos nativos fixos da Meta ───────────────────────────────────── */
const NATIVE_PATHS = {
postsFlat: 'your_instagram_activity/media/posts_1.json',
reels: 'your_instagram_activity/media/reels.json',
postsInsights: 'logged_information/past_instagram_insights/posts.json',
profilesReached: 'logged_information/past_instagram_insights/profiles_reached.json',
contentInteractions: 'logged_information/past_instagram_insights/content_interactions.json',
audienceInsights: 'logged_information/past_instagram_insights/audience_insights.json',
} as const

/* ── Zod Schemas ────────────────────────────────────────────────────────── */
const MediaItemSchema = z.object({
uri: z.string().optional().default(''),
creation_timestamp: z.number().optional(),
title: z.string().optional().default(''),
})

const FlatPostSchema = z.object({
media: z.array(MediaItemSchema).min(1),
title: z.string().optional().default(''),
creation_timestamp: z.number().optional(),
})

const ReelItemSchema = z.object({
media: z.array(MediaItemSchema).min(1),
})

const ReelsFileSchema = z.object({
ig_reels_media: z.array(ReelItemSchema),
})

const InsightMetricSchema = z.object({
value: z.string().optional(),
})

const PostInsightSchema = z.object({
media_map_data: z.record(z.string(), MediaItemSchema).optional().default({}),
string_map_data: z.record(z.string(), InsightMetricSchema).optional().default({}),
})

const PostsInsightsFileSchema = z.object({
organic_insights_posts: z.array(PostInsightSchema),
})

const MetricEntrySchema = z.object({
href: z.string().optional(),
value: z.string().optional(),
timestamp: z.number().optional(),
})

const ContentInteractionsSchema = z.object({
organic_insights_interactions: z.array(z.object({
  title: z.string().optional(),
  string_map_data: z.record(z.string(), MetricEntrySchema),
})),
})

const ReachFileSchema = z.object({
organic_insights_reach: z.array(z.object({
  title: z.string().optional(),
  string_map_data: z.record(z.string(), MetricEntrySchema),
})).optional().default([]),
})

const AudienceInsightsSchema = z.object({
organic_insights_audience: z.array(z.object({
  title: z.string().optional(),
  string_map_data: z.record(z.string(), MetricEntrySchema),
})),
})

/* ── Types ──────────────────────────────────────────────────────────────── */
type ContentFormat = 'reel' | 'static_post' | 'carousel'

interface PostMetrics {
reach: number | null
impressions: number | null
likes: number | null
comments: number | null
shares: number | null
saves: number | null
}

interface UnifiedPost {
ig_post_uri: string
published_at: string
content_format: ContentFormat
caption: string
reach: number | null
impressions: number | null
likes: number | null
comments: number | null
shares: number | null
saves: number | null
confidence_level: 'L0' | 'L1'
}

interface AccountInsights {
periodStart: string
periodEnd: string
totalShares: number
totalSaves: number
totalLikes: number
totalComments: number
impressoes: number
alcance: number
visitasPerfil: number
cliquesLink: number
reachFollowersPct: number | null
filesUsed: string[]
filesMissing: string[]
}

interface GenderData {
// ✅ CORRIGIDO (v2.1.0) — number | null: ausência de dados de gênero no ZIP
// deve gravar NULL no banco, não 0. Com number puro, parsePct('') = 0 e
// o cálculo other = 100 - 0 - 0 = 100 gerava gender_other_pct = 100 quando
// o ZIP simplesmente não tinha dados de sexo (ex: dogativo).
male_pct: number | null
female_pct: number | null
other_pct: number | null
}

interface AgeRangeData {
'13-17': number
'18-24': number
'25-34': number
'35-44': number
'45-54': number
'55+': number
}

interface LocationEntry {
name: string
pct: number
}

interface Demographics {
periodStart: string
periodEnd: string
gender: GenderData
ageRange: AgeRangeData
cities: LocationEntry[]
countries: LocationEntry[]
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
// ✅ CORRIGIDO (achado #15) — antes rodava incondicionalmente. Se um export
// futuro vier com encoding já correto, reinterpretar UTF-8 como latin1
// CORROMPE o texto (ex: "São Paulo" → "SÃ£o Paulo"), em vez de corrigir.
// Só aplica a correção quando há sinal real de mojibake (sequências
// Ã.../Â.../â€... típicas de UTF-8 lido como latin1).
function fixMetaMojibake(s: string): string {
if (!/[ÃÂ]|â€/.test(s)) return s
try {
  return Buffer.from(s, 'latin1').toString('utf-8')
} catch {
  return s
}
}

function baseName(uri: string): string {
return uri.split('/').pop() ?? uri
}

function emptyMetrics(): PostMetrics {
return { reach: null, impressions: null, likes: null, comments: null, shares: null, saves: null }
}

function zipHash(zipPath: string): string {
const buf = fs.readFileSync(zipPath)
return createHash('sha256').update(buf).digest('hex')
}

function readZipEntryAsJson<T>(zip: AdmZip, nativePath: string): T | null {
const entries = zip.getEntries()
const match = entries.find(e => e.entryName.replace(/\\/g, '/').endsWith(nativePath))
if (!match) return null
const raw = match.getData().toString('utf-8')
return JSON.parse(raw) as T
}

/**
 * ✅ NOVO — diagnóstico de estrutura do ZIP.
 *
 * Antes: quando nenhum NATIVE_PATHS batia com o conteúdo real do zip
 * (ex: Meta mudou de "media/posts_1.json" para "content/posts_1.json"
 * em exportações mais recentes, ou o zip veio com uma pasta raiz extra),
 * cada extractor retornava silenciosamente [] / null. O resultado final
 * era indistinguível de "conta sem posts" — e a sessão era marcada como
 * `done` com 0 registros em todas as tabelas, sem nenhum erro.
 *
 * Esta função verifica se PELO MENOS UM dos caminhos esperados existe no
 * zip. Se nenhum existir, é quase certo que a estrutura do export mudou
 * (não que a conta está vazia), e isso precisa abortar como erro real —
 * não terminar como `done`.
 */
function diagnoseZipStructure(zip: AdmZip): { anyKnownPathFound: boolean; sampleEntries: string[] } {
const entries = zip.getEntries().map(e => e.entryName.replace(/\\/g, '/'))
const knownPaths = Object.values(NATIVE_PATHS)
const anyKnownPathFound = knownPaths.some(p => entries.some(e => e.endsWith(p)))
return { anyKnownPathFound, sampleEntries: entries.slice(0, 25) }
}

function todayISO(): string {
return new Date().toISOString().slice(0, 10)
}

function parseDateRange(range: string): { start: string; end: string } {
const monthMap: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}
const today = new Date()
const year = today.getFullYear()

// ✅ CORRIGIDO — antes só entendia "MMM D - MMM D" (sem ano). Formato
// confirmado real (dogativo, 13/09/2026): "Dec 1, 2025 - Aug 17, 2026"
// (COM ano e vírgula) quebrava silenciosamente: a vírgula ficava grudada
// no dia ("1,") e o ano de cada lado era descartado, sempre substituído
// pelo ano de hoje — gerando datas como "2026-12-1," / "2027-08-17,".
function parseOnePart(part: string, fallbackYear: number): { month: string; day: string; year: number } {
  const cleaned = part.trim().replace(/,/g, '')
  const tokens = cleaned.split(/\s+/)
  const mon = tokens[0] ?? ''
  const day = tokens[1] ?? '1'
  const explicitYear = tokens[2] ? parseInt(tokens[2], 10) : null
  return {
    month: monthMap[mon] ?? '01',
    day: day.padStart(2, '0'),
    year: explicitYear && !Number.isNaN(explicitYear) ? explicitYear : fallbackYear,
  }
}

try {
  const [startPart, endPart] = range.split(' - ')
  if (!startPart || !endPart) throw new Error('range mal formado')

  const startParsed = parseOnePart(startPart, year)
  const hasExplicitYear = /\d{4}/.test(startPart) || /\d{4}/.test(endPart)

  let endParsed: { month: string; day: string; year: number }
  if (hasExplicitYear) {
    // ✅ ano explícito nos dois lados — usa direto, sem heurística.
    endParsed = parseOnePart(endPart, startParsed.year)
  } else {
    // Sem ano no texto (ex: "Feb 25 - May 25" ou "Nov 27 - Feb 24"):
    // mantém a heurística original de wraparound — se o mês final é
    // "menor" que o mês inicial, o intervalo cruza a virada do ano.
    const provisional = parseOnePart(endPart, year)
    const endYear = parseInt(provisional.month) < parseInt(startParsed.month) ? year + 1 : year
    endParsed = { ...provisional, year: endYear }
  }

  const start = `${startParsed.year}-${startParsed.month}-${startParsed.day}`
  const end = `${endParsed.year}-${endParsed.month}-${endParsed.day}`
  return { start, end }
} catch {
  return { start: todayISO(), end: todayISO() }
}
}

/* ── BLOCO 1: Catálogo de posts ─────────────────────────────────────────── */
// ✅ CORRIGIDO (achado #17) — duas falhas nesta função:
//   1) `impressions` nunca era lido aqui (nem existia no tipo PostMetrics),
//      então a coluna era sempre gravada como null em persistPosts, mesmo
//      quando o post.json trazia "Impressões" preenchida (confirmado em
//      export real: dogativo, 172/172 posts com Impressões > 0 no JSON e
//      null no banco).
//   2) A busca de chave era um lookup único e hardcoded (ex: só
//      smd['Curtidas']), sem passar pelas variantes do
//      metric-key-dictionary.ts. Isso funciona apenas enquanto o export usa
//      exatamente a grafia pt-BR sem sufixos; qualquer variante pt-PT (como
//      já visto em outros arquivos do mesmo pacote de export) faria o valor
//      cair silenciosamente para null, sem nenhum aviso no log. Agora usa os
//      mesmos resolvers/variantes do dicionário central, em paridade com o
//      bloco de insights de conta.
function mapMetrics(smdRaw: Record<string, { value?: string | undefined }>): PostMetrics {
const smd: Record<string, { value?: string | undefined }> = {}
for (const [k, v] of Object.entries(smdRaw)) {
  smd[fixMetaMojibake(k)] = v
}
return {
  reach: resolveIntMetricOrNull(smd, 'REACH'),
  impressions: resolveIntMetricOrNull(smd, 'IMPRESSIONS'),
  likes: resolveIntMetricOrNull(smd, 'LIKES'),
  comments: resolveIntMetricOrNull(smd, 'COMMENTS'),
  shares: resolveIntMetricOrNull(smd, 'SHARES'),
  saves: resolveIntMetricOrNull(smd, 'SAVES'),
}
}

// ✅ NOVO (achado #12) — antes, a ausência/erro de parsing de postsInsights
// (posts.json) era completamente invisível: buildInsightsIndex só
// retornava um mapa vazio, sem sinalizar nada. Agora devolve um status
// para o manifesto da sessão poder registrar isso.
function buildInsightsIndex(zip: AdmZip): { index: Map<string, PostMetrics>; found: boolean } {
const index = new Map<string, PostMetrics>()
const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsInsights)
if (!raw) return { index, found: false }

const parsed = PostsInsightsFileSchema.safeParse(raw)
if (!parsed.success) return { index, found: false }

for (const item of parsed.data.organic_insights_posts) {
  const metrics = mapMetrics(item.string_map_data)
  for (const media of Object.values(item.media_map_data)) {
    if (media.uri) index.set(baseName(media.uri), metrics)
  }
}
return { index, found: true }
}

function extractFlatPosts(zip: AdmZip, insightsIndex: Map<string, PostMetrics>): { posts: UnifiedPost[]; found: boolean } {
const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsFlat)
if (!raw) return { posts: [], found: false }

const items = z.array(FlatPostSchema).safeParse(raw)
if (!items.success) return { posts: [], found: false }

const posts: UnifiedPost[] = []
for (const item of items.data) {
  const [first] = item.media
  if (!first) continue
  const timestamp = item.creation_timestamp ?? first.creation_timestamp
  if (!timestamp || !first.uri) continue

  const mediaCount = item.media.length
  const uriLower = first.uri.toLowerCase()
  let format: ContentFormat = 'static_post'
  if (mediaCount > 1) format = 'carousel'
  else if (uriLower.endsWith('.mp4') || uriLower.endsWith('.mov')) format = 'reel'

  const metrics = insightsIndex.get(baseName(first.uri)) ?? emptyMetrics()
  posts.push({
    ig_post_uri: first.uri,
    published_at: new Date(timestamp * 1000).toISOString(),
    content_format: format,
    caption: item.title ?? '',
    ...metrics,
    confidence_level: metrics.reach !== null ? 'L1' : 'L0',
  })
}
return { posts, found: true }
}

function extractReels(zip: AdmZip, insightsIndex: Map<string, PostMetrics>): { posts: UnifiedPost[]; found: boolean } {
const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.reels)
if (!raw) return { posts: [], found: false }

const parsed = ReelsFileSchema.safeParse(raw)
if (!parsed.success) return { posts: [], found: false }

const posts: UnifiedPost[] = []
for (const item of parsed.data.ig_reels_media) {
  const first = item.media[0]
  if (!first?.uri || !first.creation_timestamp) continue

  const metrics = insightsIndex.get(baseName(first.uri)) ?? emptyMetrics()
  posts.push({
    ig_post_uri: first.uri,
    published_at: new Date(first.creation_timestamp * 1000).toISOString(),
    content_format: 'reel',
    caption: first.title ?? '',
    ...metrics,
    confidence_level: metrics.reach !== null ? 'L1' : 'L0',
  })
}
return { posts, found: true }
}

/* ── BLOCO 2: Insights de conta ─────────────────────────────────────────── */
// ✅ CORRIGIDO (achado #13) — antes, se content_interactions.json faltasse,
// a função retornava null e DESCARTAVA também profiles_reached.json mesmo
// que ele existisse e fosse válido. Agora cada fonte é opcional e
// independente; só retorna null se NENHUMA das duas existir.
function extractAccountInsights(zip: AdmZip): AccountInsights | null {
const filesUsed: string[] = []
const filesMissing: string[] = []

let periodStart: string | null = null
let periodEnd: string | null = null
let totalShares = 0, totalSaves = 0, totalLikes = 0, totalComments = 0
let alcance = 0, impressoes = 0, visitasPerfil = 0, cliquesLink = 0
let reachFollowersPct: number | null = null
let anySourceFound = false

const rawInter = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.contentInteractions)
if (rawInter) {
  const parsedInter = ContentInteractionsSchema.safeParse(rawInter)
  if (parsedInter.success) {
    anySourceFound = true
    filesUsed.push(NATIVE_PATHS.contentInteractions)
    const smd = parsedInter.data.organic_insights_interactions[0]?.string_map_data ?? {}
    const dateRangeRaw = resolveStringMetric(smd, 'DATE_RANGE')
    if (dateRangeRaw) ({ start: periodStart, end: periodEnd } = parseDateRange(dateRangeRaw))

    const sharesPost = resolveIntMetric(smd, 'SHARES_POST', logMissingKey)
    const savesPost = resolveIntMetric(smd, 'SAVES_POST', logMissingKey)
    const likesPost = resolveIntMetric(smd, 'LIKES_POST', logMissingKey)
    const commentsPost = resolveIntMetric(smd, 'COMMENTS_POST', logMissingKey)
    const sharesReels = resolveIntMetric(smd, 'SHARES_REELS', logMissingKey)
    const savesReels = resolveIntMetric(smd, 'SAVES_REELS', logMissingKey)
    const likesReels = resolveIntMetric(smd, 'LIKES_REELS', logMissingKey)
    const commReels = resolveIntMetric(smd, 'COMMENTS_REELS', logMissingKey)

    totalShares = sharesPost + sharesReels
    totalSaves = savesPost + savesReels
    totalLikes = likesPost + likesReels
    totalComments = commentsPost + commReels

    // ✅ NOVO — confirmado com export real (dogativo, 13/09/2026): esse
    // cliente não tem profiles_reached.json separado; impressões/visitas/
    // cliques vêm mescladas dentro de content_interactions.json mesmo.
    // Lidas aqui como fallback; profiles_reached.json (abaixo) tem prioridade
    // quando existir.
    impressoes = resolveIntMetric(smd, 'IMPRESSIONS', logMissingKey)
    visitasPerfil = resolveIntMetric(smd, 'PROFILE_VISITS_FROM', logMissingKey)
    cliquesLink = resolveIntMetric(smd, 'EXTERNAL_LINK_TAPS', logMissingKey)
  } else {
    filesMissing.push(NATIVE_PATHS.contentInteractions)
  }
} else {
  filesMissing.push(NATIVE_PATHS.contentInteractions)
}

const rawReach = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.profilesReached)
if (rawReach) {
  const parsedReach = ReachFileSchema.safeParse(rawReach)
  const reachEntry = parsedReach.success ? parsedReach.data.organic_insights_reach[0] : undefined
  if (reachEntry) {
    anySourceFound = true
    const rsmd = reachEntry.string_map_data
    alcance = resolveIntMetric(rsmd, 'REACH', logMissingKey)
    impressoes = resolveIntMetric(rsmd, 'IMPRESSIONS', logMissingKey)
    visitasPerfil = resolveIntMetric(rsmd, 'PROFILE_VISITS_FROM', logMissingKey)
    cliquesLink = resolveIntMetric(rsmd, 'EXTERNAL_LINK_TAPS', logMissingKey)
    reachFollowersPct = resolvePercentMetric(rsmd, 'REACH_FROM_FOLLOWERS_PCT', logMissingKey)
    filesUsed.push(NATIVE_PATHS.profilesReached)
    // usa o período do reach como fallback se content_interactions não tinha
    if (!periodStart) {
      const dateRangeRaw2 = resolveStringMetric(rsmd, 'DATE_RANGE')
      if (dateRangeRaw2) ({ start: periodStart, end: periodEnd } = parseDateRange(dateRangeRaw2))
    }
  } else {
    filesMissing.push(NATIVE_PATHS.profilesReached)
  }
} else {
  filesMissing.push(NATIVE_PATHS.profilesReached)
}

if (!anySourceFound) return null

return {
  periodStart: periodStart ?? todayISO(),
  periodEnd: periodEnd ?? todayISO(),
  totalShares,
  totalSaves,
  totalLikes,
  totalComments,
  impressoes,
  alcance,
  visitasPerfil,
  cliquesLink,
  reachFollowersPct,
  filesUsed,
  filesMissing,
}
}

async function persistAccountInsights(clientId: string, sessionId: string, insights: AccountInsights): Promise<void> {
console.log(`\n💾 Gravando insights de conta (${insights.periodStart} ──> ${insights.periodEnd})...`)

const { data: existing } = await supabase
  .schema('orbit')
  .from('ig_account_snapshots')
  .select('id')
  .eq('client_id', clientId)
  .eq('period_start', insights.periodStart)
  .eq('period_end', insights.periodEnd)
  .maybeSingle()

const payload = {
  client_id: clientId,
  import_session: sessionId, // ✅ NOVO — antes ficava NULL (achado #1 da revisão)
  period_start: insights.periodStart,
  period_end: insights.periodEnd,
  reach_total: insights.alcance,
  impressions_total: insights.impressoes,
  profile_visits: insights.visitasPerfil,
  link_clicks: insights.cliquesLink,
  reach_followers_pct: insights.reachFollowersPct,
  interactions_likes: insights.totalLikes,
  interactions_comments: insights.totalComments,
  interactions_shares: insights.totalShares,
  interactions_saves: insights.totalSaves,
}

if (existing) {
  const { error } = await supabase.schema('orbit').from('ig_account_snapshots').update(payload).eq('id', existing.id)
  if (error) throw new Error(`Falha ao atualizar ig_account_snapshots: ${error.message}`) // ✅ NOVO (achado #4)
  console.log(`   ✅ ig_account_snapshots atualizado.`)
} else {
  const { error } = await supabase.schema('orbit').from('ig_account_snapshots').insert(payload)
  if (error) throw new Error(`Falha ao criar ig_account_snapshots: ${error.message}`) // ✅ NOVO (achado #4)
  console.log(`   ✅ ig_account_snapshots criado.`)
}
}

/* ── BLOCO 3: Demografia ────────────────────────────────────────────────── */
/* ── BLOCO 3: Demografia (CORRIGIDO — idade real, não mais hardcoded) ────── */
// ✅ CORRIGIDO (v2.1.0) — retorna null em vez de 0 quando o valor está
// ausente ou não parseable. Antes, parsePct('') = 0 fazia o cálculo
// other = 100 - 0 - 0 = 100, gravando gender_other_pct = 100 no banco
// quando o ZIP não tinha dados de gênero. Agora: ausência → null → NULL
// no banco. O chamador deve tratar null antes de calcular other_pct.
function parsePct(value: string): number | null {
  if (!value) return null
  const cleanValue = value.replace(',', '.')
  const match = cleanValue.match(/([\d.]+)%/)
  if (!match?.[1]) return null
  const v = parseFloat(match[1])
  return Number.isNaN(v) ? null : v
}

/**
 * ✅ CORREÇÃO — antes desta função nem existir, ageRange era hardcoded em
 * zero para todas as faixas. Confirmado no ZIP real (usuário, 30/08/2026):
 *
 *   'Porcentagem de seguidores por idade para todos os gêneros'
 *   -> '13-17: 0.7%, 18-24: 47.1%, 25-34: 35.7%, 35-44: 9.6%, 45-54: 4%,
 *       55-64: 1.6%, 65+: 0.8%'
 *
 * A Meta quebra em 7 faixas (até 55-64 e 65+ separados), mas o tipo
 * AgeRangeData do projeto só tem uma faixa '55+' — as duas últimas são
 * somadas aqui (1.6% + 0.8% = 2.4% no exemplo real acima).
 */
function parseAgeRange(value: string): AgeRangeData {
  const result: AgeRangeData = {
    '13-17': 0,
    '18-24': 0,
    '25-34': 0,
    '35-44': 0,
    '45-54': 0,
    '55+': 0,
  }

  if (!value) return result

  // Mapeia cada faixa bruta da Meta para a chave do nosso tipo.
  // '55-64' e '65+' colapsam na mesma chave '55+' (soma).
  const groupMap: Record<string, keyof AgeRangeData> = {
    '13-17': '13-17',
    '18-24': '18-24',
    '25-34': '25-34',
    '35-44': '35-44',
    '45-54': '45-54',
    '55-64': '55+',
    '65+': '55+',
  }

  // Ex.: "13-17: 0.7%, 18-24: 47.1%, ..., 65+: 0.8%"
  // ✅ CORRIGIDO (achado #14) — aceita também vírgula decimal (ex: "47,1%").
  const regex = /([\d]+[-+][\d]*)\s*:\s*([\d.,]+)%/g
  let match: RegExpExecArray | null = regex.exec(value)
  while (match !== null) {
    const rawGroup = match[1]
    const pctStr = match[2]
    if (rawGroup && pctStr) {
      const pct = parseFloat(pctStr.replace(',', '.'))
      const target = groupMap[rawGroup]
      if (target) {
        result[target] = Math.round((result[target] + pct) * 10) / 10
      }
    }
    match = regex.exec(value)
  }

  return result
}

function extractDemographicsBlock(zip: AdmZip): Demographics | null {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.audienceInsights)
  if (!raw) return null

  const parsed = AudienceInsightsSchema.safeParse(raw)
  if (!parsed.success) return null

  // ✅ CORRIGIDO (v2.1.0) — as chaves do audience_insights.json chegam com
  // mojibake (ex: "Percentagem total de seguidores que sÃ£o homens") assim
  // como as dos outros arquivos. mapMetrics() já aplicava fixMetaMojibake()
  // nas chaves do smd de posts, mas extractDemographicsBlock usava o smd
  // cru — as variantes do dicionário nunca batiam para contas pt-PT.
  const rawSmd = parsed.data.organic_insights_audience[0]?.string_map_data ?? {}
  const smd: typeof rawSmd = {}
  for (const [k, v] of Object.entries(rawSmd)) {
    smd[fixMetaMojibake(k)] = v
  }

  // ✅ NOVO — achado #2 da revisão: antes o período da demografia era sempre
  // a data de execução do script (new Date()), mesmo o arquivo tendo seu
  // próprio "Intervalo de datas" (mesma chave DATE_RANGE dos outros 2
  // arquivos de insight). Confirmado presente em audience_insights.json real.
  const dateRangeRaw = resolveStringMetric(smd, 'DATE_RANGE', logMissingKey)
  const { start: periodStart, end: periodEnd } = dateRangeRaw
    ? parseDateRange(dateRangeRaw)
    : { start: todayISO(), end: todayISO() }

  const malePctStr = resolveStringMetric(smd, 'PCT_MALE', logMissingKey)
  const femalePctStr = resolveStringMetric(smd, 'PCT_FEMALE', logMissingKey)
  // ✅ NOVO — antes esta linha não existia, e ageRange nunca era preenchido.
  const ageStr = resolveStringMetric(smd, 'PCT_AGE_ALL_GENDERS', logMissingKey)
  const citiesStr = resolveStringMetric(smd, 'PCT_CITY', logMissingKey)
  const countriesStr = resolveStringMetric(smd, 'PCT_COUNTRY', logMissingKey)

  const male = parsePct(malePctStr)
  const female = parsePct(femalePctStr)
  // ✅ CORRIGIDO (v2.1.0) — só calcula other quando AMBOS estão presentes.
  // Antes: male=0, female=0 → other=100. Agora: se qualquer um for null,
  // other também é null → grava NULL no banco (ausência real de dados).
  const other: number | null =
    male !== null && female !== null
      ? Math.max(0, Math.round((100 - male - female) * 10) / 10)
      : null

  // ✅ NOVO — aplica fixMetaMojibake() nos NOMES de cidade/país extraídos.
  // Confirmado com dados reais (mauricioartphoto, 13/09/2026): resolveStringMetric
  // devolve o valor cru do arquivo (só a CHAVE passa por correção de encoding
  // no dicionário, o VALOR nunca passava por nada) — por isso "São Paulo"
  // e "Guarujá" iriam pro banco como "SÃ£o Paulo" e "GuarujÃ¡".
  // ✅ CORRIGIDO (achado #14) — [\d.,]+ aceita vírgula decimal também aqui.
  const cities: LocationEntry[] = []
  const regex1 = /([^:,]+):\s*([\d.,]+)%/g
  let match: RegExpExecArray | null = regex1.exec(citiesStr)
  while (match !== null) {
    const name = match[1]
    const pctStr = match[2]
    if (name && pctStr) cities.push({ name: fixMetaMojibake(name.trim()), pct: parseFloat(pctStr.replace(',', '.')) })
    match = regex1.exec(citiesStr)
  }

  const countries: LocationEntry[] = []
  const regex2 = /([^:,]+):\s*([\d.,]+)%/g
  let match2: RegExpExecArray | null = regex2.exec(countriesStr)
  while (match2 !== null) {
    const name = match2[1]
    const pctStr = match2[2]
    if (name && pctStr) countries.push({ name: fixMetaMojibake(name.trim()), pct: parseFloat(pctStr.replace(',', '.')) })
    match2 = regex2.exec(countriesStr)
  }

  return {
    periodStart,
    periodEnd,
    gender: { male_pct: male, female_pct: female, other_pct: other },
    // ✅ ANTES: hardcoded em 0 para todas as faixas.
    // AGORA: parseado de verdade a partir de PCT_AGE_ALL_GENDERS.
    ageRange: parseAgeRange(ageStr),
    cities,
    countries,
  }
}
async function persistDemographics(clientId: string, sessionId: string, demographics: Demographics): Promise<void> {
  console.log(`\n💾 Gravando demografia (${demographics.periodStart} ──> ${demographics.periodEnd})...`)

  const payload = {
    client_id: clientId,
    import_session: sessionId, // ✅ NOVO (achado #1)
    period_start: demographics.periodStart, // ✅ NOVO — antes era sempre a data de hoje (achado #2)
    period_end: demographics.periodEnd,
    gender_female_pct: demographics.gender.female_pct,
    gender_male_pct: demographics.gender.male_pct,
    gender_other_pct: demographics.gender.other_pct,
    age_13_17_pct: demographics.ageRange['13-17'],
    age_18_24_pct: demographics.ageRange['18-24'],
    age_25_34_pct: demographics.ageRange['25-34'],
    age_35_44_pct: demographics.ageRange['35-44'],
    age_45_54_pct: demographics.ageRange['45-54'],
    age_55_plus_pct: demographics.ageRange['55+'],
    top_cities: demographics.cities,
    top_countries: demographics.countries,
  }

  // ✅ NOVO — antes fazia insert cego sempre; rodar o mesmo zip 2x duplicava
  // a linha (achado #6). Agora segue o mesmo padrão de persistAccountInsights.
  const { data: existing } = await supabase
    .schema('orbit')
    .from('ig_audience_snapshots')
    .select('id')
    .eq('client_id', clientId)
    .eq('period_start', demographics.periodStart)
    .eq('period_end', demographics.periodEnd)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.schema('orbit').from('ig_audience_snapshots').update(payload).eq('id', existing.id)
    if (error) throw new Error(`Falha ao atualizar ig_audience_snapshots: ${error.message}`) // ✅ NOVO (achado #4)
    console.log(`   ✅ ig_audience_snapshots atualizado.`)
  } else {
    const { error } = await supabase.schema('orbit').from('ig_audience_snapshots').insert(payload)
    if (error) throw new Error(`Falha ao criar ig_audience_snapshots: ${error.message}`) // ✅ NOVO (achado #4)
    console.log(`   ✅ ig_audience_snapshots criado.`)
  }
}

/* ── BLOCO 4: Persistência de Posts e Sessão ────────────────────────────── */
async function persistImportSession(
clientId: string,
hash: string,
periodStart: string | null,
periodEnd: string | null,
filesProcessed: string[],
filesMissing: string[]
): Promise<{ id: string }> {
// ✅ CORRIGIDO (achado #7) — antes buscava só por hash, então o mesmo
// arquivo (ou hash colidindo por acaso) processado para outro cliente
// reaproveitaria a sessão errada.
const { data: existingSession } = await supabase
  .schema('orbit')
  .from('ig_import_sessions')
  .select('id')
  .eq('client_id', clientId)
  .eq('export_zip_hash', hash)
  .maybeSingle()

if (existingSession) {
  console.log(`   ⚠️  Sessão já existe (${existingSession.id}), reutilizando.`)
  return existingSession
}

const { data: newSession, error } = await supabase
  .schema('orbit')
  .from('ig_import_sessions')
  .insert({
    client_id: clientId,
    export_zip_hash: hash,
    export_period_start: periodStart,
    export_period_end: periodEnd,
    scripts_run: ['ingest-from-zip'],
    files_processed: filesProcessed,
    files_missing: filesMissing,
    status: 'processing',
  })
  .select('id')
  .single()

if (error || !newSession) {
  throw new Error(`Falha ao criar sessão: ${error?.message}`)
}

console.log(`   ✅ Sessão criada: ${newSession.id}`)
return newSession
}

async function persistPosts(
clientId: string,
sessionId: string,
posts: UnifiedPost[]
): Promise<{ ok: number; updated: number; error: number }> {
if (posts.length === 0) {
  console.log(`   ℹ️  Nenhum post para gravar.`)
  return { ok: 0, updated: 0, error: 0 }
}

console.log(`   💾 Gravando ${posts.length} posts...`)

let ok = 0
let updated = 0
let errorCount = 0

for (const p of posts) {
  // ✅ CORRIGIDO (achado #8) — published_at não é único (dois posts podem
  // ser publicados no mesmo minuto/segundo); ig_post_uri é o identificador
  // real e estável do post.
  const { data: existingPost } = await supabase
    .schema('orbit')
    .from('ig_posts')
    .select('id')
    .eq('client_id', clientId)
    .eq('ig_post_uri', p.ig_post_uri)
    .maybeSingle()

  const postPayload = {
    client_id: clientId,
    import_session: sessionId,
    ig_post_uri: p.ig_post_uri,
    published_at: p.published_at,
    content_format: p.content_format,
    caption: p.caption,
    reach: p.reach,
    impressions: p.impressions, // ✅ CORRIGIDO (achado #17) — antes era um `null` fixo,
    // descartando o valor real já calculado em `p` (ver mapMetrics()).
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    confidence_level: p.confidence_level,
  }

  if (existingPost) {
    const { error: updateError } = await supabase
      .schema('orbit')
      .from('ig_posts')
      .update(postPayload)
      .eq('id', existingPost.id)
    if (updateError) {
      console.error(`      ❌ ${p.published_at}: ${updateError.message}`)
      errorCount++
    } else {
      updated++
    }
  } else {
    const { error: insertError } = await supabase
      .schema('orbit')
      .from('ig_posts')
      .insert(postPayload)
    if (insertError) {
      console.error(`      ❌ ${p.published_at}: ${insertError.message}`)
      errorCount++
    } else {
      ok++
    }
  }
}

console.log(`      ✅ Posts: novos=${ok} atualizados=${updated} erros=${errorCount}`)
return { ok, updated, error: errorCount }
}

/* ── Main ───────────────────────────────────────────────────────────────── */
async function run(): Promise<void> {
console.log('═══════════════════════════════════════════════════════')
console.log(`🔄 ORBIT · Ingest From Zip — v2.1.0`)
console.log(`📦 Zip: ${ZIP_PATH}`)
console.log(`📱 Cliente: ${CLIENT_USERNAME}`)
console.log(`${DRY_RUN ? '🧪 DRY RUN — nada será gravado' : '💾 Modo gravação real'}`)
console.log('═══════════════════════════════════════════════════════')

const clientId = await resolveClientId(supabase, CLIENT_USERNAME!)
const zip = new AdmZip(ZIP_PATH!)
const hash = zipHash(ZIP_PATH!)

// ✅ NOVO — checagem de sanidade ANTES de tentar extrair qualquer coisa.
const { anyKnownPathFound, sampleEntries } = diagnoseZipStructure(zip)
if (!anyKnownPathFound) {
  console.error('\n🚨 Nenhum dos caminhos esperados foi encontrado dentro do ZIP.')
  console.error('   Isso normalmente significa que a estrutura da exportação da Meta mudou,')
  console.error('   ou que o zip está aninhado numa pasta extra — NÃO que a conta está vazia.')
  console.error('\n   Caminhos esperados:')
  for (const p of Object.values(NATIVE_PATHS)) console.error(`     - ${p}`)
  console.error('\n   Primeiras entradas encontradas no zip:')
  for (const e of sampleEntries) console.error(`     - ${e}`)

  if (!DRY_RUN) {
    const errorMsg = `Estrutura do zip incompatível: nenhum caminho conhecido encontrado. ` +
      `Amostra de entradas: ${sampleEntries.slice(0, 8).join(', ')}`
    await supabase
      .schema('orbit')
      .from('ig_import_sessions')
      .insert({
        client_id: clientId,
        export_zip_hash: hash,
        scripts_run: ['ingest-from-zip'],
        files_processed: [],
        files_missing: Object.values(NATIVE_PATHS),
        status: 'failed',
        error_log: errorMsg,
        processed_at: new Date().toISOString(),
      })
    console.error('\n   ✅ Sessão registrada como `failed` (com error_log) para auditoria futura.')
  }
  process.exit(1)
}

const { index: insightsIndex, found: postsInsightsFound } = buildInsightsIndex(zip)
const { posts: flatPosts, found: postsFlatFound } = extractFlatPosts(zip, insightsIndex)
const { posts: reels, found: reelsFound } = extractReels(zip, insightsIndex)
// ✅ CORRIGIDO (achado #9) — um reel pode aparecer tanto em posts_1.json
// quanto em reels.json; sem isso, o mesmo post seria gravado 2x (ou o
// upsert por ig_post_uri simplesmente sobrescreveria, mas o array em
// memória e o log de "Posts: N" ainda contariam duplicado).
const allPosts = Array.from(
  new Map([...flatPosts, ...reels].map(post => [post.ig_post_uri, post])).values()
)

const accountInsights = extractAccountInsights(zip)
const demographics = extractDemographicsBlock(zip)

console.log(`\n📋 Posts: ${allPosts.length}`)
for (const p of allPosts.slice(0, 5)) {
  console.log(`   [${p.content_format}] ${p.published_at} reach=${p.reach ?? '—'}`)
}

if (accountInsights) {
  console.log(`📊 Insights: reach=${accountInsights.alcance} impressões=${accountInsights.impressoes}`)
}

if (demographics) {
  const gM = demographics.gender.male_pct !== null ? `${demographics.gender.male_pct}%` : 'N/D'
  const gF = demographics.gender.female_pct !== null ? `${demographics.gender.female_pct}%` : 'N/D'
  console.log(`👥 Demografia: M=${gM} F=${gF}`)
}

if (DRY_RUN) {
  console.log('\n✅ DRY RUN — nada foi gravado.')
  return
}

// ✅ CORRIGIDO (achados #10, #11, #12) — cada um dos 6 arquivos agora é
// registrado individualmente como processado ou ausente, em vez de
// assumir "teve post → os dois arquivos de posts funcionaram" e de
// deixar postsInsights (posts.json) completamente fora do manifesto.
const filesProcessed: string[] = []
const filesMissing: string[] = []

if (postsFlatFound) filesProcessed.push(NATIVE_PATHS.postsFlat)
else filesMissing.push(NATIVE_PATHS.postsFlat)

if (reelsFound) filesProcessed.push(NATIVE_PATHS.reels)
else filesMissing.push(NATIVE_PATHS.reels)

if (postsInsightsFound) filesProcessed.push(NATIVE_PATHS.postsInsights)
else filesMissing.push(NATIVE_PATHS.postsInsights)

if (accountInsights) {
  filesProcessed.push(...accountInsights.filesUsed)
  filesMissing.push(...accountInsights.filesMissing)
} else {
  filesMissing.push(NATIVE_PATHS.contentInteractions, NATIVE_PATHS.profilesReached)
}

if (demographics) filesProcessed.push(NATIVE_PATHS.audienceInsights)
else filesMissing.push(NATIVE_PATHS.audienceInsights)

// ✅ CORRIGIDO: Ordena posts por data ANTES de calcular o período
const sortedPosts = [...allPosts].sort((a, b) => 
  new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
)

const firstSortedPost = sortedPosts[0]
const lastSortedPost = sortedPosts[sortedPosts.length - 1]
const periodStart = firstSortedPost ? (firstSortedPost.published_at.split('T')[0] ?? null) : null
const periodEnd = lastSortedPost ? (lastSortedPost.published_at.split('T')[0] ?? null) : null

console.log(`\n💾 [Sessão]`)
const session = await persistImportSession(clientId, hash, periodStart, periodEnd, filesProcessed, filesMissing)

// ✅ NOVO (achado #5) — a partir daqui, qualquer exceção precisa marcar a
// sessão como `failed` em vez de deixá-la presa em `processing` para
// sempre. Antes, o catch() global só logava e saía sem tocar no banco.
try {
  console.log(`\n💾 [Posts]`)
  const postStats = await persistPosts(clientId, session.id, allPosts)

  if (accountInsights) {
    await persistAccountInsights(clientId, session.id, accountInsights) // ✅ CORRIGIDO (achado #1)
  }

  if (demographics) {
    await persistDemographics(clientId, session.id, demographics) // ✅ CORRIGIDO (achado #1)
  }

  // ✅ NOVO — nunca fechar como `done` se absolutamente nada foi extraído.
  // (posts=0 E sem insights de conta E sem demografia é um sinal forte de
  // parsing quebrado, não de conta vazia — ver diagnoseZipStructure acima.)
  const nothingExtracted = allPosts.length === 0 && !accountInsights && !demographics
  let finalStatus: string
  let errorLog: string | null = null

  if (postStats.error > 0) {
    finalStatus = 'failed'
    errorLog = `${postStats.error} post(s) falharam ao gravar.`
  } else if (nothingExtracted) {
    finalStatus = 'failed'
    errorLog = 'Nenhum post, insight de conta ou demografia foi extraído do zip, ' +
      'apesar de ao menos um caminho conhecido existir. Revisar parsing/schema Zod ' +
      '(provável mudança de formato dos arquivos internos da Meta).'
  } else {
    finalStatus = 'done'
  }

  await supabase
    .schema('orbit')
    .from('ig_import_sessions')
    .update({ status: finalStatus, error_log: errorLog, processed_at: new Date().toISOString() })
    .eq('id', session.id)

  if (finalStatus === 'failed') {
    console.error(`\n❌ Sessão marcada como FAILED: ${errorLog}`)
  } else {
    console.log(`\n🎉 Concluído: posts novos=${postStats.ok} atualizados=${postStats.updated} erros=${postStats.error}`)
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  await supabase
    .schema('orbit')
    .from('ig_import_sessions')
    .update({ status: 'failed', error_log: message, processed_at: new Date().toISOString() })
    .eq('id', session.id)
  console.error(`\n❌ Sessão ${session.id} marcada como FAILED: ${message}`)
  throw err
}
}

run().catch((err: unknown) => {
console.error('❌ Erro:', err instanceof Error ? err.message : String(err))
process.exit(1)
})