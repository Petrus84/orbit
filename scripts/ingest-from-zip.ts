/* ==========================================================================
   ORBIT · Ingestão Unificada Direto do ZIP — v2.0.0
   Arquivo: scripts/ingest-from-zip.ts

   SUBSTITUI POR COMPLETO: ingest-l0-v2.ts, ingest-insights.ts,
   extract-demographics.ts. A partir desta versão, pasta manual sem .zip
   não é mais um modo suportado — só ingestão direto do export .zip nativo
   da Meta (opcionalmente enriquecido com --scraper).

   USO (recomendado — catálogo completo, com o dataset do Apify Instagram Scraper):
     npx tsx scripts/ingest-from-zip.ts \
       --zip="/caminho/export-nativo.zip" \
       --scraper="/caminho/dataset_instagram-scraper_*.json" \
       --client=cpimportstore --dry-run

   USO (fallback — só export nativo; catálogo de posts pode ficar incompleto):
     npx tsx scripts/ingest-from-zip.ts --zip="/caminho/export.zip" --client=cpimportstore --dry-run

   ========================================================================
   MUDANÇAS v2.0.0 (unificação):
   ========================================================================
   1. BLOCO DE POSTS (herdado de ingest-l0-v2.ts, sem mudança de lógica) →
      orbit.ig_posts.
   2. BLOCO DE INSIGHTS DE CONTA (novo, migrado de ingest-insights.ts) —
      lê content_interactions.json + profiles_reached.json do MESMO zip →
      orbit.metric_history + orbit.ig_account_snapshots. Usa
      lib/metric-key-dictionary.ts (SSOT de variantes de mojibake) em vez
      de helpers locais duplicados.
   3. BLOCO DE DEMOGRAFIA (novo, migrado de extract-demographics.ts) — lê
      audience_insights.json do MESMO zip → orbit.ig_audience_snapshots.
   4. NOVO CAMPO: reach_followers_pct. Confirmado em profiles_reached.json
      real que o campo "Seguidores" (dentro de organic_insights_reach) é um
      PERCENTUAL de composição do alcance — não confundir com a chave
      "Seguidores" de audience_insights.json, que é uma CONTAGEM. Ver
      comentário de alerta em metric-key-dictionary.ts (REACH_FROM_FOLLOWERS_PCT).
   5. CANONICALIDADE DE PERÍODO: content_interactions.json define
      period_start/period_end do snapshot. Se profiles_reached.json ou
      audience_insights.json trouxerem um intervalo de datas diferente,
      isso é só logado como aviso — nunca usado para sobrescrever o período
      canônico (decisão explícita, não uma limitação técnica).
   6. followers_total NUNCA é escrito em ig_account_snapshots, em nenhum
      dos três blocos. Trava de negócio permanente: a fonte confiável é
      orbit.client_onboarding.total_followers (manual_print_confirmado).
      Os dados de followers_1.json/audience_insights.json "Seguidores"
      (contagem) são estruturalmente parciais/cortados pela Meta —
      confirmado empiricamente antes desta versão. Por isso followers_1.json
      nem é mais lido por este script: não há uso legítimo para o valor.
   7. UPSERT "MAIS RECENTE VENCE" (decisão explícita do usuário) — em vez de
      pular (skip) um post/snapshot já existente, este script SEMPRE
      sobrescreve com o dado novo, tanto para preencher um campo NULL
      quanto para substituir um valor real por outro mais atual (ex: reach
      que o Instagram atualizou depois). Aplica-se a ig_posts,
      ig_account_snapshots e ig_audience_snapshots.
   8. export_zip_hash deixou de ser motivo de ABORTAR a execução inteira.
      Zips diferentes (hash diferente) sempre processam normalmente —
      isso já era verdade antes, mas o efeito colateral do
      "skip se já existe" no nível de post fazia parecer que reprocessar
      um zip novo não atualizava nada. Agora, mesmo que o zip seja
      literalmente idêntico (mesmo hash) o script só avisa e prossegue,
      nunca aborta — decisão de gravar ou não é sempre por registro
      individual, nunca all-or-nothing por sessão.
   ========================================================================== */

