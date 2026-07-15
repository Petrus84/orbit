// ============================================================================
// ARQUIVO: ingest-l0-v2.ts (v5.3.0 — SSOT DE ENCODING VIA DICIONÁRIO)
// ============================================================================
// ✅ CORREÇÕES v5.3.0:
// - Remove getMetricValue() com chaves hardcoded (que tinham fallback pra
//   NENHUMA métrica além de REACH, e ainda assim só a variante mojibake).
//   Passa a consumir lib/metric-key-dictionary.ts — mesma fonte usada por
//   ingest-insights.ts e extract-demographics.ts.
// - "Miniatura de mídia" e o label "Mídia" também passam a ser resolvidos
//   via dicionário, em vez de string literal + heurística local.
// ============================================================================

import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { resolveManifest } from './lib/instagram-export-manifest.ts'
import { resolveClientId } from './lib/resolveClientId.ts'
import {
  resolveIntMetricOrNull,
  resolveMapEntry,
  variantsFor,
  logMissingKey,
} from './lib/metric-key-dictionary.ts'

dotenv.config({ path: '.env.local' })

type OperationMode = 'operational' | 'lead'
const VALID_MODES: readonly OperationMode[] = ['operational', 'lead']

function parseMode(): OperationMode {
  let detectedMode: string | undefined
  for (const arg of process.argv) {
    if (arg.startsWith('--mode=')) {
      detectedMode = arg.split('=')[1]
    }
  }
  if (!detectedMode) {
    const idx = process.argv.indexOf('--mode')
    if (idx >= 0 && process.argv[idx + 1]) {
      detectedMode = process.argv[idx + 1]
    }
  }
  const finalMode = detectedMode || 'operational'
  if (!VALID_MODES.includes(finalMode as OperationMode)) {
    console.error(`ERRO: --mode invalido: "${finalMode}". Use "operational" ou "lead"`)
    process.exit(1)
  }
  return finalMode as OperationMode
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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERRO: Configuracoes do Supabase ausentes no .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

const ScraperPostSchema = z.object({
  id: z.string(),
  type: z.enum(['Video', 'Image', 'Sidecar']),
  timestamp: z.string(),
  caption: z.string().optional().default(''),
  likesCount: z.number().int().nonnegative().optional().default(0),
  commentsCount: z.number().int().nonnegative().optional().default(0),
  videoViewCount: z.number().int().nonnegative().optional().default(100),
  videoPlayCount: z.number().int().nonnegative().optional().default(0),
  ownerFullName: z.string().optional(),
  url: z.string().optional()
})

type ScraperPost = z.infer<typeof ScraperPostSchema>

const MetaMediaItemSchema = z.object({
  uri: z.string().optional().default(''),
  creation_timestamp: z.number().optional(),
  title: z.string().optional().default('')
})

const MetaLabelValueSchema = z.object({
  label: z.string().optional(),
  title: z.string().optional(),
  value: z.string().optional(),
  media: z.array(MetaMediaItemSchema).optional().default([])
})

const MetaNativePostSchema = z.object({
  timestamp: z.number().optional(),
  media: z.array(MetaMediaItemSchema).optional().default([]),
  label_values: z.array(MetaLabelValueSchema).optional().default([])
})

type MetaNativePost = z.infer<typeof MetaNativePostSchema>

interface TransformedPost {
  ig_post_uri: string
  published_at: string
  content_format: 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv'
  caption: string
}

function decodeMetaUnicode(str: string): string {
  try {
    return decodeURIComponent(JSON.parse(`"${str.replace(/"/g, '\\"')}"`))
  } catch {
    return str
  }
}

function resolveTimestamp(raw: MetaNativePost): number | null {
  if (typeof raw.timestamp === 'number') return raw.timestamp

  for (const m of raw.media) {
    if (typeof m.creation_timestamp === 'number') return m.creation_timestamp
  }
  for (const lv of raw.label_values) {
    for (const m of lv.media) {
      if (typeof m.creation_timestamp === 'number') return m.creation_timestamp
    }
  }
  return null
}

function transformPost(raw: MetaNativePost): TransformedPost | null {
  // ✅ v5.3.0: variantes do label "Mídia" vêm do dicionário compartilhado,
  // em vez de string literal hardcoded + heurística local ad-hoc.
  const midiaLabelVariants = variantsFor('MEDIA_LABEL')
  const midiaContainer = raw.label_values.find(
    (l) => l.label && midiaLabelVariants.some(v => l.label!.toLowerCase().includes(v.toLowerCase()))
  )
  const actualMediaArray = midiaContainer?.media ?? raw.media
  if (actualMediaArray.length === 0) return null

  const actualMedia = actualMediaArray[0]
  const mediaCount = actualMediaArray.length
  const uriPost = actualMedia?.uri ?? ''
  if (!uriPost) return null

  const timestamp = resolveTimestamp(raw)
  if (timestamp === null) return null

  const captionRaw = actualMedia?.title ?? ''
  const captionText = decodeMetaUnicode(captionRaw)

  let format: 'reel' | 'static_post' | 'carousel' | 'story' | 'live' | 'igtv' = 'static_post'
  const uriLower = uriPost.toLowerCase()

  if (mediaCount > 1) {
    format = 'carousel'
  } else if (uriLower.endsWith('.mp4') || uriLower.endsWith('.mov')) {
    format = 'reel'
  }

  return {
    ig_post_uri: uriPost,
    published_at: new Date(timestamp * 1000).toISOString(),
    content_format: format,
    caption: captionText
  }
}

interface ProcessResults {
  ok: number
  skip: number
  error: number
}

async function postAlreadyExists(clientId: string, igPostUri: string): Promise<boolean> {
  if (!clientId) return false
  const { data, error } = await supabase
    .schema('orbit')
    .from('ig_posts')
    .select('id')
    .eq('client_id', clientId)
    .eq('ig_post_uri', igPostUri)
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}

// ✅ FUNÇÃO AUXILIAR PARA EXTRAIR ID NUMÉRICO
function extractNumericId(uriOrPath: string): string | null {
  const match = uriOrPath.match(/(\d+)\.\w+$/)
  return match ? match[1] : null
}

// 1. Definição do Schema Estrito para o arquivo de Insights com Zod
// ✅ v5.3.0: media_map_data passa a ser um record livre (em vez de exigir a
// chave literal mojibake "Miniatura de m\u00c3\u00addia"), permitindo que a
// variante correta seja resolvida via dicionário logo abaixo.
const OrganicInsightPostSchema = z.object({
  media_map_data: z.record(
    z.string(),
    z.object({
      uri: z.string().optional().default(''),
      creation_timestamp: z.number().optional()
    })
  ).optional().default({}),
  string_map_data: z.record(
    z.string(),
    z.object({
      value: z.string().optional()
    })
  ).optional().default({})
})

const InstagramInsightsFileSchema = z.object({
  organic_insights_posts: z.array(OrganicInsightPostSchema)
})

type InstagramInsightsFile = z.infer<typeof InstagramInsightsFileSchema>

// 2. A função processPostsFile com tipagem estrita e zero "any"
async function processPostsFile(
  filePath: string,
  clientUuid: string,
  ownerUsername: string
): Promise<ProcessResults> {
  const results: ProcessResults = { ok: 0, skip: 0, error: 0 }
  let firstFailureLogged = false
  const fileName = path.basename(filePath)

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const parsedData: unknown = JSON.parse(rawContent)

    /* ── FLUXO B: PROCESSAMENTO DE INSIGHTS (UPDATE) ──────────────────────── */
    if (fileName === 'posts_insights.json') {
      if (MODE !== 'operational') return results

      // Validação estrutural em tempo de execução via Zod (Garante tipo seguro)
      const insightsParsed = InstagramInsightsFileSchema.safeParse(parsedData)

      if (!insightsParsed.success) {
        console.error(`❌ Falha na validação estrutural do posts_insights.json: ${insightsParsed.error.message}`)
        results.error += 1
        return results
      }

      // Variável agora possui tipagem estrita: InstagramInsightsFile
      const insightsData: InstagramInsightsFile = insightsParsed.data

      for (const item of insightsData.organic_insights_posts) {
        try {
          // ✅ v5.3.0: resolução via dicionário compartilhado — aceita a
          // chave em UTF-8 correto ou mojibake, sem exigir a variante certa
          // no schema Zod.
          const miniatura = resolveMapEntry(item.media_map_data, 'MEDIA_THUMBNAIL')
          if (!miniatura?.uri) {
            results.skip += 1
            continue
          }

          const numericId = extractNumericId(miniatura.uri)

          if (!numericId) {
            results.skip += 1
            continue
          }

          const stringMap = item.string_map_data

          // ✅ v5.3.0: todas as métricas resolvidas via dicionário compartilhado.
          // Antes, só REACH tinha fallback (e apenas a variante mojibake); as
          // demais liam uma única chave literal em inglês/PT sem cascata —
          // qualquer variante diferente da esperada resultava em null
          // silencioso. Agora todas seguem o mesmo cascade UTF-8 → mojibake →
          // inglês do restante do pipeline.
          const metrics = {
            reach: resolveIntMetricOrNull(stringMap, 'REACH', logMissingKey),
            shares: resolveIntMetricOrNull(stringMap, 'SHARES', logMissingKey),
            saves: resolveIntMetricOrNull(stringMap, 'SAVES', logMissingKey),
            impressions: resolveIntMetricOrNull(stringMap, 'IMPRESSIONS', logMissingKey),
            likes: resolveIntMetricOrNull(stringMap, 'LIKES', logMissingKey),
            comments: resolveIntMetricOrNull(stringMap, 'COMMENTS', logMissingKey),
            profile_visits_from: resolveIntMetricOrNull(stringMap, 'PROFILE_VISITS_FROM', logMissingKey),
            follows_from: resolveIntMetricOrNull(stringMap, 'FOLLOWS_FROM_INTERACTION', logMissingKey)
          }

          if (
            metrics.reach === null &&
            metrics.shares === null &&
            metrics.saves === null &&
            metrics.impressions === null
          ) {
            results.skip += 1
            continue
          }

          // ✅ UPDATE usando LIKE com numericId em vez de published_at
          const { error: updateError, data: updateData } = await supabase
            .schema('orbit')
            .from('ig_posts')
            .update({
              reach: metrics.reach,
              shares: metrics.shares,
              saves: metrics.saves,
              impressions: metrics.impressions,
              likes: metrics.likes,
              comments: metrics.comments,
              profile_visits_from: metrics.profile_visits_from,
              follows_from: metrics.follows_from
            })
            .eq('client_id', clientUuid)
            .like('ig_post_uri', `%${numericId}%`)
            .select('id')

          if (updateError) {
            console.error(`   Erro ao atualizar insights do id ${numericId}: ${updateError.message}`)
            results.error += 1
          } else if (updateData && updateData.length > 0) {
            results.ok += 1
          } else {
            console.warn(`   Nenhuma linha casou para id ${numericId} — post ausente ou não ingerido ainda`)
            results.skip += 1
          }
        } catch (err) {
          console.error(`   Erro ao processar item de insights: ${err instanceof Error ? err.message : String(err)}`)
          results.error += 1
        }
      }
      return results
    }

    /* ── FLUXO A: PROCESSAMENTO DE MÍDIA ORIGINAL (INSERT) ────────────────── */
    if (!Array.isArray(parsedData)) {
      results.error += 1
      return results
    }

    for (const item of parsedData) {
      if (typeof item !== 'object' || item === null) {
        results.error += 1
        continue
      }

      const recordItem = item as Record<string, unknown>
      let validatedMeta: MetaNativePost | null = null
      let validatedScraper: ScraperPost | null = null

      const metaParsed = MetaNativePostSchema.safeParse(recordItem)
      if (metaParsed.success) {
        validatedMeta = metaParsed.data
      } else {
        const scraperParsed = ScraperPostSchema.safeParse(recordItem)
        if (scraperParsed.success) {
          validatedScraper = scraperParsed.data
        }
      }

      if (!validatedMeta && !validatedScraper) {
        if (!firstFailureLogged) {
          firstFailureLogged = true
          console.error(`   Validacao Zod falhou. Chaves detectadas: ${Object.keys(recordItem).join(', ')}`)
        }
        results.error += 1
        continue
      }

      if (MODE === 'lead' && validatedScraper) {
        const likes = typeof recordItem.likesCount === 'number' ? recordItem.likesCount : 0
        const comments = typeof recordItem.commentsCount === 'number' ? recordItem.commentsCount : 0

        let views = typeof recordItem.videoViewCount === 'number' ? recordItem.videoViewCount : 0
        if (views === 0 && typeof recordItem.videoPlayCount === 'number') {
          views = recordItem.videoPlayCount
        }
        if (views === 0) views = 100

        const rawCtr = (likes / views) * 100
        const rawEngagement = ((likes + comments) / views) * 100

        const calculatedCtr = rawCtr > 100 ? 100 : rawCtr
        const engagementRate = rawEngagement > 100 ? 100 : rawEngagement

        const { error: leadError } = await supabase
          .from('leads_prospects')
          .upsert({
            handle: ownerUsername,
            name: validatedScraper.ownerFullName || ownerUsername,
            ctr: Number(calculatedCtr.toFixed(2)),
            frequency: typeof recordItem.videoPlayCount === 'number' ? recordItem.videoPlayCount : 0,
            engagement_rate: Number(engagementRate.toFixed(2)),
            diagnosis: validatedScraper.caption ? validatedScraper.caption.slice(0, 500) : null,
            action_required: validatedScraper.url || null,
            status: 'PROSPECT',
            updated_at: new Date().toISOString()
          }, { onConflict: 'handle' })

        if (leadError) {
          console.error(`   Erro no upsert de leads_prospects: ${leadError.message}`)
          results.error += 1
        } else {
          results.ok += 1
        }
        continue
      }

      if (MODE === 'operational' && validatedMeta) {
        const transformed = transformPost(validatedMeta)
        if (!transformed) {
          results.skip += 1
          continue
        }

        if (await postAlreadyExists(clientUuid, transformed.ig_post_uri)) {
          results.skip += 1
          continue
        }

        const { error: insertError } = await supabase
          .schema('orbit')
          .from('ig_posts')
          .insert({
            client_id: clientUuid,
            ig_post_uri: transformed.ig_post_uri,
            published_at: transformed.published_at,
            content_format: transformed.content_format,
            caption: transformed.caption,
            reach: null,
            impressions: null,
            likes: null,
            comments: null,
            shares: null,
            saves: null,
            confidence_level: 'L0'
          })

        if (insertError) {
          console.error(`   Erro ao inserir em orbit.ig_posts: ${insertError.message}`)
          results.error += 1
        } else {
          results.ok += 1
        }
      }
    }
  } catch (err) {
    console.error(`Erro ao processar arquivo ${fileName}: ${err instanceof Error ? err.message : String(err)}`)
    results.error += 1
  }

  return results
}

