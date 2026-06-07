/* ==========================================================================
   ORBIT · Script de Ingestão L0 — v2
   Arquivo: scripts/script-ingest-l0-v2.ts

   MODOS:
     --mode operational  →  kpi_raw_ingestion  (cliente real, client_id = UUID)
     --mode lead         →  lead_raw_ingestion (prospecção, client_id = username)

   USO:
     npx ts-node scripts/script-ingest-l0-v2.ts --mode operational
     npx ts-node scripts/script-ingest-l0-v2.ts --mode lead

   DIFERENÇAS DO SCRIPT ANTERIOR:
     1. Extrai campos individuais do JSON (não joga tudo em raw_payload)
     2. Separa rota de destino por mode (tabela diferente)
     3. Idempotência real via post_external_id + client_id
     4. likesCount=-1 mapeado para NULL (likes ocultos do IG)
     5. Classificação de intenção nos comentários via regex
     6. Detecção de tipo narrativo via caption
     7. Play rate calculada no script (não na view)
   ========================================================================== */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import 'dotenv/config'

// ─── Configuração ──────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role: bypass de RLS no script
)

// Argumentos de linha de comando
const MODE = (process.argv.find(a => a.startsWith('--mode='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--mode') + 1]
  ?? 'operational') as 'operational' | 'lead'

if (!['operational', 'lead'].includes(MODE)) {
  console.error('❌ --mode deve ser "operational" ou "lead"')
  process.exit(1)
}

// Pastas separadas por modo
const PASTAS: Record<'operational' | 'lead', string> = {
  operational: process.env.PASTA_OPERATIONAL ?? 'C:\\Users\\DELL\\Downloads\\Alpha\\clientes',
  lead:        process.env.PASTA_LEAD        ?? 'C:\\Users\\DELL\\Downloads\\Alpha\\leads',
}
const PASTA_LOCAL = PASTAS[MODE]

// IDs operacionais (só usados no modo operational)
// No modo lead, client_id = ownerUsername (string)
const AGENCY_UUID = process.env.AGENCY_ID ?? '11111111-1111-1111-1111-111111111111'

// Mapa de username → UUID de cliente cadastrado no banco
// Expandir conforme novos clientes forem adicionados
const CLIENT_UUID_MAP: Record<string, string> = {
  'cpimportstore':  '22222222-2222-2222-2222-222222222222',
  'fiorefernando__': '33333333-3333-3333-3333-333333333333', // ajustar quando cadastrar
}

// ─── Schema Zod — validação do JSON bruto do Apify/Scraper ────────────────

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
  username: z.string(),
  id:       z.string(),
  full_name: z.string().nullable().optional(),
}).optional()

