// scripts/copy-audit.mjs
// Uso:
//   node scripts/copy-audit.mjs
//   node scripts/copy-audit.mjs --only-flagged
//   node scripts/copy-audit.mjs --dir=src/components --include-tests
// Saída: reports/copy-audit.csv  e  reports/copy-audit.md

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const dirArg = process.argv.find((a) => a.startsWith('--dir='))
const SRC = path.join(ROOT, dirArg ? dirArg.slice(6) : 'src')
const ONLY_FLAGGED = process.argv.includes('--only-flagged')
const INCLUDE_TESTS = process.argv.includes('--include-tests')
const OUT_DIR = path.join(ROOT, 'reports')

/* ───────────── regras de voz (ajuste à vontade) ───────────── */
const RULES = [
  { id: 'PLURAL_PAREN', re: /\p{L}\((?:s|es|ões|oes|is|ns)\)/iu, why: 'plural com parênteses — pluralize de verdade' },
  { id: 'JARGAO', re: /\b(r[ée]gua|threshold|snapshot|fallback|payload|dataset|SSOT|RPC|engine|mapper|schema|enum|null|undefined|NaN|TODO|FIXME|hardcod\w*)\b/iu, why: 'termo interno que o cliente não conhece' },
  { id: 'TOKEN_TECNICO', re: /\b[a-z]+(?:_[a-z0-9]+)+\b/, why: 'identificador snake_case dentro do texto' },
  { id: 'SEM_ACENTO', re: /\b(acao|nao|metrica|periodo|publicacao|usuario|configuracao|analise|conversao|informacao|descricao|voce|tambem|saude|conteudo|audiencia)\b/i, why: 'palavra em português sem acento' },
  { id: 'INGLES', re: /\b(loading|error|failed|retry|cancel|submit|no data|something went wrong|please|click|save|delete|settings)\b/i, why: 'resto de inglês' },
  { id: 'COMECA_COM_SEM', re: /^Sem\b/, why: 'começa confessando ausência — avaliar reenquadrar' },
  { id: 'NEGACAO_SECA', re: /^(n[aã]o|nenhum|nenhuma|nada)\b/i, why: 'abre com negação seca' },
  { id: 'LACONICO', test: (t) => t.length <= 12 && !/[!?]/.test(t) && /^(n\/?a|erro|sem dados|—|-)\.?$/i.test(t), why: 'curto demais / sem contexto' },
  { id: 'TRAVESSAO', re: /\s—\s/, why: 'travessão como separador (voz de log)' },
  { id: 'SIGLA', re: /\bp\.p\.|\bvs\.?\b/i, why: 'abreviação pouco amigável (p.p., vs)' },
  { id: 'CAIXA_ALTA', re: /\b[A-ZÀ-Ý]{4,}\b/u, why: 'CAIXA ALTA (pode ser só CSS uppercase)' },
]

/* ───────────── filtros de contexto ───────────── */
const SKIP_ATTRS = new Set(['className', 'key', 'id', 'href', 'src', 'type', 'style', 'role', 'htmlFor', 'name', 'value', 'target', 'rel', 'variant', 'size', 'color', 'glowColor', 'as', 'ref', 'tabIndex', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'unit'])
const KEEP_ATTRS = new Set(['title', 'alt', 'placeholder', 'aria-label', 'label', 'helpText', 'subtitle', 'description', 'text', 'tooltip', 'emptyText'])
const USER_KEYS = new Set(['label', 'title', 'text', 'description', 'message', 'subtitle', 'statusText', 'actionText', 'referenceNote', 'helpText', 'placeholder', 'body', 'diagnosis', 'actionRequired', 'trendLabel', 'deltaLabel', 'periodLabel', 'note', 'hint', 'caption', 'tooltip', 'suggestedAction', 'immediateAction', 'probableCause', 'error', 'emptyMessage', 'heading'])
const SKIP_CALL_PROPS = new Set(['from', 'select', 'eq', 'neq', 'in', 'order', 'rpc', 'insert', 'update', 'upsert', 'delete', 'or', 'and', 'filter', 'match', 'is', 'gt', 'lt', 'gte', 'lte', 'ilike', 'like', 'contains', 'schema', 'channel', 'on', 'getItem', 'setItem', 'get', 'has', 'add', 'includes', 'startsWith', 'endsWith', 'split', 'replace', 'test', 'querySelector', 'addEventListener', 'removeEventListener'])
const SKIP_CALL_IDS = new Set(['require', 'cls', 'fetch', 'Symbol', 'parseInt', 'Number', 'String', 'Date', 'RegExp'])
const COMPARE_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
])

/* ───────────── utilitários ───────────── */
const norm = (s) => s.replace(/\s+/g, ' ').trim()
const wordsOf = (s) => s.trim().split(/\s+/).filter(Boolean).length
const hasLetters = (s) => /\p{L}/u.test(s)

