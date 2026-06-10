/* ==========================================================================
   ORBIT · Script de Ingestão de Insights — v1.0.0
   Arquivo: scripts/ingest-insights.ts

   FUNÇÃO:
     Lê logged_information/past_instagram_insights/posts.json
     e insere métricas reais em kpi_snapshots (L1)

   USO:
     npx ts-node scripts/ingest-insights.ts --client cpimportstore

   MÉTRICAS INSERIDAS:
     - alcance-90d (soma de "Contas alcançadas")
     - impressoes-90d (soma de "Impressões")
     - salvamentos-90d (soma de "Salvamentos")
     - compartilhamentos-90d (soma de "Compartilhamentos")
     - visitas-perfil-90d (soma de "Visitas ao perfil")
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Argumentos de linha de comando
const CLIENT_USERNAME = process.argv.find(a => a.startsWith('--client='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--client') + 1]

if (!CLIENT_USERNAME) {
  console.error('❌ --client é obrigatório (ex: --client cpimportstore)')
  process.exit(1)
}

// Mapa de clientes (mesmo do ingest-l0-v2.ts)
const CLIENT_UUID_MAP: Record<string, string> = {
  'cpimportstore':  '22222222-2222-2222-2222-222222222222',
  'petruchio84':    '44444444-4444-4444-4444-444444444444',
  'fiorefernando__': '33333333-3333-3333-3333-333333333333',
}

const CLIENT_UUID = CLIENT_UUID_MAP[CLIENT_USERNAME]
if (!CLIENT_UUID) {
  console.error(`❌ Cliente "${CLIENT_USERNAME}" não encontrado em CLIENT_UUID_MAP`)
  process.exit(1)
}

  // ✅ CORRETO: Usa variável de ambiente ou erro
const BASE_PATH = process.env.PASTA_OPERATIONAL 
  ? path.resolve(process.env.PASTA_OPERATIONAL)
  : (() => { 
      console.error('❌ PASTA_OPERATIONAL não definida no .env.local')
      console.error('   Adicione: PASTA_OPERATIONAL=C:/Users/DELL/Downloads/Alpha_Coleta/clientes')
      process.exit(1)
    })()

// ─── Schema Zod — validação do JSON de insights ───────────────────────────

// ✅ CORRETO: Schema para métricas de insights
const InsightMetricSchema = z.object({
  label: z.string().optional(),
  value: z.string().optional(), // Impressões, Curtidas, etc
  timestamp: z.number().optional(), // Registro de data e hora
})

const InsightPostSchema = z.object({
  string_map_data: z.record(z.string(), InsightMetricSchema),
})

const InsightsFileSchema = z.object({
  organic_insights_posts: z.array(InsightPostSchema),
})

// ─── Buscar arquivo de insights ───────────────────────────────────────────

function findInsightsFile(clientUsername: string): string | null {
  // Tentar múltiplos padrões de pasta
  const possiblePaths = [
    path.join(BASE_PATH, clientUsername, 'logged_information/past_instagram_insights/posts.json'),
    path.join(BASE_PATH, `instagram-${clientUsername}-*`, 'logged_information/past_instagram_insights/posts.json'),
  ]

  for (const pattern of possiblePaths) {
    if (pattern.includes('*')) {
      // Buscar com wildcard
      const dir = path.dirname(pattern)
      const parentDir = path.dirname(dir)
      if (fs.existsSync(parentDir)) {
        const folders = fs.readdirSync(parentDir).filter(f => 
          f.startsWith(`instagram-${clientUsername}`) && 
          fs.statSync(path.join(parentDir, f)).isDirectory()
        )
        if (folders.length > 0) {
          const fullPath = path.join(parentDir, folders[0], 'logged_information/past_instagram_insights/posts.json')
          if (fs.existsSync(fullPath)) return fullPath
        }
      }
    } else {
      if (fs.existsSync(pattern)) return pattern
    }
  }

  return null
}

// ─── Processar insights ────────────────────────────────────────────────────

async function processInsights(clientUsername: string): Promise<void> {
  console.log(`\n🔍 Buscando insights para @${clientUsername}...`)

  const insightsPath = findInsightsFile(clientUsername)
  if (!insightsPath) {
    console.error(`❌ Arquivo de insights não encontrado para ${clientUsername}`)
    console.error(`   Procurado em: ${BASE_PATH}/${clientUsername}/logged_information/past_instagram_insights/posts.json`)
    process.exit(1)
  }

  console.log(`✅ Arquivo encontrado: ${insightsPath}`)

  // Ler e validar JSON
  let rawData: unknown
  try {
    rawData = JSON.parse(fs.readFileSync(insightsPath, 'utf-8'))
  } catch (err) {
    console.error(`❌ Erro ao ler JSON:`, err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const parsed = InsightsFileSchema.safeParse(rawData)
  if (!parsed.success) {
    console.error(`❌ Validação falhou:`, parsed.error.issues[0])
    process.exit(1)
  }

  const insights = parsed.data
  console.log(`✅ ${insights.organic_insights_posts.length} post(s) com insights encontrado(s)`)

  // Agregar métricas
  let totalAlcance = 0
  let totalImpressoes = 0
  let totalSalvamentos = 0
  let totalCompartilhamentos = 0
  let totalVisitasPerfil = 0

  for (const post of insights.organic_insights_posts) {
    const metrics = post.string_map_data

    totalAlcance += parseInt(metrics['Contas alcançadas']?.value ?? '0')
    totalImpressoes += parseInt(metrics['Impressões']?.value ?? '0')
    totalSalvamentos += parseInt(metrics['Salvamentos']?.value ?? '0')
    totalCompartilhamentos += parseInt(metrics['Compartilhamentos']?.value ?? '0')
    totalVisitasPerfil += parseInt(metrics['Visitas ao perfil']?.value ?? '0')
  }

  console.log(`\n📊 Métricas agregadas:`)
  console.log(`   Alcance: ${totalAlcance}`)
  console.log(`   Impressões: ${totalImpressoes}`)
  console.log(`   Salvamentos: ${totalSalvamentos}`)
  console.log(`   Compartilhamentos: ${totalCompartilhamentos}`)
  console.log(`   Visitas ao perfil: ${totalVisitasPerfil}`)

 // ✅ CORRETO: Extrair timestamps reais dos posts
const postTimestamps = insights.organic_insights_posts
  .map(p => p.string_map_data['Registro de data e hora da criação']?.timestamp)
  .filter((t): t is number => typeof t === 'number')
  .sort((a, b) => a - b)

// Converter timestamps para datas ISO (multiplicar por 1000 para Date)
const periodStart = postTimestamps.length > 0
  ? new Date(postTimestamps[0] * 1000).toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0]

const periodEnd = postTimestamps.length > 0
  ? new Date(postTimestamps[postTimestamps.length - 1] * 1000).toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0]

console.log(`\n📅 Período real dos posts:`)
console.log(`   Início: ${periodStart}`)
console.log(`   Fim:    ${periodEnd}`)
console.log(`   Total:  ${postTimestamps.length} posts`)

  const metricsToInsert = [
    { metric: 'alcance-90d', value: totalAlcance },
    { metric: 'impressoes-90d', value: totalImpressoes },
    { metric: 'salvamentos-90d', value: totalSalvamentos },
    { metric: 'compartilhamentos-90d', value: totalCompartilhamentos },
    { metric: 'visitas-perfil-90d', value: totalVisitasPerfil },
  ]

  console.log(`\n💾 Inserindo em kpi_snapshots (L1)...`)

  // Deletar métricas antigas (idempotência)
  const { error: deleteError } = await supabase
    .from('kpi_snapshots')
    .delete()
    .eq('client_id', CLIENT_UUID)
    .in('metric', metricsToInsert.map(m => m.metric))

  if (deleteError) {
    console.warn(`⚠️  Falha ao deletar métricas antigas:`, deleteError.message)
  }

  // Inserir novas métricas
  for (const { metric, value } of metricsToInsert) {
    const { error } = await supabase
      .from('kpi_snapshots')
      .insert({
        client_id: CLIENT_UUID,
        metric,
        value,
        value_text: null,
        source_level: 'L1',
        period_start: periodStart,  // ✅ DEPOIS
        period_end: periodEnd,      // ✅ DEPOIS
        formula: `SUM(${metric}) FROM insights/posts.json`,
        raw_ref: null,
      })

    if (error) {
      console.error(`❌ Erro ao inserir ${metric}:`, error.message)
    } else {
      console.log(`   ✅ ${metric}: ${value}`)
    }
  }

  console.log(`\n🏁 Concluído! Dashboard agora mostrará dados reais.\n`)
}

// ─── Pipeline principal ────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`\n🚀 ORBIT Ingestão de Insights — v1.0.0`)
  console.log(`📋 Cliente: ${CLIENT_USERNAME}`)
  console.log(`🆔 UUID: ${CLIENT_UUID}`)

  await processInsights(CLIENT_USERNAME)
}

run().catch(err => {
  console.error('❌ Erro fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