import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientId } from './lib/resolveClientId.ts'
import {
  resolveIntMetric,
  resolveStringMetric,
  resolvePercentMetric,
  logMissingKey,
} from './lib/metric-key-dictionary.ts'
// npm i adm-zip @types/adm-zip
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
const SCRAPER_JSON_PATH = argVal('scraper') // opcional, mas fortemente recomendado
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
if (SCRAPER_JSON_PATH && !fs.existsSync(SCRAPER_JSON_PATH)) {
  console.error(`❌ --scraper aponta pra um arquivo que não existe: ${SCRAPER_JSON_PATH}`)
  process.exit(1)
}
if (!SCRAPER_JSON_PATH) {
  console.warn(
    '⚠️  Rodando SEM --scraper. O export nativo da Meta costuma vir com o catálogo de\n' +
    '   posts estáticos/carrossel MUITO incompleto. Recomendo fortemente rodar com\n' +
    '   --scraper apontando pro dataset do Apify Instagram Scraper como fonte\n' +
    '   primária de conteúdo, usando o zip só pra enriquecer reach.\n'
  )
}

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ── Caminhos nativos fixos da Meta (não dependem de nome de pasta) ───────── */
const NATIVE_PATHS = {
  postsFlat: 'your_instagram_activity/media/posts_1.json',
  postsNested: 'your_instagram_activity/media/posts.json', // ignorado deliberadamente
  reels: 'your_instagram_activity/media/reels.json',
  postsInsights: 'logged_information/past_instagram_insights/posts.json',
  profilesReached: 'logged_information/past_instagram_insights/profiles_reached.json',
  contentInteractions: 'logged_information/past_instagram_insights/content_interactions.json',
  audienceInsights: 'logged_information/past_instagram_insights/audience_insights.json',
}

/* ── Zod Schemas: catálogo de posts ────────────────────────────────────── */
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

const ScraperItemSchema = z.object({
  shortCode: z.string(),
  type: z.string().optional(),
  productType: z.enum(['clips', 'feed', 'carousel_container']).or(z.string()),
  caption: z.string().optional().default(''),
  timestamp: z.string(),
  likesCount: z.number().nullable().optional(),
  commentsCount: z.number().nullable().optional(),
  videoViewCount: z.number().nullable().optional(),
  videoPlayCount: z.number().nullable().optional(),
  ownerUsername: z.string().optional(),
  url: z.string().optional(),
})

const ScraperFileSchema = z.array(ScraperItemSchema)

type ContentFormat = 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv'

const SCRAPER_FORMAT_MAP: Record<string, ContentFormat> = {
  clips: 'reel',
  feed: 'static_post',
  carousel_container: 'carousel',
}

/* ── Zod Schemas: insights de conta ────────────────────────────────────── */
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

/* ── Zod Schemas: demografia ────────────────────────────────────────────── */
const AudienceInsightsSchema = z.object({
  organic_insights_audience: z.array(z.object({
    title: z.string().optional(),
    string_map_data: z.record(z.string(), MetricEntrySchema),
  })),
})

/* ── Helpers gerais ─────────────────────────────────────────────────────── */
function decodeMetaUnicode(str: string): string {
  try {
    return decodeURIComponent(JSON.parse(`"${str.replace(/"/g, '\\"')}"`))
  } catch {
    return str
  }
}

function baseName(uri: string): string {
  return uri.split('/').pop() ?? uri
}

/* Os arquivos de insights da Meta (logged_information/past_instagram_insights/*)
   vêm com mojibake nativo — é assim que a própria Meta grava, não é bug de
   leitura nossa. Sem isso, toda busca por chave em português falha
   silenciosamente e reach fica sempre null. */
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

/* ── Parse de intervalo de datas (usado pelos 3 blocos) ────────────────── */
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

/* ── Tipos: catálogo de posts ───────────────────────────────────────────── */
interface PostMetrics {
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
}

function emptyMetrics(): PostMetrics {
  return { reach: null, likes: null, comments: null, shares: null, saves: null }
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
  confidence_level: 'L0' | 'L1' | 'L2'
}

/* ── Tipos: demografia ──────────────────────────────────────────────────── */
type GenderData = {
  male_pct: number
  female_pct: number
  other_pct: number
  updated_at: string
}

type AgeRangeData = {
  '13-17': number
  '18-24': number
  '25-34': number
  '35-44': number
  '45-54': number
  '55+': number
  updated_at: string
}

type LocationEntry = { name: string; pct: number }

type Demographics = {
  gender: GenderData
  ageRange: AgeRangeData
  cities: LocationEntry[]
  countries: LocationEntry[]
}

/* ── Leitura do zip ─────────────────────────────────────────────────────── */
function readZipEntryAsJson<T>(zip: AdmZip, nativePath: string): T | null {
  const entries = zip.getEntries()
  const match = entries.find(e => e.entryName.replace(/\\/g, '/').endsWith(nativePath))
  if (!match) return null
  const raw = match.getData().toString('utf-8')
  return JSON.parse(raw) as T
}

function zipHash(zipPath: string): string {
  const buf = fs.readFileSync(zipPath)
  return createHash('sha256').update(buf).digest('hex')
}

/* ── BLOCO 1: Catálogo de posts (herdado de ingest-l0-v2.ts) ────────────── */
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

