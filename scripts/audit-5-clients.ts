import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CLIENTS: Record<string, string> = {
  cpimportstore: '2141d077-0d82-4fda-83df-558377f105ff',
  eupetruchio84: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
  mauricioartphoto: '344445c9-08c5-4c07-be1b-c9f8f8e12865',
  djcaiodogao: 'c2779193-d3a0-4fc7-b392-ad64fea4273f',
  dogativo: 'e45927a7-4f3d-4fd3-bac7-543cc3545dc1',
}

// orbit.confidence_level = ENUM('L0','L1','L2') — os 3 valores têm que ser
// contabilizados, senão l0%+l1% pode não somar 100% sem que ninguém note.
type ConfidenceLevel = 'L0' | 'L1' | 'L2'

interface IgPostRow {
  id: string
  published_at: string
  content_format: string
  caption: string | null
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  confidence_level: ConfidenceLevel
  is_boost_candidate: boolean
  boost_conditions_met: number
  er_real_pct: number | null
  polemic_score_pct: number | null
  utility_score_pct: number | null
}

interface PostStats {
  total: number
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  l0: number
  l1: number
  l2: number
  boostCandidates: number
  negativeMetrics: number // reach/impressions < 0 — sem constraint no banco
  inconsistentConfidence: number // confidence_level != L0 mas reach = NULL
  avgReach: number | null
  avgErRealPct: number | null
  avgUtilityScorePct: number | null
}

// Shape exato produzido em `postsWithoutReach` (ver auditClients()).
// caption é sempre string aqui porque `p.caption?.substring(0, 40) || '(vazio)'`
// nunca resulta em null/undefined.
interface PostSampleWithoutReach {
  published_at: string
  content_format: string
  caption: string
  confidence_level: ConfidenceLevel
}

// Shape exato produzido em `postsWithReach` (ver auditClients()).
interface PostSampleWithReach {
  published_at: string
  content_format: string
  reach: number | null
  impressions: number | null
  likes: number | null
  confidence_level: ConfidenceLevel
}

interface ClientAudit {
  clientId: string
  clientName: string
  stats: PostStats
  byFormat: Record<string, PostStats>
  samplePostsWithoutReach: PostSampleWithoutReach[]
  samplePostsWithReach: PostSampleWithReach[]
  truncated: boolean // veio mais que o total real reportado pelo count exato?
}

const PAGE_SIZE = 1000

