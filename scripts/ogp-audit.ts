// scripts/ogp-audit.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// Resolve o .env.local relativo a este arquivo (raiz do projeto), não ao cwd
// de onde o comando é executado — antes, rodar de dentro de scripts/ fazia
// procurar scripts/.env.local e carregava 0 variáveis.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '❌ NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY não encontrados. Verifique o .env.local na raiz do projeto.'
  )
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PAGE_SIZE = 1000

/** Mapa operacional conhecido. O script também descobre clients que existem no banco e não estão aqui. */
const KNOWN_CLIENTS: Record<string, string> = {
  cpimportstore: '2141d077-0d82-4fda-83df-558377f105ff',
  eupetruchio84: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
  mauricioartphoto: '344445c9-08c5-4c07-be1b-c9f8f8e12865',
  djcaiodogao: 'c2779193-d3a0-4fc7-b392-ad64fea4273f',
  dogativo: 'e45927a7-4f3d-4fd3-bac7-543cc3545dc1',
}

type Gate = 'A_SCHEMA' | 'B_EMPTY' | 'C_HOLD_INGEST' | 'RWP'
type Screen = 'instagram' | 'avatar' | 'alertas' | 'carteira' | 'funil'

interface FactSpec {
  screen: Screen
  table: string
  requiredForReady: boolean
  note: string
}

const FACT_CATALOG: FactSpec[] = [
  { screen: 'carteira', table: 'clients', requiredForReady: true, note: 'cliente existe' },
  { screen: 'carteira', table: 'client_onboarding', requiredForReady: false, note: 'onboarding 1:1' },
  { screen: 'instagram', table: 'ig_account_snapshots', requiredForReady: true, note: 'KPI followers/reach/ER' },
  { screen: 'instagram', table: 'ig_posts', requiredForReady: false, note: 'grade de conteúdo' },
  { screen: 'instagram', table: 'ig_import_sessions', requiredForReady: false, note: 'vigência da ingestão' },
  { screen: 'avatar', table: 'ig_audience_snapshots', requiredForReady: true, note: 'audiência observada' },
  { screen: 'avatar', table: 'avatar_alignment_snapshot', requiredForReady: false, note: 'score vs esperado' },
  { screen: 'avatar', table: 'avatar_validations', requiredForReady: false, note: 'validação humana' },
  { screen: 'alertas', table: 'alerts', requiredForReady: false, note: 'empty é produto' },
  { screen: 'funil', table: 'funnel_data', requiredForReady: true, note: 'alcance→visita→clique→venda' },
  { screen: 'instagram', table: 'raw_ig_ingest', requiredForReady: false, note: 'pipeline bruto' },
]

type Row = Record<string, unknown>

type CountResult = { count: number; error: string | null }

async function countExactAll(table: string, clientId?: string): Promise<CountResult> {
  let q = supabase
    .schema('orbit')
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (clientId) {
    q = q.eq('client_id', clientId)
  }

  const { count, error } = await q

  if (error) return { count: -1, error: error.message }
  return { count: count ?? 0, error: null }
}


// ✅ CORRETO (Opção 3: Type guard se precisar de unknown)
async function countExactWhere(
  table: string,
  clientId: string,
  whereField: string,
  whereValue: unknown
): Promise<CountResult> {
  // Validar que whereValue é um tipo permitido
  if (typeof whereValue !== 'string' && typeof whereValue !== 'number' && typeof whereValue !== 'boolean') {
    return { count: -1, error: 'whereValue deve ser string, number ou boolean' }
  }

  const q = supabase
    .schema('orbit')
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq(whereField, whereValue)  // ✅ Agora é tipado corretamente

  const { count, error } = await q
  if (error) return { count: -1, error: error.message }
  return { count: count ?? 0, error: null }
}

async function fetchAll(
  table: string,
  columns: string,
  clientId: string,
  orderBy?: string
): Promise<{ rows: Row[]; truncated: boolean; error: string | null }> {
  const { count, error: countError } = await supabase
    .schema('orbit')
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if (countError) return { rows: [], truncated: false, error: countError.message }

  const totalExpected = count ?? 0
  const rows: Row[] = []
  let from = 0

  while (rows.length < totalExpected) {
    let q = supabase
      .schema('orbit')
      .from(table)
      .select(columns)
      .eq('client_id', clientId)
      .range(from, from + PAGE_SIZE - 1)

    if (orderBy) q = q.order(orderBy, { ascending: false })

    const { data, error } = await q
    if (error) return { rows, truncated: true, error: error.message }
    if (!data?.length) break

    rows.push(...(data as unknown as Row[]))
    from += PAGE_SIZE
  }

  return { rows, truncated: rows.length !== totalExpected, error: null }
}

