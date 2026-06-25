/* ==========================================================================
   ORBIT · Script de Ingestão de Insights – v1.4.0 (PRODUTIVO)
   Arquivo: scripts/ingest-insights.ts
   ========================================================================== */

import dotenv from 'dotenv'
import { resolveClientId } from './lib/resolveClientId.ts'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

// Inicialização segura apontando para o public padrão (exigido pelo resolveClientId)
const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Captura do argumento CLI
const CLIENT_USERNAME =
  process.argv.find(a => a.startsWith('--client='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--client') + 1]

if (!CLIENT_USERNAME) {
  console.error('❌ --client é obrigatório (ex: --client cpimportstore)')
  process.exit(1)
}

if (!process.env.PASTA_OPERATIONAL) {
  console.error('❌ PASTA_OPERATIONAL não definida no .env.local')
  process.exit(1)
}

const BASE_PATH = path.resolve(process.env.PASTA_OPERATIONAL)

/* ── Schemas Zod ────────────────────────────────────────────────────────── */
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

/* ── Resolução de Paths ─────────────────────────────────────────────────── */
function findFile(clientUsername: string, flatName: string): string | null {
  const candidates: string[] = [
    path.join(BASE_PATH, flatName),
    path.join(BASE_PATH, clientUsername, flatName),
  ]

  if (fs.existsSync(BASE_PATH)) {
    const subs = fs.readdirSync(BASE_PATH).filter(f =>
      f.startsWith(`instagram-${clientUsername}`) &&
      fs.statSync(path.join(BASE_PATH, f)).isDirectory()
    )
    for (const sub of subs) {
      candidates.push(path.join(BASE_PATH, sub, flatName))
    }
  }
  return candidates.find(p => fs.existsSync(p)) ?? null
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
}

/* ── Helpers Numéricos ──────────────────────────────────────────────────── */
function int(smd: Record<string, { value?: string }>, key: string): number {
  const raw = smd[key]?.value ?? '0'
  const cleaned = raw.replace(/[^0-9\-]/g, '')
  return parseInt(cleaned || '0', 10)
}

/* ── Parse de Datas ISO ─────────────────────────────────────────────────── */
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

/* ── Pipeline Principal ─────────────────────────────────────────────────── */
async function processInsights(clientUsername: string, clientId: string): Promise<void> {
  console.log(`\n🔄 Iniciando processamento para UUID: ${clientId}`)

  const interPath = findFile(clientUsername, 'content_interactions.json')
  if (!interPath) {
    console.error('❌ content_interactions.json não encontrado! Abortando.')
    process.exit(1)
  }

  console.log(`   ✅ Arquivo de interações localizado: ${interPath}`)
  const rawInter = readJson(interPath)
  const parsedInter = ContentInteractionsSchema.safeParse(rawInter)
  
  if (!parsedInter.success) {
    console.error('❌ Erro na validação estrutural do content_interactions.json:')
    console.error(parsedInter.error.issues[0])
    process.exit(1)
  }

  const smd = parsedInter.data.organic_insights_interactions[0]?.string_map_data ?? {}
  const dateRangeRaw = smd['Intervalo de datas']?.value ?? ''
  const { start: periodStart, end: periodEnd } = dateRangeRaw
    ? parseDateRange(dateRangeRaw)
    : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }

  console.log(`   📊 Período detectado: ${periodStart} ──> ${periodEnd}`)

  // Extração das métricas brutas
  const sharesPost  = int(smd, 'Compartilhamento do post')
  const savesPost   = int(smd, 'Salvamentos do post')
  const likesPost   = int(smd, 'Curtidas do post')

  const sharesReels = int(smd, 'Compartilhamentos de vídeos do Reels')
  const savesReels  = int(smd, 'Salvamentos de vídeos do Reels')
  const likesReels  = int(smd, 'Curtidas em vídeos do Reels')
  const commReels   = int(smd, 'Comentários em reels')

  const totalShares   = sharesPost + sharesReels
  const totalSaves    = savesPost + savesReels
  const totalLikes    = likesPost + likesReels
  const totalComments = commReels

  let alcance = 0
  const reachPath = findFile(clientUsername, 'profiles_reached.json')
  if (reachPath) {
    const rawReach = readJson(reachPath)
    const parsedReach = ReachFileSchema.safeParse(rawReach)
    if (parsedReach.success && parsedReach.data.organic_insights_reach.length > 0) {
      const rsmd = parsedReach.data.organic_insights_reach[0].string_map_data
      alcance = int(rsmd, 'Contas alcançadas') || int(rsmd, 'Accounts reached')
    }
  }

  let seguidoresTotais = 0
  let saldo90Dias = 0
  const audiPath = findFile(clientUsername, 'audience_insights.json')
  if (audiPath) {
    const rawAudi = readJson(audiPath)
    const parsedAudi = AudienceInsightsSchema.safeParse(rawAudi)
    if (parsedAudi.success) {
      const asmd = parsedAudi.data.organic_insights_audience[0]?.string_map_data ?? {}
      seguidoresTotais = int(asmd, 'Seguidores')
      saldo90Dias = int(asmd, 'Total de seguidores')
    }
  }

  interface MetricRow { metric: string; value: number }
  const metricsToInsert: MetricRow[] = [
    { metric: 'compartilhamentos-90d', value: totalShares },
    { metric: 'salvamentos-90d', value: totalSaves },
    { metric: 'curtidas-90d', value: totalLikes },
    { metric: 'comentarios-90d', value: totalComments },
    { metric: 'impressoes-90d', value: 0 },
    { metric: 'alcance-90d', value: alcance },
    { metric: 'seguidores-totais', value: seguidoresTotais },
    { metric: 'saldo-90-dias', value: saldo90Dias },
  ]

  console.log(`\n💾 Salvando ${metricsToInsert.length} registros em orbit.metric_history...`)

    console.log(`\n💾 Gravando histórico temporal em orbit.metric_history (MetricRow)...`)

  // 1. Gravação Vertical Histórica (Gráficos e Séries Temporais)
  // Limpa registros anteriores do mesmo período e plataforma para evitar duplicidade cronológica
  await supabase
    .schema('orbit')
    .from('metric_history')
    .delete()
    .eq('client_id', clientId)
    .eq('metric_date', periodEnd)
    .eq('platform', 'instagram')

  for (const { metric, value } of metricsToInsert) {
    const { error: historyError } = await supabase
      .schema('orbit')
      .from('metric_history')
      .insert({
        client_id: clientId,
        metric_name: metric,
        metric_value: value,
        metric_date: periodEnd,
        platform: 'instagram'
        // OMITIDO: confidence_level (O banco de dados aplica o valor DEFAULT do seu tipo USER-DEFINED)
      })

    if (historyError) {
      console.error(`   ❌ Erro na métrica [${metric}]: ${historyError.message}`)
    } else {
      console.log(`   ✅ [${metric}] = ${value} persistido em metric_history`)
    }
  }

  console.log(`\n💾 Atualizando dados consolidados em orbit.ig_account_snapshots via Inserção Não-Destrutiva...`)

  // 2. Gravação Horizontal Inteligente (Segurança contra Sobrescrita de Dados e Trava de Unicidade)
  // Passo A: Buscamos se já existe um registro idêntico para a mesma safra
  const { data: existingSnapshot } = await supabase
    .schema('orbit')
    .from('ig_account_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle()

  // Passo B: Mesclagem Defensiva. Se o processamento atual resultou em 0 (ex: alcance ou seguidores),
  // nós PRESERVAMOS o número legítimo já salvo por outros robôs para não zerar o seu painel!
  const finalPayload = {
    client_id: clientId,
    period_start: periodStart,
    period_end: periodEnd,
    followers_total: seguidoresTotais > 0 ? seguidoresTotais : (existingSnapshot?.followers_total ?? 0),
    reach_total: alcance > 0 ? alcance : (existingSnapshot?.reach_total ?? 0),
    impressions_total: existingSnapshot?.impressions_total ?? 0, // Protege o dado de outros scripts
    interactions_likes: totalLikes > 0 ? totalLikes : (existingSnapshot?.interactions_likes ?? 0),
    interactions_comments: totalComments > 0 ? totalComments : (existingSnapshot?.interactions_comments ?? 0),
    interactions_shares: totalShares > 0 ? totalShares : (existingSnapshot?.interactions_shares ?? 0),
    interactions_saves: totalSaves > 0 ? totalSaves : (existingSnapshot?.interactions_saves ?? 0)
    // OMITIDO: period_source e followers_confidence (O banco injeta os ENUMs padrões nativamente)
  }

  // Passo C: Tomada de decisão inteligente. Se existir, faz UPDATE direcionado na linha via ID único. 
  // Se for inédito, executa um INSERT limpo. Isso anula o erro de unique constraint do Postgres!
  if (existingSnapshot) {
    const { error: updateError } = await supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .update(finalPayload)
      .eq('id', existingSnapshot.id)

    if (updateError) console.error(`   ❌ Erro ao atualizar ig_account_snapshots: ${updateError.message}`)
    else console.log(`   ✅ Snapshots consolidados atualizados com sucesso mantendo colunas vizinhas protegidas!`)
  } else {
    const { error: insertError } = await supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .insert(finalPayload)

    if (insertError) console.error(`   ❌ Erro ao inserir novo ig_account_snapshots: ${insertError.message}`)
    else console.log(`   ✅ Novo snapshot consolidado criado com sucesso!`)
  }

  console.log(`\n🎉 Ingestão de insights concluída com sucesso para @${clientUsername}!`)
}


/* ── Execução Assíncrona Centralizada ────────────────────────────────────── */
async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log(`🔄 ORBIT · Ingest Insights — v1.4.0`)
  console.log(`📱 Cliente: ${CLIENT_USERNAME}`)
  console.log('═══════════════════════════════════════════════════════')

  try {
    // Resolução dinâmica com cache integrado
    const clientId = await resolveClientId(supabase, CLIENT_USERNAME)
    console.log(`🆔 UUID resolvido com sucesso: ${clientId}`)
    
    await processInsights(CLIENT_USERNAME, clientId)
    } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`❌ Erro fatal na execução: ${errorMessage}`);
    process.exit(1);
  }
}

// Invoca o runner quando o script é executado diretamente
void run();