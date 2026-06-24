/* ==========================================================================
   ORBIT · Extract Demographics from Instagram Export — v1.3.2 (CORRIGIDO)
   Arquivo: scripts/extract-demographics.ts

   CORREÇÃO v1.3.2 (24/06/2026 — TypeScript TS2345):
   ✅ Adicionar guard para CLIENT_USERNAME antes de usar em resolveClientId
   ✅ Adicionar extensão .js no import para resolver módulo
   ========================================================================== */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { resolveClientId } from './lib/resolveClientId.js'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

// ─── Configuração ──────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

if (!process.env.PASTA_OPERATIONAL) {
  console.error('❌ PASTA_OPERATIONAL não definida no .env.local')
  process.exit(1)
}
const CLIENTS_DIR = path.resolve(process.env.PASTA_OPERATIONAL)

// ✅ CORREÇÃO v1.3.2: Parsear argumentos CLI com guard
const args = process.argv.slice(2)
const clientArgIndex = args.indexOf('--client')

// ✅ Validar se --client foi passado
if (clientArgIndex === -1 || clientArgIndex === args.length - 1) {
  console.error('❌ Uso: npx ts-node scripts/extract-demographics.ts --client <handle>')
  process.exit(1)
}

// ✅ Extrair o valor do argumento --client
const clientUsername: string = args[clientArgIndex + 1]

if (!clientUsername || clientUsername.startsWith('--')) {
  console.error('❌ Valor inválido para --client')
  process.exit(1)
}

// ✅ Declarar CLIENT_UUID com let (será atribuído em main())
let CLIENT_UUID: string

// ─── Schemas Zod ──────────────────────────────────────────────────────────

const MetricEntrySchema = z.object({
  href:      z.string().optional(),
  value:     z.string().optional(),
  timestamp: z.number().optional(),
})

const FollowerItemSchema = z.object({
  title:           z.string().optional(),
  media_list_data: z.array(z.unknown()).optional(),
  string_list_data: z.array(z.object({
    href:      z.string().optional(),
    value:     z.string(),
    timestamp: z.number(),
  })).optional().default([]),
})

const FollowersFileSchema = z.union([
  z.array(FollowerItemSchema),
  z.object({ relationships_followers: z.array(FollowerItemSchema) }),
])

const PersonalInfoSchema = z.object({
  profile_user: z.array(z.object({
    string_map_data: z.record(z.string(), z.object({
      value: z.string().optional(),
    })).optional().default({}),
  })).optional().default([]),
})

const AudienceInsightsSchema = z.object({
  organic_insights_audience: z.array(z.object({
    title:           z.string().optional(),
    string_map_data: z.record(z.string(), MetricEntrySchema),
  })),
})

// ─── Tipos alinhados com orbit.ts ─────────────────────────────────────────

type GenderData = {
  male_pct:   number
  female_pct: number
  other_pct:  number
  updated_at: string
}

type AgeRangeData = {
  '18-24': number
  '25-34': number
  '35-44': number
  '45-54': number
  '55+':   number
  updated_at: string
}

type LocationEntry = { name: string; pct: number }

type Demographics = {
  gender:    GenderData
  ageRange:  AgeRangeData
  cities:    LocationEntry[]
  countries: LocationEntry[]
}

// ─── Funções de parse ─────────────────────────────────────────────────────

function parsePct(value: string): number {
  const match = value.match(/([\d.]+)%/)
  return match ? parseFloat(match[1]) : 0
}

function parseGenderFromPct(malePctStr: string, femalePctStr: string): Omit<GenderData, 'updated_at'> {
  const male   = parsePct(malePctStr)
  const female = parsePct(femalePctStr)
  const other  = Math.max(0, Math.round((100 - male - female) * 10) / 10)
  return { male_pct: male, female_pct: female, other_pct: other }
}

