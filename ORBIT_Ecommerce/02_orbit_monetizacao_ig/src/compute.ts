// ============================================================================
// compute.ts — Calibração (L0, dado próprio real) + Inferência (L1, scraping)
// das 4 métricas ocultas: Alcance, Salvamentos, Visitas ao Perfil, Cliques.
//
// Este arquivo assume duas fontes de entrada:
//   1) Pasta(s) de export oficial do Instagram ("Baixar seus dados") de
//      contas próprias — usadas SÓ para calibrar, nunca para inferir sobre
//      elas mesmas (você já tem o dado real, não precisa de estimativa).
//   2) manifest.json produzido pelo ingest.ts — contas L1 (scraping), onde
//      as 4 métricas não existem e precisam ser inferidas.
//
// ACHADO ESTRUTURAL (de processar os 5 arquivos reais que você mandou):
// o export oficial NUNCA traz likes/comments por post — só agregado por
// período (uma linha por conta: "Mar 8 - Jun 5"). Isso significa que a
// calibração roda no nível CONTA/PERÍODO, não POST — um (X,Y) por conta,
// nunca um por post. Com poucas contas L0, n é pequeno por construção,
// não por falta de esforço de coleta — é a estrutura da fonte de dado.
// Todo o código abaixo assume isso e nunca finge ter mais amostra do que
// realmente tem.
// ============================================================================

import 'dotenv/config' // consistência com ingest.ts — compute.ts não precisa de APIFY_TOKEN hoje, mas L0_OWN_EXPORTS_DIR/L1_MANIFEST podem vir de .env no futuro
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import path from 'path'
import { FOLLOWER_TIERS, tierForFollowers, normalizeHandle } from './tiers'

// ----------------------------------------------------------------------------
// PORTE REAL DAS CONTAS L0 — CORREÇÃO IMPORTANTE.
// O export oficial do Instagram NÃO traz o total de seguidores da conta —
// `followers_1.json` é a lista de seguidores GANHOS dentro do período
// selecionado no export, não o total histórico. Confirmado processando o
// dado real: o tamanho dessa lista às vezes bate com "Seguidores" de
// audience_insights.json, às vezes não (depende de quantos deixaram de
// seguir no meio do caminho) — mas NUNCA é o total da conta.
//
// Sem outra fonte no export, o total real precisa vir de fora (o próprio
// usuário informou, ou de um profile-fetch via Apify, igual o ingest.ts já
// faz pra contas L1). Mapa manual abaixo — trocar por lookup automático
// assim que houver uma fonte melhor.
// ----------------------------------------------------------------------------

// Chaves já passadas por normalizeHandle mentalmente (são todas minúsculas,
// sem @, sem barra) — mas o lookup abaixo SEMPRE normaliza o handle recebido
// antes de indexar aqui, então isso nunca depende de digitar certo à mão.
const REAL_FOLLOWER_COUNTS: Record<string, number> = {
  eupetruchio: 3900,     // @eupetruchio84
  dogativo: 42,
  mauricio: 742,         // @mauriciogomes.artphoto
  cpimportstore: 1757,
  djcaiodogao: 12700,    // @caiopanighel
}

// FOLLOWER_TIERS e tierForFollowers agora vêm de ./tiers (SSOT compartilhado
// com ingest.ts) — antes desta correção as duas cópias já batiam, mas eram
// mantidas por texto igual em dois arquivos, sem nenhuma garantia de que
// continuariam batendo depois da próxima edição em só um dos dois.

// ----------------------------------------------------------------------------
// PARSER L0 — 3 variantes de schema encontradas nos arquivos reais:
// PT-BR ("Curtidas do post"), PT-PT ("Gostos em publicações"), EN ("Post
// Likes"). Mais um bug de mojibake real (double-encoding UTF-8/Latin-1:
// "alcanÃ§adas" em vez de "alcançadas") que corrompe toda leitura de campo
// com acento se não for corrigido antes de comparar strings.
// ----------------------------------------------------------------------------

function fixMojibake(s: string): string {
  try {
    return Buffer.from(s, 'latin1').toString('utf-8')
  } catch {
    return s
  }
}

function deepFixMojibake<T>(obj: T): T {
  if (typeof obj === 'string') return fixMojibake(obj) as unknown as T
  if (Array.isArray(obj)) return obj.map(deepFixMojibake) as unknown as T
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[fixMojibake(k)] = deepFixMojibake(v)
    }
    return out as unknown as T
  }
  return obj
}

