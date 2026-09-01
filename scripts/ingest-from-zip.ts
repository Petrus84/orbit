import dotenv from 'dotenv'
import * as fs from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientId } from './lib/resolveClientId.ts'
import {
resolveIntMetric,
resolveStringMetric,
resolvePercentMetric,
logMissingKey,
} from './lib/metric-key-dictionary.ts'
import AdmZip from 'adm-zip'
import { createHash } from 'crypto'

dotenv.config({ path: '.env.local' })

/* ── CLI args ───────────────────────────────────────────────────────────── */
function argVal(flag: string): string | undefined {
const eq = process.argv.find(a => a.startsWith(`--${flag}=`))
if (eq) return eq.split('=').slice(1).join('=')
const idx = process.argv.indexOf(`--${flag}`)
if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
  return process.argv[idx + 1]
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
male_pct: number
female_pct: number
other_pct: number
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
gender: GenderData
ageRange: AgeRangeData
cities: LocationEntry[]
countries: LocationEntry[]
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fixMetaMojibake(s: string): string {
try {
  return Buffer.from(s, 'latin1').toString('utf-8')
} catch {
  return s
}
}

function intFromValue(v: string | undefined): number | null {
if (!v) return null
const cleaned = v.replace(/[^0-9-]/g, '')
if (cleaned === '') return null
return parseInt(cleaned, 10)
}

function baseName(uri: string): string {
return uri.split('/').pop() ?? uri
}

function emptyMetrics(): PostMetrics {
return { reach: null, likes: null, comments: null, shares: null, saves: null }
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

function parseDateRange(range: string): { start: string; end: string } {
const monthMap: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}
const today = new Date()
const year = today.getFullYear()

try {
  const [startPart, endPart] = range.split(' - ')
  const [startMon, startDay] = startPart.trim().split(' ')
  const [endMon, endDay] = endPart.trim().split(' ')

  const startM = monthMap[startMon] ?? '01'
  const endM = monthMap[endMon] ?? '12'

  const endYear = parseInt(endM) < parseInt(startM) ? year + 1 : year
  const startYear = year

  const start = `${startYear}-${startM}-${startDay.padStart(2, '0')}`
  const end = `${endYear}-${endM}-${endDay.padStart(2, '0')}`
  return { start, end }
} catch {
  const today2 = new Date().toISOString().split('T')[0]
  return { start: today2, end: today2 }
}
}

/* ── BLOCO 1: Catálogo de posts ─────────────────────────────────────────── */
function mapMetrics(smdRaw: Record<string, { value?: string }>): PostMetrics {
const smd: Record<string, string | undefined> = {}
for (const [k, v] of Object.entries(smdRaw)) {
  smd[fixMetaMojibake(k)] = v.value
}
return {
  reach: intFromValue(smd['Contas alcançadas']),
  likes: intFromValue(smd['Curtidas']),
  comments: intFromValue(smd['Comentários']),
  shares: intFromValue(smd['Compartilhamentos']),
  saves: intFromValue(smd['Salvamentos']),
}
}

function buildInsightsIndex(zip: AdmZip): Map<string, PostMetrics> {
const index = new Map<string, PostMetrics>()
const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsInsights)
if (!raw) return index

const parsed = PostsInsightsFileSchema.safeParse(raw)
if (!parsed.success) return index

for (const item of parsed.data.organic_insights_posts) {
  const metrics = mapMetrics(item.string_map_data)
  for (const media of Object.values(item.media_map_data)) {
    if (media.uri) index.set(baseName(media.uri), metrics)
  }
}
return index
}

function extractFlatPosts(zip: AdmZip, insightsIndex: Map<string, PostMetrics>): UnifiedPost[] {
const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsFlat)
if (!raw) return []

const items = z.array(FlatPostSchema).safeParse(raw)
if (!items.success) return []

const posts: UnifiedPost[] = []
for (const item of items.data) {
  const first = item.media[0]
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
return posts
}

function extractReels(zip: AdmZip, insightsIndex: Map<string, PostMetrics>): UnifiedPost[] {
const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.reels)
if (!raw) return []

const parsed = ReelsFileSchema.safeParse(raw)
if (!parsed.success) return []

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
return posts
}

/* ── BLOCO 2: Insights de conta ─────────────────────────────────────────── */
function extractAccountInsights(zip: AdmZip): AccountInsights | null {
const filesUsed: string[] = []
const filesMissing: string[] = []

const rawInter = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.contentInteractions)
if (!rawInter) return null

const parsedInter = ContentInteractionsSchema.safeParse(rawInter)
if (!parsedInter.success) return null
filesUsed.push(NATIVE_PATHS.contentInteractions)

