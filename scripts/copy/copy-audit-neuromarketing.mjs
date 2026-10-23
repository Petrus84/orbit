#!/usr/bin/env node
// scripts/copy/copy-audit-neuromarketing.mjs
// Auditoria de copy para o cliente final. Só texto que o usuário lê.
// Uso: node scripts/copy/copy-audit-neuromarketing.mjs [--dir=src] [--only-flagged]

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const dirArg = process.argv.find((a) => a.startsWith('--dir='))
const SRC = path.join(ROOT, dirArg ? dirArg.slice(6) : 'src')
const ONLY_FLAGGED = process.argv.includes('--only-flagged')
const OUT_DIR = path.join(ROOT, 'reports')

// Só o que o cliente final lê. Código, logs e identificadores ficam fora.
const SKIP_ATTRS = new Set([
  'className', 'key', 'id', 'href', 'src', 'type', 'style', 'role',
  'htmlFor', 'name', 'value', 'target', 'rel', 'variant', 'size',
  'color', 'as', 'ref', 'tabIndex', 'width', 'height', 'viewBox',
  'd', 'fill', 'stroke', 'xmlns', 'unit', 'data-testid',
])

const SKIP_PROPS = new Set([
  'error', 'stack', 'code', 'status', 'method', 'url', 'path',
  'filename', 'line', 'column', 'token', 'key', 'hash',
])

// Texto que o cliente lê. Palavras do dia a dia.
const RULES = [
  {
    id: 'TECNICO',
    re: /\b(régua|threshold|snapshot|fallback|payload|dataset|SSOT|RPC|schema|enum|null|NaN|query|hook|render|serialize|deserialize|benchmark|funil|tier|stack|pipeline|workflow|orchestration|reconciliation|waiver|provenance|observation_unit|validation_status)\b/iu,
    severity: 'crítico',
    why: 'O cliente não conhece essa palavra',
    suggestion: 'Troque por o que o número faz',
  },
  {
    id: 'SIGLA',
    re: /\b([A-Z]{2,}|p\.p\.|L[0-9]|v[0-9])\b/,
    severity: 'alto',
    why: 'Sigla exige que o cliente saiba o que é',
    suggestion: 'Escreva por extenso ou explique',
  },
  {
    id: 'NEGACAO',
    re: /^(não|nenhum|nenhuma|nada|sem|falha|erro|problema|nunca)\b/i,
    severity: 'médio',
    why: 'Começa com negação. O cliente lê como falha',
    suggestion: 'Diga o que falta ou o que fazer',
  },
  {
    id: 'SECO',
    test: (t) => /^(erro|sem dados|vazio|nulo|falso|inválido|inativo)$/i.test(t),
    severity: 'alto',
    why: 'Uma palavra sem contexto. O cliente não sabe o que fazer',
    suggestion: 'Diga o que aconteceu e o próximo passo',
  },
  {
    id: 'INGLES',
    re: /\b(loading|error|failed|retry|cancel|submit|no data|click|save|delete|settings|dashboard|insights|metrics|performance|engagement|conversion|audience|followers|content|post|story|reel|feed|profile|bio|link|login|logout)\b/i,
    severity: 'médio',
    why: 'Palavra em inglês. O cliente pode não saber',
    suggestion: 'Traduza',
  },
  {
    id: 'TRAVESSAO',
    re: /\s—\s/,
    severity: 'baixo',
    why: 'Travessão é voz de código',
    suggestion: 'Use ponto ou vírgula',
  },
]

const REWRITES = {
  'Régua': 'Referência',
  'Benchmark': 'Padrão do seu ramo',
  'Funil': 'Seu processo de venda',
  'Snapshot': 'Coleta',
  'Sem dados': 'Nenhum dado ainda. Comece adicionando seu primeiro número.',
  'Erro': 'Algo deu errado. Tente novamente.',
  'Nenhum resultado': 'Nenhum resultado. Tente uma busca diferente.',
  'Carregando': 'Carregando...',
  'Salvando': 'Salvando...',
  'Sucesso': 'Pronto.',
  'Falhou': 'Não conseguimos. Tente de novo.',
  'Sem comparação': 'Sem comparação com o período anterior.',
  'Amostra insuficiente': 'Poucos posts para comparar.',
  'Não calculado': 'Ainda não calculamos esse número.',
  'Método em validação': 'Levantamento próprio. Ainda estamos conferindo.',
  'Waiver P-1': 'Exceção aceita.',
  'Fonte:': 'De onde vem:',
  'Período:': 'Quando:',
  'Método:': 'Como calculamos:',
}

function norm(s) { return s.replace(/\s+/g, ' ').trim() }
function wordsOf(s) { return s.trim().split(/\s+/).filter(Boolean).length }
function hasLetters(s) { return /\p{L}/u.test(s) }

