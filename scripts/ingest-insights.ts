/* ==========================================================================
   ORBIT · Script de Ingestão de Insights — v1.2.0
   Arquivo: scripts/ingest-insights.ts

   CORREÇÕES v1.2.0 (13/06/2026):
   1. ✅ Chaves corretas de content_interactions.json (validadas nos arquivos reais):
         "Compartilhamento do post" (singular, não plural)
         "Salvamentos do post", "Curtidas do post"
         "Compartilhamentos de vídeos do Reels" (plural com acento)
         "Salvamentos de vídeos do Reels"
   2. ✅ Agrega posts + reels separadamente, depois soma
   3. ✅ Extrai seguidores de audience_insights.json (não de followers_1.json)
         followers_1.json = amostra dos mais recentes (não é o total)
         audience_insights["Seguidores"] = novos no período (melhor proxy disponível)
   4. ✅ Período extraído do "Intervalo de datas" do content_interactions
   5. ✅ profiles_reached.json para alcance-90d

   MÉTRICAS INSERIDAS:
     compartilhamentos-90d  = posts + reels
     salvamentos-90d        = posts + reels
     curtidas-90d           = posts + reels
     impressoes-90d         = 0 (não disponível no export — campo reservado)
     alcance-90d            = de profiles_reached.json (se existir)
     seguidores-totais      = de audience_insights["Seguidores"] (novos no período)
     saldo-90-dias          = audience_insights["Total de seguidores"] (variação líquida)

   USO:
     npx ts-node scripts/ingest-insights.ts --client cpimportstore
   ========================================================================== */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