function gateOf(opts: {
  schemaOk: boolean
  ingestFailed: boolean
  readyFactsPresent: boolean
  emptyAllowed: boolean
}): Gate {
  if (!opts.schemaOk) return 'A_SCHEMA'
  if (opts.ingestFailed && !opts.readyFactsPresent) return 'C_HOLD_INGEST'
  if (!opts.readyFactsPresent) return opts.emptyAllowed ? 'B_EMPTY' : 'C_HOLD_INGEST'
  return 'RWP'
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' ? v : null
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

async function main() {
  const { data: dbClients, error: clientsError } = await supabase
    .schema('orbit')
    .from('clients')
    .select(
      'id, handle, name, ig_username, instagram_user_id, health_status, avatar_expected_gender, avatar_expected_age_min, avatar_expected_age_max, avatar_expected_geo_primary, avatar_unconscious_desire, is_benchmark'
    )

  const clientsErrorMessage = clientsError?.message ?? null

  if (clientsError) {
    console.error('❌ schema/clients inacessível:', clientsError.message)
    process.exit(1)
  }

  // Construir mapa de clients por ID
  const byId2 = new Map<string, Row>()
  for (const c of (dbClients ?? []) as Row[]) {
    const id = strOrNull(c.id)
    if (id) byId2.set(id, c)
  }

  const knownIds = new Set(Object.values(KNOWN_CLIENTS))

  // Clientes de benchmark (is_benchmark = true) nunca entram na auditoria,
  // nem os que vêm do banco nem os fixos em KNOWN_CLIENTS.
  const benchmarkIds = new Set(
    ((dbClients ?? []) as Row[])
      .filter((c) => c.is_benchmark === true)
      .map((c) => strOrNull(c.id))
      .filter((id): id is string => id != null)
  )

  const extraInDb = (dbClients ?? []).filter((c) => {
    const id = (c as Row).id
    if (typeof id === 'string' && benchmarkIds.has(id)) return false
    return typeof id === 'string' ? !knownIds.has(id) : true
  }) as Row[]

  const skippedBenchmark: Array<{ handle: string; id: string }> = Object.entries(KNOWN_CLIENTS)
    .filter(([, id]) => benchmarkIds.has(id))
    .map(([handle, id]) => ({ handle, id }))

  const missingInDb: Array<[string, string]> = Object.entries(KNOWN_CLIENTS).filter(([, id]) => !byId2.has(id))

  const report = {
    timestamp: new Date().toISOString(),
    protocol: 'OGP',
    catalog: FACT_CATALOG,
    universe: {
      knownMap: Object.keys(KNOWN_CLIENTS).length,
      dbClients: (dbClients ?? []).length,
      extraInDb: extraInDb.map((c) => ({ id: String(c.id), handle: strOrNull(c.handle) ?? '' })),
      missingInDb,
      skippedBenchmark,
    },
    clients: [] as Array<{
      handle: string
      clientId: string
      source: 'map' | 'db'
      client: Row | null
      counts: Record<string, CountResult>
      pipeline: {
        sessions: number
        failedSessions: number
        pendingSessions: number
        lastSession: Row | null
        rawUnparsed: number
        rawError: string | null
      }
      quality: {
        snapshots: { total: number; withoutFollowers: number; followersL0: number }
        latestSnap: Row | null
        posts: Row & { confidenceSumMismatch?: boolean; total?: number }
        latestAudience: Row | null
      }
      screens: Record<Screen, { gate: Gate; reasons: string[] }>
      errors: string[]
    }>,
  }

  const targets: Array<{ handle: string; id: string; from: 'map' | 'db' }> = [
    ...Object.entries(KNOWN_CLIENTS)
      .filter(([, id]) => !benchmarkIds.has(id))
      .map(([handle, id]) => ({ handle, id, from: 'map' as const })),
    ...extraInDb.map((c) => ({
      handle: strOrNull(c.handle) ?? '',
      id: String(c.id),
      from: 'db' as const,
    })),
  ]

  for (const target of targets) {
    const client = byId2.get(target.id) ?? null

    console.log(`\n⏳ OGP ${target.handle} (${target.id})`)

    const tables = [
      'ig_account_snapshots',
      'ig_posts',
      'ig_audience_snapshots',
      'avatar_alignment_snapshot',
      'avatar_validations',
      'alerts',
      'funnel_data',
      'client_onboarding',
      'ig_import_sessions',
      'raw_ig_ingest',
    ] as const

    const counts: Record<string, CountResult> = {}
    for (const table of tables) {
      counts[table] = await countExactAll(table, target.id)
    }

    const sessions = await fetchAll(
      'ig_import_sessions',
      'id, status, export_period_start, export_period_end, files_missing, error_log, processed_at',
      target.id,
      'created_at'
    )

    const failedSessions = sessions.rows.filter((s) => strOrNull(s.status) === 'failed').length
    const pendingSessions = sessions.rows.filter((s) => {
      const st = strOrNull(s.status)
      return st === 'pending' || st === 'processing'
    }).length
    const lastSession = sessions.rows[0] ?? null

    const snapshots = await fetchAll(
      'ig_account_snapshots',
      'id, period_start, period_end, followers_total, followers_confidence, reach_total, reach_confidence, profile_visits, link_clicks, er_real_pct',
      target.id,
      'period_end'
    )

    const latestSnap = snapshots.rows[0] ?? null

    const snapQuality = {
      total: snapshots.rows.length,
      withoutFollowers: snapshots.rows.filter((s) => s.followers_total == null).length,
      followersL0: snapshots.rows.filter((s) => strOrNull(s.followers_confidence) === 'L0').length,
    }

    const posts = await fetchAll(
      'ig_posts',
      'id, reach, impressions, confidence_level, content_format',
      target.id
    )

    const postRows = posts.rows
    const postStats = {
      total: postRows.length,
      truncated: posts.truncated,
      l0: postRows.filter((p) => strOrNull(p.confidence_level) === 'L0').length,
      l1: postRows.filter((p) => strOrNull(p.confidence_level) === 'L1').length,
      l2: postRows.filter((p) => strOrNull(p.confidence_level) === 'L2').length,
      withReach: postRows.filter((p) => p.reach != null).length,
      inconsistent: postRows.filter((p) => strOrNull(p.confidence_level) !== 'L0' && p.reach == null).length,
      negative: postRows.filter((p) => {
        const reach = numOrNull(p.reach)
        const impressions = numOrNull(p.impressions)
        return (reach != null && reach < 0) || (impressions != null && impressions < 0)
      }).length,
    }

    const confSum = postStats.l0 + postStats.l1 + postStats.l2

    const audience = await fetchAll(
      'ig_audience_snapshots',
      'id, period_end, gender_female_pct, gender_male_pct, avatar_composite_score, confidence_level',
      target.id,
      'period_end'
    )

    const latestAudience = audience.rows[0] ?? null

    const alertsOpen = await countExactWhere('alerts', target.id, 'is_resolved', false)
    const rawUnparsed = await countExactWhere('raw_ig_ingest', target.id, 'parsed', false)

    const expectedAvatar =
      client &&
      client.avatar_expected_gender != null &&
      client.avatar_expected_age_min != null &&
      client.avatar_expected_age_max != null

    const schemaOk = Object.values(counts).every((c) => c.error == null)
    const ingestBlocked = failedSessions > 0 || pendingSessions > 0 || (rawUnparsed.count ?? 0) > 0

    const screens: Record<Screen, { gate: Gate; reasons: string[] }> = {
      carteira: {
        gate: gateOf({
          schemaOk,
          ingestFailed: false,
          readyFactsPresent: Boolean(client),
          emptyAllowed: false,
        }),
        reasons: [
          client ? 'clients row existe' : 'clients row AUSENTE',
          (counts.client_onboarding?.count ?? 0) > 0 ? 'onboarding presente' : 'onboarding ausente (B aceitável)',
        ],
      },
      instagram: {
        gate: gateOf({
          schemaOk,
          ingestFailed: ingestBlocked && snapshots.rows.length === 0,
          readyFactsPresent: snapshots.rows.length > 0 && latestSnap?.followers_total != null,
          emptyAllowed: false,
        }),
        reasons: [
          `snapshots=${snapQuality.total}`,
          `posts=${postStats.total} reach=${postStats.withReach}`,
          latestSnap
            ? `último período ${strOrNull(latestSnap.period_start) ?? ''}→${strOrNull(latestSnap.period_end) ?? ''}`
            : 'sem período',
          lastSession ? `import ${strOrNull(lastSession.status) ?? 'unknown'}` : 'sem import_session',
        ],
      },
      avatar: {
        gate: gateOf({
          schemaOk,
          ingestFailed: ingestBlocked && audience.rows.length === 0,
          readyFactsPresent: Boolean(expectedAvatar && latestAudience),
          emptyAllowed: false,
        }),
        reasons: [
          expectedAvatar ? 'avatar esperado preenchido em clients' : 'avatar esperado INCOMPLETO em clients',
          `audience_snapshots=${audience.rows.length}`,
          `alignment=${counts.avatar_alignment_snapshot?.count ?? 0}`,
          `validations=${counts.avatar_validations?.count ?? 0}`,
        ],
      },
      alertas: {
        gate: gateOf({
          schemaOk,
          ingestFailed: false,
          readyFactsPresent: true,
          emptyAllowed: true,
        }),
        reasons: [`alerts=${counts.alerts?.count ?? 0}`, `abertos=${alertsOpen.count}`],
      },
      funil: {
        gate: gateOf({
          schemaOk,
          ingestFailed: false,
          readyFactsPresent: (counts.funnel_data?.count ?? 0) > 0,
          emptyAllowed: false,
        }),
        reasons: [
          `funnel_data=${counts.funnel_data?.count ?? 0}`,
          latestSnap?.profile_visits != null ? 'snapshot tem profile_visits (origem derivável)' : 'snapshot sem profile_visits',
        ],
      },
    }

    const row = {
      handle: target.handle,
      clientId: target.id,
      source: target.from,
      client,
      counts,
      pipeline: {
        sessions: sessions.rows.length,
        failedSessions,
        pendingSessions,
        lastSession,
        rawUnparsed: rawUnparsed.count,
        rawError: rawUnparsed.error,
      },
      quality: {
        snapshots: snapQuality,
        latestSnap,
        posts: Object.assign({}, posts, {
          confidenceSumMismatch: confSum !== postStats.total,
          total: postStats.total,
        }) as Row,
        latestAudience,
      },
      screens,
      errors: [
        clientsErrorMessage,
        ...Object.entries(counts)
          .filter(([, v]) => v.error)
          .map(([t, v]) => `${t}: ${v.error}`),
        sessions.error ?? null,
        snapshots.error ?? null,
        posts.error ?? null,
        audience.error ?? null,
      ].filter((x): x is string => typeof x === 'string' && x.length > 0),
    }

    report.clients.push(row)
  }

  console.log('\n\n═══════════════════════════════════════════════════════════════════')
  console.log('OGP — GATES POR TELA (começar no banco)')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(
    `${'cliente'.padEnd(20)} ${'carteira'.padEnd(14)} ${'instagram'.padEnd(14)} ${'avatar'.padEnd(14)} ${'alertas'.padEnd(14)} ${'funil'}`
  )

  for (const c of report.clients) {
    console.log(
      `${String(c.handle).padEnd(20)} ${c.screens.carteira.gate.padEnd(14)} ${c.screens.instagram.gate.padEnd(14)} ${c.screens.avatar.gate.padEnd(14)} ${c.screens.alertas.gate.padEnd(14)} ${c.screens.funil.gate}`
    )
  }

  if (missingInDb.length) {
    console.log('\n🔴 no mapa KNOWN_CLIENTS e ausentes em orbit.clients:')
    for (const [handle, id] of missingInDb) console.log(`   ${handle} ${id}`)
  }
  if (extraInDb.length) {
    console.log('\n⚠️  no banco e fora do mapa KNOWN_CLIENTS:')
    for (const c of extraInDb) {
      console.log(`   ${String(c.handle ?? '')} ${String(c.id)}`)
    }
  }
  if (skippedBenchmark.length) {
    console.log('\n⏭️  pulados por is_benchmark = true:')
    for (const c of skippedBenchmark) console.log(`   ${c.handle} ${c.id}`)
  }

  fs.writeFileSync('ogp-report.json', JSON.stringify(report, null, 2))
  console.log('\n✅ ogp-report.json gravado')
  console.log('Leitura do gate: RWP = pode ligar page | B_EMPTY = page só com empty state | C_HOLD_INGEST = não ligue L4 | A_SCHEMA = tabela/acesso quebrado')
}

main().catch((err: unknown) => {
  console.error('❌', err instanceof Error ? err.message : String(err))
  process.exit(1)
})