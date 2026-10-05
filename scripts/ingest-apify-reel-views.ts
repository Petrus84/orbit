// ingest-apify-reel-views.ts — orbit v1.0.0
// Preenche orbit.ig_posts.reel_plays / reel_views VAZIOS a partir de um dataset
// do Apify (instagram-scraper). Casa por (client_id, ig_shortcode).
//
// Regras:
//  - NUNCA sobrescreve valor já preenchido (só null -> valor).
//  - NUNCA insere post novo; posts do dataset sem correspondente vão para o relatório.
//  - Dry-run por padrão. Só grava com --apply.
//  - Só processa os handles passados em --handles (ou todos do arquivo se omitido).
//
// Uso:
//   npx tsx scripts/ingest-apify-reel-views.ts --file apify-split/cpimportstore.json --handles cpimportstore
//   npx tsx scripts/ingest-apify-reel-views.ts --file apify-split/cpimportstore.json --handles cpimportstore --apply
//
// Handle diferente entre o Apify e o banco (ex.: arquivo = mauriciogomes.artphoto, banco = mauricioartphoto):
//   --handles mauriciogomes.artphoto --alias=mauriciogomes.artphoto=mauricioartphoto
//   (--handles usa o nome do ARQUIVO; o alias traduz para o nome do BANCO)
//
// Posts do banco sem ig_shortcode (vindos do export do Instagram): casar por data, 1-para-1:
//   --match=date [--tol=5] [--backfill-shortcode]
//
// Mapeamento Apify -> banco:
//   videoViewCount -> reel_views
//   videoPlayCount -> reel_plays
//   (só para type === 'Video'; imagens/carrosséis não têm view/play)

import dotenv from 'dotenv'
import * as fs from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { resolveClientId } from './lib/resolveClientId'

dotenv.config({ path: '.env.local' })

