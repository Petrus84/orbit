/**
 * compute-real-correlations.ts
 * ============================================================================
 * Lê o manifesto gerado por ingest-benchmark-pilot.ts e calcula a correlação
 * de Pearson REAL entre as métricas que o Apify de fato entrega
 * (likes, comments, views, plays) para comparar contra a "Matriz de
 * Correlação: Métricas de Instagram (Teórica)" simulada.
 *
 * Limitação honesta: Apify não entrega impressões, alcance, nem CTR de bio.
 * Não vou inventar essas colunas aqui — a matriz real só cobre o que foi
 * de fato medido. Se algo do que a matriz teórica cobria não aparece
 * abaixo, é porque não é mensurável com este scraper, não porque foi
 * esquecido.
 *
 * Uso: npx tsx compute-real-correlations.ts
 * ============================================================================
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

interface CleanPost {
  short_code: string
  likes: number | null
  comments: number | null
  video_view_count: number | null
  video_play_count: number | null
}

// nicho e setor_benchmark_key são opcionais e mutuamente supletivos —
// achado real: existem 3 scripts de ingestão paralelos com schemas
// ligeiramente diferentes (ingest-benchmark-pilot.ts usa `nicho`,
// ingest.ts/v2 usa `setor_benchmark_key`). O manifest.json realmente em
// disco nesta rodada foi produzido pela variante `nicho`. Ler só um dos
// dois campos, como o código original fazia (só `nicho`), quebra
// silenciosamente (undefined vira uma única categoria "undefined" no
// agrupamento) no dia em que o manifesto vier do outro script.
interface AccountResult {
  handle: string
  nicho?: string
  setor_benchmark_key?: string
  diagnosis_tier: 'insuficiente' | 'leve' | 'completo'
  posts: CleanPost[]
}

function setorOf(a: AccountResult): string {
  return a.setor_benchmark_key ?? a.nicho ?? 'desconhecido'
}

// Resolução por candidatos, mesmo raciocínio de compute.ts: o manifesto
// real desta rodada está em data/l0_exports/manifest.json (produzido pelo
// script de benchmark), não em data/benchmark/manifest.json (o OUTPUT_DIR
// hardcoded em ingest.ts/ingest-benchmark-pilot.ts). MANIFEST_PATH explícito
// via env sempre vence.
function resolveManifestPath(): string {
  if (process.env.MANIFEST_PATH) return process.env.MANIFEST_PATH
  const candidates = [
    path.join(process.cwd(), 'data', 'l0_exports', 'manifest.json'),
    path.join(process.cwd(), 'data', 'benchmark', 'manifest.json'),
  ]
  return candidates.find((c) => existsSync(c)) ?? candidates[0]
}

const MANIFEST_PATH = resolveManifestPath()
const CORRELATIONS_OUTPUT_PATH = path.join(process.cwd(), 'data', 'benchmark', 'correlations_by_nicho.json')

const METRICS = ['likes', 'comments', 'video_view_count', 'video_play_count'] as const
type Metric = (typeof METRICS)[number]

function pearson(x: number[], y: number[]): number | null {
  const n = x.length
  if (n < 3) return null // amostra pequena demais pra correlação ter sentido

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  const den = Math.sqrt(denX * denY)
  if (den === 0) return null
  return num / den
}

function buildMatrix(posts: CleanPost[]) {
  // filtra só posts com os 4 campos preenchidos (não-null) para pares justos
  const rows = posts.filter((p) =>
    METRICS.every((m) => p[m] !== null && p[m] !== undefined)
  )

  const matrix: Record<Metric, Record<Metric, number | null>> = {} as any
  for (const m1 of METRICS) {
    matrix[m1] = {} as any
    for (const m2 of METRICS) {
      const x = rows.map((r) => r[m1] as number)
      const y = rows.map((r) => r[m2] as number)
      matrix[m1][m2] = m1 === m2 ? 1 : pearson(x, y)
    }
  }
  return { matrix, n: rows.length }
}

function printMatrix(title: string, matrix: Record<Metric, Record<Metric, number | null>>, n: number) {
  console.log(`\n=== ${title} (N=${n}) ===`)
  const header = ['', ...METRICS].join('\t')
  console.log(header)
  for (const m1 of METRICS) {
    const row = [m1, ...METRICS.map((m2) => {
      const v = matrix[m1][m2]
      return v === null ? 'N/A' : v.toFixed(2)
    })]
    console.log(row.join('\t'))
  }
}

function main() {
  let manifest: AccountResult[]
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  } catch {
    console.error(`❌ Manifesto não encontrado em ${MANIFEST_PATH}. Rode ingest-benchmark-pilot.ts primeiro.`)
    process.exit(1)
  }

  const validAccounts = manifest.filter((a) => a.diagnosis_tier !== 'insuficiente')
  if (validAccounts.length === 0) {
    console.error('❌ Nenhuma conta com amostra suficiente no piloto. Nada a calcular.')
    process.exit(1)
  }

  // Correlação geral (todas as contas, todos os nichos)
  const allPosts = validAccounts.flatMap((a) => a.posts)
  const { matrix: globalMatrix, n: globalN } = buildMatrix(allPosts)
  printMatrix('Correlação real — geral (todos os nichos)', globalMatrix, globalN)

  // Correlação por nicho — a matriz teórica de ontem tratava "Instagram"
  // como um bloco único; correlação real provavelmente difere por nicho
  // (e-commerce catálogo vs. creator pessoal têm dinâmicas diferentes)
  const nichos = [...new Set(validAccounts.map((a) => setorOf(a)))]
  const byNicho: Record<string, { matrix: Record<Metric, Record<Metric, number | null>>; n: number }> = {}
  for (const nicho of nichos) {
    const posts = validAccounts.filter((a) => setorOf(a) === nicho).flatMap((a) => a.posts)
    const { matrix, n } = buildMatrix(posts)
    printMatrix(`Correlação real — ${nicho}`, matrix, n)
    byNicho[nicho] = { matrix, n }
  }

  // Salva o resultado por nicho em disco — populate-metric-methodologies.ts
  // lê este arquivo na próxima execução em vez de recalcular ou (pior)
  // usar números teóricos.
  mkdirSync(path.dirname(CORRELATIONS_OUTPUT_PATH), { recursive: true })
  writeFileSync(
    CORRELATIONS_OUTPUT_PATH,
    JSON.stringify({ generated_at: new Date().toISOString(), global: { matrix: globalMatrix, n: globalN }, by_nicho: byNicho }, null, 2),
    'utf-8'
  )
  console.log(`\n✓ Correlações por nicho salvas em: ${CORRELATIONS_OUTPUT_PATH}`)
  console.log(`  populate-metric-methodologies.ts lê este arquivo automaticamente na próxima execução.`)

  console.log(`\n=== Comparação direta com a matriz "Teórica" de ontem ===`)
  console.log(`Teórica: Cliques↔Conversão = 0.80 | Alcance↔Visitas = 0.92 | CTR↔Conversão = 0.88`)
  console.log(`Real: essas 3 relações não são calculáveis aqui — Apify não entrega`)
  console.log(`alcance, visitas de perfil, CTR de bio nem conversão. A matriz real`)
  console.log(`acima só cobre likes/comments/views/plays — que é o que de fato temos.`)
  console.log(`Isso por si só é um achado: 3 das relações mais citadas ontem dependem`)
  console.log(`de dado que nenhum scraper público entrega — só Meta Insights (L0,`)
  console.log(`conta própria) ou GA4/UTM do cliente.`)
}

main()
