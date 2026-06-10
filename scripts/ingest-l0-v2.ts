/* ==========================================================================
   ORBIT · Script de Ingestão L0 — v2.2.0
   Arquivo: scripts/ingest-l0-v2.ts

   CORREÇÕES v2.2.0 (10/06/2026):
     1. ✅ CLIENT_UUID_MAP atualizado com UUIDs reais do Supabase
     2. ✅ Extração de username da pasta (fallback para JSONs sem ownerUsername)

   MODOS:
     --mode operational  →  kpi_raw_ingestion  (cliente real, client_id = UUID)
     --mode lead         →  lead_raw_ingestion (prospecção, client_id = username)

   USO:
     npx ts-node scripts/ingest-l0-v2.ts --mode operational
     npx ts-node scripts/ingest-l0-v2.ts --mode lead

   CLIENTES CONFIGURADOS:
     - cpimportstore   (UUID: 22222222-2222-2222-2222-222222222222)
     - eupetruchio84   (UUID: 24140477-0c82-4fda-83df-958377f105ff)
     - fiorefernando__ (UUID: 33333333-3333-3333-3333-333333333333)
   ========================================================================== */

import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'

// ─── VALIDAÇÃO DE AMBIENTE ─────────────────────────────────────────────────

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const missingEnv = requiredEnv.filter(key => !process.env[key])
if (missingEnv.length > 0) {
  console.error('❌ VARIÁVEIS DE AMBIENTE FALTANDO:')
  missingEnv.forEach(key => {
    console.error(`   - ${key}`)
  })
  console.error('\n📝 Adicione ao .env.local:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxx')
  console.error('   PASTA_OPERATIONAL=../Alpha_Coleta/clientes')
  console.error('   PASTA_LEAD=../Alpha_Coleta/leads')
  process.exit(1)
}

