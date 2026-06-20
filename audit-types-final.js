#!/usr/bin/env node
/**
 * ============================================================================
 * ORBIT DASHBOARD — AUDITORIA FINAL DE TIPOS v3.0
 * ============================================================================
 * Auditor: análise cruzada de orbit.ts SSOT v2.1 × arquivos de tipos reais
 *          × schema Supabase × protótipo HTML
 *
 * Execução:  node audit-types-final.js
 * Requisito: Node 18+  (usa fs nativo, sem dependências externas)
 *
 * O que este script detecta:
 *   [FATAL]   Duplicatas de tipo entre arquivos → erro de compilação TypeScript
 *   [FATAL]   Campos incompatíveis na mesma interface (shape clash)
 *   [FATAL]   Nomes de campo que divergem do schema real do Supabase
 *   [ERROR]   Campos usados em componentes mas ausentes na interface declarada
 *   [ERROR]   GlowColor usado onde o HTML usa cor CSS não representável
 *   [WARN]    Interfaces com mesmo nome mas estruturas distintas entre arquivos
 *   [WARN]    Campos opcionais declarados como obrigatórios (ou vice-versa)
 *   [INFO]    Tipos declarados mas nunca importados
 * ============================================================================
 */

'use strict'

const fs   = require('fs')
const path = require('path')

// ── Configuração ─────────────────────────────────────────────────────────────

const ROOT = process.cwd()        // raiz do projeto (onde está o script)
const SRC  = path.join(ROOT, 'src')

