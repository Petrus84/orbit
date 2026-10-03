// ============================================================================
// patch-followers.ts — injeta followers_count no manifest L1 a partir dos
// arquivos do niche scraper (pasta irmã 03_niche_scraper), pra contas L1
// que não passaram por profile-fetch com captura de porte.
//
// DOIS BUGS REAIS CORRIGIDOS NESTA VERSÃO (achados rodando no ambiente real):
//
// 1) MANIFEST_PATH apontava pra data/benchmark/manifest.json, mas o
//    manifesto que compute.ts de fato usa está em data/l0_exports/manifest.json
//    (ou onde quer que L1_MANIFEST resolva) — os dois arquivos podem ter
//    handles totalmente diferentes. Agora usa a MESMA lógica de resolução
//    de path por candidatos que compute.ts usa (env var L1_MANIFEST vence,
//    senão tenta data/l0_exports/manifest.json, senão data/benchmark/manifest.json),
//    então os dois scripts sempre operam sobre o mesmo arquivo.
//
// 2) O campo injetado era `followersCount`/`followers` (camelCase), mas
//    compute.ts lê especificamente `followers_count` (snake_case, ver
//    interface L1AccountMinimal em compute.ts). O comentário original
//    ("Injeta exatamente o que o compute.ts exige") estava com o nome
//    errado — silent-mismatch bug do mesmo formato dos outros já
//    encontrados no projeto (a.nicho vs a.setor_benchmark_key, etc.).
//    Agora grava followers_count (o único nome que compute.ts realmente lê),
//    mantendo followersCount/followers como campos extras informativos,
//    sem depender deles.
//
// Também adicionado: normalizeHandle (SSOT de tiers.ts) nos dois lados do
// match, e um relatório de quais handles do manifesto NÃO bateram com
// nenhuma entrada do followerMap — pra depurar mismatch de handle sem
// precisar adivinhar.
// ============================================================================

import * as fs from 'fs'
import * as path from 'path'
import { normalizeHandle } from './tiers'

const NICHE_DIR = path.join(__dirname, '..', '03_niche_scraper')
const BENCHMARK_DIR = path.join(process.cwd(), 'data', 'benchmark')

// Mesma resolução de candidatos usada em compute.ts — garante que este
// script e compute.ts sempre leem/escrevem o MESMO manifest.json.
function resolveManifestPath(): string {
  if (process.env.L1_MANIFEST) return process.env.L1_MANIFEST
  const candidates = [
    path.join(process.cwd(), 'data', 'l0_exports', 'manifest.json'),
    path.join(process.cwd(), 'data', 'benchmark', 'manifest.json'),
  ]
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[0]
}

const MANIFEST_PATH = resolveManifestPath()

console.log('🚀 Iniciando injeção de seguidores de nicho no manifesto...')
console.log(`   Manifesto alvo: ${MANIFEST_PATH}`)

// 1. Mapear usernames para followerCount a partir da pasta do niche scraper
const followerMap: Record<string, number> = {}

if (fs.existsSync(NICHE_DIR)) {
  const files = fs.readdirSync(NICHE_DIR).filter((f) => f.endsWith('.json'))
  files.forEach((file) => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(NICHE_DIR, file), 'utf-8'))
      const records = Array.isArray(content) ? content : [content]
      records.forEach((rec: any) => {
        if (rec && rec.username) {
          const count = rec.followerCount ?? rec.followersCount ?? rec.followers
          if (typeof count === 'number' && Number.isFinite(count)) {
            followerMap[normalizeHandle(String(rec.username))] = count
          }
        }
      })
    } catch (e) {
      console.warn(`  ⚠️  falha ao ler ${file}, ignorado: ${(e as Error).message}`)
    }
  })
} else {
  console.warn(`  ⚠️  pasta do niche scraper não encontrada em ${NICHE_DIR} — followerMap ficará vazio, nada será injetado.`)
}

console.log(`📊 Mapeados ${Object.keys(followerMap).length} perfis com seguidores reais.`)

// 2. Injetar followers_count (nome que compute.ts realmente lê) no manifest.json
if (fs.existsSync(MANIFEST_PATH)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    let alterados = 0
    const semMatch: string[] = []

    manifest.forEach((account: any) => {
      const rawHandle = account.handle ?? account.username
      if (!rawHandle) return
      const key = normalizeHandle(String(rawHandle))
      const count = followerMap[key]
      if (count !== undefined) {
        // followers_count é o campo que compute.ts (L1AccountMinimal) lê de
        // fato — ver `const targetFollowers = acc.followers_count ?? null`.
        account.followers_count = count
        // Mantidos como extras informativos — não são lidos por compute.ts,
        // só aqui pra rastreabilidade/depuração futura.
        account.followersCount = count
        account.followers = count
        alterados++
      } else {
        semMatch.push(rawHandle)
      }
    })

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')
    console.log(`✅ Sucesso! Injetados seguidores (followers_count) em ${alterados} contas no manifest.json.`)

    if (semMatch.length > 0) {
      console.log(`\n⚠️  ${semMatch.length} conta(s) do manifesto sem correspondência no niche scraper:`)
      console.log(`   → ${semMatch.join(', ')}`)
      console.log(`   Verifique se o handle no manifest.json bate com o campo "username" nos arquivos de ${NICHE_DIR}`)
      console.log(`   (comparação já normalizada — minúsculas, sem @, sem URL — então a causa provável é a conta`)
      console.log(`   simplesmente não estar entre os perfis raspados pelo niche scraper ainda).`)
    }
  } catch (err) {
    console.error('❌ Erro ao processar o arquivo manifest.json:', err)
    process.exit(1)
  }
} else {
  console.error(`❌ Manifesto não encontrado em ${MANIFEST_PATH}. Rode ingest.ts (ou a variante de benchmark) primeiro — este script não inventa um manifesto novo a partir só do niche scraper.`)
  process.exit(1)
}