// campo canônico -> todas as grafias já observadas em dado real
const FIELD_SYNONYMS: Record<string, string[]> = {
  posts_likes: ['Curtidas do post', 'Gostos em publicações', 'Post Likes'],
  posts_comments: ['Comentários do post', 'Comentários em publicações', 'Post Comments'],
  posts_shares: ['Compartilhamento do post', 'Partilhas de publicações', 'Post Shares'],
  posts_saves: ['Salvamentos do post', 'Pub. guardada', 'Post Saves'],
  reels_likes: ['Curtidas em vídeos do Reels', 'Gostos nos reels', 'Reels Likes'],
  reels_comments: ['Comentários em reels', 'Comentários nos reels', 'Reels Comments'],
  reels_shares: ['Compartilhamentos de vídeos do Reels', 'Partilhas de reels', 'Reels Shares'],
  reels_saves: ['Salvamentos de vídeos do Reels', 'Reels guardados', 'Reels Saves'],
  reach: ['Contas alcançadas', 'Accounts Reached'],
  impressions: ['Impressões', 'Impressions'],
  profile_visits: ['Visitas ao perfil', 'Profile visits'],
  link_taps: ['Toques em links externos', 'External link taps'],
  period: ['Intervalo de datas', 'Date Range'],
}

interface L0AccountSnapshot {
  handle: string
  period: string | null
  posts_likes: number | null
  posts_comments: number | null
  reels_likes: number | null
  reels_comments: number | null
  posts_saves: number | null
  reels_saves: number | null
  reach: number | null
  impressions: number | null
  profile_visits: number | null
  link_taps: number | null
  /** seguidores GANHOS no período do export — NÃO é o total da conta (ver nota acima) */
  new_followers_in_period: number | null
  /** total real de seguidores — só disponível via REAL_FOLLOWER_COUNTS (fonte externa) */
  real_followers: number | null
  tier: string | null
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/,/g, '').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// isDir — guard que faltava. readdirSync().filter(existsSync) não distingue
// arquivo de pasta; um arquivo solto na raiz de l0_own_exports (ex.:
// "desktop.ini", comum em pastas exportadas/copiadas no Windows, ou um
// .DS_Store no mac) passava no filtro antigo e depois quebrava com ENOTDIR
// na primeira tentativa de tratar aquele "handle" como diretório de conta.
function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function findLatestFile(dir: string, suffix: string): string | null {
  if (!existsSync(dir) || !isDir(dir)) return null
  const matches = readdirSync(dir).filter((f: string) => f.endsWith(suffix)).sort()
  return matches.length ? path.join(dir, matches[matches.length - 1]) : null
}

function readJsonFixed(filePath: string | null): any {
  if (!filePath) return null
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  return deepFixMojibake(raw)
}

function getField(container: Record<string, any>, canonical: string, isMapData: boolean): unknown {
  for (const label of FIELD_SYNONYMS[canonical]) {
    if (isMapData) {
      if (container[label]) return container[label].value
    } else {
      if (label in container) return container[label]
    }
  }
  return null
}

/**
 * Lê a pasta de export de UMA conta L0 e devolve o snapshot agregado do
 * período. Cobre os dois formatos de arquivo já vistos:
 *  - PT (BR/PT): { organic_insights_X: [{ string_map_data: {...} }] }
 *  - EN:         { title, data: {...} }
 */
