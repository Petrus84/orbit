/**
 * scripts/reconcile-kpi-contracts.ts
 *
 * Robô KCR (Etapa 1 do pipeline ORBIT — KPI Contract Registry).
 * Lê contracts/kpi/inbox/briefing-v1.json (Doc 1) e contracts/kpi/inbox/contract-v2.json
 * (Doc 2), casa por kpi_nome, e faz uma checagem MECÂNICA (grep, não semântica) de:
 *   - se a coluna/writer citados no Doc 2 aparecem no dump de schema
 *   - se o writer citado aparece definido em src/lib/repositories/contentContractEngine.ts
 *   - se o writer citado é de fato CHAMADO em algum outro arquivo do repo (não só definido)
 *
 * Isto NÃO substitui leitura humana da lógica — só reduz o trabalho manual de achar
 * "NÃO ENCONTRADO" e "escrito mas nunca chamado" (RWP escondido dentro do KCR).
 *
 * Uso:
 *   npx tsx scripts/reconcile-kpi-contracts.ts
 *
 * Variáveis de ambiente:
 *   ORBIT_SCHEMA_DUMP  caminho para o dump SQL do schema `orbit` (DDL).
 *                      Default: supabase/dump_completo.sql (não existe neste
 *                      repo ainda — gere com `supabase db dump` ou aponte para
 *                      o dump que você já tem, ex: 20260925dump_orbit.sql).
 *
 * Saída:
 *   contracts/kpi/registry.json
 *   contracts/kpi/reconciliation.json
 *
 * Zero invenção: qualquer coluna/writer não encontrado vira "NÃO ENCONTRADO"
 * no relatório — o script nunca assume que algo existe.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const INBOX = join(ROOT, 'contracts/kpi/inbox')
const SCHEMA_DUMP_PATH = process.env.ORBIT_SCHEMA_DUMP ?? join(ROOT, 'supabase/20260928dump_orbit.sql')
const ENGINE_PATH = join(ROOT, 'src/lib/repositories/contentContractEngine.ts')

type Doc2Entry = Record<string, unknown> & { kpi_id: string; kpi_nome: string }
type Doc1Entry = Record<string, unknown> & { kpi_nome: string }

function readJson<T>(path: string, label: string): T {
  if (!existsSync(path)) {
    console.error(`PARAR — evidência insuficiente: ${label} não encontrado em ${path}.`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '_archived' || entry === 'refatoracao-temp') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, acc)
    else if (exts.includes(extname(full))) acc.push(full)
  }
  return acc
}

function main() {
  const doc2 = readJson<Doc2Entry[]>(join(INBOX, 'contract-v2.json'), 'Doc 2 (contract-v2.json)')
  const doc1 = readJson<Doc1Entry[]>(join(INBOX, 'briefing-v1.json'), 'Doc 1 (briefing-v1.json)')
  const doc1ByName = new Map(doc1.map((e) => [e.kpi_nome, e]))

  const schemaDumpExists = existsSync(SCHEMA_DUMP_PATH)
  const schemaDump = schemaDumpExists ? readFileSync(SCHEMA_DUMP_PATH, 'utf-8') : ''
  if (!schemaDumpExists) {
    console.warn(`AVISO: dump de schema não encontrado em ${SCHEMA_DUMP_PATH}. Binding check ficará "NÃO CONFERIDO" para todos os KPIs.`)
  }

  const engineSrc = existsSync(ENGINE_PATH) ? readFileSync(ENGINE_PATH, 'utf-8') : ''
  const allTsFiles = walk(join(ROOT, 'src'), ['.ts', '.tsx']).concat(walk(join(ROOT, 'scripts'), ['.ts']))

  function writerDefined(name: string): boolean {
    return new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b`).test(engineSrc)
  }

  function writerCalled(name: string): { called: boolean; files: string[] } {
    const callRe = new RegExp(`\\b${name}\\(`)
    const files: string[] = []
    for (const file of allTsFiles) {
      if (file === ENGINE_PATH) continue // não conta a própria definição
      const content = readFileSync(file, 'utf-8')
      if (callRe.test(content)) files.push(file.replace(ROOT + '/', ''))
    }
    return { called: files.length > 0, files }
  }

  const registry: Record<string, unknown>[] = []
  const reconciliation: Record<string, unknown>[] = []

  for (const e of doc2) {
    const doc1Match = doc1ByName.get(e.kpi_nome) ?? null
    const recusadaKey = Object.keys(e).find(
      (k) => k.startsWith('regra_antiga') || k.startsWith('regra_calculo_antiga') || k.startsWith('regra_alerta_antiga') || k.startsWith('defaults_legado')
    )

    // writer citado no texto do Doc2 (campo "writer"), se houver
    const writerField = typeof e.writer === 'string' ? (e.writer as string) : null
    const writerNameMatch = writerField?.match(/([a-zA-Z][a-zA-Z0-9]*Alert)\b/)
    const writerName = writerNameMatch?.[1] ?? null

    let writerVerdict: string
    if (!writerName) {
      writerVerdict = 'sem_writer_declarado'
    } else if (!writerDefined(writerName)) {
      writerVerdict = `NÃO ENCONTRADO: função ${writerName} não existe em ${ENGINE_PATH.replace(ROOT + '/', '')}`
    } else {
      const { called, files } = writerCalled(writerName)
      writerVerdict = called
        ? `chamado em: ${files.join(', ')}`
        : `escrito mas NUNCA CHAMADO fora da própria definição — RWP pendente antes de considerar "vigente" em produção`
    }

    // binding: procura, no dump de schema (se existir), qualquer coluna citada em
    // fonte_preferencial/metrica_instagram/regra_calculo (heurística simples: snake_case tokens)
    const candidateText = [e.fonte_preferencial, e.metrica_instagram, e.regra_calculo].filter(Boolean).join(' ') as string
    const columnTokens = Array.from(new Set((candidateText.match(/[a-z_]{4,}(?:\.[a-z_]{2,})?/g) ?? [])))
    const foundColumns = schemaDumpExists ? columnTokens.filter((t) => schemaDump.includes(t.split('.').pop()!)) : []

    registry.push({
      kpi_id: e.kpi_id,
      kpi_nome: e.kpi_nome,
      status_doc2: e.status,
      regra_calculo_vigente: e.regra_calculo ?? e.regua_vigente ?? e.regra_refinada ?? null,
      regra_recusada: recusadaKey ? e[recusadaKey] : null,
      writer_declarado: writerField,
      writer_check: writerVerdict,
      binding_check: schemaDumpExists
        ? foundColumns.length
          ? `possível match de coluna: ${foundColumns.join(', ')}`
          : 'NÃO ENCONTRADO: nenhum token reconhecido no dump — confira manualmente'
        : 'NÃO CONFERIDO: dump de schema ausente (ver ORBIT_SCHEMA_DUMP)',
    })

    reconciliation.push({
      kpi_id: e.kpi_id,
      kpi_nome: e.kpi_nome,
      presente_no_doc1: Boolean(doc1Match),
      regra_doc1: doc1Match?.regra_calculo ?? null,
      regra_doc2: e.regra_calculo ?? e.regua_vigente ?? e.regra_refinada ?? null,
      regra_recusada_explicita: recusadaKey ? e[recusadaKey] : null,
      diff: doc1Match && doc1Match.regra_calculo !== e.regra_calculo ? 'refinado' : doc1Match ? 'igual' : 'novo_no_doc2',
    })
  }

  writeFileSync(join(ROOT, 'contracts/kpi/registry.json'), JSON.stringify({ gerado_em: new Date().toISOString(), kpis: registry }, null, 2))
  writeFileSync(join(ROOT, 'contracts/kpi/reconciliation.json'), JSON.stringify({ gerado_em: new Date().toISOString(), reconciliacao: reconciliation }, null, 2))

  const naoWireados = registry.filter((r) => typeof r.writer_check === 'string' && (r.writer_check as string).includes('NUNCA CHAMADO'))
  console.log(`\nKCR rodou. ${registry.length} KPIs processados.`)
  console.log(`Writers escritos mas nunca chamados (RWP pendente): ${naoWireados.length}`)
  for (const r of naoWireados) console.log(`  - ${r.kpi_id}: ${r.writer_declarado}`)
  console.log(`\nArquivos gerados: contracts/kpi/registry.json, contracts/kpi/reconciliation.json`)
}

main()
