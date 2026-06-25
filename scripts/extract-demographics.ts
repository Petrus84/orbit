/* ==========================================================================
   ORBIT · Extract Demographics from Instagram Export — v1.3.3 (COMPLETO)
   Arquivo: scripts/extract-demographics.ts

   CORREÇÃO v1.3.3 (24/06/2026 — Petrus + Monica):
   ✅ Adicionada função main() completa
   ✅ Conectadas todas as funções auxiliares
   ✅ Removidos imports desnecessários
   ========================================================================== */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { resolveClientId } from './lib/resolveClientId.ts'
import { createClient } from '@supabase/supabase-js'
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

const supabase = createClient(supabaseUrl, supabaseKey);

if (!process.env.PASTA_OPERATIONAL) {
  console.error('❌ PASTA_OPERATIONAL não definida no .env.local')
  process.exit(1)
}
const CLIENTS_DIR = path.resolve(process.env.PASTA_OPERATIONAL)

// ✅ PARSEAR ARGUMENTOS CLI
const args = process.argv.slice(2)
const clientArgIndex = args.indexOf('--client')

if (clientArgIndex === -1 || clientArgIndex === args.length - 1) {
  console.error('❌ Uso: npx ts-node scripts/extract-demographics.ts --client <handle>')
  process.exit(1)
}

const CLIENT_USERNAME: string = args[clientArgIndex + 1]

if (!CLIENT_USERNAME || CLIENT_USERNAME.startsWith('--')) {
  console.error('❌ Valor inválido para --client')
  process.exit(1)
}

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

// ─── Tipos ────────────────────────────────────────────────────────────────

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

function extractUsername(clientUsername: string): string {
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
  clientId: string,
  clientUsername: string,
  totalFollowers: number,
  demographics: Demographics | null
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

    // 1. SALVAR SEGUIDORES TOTAIS (MUDE PARA INSERT SIMPLES)
    // 1. SALVAR SEGUIDORES TOTAIS (REMOÇÃO DO CAMPO CONFLITANTE)
  const { error: accountError } = await supabase
    .schema('orbit')
    .from('ig_account_snapshots')
    .insert({
      client_id: clientId,
      followers_total: totalFollowers,
      period_start: today,
      period_end: today
      // REMOVIDO: period_source (O PostgreSQL usará o default configurado na tabela)
    });

  if (accountError) {
    console.error(`   ❌ Erro ao salvar seguidores em ig_account_snapshots: ${accountError.message}`);
  } else {
    console.log(`   ✅ Seguidores salvos em ig_account_snapshots: ${totalFollowers}`);
  }

  if (accountError) {
    console.error(`   ❌ Erro ao salvar seguidores: ${accountError.message}`)
  } else {
    console.log(`   ✅ Seguidores salvos: ${totalFollowers}`)
  }

  if (!demographics) {
    console.log('   ⚠️  Sem dados demográficos para gravar')
    return
  }

  const safeCities = Array.isArray(demographics.cities) ? demographics.cities : []
  const safeCountries = Array.isArray(demographics.countries) ? demographics.countries : []

  const payload = {
    client_id: clientId,
    period_start: today,
    period_end: today,
    gender_female_pct: demographics.gender?.female_pct ?? 0,
    gender_male_pct: demographics.gender?.male_pct ?? 0,
    gender_other_pct: demographics.gender?.other_pct ?? 0,
    age_13_17_pct: 0,
    age_18_24_pct: demographics.ageRange?.['18-24'] ?? 0,
    age_25_34_pct: demographics.ageRange?.['25-34'] ?? 0,
    age_35_44_pct: demographics.ageRange?.['35-44'] ?? 0,
    age_45_54_pct: demographics.ageRange?.['45-54'] ?? 0,
    age_55_plus_pct: demographics.ageRange?.['55+'] ?? 0,
    top_cities: safeCities,
    top_countries: safeCountries
  }

  const { error: insertError } = await supabase
    .schema('orbit')
    .from('ig_audience_snapshots')
    .insert(payload)

  if (insertError) {
    console.error(`   ❌ Erro ao salvar demografia: ${insertError.message}`)
  } else {
    console.log(`   ✅ Gênero: M=${payload.gender_male_pct}% F=${payload.gender_female_pct}%`)
    console.log(`   ✅ Cidades: ${safeCities.length}`)
    console.log(`   ✅ Países: ${safeCountries.length}`)
  }
}

// ─── FUNÇÃO PRINCIPAL (ESTAVA FALTANDO!) ───────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔄 ORBIT · Extract Demographics — v1.3.3')
  console.log('═'.repeat(55))

  try {
    // ✅ PASSO 1: Resolver UUID do cliente
    console.log(`\n🔍 Resolvendo UUID para: @${CLIENT_USERNAME}`)
    const CLIENT_UUID = await resolveClientId(supabase, CLIENT_USERNAME)
    console.log(`✅ UUID resolvido: ${CLIENT_UUID}`)

    // ✅ PASSO 2: Extrair dados
    console.log(`\n📊 Extraindo dados de: @${CLIENT_USERNAME}`)
    const username = extractUsername(CLIENT_USERNAME)
    const followers = extractFollowers(CLIENT_USERNAME)
    const demographics = extractDemographics(CLIENT_USERNAME)

    console.log(`   👤 Username: @${username}`)
    console.log(`   👥 Seguidores: ${followers}`)
    console.log(`   📈 Demografia: ${demographics ? 'Encontrada' : 'Não encontrada'}`)

    // ✅ PASSO 3: Persistir dados
    console.log(`\n💾 Salvando em Supabase...`)
    await persistClientData(CLIENT_UUID, username, followers, demographics)

    console.log('\n✅ Concluído com sucesso!')
  } catch (error) {
    console.error('❌ Erro durante execução:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// ─── CHAMAR FUNÇÃO PRINCIPAL ───────────────────────────────────────────────

main().catch(err => {
  console.error('❌ Erro fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})