async function processClientFolder(folderPath: string): Promise<void> {
  const usernameFromPath = path.basename(folderPath)
  console.log(`\n- Handle detectado na pasta: ${usernameFromPath}`)

  let clientUuid = ''

  if (MODE === 'operational') {
    try {
      clientUuid = await resolveClientId(supabase, usernameFromPath)
      console.log(`UUID canonico seguro resolvido: ${clientUuid}`)
    } catch (err) {
      console.warn(`[Pular] ${err instanceof Error ? err.message : String(err)}`)
      return
    }
  }

  const manifestResult = resolveManifest(folderPath, 'ingest-l0-v2')
  let arquivosParaProcessar = manifestResult?.found ?? []

  if (arquivosParaProcessar.length === 0 && fs.existsSync(folderPath)) {
    arquivosParaProcessar = fs.readdirSync(folderPath).filter(file => file.endsWith('.json'))
  }

  console.log(`Selecionado(s) ${arquivosParaProcessar.length} arquivo(s) para analise`)

  const globalResults = { ok: 0, skip: 0, error: 0 }

  for (const fileName of arquivosParaProcessar) {
    const filePath = path.join(folderPath, fileName)
    const fileResults = await processPostsFile(filePath, clientUuid, usernameFromPath)
    globalResults.ok += fileResults.ok
    globalResults.skip += fileResults.skip
    globalResults.error += fileResults.error
  }

  console.log(`Balanco final [${usernameFromPath}]: ok: ${globalResults.ok} | skip: ${globalResults.skip} | error: ${globalResults.error}`)
}

async function run(): Promise<void> {
  console.log('====================================================')
  console.log('       ORBIT L0 Ingestao Hibrida - v5.3.0           ')
  console.log(`       Modo: ${MODE.toUpperCase()}                 `)
  console.log(`       Pasta Origem: ${PASTA_LOCAL}                `)
  console.log('====================================================')

  if (!fs.existsSync(PASTA_LOCAL)) {
    console.error(`ERRO: Diretorio de origem inexistente: ${PASTA_LOCAL}`)
    process.exit(1)
  }

  const folders = fs
    .readdirSync(PASTA_LOCAL)
    .filter((f) => fs.statSync(path.join(PASTA_LOCAL, f)).isDirectory())

  if (folders.length === 0) {
    await processClientFolder(PASTA_LOCAL)
    return
  }

  for (const folder of folders) {
    await processClientFolder(path.join(PASTA_LOCAL, folder))
  }
}

run().catch((err: unknown) => {
  console.error('Parada critica fatal na execucao:', err)
  process.exit(1)
})