/* ============================================================================
   ORBIT · scripts/cleanup-example-seed.mjs
   P0 — v8.2, item "route.ts (seed) → DELETE → Remover example.com"

   Contexto: não existe nenhum route.ts de seed no projeto hoje (auditado —
   o único route.ts é src/app/api/admin/clients/route.ts, sem relação com
   isso), e scripts/seed-dynamic.ts não insere example.com. Os registros de
   orbit.alerts com action_url em example.com/example.org/localhost são
   sobra manual de teste (check_seed.mjs / check_seed_fixed.mjs só liam,
   nunca apagavam). Esse script fecha o ciclo: lê, mostra, e só apaga com
   --confirm explícito.

   A leitura em runtime já está protegida (sanitizeActionUrl() em
   alertsRepository.ts e orbitAlert.mapper.ts nunca deixam um action_url
   de host placeholder virar link clicável) — isso é defesa em profundidade,
   não substitui limpar o dado na origem. O critério de aceite do v8.2
   é "zero example.com", não "zero example.com visível".

   Uso:
     node scripts/cleanup-example-seed.mjs              # dry-run (só lista)
     node scripts/cleanup-example-seed.mjs --confirm     # apaga de verdade
   ========================================================================== */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'localhost']
const CONFIRM = process.argv.includes('--confirm')

function getEnvVar(envContent, name) {
  const lines = envContent.split('\n')
  for (const line of lines) {
    if (line.startsWith(`${name}=`)) {
      return line.substring(name.length + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local não encontrado em', envPath)
    process.exit(1)
  }
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const url = getEnvVar(envContent, 'NEXT_PUBLIC_SUPABASE_URL') || getEnvVar(envContent, 'SUPABASE_URL')
  const key = getEnvVar(envContent, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar(envContent, 'SUPABASE_ANON_KEY')
  if (!url || !key) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes em .env.local')
    process.exit(1)
  }
  return { url, key }
}

async function main() {
  const { url, key } = loadEnv()
  const client = createClient(url, key, { db: { schema: 'orbit' } })

  console.log(`🔍 Procurando alerts com action_url em ${PLACEHOLDER_HOSTS.join(', ')}...\n`)

  const orFilter = PLACEHOLDER_HOSTS.map((h) => `action_url.ilike.%${h}%`).join(',')
  const { data: found, error: selectError } = await client
    .from('alerts')
    .select('id, action_url, title')
    .or(orFilter)

  if (selectError) {
    console.error('❌ Erro na query de leitura:', selectError.message)
    process.exit(1)
  }

  if (!found || found.length === 0) {
    console.log('✅ Nenhum seed com host placeholder encontrado. Nada a fazer.')
    return
  }

  console.log(`⚠️  ${found.length} alert(s) encontrados:\n`)
  found.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.id} — ${row.title}`)
    console.log(`     ${row.action_url}\n`)
  })

  if (!CONFIRM) {
    console.log('ℹ️  Dry-run (nada apagado). Rode com --confirm para apagar de verdade:')
    console.log('    node scripts/cleanup-example-seed.mjs --confirm')
    return
  }

  const ids = found.map((r) => r.id)
  const { error: deleteError, count } = await client
    .from('alerts')
    .delete({ count: 'exact' })
    .in('id', ids)

  if (deleteError) {
    console.error('❌ Erro ao apagar:', deleteError.message)
    process.exit(1)
  }

  console.log(`✅ ${count ?? ids.length} alert(s) apagados. Critério de aceite v8.2 ("zero example.com") atendido.`)
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err.message)
  process.exit(1)
})