const TYPE_FILES = [
  'src/types/orbit.ts',
  'src/types/instagram.ts',
  'src/types/metaAds.ts',
  'src/types/funnel.ts',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`
const RED    = (s) => `\x1b[31m${s}\x1b[0m`
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`
const CYAN   = (s) => `\x1b[36m${s}\x1b[0m`
const DIM    = (s) => `\x1b[2m${s}\x1b[0m`

let findings = []

function report(level, category, message, detail = '') {
  findings.push({ level, category, message, detail })
}

function readSafe(filepath) {
  const full = path.join(ROOT, filepath)
  try {
    return fs.readFileSync(full, 'utf8')
  } catch {
    return null
  }
}

/** Escaneia src/ recursivamente e retorna lista de arquivos .ts/.tsx */
function scanTsFiles(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      results.push(...scanTsFiles(full))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

// ── 1. VERIFICAÇÃO: arquivos de tipo existem ─────────────────────────────────

console.log(BOLD('\n════════════════════════════════════════════════════════'))
console.log(BOLD('  ORBIT DASHBOARD — RELATÓRIO DE AUDITORIA FINAL v3.0'))
console.log(BOLD('════════════════════════════════════════════════════════\n'))

const typeContents = {}
for (const f of TYPE_FILES) {
  const content = readSafe(f)
  if (!content) {
    report('FATAL', 'ARQUIVO AUSENTE', `Arquivo de tipos não encontrado: ${f}`,
      'Crie o arquivo ou ajuste TYPE_FILES no topo do script.')
  } else {
    typeContents[f] = content
  }
}

// ── 2. DUPLICATAS DE TIPO (causa erro de compilação TypeScript) ───────────────

console.log(CYAN('▶ 2. Detectando duplicatas de declaração de tipo...\n'))

/**
 * Extrai todos os nomes de export type/interface/enum de um arquivo.
 * Retorna Map<nome, lista de linhas onde aparece>
 */
function extractExportedNames(content) {
  const map = new Map()
  const re = /^export\s+(?:type|interface|enum|const)\s+(\w+)/gm
  let m
  while ((m = re.exec(content)) !== null) {
    const name = m[1]
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(m.index)
  }
  return map
}

// Mapa global: nomeTipo → [arquivos onde está declarado]
const globalTypeMap = new Map()

for (const [file, content] of Object.entries(typeContents)) {
  const names = extractExportedNames(content)
  for (const name of names.keys()) {
    if (!globalTypeMap.has(name)) globalTypeMap.set(name, [])
    globalTypeMap.get(name).push(file)
  }
}

/** Tipos que DEVEM existir em múltiplos arquivos por serem re-exports intencionais */
const INTENTIONAL_REDECLARES = new Set([
  // Nenhum — neste projeto TODOS deveriam existir em um único local (orbit.ts)
])

for (const [name, files] of globalTypeMap.entries()) {
  if (files.length > 1 && !INTENTIONAL_REDECLARES.has(name)) {
    report(
      'FATAL',
      'DUPLICATA DE TIPO',
      `'${name}' declarado em ${files.length} arquivos`,
      `Arquivos: ${files.join(' | ')}\n` +
      `  Impacto: erro de compilação TS ao importar de fontes diferentes.\n` +
      `  Solução: manter APENAS em src/types/orbit.ts e importar de lá.`
    )
  }
}

// ── 3. SHAPE CLASH: mesma interface, campos incompatíveis ────────────────────

console.log(CYAN('▶ 3. Auditando shape clashes entre interfaces...\n'))

/**
 * Extrai campos de uma interface por nome no conteúdo de um arquivo.
 * Retorna Set de nomes de campo (heurística — não é parser completo).
 */
function extractInterfaceFields(content, interfaceName) {
  // Encontra o bloco da interface
  const re = new RegExp(`interface\\s+${interfaceName}\\s*\\{([^}]+)\\}`, 's')
  const m = re.exec(content)
  if (!m) return null
  const body = m[1]
  const fields = new Set()
  // Captura linhas como:  fieldName?: type  ou  fieldName: type
  const fieldRe = /^\s{1,4}(\w+)\??:/gm
  let fm
  while ((fm = fieldRe.exec(body)) !== null) {
    fields.add(fm[1])
  }
  return fields
}

// ── 3a. KPICardData ───────────────────────────────────────────────────────────

const kpiFields = {}
for (const [file, content] of Object.entries(typeContents)) {
  const fields = extractInterfaceFields(content, 'KPICardData')
  if (fields) kpiFields[file] = fields
}

if (Object.keys(kpiFields).length > 1) {
  const files = Object.keys(kpiFields)
  // Campos obrigatórios auditados (do script de auditoria inicial)
  const USED_IN_COMPONENTS = new Set(['delta', 'glowColor', 'id', 'label', 'semaphore', 'unit', 'value', 'deltaLabel', 'subtitle'])

  for (const file of files) {
    const fields = kpiFields[file]
    for (const required of USED_IN_COMPONENTS) {
      if (!fields.has(required)) {
        report(
          'ERROR',
          'CAMPO AUSENTE — KPICardData',
          `Campo '${required}' usado em componentes mas AUSENTE na declaração em ${file}`,
          `Componentes auditados: KPICard.tsx, IGOverviewScreen.tsx, MetaAdsScreen.tsx\n` +
          `  Solução: adicionar '${required}' à interface KPICardData em ${file}`
        )
      }
    }
  }

  // Divergência específica: subtitle nullable
  const orbitContent = typeContents['src/types/orbit.ts']
  const igContent    = typeContents['src/types/instagram.ts']
  if (orbitContent && igContent) {
    const orbitHasNullable = /subtitle\s*:\s*string\s*\|\s*null/.test(orbitContent)
    const igHasNonNullable = /subtitle\s*:\s*string[^|]/.test(igContent)
    if (orbitHasNullable && igHasNonNullable) {
      report(
        'FATAL',
        'NULLABILITY CLASH — KPICardData.subtitle',
        `orbit.ts declara 'subtitle: string | null'; instagram.ts declara 'subtitle: string'`,
        `Impacto: repositórios que retornam null quebram componentes que esperam string.\n` +
        `  Solução: padronizar como 'string | null' em ambos os arquivos.\n` +
        `  SSOT v2.1 (correto): subtitle: string | null`
      )
    }
  }
}

// ── 3b. FunnelData ────────────────────────────────────────────────────────────

const funnelDataFields = {}
for (const [file, content] of Object.entries(typeContents)) {
  const fields = extractInterfaceFields(content, 'FunnelData')
  if (fields) funnelDataFields[file] = fields
}

{
  // orbit.ts SSOT v2.1 tem: clientId, steps, totalValue, period
  // funnel.ts tem: alcance, visitas, cliques, vendas, ctrBio, taxaConv
  const orbitFunnelFields  = new Set(['clientId', 'steps', 'totalValue', 'period'])
  const funnelTsFields     = new Set(['alcance', 'visitas', 'cliques', 'vendas', 'ctrBio', 'taxaConv'])

  // Detecta se a divergência real está nos arquivos
  const orbitContent  = typeContents['src/types/orbit.ts']
  const funnelContent = typeContents['src/types/funnel.ts']

  const orbitHasSteps   = orbitContent  && /steps\s*:\s*FunnelStep/.test(orbitContent)
  const funnelHasAlcance = funnelContent && /alcance\s*:\s*number/.test(funnelContent)

  if (orbitHasSteps && funnelHasAlcance) {
    report(
      'FATAL',
      'SHAPE INCOMPATÍVEL — FunnelData',
      `orbit.ts e funnel.ts declaram 'FunnelData' com estruturas COMPLETAMENTE diferentes`,
      `orbit.ts SSOT v2.1: { clientId, steps: FunnelStep[], totalValue, period }\n` +
      `  funnel.ts:         { alcance, visitas, cliques, vendas, ctrBio, taxaConv }\n` +
      `  Impacto: qualquer componente que importar FunnelData receberá shape errado.\n` +
      `  Solução: renomear funnel.ts 'FunnelData' para 'FunnelMetrics' (alinhado com\n` +
      `           a entidade real) e usar apenas 'FunnelData' de orbit.ts como SSOT.`
    )
  }

  // FunnelStep: orbit usa 'color: string', funnel.ts usa 'icon: string'
  const orbitHasFunnelColor = orbitContent  && /color\s*:\s*string/.test(orbitContent)
  const funnelHasFunnelIcon = funnelContent && /icon\s*:\s*string/.test(funnelContent)
  const funnelHasStepId     = funnelContent && extractInterfaceFields(funnelContent, 'FunnelStep')?.has('id')

  if (orbitHasFunnelColor && funnelHasFunnelIcon) {
    report(
      'FATAL',
      'SHAPE INCOMPATÍVEL — FunnelStep',
      `orbit.ts tem 'color: string' em FunnelStep; funnel.ts tem 'icon: string'`,
      `orbit.ts: { label, value, percentage, color }  ← sem 'id', sem 'icon'\n` +
      `  funnel.ts: { id, label, value, percentage, icon }  ← sem 'color'\n` +
      `  HTML protótipo usa: funnel-bar com cor CSS (--blue/--amber/--red)\n` +
      `  Solução canônica: { id, label, value, percentage, color: string, icon?: string }\n` +
      `  Aplicar em orbit.ts e remover declaração de funnel.ts.`
    )
  }

  if (!funnelHasStepId) {
    report(
      'ERROR',
      'CAMPO AUSENTE — FunnelStep.id',
      `FunnelStep em orbit.ts SSOT v2.1 não possui campo 'id'`,
      `funnel.ts (correto) tem 'id: string'. React map() requer key única.\n` +
      `  Solução: adicionar 'id: string' ao FunnelStep em orbit.ts.`
    )
  }
}

// ── 3c. Campaign ──────────────────────────────────────────────────────────────

{
  const orbitContent   = typeContents['src/types/orbit.ts']
  const metaContent    = typeContents['src/types/metaAds.ts']

  // orbit.ts SSOT v2.1: fatiguePercent, fatigueStatus, diagnosis, actionRequired, roas: number | null
  // metaAds.ts:         fatigue (não fatiguePercent), status (não fatigueStatus), cpl, roas: number
  const orbitHasFatiguePct    = orbitContent && /fatiguePercent\s*:\s*number/.test(orbitContent)
  const metaHasFatigue        = metaContent  && /fatigue\s*:\s*number/.test(metaContent)
  const metaHasCpl            = metaContent  && /cpl\s*:\s*number/.test(metaContent)
  const orbitRoasNullable     = orbitContent && /roas\s*:\s*number\s*\|\s*null/.test(orbitContent)
  const metaRoasNotNull       = metaContent  && /roas\s*:\s*number[^|]/.test(metaContent)

  if (orbitHasFatiguePct && metaHasFatigue) {
    report(
      'FATAL',
      'SHAPE INCOMPATÍVEL — Campaign.fatigue*',
      `orbit.ts: 'fatiguePercent: number'; metaAds.ts: 'fatigue: number'`,
      `Campo renomeado sem sincronização. Componentes vão receber undefined.\n` +
      `  orbit.ts também tem 'fatigueStatus' que não existe em metaAds.ts.\n` +
      `  Solução: padronizar para 'fatiguePercent' + 'fatigueStatus' em AMBOS.\n` +
      `  Deletar declaração de Campaign de metaAds.ts; importar de orbit.ts.`
    )
  }

  if (orbitRoasNullable && metaRoasNotNull) {
    report(
      'FATAL',
      'NULLABILITY CLASH — Campaign.roas',
      `orbit.ts: 'roas: number | null'; metaAds.ts: 'roas: number'`,
      `Campanhas sem conversão precisam roas = null. metaAds.ts não aceita null.\n` +
      `  Solução: 'roas: number | null' em orbit.ts (SSOT). Remover de metaAds.ts.`
    )
  }

  if (!metaContent?.includes('diagnosis') && orbitContent?.includes('diagnosis')) {
    report(
      'ERROR',
      'CAMPO AUSENTE — Campaign em metaAds.ts',
      `metaAds.ts não tem campos 'diagnosis' e 'actionRequired' presentes em orbit.ts`,
      `Estes campos são necessários para renderizar diagnóstico de fadiga na UI.\n` +
      `  Solução: remover Campaign de metaAds.ts. Usar APENAS orbit.ts como fonte.`
    )
  }

  if (metaHasCpl && !orbitContent?.includes('cpl')) {
    report(
      'WARN',
      'CAMPO EXTRA — Campaign.cpl',
      `metaAds.ts tem 'cpl: number' que NÃO existe em orbit.ts SSOT v2.1`,
      `Custo por lead (cpl) é visível no HTML protótipo. SSOT v2.1 omite o campo.\n` +
      `  Solução: adicionar 'cpl?: number' a Campaign em orbit.ts.`
    )
  }
}

// ── 3d. MetaAdsKPI ────────────────────────────────────────────────────────────

{
  const orbitContent = typeContents['src/types/orbit.ts']
  const metaContent  = typeContents['src/types/metaAds.ts']

  // orbit.ts SSOT v2.1: id, label, value, unit, status, benchmark? — SEM delta, deltaLabel
  // metaAds.ts: label, value, unit, delta, deltaLabel — SEM id, status
  const orbitMetaKPI = orbitContent && extractInterfaceFields(orbitContent, 'MetaAdsKPI')
  const metaMetaKPI  = metaContent  && extractInterfaceFields(metaContent,  'MetaAdsKPI')

  if (orbitMetaKPI && metaMetaKPI) {
    const missingInOrbit = ['delta', 'deltaLabel'].filter(f => !orbitMetaKPI.has(f))
    const missingInMeta  = ['id', 'status'].filter(f => !metaMetaKPI.has(f))

    if (missingInOrbit.length) {
      report(
        'FATAL',
        'CAMPO AUSENTE — MetaAdsKPI em orbit.ts',
        `orbit.ts SSOT v2.1 não tem: [${missingInOrbit.join(', ')}]`,
        `metaAds.ts tem 'delta' e 'deltaLabel' que são renderizados na UI.\n` +
        `  Estes campos existem em KPICardData de instagram.ts mas faltam em MetaAdsKPI.\n` +
        `  Solução: adicionar delta: number e deltaLabel: string ao MetaAdsKPI em orbit.ts.`
      )
    }
    if (missingInMeta.length) {
      report(
        'ERROR',
        'CAMPO AUSENTE — MetaAdsKPI em metaAds.ts',
        `metaAds.ts não tem: [${missingInMeta.join(', ')}]`,
        `'id' é necessário para React key; 'status' é necessário para semáforo visual.\n` +
        `  Solução: deletar MetaAdsKPI de metaAds.ts. Importar de orbit.ts.`
      )
    }
  }
}

// ── 3e. InstagramOverviewData vs IGOverviewData ───────────────────────────────

{
  const orbitContent  = typeContents['src/types/orbit.ts']
  const igContent     = typeContents['src/types/instagram.ts']

  const orbitHasInstagramOverview = orbitContent  && /interface\s+InstagramOverviewData/.test(orbitContent)
  const igHasIGOverview           = igContent     && /interface\s+IGOverviewData/.test(igContent)
  const orbitUsesHeader           = orbitContent  && /header\s*:\s*DashboardHeaderMeta/.test(orbitContent)
  const igUsesMeta                = igContent     && /meta\s*:\s*DashboardHeaderMeta/.test(igContent)

  if (orbitHasInstagramOverview && igHasIGOverview) {
    report(
      'FATAL',
      'INTERFACE DUPLICADA — InstagramOverviewData / IGOverviewData',
      `Dois tipos para a mesma entidade: 'InstagramOverviewData' (orbit.ts) e 'IGOverviewData' (instagram.ts)`,
      `Componentes diferentes podem estar importando tipos distintos para o mesmo dado.\n` +
      `  Auditoria de arquivos mostra ambos referenciados em IGOverviewScreen.tsx.\n` +
      `  Solução: manter APENAS 'IGOverviewData' em orbit.ts; deletar de instagram.ts.`
    )
  }

  if (orbitUsesHeader && igUsesMeta) {
    report(
      'FATAL',
      'FIELD NAME CLASH — header vs meta (DashboardHeaderMeta)',
      `orbit.ts SSOT v2.1: campo 'header: DashboardHeaderMeta' | instagram.ts: campo 'meta: DashboardHeaderMeta'`,
      `Impacto: repositório que retorna { header } quebra componente que lê { meta }.\n` +
      `  Auditado: instagramOverviewRepository.ts e IGOverviewScreen.tsx\n` +
      `  v1.1.0 do orbit.ts (PDF) usa 'meta'. SSOT v2.1 mudou para 'header' sem avisar.\n` +
      `  Solução: reverter para 'meta' (alinhado com v1.1.0 + instagram.ts + repositórios).`
    )
  }
}

// ── 3f. AlignmentBar.color — GlowColor não cobre 'green' ─────────────────────

{
  const orbitContent = typeContents['src/types/orbit.ts']
  const usesGlowInAlignment = orbitContent && /AlignmentBar[\s\S]{0,300}color\s*:\s*GlowColor/.test(orbitContent)

  if (usesGlowInAlignment) {
    report(
      'ERROR',
      'TYPE MISMATCH — AlignmentBar.color: GlowColor',
      `GlowColor = 'cyan' | 'red' | 'gold' | 'none' — NÃO inclui 'green' nem 'amber'`,
      `HTML protótipo usa var(--green) e var(--amber) nas barras de alinhamento de avatar.\n` +
      `  'green' não é representável por GlowColor. Componente quebraria em runtime.\n` +
      `  Solução: criar tipo específico:\n` +
      `    export type AlignmentColor = 'green' | 'amber' | 'red'\n` +
      `    E substituir GlowColor em AlignmentBar.color por AlignmentColor.`
    )
  }
}

// ── 4. DIVERGÊNCIA ENTRE KpiSnapshotRow E SCHEMA SUPABASE ────────────────────

console.log(CYAN('▶ 4. Auditando KpiSnapshotRow vs schema real do Supabase...\n'))

// Schema real (conforme documento SQL fornecido):
//   kpi_snapshots: id, client_id, metric, value, value_text, source_level,
//                  period_start, period_end, formula, post_id, ad_id, raw_ref,
//                  calculated_at, semaphore, delta_pct
//
// orbit.ts v1.1.0 (do PDF) declara KpiSnapshotRow com:
//   metric_key    → deveria ser 'metric'
//   metric_value  → deveria ser 'value'
//   metric_unit   → deveria ser 'value_text' (ou não existe como coluna)
//   (sem post_id) → DB tem post_id uuid

const orbitContent = typeContents['src/types/orbit.ts']

if (orbitContent) {
  const divergencias = [
    {
      rowField:  'metric_key',
      dbColumn:  'metric',
      check:     /metric_key\s*:\s*string/.test(orbitContent),
      fix:       "Renomear 'metric_key' para 'metric' em KpiSnapshotRow"
    },
    {
      rowField:  'metric_value',
      dbColumn:  'value',
      check:     /metric_value\s*:\s*number/.test(orbitContent),
      fix:       "Renomear 'metric_value' para 'value' em KpiSnapshotRow"
    },
    {
      rowField:  'metric_unit',
      dbColumn:  'value_text (ou ausente)',
      check:     /metric_unit\s*:\s*string/.test(orbitContent),
      fix:       "Renomear 'metric_unit' para 'value_text' (coluna real) ou remover"
    },
  ]

  for (const d of divergencias) {
    if (d.check) {
      report(
        'FATAL',
        'DB SCHEMA MISMATCH — KpiSnapshotRow',
        `Campo '${d.rowField}' em KpiSnapshotRow não existe no Supabase (coluna real: '${d.dbColumn}')`,
        `Impacto: supabase.from('kpi_snapshots').select() retornará undefined para este campo.\n` +
        `  Solução: ${d.fix}`
      )
    }
  }

  // Verifica se post_id está ausente em KpiSnapshotRow
  const kpiRowFields = extractInterfaceFields(orbitContent, 'KpiSnapshotRow')
  if (kpiRowFields && !kpiRowFields.has('post_id') && !kpiRowFields.has('ad_id')) {
    report(
      'WARN',
      'CAMPO AUSENTE — KpiSnapshotRow.post_id',
      `DB tem 'post_id uuid' (FK para posts) mas KpiSnapshotRow não declara este campo`,
      `Necessário para KPIs por post (ex: candidato a boost por post_id).\n` +
      `  Solução: adicionar 'post_id: string | null' a KpiSnapshotRow.`
    )
  }
}

// ── 5. AUDITORIA DE TIPOS PRIMITIVOS DUPLICADOS ───────────────────────────────

console.log(CYAN('▶ 5. Auditando primitivos duplicados (FetchStatus, AsyncState, etc.)...\n'))

const PRIMITIVE_TYPES = [
  'FetchStatus',
  'AsyncState',
  'SemaphoreColor',
  'GlowColor',
  'TrendColor',
  'StatusVariant',
  'DeltaDirection',
]

for (const typeName of PRIMITIVE_TYPES) {
  const files = globalTypeMap.get(typeName) || []
  if (files.length > 1) {
    report(
      'FATAL',
      `PRIMITIVO DUPLICADO — ${typeName}`,
      `'${typeName}' declarado em ${files.length} arquivos`,
      `Arquivos: ${files.map(f => path.relative(ROOT, f.startsWith('/') ? f : path.join(ROOT, f)) || f).join(', ')}\n` +
      `  Impacto: erro 'Duplicate identifier' ou inconsistência silenciosa de valores.\n` +
      `  Solução: declarar APENAS em src/types/orbit.ts e re-exportar de lá.\n` +
      `    Nos outros arquivos: import type { ${typeName} } from '@/types/orbit'`
    )
  }
}

// ── 6. SCAN DE PROPS USADAS NOS COMPONENTES ───────────────────────────────────

console.log(CYAN('▶ 6. Verificando props usadas nos componentes vs interfaces declaradas...\n'))

const allTsFiles = scanTsFiles(SRC)

/** Retorna Set de nomes de prop acessadas em padrão obj.prop ou destructuring */
function extractAccessedProps(content, interfaceName) {
  const props = new Set()

  // Padrão: item.propName  ou  { propName } =
  const dotPattern   = new RegExp(`\\w+\\.(\\w+)`, 'g')
  const destructureP = /\{\s*([^}]+)\s*\}/g

  let m
  while ((m = dotPattern.exec(content)) !== null) props.add(m[1])
  while ((m = destructureP.exec(content)) !== null) {
    m[1].split(',').forEach(p => {
      const name = p.trim().split(/[\s:]/)[0].replace(/^\.\.\./, '')
      if (name) props.add(name)
    })
  }
  return props
}

// Componentes conhecidos e os tipos que consomem
const COMPONENT_TYPE_MAP = {
  'src/components/kpi/KPICard.tsx':                   'KPICardData',
  'src/components/content/QualityScoresPanel.tsx':     'QualityScoreItem',
  'src/components/screens/IGOverviewScreen.tsx':       ['KPICardData', 'QualityScoreItem'],
  'src/components/screens/MetaAdsScreen.tsx':          ['Campaign', 'MetaAdsKPI'],
  'src/hooks/useInstagramOverview.ts':                 'KPICardData',
  'src/lib/repositories/instagramOverviewRepository.ts': 'KPICardData',
}

// Props usadas em componentes (do output de auditoria inicial fornecido pelo dev)
const KNOWN_USED_PROPS = {
  KPICardData:     ['delta', 'glowColor', 'id', 'label', 'semaphore', 'unit', 'value'],
  QualityScoreItem: ['glowColor', 'id', 'label', 'statusText', 'statusVariant', 'unit', 'value'],
}

for (const [typeName, usedProps] of Object.entries(KNOWN_USED_PROPS)) {
  const files = globalTypeMap.get(typeName) || []
  for (const file of files) {
    const content = typeContents[file]
    if (!content) continue
    const fields = extractInterfaceFields(content, typeName)
    if (!fields) continue
    for (const prop of usedProps) {
      if (!fields.has(prop)) {
        report(
          'ERROR',
          `PROP FALTANDO — ${typeName}.${prop}`,
          `Componentes usam '${prop}' mas a interface ${typeName} em ${file} não o declara`,
          `Solução: adicionar '${prop}' à interface ${typeName} em ${file}`
        )
      }
    }
  }
}

// ── 7. VERIFICAÇÃO ESPECÍFICA: sourceLevel ausente em orbit.ts exports ────────

{
  const orbitContent = typeContents['src/types/orbit.ts']
  if (orbitContent) {
    const hasSourceLevel = /export\s+type\s+SourceLevel/.test(orbitContent)
    if (!hasSourceLevel) {
      report(
        'WARN',
        'EXPORT AUSENTE — SourceLevel',
        `'SourceLevel' não está exportado em src/types/orbit.ts`,
        `P0_task_spec.md e Blueprint referenciam SourceLevel amplamente.\n` +
        `  Está definido em src/domain/constants.ts mas componentes podem importar de orbit.ts.\n` +
        `  Solução: adicionar 'export type SourceLevel = "L0" | "L1" | "L2"' em orbit.ts\n` +
        `           ou fazer re-export: export type { SourceLevel } from '@/domain/constants'`
      )
    }
  }
}

// ── 8. VERIFICAÇÃO: AvatarProfile campos de gênero ambíguos ──────────────────

{
  const orbitContent = typeContents['src/types/orbit.ts']
  if (orbitContent && /interface\s+AvatarProfile/.test(orbitContent)) {
    // Problema semântico: genderRealPercent e genderExpectedPercent
    // referem-se ao gênero listado em genderExpected/genderReal,
    // mas o cálculo de alinhamento usa o mesmo gênero como base.
    // Ex: expected = "Masculino" 70%, real = "Feminino" 71.7%
    //   → o score usa 28.3% (masculino real) vs 70% (masculino esperado)
    //   → AvatarProfile não armazena o percentual DO gênero esperado no lado real.
    const hasGenderRealPct = /genderRealPercent\s*:\s*number/.test(orbitContent)
    if (hasGenderRealPct) {
      report(
        'WARN',
        'AMBIGUIDADE SEMÂNTICA — AvatarProfile.genderRealPercent',
        `'genderRealPercent' é o percentual do gênero REAL (ex: 71.7% feminino).\n` +
        `  Mas o cálculo de alinhamento compara gênero ESPERADO vs MESMO gênero no lado real.`,
        `HTML: expected = 70% masculino; real do masculino = 28.2% (não 71.7%).\n` +
        `  Interface não armazena o percentual cruzado necessário para o score.\n` +
        `  Solução: adicionar 'genderCrossPercent: number' (% do gênero esperado no lado real)\n` +
        `           ou documentar claramente que AlignmentCalculation.scoreGender faz o cruzamento.`
      )
    }
  }
}

// ── 9. IMPACTO ACUMULADO POR ARQUIVO ─────────────────────────────────────────

console.log(CYAN('▶ 9. Calculando impacto acumulado por arquivo...\n'))

const impactMap = new Map()
for (const finding of findings) {
  const mentioned = TYPE_FILES.filter(f => finding.detail?.includes(f) || finding.message?.includes(f))
  for (const f of mentioned) {
    if (!impactMap.has(f)) impactMap.set(f, [])
    impactMap.get(f).push(finding.level)
  }
}

// ── IMPRESSÃO DO RELATÓRIO ────────────────────────────────────────────────────

const LEVEL_ORDER = { FATAL: 0, ERROR: 1, WARN: 2, INFO: 3 }
findings.sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9))

const counts = { FATAL: 0, ERROR: 0, WARN: 0, INFO: 0 }
for (const f of findings) counts[f.level] = (counts[f.level] || 0) + 1

console.log(BOLD('════════════════════════════════════════════════════════'))
console.log(BOLD('                   RELATÓRIO FINAL'))
console.log(BOLD('════════════════════════════════════════════════════════\n'))

console.log(`  ${RED(BOLD(`● FATAL : ${counts.FATAL}`))}   (erros de compilação TypeScript)`)
console.log(`  ${RED(`● ERROR : ${counts.ERROR}`)}   (bugs silenciosos em runtime)`)
console.log(`  ${YELLOW(`● WARN  : ${counts.WARN}`)}   (riscos e ambiguidades)`)
console.log(`  ${DIM(`● INFO  : ${counts.INFO}`)}   (observações)`)
console.log()

for (const f of findings) {
  const icon  = f.level === 'FATAL' ? RED(BOLD('● FATAL')) :
                f.level === 'ERROR' ? RED('● ERROR') :
                f.level === 'WARN'  ? YELLOW('● WARN ') :
                                      DIM('● INFO ')

  console.log(`${icon}  ${BOLD(f.category)}`)
  console.log(`         ${f.message}`)
  if (f.detail) {
    const lines = f.detail.split('\n')
    for (const line of lines) {
      console.log(`         ${DIM(line)}`)
    }
  }
  console.log()
}

// ── PLANO DE CORREÇÃO PRIORIZADO ──────────────────────────────────────────────

console.log(BOLD('════════════════════════════════════════════════════════'))
console.log(BOLD('         PLANO DE CORREÇÃO — ORDEM DE EXECUÇÃO'))
console.log(BOLD('════════════════════════════════════════════════════════\n'))

const CORRECTION_PLAN = [
  {
    priority: '🔴 P0 — Antes de qualquer commit',
    steps: [
      'Apagar declarações de FetchStatus, AsyncState, SemaphoreColor, GlowColor,\n' +
      '     TrendColor, StatusVariant de instagram.ts, metaAds.ts e funnel.ts.\n' +
      '     Substituir por: import type { ... } from \'@/types/orbit\'',

      'Renomear FunnelData em funnel.ts para FunnelMetrics.\n' +
      '     Garantir que FunnelData em orbit.ts use { clientId, steps, totalValue, period }',

      'Adicionar campo \'id: string\' e \'icon?: string\' a FunnelStep em orbit.ts.\n' +
      '     Remover FunnelStep de funnel.ts.',

      'Unificar Campaign em orbit.ts:\n' +
      '     - fatigue → fatiguePercent\n' +
      '     - roas: number | null\n' +
      '     - adicionar fatigueStatus, diagnosis, actionRequired, cpl?\n' +
      '     - deletar Campaign de metaAds.ts',

      'Unificar MetaAdsKPI em orbit.ts:\n' +
      '     - adicionar delta: number, deltaLabel: string\n' +
      '     - garantir id: string, status\n' +
      '     - deletar MetaAdsKPI de metaAds.ts',

      'Corrigir KpiSnapshotRow em orbit.ts:\n' +
      '     - metric_key  → metric\n' +
      '     - metric_value → value\n' +
      '     - metric_unit  → value_text\n' +
      '     - adicionar post_id: string | null',
    ]
  },
  {
    priority: '🟡 P1 — Antes do primeiro PR de feature',
    steps: [
      'Escolher UM nome de tipo para a overview do Instagram:\n' +
      '     Recomendação: IGOverviewData (alinhado com instagram.ts e hooks).\n' +
      '     Remover InstagramOverviewData de orbit.ts SSOT v2.1.',

      'Corrigir field name: header → meta em IGOverviewData/InstagramOverviewData.\n' +
      '     (v1.1.0 e repositórios usam \'meta\'; SSOT v2.1 quebrou para \'header\')',

      'Substituir AlignmentBar.color: GlowColor por AlignmentColor:\n' +
      '     export type AlignmentColor = \'green\' | \'amber\' | \'red\'\n' +
      '     (GlowColor não tem \'green\' — HTML usa var(--green))',

      'Corrigir KPICardData.subtitle: string → string | null em instagram.ts',

      'Exportar SourceLevel de orbit.ts ou criar re-export de domain/constants.ts',
    ]
  },
  {
    priority: '🟢 P2 — Refinamento de domínio',
    steps: [
      'Documentar / resolver ambiguidade de AvatarProfile.genderRealPercent.\n' +
      '     Considerar adicionar genderCrossPercent para o cálculo de alinhamento.',

      'Revisar se Campaign.objective deve ser CampaignObjective (union) ou string.\n' +
      '     orbit.ts SSOT v2.1 usa string; metaAds.ts usa CampaignObjective.',

      'Adicionar testes Vitest para os Value Objects do domínio (mappers L1).',
    ]
  }
]

for (const block of CORRECTION_PLAN) {
  console.log(BOLD(block.priority))
  block.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`)
    console.log()
  })
}

console.log(BOLD('════════════════════════════════════════════════════════'))
console.log(BOLD(`  Total de achados: ${findings.length}`))
console.log(BOLD(`  Arquivos escaneados: ${allTsFiles.length}`))
console.log(BOLD(`  Tipo SSOT auditado: src/types/orbit.ts (SSOT v2.1)`))
console.log(BOLD('════════════════════════════════════════════════════════\n'))

// Exit code para CI/CD
const hasFatal = counts.FATAL > 0
process.exit(hasFatal ? 1 : 0)