function looksLikeCode(t) {
  if (/^(https?:|\/|\.{1,2}\/|@\/|#[0-9a-f]{3,8}$|var\(|--|rgba?\(|hsla?\(|use (client|strict))/i.test(t)) return true
  const tokens = t.split(' ')
  if (tokens.length >= 2 && tokens.every((x) => /^[!a-z0-9:_\-[\]/.%()#]+$/.test(x)) && tokens.some((x) => /[-:[]/.test(x))) return true
  return false
}

function textOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  let s = node.head.text
  for (const sp of node.templateSpans) s += '{' + sp.expression.getText().slice(0, 30) + '}' + sp.literal.text
  return s
}

function inJsx(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return true
  }
  return false
}

function classify(node, text) {
  const p = node.parent
  if (!p) return null
  if (ts.isLiteralTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isCaseClause(p) || ts.isExternalModuleReference(p)) return null
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return null
  if (ts.isPropertyAssignment(p) && p.name === node) return null
  if (ts.isBinaryExpression(p) && COMPARE_OPS.has(p.operatorToken.kind)) return null

  if (ts.isCallExpression(p) && p.arguments.includes(node)) {
    const c = p.expression
    if (c.kind === ts.SyntaxKind.ImportKeyword) return null
    if (ts.isIdentifier(c) && SKIP_CALL_IDS.has(c.text)) return null
    if (ts.isPropertyAccessExpression(c)) {
      if (ts.isIdentifier(c.expression) && c.expression.text === 'console') return null
      if (SKIP_CALL_PROPS.has(c.name.text)) return null
    }
  }
  if (ts.isNewExpression(p) && p.arguments?.includes(node) && /Error$/.test(p.expression.getText())) return 'erro'

  const attr = ts.isJsxAttribute(p) ? p : ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) ? p.parent : null
  if (attr) {
    const name = attr.name.getText()
    if (SKIP_ATTRS.has(name) || name.startsWith('data-')) return null
    if (KEEP_ATTRS.has(name)) return `attr:${name}`
    return wordsOf(text) >= 2 ? `attr:${name}` : null
  }
  if (ts.isPropertyAssignment(p) && p.initializer === node) {
    const key = p.name.getText()
    if (USER_KEYS.has(key) && hasLetters(text)) return `prop:${key}`
  }
  if (inJsx(node) && /^[A-ZÀ-Ý][\p{L}]+$/u.test(text)) return 'jsx-expr'
  if (/^n\/?a$/i.test(text)) return 'string'
  if (looksLikeCode(text)) return null
  if ((wordsOf(text) >= 2 && hasLetters(text)) || /[À-ÿ]/.test(text)) return 'string'
  return null
}

function flagsOf(text) {
  return RULES.filter((r) => (r.re ? r.re.test(text) : r.test(text))).map((r) => r.id)
}

/* ───────────── varredura ───────────── */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build', 'coverage'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      if (!INCLUDE_TESTS && /\.(test|spec)\.(ts|tsx)$/.test(e.name)) continue
      out.push(p)
    }
  }
  return out
}

if (!fs.existsSync(SRC)) {
  console.error(`Pasta não encontrada: ${SRC}`)
  process.exit(1)
}

const items = []
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind)
  const rel = path.relative(ROOT, file).split(path.sep).join('/')

  const push = (node, k, text) =>
    items.push({
      file: rel,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      kind: k,
      text,
      flags: flagsOf(text),
    })

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isJsxText(node)) {
      const t = norm(node.text)
      if (t && hasLetters(t)) push(node, 'jsx-text', t)
      return
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const t = norm(textOf(node))
      const k = t && classify(node, t)
      if (k) push(node, k, t)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

/* ───────────── relatório ───────────── */
const list = ONLY_FLAGGED ? items.filter((i) => i.flags.length) : items
fs.mkdirSync(OUT_DIR, { recursive: true })

const q = (s) => `"${String(s).replace(/"/g, '""')}"`
const csv =
  '\uFEFF' +
  ['arquivo;linha;tipo;texto;flags', ...list.map((i) => [i.file, i.line, i.kind, q(i.text), i.flags.join(',')].join(';'))].join('\n')
fs.writeFileSync(path.join(OUT_DIR, 'copy-audit.csv'), csv, 'utf8')

const flagCount = {}
for (const i of items) for (const f of i.flags) flagCount[f] = (flagCount[f] ?? 0) + 1
const byFile = new Map()
for (const i of list) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i])
const dup = new Map()
for (const i of items) dup.set(i.text, [...(dup.get(i.text) ?? []), `${i.file}:${i.line}`])

let md = `# Auditoria de copy\n\nGerado em ${new Date().toLocaleString('pt-BR')} · pasta \`${path.relative(ROOT, SRC)}\`\n\n`
md += `- Textos encontrados: **${items.length}**\n- Com alguma flag: **${items.filter((i) => i.flags.length).length}**\n\n`
md += `## Flags\n\n` + RULES.map((r) => `- **${r.id}** (${flagCount[r.id] ?? 0}) — ${r.why}`).join('\n') + '\n\n'
md += `## Por arquivo\n\n`
for (const [file, arr] of [...byFile.entries()].sort((a, b) => b[1].filter((x) => x.flags.length).length - a[1].filter((x) => x.flags.length).length)) {
  md += `### ${file}\n\n`
  for (const i of arr) md += `- L${i.line} \`${i.kind}\` ${JSON.stringify(i.text)}${i.flags.length ? ` ⚑ ${i.flags.join(', ')}` : ''}\n`
  md += '\n'
}
const repeated = [...dup.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => b[1].length - a[1].length)
if (repeated.length) {
  md += `## Textos repetidos (3x ou mais) — candidatos a um texto único\n\n`
  for (const [t, locs] of repeated) md += `- ${JSON.stringify(t)} — ${locs.length}x\n`
}
fs.writeFileSync(path.join(OUT_DIR, 'copy-audit.md'), md, 'utf8')

console.log(`\nTextos: ${items.length} | com flag: ${items.filter((i) => i.flags.length).length}`)
console.table(Object.fromEntries(Object.entries(flagCount).sort((a, b) => b[1] - a[1])))
console.log('Gerado: reports/copy-audit.csv e reports/copy-audit.md')