function extractFromScraper(
  scraperPath: string,
  expectedUsername: string,
  insightsIndex: Map<string, PostMetrics>
): UnifiedPost[] {
  const raw = JSON.parse(fs.readFileSync(scraperPath, 'utf-8'))
  const parsed = ScraperFileSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('❌ dataset do scraper: falha de validação Zod:', parsed.error.issues[0])
    return []
  }

  const items = parsed.data
  const wrongOwner = items.filter(i => i.ownerUsername && i.ownerUsername !== expectedUsername)
  if (wrongOwner.length > 0) {
    console.error(
      `❌ ${wrongOwner.length} itens do scraper têm ownerUsername diferente de "${expectedUsername}" ` +
      `(ex: "${wrongOwner[0].ownerUsername}"). Isso indica dataset errado ou misturado — abortando.`
    )
    process.exit(1)
  }

  const seen = new Set<string>()
  const posts: UnifiedPost[] = []

  for (const item of items) {
    if (seen.has(item.shortCode)) {
      console.warn(`⚠️  shortCode duplicado no dataset do scraper, ignorando repetição: ${item.shortCode}`)
      continue
    }
    seen.add(item.shortCode)

    const format = SCRAPER_FORMAT_MAP[item.productType] ?? 'static_post'
    const day = item.timestamp.slice(0, 10)
    const nativeMetrics = insightsIndex.get(day) ?? null

    posts.push({
      ig_post_uri: `scraper:${item.shortCode}`,
      published_at: new Date(item.timestamp).toISOString(),
      content_format: format,
      caption: item.caption ?? '',
      reach: nativeMetrics?.reach ?? null,
      likes: item.likesCount ?? null,
      comments: item.commentsCount ?? null,
      shares: null,
      saves: nativeMetrics?.saves ?? null,
      confidence_level: nativeMetrics?.reach != null ? 'L1' : 'L0',
    })
  }

  return posts
}

function buildInsightsIndexByDay(zips: AdmZip[]): Map<string, PostMetrics> {
  const index = new Map<string, PostMetrics>()

  for (const zip of zips) {
    const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsInsights)
    if (!raw) continue

    const parsed = PostsInsightsFileSchema.safeParse(raw)
    if (!parsed.success) continue

    for (const item of parsed.data.organic_insights_posts) {
      const smd: Record<string, string | undefined> = {}
      for (const [k, v] of Object.entries(item.string_map_data)) smd[fixMetaMojibake(k)] = v.value

      const tsRaw = smd['Registro de data e hora da criação']
      if (!tsRaw) continue

      const day = tsRaw.slice(0, 10)
      index.set(day, {
        reach: intFromValue(smd['Contas alcançadas']),
        likes: intFromValue(smd['Curtidas']),
        comments: intFromValue(smd['Comentários']),
        shares: intFromValue(smd['Compartilhamentos']),
        saves: intFromValue(smd['Salvamentos']),
      })
    }
  }

  return index
}

function buildInsightsIndex(zip: AdmZip): Map<string, PostMetrics> {
  const index = new Map<string, PostMetrics>()

  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsInsights)
  if (!raw) return index

  const parsed = PostsInsightsFileSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn('⚠️  posts_insights: schema não bateu, reach por post ficará vazio')
    return index
  }

  for (const item of parsed.data.organic_insights_posts) {
    const metrics = mapMetrics(item.string_map_data)
    for (const media of Object.values(item.media_map_data)) {
      if (media.uri) index.set(baseName(media.uri), metrics)
    }
  }

  return index
}

function extractFlatPosts(
  zip: AdmZip,
  insightsIndex: Map<string, PostMetrics>
): { posts: UnifiedPost[]; found: boolean } {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.postsFlat)
  if (!raw) return { posts: [], found: false }

  const items = z.array(FlatPostSchema).safeParse(raw)
  if (!items.success) {
    console.error('❌ posts_1.json: falha de validação Zod:', items.error.issues[0])
    return { posts: [], found: true }
  }

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
      caption: decodeMetaUnicode(item.title ?? ''),
      ...metrics,
      confidence_level: metrics.reach !== null ? 'L1' : 'L0',
    })
  }

  return { posts, found: true }
}

function extractReels(
  zip: AdmZip,
  insightsIndex: Map<string, PostMetrics>
): { posts: UnifiedPost[]; found: boolean } {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.reels)
  if (!raw) return { posts: [], found: false }

  const parsed = ReelsFileSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('❌ reels.json: falha de validação Zod:', parsed.error.issues[0])
    return { posts: [], found: true }
  }

  const posts: UnifiedPost[] = []

  for (const item of parsed.data.ig_reels_media) {
    const first = item.media[0]
    if (!first?.uri || !first.creation_timestamp) continue

    const metrics = insightsIndex.get(baseName(first.uri)) ?? emptyMetrics()

    posts.push({
      ig_post_uri: first.uri,
      published_at: new Date(first.creation_timestamp * 1000).toISOString(),
      content_format: 'reel',
      caption: decodeMetaUnicode(first.title ?? ''),
      ...metrics,
      confidence_level: metrics.reach !== null ? 'L1' : 'L0',
    })
  }

  return { posts, found: true }
}