const smd = parsedInter.data.organic_insights_interactions[0]?.string_map_data ?? {}
const dateRangeRaw = resolveStringMetric(smd, 'DATE_RANGE')
const { start: periodStart, end: periodEnd } = dateRangeRaw
  ? parseDateRange(dateRangeRaw)
  : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }

const sharesPost = resolveIntMetric(smd, 'SHARES_POST', logMissingKey)
const savesPost = resolveIntMetric(smd, 'SAVES_POST', logMissingKey)
const likesPost = resolveIntMetric(smd, 'LIKES_POST', logMissingKey)
const commentsPost = resolveIntMetric(smd, 'COMMENTS_POST', logMissingKey)
const sharesReels = resolveIntMetric(smd, 'SHARES_REELS', logMissingKey)
const savesReels = resolveIntMetric(smd, 'SAVES_REELS', logMissingKey)
const likesReels = resolveIntMetric(smd, 'LIKES_REELS', logMissingKey)
const commReels = resolveIntMetric(smd, 'COMMENTS_REELS', logMissingKey)

const totalShares = sharesPost + sharesReels
const totalSaves = savesPost + savesReels
const totalLikes = likesPost + likesReels
const totalComments = commentsPost + commReels

let alcance = 0
let impressoes = 0
let visitasPerfil = 0
let cliquesLink = 0
let reachFollowersPct: number | null = null

const rawReach = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.profilesReached)
if (rawReach) {
  const parsedReach = ReachFileSchema.safeParse(rawReach)
  if (parsedReach.success && parsedReach.data.organic_insights_reach.length > 0) {
    const rsmd = parsedReach.data.organic_insights_reach[0].string_map_data
    alcance = resolveIntMetric(rsmd, 'REACH', logMissingKey)
    impressoes = resolveIntMetric(rsmd, 'IMPRESSIONS', logMissingKey)
    visitasPerfil = resolveIntMetric(rsmd, 'PROFILE_VISITS_FROM', logMissingKey)
    cliquesLink = resolveIntMetric(rsmd, 'EXTERNAL_LINK_TAPS', logMissingKey)
    reachFollowersPct = resolvePercentMetric(rsmd, 'REACH_FROM_FOLLOWERS_PCT', logMissingKey)
    filesUsed.push(NATIVE_PATHS.profilesReached)
  }
} else {
  filesMissing.push(NATIVE_PATHS.profilesReached)
}

return {
  periodStart,
  periodEnd,
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

async function persistAccountInsights(clientId: string, insights: AccountInsights): Promise<void> {
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
  await supabase.schema('orbit').from('ig_account_snapshots').update(payload).eq('id', existing.id)
  console.log(`   ✅ ig_account_snapshots atualizado.`)
} else {
  await supabase.schema('orbit').from('ig_account_snapshots').insert(payload)
  console.log(`   ✅ ig_account_snapshots criado.`)
}
}