const PostRawSchema = z.object({
  id:               z.string(),
  ownerUsername:    z.string(),
  ownerFullName:    z.string().optional(),
  type:             z.enum(['Video', 'Image', 'Sidecar']),
  timestamp:        z.string().datetime({ offset: true }),
  caption:          z.string().optional().default(''),
  hashtags:         z.array(z.string()).optional().default([]),

  // Métricas — likesCount=-1 significa likes ocultos
  likesCount:       z.number(),
  commentsCount:    z.number().default(0),
  videoPlayCount:   z.number().nullable().optional(),
  videoViewCount:   z.number().nullable().optional(),
  videoDuration:    z.number().nullable().optional(),

  // Enriquecimento de conteúdo
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

// ─── Classificação de comentários por intenção (regex, zero ML) ───────────

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

// ─── Detecção de tipo narrativo via caption ───────────────────────────────

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

// ─── Transform raw → row de banco ────────────────────────────────────────

function transformPost(raw: PostRaw) {
  // likesCount=-1 = likes ocultos pelo Instagram → NULL (nunca 0)
  const likes = raw.likesCount === -1 ? null : raw.likesCount

  // Play rate: só calcula se ambos os campos existem e playCount > 0
  const playRate =
    raw.videoPlayCount && raw.videoViewCount && raw.videoPlayCount > 0
      ? parseFloat((raw.videoViewCount / raw.videoPlayCount).toFixed(4))
      : null

  // Detectar co-autoria patrocinada
  const isCoautoria =
    (raw.coauthorProducers?.length ?? 0) > 0 ||
    raw.taggedUsers?.some(u => u.username !== raw.ownerUsername) === true

  return {
    post_external_id:      raw.id,
    owner_username:        raw.ownerUsername,
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

// ─── Ingestão: modo OPERATIONAL → kpi_raw_ingestion ──────────────────────
//
// ATENÇÃO: kpi_raw_ingestion.client_id é UUID (FK para clients)
// O JSON do scraper tem ownerUsername (string).
// A resolução username → UUID é feita via CLIENT_UUID_MAP acima.
// Se o username não estiver no mapa, o arquivo é ignorado com aviso.

async function ingestOperational(
  raw: PostRaw,
  sourceFile: string,
): Promise<'ok' | 'skip' | 'error'> {
  const clientUuid = CLIENT_UUID_MAP[raw.ownerUsername]
  if (!clientUuid) {
    console.warn(`⚠️  [operational] Username "${raw.ownerUsername}" não mapeado para UUID. Cadastre em CLIENT_UUID_MAP.`)
    return 'skip'
  }

  const base = transformPost(raw)
  const today = new Date().toISOString().split('T')[0]

  // Verificar idempotência manualmente (kpi_raw_ingestion não tem UNIQUE por post_external_id)
  // Usamos raw_payload->>'id' para checagem
  const { data: existing } = await supabase
    .from('kpi_raw_ingestion')
    .select('id')
    .eq('client_id', clientUuid)
    .eq('agency_id', AGENCY_UUID)
    .contains('raw_payload', { id: raw.id })
    .maybeSingle()

  if (existing) {
    console.log(`⏭  [operational] Post ${raw.id} já existe. Ignorando.`)
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
      // Campos extraídos diretamente (novos no schema)
      product_type:     base.product_type_detail,
      uses_original_audio: base.uses_original_audio,
      video_duration_s: base.video_duration_s,
      // Payload completo preservado para auditoria
      raw_payload: {
        // Campos derivados para facilitar queries futuras
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

// ─── Ingestão: modo LEAD → lead_raw_ingestion ─────────────────────────────
//
// lead_raw_ingestion.client_id é TEXT (username diretamente, sem FK)
// lead_raw_ingestion.agency_id é TEXT (sem FK também)
// Upsert idempotente via UNIQUE(post_external_id, client_id)

async function ingestLead(
  raw: PostRaw,
  sourceFile: string,
): Promise<'ok' | 'skip' | 'error'> {
  const base = transformPost(raw)

  const { error } = await supabase
    .from('lead_raw_ingestion')
    .upsert(
      {
        ...base,
        agency_id:      AGENCY_UUID,
        client_id:      raw.ownerUsername, // TEXT direto — sem FK
        ingestion_mode: 'lead',
        source_file:    sourceFile,
      },
      {
        onConflict:       'post_external_id,client_id',
        ignoreDuplicates: false, // atualiza se reingere
      }
    )

  if (error) {
    // Supabase pode retornar erro se UNIQUE constraint não existir ainda
    if (error.message.includes('duplicate key')) {
      console.log(`⏭  [lead] Post ${raw.id} já existe. Ignorando.`)
      return 'skip'
    }
    console.error(`❌ [lead] ${raw.id}:`, error.message)
    return 'error'
  }

  console.log(`✅ [lead] Post ${raw.id} (${raw.ownerUsername}) → lead_raw_ingestion`)
  return 'ok'
}

// ─── Pipeline principal ────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`\n🚀 ORBIT L0 Ingestão — modo: ${MODE.toUpperCase()}`)
  console.log(`📂 Pasta: ${PASTA_LOCAL}\n`)

  if (!fs.existsSync(PASTA_LOCAL)) {
    console.error(`❌ Pasta não encontrada: ${PASTA_LOCAL}`)
    console.error(`   Crie a pasta ou ajuste a variável PASTA_${MODE.toUpperCase()} no .env.local`)
    process.exit(1)
  }

  const arquivos = fs.readdirSync(PASTA_LOCAL).filter(f => f.endsWith('.json'))
  console.log(`📦 ${arquivos.length} arquivo(s) JSON encontrado(s)\n`)

  const results = { ok: 0, skip: 0, error: 0 }

  for (const arquivo of arquivos) {
    const filePath = path.join(PASTA_LOCAL, arquivo)

    let rawJson: unknown
    try {
      rawJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ Falha ao ler JSON [${arquivo}]:`, msg)
      results.error++
      continue
    }

    // O Apify exporta um array de posts por arquivo
    const posts = Array.isArray(rawJson) ? rawJson : [rawJson]

    for (const item of posts) {
      const parsed = PostRawSchema.safeParse(item)

      if (!parsed.success) {
        console.warn(`⚠️  Validação Zod falhou [${arquivo}]:`,
          parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(' | ')
        )
        results.error++
        continue
      }

      const status = MODE === 'operational'
        ? await ingestOperational(parsed.data, arquivo)
        : await ingestLead(parsed.data, arquivo)

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
