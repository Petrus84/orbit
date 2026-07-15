//# ============================================================================
//# ARQUIVO: ingest-insights.ts (v1.6.0 — CLIQUES NO LINK + CAMPOS ÓRFÃOS DO REACH)
//# ============================================================================
//# ✅ CORREÇÕES v1.6.0:
//# - O bloco que lê profiles_reached.json só extraía REACH. O arquivo sempre
//#   trouxe também "Impressões", "Visitas ao perfil" e "Toques em links
//#   externos" — só nunca foram lidos. impressoes-90d, inclusive, estava
//#   HARDCODED em 0 (não era um bug de encoding, era um campo nunca escrito).
//# - Adiciona extração de IMPRESSIONS, PROFILE_VISITS_FROM e EXTERNAL_LINK_TAPS
//#   (chave nova no dicionário) do mesmo objeto rsmd já usado para REACH.
//# - Propaga profile_visits e link_clicks para orbit.ig_account_snapshots.
//#   Isso importa além do valor em si: link_ctr_pct é coluna GENERATED como
//#   (link_clicks / profile_visits) * 100 — sem profile_visits preenchido,
//#   link_ctr_pct continua NULL mesmo com link_clicks correto.
//# - Novas linhas em metric_history: 'impressoes-90d' (agora real, não 0),
//#   'visitas-perfil-90d', 'cliques-link-90d'.
//#
//# ✅ CORREÇÕES v1.5.0 (mantidas):
//# - Remove a lista local de variantes de mojibake (intWithFallback + arrays
//#   hardcoded). Passa a consumir lib/metric-key-dictionary.ts, a mesma fonte
//#   usada por extract-demographics.ts e ingest-l0-v2.ts.
//# - Type-safe sem 'any'
//# ============================================================================

import dotenv from 'dotenv'
import { resolveClientId } from './lib/resolveClientId.ts'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import {
  resolveIntMetric,
  resolveStringMetric,
  logMissingKey,
} from './lib/metric-key-dictionary.ts'

dotenv.config({ path: '.env.local' })

// Inicialização segura apontando para o schema orbit
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