/* ── BLOCO 3: Demografia ────────────────────────────────────────────────── */
/* ── BLOCO 3: Demografia (CORRIGIDO — idade real, não mais hardcoded) ────── */
function parsePct(value: string): number {
  if (!value) return 0
  const cleanValue = value.replace(',', '.')
  const match = cleanValue.match(/([\d.]+)%/)
  return match ? parseFloat(match[1]) : 0
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
  const regex = /([\d]+[-+][\d]*)\s*:\s*([\d.]+)%/g
  let match: RegExpExecArray | null = regex.exec(value)
  while (match !== null) {
    const rawGroup = match[1]
    const pct = parseFloat(match[2])
    const target = groupMap[rawGroup]
    if (target) {
      result[target] = Math.round((result[target] + pct) * 10) / 10
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

  const smd = parsed.data.organic_insights_audience[0]?.string_map_data ?? {}

  const malePctStr = resolveStringMetric(smd, 'PCT_MALE', logMissingKey)
  const femalePctStr = resolveStringMetric(smd, 'PCT_FEMALE', logMissingKey)
  // ✅ NOVO — antes esta linha não existia, e ageRange nunca era preenchido.
  const ageStr = resolveStringMetric(smd, 'PCT_AGE_ALL_GENDERS', logMissingKey)
  const citiesStr = resolveStringMetric(smd, 'PCT_CITY', logMissingKey)
  const countriesStr = resolveStringMetric(smd, 'PCT_COUNTRY', logMissingKey)

  const male = parsePct(malePctStr)
  const female = parsePct(femalePctStr)
  const other = Math.max(0, Math.round((100 - male - female) * 10) / 10)

  const cities: LocationEntry[] = []
  const regex1 = /([^:,]+):\s*([\d.]+)%/g
  let match: RegExpExecArray | null = regex1.exec(citiesStr)
  while (match !== null) {
    cities.push({ name: match[1].trim(), pct: parseFloat(match[2]) })
    match = regex1.exec(citiesStr)
  }

  const countries: LocationEntry[] = []
  const regex2 = /([^:,]+):\s*([\d.]+)%/g
  let match2: RegExpExecArray | null = regex2.exec(countriesStr)
  while (match2 !== null) {
    countries.push({ name: match2[1].trim(), pct: parseFloat(match2[2]) })
    match2 = regex2.exec(countriesStr)
  }

  return {
    gender: { male_pct: male, female_pct: female, other_pct: other },
    // ✅ ANTES: hardcoded em 0 para todas as faixas.
    // AGORA: parseado de verdade a partir de PCT_AGE_ALL_GENDERS.
    ageRange: parseAgeRange(ageStr),
    cities,
    countries,
  }
}
async function persistDemographics(clientId: string, demographics: Demographics): Promise<void> {
  console.log(`\n💾 Gravando demografia...`)

  const payload = {
    client_id: clientId,
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
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

  await supabase.schema('orbit').from('ig_audience_snapshots').insert(payload)
  console.log(`   ✅ Demografia gravada.`)
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
const { data: existingSession } = await supabase
  .schema('orbit')
  .from('ig_import_sessions')
  .select('id')
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
  const { data: existingPost } = await supabase
    .schema('orbit')
    .from('ig_posts')
    .select('id')
    .eq('client_id', clientId)
    .eq('published_at', p.published_at)
    .maybeSingle()

  const postPayload = {
    client_id: clientId,
    import_session: sessionId,
    ig_post_uri: p.ig_post_uri,
    published_at: p.published_at,
    content_format: p.content_format,
    caption: p.caption,
    reach: p.reach,
    impressions: null,
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
console.log(`🔄 ORBIT · Ingest From Zip — v2.0.0 (Final)`)
console.log(`📦 Zip: ${ZIP_PATH}`)
console.log(`📱 Cliente: ${CLIENT_USERNAME}`)
console.log(`${DRY_RUN ? '🧪 DRY RUN — nada será gravado' : '💾 Modo gravação real'}`)
console.log('═══════════════════════════════════════════════════════')

const clientId = await resolveClientId(supabase, CLIENT_USERNAME!)
const zip = new AdmZip(ZIP_PATH!)
const hash = zipHash(ZIP_PATH!)

const insightsIndex = buildInsightsIndex(zip)
const flatPosts = extractFlatPosts(zip, insightsIndex)
const reels = extractReels(zip, insightsIndex)
const allPosts = [...flatPosts, ...reels]

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
  console.log(`👥 Demografia: M=${demographics.gender.male_pct}% F=${demographics.gender.female_pct}%`)
}

if (DRY_RUN) {
  console.log('\n✅ DRY RUN — nada foi gravado.')
  return
}

const filesProcessed: string[] = []
const filesMissing: string[] = []

if (allPosts.length > 0) filesProcessed.push(NATIVE_PATHS.postsFlat, NATIVE_PATHS.reels)
if (accountInsights) {
  filesProcessed.push(...accountInsights.filesUsed)
  filesMissing.push(...accountInsights.filesMissing)
}
if (demographics) filesProcessed.push(NATIVE_PATHS.audienceInsights)

// ✅ CORRIGIDO: Ordena posts por data ANTES de calcular o período
const sortedPosts = [...allPosts].sort((a, b) => 
  new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
)

const periodStart = sortedPosts.length > 0 ? sortedPosts[0].published_at.split('T')[0] : null
const periodEnd = sortedPosts.length > 0 ? sortedPosts[sortedPosts.length - 1].published_at.split('T')[0] : null

console.log(`\n💾 [Sessão]`)
const session = await persistImportSession(clientId, hash, periodStart, periodEnd, filesProcessed, filesMissing)

console.log(`\n💾 [Posts]`)
const postStats = await persistPosts(clientId, session.id, allPosts)

if (accountInsights) {
  await persistAccountInsights(clientId, accountInsights)
}

if (demographics) {
  await persistDemographics(clientId, demographics)
}

await supabase
  .schema('orbit')
  .from('ig_import_sessions')
  .update({ status: postStats.error > 0 ? 'failed' : 'done', processed_at: new Date().toISOString() })
  .eq('id', session.id)

console.log(`\n🎉 Concluído: posts novos=${postStats.ok} atualizados=${postStats.updated} erros=${postStats.error}`)
}

run().catch((err: unknown) => {
console.error('❌ Erro:', err instanceof Error ? err.message : String(err))
process.exit(1)
})