function parseL0Account(handle: string, dir: string): L0AccountSnapshot {
  const ci = readJsonFixed(findLatestFile(dir, 'content_interactions.json'))
  const pr = readJsonFixed(findLatestFile(dir, 'profiles_reached.json'))
  const followersFile = readJsonFixed(findLatestFile(dir, 'followers_1.json'))

  const isEnglish = ci !== null && 'data' in ci
  const ciData = isEnglish ? ci?.data ?? {} : ci?.organic_insights_interactions?.[0]?.string_map_data ?? {}
  const prData = isEnglish ? pr?.data ?? {} : pr?.organic_insights_reach?.[0]?.string_map_data ?? {}
  const isMapData = !isEnglish

  let newFollowersInPeriod: number | null = null
  if (Array.isArray(followersFile)) {
    newFollowersInPeriod = followersFile.length
  } else if (followersFile && typeof followersFile === 'object' && 'entries' in followersFile) {
    newFollowersInPeriod = followersFile.entry_count ?? followersFile.entries.length
  }

  const realFollowers = REAL_FOLLOWER_COUNTS[normalizeHandle(handle)] ?? null
  if (realFollowers === null) {
    console.warn(`  ⚠️  ${handle} sem porte real cadastrado em REAL_FOLLOWER_COUNTS — conta não entra em nenhum tier, calibração dela fica sem checagem de compatibilidade`)
  }

  return {
    handle: normalizeHandle(handle),
    period: (getField(ciData, 'period', isMapData) ?? getField(prData, 'period', isMapData)) as string | null,
    posts_likes: toNum(getField(ciData, 'posts_likes', isMapData)),
    posts_comments: toNum(getField(ciData, 'posts_comments', isMapData)),
    reels_likes: toNum(getField(ciData, 'reels_likes', isMapData)),
    reels_comments: toNum(getField(ciData, 'reels_comments', isMapData)),
    posts_saves: toNum(getField(ciData, 'posts_saves', isMapData)),
    reels_saves: toNum(getField(ciData, 'reels_saves', isMapData)),
    reach: toNum(getField(prData, 'reach', isMapData)),
    impressions: toNum(getField(prData, 'impressions', isMapData)),
    profile_visits: toNum(getField(prData, 'profile_visits', isMapData)),
    link_taps: toNum(getField(prData, 'link_taps', isMapData)),
    new_followers_in_period: newFollowersInPeriod,
    real_followers: realFollowers,
    tier: tierForFollowers(realFollowers)?.key ?? null,
  }
}

/**
 * looksLikeL1ManifestDir — detector da colisão L0/L1.
 *
 * Achado real (2026-08): o diretório apontado por L0_EXPORT_DIR continha,
 * por engano, os dados L1 do benchmark scraper (manifest.json na raiz +
 * subpastas por CATEGORIA de monetização, ex. "1_ecommerce_direto"), não
 * o export oficial do Instagram por CONTA (subpastas = handle, cada uma
 * com content_interactions.json/profiles_reached.json/followers_1.json).
 * Aplicar parseL0Account em cima disso não crasha necessariamente — ele só
 * devolve tudo null silenciosamente (nenhum content_interactions.json
 * dentro de "1_ecommerce_direto/", porque ali dentro tem outra estrutura).
 * O resultado é uma "calibração" com n=0 sem nenhum erro visível, ou pior,
 * calibrando sobre lixo se algum arquivo tiver nome parecido por acaso.
 *
 * A assinatura mais barata e confiável pra detectar isso sem abrir todos
 * os arquivos: manifest.json na raiz do diretório (L0 real nunca tem isso
 * — cada conta L0 é uma pasta com os JSONs de export dentro, sem
 * manifesto agregador) OU pelo menos uma subpasta cujo nome bate no
 * padrão "N_algo" usado pelas 8 categorias de monetização.
 */
function looksLikeL1ManifestDir(dir: string): boolean {
  if (!existsSync(dir) || !isDir(dir)) return false
  const entries = readdirSync(dir)
  if (entries.includes('manifest.json')) return true
  return entries.some((e) => /^\d_[a-z_]+$/.test(e) && isDir(path.join(dir, e)))
}

function parseAllL0Accounts(baseDir: string): L0AccountSnapshot[] {
  if (!existsSync(baseDir) || !isDir(baseDir)) return []
  const handles = readdirSync(baseDir).filter((f: string) => !f.startsWith('.') && isDir(path.join(baseDir, f)))
  return handles.map((h) => parseL0Account(normalizeHandle(h), path.join(baseDir, h)))
}

// ----------------------------------------------------------------------------
// CALIBRAÇÃO — um (X,Y) por conta/período, nunca por post. Cada ratio só
// usa contas onde os DOIS lados do par existem — nunca trata null como 0
// (ausência de campo no schema é diferente de valor zero real).
// ----------------------------------------------------------------------------

interface CalibrationRatio {
  metric: 'reach' | 'saves' | 'visits' | 'clicks'
  n: number
  values: Array<{ handle: string; value: number }>
  median: number | null
  mean: number | null
  confidence: 'insuficiente' | 'leve' | 'robusta' | 'mercado_fallback'
  baseline_margin_pct: number // piso do documento original — nunca ir abaixo disso com n pequeno
  excluded_outliers: Array<{ handle: string; value: number; motivo: string }>
  /** tiers de porte cobertos pelas contas que entraram nesta calibração — usar pra checar compatibilidade com o lead L1 antes de aplicar */
  tiers_represented: string[]
}