function parseAgeRange(value: string): Omit<AgeRangeData, 'updated_at'> {
  const result: Omit<AgeRangeData, 'updated_at'> = {
    '18-24': 0,
    '25-34': 0,
    '35-44': 0,
    '45-54': 0,
    '55+':   0,
  }

  const groupMap: Record<string, keyof Omit<AgeRangeData, 'updated_at'>> = {
    '18-24': '18-24',
    '25-34': '25-34',
    '35-44': '35-44',
    '45-54': '45-54',
    '55-64': '55+',
    '65+':   '55+',
    '55+':   '55+',
  }

  const regex = /([\d]+[-+][\d]*):\s*([\d.]+)%/g
  let match: RegExpExecArray | null = regex.exec(value)
  while (match !== null) {
    const group  = match[1]
    const pct    = parseFloat(match[2])
    const target = groupMap[group]
    if (target) {
      result[target] = Math.round((result[target] + pct) * 10) / 10
    }
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

// ─── Resolução de paths ───────────────────────────────────────────────────

function findFile(clientUsername: string, flatName: string): string | null {
  const candidates: string[] = [
    path.join(CLIENTS_DIR, flatName),
    path.join(CLIENTS_DIR, clientUsername, flatName),
  ]

  if (fs.existsSync(CLIENTS_DIR)) {
    const subs = fs.readdirSync(CLIENTS_DIR).filter(f =>
      f.startsWith(`instagram-${clientUsername}`) &&
      fs.statSync(path.join(CLIENTS_DIR, f)).isDirectory(),
    )
    for (const sub of subs) candidates.push(path.join(CLIENTS_DIR, sub, flatName))
  }

  return candidates.find(p => fs.existsSync(p)) ?? null
}

function extractUsernameFromFolder(folderPath: string): string {
  const base  = path.basename(folderPath)
  const match = base.match(/instagram-([^-]+)-\d{4}-\d{2}-\d{2}/)
  return match?.[1] ?? base
}

// ─── Extração de seguidores ───────────────────────────────────────────────

function extractFollowers(clientUsername: string): number {
  const p = findFile(clientUsername, 'followers_1.json')
  if (!p) { console.log('   ⚠️  followers_1.json não encontrado'); return 0 }

  const raw: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'))
  const parsed = FollowersFileSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`   ⚠️  followers_1.json inválido: ${parsed.error.issues[0]?.message}`)
    return 0
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data.reduce((acc, item) => acc + (item.string_list_data?.length ?? 0), 0)
  }
  return parsed.data.relationships_followers[0]?.string_list_data?.length ?? 0
}

// ─── Extração de username ─────────────────────────────────────────────────

function extractUsername(folderPath: string, clientUsername: string): string {
  const p = findFile(clientUsername, 'personal_information.json')
  if (!p) return clientUsername

  const raw: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'))
  const parsed = PersonalInfoSchema.safeParse(raw)
  if (!parsed.success) return clientUsername

  const smd = parsed.data.profile_user[0]?.string_map_data ?? {}
  return (
    smd['Nome de usuário']?.value ??
    smd['Username']?.value ??
    clientUsername
  )
}

// ─── Extração de demografia ───────────────────────────────────────────────

function extractDemographics(clientUsername: string): Demographics | null {
  const p = findFile(clientUsername, 'audience_insights.json')
  if (!p) { console.log('   ⚠️  audience_insights.json não encontrado'); return null }

  const raw: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'))
  const parsed = AudienceInsightsSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`   ⚠️  audience_insights.json inválido: ${parsed.error.issues[0]?.message}`)
    return null
  }

  const smd  = parsed.data.organic_insights_audience[0]?.string_map_data ?? {}
  const now  = new Date().toISOString()

  const malePctStr   = smd['Porcentagem do total de seguidores para homens']?.value   ?? '0%'
  const femalePctStr = smd['Porcentagem do total de seguidores para mulheres']?.value ?? '0%'
  const ageStr       = smd['Porcentagem de seguidores por idade para todos os gêneros']?.value ?? ''
  const citiesStr    = smd['Porcentagem de seguidores por cidade']?.value ?? ''
  const countriesStr = smd['Porcentagem de seguidores por país']?.value ?? ''

  if (!malePctStr && !ageStr) {
    console.warn('   ⚠️  Dados demográficos vazios')
    return null
  }

  return {
    gender:    { ...parseGenderFromPct(malePctStr, femalePctStr), updated_at: now },
    ageRange:  { ...parseAgeRange(ageStr), updated_at: now },
    cities:    parseLocations(citiesStr),
    countries: parseLocations(countriesStr),
  }
}