/* ── Busca paginada (evita truncamento silencioso do limite de 1000) ────── */
async function fetchAllPosts(clientId: string): Promise<{ posts: IgPostRow[]; truncated: boolean }> {
  // 1. Pega o total real primeiro, sem baixar os dados
  const { count, error: countError } = await supabase
    .schema('orbit')
    .from('ig_posts')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if (countError) {
    console.error(`❌ Erro ao contar posts: ${countError.message}`)
    return { posts: [], truncated: false }
  }

  const totalExpected = count ?? 0
  const posts: IgPostRow[] = []
  let from = 0

  while (posts.length < totalExpected) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .schema('orbit')
      .from('ig_posts')
      .select(
        'id, published_at, content_format, caption, reach, impressions, likes, comments, shares, saves, confidence_level, is_boost_candidate, boost_conditions_met, er_real_pct, polemic_score_pct, utility_score_pct'
      )
      .eq('client_id', clientId)
      .range(from, to)

    if (error) {
      console.error(`❌ Erro ao buscar página [${from}-${to}]: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break

    posts.push(...(data as IgPostRow[]))
    from += PAGE_SIZE
  }

  return { posts, truncated: posts.length !== totalExpected }
}

function emptyStats(): PostStats {
  return {
    total: 0,
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    l0: 0,
    l1: 0,
    l2: 0,
    boostCandidates: 0,
    negativeMetrics: 0,
    inconsistentConfidence: 0,
    avgReach: null,
    avgErRealPct: null,
    avgUtilityScorePct: null,
  }
}

function accumulate(stats: PostStats, post: IgPostRow): void {
  stats.total++
  // != null (não !==) cobre null E undefined de uma vez
  if (post.reach != null) stats.reach++
  if (post.impressions != null) stats.impressions++
  if (post.likes != null) stats.likes++
  if (post.comments != null) stats.comments++
  if (post.shares != null) stats.shares++
  if (post.saves != null) stats.saves++

  if (post.confidence_level === 'L0') stats.l0++
  else if (post.confidence_level === 'L1') stats.l1++
  else if (post.confidence_level === 'L2') stats.l2++

  if (post.is_boost_candidate) stats.boostCandidates++

  if ((post.reach != null && post.reach < 0) || (post.impressions != null && post.impressions < 0)) {
    stats.negativeMetrics++
  }

  // orbit.ig_posts_non_neg não cobre reach/impressions — checagem própria.
  // Inconsistência de dado: confidence_level indica "com dados" mas reach
  // está ausente. Sinaliza post que precisa ser reprocessado/reingerido.
  if (post.confidence_level !== 'L0' && post.reach == null) {
    stats.inconsistentConfidence++
  }
}

function finalizeAverages(stats: PostStats, posts: IgPostRow[]): void {
  const withReach = posts.filter(p => p.reach != null)
  const withEr = posts.filter(p => p.er_real_pct != null)
  const withUtility = posts.filter(p => p.utility_score_pct != null)

  stats.avgReach =
    withReach.length > 0
      ? Math.round(withReach.reduce((s, p) => s + (p.reach ?? 0), 0) / withReach.length)
      : null
  stats.avgErRealPct =
    withEr.length > 0
      ? Number((withEr.reduce((s, p) => s + (p.er_real_pct ?? 0), 0) / withEr.length).toFixed(2))
      : null
  stats.avgUtilityScorePct =
    withUtility.length > 0
      ? Number((withUtility.reduce((s, p) => s + (p.utility_score_pct ?? 0), 0) / withUtility.length).toFixed(2))
      : null
}

/* ── Auditoria Principal ───────────────────────────────────────────────── */
async function auditClients(): Promise<ClientAudit[]> {
  const results: ClientAudit[] = []

  for (const [clientName, clientId] of Object.entries(CLIENTS)) {
    console.log(`\n⏳ Auditando ${clientName}...`)

    const { posts, truncated } = await fetchAllPosts(clientId)

    if (posts.length === 0) {
      console.log(`⚠️  ${clientName}: Nenhum post encontrado`)
      continue
    }
    if (truncated) {
      console.log(`🔴 ${clientName}: PAGINAÇÃO INCOMPLETA — dado parcial, revisar manualmente`)
    }

    const stats = emptyStats()
    const byFormat: Record<string, PostStats> = {}

    for (const post of posts) {
      accumulate(stats, post)
      const fmt = post.content_format
      // ✅ FIX (TS2345, noUncheckedIndexedAccess): capturar numa constante
      // local em vez de reacessar byFormat[fmt] na linha seguinte — o TS não
      // "lembra" que a atribuição condicional acima garante que a chave
      // existe; leitura por índice volta a ser `PostStats | undefined`.
      const fmtStats = byFormat[fmt] ?? (byFormat[fmt] = emptyStats())
      accumulate(fmtStats, post)
    }

    finalizeAverages(stats, posts)
    for (const fmt of Object.keys(byFormat)) {
      // ✅ Mesmo padrão aqui: byFormat[fmt] dentro do loop também é
      // `PostStats | undefined` para o TS, mesmo vindo de Object.keys deste
      // mesmo objeto.
      const fmtStats = byFormat[fmt]
      if (!fmtStats) continue
      finalizeAverages(fmtStats, posts.filter(p => p.content_format === fmt))
    }

    const postsWithoutReach: PostSampleWithoutReach[] = posts
      .filter(p => p.reach == null)
      .slice(0, 3)
      .map(p => ({
        published_at: p.published_at,
        content_format: p.content_format,
        caption: p.caption?.substring(0, 40) || '(vazio)',
        confidence_level: p.confidence_level,
      }))

    const postsWithReach: PostSampleWithReach[] = posts
      .filter(p => p.reach != null)
      .slice(0, 3)
      .map(p => ({
        published_at: p.published_at,
        content_format: p.content_format,
        reach: p.reach,
        impressions: p.impressions,
        likes: p.likes,
        confidence_level: p.confidence_level,
      }))

    results.push({
      clientId,
      clientName,
      stats,
      byFormat,
      samplePostsWithoutReach: postsWithoutReach,
      samplePostsWithReach: postsWithReach,
      truncated,
    })
  }

  return results
}

/* ── Exibir Relatório ─────────────────────────────────────────────────── */
function pct(n: number, total: number): string {
  return total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
}

function printReport(audits: ClientAudit[]): void {
  console.log('\n\n═══════════════════════════════════════════════════════════════════')
  console.log('🔬 AUDITORIA: 5 CLIENTES (v2 — schema-aware)')
  console.log('═══════════════════════════════════════════════════════════════════')

  for (const audit of audits) {
    const { clientName, stats, byFormat, samplePostsWithoutReach, samplePostsWithReach, truncated } = audit

    console.log(`\n\n📊 ${clientName.toUpperCase()}${truncated ? '  ⚠️ DADO TRUNCADO' : ''}`)
    console.log('─'.repeat(65))

    console.log(`\n📈 GERAL:`)
    console.log(`   Total de posts: ${stats.total}`)
    console.log(`   ├─ L0 (sem dados): ${stats.l0} (${pct(stats.l0, stats.total)}%)`)
    console.log(`   ├─ L1 (com dados): ${stats.l1} (${pct(stats.l1, stats.total)}%)`)
    console.log(`   └─ L2 (raciocínio/estimado): ${stats.l2} (${pct(stats.l2, stats.total)}%)`)

    const somaConfianca = stats.l0 + stats.l1 + stats.l2
    if (somaConfianca !== stats.total) {
      console.log(`   🔴 INCONSISTÊNCIA: L0+L1+L2 (${somaConfianca}) ≠ total (${stats.total})`)
    }

    console.log(`\n📊 COBERTURA DE MÉTRICAS:`)
    console.log(`   ├─ reach:       ${stats.reach}/${stats.total} (${pct(stats.reach, stats.total)}%)`)
    console.log(`   ├─ impressions: ${stats.impressions}/${stats.total} (${pct(stats.impressions, stats.total)}%)`)
    console.log(`   ├─ likes:       ${stats.likes}/${stats.total} (${pct(stats.likes, stats.total)}%)`)
    console.log(`   ├─ comments:    ${stats.comments}/${stats.total} (${pct(stats.comments, stats.total)}%)`)
    console.log(`   ├─ shares:      ${stats.shares}/${stats.total} (${pct(stats.shares, stats.total)}%)`)
    console.log(`   └─ saves:       ${stats.saves}/${stats.total} (${pct(stats.saves, stats.total)}%)`)

    console.log(`\n🚩 QUALIDADE DE DADO:`)
    console.log(`   Métricas negativas (reach/impressions < 0): ${stats.negativeMetrics}`)
    console.log(`   confidence≠L0 mas reach ausente (inconsistente): ${stats.inconsistentConfidence}`)

    console.log(`\n💰 SINAIS DE NEGÓCIO:`)
    console.log(`   Boost candidates: ${stats.boostCandidates}`)
    console.log(`   Reach médio: ${stats.avgReach ?? 'N/A'}`)
    console.log(`   ER real médio: ${stats.avgErRealPct ?? 'N/A'}%`)
    console.log(`   Utility score médio: ${stats.avgUtilityScorePct ?? 'N/A'}%`)

    console.log(`\n📱 POR FORMATO:`)
    for (const [format, fstats] of Object.entries(byFormat)) {
      console.log(`   ${format}:`)
      console.log(
        `      Posts: ${fstats.total} | L0:${fstats.l0} L1:${fstats.l1} L2:${fstats.l2} | Reach médio: ${fstats.avgReach ?? 'N/A'}`
      )
    }

    if (samplePostsWithReach.length > 0) {
      console.log(`\n✅ EXEMPLOS COM DADOS (reach ≠ NULL):`)
      for (const post of samplePostsWithReach) {
        console.log(`   📅 ${post.published_at} | ${post.content_format}`)
        console.log(`      Reach: ${post.reach} | Impressions: ${post.impressions} | Likes: ${post.likes}`)
      }
    }

    if (samplePostsWithoutReach.length > 0) {
      console.log(`\n❌ EXEMPLOS SEM DADOS (reach = NULL):`)
      for (const post of samplePostsWithoutReach) {
        console.log(`   📅 ${post.published_at} | ${post.content_format} | ${post.confidence_level}`)
        console.log(`      Caption: ${post.caption}`)
      }
    }
  }

  // Resumo comparativo
  console.log(`\n\n═══════════════════════════════════════════════════════════════════`)
  console.log('📊 RESUMO COMPARATIVO')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(
    `\n${'Cliente'.padEnd(20)} ${'Posts'.padEnd(8)} ${'L1%'.padEnd(8)} ${'Reach%'.padEnd(8)} ${'Inconsist.'.padEnd(11)} ${'Status'}`
  )
  console.log('─'.repeat(75))

  for (const audit of audits) {
    const { clientName, stats, truncated } = audit
    const status =
      truncated ? '🔴 TRUNCADO' :
      stats.inconsistentConfidence > 0 ? '⚠️  INCONSISTENTE' :
      stats.l1 + stats.l2 === stats.total ? '✅ OK' :
      stats.l1 + stats.l2 === 0 ? '❌ SEM DADOS' : '⚠️  PARCIAL'

    console.log(
      `${clientName.padEnd(20)} ${stats.total.toString().padEnd(8)} ${pct(stats.l1, stats.total).padEnd(8)} ${pct(stats.reach, stats.total).padEnd(8)} ${stats.inconsistentConfidence.toString().padEnd(11)} ${status}`
    )
  }

  // Recomendações acionáveis
  console.log(`\n\n═══════════════════════════════════════════════════════════════════`)
  console.log('✅ RECOMENDAÇÕES ACIONÁVEIS')
  console.log('═══════════════════════════════════════════════════════════════════')
  for (const audit of audits) {
    const { clientName, stats, truncated } = audit
    const actions: string[] = []
    if (truncated) actions.push('Paginação incompleta — rodar de novo / investigar timeout')
    if (stats.inconsistentConfidence > 0)
      actions.push(`Reprocessar ${stats.inconsistentConfidence} posts com confidence_level≠L0 e reach nulo`)
    if (stats.negativeMetrics > 0)
      actions.push(`Investigar ${stats.negativeMetrics} posts com reach/impressions negativo (falha de ingestão)`)
    if (stats.l0 === stats.total)
      actions.push('100% dos posts em L0 — pipeline de métricas não está rodando para este cliente')
    if (actions.length > 0) {
      console.log(`\n${clientName}:`)
      actions.forEach(a => console.log(`   → ${a}`))
    }
  }
}

/* ── Exportar para JSON ───────────────────────────────────────────────── */
function exportJSON(audits: ClientAudit[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    clients: audits.map(a => ({
      name: a.clientName,
      id: a.clientId,
      truncated: a.truncated,
      stats: a.stats,
      byFormat: a.byFormat,
      samples: {
        withReach: a.samplePostsWithReach,
        withoutReach: a.samplePostsWithoutReach,
      },
    })),
  }

  console.log(`\n\n📄 Exportando para audit-report.json...`)
  fs.writeFileSync('audit-report.json', JSON.stringify(output, null, 2))
  console.log(`✅ Relatório salvo em audit-report.json`)
}

/* ── Main ─────────────────────────────────────────────────────────────── */
async function main() {
  try {
    const audits = await auditClients()
    printReport(audits)
    exportJSON(audits)
  } catch (err) {
    console.error('❌ Erro:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()