/* ── BLOCO 2: Insights de conta (migrado de ingest-insights.ts) ─────────── */
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

function extractAccountInsights(zip: AdmZip): AccountInsights | null {
  const filesUsed: string[] = []
  const filesMissing: string[] = []

  const rawInter = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.contentInteractions)
  if (!rawInter) {
    console.error(`❌ ${NATIVE_PATHS.contentInteractions} não encontrado — bloco de insights de conta pulado.`)
    return null
  }
  const parsedInter = ContentInteractionsSchema.safeParse(rawInter)
  if (!parsedInter.success) {
    console.error('❌ content_interactions.json: falha de validação Zod:', parsedInter.error.issues[0])
    return null
  }
  filesUsed.push(NATIVE_PATHS.contentInteractions)

  const smd = parsedInter.data.organic_insights_interactions[0]?.string_map_data ?? {}
  const dateRangeRaw = resolveStringMetric(smd, 'DATE_RANGE')
  const { start: periodStart, end: periodEnd } = dateRangeRaw
    ? parseDateRange(dateRangeRaw)
    : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }

  console.log(`   📊 Período canônico (content_interactions.json): ${periodStart} ──> ${periodEnd}`)

  const sharesPost = resolveIntMetric(smd, 'SHARES_POST', logMissingKey)
  const savesPost = resolveIntMetric(smd, 'SAVES_POST', logMissingKey)
  const likesPost = resolveIntMetric(smd, 'LIKES_POST', logMissingKey)
  const sharesReels = resolveIntMetric(smd, 'SHARES_REELS', logMissingKey)
  const savesReels = resolveIntMetric(smd, 'SAVES_REELS', logMissingKey)
  const likesReels = resolveIntMetric(smd, 'LIKES_REELS', logMissingKey)
  const commReels = resolveIntMetric(smd, 'COMMENTS_REELS', logMissingKey)

  const totalShares = sharesPost + sharesReels
  const totalSaves = savesPost + savesReels
  const totalLikes = likesPost + likesReels
  const totalComments = commReels

  let alcance = 0, impressoes = 0, visitasPerfil = 0, cliquesLink = 0
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

      // Checagem de divergência de período — só loga, nunca sobrescreve o canônico
      const reachDateRangeRaw = resolveStringMetric(rsmd, 'DATE_RANGE')
      if (reachDateRangeRaw) {
        const reachPeriod = parseDateRange(reachDateRangeRaw)
        if (reachPeriod.start !== periodStart || reachPeriod.end !== periodEnd) {
          console.warn(
            `⚠️  Período de profiles_reached.json (${reachPeriod.start} → ${reachPeriod.end}) diverge do ` +
            `período canônico de content_interactions.json (${periodStart} → ${periodEnd}). ` +
            `Prosseguindo com o período canônico — reach_followers_pct pode não corresponder exatamente ` +
            `a esse intervalo.`
          )
        }
      }

      // Validação de consistência (soma ~100%) — só avisa, nunca bloqueia
      const nonFollowersPct = resolvePercentMetric(rsmd, 'REACH_FROM_NON_FOLLOWERS_PCT', logMissingKey)
      if (reachFollowersPct !== null && nonFollowersPct !== null) {
        const sum = reachFollowersPct + nonFollowersPct
        if (Math.abs(sum - 100) > 0.5) {
          console.warn(`⚠️  Seguidores% (${reachFollowersPct}) + Não seguidores% (${nonFollowersPct}) = ${sum.toFixed(1)}, esperado ~100. Dado suspeito.`)
        }
      }

      filesUsed.push(NATIVE_PATHS.profilesReached)
    }
  } else {
    filesMissing.push(NATIVE_PATHS.profilesReached)
    console.warn(`⚠️  ${NATIVE_PATHS.profilesReached} não encontrado — reach/impressões/reach_followers_pct ficarão ausentes nesta sessão.`)
  }

  return {
    periodStart, periodEnd, totalShares, totalSaves, totalLikes, totalComments,
    impressoes, alcance, visitasPerfil, cliquesLink, reachFollowersPct,
    filesUsed, filesMissing,
  }
}