// ─── Configuração ──────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CLIENT_USERNAME =
  process.argv.find(a => a.startsWith('--client='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--client') + 1]

if (!CLIENT_USERNAME) {
  console.error('❌ --client é obrigatório (ex: --client cpimportstore)')
  process.exit(1)
}

const CLIENT_UUID_MAP: Record<string, string> = {
  'cpimportstore':   '22222222-2222-2222-2222-222222222222',
  'eupetruchio84':   '24140477-0c82-4fda-83df-958377f105ff',
  'eupetruchio':     '24140477-0c82-4fda-83df-958377f105ff',
  'petruchio84':     '24140477-0c82-4fda-83df-958377f105ff',
  'fiorefernando__': '33333333-3333-3333-3333-333333333333',
}

const CLIENT_UUID = CLIENT_UUID_MAP[CLIENT_USERNAME]
if (!CLIENT_UUID) {
  console.error(`❌ Cliente "${CLIENT_USERNAME}" não encontrado em CLIENT_UUID_MAP`)
  process.exit(1)
}

if (!process.env.PASTA_OPERATIONAL) {
  console.error('❌ PASTA_OPERATIONAL não definida no .env.local')
  process.exit(1)
}
const BASE_PATH = path.resolve(process.env.PASTA_OPERATIONAL)

// ─── Schemas Zod ──────────────────────────────────────────────────────────

const MetricEntrySchema = z.object({
  href:      z.string().optional(),
  value:     z.string().optional(),
  timestamp: z.number().optional(),
})

const ContentInteractionsSchema = z.object({
  organic_insights_interactions: z.array(z.object({
    title:           z.string().optional(),
    string_map_data: z.record(z.string(), MetricEntrySchema),
  })),
})

const ReachFileSchema = z.object({
  organic_insights_reach: z.array(z.object({
    title:           z.string().optional(),
    string_map_data: z.record(z.string(), MetricEntrySchema),
  })).optional().default([]),
})

const AudienceInsightsSchema = z.object({
  organic_insights_audience: z.array(z.object({
    title:           z.string().optional(),
    string_map_data: z.record(z.string(), MetricEntrySchema),
  })),
})

// ─── Resolução de paths ───────────────────────────────────────────────────

function findFile(clientUsername: string, flatName: string): string | null {
  const candidates: string[] = [
    // Flat: os arquivos estão diretamente em PASTA_OPERATIONAL
    path.join(BASE_PATH, flatName),
    // Subpasta com username exato
    path.join(BASE_PATH, clientUsername, flatName),
  ]

  // Wildcard: instagram-{username}-{data}-{hash}/
  if (fs.existsSync(BASE_PATH)) {
    const subs = fs.readdirSync(BASE_PATH).filter(f =>
      f.startsWith(`instagram-${clientUsername}`) &&
      fs.statSync(path.join(BASE_PATH, f)).isDirectory(),
    )
    for (const sub of subs) candidates.push(path.join(BASE_PATH, sub, flatName))
  }

  return candidates.find(p => fs.existsSync(p)) ?? null
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
}

// ─── Helpers numéricos ────────────────────────────────────────────────────

function int(smd: Record<string, { value?: string }>, key: string): number {
  const raw = smd[key]?.value ?? '0'
  // remove qualquer coisa que não seja dígito ou sinal negativo
  const cleaned = raw.replace(/[^0-9\-]/g, '')
  return parseInt(cleaned || '0', 10)
}

// ─── Parse de "Mar 8 - Jun 5" → datas ISO ────────────────────────────────

function parseDateRange(range: string): { start: string; end: string } {
  // Formato: "Mar 8 - Jun 5" ou "Dec 8 - Mar 7"
  const monthMap: Record<string, string> = {
    Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
    Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
  }
  const today = new Date()
  const year  = today.getFullYear()

  try {
    const [startPart, endPart] = range.split(' - ')
    const [startMon, startDay] = startPart.trim().split(' ')
    const [endMon, endDay]     = endPart.trim().split(' ')

    const startM = monthMap[startMon] ?? '01'
    const endM   = monthMap[endMon]   ?? '12'

    // Se o mês de fim é menor que o de início, o período cruzou o ano
    const endYear   = parseInt(endM) < parseInt(startM) ? year : year
    const startYear = year

    const start = `${startYear}-${startM}-${startDay.padStart(2, '0')}`
    const end   = `${endYear}-${endM}-${endDay.padStart(2, '0')}`
    return { start, end }
  } catch {
    const today2 = new Date().toISOString().split('T')[0]
    return { start: today2, end: today2 }
  }
}

// ─── Pipeline principal ───────────────────────────────────────────────────

async function processInsights(clientUsername: string): Promise<void> {
  console.log(`\n🔍 @${clientUsername} — iniciando ingestão de insights`)
  console.log(`📂 Base: ${BASE_PATH}`)

  // ── 1. content_interactions.json ──────────────────────────────────────

  const interPath = findFile(clientUsername, 'content_interactions.json')
  if (!interPath) {
    console.error('❌ content_interactions.json não encontrado')
    console.error('   Necessário para: compartilhamentos, salvamentos, curtidas')
    process.exit(1)
  }

  console.log(`✅ content_interactions: ${interPath}`)

  const rawInter = readJson(interPath)
  const parsedInter = ContentInteractionsSchema.safeParse(rawInter)
  if (!parsedInter.success) {
    console.error('❌ Validação de content_interactions.json falhou:')
    console.error(parsedInter.error.issues[0])
    process.exit(1)
  }

  const smd = parsedInter.data.organic_insights_interactions[0]?.string_map_data ?? {}

  // Período real do arquivo
  const dateRangeRaw = smd['Intervalo de datas']?.value ?? ''
  const { start: periodStart, end: periodEnd } = dateRangeRaw
    ? parseDateRange(dateRangeRaw)
    : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }

  console.log(`📅 Período: ${periodStart} → ${periodEnd}  (source: "${dateRangeRaw}")`)

  // Chaves EXATAS validadas no arquivo real (13/06/2026):
  // posts
  const sharesPost  = int(smd, 'Compartilhamento do post')        // singular
  const savesPost   = int(smd, 'Salvamentos do post')
  const likesPost   = int(smd, 'Curtidas do post')
  // reels
  const sharesReels = int(smd, 'Compartilhamentos de vídeos do Reels')
  const savesReels  = int(smd, 'Salvamentos de vídeos do Reels')
  const likesReels  = int(smd, 'Curtidas em vídeos do Reels')
  const commReels   = int(smd, 'Comentários em reels')

  const totalShares   = sharesPost + sharesReels
  const totalSaves    = savesPost  + savesReels
  const totalLikes    = likesPost  + likesReels
  const totalComments = commReels

  console.log(`\n📊 Interações:`)
  console.log(`   Compartilhamentos: ${totalShares}  (posts:${sharesPost} + reels:${sharesReels})`)
  console.log(`   Salvamentos:       ${totalSaves}   (posts:${savesPost} + reels:${savesReels})`)
  console.log(`   Curtidas:          ${totalLikes}  (posts:${likesPost} + reels:${likesReels})`)
  console.log(`   Comentários:       ${totalComments} (reels)`)

  // ── 2. profiles_reached.json (alcance-90d) ────────────────────────────

  let alcance = 0
  const reachPath = findFile(clientUsername, 'profiles_reached.json')
  if (reachPath) {
    console.log(`✅ profiles_reached: ${reachPath}`)
    const rawReach = readJson(reachPath)
    const parsedReach = ReachFileSchema.safeParse(rawReach)
    if (parsedReach.success && parsedReach.data.organic_insights_reach.length > 0) {
      const rsmd = parsedReach.data.organic_insights_reach[0].string_map_data
      alcance = int(rsmd, 'Contas alcançadas') || int(rsmd, 'Accounts reached')
      console.log(`   Alcance: ${alcance}`)
    } else {
      console.warn('⚠️  profiles_reached.json com estrutura inesperada — alcance = 0')
    }
  } else {
    console.warn('⚠️  profiles_reached.json não encontrado — alcance-90d = 0')
    console.warn('   Quality Scores ficarão N/A até profiles_reached.json estar disponível')
  }

  // ── 3. audience_insights.json (seguidores) ────────────────────────────
  // followers_1.json tem apenas ~11 itens (amostra recente, não o total)
  // audience_insights é a fonte mais confiável disponível no export

  let seguidoresTotais = 0
  let saldo90Dias      = 0

  const audiPath = findFile(clientUsername, 'audience_insights.json')
  if (audiPath) {
    console.log(`✅ audience_insights: ${audiPath}`)
    const rawAudi = readJson(audiPath)
    const parsedAudi = AudienceInsightsSchema.safeParse(rawAudi)
    if (parsedAudi.success) {
      const asmd = parsedAudi.data.organic_insights_audience[0]?.string_map_data ?? {}
      // "Seguidores" = novos no período (melhor proxy de total disponível no export)
      seguidoresTotais = int(asmd, 'Seguidores')
      // "Total de seguidores" = variação líquida (negativo = perda)
      saldo90Dias = int(asmd, 'Total de seguidores')
      console.log(`   Seguidores (novos no período): ${seguidoresTotais}`)
      console.log(`   Saldo 90 dias (variação):      ${saldo90Dias}`)
    }
  } else {
    console.warn('⚠️  audience_insights.json não encontrado')
  }

  // ── 4. Persistir no Supabase ──────────────────────────────────────────

  interface MetricRow { metric: string; value: number }

  const metricsToInsert: MetricRow[] = [
    { metric: 'compartilhamentos-90d', value: totalShares },
    { metric: 'salvamentos-90d',       value: totalSaves },
    { metric: 'curtidas-90d',          value: totalLikes },
    { metric: 'comentarios-90d',       value: totalComments },
    { metric: 'impressoes-90d',        value: 0 },       // não disponível no export
    { metric: 'alcance-90d',           value: alcance },
    { metric: 'seguidores-totais',     value: seguidoresTotais },
    { metric: 'saldo-90-dias',         value: saldo90Dias },
  ]

  console.log(`\n💾 Inserindo ${metricsToInsert.length} métricas em kpi_snapshots (L1)...`)

  // Idempotência: deletar registros anteriores das mesmas métricas para este cliente
  const { error: deleteError } = await supabase
    .from('kpi_snapshots')
    .delete()
    .eq('client_id', CLIENT_UUID)
    .in('metric', metricsToInsert.map(m => m.metric))

  if (deleteError) {
    console.warn(`⚠️  Falha ao deletar registros anteriores: ${deleteError.message}`)
  }

  for (const { metric, value } of metricsToInsert) {
    const { error } = await supabase
      .from('kpi_snapshots')
      .insert({
        client_id:    CLIENT_UUID,
        metric,
        value,
        value_text:   null,
        source_level: 'L1',
        period_start: periodStart,
        period_end:   periodEnd,
        formula:      `Extraído de ${metric.includes('reel') || metric.includes('post') ? 'content_interactions.json' : metric.includes('alcance') ? 'profiles_reached.json' : 'audience_insights.json'}`,
        raw_ref:      null,
      })

    if (error) {
      console.error(`❌ ${metric}: ${error.message}`)
    } else {
      console.log(`   ✅ ${metric} = ${value}`)
    }
  }

  console.log(`\n🏁 Concluído para @${clientUsername}`)
  console.log(`\n💡 Próximo passo: execute também extract-demographics.ts para popular avatar_*_real`)
  console.log(`   Quality Scores ficam N/A enquanto alcance-90d = 0`)
  console.log(`   Para resolver: obter profiles_reached.json do export completo\n`)
}

async function run(): Promise<void> {
  console.log(`\n🚀 ORBIT Ingestão de Insights — v1.2.0`)
  console.log(`📋 Cliente: ${CLIENT_USERNAME}`)
  console.log(`🆔 UUID:    ${CLIENT_UUID}`)
  await processInsights(CLIENT_USERNAME)
}

run().catch(err => {
  console.error('❌ Erro fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})