function tiersOf(accounts: L0AccountSnapshot[], handles: string[]): string[] {
  const set = new Set<string>()
  for (const h of handles) {
    const acc = accounts.find((a) => a.handle === h)
    if (acc?.tier) set.add(acc.tier)
  }
  return Array.from(set)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

function confidenceFromN(n: number): CalibrationRatio['confidence'] {
  if (n < 3) return 'insuficiente'
  if (n < 8) return 'leve'
  return 'robusta'
}

function calibrateReach(accounts: L0AccountSnapshot[]): CalibrationRatio {
  const values: Array<{ handle: string; value: number }> = []
  for (const a of accounts) {
    // exige comments separado de posts — accounts sem essa quebra (schema PT-BR
    // "Interações com posts" agregado) não entram, pra não subestimar o engajamento
    if (a.posts_comments === null || a.reach === null || !a.reach) continue
    const engagement = (a.posts_likes ?? 0) + a.posts_comments + (a.reels_likes ?? 0) + (a.reels_comments ?? 0)
    values.push({ handle: a.handle, value: engagement / a.reach })
  }
  const nums = values.map((v) => v.value)
  return {
    metric: 'reach', n: values.length, values, median: median(nums),
    mean: nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null,
    confidence: confidenceFromN(values.length), baseline_margin_pct: 40, excluded_outliers: [],
    tiers_represented: tiersOf(accounts, values.map((v) => v.handle)),
  }
}

function calibrateSaves(accounts: L0AccountSnapshot[]): CalibrationRatio {
  const values: Array<{ handle: string; value: number }> = []
  for (const a of accounts) {
    // exige posts_saves E reels_saves não-nulos — parcial (só um dos dois) subestima e não entra
    if (a.posts_saves === null || a.reels_saves === null) continue
    const saves = a.posts_saves + a.reels_saves
    const likes = (a.posts_likes ?? 0) + (a.reels_likes ?? 0)
    if (likes === 0) continue
    values.push({ handle: a.handle, value: saves / likes })
  }
  const nums = values.map((v) => v.value)
  return {
    metric: 'saves', n: values.length, values, median: median(nums),
    mean: nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null,
    confidence: confidenceFromN(values.length), baseline_margin_pct: 50, excluded_outliers: [],
    tiers_represented: tiersOf(accounts, values.map((v) => v.handle)),
  }
}

function calibrateVisits(accounts: L0AccountSnapshot[]): CalibrationRatio {
  const values: Array<{ handle: string; value: number }> = []
  const excluded: CalibrationRatio['excluded_outliers'] = []
  for (const a of accounts) {
    if (a.profile_visits === null || !a.reach) continue
    const rate = a.profile_visits / a.reach
    // visitas > alcance é estruturalmente possível (busca/tags não passam pelo
    // reach de conteúdo), mas distorce a razão — exclui como ponto fora da
    // curva do MODELO (não do fenômeno, que é real), igual o achado do dogativo
    if (rate > 1) {
      excluded.push({ handle: a.handle, value: rate, motivo: 'visitas > alcance — fonte de visita fora do reach de conteúdo (busca/tag), distorce a razão' })
      continue
    }
    values.push({ handle: a.handle, value: rate })
  }
  const nums = values.map((v) => v.value)
  return {
    metric: 'visits', n: values.length, values, median: median(nums),
    mean: nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null,
    confidence: confidenceFromN(values.length), baseline_margin_pct: 60, excluded_outliers: excluded,
    tiers_represented: tiersOf(accounts, values.map((v) => v.handle)),
  }
}

function calibrateClicks(accounts: L0AccountSnapshot[]): CalibrationRatio {
  const values: Array<{ handle: string; value: number }> = []
  for (const a of accounts) {
    if (a.link_taps === null || !a.profile_visits) continue
    values.push({ handle: a.handle, value: a.link_taps / a.profile_visits })
  }
  const nums = values.map((v) => v.value)
  return {
    metric: 'clicks', n: values.length, values, median: median(nums),
    mean: nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null,
    confidence: confidenceFromN(values.length), baseline_margin_pct: 35, excluded_outliers: [],
    tiers_represented: tiersOf(accounts, values.map((v) => v.handle)),
  }
}

interface CalibrationSet {
  reach: CalibrationRatio
  saves: CalibrationRatio
  visits: CalibrationRatio
  clicks: CalibrationRatio
  calibrated_at: string
  source_accounts: string[]
}

/**
 * buildFallbackCalibration — rede de segurança de 'mercado_fallback'.
 *
 * Usada SÓ quando l0Dir não produz nenhuma conta L0 utilizável (pasta
 * vazia, inexistente, ou — o caso real encontrado — apontada por engano
 * para o diretório L1, ver looksLikeL1ManifestDir). Em vez de crashar o
 * pipeline inteiro (comportamento anterior) ou de inventar uma margem sem
 * fonte, este fallback deriva um proxy de "alcance típico" a partir do
 * ENGAGEMENT REAL já coletado nas contas L1 (engagement.median_er, que o
 * ingest.ts calcula de likes+comments/followers reais de cada lead) — não
 * é um número de mercado inventado, é a mediana observada no próprio
 * dataset de benchmark que a pessoa já raspou. A margem de erro fica
 * deliberadamente mais larga (80%) e a confiança marcada como
 * 'mercado_fallback' — nunca deve ser confundida com uma calibração L0
 * real (confidence 'insuficiente'/'leve'/'robusta').
 */
function buildFallbackCalibration(l1ManifestPath: string): CalibrationSet {
  const fallbackRatio = (): CalibrationRatio => ({
    metric: 'reach', n: 0, values: [], median: null, mean: null,
    confidence: 'insuficiente', baseline_margin_pct: 80, excluded_outliers: [], tiers_represented: [],
  })

  let median_er_values: number[] = []
  try {
    if (existsSync(l1ManifestPath)) {
      const manifest = JSON.parse(readFileSync(l1ManifestPath, 'utf-8')) as Array<{
        engagement?: { median_er?: number | null }
      }>
      median_er_values = manifest
        .map((a) => a.engagement?.median_er)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    }
  } catch {
    // sem manifest L1 legível — fallback fica em 'insuficiente' puro, sem inventar nada
  }

  const reach = fallbackRatio()
  if (median_er_values.length > 0) {
    const sorted = [...median_er_values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    reach.n = sorted.length
    reach.median = 1 / med // ER reverso: reach ~ engagement / ER_mediana
    reach.mean = reach.median
    reach.confidence = 'mercado_fallback'
    reach.tiers_represented = []
  }

  return {
    reach,
    saves: fallbackRatio(),
    visits: fallbackRatio(),
    clicks: fallbackRatio(),
    calibrated_at: new Date().toISOString(),
    source_accounts: [],
  }
}

function buildCalibration(l0Dir: string, l1ManifestPathForFallback?: string): CalibrationSet {
  if (looksLikeL1ManifestDir(l0Dir)) {
    console.warn(
      `  ⚠️  ${l0Dir} tem a assinatura de um diretório L1 (manifest.json e/ou subpastas de categoria), não de export L0 oficial por conta.` +
        ` Ignorando como fonte de calibração L0 para não calibrar sobre dado errado — usando fallback de mercado (ver 'mercado_fallback').`
    )
    return buildFallbackCalibration(l1ManifestPathForFallback ?? path.join(path.dirname(l0Dir), 'l0_exports', 'manifest.json'))
  }

  const accounts = parseAllL0Accounts(l0Dir)
  if (accounts.length === 0) {
    console.warn(`  ⚠️  Nenhuma conta L0 encontrada em ${l0Dir} — usando fallback de mercado em vez de crashar o pipeline.`)
    return buildFallbackCalibration(l1ManifestPathForFallback ?? path.join(path.dirname(l0Dir), 'l0_exports', 'manifest.json'))
  }
  return {
    reach: calibrateReach(accounts),
    saves: calibrateSaves(accounts),
    visits: calibrateVisits(accounts),
    clicks: calibrateClicks(accounts),
    calibrated_at: new Date().toISOString(),
    source_accounts: accounts.map((a) => a.handle),
  }
}

// ----------------------------------------------------------------------------
// INFERÊNCIA EM L1 — nunca retorna ponto exato. Toda estimativa carrega
// valor central, intervalo, margem, método e o n que a calibrou.
// ----------------------------------------------------------------------------

interface HiddenMetricEstimate {
  metric: 'alcance' | 'salvamentos' | 'visitas_ao_perfil' | 'cliques_no_link'
  point_estimate: number | null
  lower: number | null
  upper: number | null
  margin_pct: number
  method: string
  calibration_n: number
  confidence: CalibrationRatio['confidence'] | 'sem_calibracao'
  display: string // string pronta pra exibir — nunca um número pelado
  note: string
}

function withRange(value: number | null, marginPct: number): { lower: number | null; upper: number | null } {
  if (value === null) return { lower: null, upper: null }
  const f = marginPct / 100
  return { lower: value * (1 - f), upper: value * (1 + f) }
}

/**
 * Checagem de compatibilidade de tier — o achado mais caro desta rodada.
 * As 5 contas L0 disponíveis hoje são TODAS nano/micro (<20k seguidores).
 * Aplicar essa calibração num lead mega (ex.: bruno_perini, com posts de
 * 300k+ likes) é extrapolação fora do domínio calibrado — ER de conta
 * pequena não se transfere pra conta grande (audiência pequena tende a ser
 * proporcionalmente mais engajada; contas grandes diluem alcance por
 * seguidor). Sem tier compatível, a função se recusa a devolver um número
 * com aparência de confiável.
 */
function checkTierCompatibility(targetFollowers: number | null, cal: CalibrationRatio): { compatible: boolean; note: string } {
  if (targetFollowers === null) {
    return { compatible: true, note: 'porte do lead desconhecido — não foi possível checar compatibilidade de tier, tratar com cautela extra' }
  }
  const targetTier = tierForFollowers(targetFollowers)
  if (!targetTier) return { compatible: true, note: 'tier do lead indeterminado' }
  if (cal.tiers_represented.includes(targetTier.key)) {
    return { compatible: true, note: `tier do lead (${targetTier.label}) coberto pela calibração` }
  }
  return {
    compatible: false,
    note: `FORA DO DOMÍNIO CALIBRADO: lead é tier ${targetTier.label}, calibração só cobre [${cal.tiers_represented.join(', ') || 'nenhum tier identificado'}]. Estimativa é extrapolação, não interpolação — declarar isso explicitamente ou recusar o número.`,
  }
}

function estimateReach(likes: number, comments: number, cal: CalibrationRatio, targetFollowers: number | null = null): HiddenMetricEstimate {
  if (cal.median === null || cal.confidence === 'insuficiente') {
    return {
      metric: 'alcance', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'ER reverso', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'sem calibração suficiente para estimar', note: `n=${cal.n} — abaixo do mínimo pra qualquer estimativa responsável`,
    }
  }
  const tierCheck = checkTierCompatibility(targetFollowers, cal)
  if (!tierCheck.compatible) {
    return {
      metric: 'alcance', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'ER reverso', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'RECUSADO — fora do domínio calibrado (ver note)', note: tierCheck.note,
    }
  }
  const est = (likes + comments) / cal.median
  const { lower, upper } = withRange(est, cal.baseline_margin_pct)
  return {
    metric: 'alcance', point_estimate: est, lower, upper, margin_pct: cal.baseline_margin_pct,
    method: `ER reverso (mediana calibrada em n=${cal.n} contas L0, tiers=[${cal.tiers_represented.join(',')}])`, calibration_n: cal.n, confidence: cal.confidence,
    display: `${Math.round(lower!)} – ${Math.round(upper!)} (±${cal.baseline_margin_pct}%)`,
    note: `${tierCheck.note}. ${cal.confidence === 'leve' ? 'Calibração leve — tratar como ordem de grandeza, não valor confiável ponto a ponto.' : 'Calibração robusta.'}`,
  }
}

function estimateSaves(likes: number, cal: CalibrationRatio, targetFollowers: number | null = null): HiddenMetricEstimate {
  if (cal.median === null) {
    return {
      metric: 'salvamentos', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'ratio saves/likes', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'sem calibração suficiente', note: `n=${cal.n}`,
    }
  }
  const tierCheck = checkTierCompatibility(targetFollowers, cal)
  if (!tierCheck.compatible) {
    return {
      metric: 'salvamentos', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'ratio saves/likes', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'RECUSADO — fora do domínio calibrado', note: tierCheck.note,
    }
  }
  const est = likes * cal.median
  const { lower, upper } = withRange(est, cal.baseline_margin_pct)
  return {
    metric: 'salvamentos', point_estimate: est, lower, upper, margin_pct: cal.baseline_margin_pct,
    method: `ratio saves/likes (n=${cal.n})`, calibration_n: cal.n, confidence: cal.confidence,
    display: `sinal qualitativo — ordem de grandeza ${Math.round(lower!)}–${Math.round(upper!)}, NUNCA citar como contagem exata`,
    note: 'n<3: tratar como direção (alto/médio/baixo por formato), não como número',
  }
}

function estimateVisits(reachEst: HiddenMetricEstimate, cal: CalibrationRatio): HiddenMetricEstimate {
  if (cal.median === null || reachEst.point_estimate === null) {
    return {
      metric: 'visitas_ao_perfil', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'visit_rate × reach_est (cascata)', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'sem base suficiente (depende do reach estimado)', note: 'requer reach_est válido',
    }
  }
  const est = reachEst.point_estimate * cal.median
  return {
    metric: 'visitas_ao_perfil', point_estimate: est, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
    method: `Δfollowers/visit_rate em cascata sobre reach_est (n=${cal.n})`, calibration_n: cal.n, confidence: cal.confidence,
    display: 'reportar como TENDÊNCIA (crescendo/estável/caindo), nunca como número — erro em cascata sobre o reach já estimado',
    note: 'métrica mais instável das 4; nesta calibração real a dispersão entre contas foi a maior observada',
  }
}

function estimateClicks(visitsEst: HiddenMetricEstimate, cal: CalibrationRatio, hasTrackableLink: boolean): HiddenMetricEstimate {
  if (!hasTrackableLink) {
    return {
      metric: 'cliques_no_link', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'sem link rastreável (bit.ly público / SimilarWeb)', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'sem proxy disponível — conta não tem link público rastreável', note: 'este é o único dos 4 estimadores que pode legitimamente retornar "melhor proxy" quando há bit.ly/Linktree públicos; sem isso, vira cascata fraca',
    }
  }
  if (cal.median === null || visitsEst.point_estimate === null) {
    return {
      metric: 'cliques_no_link', point_estimate: null, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
      method: 'ctr_bio × visits_est (cascata)', calibration_n: cal.n, confidence: 'sem_calibracao',
      display: 'sem base suficiente', note: 'requer visits_est válido',
    }
  }
  const est = visitsEst.point_estimate * cal.median
  return {
    metric: 'cliques_no_link', point_estimate: est, lower: null, upper: null, margin_pct: cal.baseline_margin_pct,
    method: `ctr_bio em cascata (n=${cal.n}) — sem bit.ly/SimilarWeb real, é cascata, não "melhor proxy"`, calibration_n: cal.n, confidence: cal.confidence,
    display: `ordem de grandeza ~${Math.round(est)}, erro em cascata sobre reach E visitas já estimados — usar com cautela extra`,
    note: 'declarar sempre que este número NÃO vem de bit.ly/SimilarWeb público quando for cascata',
  }
}

// ----------------------------------------------------------------------------
// MAIN — exemplo de uso: calibra com as contas L0 e aplica no manifest L1
// ----------------------------------------------------------------------------

interface L1PostMinimal { likes: number | null; comments: number | null }
interface L1AccountMinimal {
  handle: string
  posts: L1PostMinimal[]
  external_url?: string | null
  /** vem do profile-fetch do ingest.ts (followers_count) — null quando o lead não tem porte conhecido, aí a checagem de tier fica em modo cautela em vez de recusa */
  followers_count?: number | null
}

function summarizeAccountEngagement(account: L1AccountMinimal) {
  const valid = account.posts.filter((p) => p.likes !== null)
  const totalLikes = valid.reduce((s, p) => s + (p.likes ?? 0), 0)
  const totalComments = valid.reduce((s, p) => s + (p.comments ?? 0), 0)
  return { totalLikes, totalComments, avgLikes: totalLikes / (valid.length || 1), n: valid.length }
}

/**
 * Resolução de path com candidatos — em vez de um default único e fixo.
 * Achado real: o mesmo projeto acumulou dois nomes de pasta diferentes
 * pro manifesto L1 em momentos diferentes (data/benchmark/manifest.json,
 * o OUTPUT_DIR hardcoded em ingest.ts, e data/l0_exports/manifest.json,
 * onde o manifesto real desta rodada efetivamente está). Em vez de forçar
 * a pessoa a sempre setar a env var manualmente, tenta os candidatos
 * conhecidos em ordem e usa o primeiro que existir; a env var explícita,
 * quando setada, sempre vence.
 */
function resolveFirstExisting(candidates: string[]): string {
  for (const c of candidates) if (existsSync(c)) return c
  return candidates[0]
}

async function main() {
  // L0_OWN_EXPORTS_DIR — export oficial do Instagram, por conta própria
  // (Perfis/<handle>/content_interactions.json etc.). NUNCA aponte isto
  // para a pasta do benchmark L1 — buildCalibration detecta e recusa, mas
  // o nome certo da env var evita o erro de origem.
  const L0_DIR =
    process.env.L0_OWN_EXPORTS_DIR ??
    process.env.L0_EXPORT_DIR /* nome antigo, aceito por retrocompatibilidade */ ??
    resolveFirstExisting([
      path.join(process.cwd(), 'data', 'l0_own_exports'),
      path.join(process.cwd(), 'data', 'l0_exports'), // só cai aqui se a pasta acima não existir; buildCalibration detecta se isto for na verdade L1
    ])

  const L1_MANIFEST =
    process.env.L1_MANIFEST ??
    resolveFirstExisting([
      path.join(process.cwd(), 'data', 'l0_exports', 'manifest.json'), // layout real desta rodada
      path.join(process.cwd(), 'data', 'benchmark', 'manifest.json'), // OUTPUT_DIR hardcoded em ingest.ts
    ])

  const calibration = buildCalibration(L0_DIR, L1_MANIFEST)

  console.log('=== Calibração (dado próprio, L0) ===')
  for (const key of ['reach', 'saves', 'visits', 'clicks'] as const) {
    const c = calibration[key]
    console.log(`  ${key}: n=${c.n}, mediana=${c.median?.toFixed(4) ?? '—'}, confiança=${c.confidence}, margem=±${c.baseline_margin_pct}%`)
    if (c.excluded_outliers.length) {
      console.log(`    excluídos: ${c.excluded_outliers.map((e) => `${e.handle} (${e.motivo})`).join('; ')}`)
    }
  }

  if (!existsSync(L1_MANIFEST)) {
    console.log(`\n⚠️  manifest L1 não encontrado em ${L1_MANIFEST} — só a calibração foi calculada.`)
    return
  }

  const accounts: L1AccountMinimal[] = JSON.parse(readFileSync(L1_MANIFEST, 'utf-8'))

  console.log('\n=== Inferência aplicada às contas L1 ===')
  for (const acc of accounts) {
    acc.handle = normalizeHandle(acc.handle)
    const { totalLikes, totalComments, n } = summarizeAccountEngagement(acc)
    const targetFollowers = acc.followers_count ?? null
    const reachEst = estimateReach(totalLikes, totalComments, calibration.reach, targetFollowers)
    const savesEst = estimateSaves(totalLikes, calibration.saves, targetFollowers)
    const visitsEst = estimateVisits(reachEst, calibration.visits)
    const clicksEst = estimateClicks(visitsEst, calibration.clicks, Boolean(acc.external_url))

    console.log(`\n→ ${acc.handle} (${n} posts válidos, followers=${targetFollowers ?? 'desconhecido'})`)
    console.log(`  Alcance: ${reachEst.display}`)
    console.log(`  Salvamentos: ${savesEst.display}`)
    console.log(`  Visitas ao perfil: ${visitsEst.display}`)
    console.log(`  Cliques no link: ${clicksEst.display}`)
  }
}

// Mesma guarda aplicada em ingest.ts — evita que importar buildCalibration()
// ou qualquer helper deste arquivo (ex.: de um futuro endpoint de API)
// dispare a leitura de L0_EXPORT_DIR e a impressão de tabelas no console.
const isDirectRun = process.argv[1] !== undefined && process.argv[1].endsWith('compute.ts')
if (isDirectRun) {
  main().catch((err) => {
    console.error('Erro fatal:', err)
    process.exit(1)
  })
}

export { buildCalibration, estimateReach, estimateSaves, estimateVisits, estimateClicks, parseL0Account, parseAllL0Accounts }