async function persistAccountInsights(clientId: string, insights: AccountInsights): Promise<void> {
  console.log(`\n💾 Gravando insights de conta (período ${insights.periodStart} ──> ${insights.periodEnd})...`)

  // metric_history: delete-então-insert do mesmo período — garante que
  // "mais recente vence" sem duplicar linhas em reprocessamento.
  await supabase
    .schema('orbit')
    .from('metric_history')
    .delete()
    .eq('client_id', clientId)
    .eq('metric_date', insights.periodEnd)
    .eq('platform', 'instagram')

  const metricsToInsert = [
    { metric: 'compartilhamentos-90d', value: insights.totalShares },
    { metric: 'salvamentos-90d', value: insights.totalSaves },
    { metric: 'curtidas-90d', value: insights.totalLikes },
    { metric: 'comentarios-90d', value: insights.totalComments },
    { metric: 'impressoes-90d', value: insights.impressoes },
    { metric: 'alcance-90d', value: insights.alcance },
    { metric: 'visitas-perfil-90d', value: insights.visitasPerfil },
    { metric: 'cliques-link-90d', value: insights.cliquesLink },
  ]

  for (const { metric, value } of metricsToInsert) {
    const { error } = await supabase
      .schema('orbit')
      .from('metric_history')
      .insert({
        client_id: clientId,
        metric_name: metric,
        metric_value: value,
        metric_date: insights.periodEnd,
        platform: 'instagram',
      })
    if (error) console.error(`   ❌ metric_history[${metric}]: ${error.message}`)
  }

  // ig_account_snapshots: upsert "mais recente vence" — sem coalescência
  // com valor antigo, o dado novo sempre substitui.
  //
  // ⚠️ followers_total NUNCA incluído no payload — trava de negócio
  // permanente. vps_pct/utility_score_pct/er_real_pct/polemic_score_pct
  // também NUNCA incluídos: são colunas GENERATED ALWAYS, o Postgres
  // rejeitaria qualquer INSERT/UPDATE explícito nelas.
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
    const { error } = await supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .update(payload)
      .eq('id', existing.id)
    if (error) console.error(`   ❌ Erro ao atualizar ig_account_snapshots: ${error.message}`)
    else console.log(`   ✅ ig_account_snapshots atualizado (dado novo sobrescreveu o antigo).`)
  } else {
    const { error } = await supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .insert(payload)
    if (error) console.error(`   ❌ Erro ao inserir ig_account_snapshots: ${error.message}`)
    else console.log(`   ✅ Novo ig_account_snapshots criado.`)
  }
}

/* ── BLOCO 3: Demografia (migrado de extract-demographics.ts) ───────────── */
function parsePct(value: string): number {
  if (!value) return 0
  const cleanValue = value.replace(',', '.')
  const match = cleanValue.match(/([\d.]+)%/)
  return match ? parseFloat(match[1]) : 0
}

function parseGenderFromPct(malePctStr: string, femalePctStr: string): Omit<GenderData, 'updated_at'> {
  const male = parsePct(malePctStr)
  const female = parsePct(femalePctStr)
  const other = Math.max(0, Math.round((100 - male - female) * 10) / 10)
  return { male_pct: male, female_pct: female, other_pct: other }
}

function parseAgeRange(value: string): Omit<AgeRangeData, 'updated_at'> {
  const result: Omit<AgeRangeData, 'updated_at'> = {
    '13-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0,
  }
  const groupMap: Record<string, keyof Omit<AgeRangeData, 'updated_at'>> = {
    '13-17': '13-17', '18-24': '18-24', '25-34': '25-34', '35-44': '35-44',
    '45-54': '45-54', '55-64': '55+', '65+': '55+', '55+': '55+',
  }
  const regex = /([\d]+[-+][\d]*):\s*([\d.]+)%/g
  let match: RegExpExecArray | null = regex.exec(value)
  while (match !== null) {
    const group = match[1]
    const pct = parseFloat(match[2])
    const target = groupMap[group]
    if (target) result[target] = Math.round((result[target] + pct) * 10) / 10
    match = regex.exec(value)
  }
  return result
}

function parseLocations(value: string): LocationEntry[] {
  const entries: LocationEntry[] = []
  const regex = /([^:,]+):\s*([\d.]+)%/g
  let match: RegExpExecArray | null = regex.exec(value)
  while (match !== null) {
    const name = match[1].trim()
    if (name) entries.push({ name, pct: parseFloat(match[2]) })
    match = regex.exec(value)
  }
  return entries
}