function looksLikeCode(t) {
  if (/^(https?:|\/|\.{1,2}\/|@\/|#[0-9a-f]{3,8}$|var\(|--|rgba?\(|hsla?\(|use (client|strict))/i.test(t)) return true
  const tokens = t.split(' ')
  if (tokens.length >= 2 && tokens.every((x) => /^[!a-z0-9:_\-[\]/.%()#]+$/.test(x))) return true
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
  if (ts.isLiteralTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isCaseClause(p)) return null
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return null
  if (ts.isPropertyAssignment(p) && p.name === node) return null
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return null

  if (ts.isCallExpression(p) && p.arguments.includes(node)) {
    const c = p.expression
    if (c.kind === ts.SyntaxKind.ImportKeyword) return null
    if (ts.isIdentifier(c) && ['require', 'cls', 'fetch', 'Symbol', 'parseInt', 'Number', 'String', 'Date', 'RegExp'].includes(c.text)) return null
    if (ts.isPropertyAccessExpression(c) && ['from', 'select', 'eq', 'neq', 'in', 'order', 'rpc', 'insert', 'update', 'upsert', 'delete', 'or', 'and', 'filter', 'match', 'is', 'gt', 'lt', 'gte', 'lte', 'ilike', 'like', 'contains', 'schema', 'channel', 'on', 'getItem', 'setItem', 'get', 'has', 'add', 'includes', 'startsWith', 'endsWith', 'split', 'replace', 'test', 'querySelector', 'addEventListener', 'removeEventListener'].includes(c.name.text)) return null
  }

  const attr = ts.isJsxAttribute(p) ? p : ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) ? p.parent : null
  if (attr) {
    const name = attr.name.getText()
    if (SKIP_ATTRS.has(name) || name.startsWith('data-')) return null
    if (['title', 'alt', 'placeholder', 'aria-label', 'label', 'helpText', 'subtitle', 'description', 'text', 'tooltip', 'emptyText'].includes(name)) return `attr:${name}`
    return wordsOf(text) >= 2 ? `attr:${name}` : null
  }
  if (ts.isPropertyAssignment(p) && p.initializer === node) {
    const key = p.name.getText()
    if (SKIP_PROPS.has(key)) return null
    if (['label', 'title', 'text', 'description', 'message', 'subtitle', 'statusText', 'actionText', 'referenceNote', 'helpText', 'placeholder', 'body', 'diagnosis', 'actionRequired', 'trendLabel', 'deltaLabel', 'periodLabel', 'note', 'hint', 'caption', 'tooltip', 'suggestedAction', 'immediateAction', 'probableCause', 'emptyMessage', 'heading'].includes(key) && hasLetters(text)) return `prop:${key}`
  }
  if (inJsx(node) && /^[A-ZÀ-Ý][\p{L}]+$/u.test(text)) return 'jsx-expr'
  if (looksLikeCode(text)) return null
  if ((wordsOf(text) >= 2 && hasLetters(text)) || /[À-ÿ]/.test(text)) return 'string'
  return null
}

function flagsOf(text) {
  return RULES.filter((r) => (r.re ? r.re.test(text) : r.test(text))).map((r) => r.id)
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build', 'coverage', '.git'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') && !/\.(test|spec)\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

if (!fs.existsSync(SRC)) { console.error(`Pasta não encontrada: ${SRC}`); process.exit(1) }

const items = []
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind)
  const rel = path.relative(ROOT, file).split(path.sep).join('/')

  const push = (node, k, text) => {
    const flags = flagsOf(text)
    const rules = RULES.filter((r) => flags.includes(r.id))
    items.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, kind: k, text, flags, rules, rewrite: REWRITES[text] || null })
  }

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

const list = ONLY_FLAGGED ? items.filter((i) => i.flags.length) : items
fs.mkdirSync(OUT_DIR, { recursive: true })

const q = (s) => `"${String(s).replace(/"/g, '""')}"`
const csv = '\uFEFF' + ['arquivo;linha;tipo;texto;flags;reescrita', ...list.map((i) => [i.file, i.line, i.kind, q(i.text), i.flags.join(','), q(i.rewrite || '')].join(';'))].join('\n')
fs.writeFileSync(path.join(OUT_DIR, 'copy-audit.csv'), csv, 'utf8')

const flagCount = {}
for (const i of items) for (const f of i.flags) flagCount[f] = (flagCount[f] ?? 0) + 1

let md = `# Auditoria de copy\n\nGerado em ${new Date().toLocaleString('pt-BR')}\n\n`
md += `- Textos: ${items.length}\n`
md += `- Com flag: ${items.filter((i) => i.flags.length).length}\n\n`
for (const [flagId, count] of Object.entries(flagCount).sort((a, b) => b[1] - a[1])) {
  const rule = RULES.find((r) => r.id === flagId)
  md += `## ${flagId} (${count})\n${rule?.why || ''}\nSugestão: ${rule?.suggestion || ''}\n\n`
}
fs.writeFileSync(path.join(OUT_DIR, 'copy-audit.md'), md, 'utf8')

console.log(`Textos: ${items.length}`)
console.log(`Com flag: ${items.filter((i) => i.flags.length).length}`)
console.log(`Críticos: ${items.filter((i) => i.rules.some((r) => r.severity === 'crítico')).length}`)
console.log(`Gerado: reports/copy-audit.csv, reports/copy-audit.md`)