// ─── Configuração ──────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Argumentos de linha de comando
const MODE = (process.argv.find(a => a.startsWith('--mode='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--mode') + 1]
  ?? 'operational') as 'operational' | 'lead'

if (!['operational', 'lead'].includes(MODE)) {
  console.error('❌ --mode deve ser "operational" ou "lead"')
  console.error('   Exemplo: npx ts-node scripts/ingest-l0-v2.ts --mode operational')
  process.exit(1)
}

// Pastas separadas por modo (relativo ao script)
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

// IDs operacionais
const AGENCY_UUID = process.env.AGENCY_UUID ?? '11111111-1111-1111-1111-111111111111'

// ✅ CORREÇÃO 1: Mapa de username → UUID (UUIDs reais do Supabase - 10/06/2026)
const CLIENT_UUID_MAP: Record<string, string> = {
  // ✅ Confirmados no Supabase (FASE 1)
  'cpimportstore':   '22222222-2222-2222-2222-222222222222',
  'eupetruchio84':   '24140477-0c82-4fda-83df-958377f105ff',
  
  // Aliases (mesma conta)
  'petruchio84':     '24140477-0c82-4fda-83df-958377f105ff',
  'petruchiodev':    '24140477-0c82-4fda-83df-958377f105ff',
  
  // ⚠️ Pendente validação no Supabase
  'fiorefernando__': '33333333-3333-3333-3333-333333333333',
}

// ─── Schema Zod — validação do JSON bruto ──────────────────────────────────

const CommentSchema = z.object({
  id:            z.string(),
  text:          z.string().default(''),
  ownerUsername: z.string(),
  timestamp:     z.string().datetime({ offset: true }).optional(),
  likesCount:    z.number().optional().default(0),
})

const MusicInfoSchema = z.object({
  uses_original_audio: z.boolean(),
  song_name:           z.string().optional(),
  artist_name:         z.string().optional(),
}).optional()

const TaggedUserSchema = z.object({
  username:  z.string(),
  id:        z.string(),
  full_name: z.string().nullable().optional(),
}).optional()

const PostRawSchema = z.object({
  id:               z.string(),
  ownerUsername:    z.string().optional(),  // ← Tornado opcional para fallback
  ownerFullName:    z.string().optional(),
  type:             z.enum(['Video', 'Image', 'Sidecar']),
  timestamp:        z.string().datetime({ offset: true }),
  caption:          z.string().optional().default(''),
  hashtags:         z.array(z.string()).optional().default([]),

  // Métricas
  likesCount:       z.number(),
  commentsCount:    z.number().default(0),
  videoPlayCount:   z.number().nullable().optional(),
  videoViewCount:   z.number().nullable().optional(),
  videoDuration:    z.number().nullable().optional(),

  // Enriquecimento
  productType:      z.string().nullable().optional(),
  isPinned:         z.boolean().nullable().optional(),
  locationName:     z.string().nullable().optional(),
  musicInfo:        MusicInfoSchema,
  latestComments:   z.array(CommentSchema).optional().default([]),
  taggedUsers:      z.array(TaggedUserSchema.unwrap()).optional().default([]),
  coauthorProducers: z.array(z.object({
    id:       z.string(),
    username: z.string(),
  })).optional().default([]),
})

type PostRaw = z.infer<typeof PostRawSchema>

// ─── Classificação de comentários (regex) ──────────────────────────────────

const RE_COMPRA = [
  /envi[ao]/i, /frete/i, /entrega/i, /quanto custa/i,
  /como comprar/i, /como pedir/i, /aceita encomenda/i,
  /onde comprar/i, /tem disponível/i, /vende/i, /manda o link/i,
]

const RE_PRODUTO = [
  /workshop/i, /curso/i, /aula/i, /quero participar/i,
  /quando.*próximo/i, /tem vagas/i, /^QUERO$/i,
  /mais informações/i, /como funciona/i, /como faço/i,
]

function classificarComentarios(comments: PostRaw['latestComments']) {
  let compra = 0, produto = 0, emocional = 0
  for (const c of (comments ?? [])) {
    if (RE_COMPRA.some(r => r.test(c.text)))   compra++
    else if (RE_PRODUTO.some(r => r.test(c.text))) produto++
    else emocional++
  }
  return { intencao_compra: compra, intencao_produto: produto, emocional }
}

// ─── Detecção de tipo narrativo ────────────────────────────────────────────

function tipoNarrativo(caption: string, hashtags: string[]): string {
  const c = caption.toLowerCase()
  if (/workshop|curso|aula|aprenda|tutorial/.test(c))          return 'tutorial_educativo'
  if (/buquê|flores|arranjo|presente|encomenda/.test(c))       return 'produto_servico'
  if (/parabéns|aniversário|celebr/.test(c))                   return 'marco_pessoal'
  if (/link na bio|compre agora|acesse|clique/i.test(c))       return 'cta_venda_direta'
  if (/você já|já percebeu|e se|e você|como você/i.test(c))    return 'conteudo_reflexivo'
  if (hashtags.includes('tbt') || /\btbt\b/i.test(c))         return 'nostalgia_lifestyle'
  if (/galaxy|buds|produto|venda|mercado livre/i.test(c))      return 'produto_patrocinado'
  return 'outros'
}

// ✅ CORREÇÃO 2: Extração de Username da Pasta ─────────────────────────────

function extrairUsernameFromPath(filePath: string): string | null {
  // Padrão: .../instagram-{USERNAME}-{DATA}-{HASH}/...
  // Exemplo: instagram-cpimportstore-2026-06-06-2N48sy0B/
  const match = filePath.match(/instagram-([^-/\\]+)-\d{4}-\d{2}-\d{2}/)
  return match ? match[1] : null
}

// ─── Transform raw → row de banco ──────────────────────────────────────────

function transformPost(raw: PostRaw) {
  const likes = raw.likesCount === -1 ? null : raw.likesCount

  const playRate =
    raw.videoPlayCount && raw.videoViewCount && raw.videoPlayCount > 0
      ? parseFloat((raw.videoViewCount / raw.videoPlayCount).toFixed(4))
      : null

  const isCoautoria =
    (raw.coauthorProducers?.length ?? 0) > 0 ||
    raw.taggedUsers?.some(u => u.username !== raw.ownerUsername) === true

  return {
    post_external_id:      raw.id,
    owner_username:        raw.ownerUsername ?? 'unknown',
    product_type:          raw.type,
    product_type_detail:   raw.productType ?? null,
    posted_at:             raw.timestamp,
    caption_text:          raw.caption ?? '',
    hashtags:              raw.hashtags ?? [],
    is_pinned:             raw.isPinned ?? false,
    location_name:         raw.locationName ?? null,
    uses_original_audio:   raw.musicInfo?.uses_original_audio ?? null,
    audio_name:            raw.musicInfo?.song_name ?? null,
    is_coautoria:          isCoautoria,
    tipo_narrativa:        tipoNarrativo(raw.caption ?? '', raw.hashtags ?? []),
    likes_count:           likes,
    comments_count:        raw.commentsCount,
    video_play_count:      raw.videoPlayCount ?? null,
    video_view_count:      raw.videoViewCount ?? null,
    video_duration_s:      raw.videoDuration ?? null,
    play_rate:             playRate,
    comment_signals:       classificarComentarios(raw.latestComments),
    tagged_users:          raw.taggedUsers ?? [],
  }
}

// ─── Ingestão: modo OPERATIONAL → kpi_raw_ingestion ───────────────────────

async function ingestOperational(
  raw: PostRaw,
): Promise<'ok' | 'skip' | 'error'> {
  const clientUuid = CLIENT_UUID_MAP[raw.ownerUsername ?? 'unknown']
  if (!clientUuid) {
    console.warn(`⚠️  [operational] Username "${raw.ownerUsername}" não mapeado para UUID.`)
    console.warn(`   Cadastre em CLIENT_UUID_MAP no script.`)
    return 'skip'
  }

  const base = transformPost(raw)
  const today = new Date().toISOString().split('T')[0]

  // Verificar idempotência
  const { data: existing } = await supabase
    .from('kpi_raw_ingestion')
    .select('id')
    .eq('client_id', clientUuid)
    .eq('agency_id', AGENCY_UUID)
    .contains('raw_payload', { id: raw.id })
    .maybeSingle()

  if (existing) {
    console.log(`⏭  [operational] Post ${raw.id} já existe.`)
    return 'skip'
  }

  const { error } = await supabase
    .from('kpi_raw_ingestion')
    .insert({
      client_id:        clientUuid,
      agency_id:        AGENCY_UUID,
      source:           'instagram_graph_api',
      api_version:      'v19.0',
      endpoint:         '/media/insights',
      period_start:     today,
      period_end:       today,
      ingestion_status: 'pending',
      schema_version:   1,
      product_type:     base.product_type_detail,
      uses_original_audio: base.uses_original_audio,
      video_duration_s: base.video_duration_s,
      raw_payload: {
        post_external_id:   base.post_external_id,
        owner_username:     base.owner_username,
        product_type:       base.product_type,
        posted_at:          base.posted_at,
        likes_count:        base.likes_count,
        comments_count:     base.comments_count,
        video_play_count:   base.video_play_count,
        video_view_count:   base.video_view_count,
        play_rate:          base.play_rate,
        is_pinned:          base.is_pinned,
        is_coautoria:       base.is_coautoria,
        tipo_narrativa:     base.tipo_narrativa,
        audio_name:         base.audio_name,
        location_name:      base.location_name,
        comment_signals:    base.comment_signals,
        hashtags:           base.hashtags,
        caption_preview:    (base.caption_text ?? '').slice(0, 200),
      },
    })

  if (error) {
    console.error(`❌ [operational] ${raw.id}:`, error.message)
    return 'error'
  }

  console.log(`✅ [operational] Post ${raw.id} (${raw.ownerUsername}) → kpi_raw_ingestion`)
  return 'ok'
}

// ─── Ingestão: modo LEAD → lead_raw_ingestion ──────────────────────────────

async function ingestLead(
  raw: PostRaw,
): Promise<'ok' | 'skip' | 'error'> {
  const base = transformPost(raw)

  const { error } = await supabase
    .from('lead_raw_ingestion')
    .upsert(
      {
        ...base,
        agency_id:      AGENCY_UUID,
        client_id:      raw.ownerUsername ?? 'unknown',
        ingestion_mode: 'lead',
      },
      {
        onConflict:       'post_external_id,client_id',
        ignoreDuplicates: false,
      }
    )

  if (error) {
    if (error.message.includes('duplicate key')) {
      console.log(`⏭  [lead] Post ${raw.id} já existe.`)
      return 'skip'
    }
    console.error(`❌ [lead] ${raw.id}:`, error.message)
    return 'error'
  }

  console.log(`✅ [lead] Post ${raw.id} (${raw.ownerUsername}) → lead_raw_ingestion`)
  return 'ok'
}

// ─── Descoberta de arquivos JSON (recursivo) ───────────────────────────────

function descobrirJsons(dir: string, maxDepth = 3, currentDepth = 0): string[] {
  const arquivos: string[] = []

  if (currentDepth >= maxDepth) return arquivos

  try {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isFile() && item.endsWith('.json')) {
        arquivos.push(fullPath)
      } else if (stat.isDirectory() && !item.startsWith('.')) {
        arquivos.push(...descobrirJsons(fullPath, maxDepth, currentDepth + 1))
      }
    }
  } catch (err) {
    console.warn(`⚠️  Erro ao ler diretório ${dir}:`, err instanceof Error ? err.message : err)
  }

  return arquivos
}