function extractDemographicsBlock(zip: AdmZip): { demographics: Demographics | null; dateRangeRaw: string } {
  const raw = readZipEntryAsJson<unknown>(zip, NATIVE_PATHS.audienceInsights)
  if (!raw) {
    console.warn(`⚠️  ${NATIVE_PATHS.audienceInsights} não encontrado — bloco de demografia pulado.`)
    return { demographics: null, dateRangeRaw: '' }
  }

  const parsed = AudienceInsightsSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`⚠️  audience_insights.json inválido: ${parsed.error.issues[0]?.message}`)
    return { demographics: null, dateRangeRaw: '' }
  }

  const smd = parsed.data.organic_insights_audience[0]?.string_map_data ?? {}
  const dateRangeRaw = parsed.data.organic_insights_audience[0]?.title ?? ''
  const now = new Date().toISOString()

  const malePctStr = resolveStringMetric(smd, 'PCT_MALE', logMissingKey)
  const femalePctStr = resolveStringMetric(smd, 'PCT_FEMALE', logMissingKey)
  const ageStr = resolveStringMetric(smd, 'PCT_AGE_ALL_GENDERS', logMissingKey)
  const citiesStr = resolveStringMetric(smd, 'PCT_CITY', logMissingKey)
  const countriesStr = resolveStringMetric(smd, 'PCT_COUNTRY', logMissingKey)

  if (!malePctStr && !ageStr) {
    console.warn('⚠️  Dados demográficos vazios')
    return { demographics: null, dateRangeRaw }
  }

  const demographics: Demographics = {
    gender: { ...parseGenderFromPct(malePctStr, femalePctStr), updated_at: now },
    ageRange: { ...parseAgeRange(ageStr), updated_at: now },
    cities: parseLocations(citiesStr),
    countries: parseLocations(countriesStr),
  }

  return { demographics, dateRangeRaw }
}

async function persistDemographics(
  clientId: string,
  demographics: Demographics,
  demoDateRangeRaw: string
): Promise<void> {
  // v2.0.1: demografia usa o PRÓPRIO intervalo de audience_insights.json —
  // decisão explícita, diferente do bloco de reach (que usa o período
  // canônico de content_interactions.json). Idade/gênero/cidade não têm
  // por que ficar presos à janela de interações de conteúdo; são uma
  // dimensão independente da conta.
  const { start: periodStart, end: periodEnd } = demoDateRangeRaw
    ? parseDateRange(demoDateRangeRaw)
    : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }

  console.log(`   📊 Período próprio da demografia (audience_insights.json): ${periodStart} ──> ${periodEnd}`)

  const safeCities = Array.isArray(demographics.cities) ? demographics.cities : []
  const safeCountries = Array.isArray(demographics.countries) ? demographics.countries : []

  const payload = {
    client_id: clientId,
    period_start: periodStart,
    period_end: periodEnd,
    gender_female_pct: demographics.gender?.female_pct ?? 0,
    gender_male_pct: demographics.gender?.male_pct ?? 0,
    gender_other_pct: demographics.gender?.other_pct ?? 0,
    age_13_17_pct: demographics.ageRange?.['13-17'] ?? 0,
    age_18_24_pct: demographics.ageRange?.['18-24'] ?? 0,
    age_25_34_pct: demographics.ageRange?.['25-34'] ?? 0,
    age_35_44_pct: demographics.ageRange?.['35-44'] ?? 0,
    age_45_54_pct: demographics.ageRange?.['45-54'] ?? 0,
    age_55_plus_pct: demographics.ageRange?.['55+'] ?? 0,
    top_cities: safeCities,
    top_countries: safeCountries,
  }

  // ig_audience_snapshots não tem constraint única pra ON CONFLICT
  // (confirmado em versão anterior) — "mais recente vence" é implementado
  // aqui como delete-então-insert do mesmo período, igual metric_history.
  await supabase
    .schema('orbit')
    .from('ig_audience_snapshots')
    .delete()
    .eq('client_id', clientId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)

  const { error } = await supabase
    .schema('orbit')
    .from('ig_audience_snapshots')
    .insert(payload)

  if (error) {
    console.error(`   ❌ Erro ao salvar demografia: ${error.message}`)
  } else {
    console.log(`   ✅ Demografia gravada: M=${payload.gender_male_pct}% F=${payload.gender_female_pct}%, ${safeCities.length} cidades, ${safeCountries.length} países.`)
  }
}

