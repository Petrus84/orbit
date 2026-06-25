/* ==========================================================================
   ORBIT · Ingestão de Posts L0 – v3.1.0 (PRODUTIVO)
   Arquivo: scripts/ingest-l0-v2.ts
   Reescrito com tipagem forte, sem any, conformidade ESLint total
   ========================================================================== */

import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { resolveManifest } from './lib/instagram-export-manifest.ts'
import { resolveClientId } from './lib/resolveClientId.ts'

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES INICIAIS
// ─────────────────────────────────────────────────────────────────────────

dotenv.config({ path: '.env.local' })

type OperationMode = 'operational' | 'lead'

const VALID_MODES: readonly OperationMode[] = ['operational', 'lead']

function parseMode(): OperationMode {
  const modeArg = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1]
  const modeIndex = process.argv.indexOf('--mode')
  const mode = (modeArg ?? (modeIndex >= 0 ? process.argv[modeIndex + 1] : undefined) ?? 'operational') as string

  if (!VALID_MODES.includes(mode as OperationMode)) {
    console.error('❌ --mode deve ser "operational" ou "lead"')
    process.exit(1)
  }

  return mode as OperationMode
}

const MODE = parseMode()

const _filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = path.dirname(_filename)

const PASTAS: Record<OperationMode, string> = {
  operational: process.env.PASTA_OPERATIONAL
    ? path.resolve(process.env.PASTA_OPERATIONAL)
    : path.join(SCRIPT_DIR, '../../Alpha_Coleta/clientes'),
  lead: process.env.PASTA_LEAD
    ? path.resolve(process.env.PASTA_LEAD)
    : path.join(SCRIPT_DIR, '../../Alpha_Coleta/leads'),
}

const PASTA_LOCAL = PASTAS[MODE]

// Validação de variáveis de ambiente obrigatórias
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─────────────────────────────────────────────────────────────────────────
// SCHEMAS ZOD COM TIPAGEM FORTE
// ─────────────────────────────────────────────────────────────────────────

