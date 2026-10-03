// ingest-from-zip.ts — orbit v2.2.1
import dotenv from 'dotenv'
import * as fs from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientId } from './lib/resolveClientId'
import {
  resolveIntMetricOrNull,
  resolveStringMetric,
  resolvePercentMetric,
  logMissingKey,
} from './lib/metric-key-dictionary'
import AdmZip from 'adm-zip'
import { createHash } from 'crypto'

dotenv.config({ path: '.env.local' })

const PERIOD_SOURCE = 'instagram_export' as const
const SCRIPT_NAME = 'ingest-from-zip'

/* ── CLI ────────────────────────────────────────────────────────────────── */
function argVal(flag: string): string | undefined {
  const eq = process.argv.find(a => a.startsWith(`--${flag}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const idx = process.argv.indexOf(`--${flag}`)
  const next = process.argv[idx + 1]
  if (idx >= 0 && next && !next.startsWith('--')) return next
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
  console.error('❌ --client=<handle> é obrigatório')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NATIVE_PATHS = {
  postsFlat: 'your_instagram_activity/media/posts_1.json',
  reels: 'your_instagram_activity/media/reels.json',
  postsInsights: 'logged_information/past_instagram_insights/posts.json',
  profilesReached: 'logged_information/past_instagram_insights/profiles_reached.json',
  contentInteractions: 'logged_information/past_instagram_insights/content_interactions.json',
  audienceInsights: 'logged_information/past_instagram_insights/audience_insights.json',
} as const

/* ── Zod (igual v2.2.0) ─────────────────────────────────────────────────── */
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
const ReelsFileSchema = z.object({
  ig_reels_media: z.array(z.object({ media: z.array(MediaItemSchema).min(1) })),
})
const InsightMetricSchema = z.object({ value: z.string().optional() })
const PostInsightSchema = z.object({
  media_map_data: z.record(z.string(), MediaItemSchema).optional().default({}),
  string_map_data: z.record(z.string(), InsightMetricSchema).optional().default({}),
})
const PostsInsightsFileSchema = z.object({
  organic_insights_posts: z.array(PostInsightSchema),
})

const MetricEntrySchema = z.object({
  href: z.string().optional(),
  value: z.preprocess(
    value => typeof value === 'number' ? String(value) : value,
    z.string().optional()
  ),
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

type ContentFormat = 'reel' | 'static_post' | 'carousel'
type Confidence = 'L0' | 'L1' | 'L2'

interface PostMetrics {
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
}
interface UnifiedPost extends PostMetrics {
  ig_post_uri: string
  published_at: string
  content_format: ContentFormat
  caption: string
}
interface AccountInsights {
  periodStart: string | null
  periodEnd: string | null
  totalShares: number | null
  totalSaves: number | null
  totalLikes: number | null
  totalComments: number | null
  impressoes: number | null
  alcance: number | null
  visitasPerfil: number | null
  cliquesLink: number | null
  reachFollowersPct: number | null
  filesUsed: string[]
  filesMissing: string[]
}
interface GenderData {
  male_pct: number | null
  female_pct: number | null
  other_pct: number | null
}
interface AgeRangeData {
  '13-17': number | null
  '18-24': number | null
  '25-34': number | null
  '35-44': number | null
  '45-54': number | null
  '55+': number | null
}
interface LocationEntry { name: string; pct: number }
interface Demographics {
  periodStart: string | null
  periodEnd: string | null
  gender: GenderData
  ageRange: AgeRangeData
  agePresent: boolean
  cities: LocationEntry[]
  citiesPresent: boolean
  countries: LocationEntry[]
  countriesPresent: boolean
}
interface ExistingPostRow {
  id: string
  ig_post_uri: string
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  confidence_level: Confidence | null
  is_estimated: boolean | null
}

function fixMetaMojibake(s: string): string {
  if (!/[ÃÂ]|â€/.test(s)) return s
  try { return Buffer.from(s, 'latin1').toString('utf-8') } catch { return s }
}
function baseName(uri: string): string { return uri.split('/').pop() ?? uri }
function emptyMetrics(): PostMetrics {
  return { reach: null, impressions: null, likes: null, comments: null, shares: null, saves: null }
}
function zipHash(zipPath: string): string {
  return createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex')
}
function readZipEntryAsJson<T>(zip: AdmZip, nativePath: string): T | null {
  const match = zip.getEntries().find(e => e.entryName.replace(/\\/g, '/').endsWith(nativePath))
  if (!match) return null
  return JSON.parse(match.getData().toString('utf-8')) as T
}
function diagnoseZipStructure(zip: AdmZip) {
  const entries = zip.getEntries().map(e => e.entryName.replace(/\\/g, '/'))
  return {
    anyKnownPathFound: Object.values(NATIVE_PATHS).some(p => entries.some(e => e.endsWith(p))),
    sampleEntries: entries.slice(0, 25),
  }
}
function sumOrNull(parts: Array<number | null>): number | null {
  const present = parts.filter((n): n is number => n !== null)
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0)
}
function compact<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>
}
function assertNoError(error: { message: string } | null, ctx: string): void {
  if (error) throw new Error(`${ctx}: ${error.message}`)
}
function isUniqueViolation(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message)
}

/**
 * Confiança = proveniência + disponibilidade, não um rank.
 *   L1 — métrica oficial do ZIP com reach
 *   L0 — post oficial do ZIP sem reach (catálogo; ER indeterminável)
 *   L2 — alcance modelado fora deste script (X / distribuição)
 * Este script nunca estima → nunca grava is_estimated = true.
 */
function confidenceFromExport(reach: number | null): Confidence {
  return reach !== null ? 'L1' : 'L0'
}

function mergeConfidence(existing: Confidence | null | undefined, incoming: Confidence): Confidence {
  if (incoming === 'L1') return 'L1'
  if (existing === 'L2') return 'L2'
  return incoming
}

function parseDateRange(range: string): { start: string; end: string } | null {
  const monthMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const year = new Date().getFullYear()
  function parseOnePart(part: string, fallbackYear: number) {
    const tokens = part.trim().replace(/,/g, '').split(/\s+/)
    const explicitYear = tokens[2] ? parseInt(tokens[2], 10) : null
    return {
      month: monthMap[tokens[0] ?? ''] ?? '',
      day: (tokens[1] ?? '').padStart(2, '0'),
      year: explicitYear && !Number.isNaN(explicitYear) ? explicitYear : fallbackYear,
    }
  }
  try {
    const [startPart, endPart] = range.split(' - ')
    if (!startPart || !endPart) return null
    const startParsed = parseOnePart(startPart, year)
    if (!startParsed.month || startParsed.day === '00') return null
    const hasExplicitYear = /\d{4}/.test(startPart) || /\d{4}/.test(endPart)
    let endParsed
    if (hasExplicitYear) {
      endParsed = parseOnePart(endPart, startParsed.year)
    } else {
      const provisional = parseOnePart(endPart, year)
      if (!provisional.month) return null
      const endYear = parseInt(provisional.month) < parseInt(startParsed.month) ? year + 1 : year
      endParsed = { ...provisional, year: endYear }
    }
    if (!endParsed.month) return null
    return {
      start: `${startParsed.year}-${startParsed.month}-${startParsed.day}`,
      end: `${endParsed.year}-${endParsed.month}-${endParsed.day}`,
    }
  } catch {
    return null
  }
}

/* ── Extração posts ─────────────────────────────────────────────────────── */
function mapMetrics(smdRaw: Record<string, { value?: string | undefined }>): PostMetrics {
  const smd: Record<string, { value?: string | undefined }> = {}
  for (const [k, v] of Object.entries(smdRaw)) smd[fixMetaMojibake(k)] = v
  return {
    reach: resolveIntMetricOrNull(smd, 'REACH'),
    impressions: resolveIntMetricOrNull(smd, 'IMPRESSIONS'),
    likes: resolveIntMetricOrNull(smd, 'LIKES'),
    comments: resolveIntMetricOrNull(smd, 'COMMENTS'),
    shares: resolveIntMetricOrNull(smd, 'SHARES'),
    saves: resolveIntMetricOrNull(smd, 'SAVES'),
  }
}

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

function extractFlatPosts(zip: AdmZip, insightsIndex: Map<string, PostMetrics>) {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsFlat)
  if (!raw) return { posts: [] as UnifiedPost[], found: false }
  const items = z.array(FlatPostSchema).safeParse(raw)
  if (!items.success) return { posts: [] as UnifiedPost[], found: false }
  const posts: UnifiedPost[] = []
  for (const item of items.data) {
    const [first] = item.media
    if (!first?.uri) continue
    const timestamp = item.creation_timestamp ?? first.creation_timestamp
    if (!timestamp) continue
    const uriLower = first.uri.toLowerCase()
    let format: ContentFormat = 'static_post'
    if (item.media.length > 1) format = 'carousel'
    else if (uriLower.endsWith('.mp4') || uriLower.endsWith('.mov')) format = 'reel'
    posts.push({
      ig_post_uri: first.uri,
      published_at: new Date(timestamp * 1000).toISOString(),
      content_format: format,
      caption: item.title ?? '',
      ...(insightsIndex.get(baseName(first.uri)) ?? emptyMetrics()),
    })
  }
  return { posts, found: true }
}

function extractReels(zip: AdmZip, insightsIndex: Map<string, PostMetrics>) {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.reels)
  if (!raw) return { posts: [] as UnifiedPost[], found: false }
  const parsed = ReelsFileSchema.safeParse(raw)
  if (!parsed.success) return { posts: [] as UnifiedPost[], found: false }
  const posts: UnifiedPost[] = []
  for (const item of parsed.data.ig_reels_media) {
    const first = item.media[0]
    if (!first?.uri || !first.creation_timestamp) continue
    posts.push({
      ig_post_uri: first.uri,
      published_at: new Date(first.creation_timestamp * 1000).toISOString(),
      content_format: 'reel',
      caption: first.title ?? '',
      ...(insightsIndex.get(baseName(first.uri)) ?? emptyMetrics()),
    })
  }
  return { posts, found: true }
}

/* ── Conta ──────────────────────────────────────────────────────────────── */
function extractAccountInsights(zip: AdmZip): AccountInsights | null {
  const filesUsed: string[] = []
  const filesMissing: string[] = []
  let periodStart: string | null = null
  let periodEnd: string | null = null
  let totalShares: number | null = null
  let totalSaves: number | null = null
  let totalLikes: number | null = null
  let totalComments: number | null = null
  let alcance: number | null = null
  let impressoes: number | null = null
  let visitasPerfil: number | null = null
  let cliquesLink: number | null = null
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
      if (dateRangeRaw) {
        const parsed = parseDateRange(dateRangeRaw)
        if (parsed) ({ start: periodStart, end: periodEnd } = parsed)
      }
      totalShares = sumOrNull([
        resolveIntMetricOrNull(smd, 'SHARES_POST'),
        resolveIntMetricOrNull(smd, 'SHARES_REELS'),
      ])
      totalSaves = sumOrNull([
        resolveIntMetricOrNull(smd, 'SAVES_POST'),
        resolveIntMetricOrNull(smd, 'SAVES_REELS'),
      ])
      totalLikes = sumOrNull([
        resolveIntMetricOrNull(smd, 'LIKES_POST'),
        resolveIntMetricOrNull(smd, 'LIKES_REELS'),
      ])
      totalComments = sumOrNull([
        resolveIntMetricOrNull(smd, 'COMMENTS_POST'),
        resolveIntMetricOrNull(smd, 'COMMENTS_REELS'),
      ])
      impressoes = resolveIntMetricOrNull(smd, 'IMPRESSIONS')
      visitasPerfil = resolveIntMetricOrNull(smd, 'PROFILE_VISITS_FROM')
      cliquesLink = resolveIntMetricOrNull(smd, 'EXTERNAL_LINK_TAPS')
    } else filesMissing.push(NATIVE_PATHS.contentInteractions)
  } else filesMissing.push(NATIVE_PATHS.contentInteractions)

  const rawReach = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.profilesReached)
  if (rawReach) {
    const parsedReach = ReachFileSchema.safeParse(rawReach)
    const reachEntry = parsedReach.success ? parsedReach.data.organic_insights_reach[0] : undefined
    if (reachEntry) {
      anySourceFound = true
      const rsmd = reachEntry.string_map_data
      alcance = resolveIntMetricOrNull(rsmd, 'REACH')
      const imp = resolveIntMetricOrNull(rsmd, 'IMPRESSIONS')
      const vis = resolveIntMetricOrNull(rsmd, 'PROFILE_VISITS_FROM')
      const clk = resolveIntMetricOrNull(rsmd, 'EXTERNAL_LINK_TAPS')
      if (imp !== null) impressoes = imp
      if (vis !== null) visitasPerfil = vis
      if (clk !== null) cliquesLink = clk
      reachFollowersPct = resolvePercentMetric(rsmd, 'REACH_FROM_FOLLOWERS_PCT', logMissingKey)
      filesUsed.push(NATIVE_PATHS.profilesReached)
      if (!periodStart) {
        const dateRangeRaw2 = resolveStringMetric(rsmd, 'DATE_RANGE')
        if (dateRangeRaw2) {
          const parsed = parseDateRange(dateRangeRaw2)
          if (parsed) ({ start: periodStart, end: periodEnd } = parsed)
        }
      }
    } else filesMissing.push(NATIVE_PATHS.profilesReached)
  } else filesMissing.push(NATIVE_PATHS.profilesReached)

  if (!anySourceFound) return null
  return {
    periodStart, periodEnd,
    totalShares, totalSaves, totalLikes, totalComments,
    impressoes, alcance, visitasPerfil, cliquesLink, reachFollowersPct,
    filesUsed, filesMissing,
  }
}

async function persistAccountInsights(clientId: string, sessionId: string, insights: AccountInsights) {
  if (!insights.periodStart || !insights.periodEnd) {
    console.warn('   ⚠️  ig_account_snapshots NÃO gravado: período ausente/inválido no ZIP.')
    return
  }
  console.log(`\n💾 Conta (${insights.periodStart} ──> ${insights.periodEnd})`)
  const payload = compact({
    client_id: clientId,
    import_session: sessionId,
    period_start: insights.periodStart,
    period_end: insights.periodEnd,
    period_source: PERIOD_SOURCE,
    reach_total: insights.alcance,
    impressions_total: insights.impressoes,
    profile_visits: insights.visitasPerfil,
    link_clicks: insights.cliquesLink,
    reach_followers_pct: insights.reachFollowersPct,
    interactions_likes: insights.totalLikes,
    interactions_comments: insights.totalComments,
    interactions_shares: insights.totalShares,
    interactions_saves: insights.totalSaves,
  })
  const { error } = await supabase.schema('orbit').from('ig_account_snapshots')
    .upsert(payload, { onConflict: 'client_id,period_start,period_end,period_source' })
  assertNoError(error, 'ig_account_snapshots upsert')
  console.log('   ✅ upsert conta. (churn resolve-below-threshold ainda é correção de trigger)')
}

/* ── Demografia ─────────────────────────────────────────────────────────── */
function parsePct(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.replace(',', '.').match(/([\d.]+)%/)
  if (!match?.[1]) return null
  const v = parseFloat(match[1])
  return Number.isNaN(v) ? null : v
}
function emptyAge(): AgeRangeData {
  return { '13-17': null, '18-24': null, '25-34': null, '35-44': null, '45-54': null, '55+': null }
}
function parseAgeRange(value: string | null | undefined) {
  const result = emptyAge()
  if (!value) return { age: result, present: false }
  const groupMap: Record<string, keyof AgeRangeData> = {
    '13-17': '13-17', '18-24': '18-24', '25-34': '25-34',
    '35-44': '35-44', '45-54': '45-54', '55-64': '55+', '65+': '55+',
  }
  const regex = /([\d]+[-+][\d]*)\s*:\s*([\d.,]+)%/g
  let match = regex.exec(value)
  let present = false
  while (match !== null) {
    if (match[1] && match[2]) {
      const target = groupMap[match[1]]
      if (target) {
        present = true
        result[target] = Math.round(((result[target] ?? 0) + parseFloat(match[2].replace(',', '.'))) * 10) / 10
      }
    }
    match = regex.exec(value)
  }
  return { age: result, present }
}

function parseLocations(raw: string | null): { list: LocationEntry[]; present: boolean } {
  if (!raw || !raw.trim()) return { list: [], present: false }
  const list: LocationEntry[] = []
  const re = /([^:,]+):\s*([\d.,]+)%/g
  let m = re.exec(raw)
  while (m !== null) {
    if (m[1] && m[2]) list.push({ name: fixMetaMojibake(m[1].trim()), pct: parseFloat(m[2].replace(',', '.')) })
    m = re.exec(raw)
  }
  return { list, present: true }
}

function extractDemographicsBlock(zip: AdmZip): Demographics | null {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.audienceInsights)
  if (!raw) return null
  const parsed = AudienceInsightsSchema.safeParse(raw)
  if (!parsed.success) return null
  const rawSmd = parsed.data.organic_insights_audience[0]?.string_map_data ?? {}
  const smd: typeof rawSmd = {}
  for (const [k, v] of Object.entries(rawSmd)) smd[fixMetaMojibake(k)] = v

  const dateRangeRaw = resolveStringMetric(smd, 'DATE_RANGE', logMissingKey)
  const period = dateRangeRaw ? parseDateRange(dateRangeRaw) : null
  const male = parsePct(resolveStringMetric(smd, 'PCT_MALE', logMissingKey))
  const female = parsePct(resolveStringMetric(smd, 'PCT_FEMALE', logMissingKey))
  const other = male !== null && female !== null
    ? Math.max(0, Math.round((100 - male - female) * 10) / 10)
    : null
  const { age, present: agePresent } = parseAgeRange(resolveStringMetric(smd, 'PCT_AGE_ALL_GENDERS', logMissingKey))
  const cities = parseLocations(resolveStringMetric(smd, 'PCT_CITY', logMissingKey))
  const countries = parseLocations(resolveStringMetric(smd, 'PCT_COUNTRY', logMissingKey))

  return {
    periodStart: period?.start ?? null,
    periodEnd: period?.end ?? null,
    gender: { male_pct: male, female_pct: female, other_pct: other },
    ageRange: age,
    agePresent,
    cities: cities.list,
    citiesPresent: cities.present,
    countries: countries.list,
    countriesPresent: countries.present,
  }
}

async function persistDemographics(clientId: string, sessionId: string, demographics: Demographics) {
  if (!demographics.periodStart || !demographics.periodEnd) {
    console.warn('   ⚠️  ig_audience_snapshots NÃO gravado: período ausente/inválido no ZIP.')
    return
  }
  console.log(`\n💾 Demografia (${demographics.periodStart} ──> ${demographics.periodEnd})`)
  const payload = compact({
    client_id: clientId,
    import_session: sessionId,
    period_start: demographics.periodStart,
    period_end: demographics.periodEnd,
    gender_female_pct: demographics.gender.female_pct,
    gender_male_pct: demographics.gender.male_pct,
    gender_other_pct: demographics.gender.other_pct,
    ...(demographics.agePresent ? {
      age_13_17_pct: demographics.ageRange['13-17'],
      age_18_24_pct: demographics.ageRange['18-24'],
      age_25_34_pct: demographics.ageRange['25-34'],
      age_35_44_pct: demographics.ageRange['35-44'],
      age_45_54_pct: demographics.ageRange['45-54'],
      age_55_plus_pct: demographics.ageRange['55+'],
    } : {}),
    ...(demographics.citiesPresent ? { top_cities: demographics.cities } : {}),
    ...(demographics.countriesPresent ? { top_countries: demographics.countries } : {}),
  })
  const { error } = await supabase.schema('orbit').from('ig_audience_snapshots')
    .upsert(payload, { onConflict: 'client_id,period_start,period_end' })
  assertNoError(error, 'ig_audience_snapshots upsert')
  console.log('   ✅ upsert audiência.')
  console.log('   ⚠️  avatar_alignment_snapshot só atualiza no INSERT do trigger — corrigir o trigger.')
}

/* ── Sessão + posts ─────────────────────────────────────────────────────── */
async function persistImportSession(
  clientId: string,
  hash: string,
  periodStart: string | null,
  periodEnd: string | null,
  filesProcessed: string[],
  filesMissing: string[]
): Promise<{ id: string }> {
  const { data, error } = await supabase.schema('orbit').from('ig_import_sessions')
    .upsert({
      client_id: clientId,
      export_zip_hash: hash,
      export_period_start: periodStart,
      export_period_end: periodEnd,
      scripts_run: [SCRIPT_NAME],
      files_processed: filesProcessed,
      files_missing: filesMissing,
      status: 'processing',
      error_log: null,
      processed_at: null,
    }, { onConflict: 'client_id,export_zip_hash' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Falha ao upsert sessão: ${error?.message}`)
  console.log(`   ✅ Sessão ${data.id}`)
  return data
}

function buildPostWritePayload(
  clientId: string,
  sessionId: string,
  p: UnifiedPost,
  existing: ExistingPostRow | null
) {
  const incomingConf = confidenceFromExport(p.reach)
  const confidence = mergeConfidence(existing?.confidence_level ?? null, incomingConf)

  // Este script não estima. Só zera is_estimated quando o ZIP autoriza (L1).
  // L2 existente sem reach novo: não mexe em is_estimated.
  const estimatedPatch: { is_estimated?: boolean } = {}
  if (incomingConf === 'L1') estimatedPatch.is_estimated = false
  else if (!existing) estimatedPatch.is_estimated = false

  const raw = {
    client_id: clientId,
    import_session: sessionId,
    ig_post_uri: p.ig_post_uri,
    published_at: p.published_at,
    content_format: p.content_format,
    caption: p.caption || null,
    reach: p.reach,
    impressions: p.impressions,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    confidence_level: confidence,
    ...estimatedPatch,
  }

  if (!existing) return { ...raw, is_estimated: false, confidence_level: incomingConf }
  return {
    ...compact(raw),
    client_id: clientId,
    import_session: sessionId,
    ig_post_uri: p.ig_post_uri,
    confidence_level: confidence,
    ...estimatedPatch,
  }
}

async function loadExistingByUris(clientId: string, uris: string[]) {
  const { data, error } = await supabase.schema('orbit').from('ig_posts')
    .select('id, ig_post_uri, reach, impressions, likes, comments, shares, saves, confidence_level, is_estimated')
    .eq('client_id', clientId)
    .in('ig_post_uri', uris)
  assertNoError(error, 'leitura ig_posts')
  const map = new Map<string, ExistingPostRow>()
  for (const row of data ?? []) map.set(row.ig_post_uri, row as ExistingPostRow)
  return map
}

async function persistPosts(clientId: string, sessionId: string, posts: UnifiedPost[]) {
  if (posts.length === 0) {
    console.log('   ℹ️  Nenhum post para gravar.')
    return { ok: 0, updated: 0, error: 0 }
  }
  console.log(`   💾 Gravando ${posts.length} posts...`)

  let existingByUri = await loadExistingByUris(clientId, posts.map(p => p.ig_post_uri))
  let ok = 0
  let updated = 0
  let errorCount = 0

  const inserts: Record<string, unknown>[] = []
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = []

  for (const p of posts) {
    const existing = existingByUri.get(p.ig_post_uri) ?? null
    const payload = buildPostWritePayload(clientId, sessionId, p, existing)
    if (existing) updates.push({ id: existing.id, payload })
    else inserts.push(payload)
  }

  if (inserts.length > 0) {
    const { error } = await supabase.schema('orbit').from('ig_posts').insert(inserts)
    if (error && isUniqueViolation(error)) {
      console.warn('      ⚠️  conflito no lote — relê e mescla.')
      existingByUri = await loadExistingByUris(clientId, posts.map(p => p.ig_post_uri))
      for (const payload of inserts) {
        const uri = String(payload.ig_post_uri)
        const existing = existingByUri.get(uri)
        const src = posts.find(p => p.ig_post_uri === uri)!
        const merged = buildPostWritePayload(clientId, sessionId, src, existing ?? null)
        if (existing) {
          const { error: uErr } = await supabase.schema('orbit').from('ig_posts')
            .update(merged).eq('id', existing.id)
          if (uErr) { console.error(`      ❌ retry update ${uri}: ${uErr.message}`); errorCount++ }
          else updated++
        } else {
          const { error: iErr } = await supabase.schema('orbit').from('ig_posts').insert(merged)
          if (iErr) { console.error(`      ❌ retry insert ${uri}: ${iErr.message}`); errorCount++ }
          else ok++
        }
      }
    } else if (error) {
      console.error(`      ❌ insert lote: ${error.message}`)
      errorCount += inserts.length
    } else {
      ok = inserts.length
    }
  }

  for (const u of updates) {
    const { error } = await supabase.schema('orbit').from('ig_posts').update(u.payload).eq('id', u.id)
    if (error) { console.error(`      ❌ update ${u.id}: ${error.message}`); errorCount++ }
    else updated++
  }

  console.log(`      ✅ novos=${ok} atualizados=${updated} erros=${errorCount}`)
  return { ok, updated, error: errorCount }
}

async function closeSession(sessionId: string, status: string, errorLog: string | null) {
  const { error } = await supabase.schema('orbit').from('ig_import_sessions')
    .update({ status, error_log: errorLog, processed_at: new Date().toISOString() })
    .eq('id', sessionId)
  assertNoError(error, `fechar sessão ${sessionId} como ${status}`)
}

async function recordFailedZipSession(clientId: string, hash: string, errorMsg: string) {
  const { error } = await supabase.schema('orbit').from('ig_import_sessions').insert({
    client_id: clientId,
    export_zip_hash: hash,
    scripts_run: [SCRIPT_NAME],
    files_processed: [],
    files_missing: Object.values(NATIVE_PATHS),
    status: 'failed',
    error_log: errorMsg,
    processed_at: new Date().toISOString(),
  })
  if (error && isUniqueViolation(error)) {
    const { error: uErr } = await supabase.schema('orbit').from('ig_import_sessions')
      .update({ status: 'failed', error_log: errorMsg, processed_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .eq('export_zip_hash', hash)
    if (uErr) console.error(`   ❌ failed session update: ${uErr.message}`)
    else console.error('   ✅ Sessão failed atualizada.')
  } else if (error) {
    console.error(`   ❌ sessão failed não gravou: ${error.message}`)
  } else {
    console.error('   ✅ Sessão failed registrada.')
  }
}

/* ── Main ───────────────────────────────────────────────────────────────── */
async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log('🔄 ORBIT · Ingest From Zip — v2.2.1')
  console.log(`📦 Zip: ${ZIP_PATH}`)
  console.log(`📱 Cliente: ${CLIENT_USERNAME}`)
  console.log(`${DRY_RUN ? '🧪 DRY RUN' : '💾 Gravação'} · source=${PERIOD_SOURCE}`)
  console.log('═══════════════════════════════════════════════════════')

  const clientId = await resolveClientId(supabase, CLIENT_USERNAME!)
  const zip = new AdmZip(ZIP_PATH!)
  const hash = zipHash(ZIP_PATH!)

  const { anyKnownPathFound, sampleEntries } = diagnoseZipStructure(zip)
  if (!anyKnownPathFound) {
    const errorMsg = `Estrutura do zip incompatível. Amostra: ${sampleEntries.slice(0, 8).join(', ')}`
    console.error('\n🚨 Nenhum caminho conhecido no ZIP.')
    if (!DRY_RUN) await recordFailedZipSession(clientId, hash, errorMsg)
    process.exit(1)
  }

  const { index: insightsIndex, found: postsInsightsFound } = buildInsightsIndex(zip)
  const { posts: flatPosts, found: postsFlatFound } = extractFlatPosts(zip, insightsIndex)
  const { posts: reels, found: reelsFound } = extractReels(zip, insightsIndex)
  const allPosts = Array.from(
    new Map([...flatPosts, ...reels].map(post => [post.ig_post_uri, post])).values()
  )
  const accountInsights = extractAccountInsights(zip)
  const demographics = extractDemographicsBlock(zip)

  console.log(`\n📋 Posts: ${allPosts.length}`)
  for (const p of allPosts.slice(0, 5)) {
    console.log(`   [${p.content_format}] ${p.published_at} reach=${p.reach ?? '—'} conf=${confidenceFromExport(p.reach)}`)
  }

  if (DRY_RUN) {
    console.log('\n✅ DRY RUN — nada gravado.')
    return
  }

  const filesProcessed: string[] = []
  const filesMissing: string[] = []
  if (postsFlatFound) filesProcessed.push(NATIVE_PATHS.postsFlat); else filesMissing.push(NATIVE_PATHS.postsFlat)
  if (reelsFound) filesProcessed.push(NATIVE_PATHS.reels); else filesMissing.push(NATIVE_PATHS.reels)
  if (postsInsightsFound) filesProcessed.push(NATIVE_PATHS.postsInsights); else filesMissing.push(NATIVE_PATHS.postsInsights)
  if (accountInsights) {
    filesProcessed.push(...accountInsights.filesUsed)
    filesMissing.push(...accountInsights.filesMissing)
  } else {
    filesMissing.push(NATIVE_PATHS.contentInteractions, NATIVE_PATHS.profilesReached)
  }
  if (demographics) filesProcessed.push(NATIVE_PATHS.audienceInsights)
  else filesMissing.push(NATIVE_PATHS.audienceInsights)

  const sorted = [...allPosts].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
  )
  const periodStart = sorted[0]?.published_at.split('T')[0] ?? accountInsights?.periodStart ?? demographics?.periodStart ?? null
  const periodEnd = sorted.at(-1)?.published_at.split('T')[0] ?? accountInsights?.periodEnd ?? demographics?.periodEnd ?? null

  let sessionId: string | null = null
  try {
    console.log('\n💾 [Sessão]')
    const session = await persistImportSession(clientId, hash, periodStart, periodEnd, filesProcessed, filesMissing)
    sessionId = session.id

    console.log('\n💾 [Posts]')
    const postStats = await persistPosts(clientId, session.id, allPosts)
    if (accountInsights) await persistAccountInsights(clientId, session.id, accountInsights)
    if (demographics) await persistDemographics(clientId, session.id, demographics)

    const nothingExtracted = allPosts.length === 0 && !accountInsights && !demographics
    let finalStatus = 'done'
    let errorLog: string | null = null
    if (postStats.error > 0) {
      finalStatus = 'failed'
      errorLog = `${postStats.error} post(s) falharam ao gravar.`
    } else if (nothingExtracted) {
      finalStatus = 'failed'
      errorLog = 'Nada extraído apesar de caminho conhecido.'
    }
    await closeSession(session.id, finalStatus, errorLog)
    if (finalStatus === 'failed') console.error(`\n❌ FAILED: ${errorLog}`)
    else console.log(`\n🎉 novos=${postStats.ok} atualizados=${postStats.updated}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (sessionId) {
      try { await closeSession(sessionId, 'failed', message) }
      catch (closeErr) { console.error('❌ falhou fechar sessão:', closeErr) }
    } else {
      await recordFailedZipSession(clientId, hash, message)
    }
    console.error(`\n❌ FAILED: ${message}`)
    throw err
  }
}

run().catch((err: unknown) => {
  console.error('❌ Erro:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})