/* ── Pipeline principal ─────────────────────────────────────────────────── */
async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log(`🔄 ORBIT · Ingest From Zip — v2.0.0 (unificado)`)
  console.log(`📦 Zip: ${ZIP_PATH}`)
  console.log(`📱 Cliente: ${CLIENT_USERNAME}`)
  console.log(`${DRY_RUN ? '🧪 DRY RUN — nada será gravado no banco' : '💾 Modo gravação real'}`)
  console.log('═══════════════════════════════════════════════════════')

  const clientId = await resolveClientId(supabase, CLIENT_USERNAME!)
  console.log(`🔑 UUID resolvido: ${clientId}`)

  const zip = new AdmZip(ZIP_PATH!)
  const hash = zipHash(ZIP_PATH!)

  // v2.0.0: já processado não aborta mais — só avisa. Decisão de gravar ou
  // não é sempre por registro individual (ver upserts abaixo), nunca
  // all-or-nothing por sessão/hash.
  const { data: existingSession } = await supabase
    .schema('orbit')
    .from('ig_import_sessions')
    .select('id, created_at')
    .eq('export_zip_hash', hash)
    .maybeSingle()

  if (existingSession) {
    console.warn(
      `⚠️  Este .zip (hash idêntico) já foi processado em ${existingSession.created_at} ` +
      `(session ${existingSession.id}). Prosseguindo mesmo assim — cada registro decide ` +
      `individualmente se atualiza, com base no que já existe no banco.`
    )
  }

  const filesProcessed: string[] = []
  const filesMissing: string[] = []
  let allPosts: UnifiedPost[] = []

  /* ── BLOCO 1: Posts ── */
  if (SCRAPER_JSON_PATH) {
    console.log(`\n📥 [Posts] Usando dataset do scraper como fonte primária de conteúdo`)
    const insightsIndexByDay = buildInsightsIndexByDay([zip])
    console.log(`📊 Dias com métrica nativa (reach) disponível pra cruzar: ${insightsIndexByDay.size}`)

    allPosts = extractFromScraper(SCRAPER_JSON_PATH, CLIENT_USERNAME!, insightsIndexByDay)
    filesProcessed.push(`scraper:${path.basename(SCRAPER_JSON_PATH)}`)
    if (insightsIndexByDay.size > 0) {
      filesProcessed.push(NATIVE_PATHS.postsInsights)
    } else {
      filesMissing.push(`${NATIVE_PATHS.postsInsights} (sem timestamp utilizável)`)
    }
  } else {
    const insightsIndex = buildInsightsIndex(zip)
    console.log(`\n📊 [Posts] Índice de insights por post: ${insightsIndex.size} posts com métricas nativas`)

    const flat = extractFlatPosts(zip, insightsIndex)
    const reels = extractReels(zip, insightsIndex)

    if (flat.found) {
      filesProcessed.push(NATIVE_PATHS.postsFlat)
    } else {
      filesMissing.push(NATIVE_PATHS.postsFlat)
    }
    if (reels.found) {
      filesProcessed.push(NATIVE_PATHS.reels)
    } else {
      filesMissing.push(NATIVE_PATHS.reels)
    }
    if (insightsIndex.size > 0) {
      filesProcessed.push(NATIVE_PATHS.postsInsights)
    } else {
      filesMissing.push(NATIVE_PATHS.postsInsights)
    }

    allPosts = [...flat.posts, ...reels.posts]
  }

  const byTimestamp = new Map<string, UnifiedPost>()
  for (const p of allPosts) {
    const existing = byTimestamp.get(p.published_at)
    if (!existing || (p.reach !== null && existing.reach === null)) {
      byTimestamp.set(p.published_at, p)
    }
  }
  const dedupedPosts = Array.from(byTimestamp.values())

  const byFormat: Record<string, number> = {}
  for (const p of dedupedPosts) byFormat[p.content_format] = (byFormat[p.content_format] ?? 0) + 1

  console.log(`\n📋 [Posts] Resumo: bruto=${allPosts.length}, após dedup=${dedupedPosts.length}, por formato=${JSON.stringify(byFormat)}, com reach=${dedupedPosts.filter(p => p.reach !== null).length}`)

  /* ── BLOCO 2: Insights de conta ── */
  console.log(`\n📊 [Insights de conta] Extraindo...`)
  const accountInsights = extractAccountInsights(zip)
  if (accountInsights) {
    filesProcessed.push(...accountInsights.filesUsed)
    filesMissing.push(...accountInsights.filesMissing)
  }

  /* ── BLOCO 3: Demografia ── */
  console.log(`\n👥 [Demografia] Extraindo...`)
  const { demographics, dateRangeRaw: demoDateRangeRaw } = extractDemographicsBlock(zip)
  if (demographics) {
    filesProcessed.push(NATIVE_PATHS.audienceInsights)
  } else {
    filesMissing.push(NATIVE_PATHS.audienceInsights)
  }

  // Período coberto pela sessão: usa o período canônico de insights de
  // conta se disponível; senão cai pro min/max de published_at dos posts.
  let exportPeriodStart: string | null = null
  let exportPeriodEnd: string | null = null
  let periodDays: number | null = null

  if (accountInsights) {
    exportPeriodStart = accountInsights.periodStart
    exportPeriodEnd = accountInsights.periodEnd
    const start = new Date(exportPeriodStart).getTime()
    const end = new Date(exportPeriodEnd).getTime()
    periodDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  } else if (dedupedPosts.length > 0) {
    const timestamps = dedupedPosts.map(p => new Date(p.published_at).getTime())
    const minTs = Math.min(...timestamps)
    const maxTs = Math.max(...timestamps)
    exportPeriodStart = new Date(minTs).toISOString().split('T')[0]
    exportPeriodEnd = new Date(maxTs).toISOString().split('T')[0]
    periodDays = Math.max(1, Math.round((maxTs - minTs) / (1000 * 60 * 60 * 24)))
  }

  console.log(`\n🗓️  Período da sessão: ${exportPeriodStart ?? 'N/A'} ──> ${exportPeriodEnd ?? 'N/A'} (${periodDays ?? '—'} dias)`)
  console.log(`📁 Arquivos processados: ${filesProcessed.join(', ') || 'nenhum'}`)
  console.log(`📁 Arquivos ausentes: ${filesMissing.join(', ') || 'nenhum'}`)

  if (DRY_RUN) {
    console.log('\n🧪 DRY RUN — prévia do que seria gravado:')
    console.log(`   Posts: ${dedupedPosts.length}`)
    for (const p of dedupedPosts.slice(0, 10)) {
      console.log(`     [${p.content_format.padEnd(11)}] ${p.published_at} reach=${p.reach ?? '—'} likes=${p.likes ?? '—'}`)
    }
    if (dedupedPosts.length > 10) console.log(`     ... e mais ${dedupedPosts.length - 10} posts`)
    if (accountInsights) {
      console.log(`   Insights de conta: reach=${accountInsights.alcance} impressões=${accountInsights.impressoes} reach_followers_pct=${accountInsights.reachFollowersPct ?? '—'}`)
    }
    if (demographics) {
      console.log(`   Demografia: M=${demographics.gender.male_pct}% F=${demographics.gender.female_pct}%`)
    }
    console.log('\n✅ Nada foi gravado. Rode sem --dry-run para persistir.')
    return
  }

  // Cria a sessão de import cobrindo os 3 blocos
  const { data: session, error: sessionError } = await supabase
    .schema('orbit')
    .from('ig_import_sessions')
    .insert({
      client_id: clientId,
      export_zip_hash: hash,
      export_period_start: exportPeriodStart,
      export_period_end: exportPeriodEnd,
      period_days: periodDays,
      scripts_run: ['ingest-from-zip'],
      files_processed: filesProcessed,
      files_missing: filesMissing,
      status: 'processing',
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    console.error('❌ Falha ao criar ig_import_sessions:', sessionError?.message)
    process.exit(1)
  }

  /* ── Gravação BLOCO 1: Posts — "mais recente vence" (nunca skip) ── */
  console.log(`\n💾 [Posts] Gravando ${dedupedPosts.length} posts (import_session=${session.id})...`)
  let ok = 0, updated = 0, error = 0

  for (const p of dedupedPosts) {
    const { data: existingPost } = await supabase
      .schema('orbit')
      .from('ig_posts')
      .select('id')
      .eq('client_id', clientId)
      .eq('published_at', p.published_at)
      .maybeSingle()

    const postPayload = {
      client_id: clientId,
      import_session: session.id,
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
      if (updateError) { console.error(`   ❌ ${p.published_at}: ${updateError.message}`); error++ }
      else updated++
    } else {
      const { error: insertError } = await supabase
        .schema('orbit')
        .from('ig_posts')
        .insert(postPayload)
      if (insertError) { console.error(`   ❌ ${p.published_at}: ${insertError.message}`); error++ }
      else ok++
    }
  }

  console.log(`   ✅ Posts: novos=${ok} atualizados=${updated} erros=${error}`)

  /* ── Gravação BLOCO 2: Insights de conta ── */
  if (accountInsights) {
    await persistAccountInsights(clientId, accountInsights)
  }

  /* ── Gravação BLOCO 3: Demografia ── */
  // v2.0.2: desacoplado de accountInsights. Alinhado com a decisão já
  // documentada em persistDemographics (v2.0.1) — demografia usa período
  // próprio de audience_insights.json, então não depende de
  // content_interactions.json/accountInsights estar presente.
  if (demographics) {
    await persistDemographics(clientId, demographics, demoDateRangeRaw)
  }

  await supabase
    .schema('orbit')
    .from('ig_import_sessions')
    .update({ status: error > 0 ? 'failed' : 'done', processed_at: new Date().toISOString() })
    .eq('id', session.id)

  console.log(`\n🎉 Concluído: posts novos=${ok} atualizados=${updated} erros=${error}`)
}

run().catch((err: unknown) => {
  console.error('❌ Erro fatal:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})