const CommentSchema = z.object({
  id: z.string(),
  text: z.string().default(''),
  ownerUsername: z.string(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  likesCount: z.number().int().nonnegative().optional().default(0),
})

type Comment = z.infer<typeof CommentSchema>

const PostTypeEnum = z.enum(['Video', 'Image', 'Sidecar'])
type PostType = z.infer<typeof PostTypeEnum>

const ScraperPostSchema = z.object({
  id: z.string(),
  ownerUsername: z.string().optional(),
  ownerFullName: z.string().optional(),
  type: PostTypeEnum,
  timestamp: z.string().datetime({ offset: true }),
  caption: z.string().optional().default(''),
  hashtags: z.array(z.string()).optional().default([]),
  likesCount: z.number().int(),
  commentsCount: z.number().int().nonnegative().default(0),
  videoPlayCount: z.number().int().positive().nullable().optional(),
  videoViewCount: z.number().int().positive().nullable().optional(),
  videoDuration: z.number().positive().nullable().optional(),
  productType: z.string().nullable().optional(),
  isPinned: z.boolean().nullable().optional(),
  locationName: z.string().nullable().optional(),
  latestComments: z.array(CommentSchema).optional().default([]),
})

type ScraperPost = z.infer<typeof ScraperPostSchema>
type PostRaw = ScraperPost

// ─────────────────────────────────────────────────────────────────────────
// TRANSFORMAÇÕES E CONVERSÕES
// ─────────────────────────────────────────────────────────────────────────

function parseItem(raw: unknown, username: string): PostRaw | null {
  const scraperResult = ScraperPostSchema.safeParse(raw)
  if (scraperResult.success) {
    return {
      ...scraperResult.data,
      ownerUsername: scraperResult.data.ownerUsername ?? username,
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────
// ANÁLISE DE COMENTÁRIOS E NARRATIVA
// ─────────────────────────────────────────────────────────────────────────

const RE_COMPRA: readonly RegExp[] = [
  /envi[ao]/i,
  /frete/i,
  /entrega/i,
  /quanto custa/i,
  /como comprar/i,
  /como pedir/i,
  /aceita encomenda/i,
  /onde comprar/i,
  /tem disponível/i,
  /vende/i,
  /manda o link/i,
]

const RE_PRODUTO: readonly RegExp[] = [
  /workshop/i,
  /curso/i,
  /aula/i,
  /quero participar/i,
  /quando.*próximo/i,
  /tem vagas/i,
  /^QUERO$/i,
  /mais informações/i,
  /como funciona/i,
  /como faço/i,
]

interface CommentSignals {
  intencao_compra: number
  intencao_produto: number
  emocional: number
}

function classificarComentarios(comments: Comment[]): CommentSignals {
  let compra = 0
  let produto = 0
  let emocional = 0

  for (const c of comments ?? []) {
    if (RE_COMPRA.some((r) => r.test(c.text))) {
      compra++
    } else if (RE_PRODUTO.some((r) => r.test(c.text))) {
      produto++
    } else {
      emocional++
    }
  }

  return { intencao_compra: compra, intencao_produto: produto, emocional }
}

type TipoNarrativa = 'promocional' | 'educativo' | 'bastidores' | 'lançamento' | 'outros'

function tipoNarrativo(caption: string, hashtags: string[]): TipoNarrativa {
  const text = `${caption} ${hashtags.join(' ')}`.toLowerCase()

  if (/promo[çc][ãa]o|desconto|oferta|cupom/.test(text)) return 'promocional'
  if (/dica|como fazer|tutorial|passo a passo/.test(text)) return 'educativo'
  if (/bastidor|equipe|dia a dia/.test(text)) return 'bastidores'
  if (/lan[çc]amento|novidade|chegou/.test(text)) return 'lançamento'

  return 'outros'
}

function extrairUsernameFromPath(filePath: string): string | null {
  const match = filePath.match(/instagram-([^/\\\\]+)-\\d{4}-\\d{2}-\\d{2}/)
  return match ? match[1] : null
}

// ─────────────────────────────────────────────────────────────────────────
// TIPOS DE DADOS TRANSFORMADOS
// ─────────────────────────────────────────────────────────────────────────

interface TransformedPost {
  post_external_id: string
  owner_username: string
  product_type: PostType
  product_type_detail: string | null
  posted_at: string
  caption_text: string
  hashtags: string[]
  is_pinned: boolean
  location_name: string | null
  is_coautoria: boolean
  tipo_narrativa: TipoNarrativa
  likes_count: number | null
  comments_count: number
  video_play_count: number | null
  video_view_count: number | null
  video_duration_s: number | null
  play_rate: number | null
  comment_signals: CommentSignals
}

function transformPost(raw: PostRaw): TransformedPost {
  const likes = raw.likesCount === -1 ? null : raw.likesCount

  const playRate =
    raw.videoPlayCount && raw.videoViewCount && raw.videoPlayCount > 0
      ? parseFloat((raw.videoViewCount / raw.videoPlayCount).toFixed(4))
      : null

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
    is_coautoria: false,
    tipo_narrativa: tipoNarrativo(raw.caption ?? '', raw.hashtags ?? []),
    likes_count: likes,
    comments_count: raw.commentsCount,
    video_play_count: raw.videoPlayCount ?? null,
    video_view_count: raw.videoViewCount ?? null,
    video_duration_s: raw.videoDuration ?? null,
    play_rate: playRate,
    comment_signals: classificarComentarios(raw.latestComments),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CAMADA DE PERSISTÊNCIA
// ─────────────────────────────────────────────────────────────────────────

type IngestResult = 'ok' | 'skip' | 'error'

async function ingestOperational(raw: PostRaw, clientUuid: string): Promise<IngestResult> {
  const base = transformPost(raw)

  const { error } = await supabase.from('instagram_posts').upsert(
    {
      client_id: clientUuid,
      instagram_post_id: base.post_external_id,
      media_type: base.product_type,
      timestamp: base.posted_at,
      like_count: base.likes_count,
      comments_count: base.comments_count,
      video_play_count: base.video_play_count,
      video_view_count: base.video_view_count,
      video_duration_s: base.video_duration_s,
      play_rate: base.play_rate,
      caption_preview: base.caption_text.slice(0, 200),
      hashtags: base.hashtags,
      is_pinned: base.is_pinned,
      is_coautoria: base.is_coautoria,
      tipo_narrativa: base.tipo_narrativa,
      location_name: base.location_name,
      comment_signals: base.comment_signals,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,instagram_post_id' }
  )

  if (error) {
    console.error(`❌ [operational] ${raw.id}:`, error.message)
    return 'error'
  }

  console.log(`☑  [operational] Post ${raw.id} (Salvo em instagram_posts)`)
  return 'ok'
}

async function ingestLead(raw: PostRaw): Promise<IngestResult> {
  console.log(`⏭  [lead] Post ${raw.id} (${raw.ownerUsername}) – modo lead não grava em tabelas relacionais.`)
  return 'skip'
}

// ─────────────────────────────────────────────────────────────────────────
// PROCESSAMENTO DE PASTAS
// ─────────────────────────────────────────────────────────────────────────

interface ProcessResults {
  ok: number
  skip: number
  error: number
}

async function processClientFolder(folderPath: string): Promise<void> {
  const usernameFromPath = extrairUsernameFromPath(folderPath) ?? path.basename(folderPath)
  console.log(`\\n- Cliente detectado na pasta: ${usernameFromPath}`)

  let clientUuid = ''

  if (MODE === 'operational') {
    try {
      clientUuid = await resolveClientId(supabase, usernameFromPath)
      console.log(`   🆔 UUID resolvido dinamicamente: ${clientUuid}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`   ⚠️ [Pular Pasta] Não foi possível resolver ID para ${usernameFromPath}: ${msg}`)
      return
    }
  }

      const manifestResult = resolveManifest(folderPath, 'ingest-10-v2')
  
  // ── DEFESA SÊNIOR: Se o manifesto não achar nada, fazemos a varredura direta!
  let arquivosParaProcessar = manifestResult?.found ?? []

  if (arquivosParaProcessar.length === 0) {
    console.log(`   🔍 [Fallback] Varrendo diretório direto por arquivos de posts...`)
    if (fs.existsSync(folderPath)) {
      const arquivosLocais = fs.readdirSync(folderPath)
      // Procura arquivos comuns de posts (ex: posts.json, instagram_posts.json)
      arquivosParaProcessar = arquivosLocais.filter(file => 
        file.endsWith('.json') && 
        (file.includes('post') || file.includes('media') || file.includes('content') || file.includes('igtv'))
      )
    }
  }

  console.log(`   📂 ${arquivosParaProcessar.length} arquivo(s) de posts selecionado(s) para processamento`)

  if (arquivosParaProcessar.length === 0) {
    console.warn(`   ⚠️ Nenhum arquivo de posts localizado em ${folderPath}`)
    return
  }

  // Sincronizando com o tipo ProcessResults que seu arquivo original exige (linha 350)!
  const results: ProcessResults = { ok: 0, skip: 0, error: 0 }

  // Sincronizando o loop com as variáveis corretas do arquivo original
  for (const fileName of arquivosParaProcessar) {
    const filePath = path.join(folderPath, fileName) // Usado ativamente! (linha 354)
    console.log(`\n   📄 Processando: ${fileName}`)

    let rawJson: unknown
    try {
      rawJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ❌ Falha ao ler JSON [${fileName}]:`, msg)
      results.error++
      continue
    }

    const items: unknown[] = Array.isArray(rawJson) ? rawJson : [rawJson]
    for (const item of items) {
      const postRaw = parseItem(item, usernameFromPath) // Usado ativamente! (linha 109)
      if (!postRaw) {
        console.warn(`   ⚠️ Item ignorado – não passou em nenhum schema [${fileName}]`)
        results.error++
        continue
      }

      // Consome os motores de gravação injetando o ID resolvido (linhas 255 e 291)
      const status = MODE === 'operational' 
        ? await ingestOperational(postRaw, clientUuid) 
        : await ingestLead(postRaw)
      results[status]++
    }
  }

  // Exibe o relatório final usando a variável results (linha 350)
  console.log(`\n   📊 Resultado para ${usernameFromPath}: ok: ${results.ok} | skip: ${results.skip} | error: ${results.error}`)
}


// ─────────────────────────────────────────────────────────────────────────
// RUNNER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log('🔄 ORBIT L0 Ingestão de Posts — v3.1.0')
  console.log(`💼 Modo: ${MODE.toUpperCase()}`)
  console.log(`📂 Pasta Origem: ${PASTA_LOCAL}`)
  console.log('═══════════════════════════════════════════════════════')

  if (!fs.existsSync(PASTA_LOCAL)) {
    console.error(`❌ Pasta não encontrada: ${PASTA_LOCAL}`)
    process.exit(1)
  }

  const clientFolders = fs
    .readdirSync(PASTA_LOCAL)
    .filter((f) => fs.statSync(path.join(PASTA_LOCAL, f)).isDirectory())

  if (clientFolders.length === 0) {
    await processClientFolder(PASTA_LOCAL)
    return
  }

  for (const folder of clientFolders) {
    const folderPath = path.join(PASTA_LOCAL, folder)
    await processClientFolder(folderPath)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO SEGURA
// ─────────────────────────────────────────────────────────────────────────

void run().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('❌ Erro crítico fatal na execução:', msg)
  process.exit(1)
})