/* ==========================================================================
   ORBIT · Script de Ingestão L0 — v2.4.5 (Fase 1 Estabilizada)
   Arquivo: scripts/ingest-l0-v2.ts
   CORREÇÕES INTEGRADAS:
   1. resolveManifest() centralizado substitui resolvePostFiles() local 
   2. Unificação e correção semântica do CLIENT_UUID_MAP para evitar Skips
   ========================================================================== */
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'

// IMPORTAÇÃO EXPLICITA DO MANIFESTO CENTRALIZADO (RESOLVE CHECKLIST ITEM 3)
import { resolveManifest } from './lib/instagram-export-manifest.ts'

// ─── VALIDAÇÃO DE AMBIENTE ─────────────────────────────────────────────────
const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missingEnv = requiredEnv.filter(key => !process.env[key])
if (missingEnv.length > 0) {
 console.error(' ❌ VARIÁVEIS DE AMBIENTE FALTANDO:')
 missingEnv.forEach(key => console.error(` - ${key}`))
 process.exit(1)
}

// ─── Configuração ──────────────────────────────────────────────────────────
const supabase: SupabaseClient = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MODE = (
 process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] ??
 process.argv[process.argv.indexOf('--mode') + 1] ??
 'operational'
) as 'operational' | 'lead'