// ─── Pipeline principal ────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`\n🚀 ORBIT L0 Ingestão — v2.2.0`)
  console.log(`📋 Modo: ${MODE.toUpperCase()}`)
  console.log(`📂 Pasta: ${PASTA_LOCAL}\n`)

  if (!fs.existsSync(PASTA_LOCAL)) {
    console.error(`❌ Pasta não encontrada: ${PASTA_LOCAL}`)
    console.error(`\n📝 Crie a pasta ou ajuste em .env.local:`)
    console.error(`   PASTA_${MODE.toUpperCase()}=${PASTA_LOCAL}`)
    process.exit(1)
  }

  // Descobrir JSONs recursivamente
  const arquivos = descobrirJsons(PASTA_LOCAL)
  console.log(`📦 ${arquivos.length} arquivo(s) JSON encontrado(s)\n`)

  if (arquivos.length === 0) {
    console.warn(`⚠️  Nenhum arquivo JSON encontrado em ${PASTA_LOCAL}`)
    console.warn(`   Procurando em subpastas até 3 níveis de profundidade...`)
    return
  }

  const results = { ok: 0, skip: 0, error: 0 }

  for (const filePath of arquivos) {
    const arquivo = path.relative(PASTA_LOCAL, filePath)
    
    // ✅ CORREÇÃO 2: Extrair username da pasta
    const usernameFromPath = extrairUsernameFromPath(filePath)

    let rawJson: unknown
    try {
      rawJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ Falha ao ler JSON [${arquivo}]:`, msg)
      results.error++
      continue
    }

    // Suporta array ou objeto único
    const posts = Array.isArray(rawJson) ? rawJson : [rawJson]

    for (const item of posts) {
      const parsed = PostRawSchema.safeParse(item)

      if (!parsed.success) {
        console.warn(`⚠️  Validação falhou [${arquivo}]:`,
          parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
        )
        results.error++
        continue
      }

      // ✅ CORREÇÃO 2: Injetar username extraído da pasta (fallback)
      const enrichedData: PostRaw = {
        ...parsed.data,
        ownerUsername: parsed.data.ownerUsername || usernameFromPath || 'unknown',
      }

      const status = MODE === 'operational'
        ? await ingestOperational(enrichedData)
        : await ingestLead(enrichedData)

      results[status]++
    }
  }

  console.log(`\n🏁 Concluído`)
  console.log(`   ✅ ok:    ${results.ok}`)
  console.log(`   ⏭  skip:  ${results.skip}`)
  console.log(`   ❌ error: ${results.error}`)
}

run().catch(err => {
  console.error('❌ Erro fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