async function processInsights(clientUsername: string, clientId: string): Promise<void> {
  console.log(`\n🔄 Iniciando processamento para UUID: ${clientId}`)

  const interPath = findFile(clientUsername, 'content_interactions.json')
  if (!interPath) {
    console.error('❌ content_interactions.json não encontrado! Abortando.')
    process.exit(1)
  }

  console.log(`   ✅ Arquivo de interações localizado: ${interPath}`)

  // ✅ DIAGNÓSTICO: Verificar se profiles_reached.json existe
  console.log(`\n🔍 [DIAGNÓSTICO] Procurando profiles_reached.json...`)
  const reachPath = findFile(clientUsername, 'profiles_reached.json')
  console.log(`   Resultado: ${reachPath ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`)
  if (reachPath) {
    console.log(`   Caminho: ${reachPath}`)
  } else {
    console.log(`   Procurou em:`)
    console.log(`      1. ${path.join(BASE_PATH, 'profiles_reached.json')}`)
    console.log(`      2. ${path.join(BASE_PATH, clientUsername, 'profiles_reached.json')}`)
    if (fs.existsSync(BASE_PATH)) {
      const items = fs.readdirSync(BASE_PATH).slice(0, 15)
      console.log(`   Arquivos/pastas em BASE_PATH: ${items.join(', ')}`)
    }
  }

  const rawInter = readJson(interPath)
  const parsedInter = ContentInteractionsSchema.safeParse(rawInter)

  if (!parsedInter.success) {
    console.error('❌ Erro na validação estrutural do content_interactions.json:')
    console.error(parsedInter.error.issues[0])
    process.exit(1)
  }

  const smd = parsedInter.data.organic_insights_interactions[0]?.string_map_data ?? {}
  const dateRangeRaw = resolveStringMetric(smd, 'DATE_RANGE')
  const { start: periodStart, end: periodEnd } = dateRangeRaw
    ? parseDateRange(dateRangeRaw)
    : { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }

  console.log(`   📊 Período detectado: ${periodStart} ──> ${periodEnd}`)

  // ✅ v1.5.0: Extração via dicionário compartilhado (lib/metric-key-dictionary.ts)
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

  // ✅ v1.6.0: profiles_reached.json tem REACH, IMPRESSIONS, PROFILE_VISITS_FROM
  // e EXTERNAL_LINK_TAPS no mesmo objeto rsmd — antes só REACH era extraído.
  let alcance = 0
  let impressoes = 0
  let visitasPerfil = 0
  let cliquesLink = 0
  if (reachPath) {
    const rawReach = readJson(reachPath)
    const parsedReach = ReachFileSchema.safeParse(rawReach)
    if (parsedReach.success && parsedReach.data.organic_insights_reach.length > 0) {
      const rsmd = parsedReach.data.organic_insights_reach[0].string_map_data
      alcance = resolveIntMetric(rsmd, 'REACH', logMissingKey)
      impressoes = resolveIntMetric(rsmd, 'IMPRESSIONS', logMissingKey)
      visitasPerfil = resolveIntMetric(rsmd, 'PROFILE_VISITS_FROM', logMissingKey)
      cliquesLink = resolveIntMetric(rsmd, 'EXTERNAL_LINK_TAPS', logMissingKey)
    }
  }

  // ✅ v1.5.0: Busca de seguidores via dicionário compartilhado
  let seguidoresTotais = 0
  let saldo90Dias = 0
  const audiPath = findFile(clientUsername, 'audience_insights.json')
  if (audiPath) {
    const rawAudi = readJson(audiPath)
    const parsedAudi = AudienceInsightsSchema.safeParse(rawAudi)
    if (parsedAudi.success) {
      const asmd = parsedAudi.data.organic_insights_audience[0]?.string_map_data ?? {}
      seguidoresTotais = resolveIntMetric(asmd, 'FOLLOWERS', logMissingKey)
      saldo90Dias = resolveIntMetric(asmd, 'TOTAL_FOLLOWERS', logMissingKey)
    }
  }

  interface MetricRow {
    metric: string
    value: number
  }

  const metricsToInsert: MetricRow[] = [
    { metric: 'compartilhamentos-90d', value: totalShares },
    { metric: 'salvamentos-90d', value: totalSaves },
    { metric: 'curtidas-90d', value: totalLikes },
    { metric: 'comentarios-90d', value: totalComments },
    { metric: 'impressoes-90d', value: impressoes },
    { metric: 'alcance-90d', value: alcance },
    { metric: 'visitas-perfil-90d', value: visitasPerfil },
    { metric: 'cliques-link-90d', value: cliquesLink },
    { metric: 'seguidores-totais', value: seguidoresTotais },
    { metric: 'saldo-90-dias', value: saldo90Dias },
  ]

  console.log(`\n💾 Salvando ${metricsToInsert.length} registros em orbit.metric_history...`)

  // 🔑 CORREÇÃO CRÍTICA: Usar .schema('orbit') obrigatoriamente
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
      })

    if (historyError) {
      console.error(`   ❌ Erro na métrica [${metric}]: ${historyError.message}`)
    } else {
      console.log(`   ✅ [${metric}] = ${value} persistido em orbit.metric_history`)
    }
  }

  console.log(`\n💾 Atualizando dados consolidados em orbit.ig_account_snapshots...`)

  // 🔑 CORREÇÃO CRÍTICA: Usar .schema('orbit') obrigatoriamente
  const { data: existingSnapshot } = await supabase
    .schema('orbit')
    .from('ig_account_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .maybeSingle()

  const finalPayload = {
    client_id: clientId,
    period_start: periodStart,
    period_end: periodEnd,
    followers_total: seguidoresTotais > 0 ? seguidoresTotais : (existingSnapshot?.followers_total ?? 0),
    reach_total: alcance > 0 ? alcance : (existingSnapshot?.reach_total ?? 0),
    impressions_total: impressoes > 0 ? impressoes : (existingSnapshot?.impressions_total ?? 0),
    // v1.6.0 — antes nunca escritos. profile_visits alimenta a coluna GENERATED
    // link_ctr_pct (= link_clicks / profile_visits * 100): sem isto, link_ctr_pct
    // continua NULL mesmo com link_clicks correto.
    profile_visits: visitasPerfil > 0 ? visitasPerfil : (existingSnapshot?.profile_visits ?? 0),
    link_clicks: cliquesLink > 0 ? cliquesLink : (existingSnapshot?.link_clicks ?? 0),
    interactions_likes: totalLikes > 0 ? totalLikes : (existingSnapshot?.interactions_likes ?? 0),
    interactions_comments: totalComments > 0 ? totalComments : (existingSnapshot?.interactions_comments ?? 0),
    interactions_shares: totalShares > 0 ? totalShares : (existingSnapshot?.interactions_shares ?? 0),
    interactions_saves: totalSaves > 0 ? totalSaves : (existingSnapshot?.interactions_saves ?? 0)
  }

  if (existingSnapshot) {
    const { error: updateError } = await supabase
      .schema('orbit')
      .from('ig_account_snapshots')
      .update(finalPayload)
      .eq('id', existingSnapshot.id)

    if (updateError) console.error(`   ❌ Erro ao atualizar ig_account_snapshots: ${updateError.message}`)
    else console.log(`   ✅ Snapshots consolidados atualizados com sucesso!`)
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
  console.log(`🔄 ORBIT · Ingest Insights — v1.6.0`)
  console.log(`📱 Cliente: ${CLIENT_USERNAME}`)
  console.log('═══════════════════════════════════════════════════════')

  try {
    // 🔑 resolveClientId já usa .schema('orbit') internamente
    const clientId = await resolveClientId(supabase, CLIENT_USERNAME)
    console.log(`🔑 UUID resolvido com sucesso: ${clientId}`)

    await processInsights(CLIENT_USERNAME, clientId)
    console.log(`\n✅ Script finalizado com sucesso!`)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : ''

    console.error(`\n❌ ERRO FATAL NA EXECUÇÃO:`)
    console.error(`   Mensagem: ${errorMessage}`)
    if (errorStack) {
      console.error(`   Stack:\n${errorStack}`)
    }

    process.exit(1)
  }
}

// ✅ Captura erros não tratados
void run().catch(err => {
  console.error('❌ [UNCAUGHT] Erro não capturado:')
  console.error(err)
  process.exit(1)
})