// ─── Persistência ─────────────────────────────────────────────────────────

async function persistClientData(
  clientId:      string,
  clientUsername: string,
  totalFollowers: number,
  demographics:   Demographics | null,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const { error: deleteKpiError } = await supabase
    .from('kpi_snapshots')
    .delete()
    .eq('client_id', clientId)
    .eq('metric', 'seguidores-totais')
    .eq('period_start', today)
    .eq('period_end', today)

  if (deleteKpiError) {
    console.warn(`   ⚠️  Falha ao limpar registro anterior de seguidores: ${deleteKpiError.message}`)
  }

  const { error: kpiError } = await supabase
    .from('kpi_snapshots')
    .insert({
      client_id:    clientId,
      metric:       'seguidores-totais',
      value:        totalFollowers,
      period_start: today,
      period_end:   today,
    })

  if (kpiError) console.error(`   ❌ Seguidores: ${kpiError.message}`)
  else          console.log(`   ✅ Seguidores (followers_1): ${totalFollowers}`)

  if (demographics) {
    const { error: demoError } = await supabase
      .from('clients')
      .update({
        avatar_gender_real:      demographics.gender,
        avatar_age_range_real:   demographics.ageRange,
        avatar_cities_real:      demographics.cities,
        avatar_countries_real:   demographics.countries,
        demographics_updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    if (demoError) {
      console.error(`   ❌ Demografia: ${demoError.message}`)
    } else {
      console.log(`   ✅ Gênero: M=${demographics.gender.male_pct}% F=${demographics.gender.female_pct}%`)
      console.log(`   ✅ Cidades: ${demographics.cities.length}`)
      console.log(`   ✅ Países:  ${demographics.countries.length}`)
    }
  } else {
    console.log('   ⚠️  Sem dados demográficos para gravar')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\\n🔄 ORBIT · Extract Demographics — v1.3.2')
  console.log('═'.repeat(55))

  // ✅ CORREÇÃO v1.3.2: Resolver CLIENT_UUID dinamicamente
  // clientUsername já foi validado acima (não pode ser undefined)
  try {
    CLIENT_UUID = await resolveClientId(supabase, clientUsername)
    console.log(`🆔 UUID resolvido: ${CLIENT_UUID}`)
    console.log(`📱 Cliente: ${clientUsername}`)
  } catch (err) {
    console.error(`❌ Erro ao resolver UUID: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  if (!fs.existsSync(CLIENTS_DIR)) {
    console.error(`❌ Pasta não encontrada: ${CLIENTS_DIR}`)
    process.exit(1)
  }

  const items       = fs.readdirSync(CLIENTS_DIR)
  const hasJsonFiles = items.some(f => f.endsWith('.json'))

  let foldersToProcess: string[]
  if (hasJsonFiles) {
    foldersToProcess = [CLIENTS_DIR]
    console.log(`📂 Modo flat — processando: ${CLIENTS_DIR}`)
  } else {
    foldersToProcess = items
      .filter(f => fs.statSync(path.join(CLIENTS_DIR, f)).isDirectory())
      .map(f => path.join(CLIENTS_DIR, f))
    console.log(`📂 ${foldersToProcess.length} pasta(s) de cliente(s)`)
  }

  console.log('')

  for (const folderPath of foldersToProcess) {
    try {
      const folderUsername = extractUsernameFromFolder(folderPath)
      const username       = extractUsername(folderPath, folderUsername)

      console.log(`🔍 Pasta: ${path.basename(folderPath)}`)
      console.log(`   Username: ${username}`)

      const followers    = extractFollowers(username)
      const demographics = extractDemographics(username)

      await persistClientData(CLIENT_UUID, username, followers, demographics)

    } catch (err: unknown) {
      console.error(`   ❌ ${err instanceof Error ? err.message : String(err)}`)
    }

    console.log('')
  }

  console.log('═'.repeat(55))
  console.log('✅ Extração concluída\\n')
}

// ✅ Chamar main() corretamente
main().catch(err => {
  console.error('❌ Erro fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})