function argVal(flag: string): string | undefined {
  const eq = process.argv.find(a => a.startsWith(`--${flag}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const idx = process.argv.indexOf(`--${flag}`)
  const next = process.argv[idx + 1]
  if (idx >= 0 && next && !next.startsWith('--')) return next
  return undefined
}

const FILE = argVal('file')
const HANDLES = (argVal('handles') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const APPLY = process.argv.includes('--apply')
// reel_views NÃO é gravado por padrão (plano C3: "ratio é cálculo, não coluna; não criar reel_views").
// Só use --write-views se a coluna já existir no banco.
const WRITE_VIEWS = process.argv.includes('--write-views')
// --match=date: casa por timestamp quando o post no banco não tem ig_shortcode (posts vindos do export do Instagram).
// Regras: só vídeo/reel; janela de ±TOL segundos (padrão 5); precisa ser 1-para-1 (sem ambiguidade).
const MATCH_DATE = (argVal('match') ?? '') === 'date'
const TOL_SECONDS = Number(argVal('tol') ?? '5')
// --backfill-shortcode: além de reel_plays, grava ig_shortcode no post casado por data (opt-in).
const BACKFILL_SHORTCODE = process.argv.includes('--backfill-shortcode')
// --alias=<handle_no_arquivo>=<handle_no_banco>  (repetível: --alias=a=b --alias=c=d)
const ALIASES = new Map<string, string>(
  process.argv
    .filter(a => a.startsWith('--alias='))
    .map(a => a.slice('--alias='.length).split('='))
    .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1])
    .map(([from, to]) => [from, to] as [string, string])
)

if (!FILE || !fs.existsSync(FILE)) {
  console.error('❌ --file=<dataset.json> é obrigatório e precisa existir')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ApifyItem {
  ownerUsername?: string
  shortCode?: string
  type?: string
  timestamp?: string
  videoViewCount?: number | null
  videoPlayCount?: number | null
}
interface DbRow {
  id: string
  ig_shortcode: string | null
  published_at?: string | null
  content_format?: string | null
  reel_plays: number | null
  reel_views?: number | null
}

function nonNegInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null
}

async function loadDbRows(clientId: string): Promise<DbRow[]> {
  const rows: DbRow[] = []
  const pageSize = 1000
  const cols = ['id', 'ig_shortcode', 'published_at', 'content_format', 'reel_plays']
  if (WRITE_VIEWS) cols.push('reel_views')
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.schema('orbit').from('ig_posts')
      .select(cols.join(', '))
      .eq('client_id', clientId)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`leitura ig_posts: ${error.message}`)
    rows.push(...((data ?? []) as unknown as DbRow[]))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log('🔄 ORBIT · Apify reel views — v1.0.0')
  console.log(`📦 Arquivo: ${FILE}`)
  console.log(`${APPLY ? '💾 APPLY (grava)' : '🧪 DRY RUN (nada é gravado)'}`)
  console.log('═══════════════════════════════════════════════════════')

  const items = JSON.parse(fs.readFileSync(FILE!, 'utf-8')) as ApifyItem[]
  const byHandle = new Map<string, ApifyItem[]>()
  for (const it of items) {
    if (!it.ownerUsername || !it.shortCode) continue
    const list = byHandle.get(it.ownerUsername) ?? []
    list.push(it)
    byHandle.set(it.ownerUsername, list)
  }

  const targets = HANDLES.length > 0 ? HANDLES : [...byHandle.keys()]
  let totalUpdated = 0
  let totalErrors = 0

  for (const handle of targets) {
    const list = byHandle.get(handle)
    console.log(`\n── @${handle} ──`)
    if (!list) {
      console.warn('   ⚠️  handle ausente no arquivo — pulado')
      console.warn(`      handles que existem no arquivo (campo ownerUsername): ${[...byHandle.keys()].join(', ') || '(nenhum)'}`)
      console.warn('      --handles usa o nome DENTRO do arquivo, não o nome do arquivo em disco.')
      continue
    }

    let clientId: string
    const dbHandle = ALIASES.get(handle) ?? handle
    if (dbHandle !== handle) console.log(`   ↪ alias: arquivo "${handle}" → banco "${dbHandle}"`)
    try { clientId = await resolveClientId(supabase, dbHandle) }
    catch (e) { console.error(`   ❌ ${(e as Error).message} — pulado`); totalErrors++; continue }

    const dbRows = await loadDbRows(clientId)
    const byShortcode = new Map<string, DbRow>()
    for (const r of dbRows) if (r.ig_shortcode) byShortcode.set(r.ig_shortcode, r)
    const dateCandidates = dbRows.filter(r => !r.ig_shortcode && r.content_format === 'reel' && r.published_at)

    const videos = list.filter(i => i.type === 'Video')
    let toUpdate = 0, alreadyFilled = 0, notInDb = 0, noMetric = 0, ambiguous = 0, updated = 0, errors = 0
    const missing: string[] = []
    const claimed = new Set<string>()

    for (const v of videos) {
      let row: DbRow | undefined = byShortcode.get(v.shortCode!)
      let how = 'shortcode'

      if (!row && MATCH_DATE && v.timestamp) {
        const t = new Date(v.timestamp).getTime()
        const cands = dateCandidates.filter(r =>
          Math.abs(new Date(r.published_at!).getTime() - t) <= TOL_SECONDS * 1000)
        if (cands.length === 1 && !claimed.has(cands[0]!.id)) { row = cands[0]; how = 'data' }
        else if (cands.length > 1 || (cands.length === 1 && claimed.has(cands[0]!.id))) {
          ambiguous++
          console.warn(`   ⚠️  ${v.shortCode} ambíguo por data (${cands.length} candidatos) — pulado`)
          continue
        }
      }
      if (!row) { notInDb++; missing.push(v.shortCode!); continue }
      claimed.add(row.id)

      const views = nonNegInt(v.videoViewCount)
      const plays = nonNegInt(v.videoPlayCount)
      const patch: { reel_views?: number; reel_plays?: number; ig_shortcode?: string } = {}
      if (WRITE_VIEWS && row.reel_views === null && views !== null) patch.reel_views = views
      if (row.reel_plays === null && plays !== null) patch.reel_plays = plays
      if (BACKFILL_SHORTCODE && how === 'data' && Object.keys(patch).length > 0) patch.ig_shortcode = v.shortCode!

      if (Object.keys(patch).length === 0) {
        if (views === null && plays === null) noMetric++
        else alreadyFilled++
        continue
      }
      toUpdate++
      console.log(`   ${APPLY ? '✏️ ' : '·'} ${v.shortCode} [${how}] ${row.published_at ?? ''} ${JSON.stringify(patch)}`)
      if (APPLY) {
        const { error } = await supabase.schema('orbit').from('ig_posts')
          .update(patch).eq('id', row.id).eq('client_id', clientId)
        if (error) { console.error(`      ❌ ${v.shortCode}: ${error.message}`); errors++ }
        else updated++
      }
    }

    console.log(`   vídeos no arquivo=${videos.length} | a preencher=${toUpdate} | já preenchidos=${alreadyFilled} | sem métrica no Apify=${noMetric} | sem post no banco=${notInDb} | ambíguos=${ambiguous}`)
    if (missing.length > 0) console.log(`   sem post no banco (não inserido): ${missing.join(', ')}`)
    if (APPLY) console.log(`   ✅ atualizados=${updated} erros=${errors}`)
    totalUpdated += updated
    totalErrors += errors
  }

  console.log(`\n🏁 ${APPLY ? `atualizados=${totalUpdated}` : 'dry-run concluído'} erros=${totalErrors}`)
  if (totalErrors > 0) process.exit(1)
}

run().catch((err: unknown) => {
  console.error('❌ Erro:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