if (!['operational', 'lead'].includes(MODE)) {
 console.error(' ❌ --mode deve ser "operational" ou "lead"')
 process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = path.dirname(__filename)

const PASTAS: Record<'operational' | 'lead', string> = {
 operational: process.env.PASTA_OPERATIONAL
 ? path.resolve(process.env.PASTA_OPERATIONAL)
 : path.join(SCRIPT_DIR, '../../Alpha_Coleta/clientes'),
 lead: process.env.PASTA_LEAD
 ? path.resolve(process.env.PASTA_LEAD)
 : path.join(SCRIPT_DIR, '../../Alpha_Coleta/leads'),
}

const PASTA_LOCAL = PASTAS[MODE]
const AGENCY_UUID = process.env.AGENCY_UUID ?? '11111111-1111-1111-1111-111111111111'

// MAPA CORRIGIDO E SINCRO: EVITA A QUEDA DE COMPATIBILIDADE DE USERNAME
const CLIENT_UUID_MAP: Record<string, string> = {
 'cpimportstore':   '22222222-2222-2222-2222-222222222222',
 'eupetruchio':     '24140477-0c82-4fda-83df-958377f105ff', 
 'eupetruchio84':   '24140477-0c82-4fda-83df-958377f105ff',
 'petruchio84':     '24140477-0c82-4fda-83df-958377f105ff',
 'petruchiodev':    '24140477-0c82-4fda-83df-958377f105ff',
 'fiorefernando__': '33333333-3333-3333-3333-333333333333',
}

// ─── Schemas Zod ──────────────────────────────────────────────────────────
const CommentSchema = z.object({
 id: z.string(),
 text: z.string().default(''),
 ownerUsername: z.string(),
 timestamp: z.string().datetime({ offset: true }).optional(),
 likesCount: z.number().optional().default(0),
})

const MusicInfoSchema = z.object({
 uses_original_audio: z.boolean(),
 song_name: z.string().optional(),
 artist_name: z.string().optional(),
}).optional()

const TaggedUserSchema = z.object({
 username: z.string(),
 id: z.string(),
 full_name: z.string().nullable().optional(),
})

const ScraperPostSchema = z.object({
 id: z.string(),
 ownerUsername: z.string().optional(),
 ownerFullName: z.string().optional(),
 type: z.enum(['Video', 'Image', 'Sidecar']),
 timestamp: z.string().datetime({ offset: true }),
 caption: z.string().optional().default(''),
 hashtags: z.array(z.string()).optional().default([]),
 likesCount: z.number(),
 commentsCount: z.number().default(0),
 videoPlayCount: z.number().nullable().optional(),
 videoViewCount: z.number().nullable().optional(),
 videoDuration: z.number().nullable().optional(),
 productType: z.string().nullable().optional(),
 isPinned: z.boolean().nullable().optional(),
 locationName: z.string().nullable().optional(),
 musicInfo: MusicInfoSchema,
 latestComments: z.array(CommentSchema).optional().default([]),
 taggedUsers: z.array(TaggedUserSchema).optional().default([]),
 coauthorProducers: z.array(z.object({
 id: z.string(),
 username: z.string(),
 })).optional().default([]),
})

type ScraperPost = z.infer<typeof ScraperPostSchema>

const NativeMediaItemSchema = z.object({
 uri: z.string(),
 creation_timestamp: z.number(),
 media_metadata: z.object({
 video_metadata: z.object({
 exif_data: z.array(z.object({
 scene_capture_type: z.string().optional(),
 software: z.string().optional(),
 device_id: z.string().optional(),
 date_time_digitized: z.string().optional(),
 })).optional().default([]),
 }).optional(),
 camera_metadata: z.object({
 has_camera_metadata: z.boolean().optional(),
 }).optional(),
 }).optional(),
})

const NativeLabelValueSchema = z.object({
 label: z.string().optional(),
 value: z.string().optional(),
 href: z.string().optional(),
 media: z.array(z.object({
 uri: z.string().optional(),
 creation_timestamp: z.number().optional(),
 })).optional(),
})

const NativeExportPostSchema = z.object({
 timestamp: z.number().optional(),
 media: z.array(NativeMediaItemSchema).optional().default([]),
 label_values: z.array(NativeLabelValueSchema).optional().default([]),
})

type NativeExportPost = z.infer<typeof NativeExportPostSchema>
type PostRaw = ScraperPost

function nativeToPostRaw(item: NativeExportPost, username: string): PostRaw {
 const firstMedia = item.media?.[0]
 const creationTs = firstMedia?.creation_timestamp ?? item.timestamp ?? 0
 const ts = new Date(creationTs * 1000).toISOString()
 const isVideo = firstMedia?.uri?.endsWith('.mp4') ?? false
 const caption = item.label_values
 ?.filter(lv => lv.label !== 'Mídia' && lv.label !== 'Media' && typeof lv.value === 'string')
 .map(lv => lv.value ?? '')
 .join(' ')
 .trim() ?? ''
 const id = `native_${creationTs}_${username}`
 return {
 id,
 ownerUsername: username,
 type: isVideo ? 'Video' : 'Image',
 timestamp: ts,
 caption,
 hashtags: [],
 likesCount: 0,
 commentsCount: 0,
 videoPlayCount: null,
 videoViewCount: null,
 videoDuration: null,
 productType: null,
 isPinned: false,
 locationName: null,
 musicInfo: undefined,
 latestComments: [],
 taggedUsers: [],
 coauthorProducers: [],
 }
}

function parseItem(raw: unknown, username: string): PostRaw | null {
 const scraperResult = ScraperPostSchema.safeParse(raw)
 if (scraperResult.success) {
 return {
 ...scraperResult.data,
 ownerUsername: scraperResult.data.ownerUsername ?? username,
 }
 }
 const nativeResult = NativeExportPostSchema.safeParse(raw)
 if (nativeResult.success) {
 return nativeToPostRaw(nativeResult.data, username)
 }
 return null
}

const RE_COMPRA = [/envi[ao]/i, /frete/i, /entrega/i, /quanto custa/i, /como comprar/i, /como pedir/i, /aceita encomenda/i, /onde comprar/i, /tem disponível/i, /vende/i, /manda o link/i]
const RE_PRODUTO = [/workshop/i, /curso/i, /aula/i, /quero participar/i, /quando.*próximo/i, /tem vagas/i, /^QUERO$/i, /mais informações/i, /como funciona/i, /como faço/i]

function classificarComentarios(comments: ScraperPost['latestComments']) {
 let compra = 0, produto = 0, emocional = 0
 for (const c of (comments ?? [])) {
 if (RE_COMPRA.some(r => r.test(c.text))) compra++
 else if (RE_PRODUTO.some(r => r.test(c.text))) produto++
 else emocional++
 }
 return { intencao_compra: compra, intencao_produto: produto, emocional }
}

function tipoNarrativo(caption: string, hashtags: string[]): string {
 const c = caption.toLowerCase()
 if (/workshop|curso|aula|aprenda|tutorial/.test(c)) return 'tutorial_educativo'
 if (/buquê|flores|arranjo|presente|encomenda/.test(c)) return 'produto_servico'
 if (/parabéns|aniversário|celebr/.test(c)) return 'marco_pessoal'
 if (/link na bio|compre agora|acesse|clique/i.test(c)) return 'cta_venda_direta'
 if (/você já|já percebeu|e se|e você|como você/i.test(c)) return 'conteudo_reflexivo'
 if (hashtags.includes('tbt') || /\btbt\b/i.test(c)) return 'nostalgia_lifestyle'
 if (/galaxy|buds|produto|venda|mercado livre/i.test(c)) return 'produto_patrocinado'
 return 'outros'
}

function extrairUsernameFromPath(filePath: string): string | null {
 const match = filePath.match(/instagram-([^-/\\]+)-\d{4}-\d{2}-\d{2}/)
 return match ? match[1] : null
}

function transformPost(raw: PostRaw) {
 const likes = raw.likesCount === -1 ? null : raw.likesCount
 const playRate = raw.videoPlayCount && raw.videoViewCount && raw.videoPlayCount > 0
 ? parseFloat((raw.videoViewCount / raw.videoPlayCount).toFixed(4))
 : null
 const isCoautoria = (raw.coauthorProducers?.length ?? 0) > 0 || (raw.taggedUsers?.some(u => u.username !== raw.ownerUsername) ?? false)
 return {
 post_external_id: raw.id,
 owner_username: raw.ownerUsername ?? 'unknown',
 product_type: raw.type,
 product_type_detail: raw.productType ?? null,
 posted_at: raw.timestamp,
 caption_text: raw.caption ?? '',
 hashtags: raw.hashtags ?? [],
 is_pinned: raw.isPinned ?? false,
 location_name: raw.locationName ?? null,
 uses_original_audio: raw.musicInfo?.uses_original_audio ?? null,
 audio_name: raw.musicInfo?.song_name ?? null,
 is_coautoria: isCoautoria,
 tipo_narrativa: tipoNarrativo(raw.caption ?? '', raw.hashtags ?? []),
 likes_count: likes,
 comments_count: raw.commentsCount,
 video_play_count: raw.videoPlayCount ?? null,
 video_view_count: raw.videoViewCount ?? null,
 video_duration_s: raw.videoDuration ?? null,
 play_rate: playRate,
 comment_signals: classificarComentarios(raw.latestComments),
 tagged_users: raw.taggedUsers ?? [],
 }
}

async function ingestOperational(raw: PostRaw): Promise<'ok' | 'skip' | 'error'> {
 const clientUuid = CLIENT_UUID_MAP[raw.ownerUsername ?? 'unknown']
 if (!clientUuid) {
 console.warn(` ⚠️ [operational] Username "${raw.ownerUsername}" não mapeado em CLIENT_UUID_MAP.`)
 return 'skip'
 }
 const base = transformPost(raw)
 const today = new Date().toISOString().split('T')[0]
 const { data: existing } = await supabase.from('kpi_raw_ingestion').select('id').eq('client_id', clientUuid).eq('agency_id', AGENCY_UUID).contains('raw_payload', { post_external_id: base.post_external_id }).maybeSingle()
 if (existing) {
   console.log(` ⏭ [operational] Post ${raw.id} já existe.`)
   return 'skip'
 }
 const { error } = await supabase.from('kpi_raw_ingestion').insert({
   client_id: clientUuid,
   agency_id: AGENCY_UUID,
   source: 'instagram_graph_api',
   api_version: 'v19.0',
   endpoint: '/media/insights',
   period_start: today,
   period_end: today,
   ingestion_status: 'pending',
   schema_version: 1,
   product_type: base.product_type_detail,
   uses_original_audio: base.uses_original_audio,
   video_duration_s: base.video_duration_s,
   raw_payload: {
     post_external_id: base.post_external_id,
     owner_username: base.owner_username,
     product_type: base.product_type,
     posted_at: base.posted_at,
     likes_count: base.likes_count,
     comments_count: base.comments_count,
     video_play_count: base.video_play_count,
     video_view_count: base.video_view_count,
     play_rate: base.play_rate,
     is_pinned: base.is_pinned,
     is_coautoria: base.is_coautoria,
     tipo_narrativa: base.tipo_narrativa,
     audio_name: base.audio_name,
     location_name: base.location_name,
     comment_signals: base.comment_signals,
     hashtags: base.hashtags,
     caption_preview: base.caption_text.slice(0, 200),
   },
 })
 if (error) {
   console.error(` ❌ [operational] ${raw.id}:`, error.message)
   return 'error'
 }
 console.log(` ✅ [operational] Post ${raw.id} (${raw.ownerUsername}) → kpi_raw_ingestion`)
 return 'ok'
 }
async function ingestLead(raw: PostRaw): Promise<'ok' | 'skip' | 'error'> {
 const base = transformPost(raw)
 const { error } = await supabase.from('lead_raw_ingestion').upsert({
   ...base,
   agency_id: AGENCY_UUID,
   client_id: raw.ownerUsername ?? 'unknown',
   ingestion_mode: 'lead',
 }, {
   onConflict: 'post_external_id,client_id',
   ignoreDuplicates: false
 })
 if (error) {
   if (error.message.includes('duplicate key')) {
     console.log(` ⏭ [lead] Post ${raw.id} já existe.`)
     return 'skip'
   }
   console.error(` ❌ [lead] ${raw.id}:`, error.message)
   return 'error'
 }
 console.log(` ✅ [lead] Post ${raw.id} (${raw.ownerUsername}) → lead_raw_ingestion`)
 return 'ok'
 }
// Pipeline principal
async function run(): Promise<void> {
 console.log(`\n 🚀 ORBIT L0 Ingestão — v2.4.5`)
 console.log(` 📋 Modo: ${MODE.toUpperCase()}`)
 console.log(` 📂 Pasta: ${PASTA_LOCAL}\n`)
 if (!fs.existsSync(PASTA_LOCAL)) {
   console.error(` ❌ Pasta não encontrada: ${PASTA_LOCAL}`)
   process.exit(1)
 }
 const clientFolders = fs.readdirSync(PASTA_LOCAL).filter(f => fs.statSync(path.join(PASTA_LOCAL, f)).isDirectory())
 if (clientFolders.length === 0) {
   await processClientFolder(PASTA_LOCAL)
   return
 }
 for (const folder of clientFolders) {
   const folderPath = path.join(PASTA_LOCAL, folder)
   console.log(`\n── Cliente: ${folder}`)
   await processClientFolder(folderPath)
 }
 }
async function processClientFolder(folderPath: string): Promise<void> {
 const usernameFromPath = extrairUsernameFromPath(folderPath) ?? path.basename(folderPath)
 // IMPLEMENTAÇÃO DO MANIFESTO: ENGENHARIA CONECTADA (CHECKLIST ITEM 3)
 const manifestResult = resolveManifest(folderPath, 'ingest-l0-v2')
 console.log(` 👤 Username detectado: ${usernameFromPath}`)
 console.log(` 📦 ${manifestResult.found.length} arquivo(s) de posts encontrado(s) por manifesto`)
 if (manifestResult.found.length === 0) {
   console.warn(` ⚠️ Nenhum arquivo de posts encontrado por manifesto em ${folderPath}`)
   return
 }
 const results = { ok: 0, skip: 0, error: 0 }
 for (const fileName of manifestResult.found) {
   const filePath = path.join(folderPath, fileName)
   console.log(`\n 📄 Processando: ${fileName}`)
   let rawJson: unknown
 try {
 rawJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
 } catch (err) {
 const msg = err instanceof Error ? err.message : String(err)
 console.error(` ❌ Falha ao ler JSON [${fileName}]:`, msg)
 results.error++
 continue
 }
 const items: unknown[] = Array.isArray(rawJson) ? rawJson : [rawJson]
 for (const item of items) {
 const postRaw = parseItem(item, usernameFromPath)
 if (!postRaw) {
 console.warn(` ⚠️ Item ignorado — não passou em nenhum schema [${fileName}]`)
 results.error++
 continue
 }
 const status = MODE === 'operational' ? await ingestOperational(postRaw) : await ingestLead(postRaw)
 results[status]++
 }
 }
 console.log(`\n 📊 Resultado para ${usernameFromPath}:`)
 console.log(` ok: ${results.ok}`)
 console.log(` skip: ${results.skip}`)
 console.log(` error: ${results.error}`)
 }
 run().catch(err => {
 console.error(' ❌ Erro fatal:', err instanceof Error ? err.message : err)
 process.exit(1)
 })
