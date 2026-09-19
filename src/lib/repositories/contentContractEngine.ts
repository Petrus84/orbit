/* ==========================================================================
   ORBIT · contentContractEngine.ts
   Content Contract v1.5.1 + textos de cliente (06/09/2026)
   Patch 15/09/2026: fix TS2345 (formatPtBr(vpsPct) sem guarda de null) +
   P0a (categorias comissionamento_afiliados/pre_monetizacao_a_validar) +
   P0b (template cta_rate_pct) — ver ANALISE_CONVERGENTE_ORBIT.md

   REGRA DE OURO: nenhuma função aqui reimplementa threshold em JS.
   A régua vive em orbit.fn_classify_metric (Postgres). Este arquivo
   classifica o que o banco já decidiu e escreve o que o cliente lê.

   Voz:
   - título = o que está acontecendo na conta
   - probableCause = por que esta hipótese, não a outra
   - immediateAction = um verbo, um objeto, um prazo
   - caveat = só quando muda a permissão de agir
   - "Traduzindo:" = número vira contagem concreta; nunca explica
     zero-inflated, threshold ou calibração para o cliente

   vps_pct na UI = "alcance na base" (fatia de quem já segue que viu o post).
   Não é Value Proposition Score de questionário. Chave do banco não muda.

   polemic_score_pct na UI = "discussão nos comentários"
   (posts em que alguém discorda, não só curte). Não é incentivo a polêmica.
   ========================================================================== */

import type {
  Alert,
  AlertSeverity,
  AlertNatureza,
  ConfidenceLevel,
  CriticalAlertData,
  InsightData,
  ClassifiedMetric,
  AlgoRiskScore,
  ThresholdGranularity,
  CalibrationMethod,
  SetorBenchmark,
} from '@/types/orbit'
import { supabase } from '@/lib/supabase'

export interface AlertContractFields {
  natureza: AlertNatureza
  probableCause: string
  confidenceLevel: ConfidenceLevel
  dataSource: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'empty_database' | 'error' | 'estimate'
  thresholdSource?: ThresholdGranularity | null
  confidenceScore?: number | null
  ruleDeclaration?: string
  snapshotId?: string
  metricName?: string
  metricValue?: number
  thresholdValue?: number | null
}

export interface EngagementScoreInput {
  snapshotId: string
  erRealPct: number
  utilityScorePct: number
  polemicScorePct: number
  // ✅ FIX (15/09/2026 — regressão do fix de VPS C-02): passou a `number |
  // null`. ORB-DEBT-034 confirma que `reach_followers_pct` nunca foi
  // ingerido pros clientes reais — sem ele não existe VPS C-02 válido
  // (doc v8.2 §1.4: "só classificar se reach_followers_pct ≠ null"). Antes
  // dessa mudança, `vpsPct` não-nulo dependia de fetchLatestEngagementScoreSnapshot
  // também não-nulo — e como aquela função agora retornava `null` pro
  // snapshot inteiro quando faltava `reach_followers_pct`, ER Real/
  // Utilidade/Polêmica paravam de ser classificados também, e o alerta
  // "Alcance acumulado na base em X%" sumia por completo. `vpsPct: null`
  // aqui é o estado real e esperado hoje — as outras 3 métricas continuam
  // sendo avaliadas independentemente.
  //
  // ⚠️ Efeito colateral desta mudança (TS2345, corrigido em 15/09/2026):
  // qualquer lugar que formatasse `input.vpsPct` diretamente com
  // formatPtBr() (que exige `number`) quebrou a checagem de tipos, porque
  // o valor agora pode ser `null`. A correção não é forçar um cast — é
  // tratar o caso nulo explicitamente no texto (ver formatVpsSegment()
  // abaixo), porque um 0 fabricado pareceria dado real.
  vpsPct: number | null
}

export type AlertDraft = Pick<Alert, 'type' | 'severity' | 'title' | 'description'> &
  AlertContractFields & {
    immediateAction: string
  }

interface FnClassifyMetricRow {
  semaphore: 'verde' | 'ambar' | 'vermelho'
  status_text: string
  confidence_level: ConfidenceLevel
  category?: string | null
  tier?: string | null
  confidence_score?: number | null
  calibration_method?: CalibrationMethod | null
  zero_pct?: number | null
  signal_range_label?: string | null
}

/* -------------------------------------------------------------------------- */
/*  Recortes calibrados                                                       */
/* -------------------------------------------------------------------------- */

// ✅ P0a (ANALISE_CONVERGENTE_ORBIT.md, "Categoria gap: 7 vs 9"): faltavam
// 'comissionamento_afiliados' e 'pre_monetizacao_a_validar' — clientes
// nesses 2 setores caíam sempre no recorte 'global' (sem benchmark de
// categoria), mesmo já existindo em client_onboarding_setor_benchmark_check
// no banco. Adicionadas em 15/09/2026.
const CALIBRATED_SETOR_BENCHMARK_CATEGORIES: ReadonlySet<SetorBenchmark> = new Set([
  'comercio_direto_ecommerce_social',
  'comissionamento_afiliados',
  'infoprodutor_educador_pago',
  'servico_consultoria_profissional',
  'patrocinio_publicidade_marca',
  'membership_assinatura_comunidade',
  'monetizacao_nativa_plataforma',
  'autoridade_personal_branding_b2b',
  'pre_monetizacao_a_validar',
])

const SETOR_LABEL: Record<string, string> = {
  comercio_direto_ecommerce_social: 'lojas que vendem pelo Instagram',
  comissionamento_afiliados: 'contas de afiliados e comissionamento',
  infoprodutor_educador_pago: 'infoprodutores e cursos',
  servico_consultoria_profissional: 'serviços e consultorias',
  patrocinio_publicidade_marca: 'marcas que vivem de publicidade',
  membership_assinatura_comunidade: 'assinaturas e comunidades',
  monetizacao_nativa_plataforma: 'contas que monetizam na própria plataforma',
  autoridade_personal_branding_b2b: 'autoridade e personal branding B2B',
  pre_monetizacao_a_validar: 'contas ainda validando modelo de monetização',
}

const TIER_LABEL: Record<string, string> = {
  nano: 'até 10 mil seguidores',
  micro: '10 a 50 mil seguidores',
  mid: '50 a 250 mil seguidores',
  macro: '250 mil a 1 milhão de seguidores',
  mega: 'mais de 1 milhão de seguidores',
}

const METRIC_LABEL: Record<string, string> = {
  er_real_pct: 'engajamento real',
  vps_pct: 'alcance na base',
  polemic_score_pct: 'discussão nos comentários',
  utility_score_pct: 'quanto o post é guardado ou repassado',
  // ✅ P0b (ANALISE_CONVERGENTE_ORBIT.md, "Métrica template gap:
  // cta_rate_pct"): rótulo faltava; sem ele buildUnavailableMetricText()/
  // buildTechnicalErrorText() caiam no fallback `?? metricName` (mostraria
  // literalmente "cta_rate_pct" ao cliente).
  cta_rate_pct: 'pedido de compra por post',
  // ✅ NOVO (2026-09-18): métricas órfãs integradas com dado v1.
  engagement_public: 'engajamento público',
  algo_risk_score: 'risco algorítmico',
  play_to_view_ratio: 'taxa de reprodução',
}

const ZERO_INFLATED_EVENT_NOUN: Record<string, string> = {
  er_real_pct: 'ação de quem viu (curtida, comentário, salvamento ou compartilhamento)',
  vps_pct: 'alcance dentro da própria base de seguidores',
  polemic_score_pct: 'gente discordando nos comentários (não só curtindo)',
  utility_score_pct: 'salvamento ou compartilhamento',
  cta_rate_pct: 'pedido de compra',
  // ✅ NOVO (2026-09-18)
  engagement_public: 'comentário ou compartilhamento público',
  algo_risk_score: 'sinal de risco detectado',
  play_to_view_ratio: 'reprodução completa do reel',
}

const METRIC_TRANSLATION_TEMPLATE: Record<string, (value: number) => string> = {
  er_real_pct: (v) =>
    `Traduzindo: de cada 100 pessoas que viram o post, ${formatPtBr(v)} pararam para curtir, comentar, salvar ou compartilhar.`,
  vps_pct: (v) =>
    `Traduzindo: de cada 100 seguidores que você tem hoje, ${formatPtBr(v)} viram esse post.`,
  polemic_score_pct: (v) =>
    `Traduzindo: em ${formatPtBr(v)}% dos posts, teve gente discordando nos comentários — não só curtindo.`,
  utility_score_pct: (v) =>
    `Traduzindo: ${formatPtBr(v)}% dos posts foram guardados ou repassados por alguém.`,
  // ✅ P0b: template adicionado. Sem ele, withTranslation() retornava só o
  // baseText (buildTranslationLine() devolve null pra template ausente) —
  // "Traduzindo:" nunca aparecia pra esta métrica, mesmo se alguém
  // chamasse classifyMetric('cta_rate_pct', ...) no futuro.
  cta_rate_pct: (v) =>
    `Traduzindo: ${formatPtBr(v)}% dos posts resultaram em pedido de compra.`,
  // ✅ NOVO (2026-09-18): métricas órfãs integradas com dado v1.
  // engagement_public: é percentual — "de cada 100 impressões, X geraram
  // comentário ou compartilhamento".
  engagement_public: (v) =>
    `Traduzindo: de cada 100 impressões, ${formatPtBr(v, 2)} geraram comentário ou compartilhamento.`,
  // play_to_view_ratio: é ratio (0–1+), não percentual. Texto descreve o
  // que 1 significa (todos que viram iniciaram reprodução).
  play_to_view_ratio: (v) =>
    `Traduzindo: para cada visualização, houve ${formatPtBr(v, 2)} reprodução — ${v >= 1 ? 'todos que viram iniciaram o reel' : 'parte das visualizações não virou play'}.`,
}

const BOUNDED_PERCENT_METRICS: ReadonlySet<string> = new Set([
  'vps_pct',
  'er_real_pct',
  'utility_score_pct',
  // ❌ REMOVIDO (18/09/2026): engagement_public NÃO é percentual — é
  // likes+comments, contagem bruta (unit='count' em ref_thresholds,
  // dataset_id='benchmark_orphan_v1_rescate', green_max chega a 2345 pra
  // monetizacao_nativa_plataforma). Tratar como 0-100% faria o guard de
  // "fora do intervalo esperado" disparar pra praticamente todo post real
  // com qualquer engajamento — mesmo bug de unidade do pts/pct antigo do
  // polemic_score_pct v1/v2, pego antes de ir ao ar desta vez.
])

// ✅ NOVO (PR-A, execução ORBIT §"Porta da RPC", 14/09/2026): única fonte da
// verdade sobre quais métricas têm régua de mercado real em
// orbit.ref_thresholds hoje. Confirmado por SQL direto no mesmo dia: só
// polemic_score_pct tem linhas em dataset_id='benchmark_58_v2_real_schema'
// (29 linhas, 8 categorias). er_real_pct, vps_pct, utility_score_pct: zero
// linha v2.
//
// engagement_public, play_to_view_ratio: têm linhas em
// dataset_id='benchmark_58_v1' (7 e 1 linha respectivamente). Integrados
// em 2026-09-18 com decisão explícita de produto: aceitar v1 enquanto
// recalibração v2 não roda. Aviso de confiança/recorte exibido via
// applyConfidenceGate() — qualquer linha com confidence_score < 0.75
// sofre downgrade de semáforo automático.
//
// algo_risk_score: self-reference (conta vs. ela mesma, família
// self_reference_client_history — ver v_algo_risk_score.sql). NÃO entra
// aqui: não é benchmark de mercado, não passa por fn_classify_metric.
// Resolvido por resolveAlgoRiskScoreAlert() com lógica própria sem RPC.
//
// Fora deste Set, classifyMetric() NÃO chama a RPC — não existe régua pra
// comparar, então não finge que existe. Adicionar uma métrica aqui exige
// confirmar antes, por SQL, que há linha real (v1 aceito com aviso explícito
// de produto; v2 preferível). Nunca por suposição de nome (LEDGER-019:
// coluna existir não significa régua existir).
const MARKET_RPC_METRICS: ReadonlySet<string> = new Set([
  'polemic_score_pct',
  'engagement_public',   // v1 aceito — 2026-09-18, recalibração v2 pendente
  'play_to_view_ratio',  // v1 aceito — 2026-09-18, só recorte global (n=1.033)
])

export function mapSegmentToCategory(setorBenchmark: SetorBenchmark | null): string | null {
  if (setorBenchmark !== null && CALIBRATED_SETOR_BENCHMARK_CATEGORIES.has(setorBenchmark)) {
    return setorBenchmark
  }
  return null
}

export function mapFollowersToTier(followers: number | null | undefined): string | null {
  if (followers == null || followers < 0) return null
  if (followers < 10_000) return 'nano'
  if (followers < 50_000) return 'micro'
  if (followers < 250_000) return 'mid'
  if (followers < 1_000_000) return 'macro'
  return 'mega'
}

/* -------------------------------------------------------------------------- */
/*  algo_risk_score — família Ln (self-reference, não é benchmark de mercado) */
/* -------------------------------------------------------------------------- */

export interface AlgoRiskPostInput {
  publishedAt: string
  likes: number | null
  comments: number | null
}

const ALGO_RISK_N_RECENT = 12
const ALGO_RISK_N_RECENT_MIN = 6
const ALGO_RISK_BASELINE_MAX_POSTS = 30

// engagement_public = likes + comments, null-safe — mas aqui "null-safe"
// significa EXCLUIR o post da janela, não fabricar likes=0 (spec explícita:
// "likes IS NULL → post fora da mediana, não vira 0"). Um post com likes
// null e comments=5 não vira engagement=5 nem engagement=0 — some da janela.
function engagementPublicOrNull(post: AlgoRiskPostInput): number | null {
  if (post.likes == null || post.comments == null) return null
  return post.likes + post.comments
}

// Trim por IQR (remove abaixo de Q1-1.5*IQR e acima de Q3+1.5*IQR), depois
// mediana do que sobrou. Aplicado a CADA janela separadamente — nunca no
// conjunto R+B junto, senão um outlier de uma janela puxa o corte da outra.
function medianAfterIqrTrim(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const quantile = (q: number) => {
    const pos = (sorted.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    const next = sorted[base + 1]
    return next !== undefined ? sorted[base]! + rest * (next - sorted[base]!) : sorted[base]!
  }
  const q1 = quantile(0.25)
  const q3 = quantile(0.75)
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  const trimmed = sorted.filter((v) => v >= lower && v <= upper)
  if (trimmed.length === 0) return null
  const mid = Math.floor(trimmed.length / 2)
  return trimmed.length % 2 === 0 ? (trimmed[mid - 1]! + trimmed[mid]!) / 2 : trimmed[mid]!
}

function buildAlgoRiskText(value: number | null): string {
  if (value === null) return 'Sem série suficiente para calcular risco algorítmico ainda.'
  if (Math.abs(value) < 0.02) return 'Engajamento recente na mesma faixa do seu histórico — estável.'
  if (value > 0) {
    return `Engajamento recente ${formatPtBr(value * 100)}% abaixo da sua própria mediana histórica.`
  }
  return `Engajamento recente ${formatPtBr(Math.abs(value) * 100)}% acima da sua própria mediana histórica.`
}

/**
 * Fórmula fechada, família Ln — compara a conta com ela mesma, nunca com
 * mercado. `posts` deve vir ordenado do mais recente pro mais antigo, sem
 * limite de tamanho pré-imposto (a função corta as janelas internamente).
 * Janelas R (recente) e B (baseline) são disjuntas por construção — R pega
 * os N_RECENT primeiros posts válidos (likes+comments não-null), B pega os
 * próximos até ALGO_RISK_BASELINE_MAX_POSTS depois disso.
 */
export function computeAlgoRiskScore(posts: AlgoRiskPostInput[]): AlgoRiskScore {
  const validValues: number[] = []
  const engagements: (number | null)[] = posts.map(engagementPublicOrNull)
  for (const e of engagements) if (e !== null) validValues.push(e)

  // separa em R (primeiros N válidos, mais recentes) e B (os próximos, disjuntos)
  let recentCount = 0
  const recent: number[] = []
  const baseline: number[] = []
  for (const e of engagements) {
    if (e === null) continue
    if (recentCount < ALGO_RISK_N_RECENT) {
      recent.push(e)
      recentCount++
    } else if (baseline.length < ALGO_RISK_BASELINE_MAX_POSTS) {
      baseline.push(e)
    } else {
      break
    }
  }

  if (recent.length < ALGO_RISK_N_RECENT_MIN || baseline.length === 0) {
    return {
      value: null,
      recentMedian: null,
      baselineMedian: null,
      recentWindowSize: recent.length,
      baselineWindowSize: baseline.length,
      statusText: buildAlgoRiskText(null),
    }
  }

  const recentMedian = medianAfterIqrTrim(recent)
  const baselineMedian = medianAfterIqrTrim(baseline)

  // mediana(B)=0 — sem denominador válido. mediana(R) também 0 → sem sinal
  // nenhum, NULL. mediana(R)>0 com mediana(B)=0 → razão indefinida
  // (divisão por zero), NULL documentado — nunca -∞.
  if (baselineMedian === null || baselineMedian === 0) {
    return {
      value: null,
      recentMedian,
      baselineMedian,
      recentWindowSize: recent.length,
      baselineWindowSize: baseline.length,
      statusText: buildAlgoRiskText(null),
    }
  }

  if (recentMedian === null) {
    return {
      value: null,
      recentMedian: null,
      baselineMedian,
      recentWindowSize: recent.length,
      baselineWindowSize: baseline.length,
      statusText: buildAlgoRiskText(null),
    }
  }

  const ratio = recentMedian / baselineMedian
  const value = 1 - ratio // >0 = queda vs. passado; <0 = acima do passado; 0 = estável

  return {
    value,
    recentMedian,
    baselineMedian,
    recentWindowSize: recent.length,
    baselineWindowSize: baseline.length,
    statusText: buildAlgoRiskText(value),
  }
}

/* -------------------------------------------------------------------------- */
/*  Utilitários de tradução numérica                                          */
/* -------------------------------------------------------------------------- */

function formatPtBr(value: number, decimals: number = 1): string {
  return value.toFixed(decimals).replace('.', ',')
}

// ✅ FIX (15/09/2026, TS2345 linhas 1132/1152): helper dedicado para
// formatar o trecho de VPS num título/descrição quando o valor pode ser
// `null` (reach_followers_pct não ingerido — ORB-DEBT-034). Isolar isso
// aqui evita repetir `input.vpsPct != null ? ... : ...` em cada branch que
// precisa mencionar VPS ao lado de outra métrica, e evita o erro de tipo
// de chamar formatPtBr(null) diretamente. Não fabrica um 0 — declara a
// ausência.
function formatVpsSegment(vpsPct: number | null): string {
  if (vpsPct == null) {
    return 'alcance na base indisponível (reach_followers_pct não ingerido — ver ORB-DEBT-034)'
  }
  return `${formatPtBr(vpsPct)}% dos seguidores viram`
}

function toFriendlyFraction(pct: number): string | null {
  const COMMON_FRACTIONS: [number, string][] = [
    [50, '1 em cada 2'],
    [33.3, '1 em cada 3'],
    [25, '1 em cada 4'],
    [20, '1 em cada 5'],
    [10, '1 em cada 10'],
    [66.7, '2 em cada 3'],
    [75, '3 em cada 4'],
    [90, '9 em cada 10'],
  ]

  let closest: [number, string] | null = null
  let minDiff = Infinity

  for (const fraction of COMMON_FRACTIONS) {
    const diff = Math.abs(pct - fraction[0])
    if (diff < minDiff) {
      minDiff = diff
      closest = fraction
    }
  }

  if (closest && minDiff <= 4) return closest[1]
  return null
}

function buildTranslationLine(metricName: string, value: number): string | null {
  const template = METRIC_TRANSLATION_TEMPLATE[metricName]
  if (!template) return null
  return template(value)
}

function withTranslation(baseText: string, metricName: string, value: number): string {
  if (baseText.includes('Traduzindo:')) return baseText
  const translation = buildTranslationLine(metricName, value)
  return translation ? `${baseText} ${translation}` : baseText
}

/* -------------------------------------------------------------------------- */
/*  Textos de régua e confiança                                               */
/* -------------------------------------------------------------------------- */

function deriveThresholdSource(
  category: string | null | undefined,
  tier: string | null | undefined
): ThresholdGranularity {
  if (!category || category === 'all') return 'global'
  if (!tier || tier === 'all') return 'category_all'
  return 'category_tier'
}

export function formatCategoryLabel(category: string): string {
  if (!category || category === 'all') return 'contas em geral'
  return SETOR_LABEL[category] ?? category.replace(/^\d+_/, '').replace(/_/g, ' ').trim()
}

function formatTierLabel(tier: string | null | undefined): string | null {
  if (!tier || tier === 'all') return null
  return TIER_LABEL[tier] ?? `porte ${tier}`
}

function buildRuleDeclaration(
  thresholdSource: ThresholdGranularity,
  category: string | null | undefined,
  tier: string | null | undefined
): string {
  const setor = formatCategoryLabel(category ?? '')
  const porte = formatTierLabel(tier)

  switch (thresholdSource) {
    case 'category_tier':
      return porte
        ? `Comparamos com ${setor} de ${porte}.`
        : `Comparamos com ${setor}.`
    case 'category_all':
      return `Comparamos com ${setor}, sem separar por tamanho de conta.`
    case 'global':
    default:
      return 'Ainda não há recorte do seu tipo de negócio. Comparamos com o conjunto geral de contas da base.'
  }
}

function locateValueInRange(value: number, signalRangeLabel: string): string | null {
  const numbers = signalRangeLabel.match(/[\d.]+/g)
  if (!numbers || numbers.length < 2) return null

  const min = parseFloat(numbers[0] ?? '')
  const max = parseFloat(numbers[1] ?? '')
  if (Number.isNaN(min) || Number.isNaN(max) || max <= min) return null

  const position = (value - min) / (max - min)

  if (value < min) return 'abaixo do que costuma acontecer quando essa métrica não é zero'
  if (value > max) return 'acima do que costuma acontecer quando essa métrica não é zero'
  if (position < 0.33) return 'perto do piso da sua faixa'
  if (position > 0.66) return 'perto do teto da sua faixa'
  return 'no meio da sua faixa'
}

function buildZeroInflatedText(
  metricName: string,
  categoryLabel: string,
  zeroPct: number,
  signalRangeLabel: string,
  value: number
): string {
  const eventNoun = ZERO_INFLATED_EVENT_NOUN[metricName] ?? METRIC_LABEL[metricName] ?? metricName
  const location = locateValueInRange(value, signalRangeLabel)
  const friendlyFraction = toFriendlyFraction(zeroPct)
  const zeroPctPhrase = friendlyFraction
    ? `${friendlyFraction} (${zeroPct.toFixed(0)}%)`
    : `${zeroPct.toFixed(0)}%`

  let text = `${zeroPctPhrase} dos posts de ${categoryLabel} não têm ${eventNoun} — isso é o padrão da amostra, não uma falha da conta. Quando o post tem, o volume costuma ficar em ${signalRangeLabel}.`

  if (location) {
    text += ` O seu valor (${formatPtBr(value, 2)}%) está ${location}.`
  }

  return withTranslation(text, metricName, value)
}

function buildUnavailableMetricText(metricName: string): string {
  const label = METRIC_LABEL[metricName] ?? metricName
  return `Não classificamos o ${label} agora. O número pode aparecer na tela; o veredito bom/ruim, não. Não decida oferta nem verba por este cartão.`
}

function buildTechnicalErrorText(metricName: string): string {
  const label = METRIC_LABEL[metricName] ?? 'esta métrica'
  return `A avaliação de ${label} falhou. Recarregue. Se o cartão voltar assim, ignore o veredito e use só o número bruto.`
}

// ✅ NOVO (PR-A): texto para métrica fora de MARKET_RPC_METRICS. Mesmo
// vocabulário já usado em SCORE_KEYS_WITHOUT_SECTOR_TARIFARIO
// (instagramOverviewRepository.ts) — "sem recorte setorial", nunca
// "classificação indisponível" (isso soa a falha técnica, não a decisão de
// produto que de fato é).
function buildNoMarketRecortText(metricName: string): string {
  const label = METRIC_LABEL[metricName] ?? metricName
  return `${capitalize(label)}: número real, sem recorte setorial ainda. Sem base de comparação de mercado para esta métrica hoje.`
}

function guardOutOfRangePercentMetric(metricName: string, value: number): ClassifiedMetric | null {
  if (!BOUNDED_PERCENT_METRICS.has(metricName)) return null
  if (value >= 0 && value <= 100) return null

  const label = METRIC_LABEL[metricName] ?? metricName
  return {
    value,
    semaphore: 'ambar',
    statusText: `${capitalize(label)} em ${formatPtBr(value)}% — fora do intervalo esperado para um post individual (0 a 100%). Pode ser soma de vários posts ou erro de ingestão. Confirme antes de decidir.`,
    confidenceLevel: 'L2',
    thresholdSource: 'global',
    confidenceScore: null,
    ruleDeclaration: 'Este valor está fora do intervalo físico esperado para um post.',
    calibrationMethod: null,
    zeroInflated: null,
  }
}

function buildLowConfidenceCard(
  metricName: string,
  value: number,
  ruleDeclaration: string,
  confidenceScore: number | null
): { title: string; probableCause: string; immediateAction: string } {
  const label = METRIC_LABEL[metricName] ?? metricName

  if (confidenceScore === null) {
    return {
      title: `${capitalize(label)} em ${formatPtBr(value, 2)}% — sem referência para o seu negócio`,
      probableCause: `${ruleDeclaration} Ainda não há comparação específica para o seu tipo de conta. Confira o setor marcado no onboarding.`,
      immediateAction: 'Acompanhe este número na sua própria conta, semana a semana. Não mude oferta por ele agora.',
    }
  }

  return {
    title: `${capitalize(label)} em ${formatPtBr(value, 2)}% — ainda não dá para julgar este número`,
    probableCause: `${ruleDeclaration} O número da conta é real; a base de comparação deste recorte ainda é curta.`,
    immediateAction:
      'Publique no ritmo atual por mais 14 dias antes de mudar oferta, bio ou verba por causa deste cartão.',
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/* -------------------------------------------------------------------------- */
/*  RPC                                                                       */
/* -------------------------------------------------------------------------- */

export async function classifyMetric(
  metricName: string,
  value: number,
  category: string = 'all',
  tier: string = 'all'
): Promise<ClassifiedMetric> {
  const outOfRange = guardOutOfRangePercentMetric(metricName, value)
  if (outOfRange) return outOfRange

  // ✅ NOVO (PR-A): porta da RPC. Sem linha de mercado real pra esta
  // métrica → não chama fn_classify_metric. semaphore='neutro' não é cor de
  // alerta; thresholdSource=null é sinal explícito de "não houve régua",
  // distinto de 'global' (que é régua real, só sem recorte por setor/porte).
  if (!MARKET_RPC_METRICS.has(metricName)) {
    return {
      value,
      semaphore: 'neutro',
      statusText: buildNoMarketRecortText(metricName),
      confidenceLevel: 'L2',
      thresholdSource: null,
      confidenceScore: null,
      ruleDeclaration: 'Ainda não há recorte de mercado calibrado para esta métrica.',
      calibrationMethod: null,
      zeroInflated: null,
    }
  }

  const { data, error } = await supabase.rpc('fn_classify_metric', {
    p_metric_name: metricName,
    p_value: value,
    p_category: category,
    p_tier: tier,
  })

  if (error || !data?.[0]) {
    return {
      value,
      semaphore: 'ambar',
      statusText: buildUnavailableMetricText(metricName),
      confidenceLevel: 'L2',
      thresholdSource: 'global',
      confidenceScore: null,
      ruleDeclaration: 'A classificação não voltou desta consulta.',
      calibrationMethod: null,
      zeroInflated: null,
    }
  }

  const row = data[0] as FnClassifyMetricRow
  const VALID_SEMAPHORES = ['verde', 'ambar', 'vermelho'] as const

  if (!VALID_SEMAPHORES.includes(row.semaphore as (typeof VALID_SEMAPHORES)[number])) {
    return {
      value,
      semaphore: 'ambar',
      statusText: buildTechnicalErrorText(metricName),
      confidenceLevel: 'L2',
      thresholdSource: 'global',
      confidenceScore: null,
      ruleDeclaration: 'A classificação voltou em formato que este app não reconhece.',
      calibrationMethod: null,
      zeroInflated: null,
    }
  }

  const thresholdSource = deriveThresholdSource(row.category, row.tier)
  const ruleDeclaration = buildRuleDeclaration(thresholdSource, row.category, row.tier)
  const confidenceScore = row.confidence_score ?? null

  const isZeroInflated = row.calibration_method === 'empirical_percentile_zero_inflated'
  const zeroInflated =
    isZeroInflated && row.zero_pct != null && row.signal_range_label
      ? { zeroPct: row.zero_pct, signalRangeLabel: row.signal_range_label }
      : null

  if (zeroInflated) {
    const statusText = buildZeroInflatedText(
      metricName,
      formatCategoryLabel(row.category ?? ''),
      zeroInflated.zeroPct,
      zeroInflated.signalRangeLabel,
      value
    )
    return {
      value,
      semaphore: row.semaphore,
      statusText,
      confidenceLevel: row.confidence_level,
      thresholdSource,
      confidenceScore,
      ruleDeclaration,
      calibrationMethod: row.calibration_method ?? null,
      zeroInflated,
    }
  }

  const { semaphore, caveat } = applyConfidenceGate(row.semaphore, confidenceScore)
  const statusText = caveat ? `${row.status_text} ${caveat}` : row.status_text

  return {
    value,
    semaphore,
    statusText,
    confidenceLevel: row.confidence_level,
    thresholdSource,
    confidenceScore,
    ruleDeclaration,
    calibrationMethod: row.calibration_method ?? null,
    zeroInflated: null,
  }
}

function applyConfidenceGate(
  semaphore: 'verde' | 'ambar' | 'vermelho',
  confidenceScore: number | null
): { semaphore: 'verde' | 'ambar' | 'vermelho'; caveat: string | null } {
  if (confidenceScore === null) {
    return {
      semaphore: semaphore === 'verde' ? 'ambar' : semaphore,
      caveat: 'A certeza desta comparação não veio junto do número. Use como pista, não como decisão de verba.',
    }
  }
  if (confidenceScore < 0.75) {
    return {
      semaphore: semaphore === 'verde' ? 'ambar' : semaphore,
      caveat: 'Ainda há poucas contas neste recorte. Serve para olhar, não para mudar oferta, bio ou anúncio.',
    }
  }
  if (confidenceScore < 0.9) {
    return {
      semaphore,
      caveat: 'Comparação utilizável. Se for mexer em verba, confirme com mais 7 dias.',
    }
  }
  return { semaphore, caveat: null }
}

function buildLowConfidenceWarning(ruleDeclaration: string): string {
  return `O sinal existe, mas a base de comparação ainda é curta. ${ruleDeclaration} Não mude estratégia por este cartão.`
}

/* -------------------------------------------------------------------------- */
/*  Guarda de dado ausente                                                    */
/* -------------------------------------------------------------------------- */

function withMissingDataGuard<TInput>(
  requiredData: TInput | null | undefined,
  missingDataAction: string,
  onPresent: (data: TInput) => Omit<AlertDraft, 'natureza' | 'confidenceLevel' | 'dataSource'>
): Pick<AlertDraft, 'title' | 'description' | 'severity' | 'type' | 'probableCause' | 'immediateAction'> {
  if (requiredData === null || requiredData === undefined) {
    return {
      type: 'data_gap',
      severity: 'warning',
      title: 'Falta um dado para não chutarmos a causa',
      description: null,
      probableCause:
        'Com o que temos, duas explicações ainda empatam. Sem o próximo dado, qualquer ação é chute.',
      immediateAction: missingDataAction,
    }
  }
  return onPresent(requiredData)
}

/* -------------------------------------------------------------------------- */
/*  CTR bio                                                                   */
/* -------------------------------------------------------------------------- */

export interface CtrBioInput {
  ctrValue: number
  threshold: number
  daysBelowThreshold: number
  linkIsWorking: boolean
  originBreakdown: { origin: string; ctr: number }[] | null
}

function buildCtrTranslation(ctrValue: number): string {
  return `Traduzindo: de cada 100 pessoas que abrem sua bio, ${formatPtBr(ctrValue)} clicam no link.`
}

export function resolveCtrBioAlert(input: CtrBioInput): AlertDraft {
  if (!input.linkIsWorking) {
    return {
      type: 'ctr_below_threshold',
      severity: 'critical',
      title: 'O link da bio não está abrindo',
      description: null,
      natureza: 'tecnica',
      probableCause: 'O clique existe; a página não. Poucos cliques aqui é problema técnico, não de oferta.',
      immediateAction:
        'Abra o link no celular agora. Conserte. Só reescreva a bio depois de 7 dias com o link estável.',
      confidenceLevel: 'L0',
      dataSource: 'real_snapshot',
    }
  }

  const base = withMissingDataGuard(
    input.originBreakdown,
    'Instale o rastreio de origem (post, hashtag, busca) antes de mexer na bio. Sem isso, o próximo texto da bio é chute.',
    (breakdown) => {
      const lowOnlyInOneOrigin =
        breakdown.some((o) => o.ctr < input.threshold) &&
        breakdown.some((o) => o.ctr >= input.threshold)

      return lowOnlyInOneOrigin
        ? {
            type: 'ctr_below_threshold' as const,
            severity: 'warning' as AlertSeverity,
            title: 'Quem clica no link da bio muda dependendo de onde a pessoa veio',
            description: `${buildCtrTranslation(input.ctrValue)} Em uma origem o clique some; nas outras, acontece.`,
            probableCause:
              'A bio serve para parte do público. O buraco está em quem chega por um caminho específico — post, busca ou hashtag.',
            immediateAction:
              'Não mexa na bio. Identifique a origem fraca e interrompa esse caminho antes de testar texto novo.',
          }
        : {
            type: 'ctr_below_threshold' as const,
            severity: 'warning' as AlertSeverity,
            title: 'Quem chega na bio não clica — em nenhuma origem de tráfego',
            description: buildCtrTranslation(input.ctrValue),
            probableCause: 'O problema é a promessa da bio ou da oferta, não de onde a pessoa veio.',
            immediateAction:
              'Reescreva um elemento só da bio (promessa ou botão). Meça 14 dias. Não mude os dois juntos.',
          }
    }
  )

  return {
    ...base,
    natureza: 'tecnica',
    confidenceLevel: input.originBreakdown ? 'L1' : 'L2',
    dataSource: 'real_snapshot',
  }
}

/* -------------------------------------------------------------------------- */
/*  Avatar                                                                    */
/* -------------------------------------------------------------------------- */

export interface AvatarDivergenceInput {
  declaredDominant: string
  realDominant: string
  realSource: 'instagram_insights' | 'client_feedback' | 'manual'
  realConfidence: ConfidenceLevel
  isRealFromConversionData: boolean
  productAdaptableToRealAudience: boolean | null
}

export function resolveAvatarAlert(input: AvatarDivergenceInput): AlertDraft {
  if (!input.isRealFromConversionData) {
    return {
      type: 'avatar_misalignment',
      severity: 'warning',
      title: 'Quem mais curte e comenta ainda não é quem compra',
      description: null,
      natureza: 'tecnica',
      probableCause:
        'O retrato veio de curtida e comentário, não de pedido pago. São dois grupos que podem não ser o mesmo.',
      immediateAction:
        'Antes de mudar posicionamento, separe: quem interage vs. quem já pagou. Sem esse cruzamento, não mude o alvo.',
      confidenceLevel: 'L2',
      dataSource: 'real_snapshot',
    }
  }

  const adaptableAction =
    input.productAdaptableToRealAudience === null
      ? 'Isso não é automático. Decida com o cliente: falar com quem já compra, ou mudar o produto. As duas coisas ao mesmo tempo espalham o teste.'
      : input.productAdaptableToRealAudience
        ? 'Ajuste a comunicação para quem já compra. O produto já serve a esse público — não redesenhe a oferta.'
        : 'O produto não serve ao público que está pagando hoje. Ou adapta a oferta, ou aceita um mercado menor do que o briefing pintou.'

  return {
    type: 'avatar_misalignment',
    severity: 'critical',
    title: `Você descreveu ${input.declaredDominant} no briefing. Quem compra de verdade é ${input.realDominant}`,
    description: null,
    natureza: 'comunicacao',
    probableCause: 'O onboarding descreveu um tipo de cliente. As vendas reais mostram outro.',
    immediateAction: adaptableAction,
    confidenceLevel: input.realConfidence,
    dataSource: 'real_snapshot',
  }
}

/* -------------------------------------------------------------------------- */
/*  Funil                                                                     */
/* -------------------------------------------------------------------------- */

export interface FunnelResult {
  reach: number
  // ✅ CORRIGIDO 09/09 (TICKETS item 4) — era `ctrBio`, mas ctrText abaixo
  // sempre descreveu "abrem bio → clicam no link" (visitas→cliques), não
  // "alcance→visitas". Nome agora bate com o que o texto sempre disse.
  linkCtrPct: number
  dataSource: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'empty_database' | 'error'
  fallbackClientId?: string
  errorMessage?: string
}

export function buildFunnelInsight(result: FunnelResult): InsightData & AlertContractFields {
  const isFallback = result.dataSource !== 'real_snapshot'

  const fallbackReason: Record<Exclude<FunnelResult['dataSource'], 'real_snapshot'>, string> = {
    fallback_by_client: 'Não há registro desta conta salvo para este período.',
    fallback_by_empty: 'O período existe; não veio nenhum dado de clique nele.',
    fallback_by_error: result.errorMessage
      ? `A busca deste dado falhou: ${result.errorMessage}`
      : 'A busca deste dado falhou. Tente de novo antes de tratar o número como real.',
    empty_database: 'O banco não possui registros para este cliente no período selecionado.',
    error: result.errorMessage
      ? `A busca deste dado falhou: ${result.errorMessage}`
      : 'A busca deste dado falhou. Tente de novo antes de tratar o número como real.',
  }

  const ctrText = `De cada 100 pessoas que abrem sua bio, ${formatPtBr(result.linkCtrPct)} clicam no link`

  return {
    id: crypto.randomUUID(),
    text: isFallback
      ? `${ctrText} — mas este número não é do período pedido. Não use para projetar venda nem para subir verba. ${fallbackReason[result.dataSource as Exclude<FunnelResult['dataSource'], 'real_snapshot'>]}`
      : `${ctrText} neste período.`,
    natureza: 'tecnica',
    probableCause: isFallback
      ? `${fallbackReason[result.dataSource as Exclude<FunnelResult['dataSource'], 'real_snapshot'>]} Confirme a ingestão do período real antes de usar este número em projeção.`
      : 'n/a',
    confidenceLevel: isFallback ? 'L2' : 'L0',
    dataSource: result.dataSource,
  }
}

/* -------------------------------------------------------------------------- */
/*  Queda de engajamento                                                      */
/* -------------------------------------------------------------------------- */

export interface EngagementCollapseInput {
  engagementChangePct: number
  windowDays: number
  followerBalanceTrend: number | null
  formatMixChanged: boolean | null
  allFormatsDroppedSimultaneously: boolean | null
}

export function resolveEngagementCollapseAlert(input: EngagementCollapseInput): AlertDraft {
  const base = withMissingDataGuard(
    input.followerBalanceTrend,
    'Puxe o saldo de seguidores deste período. É o dado que separa "menos gente vendo" de "mudei o tipo de post".',
    (followerBalance) => {
      if (followerBalance < 0) {
        return {
          type: 'engagement_collapse' as const,
          severity: 'critical' as AlertSeverity,
          title: `Curtida, comentário e salvamento caíram ${formatPtBr(input.engagementChangePct)}% em ${input.windowDays} dias — e você está perdendo seguidores também`,
          description: null,
          probableCause:
            'Não é só menos gente vendo o post. Quem já seguia está deixando de seguir. Isso não parece troca voluntária de assunto.',
          immediateAction:
            'Não mude o tipo de conteúdo ainda. Primeiro confira se algum post recente foi limitado ou denunciado. Só depois discuta pauta.',
        }
      }

      if (input.formatMixChanged) {
        return {
          type: 'engagement_collapse' as const,
          severity: 'warning' as AlertSeverity,
          title: 'A queda de engajamento veio junto com a troca de formato de post',
          description: null,
          probableCause:
            'Você comparou um período de Reels com um período de foto (ou carrossel). Está comparando dois tipos de post diferentes como se fossem um só.',
          immediateAction: 'Fixe um único formato por 30 dias. Só então leia a queda de novo.',
        }
      }

      return {
        type: 'engagement_collapse' as const,
        severity: 'info' as AlertSeverity,
        title: 'Menos gente está vendo os posts; o número de seguidores não caiu',
        description: null,
        probableCause:
          'Parece que menos gente está vendo, não que os seguidores estão insatisfeitos. Pode até ser saudável se quem vê estiver interagindo mais.',
        immediateAction:
          'Compare curtida e comentário por pessoa que viu nos mesmos 7 a 14 dias. Se essa proporção subiu, não trate esta queda como crise.',
      }
    }
  )

  return {
    ...base,
    natureza: 'tecnica',
    confidenceLevel: input.followerBalanceTrend === null ? 'L2' : 'L1',
    dataSource: 'real_snapshot',
  }
}

/* -------------------------------------------------------------------------- */
/*  Fadiga de criativo                                                        */
/* -------------------------------------------------------------------------- */

export interface CreativeFatigueInput {
  fatiguePct: number
  fatigueThreshold: number
  daysUntilThresholdCross: number | null
  roasTrend: 'rising' | 'stable' | 'falling' | null
  roasCurrent: number
  roasTarget: number
}

function formatRoasPlain(value: number): string {
  return `${formatPtBr(value)}x (a cada R$1 investido, voltam R$${formatPtBr(value)})`
}

export function resolveCreativeFatigueAlert(input: CreativeFatigueInput): AlertDraft {
  const base = withMissingDataGuard(
    input.roasTrend,
    'Puxe se o retorno do anúncio está subindo, estável ou caindo nos últimos 7 a 14 dias. As pessoas já terem visto o anúncio demais não basta, sozinho, para trocar de peça.',
    (trend) => {
      if (trend === 'falling') {
        const prazo = input.daysUntilThresholdCross
          ? ` No ritmo atual, isso passa do limite combinado em ${input.daysUntilThresholdCross} dias.`
          : ''
        return {
          type: 'creative_fatigue' as const,
          severity: 'warning' as AlertSeverity,
          title: `As mesmas pessoas já viram este anúncio demais (${formatPtBr(input.fatiguePct)}% de repetição) e o retorno está caindo`,
          description: null,
          probableCause:
            'A repetição deixou de ser só um alerta de estoque de público: já está comendo resultado de venda.',
          immediateAction: `Troque o criativo agora. Esperar só deixa o prejuízo maior.${prazo}`,
        }
      }

      return {
        type: 'creative_fatigue' as const,
        severity: 'info' as AlertSeverity,
        title: `As mesmas pessoas já viram este anúncio bastante (${formatPtBr(input.fatiguePct)}%), mas ele ainda paga: retorno de ${formatRoasPlain(input.roasCurrent)}, contra a meta de ${formatRoasPlain(input.roasTarget)}`,
        description: null,
        probableCause:
          'Repetição de exposição e retorno financeiro medem coisas diferentes. Um pode subir sem o outro ter quebrado.',
        immediateAction:
          'Não troque ainda. Se o retorno cair antes de bater o limite combinado, investigue outra causa — não troque só por repetição.',
      }
    }
  )

  return {
    ...base,
    natureza: 'tecnica',
    confidenceLevel: input.roasTrend === null ? 'L2' : 'L1',
    dataSource: 'real_snapshot',
  }
}

/* -------------------------------------------------------------------------- */
/*  ROAS                                                                      */
/* -------------------------------------------------------------------------- */

export interface RoasBelowMinimumInput {
  roasCurrent: number
  roasTarget: number
  roasMinViable: number
  cpmChangePctThisAccount: number | null
  cpmChangePctMarketBenchmark: number | null
  frequencyChangePct: number | null
}

export function resolveRoasBelowMinimumAlert(input: RoasBelowMinimumInput): AlertDraft {
  const belowFloor = input.roasCurrent <= input.roasMinViable
  const roasPlain = formatRoasPlain(input.roasCurrent)

  const base = withMissingDataGuard(
    input.cpmChangePctMarketBenchmark,
    'Puxe quanto o Instagram está cobrando para mostrar anúncio no mercado neste período. Sem esse número não dá para saber se ficou caro só para você ou para todo mundo. Enquanto isso, não troque o criativo como primeira resposta.',
    (marketCpm) => {
      const marketWide =
        input.cpmChangePctThisAccount !== null &&
        Math.abs((input.cpmChangePctThisAccount ?? 0) - marketCpm) < 10

      if (marketWide) {
        return {
          type: 'roas_below_minimum' as const,
          severity: 'critical' as AlertSeverity,
          title: `Retorno em ${roasPlain} — mostrar anúncio ficou mais caro para todo mundo no Instagram, não só para você`,
          description: null,
          probableCause:
            'O custo da sua conta subiu no mesmo ritmo do mercado inteiro. Não é o criativo que piorou; é o preço do anúncio no período.',
          immediateAction: 'Não troque o anúncio. Ajuste o valor do lance ou espere o preço do anúncio baixar.',
        }
      }

      if (input.frequencyChangePct !== null && input.frequencyChangePct > 0) {
        return {
          type: 'roas_below_minimum' as const,
          severity: 'critical' as AlertSeverity,
          title: `Retorno em ${roasPlain} — só a sua conta ficou mais cara, e é o mesmo anúncio se repetindo para as mesmas pessoas`,
          description: null,
          probableCause: 'O público já viu esta peça demais. Isso encarece só a sua conta, não o mercado.',
          immediateAction:
            'Troque o criativo. Testar público novo só depois, se o custo não cair com a peça nova.',
        }
      }

      return {
        type: 'roas_below_minimum' as const,
        severity: 'critical' as AlertSeverity,
        title: `Retorno em ${roasPlain} — sua conta ficou mais cara sem o mesmo anúncio se repetir mais`,
        description: null,
        probableCause:
          'Não parece as mesmas pessoas vendo demais o anúncio. O grupo visado pode ter esgotado.',
        immediateAction: 'Teste um público novo antes de mexer no criativo ou no valor do lance.',
      }
    }
  )

  return {
    ...base,
    severity: belowFloor ? 'critical' : base.severity,
    immediateAction:
      belowFloor && input.cpmChangePctMarketBenchmark === null
        ? `Pause o que está com retorno abaixo de ${formatRoasPlain(input.roasMinViable)} hoje. Isolar a causa sem pausar deixa a conta perdendo dinheiro enquanto investiga.`
        : base.immediateAction,
    natureza: 'tecnica',
    confidenceLevel: input.cpmChangePctMarketBenchmark === null ? 'L2' : 'L1',
    dataSource: 'real_snapshot',
  }
}

/* -------------------------------------------------------------------------- */
/*  Engajamento público (benchmark v1 — comentários + shares / impressões)   */
/* -------------------------------------------------------------------------- */

export interface EngagementPublicInput {
  snapshotId: string
  engagementPublic: number  // percentual: (comments + shares) / impressions × 100
}

export async function resolveEngagementPublicAlert(
  input: EngagementPublicInput,
  category?: string | null,
  tier?: string | null
): Promise<AlertDraft | null> {
  // classifyMetric() chama fn_classify_metric via RPC (engagement_public
  // está em MARKET_RPC_METRICS com dado v1). guardOutOfRangePercentMetric()
  // já roda dentro de classifyMetric() — não duplicar aqui.
  const classified = await classifyMetric(
    'engagement_public',
    input.engagementPublic,
    category ?? 'all',
    tier ?? 'all',
  )

  // semaphore 'verde' ou 'neutro' → sem alerta. 'neutro' acontece se a
  // métrica sair de MARKET_RPC_METRICS no futuro — defensivo.
  if (classified.semaphore === 'verde' || classified.semaphore === 'neutro') return null

  const isRed = classified.semaphore === 'vermelho'
  const v1Caveat =
    ' (Referência: benchmark v1 — recalibração v2 pendente. Use como sinal, não como decisão de verba isolada.)'

  return {
    type: 'engagement_collapse',
    severity: isRed ? 'critical' : 'warning',
    title: isRed
      ? `Engajamento público crítico — só ${formatPtBr(input.engagementPublic, 2)}% das impressões viraram comentário ou compartilhamento`
      : `Engajamento público abaixo do esperado — ${formatPtBr(input.engagementPublic, 2)}% das impressões viraram comentário ou compartilhamento`,
    description: withTranslation(
      `${classified.statusText}${v1Caveat}`,
      'engagement_public',
      input.engagementPublic,
    ),
    natureza: 'tecnica',
    probableCause: isRed
      ? 'O conteúdo gera impressões mas não provoca reação pública (comentário ou compartilhamento). Pode ser tema fora do interesse real da audiência ou ausência de chamada para interação.'
      : 'O engajamento público está aquém do recorte de referência. Pode ser ritmo de publicação, tipo de assunto ou falta de CTA explícito.',
    immediateAction: isRed
      ? 'Nos próximos 3 posts, inclua uma pergunta ou provocação que peça resposta nos comentários. Não troque o produto — troque o convite.'
      : 'Teste incluir uma pergunta direta em legendas. Meça em 14 dias antes de mudar formato ou frequência.',
    confidenceLevel: classified.confidenceLevel,
    dataSource: 'real_snapshot',
    thresholdSource: classified.thresholdSource,
    confidenceScore: classified.confidenceScore,
    ruleDeclaration: classified.ruleDeclaration,
    snapshotId: input.snapshotId,
    metricName: 'engagement_public',
    metricValue: input.engagementPublic,
    thresholdValue: null,
  }
}

/* -------------------------------------------------------------------------- */
/*  Risco algorítmico (self-reference — conta vs. histórico dela mesma)       */
/* -------------------------------------------------------------------------- */

// ⚠️ algo_risk_score NÃO usa fn_classify_metric nem MARKET_RPC_METRICS.
// É auto-comparação: 1 − (mediana_recente / mediana_baseline), calculado
// em orbit.v_algo_risk_score. Escala analítica −∞..1 (negativo = acima
// do próprio baseline = bom). Limiar de produto: ≥ 0.30 → aviso;
// ≥ 0.50 → crítico. Valores negativos são sempre sinal saudável.
// Nunca reusar bins de benchmark global (verde ≤ 25 / vermelho ≥ 40 do
// ref_thresholds v1) — são famílias distintas.
const ALGO_RISK_AMBER_THRESHOLD = 0.30
const ALGO_RISK_RED_THRESHOLD = 0.50

export interface AlgoRiskScoreInput {
  snapshotId: string
  // Ratio analítico: 1 − (median_r / median_b). Range −∞..1.
  // null → amostra insuficiente (n_r < 6 ou sem baseline) — não alertar.
  algoRiskScore: number | null
  // Número de posts na janela recente (R). Exposto para aviso de confiança.
  nRecent: number | null
}

export function resolveAlgoRiskScoreAlert(
  input: AlgoRiskScoreInput,
): AlertDraft | null {
  // null = amostra insuficiente calculada pela view — sem régua, sem alerta.
  if (input.algoRiskScore === null || input.algoRiskScore === undefined) return null

  const score = input.algoRiskScore

  // Negativo ou abaixo do limiar de atenção → conta acima ou dentro do
  // próprio histórico. Não gera alerta.
  if (score < ALGO_RISK_AMBER_THRESHOLD) return null

  const isRed = score >= ALGO_RISK_RED_THRESHOLD
  const scorePct = (score * 100).toFixed(0)

  // Aviso de amostra curta: n_r entre 6 e 11 (mínimo aceito, mas não robusto).
  const lowSampleCaveat =
    input.nRecent !== null && input.nRecent < 12
      ? ` Amostra recente curta (${input.nRecent} posts) — sinal real, mas inconclusivo: publique mais antes de mudar estratégia.`
      : ''

  return {
    type: 'engagement_collapse',
    severity: isRed ? 'critical' : 'warning',
    title: isRed
      ? `Queda expressiva de engajamento vs. histórico da conta — mediana recente caiu ~${scorePct}%`
      : `Engajamento recente abaixo do histórico da conta — queda de ~${scorePct}% na mediana`,
    description:
      `Esta comparação é da conta contra ela mesma (últimos posts vs. período anterior). Não é benchmark de mercado.${lowSampleCaveat}`,
    natureza: 'tecnica',
    probableCause: isRed
      ? 'A mediana de engajamento dos posts recentes caiu de forma expressiva em relação ao histórico da mesma conta. Pode ser mudança de tema, de formato ou de frequência — ou limitação algorítmica.'
      : 'O engajamento recente está abaixo do próprio histórico da conta. Pode ser variação natural ou início de queda — confirme com mais posts antes de agir.',
    immediateAction: isRed
      ? 'Revise os últimos 12 posts: verificar se houve mudança de formato, tema ou frequência que coincide com a queda. Não mude oferta nem verba antes desse diagnóstico.'
      : 'Acompanhe por mais 14 dias. Se a queda persistir, compare os posts do período B com os do período R para identificar a diferença.',
    confidenceLevel: (input.nRecent !== null && input.nRecent >= 12) ? 'L1' : 'L2',
    dataSource: 'real_snapshot',
    thresholdSource: null,  // self-reference, não benchmark de mercado
    confidenceScore: null,
    ruleDeclaration: 'Comparação da conta com o próprio histórico (self-reference). Não é benchmark setorial.',
    snapshotId: input.snapshotId,
    metricName: 'algo_risk_score',
    metricValue: score,
    thresholdValue: null,
  }
}

/* -------------------------------------------------------------------------- */
/*  Score de engajamento                                                      */
/* -------------------------------------------------------------------------- */

export async function resolveEngagementScoreAlert(
  input: EngagementScoreInput,
  category?: string | null,
  tier?: string | null
): Promise<AlertDraft> {
  const categoryForClassify = category ?? undefined
  const tierForClassify = tier ?? undefined

  // ✅ FIX (15/09/2026): classifyMetric() exige `value: number` — não dá
  // pra chamar com `null`. Quando vpsPct é null (reach_followers_pct não
  // ingerido, ORB-DEBT-034), monta um ClassifiedMetric sintético
  // 'neutro' local em vez de pular a chamada ou fabricar um 0 que pareça
  // dado real. semaphore='neutro' garante que os branches de
  // vps.semaphore==='vermelho' abaixo nunca disparam por engano.
  const [er, vps, polemic] = await Promise.all([
    classifyMetric('er_real_pct', input.erRealPct, categoryForClassify, tierForClassify),
    input.vpsPct != null
      ? classifyMetric('vps_pct', input.vpsPct, categoryForClassify, tierForClassify)
      : Promise.resolve<ClassifiedMetric>({
          value: 0,
          semaphore: 'neutro',
          statusText: 'VPS indisponível: reach_followers_pct ainda não foi ingerido para esta conta (ver ORB-DEBT-034). O número não aparece até a ingestão ser corrigida — não é classificado com dado ausente.',
          confidenceLevel: 'L0',
          thresholdSource: null,
          confidenceScore: null,
          ruleDeclaration: 'Sem reach_followers_pct não é possível calcular VPS C-02.',
          calibrationMethod: null,
          zeroInflated: null,
        }),
    classifyMetric('polemic_score_pct', input.polemicScorePct, categoryForClassify, tierForClassify),
  ])

  // ✅ NOVO (execução ORBIT, verificação do fio CASO G, 14/09/2026): guarda
  // EXPLÍCITA, não implícita. er_real_pct/vps_pct estão fora de
  // MARKET_RPC_METRICS (contentContractEngine.ts §"Porta da RPC") — nunca
  // têm régua de mercado hoje, então 'neutro' nunca pode abrir alerta de
  // gestão (warning/critical) nem ser lido como "saudável" (isso seria
  // fabricar positivo sem base, o mesmo erro em espelho de fabricar
  // negativo). Os branches de er.semaphore/vps.semaphore contra
  // 'vermelho'/'ambar' logo abaixo já ficam estruturalmente inalcançáveis
  // quando neutro — este assert documenta a invariante em vez de depender
  // só disso implicitamente, e trava em dev se alguém reativar er/vps em
  // MARKET_RPC_METRICS sem revisar este arquivo.
  if (process.env.NODE_ENV !== 'production') {
    if (er.semaphore === 'neutro' && (er.thresholdSource !== null || vps.thresholdSource !== null)) {
      console.warn('[CASO G] er/vps saíram de MARKET_RPC_METRICS mas thresholdSource não é null — revise a invariante em contentContractEngine.ts')
    }
  }

  if (input.vpsPct != null && (input.vpsPct < 0 || input.vpsPct > 100)) {
    return {
      type: 'engagement_collapse',
      severity: 'warning',
      title: `Alcance acumulado na base em ${formatPtBr(input.vpsPct)}% no período`,
      description: vps.statusText,
      natureza: 'tecnica',
      probableCause:
        'Este indicador vem de um snapshot agregado da conta. Acima de 100% pode ser válido quando soma o alcance de vários conteúdos no período; não deve ser interpretado como alcance de um único post.',
      immediateAction:
        'Compare este valor com o período selecionado e use-o apenas como alcance acumulado da conta.',
      confidenceLevel: vps.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: vps.thresholdSource,
      confidenceScore: vps.confidenceScore,
      ruleDeclaration: vps.ruleDeclaration,
      snapshotId: input.snapshotId,
      metricName: 'vps_pct',
      metricValue: input.vpsPct,
      thresholdValue: null,
    }
  }

  if (input.vpsPct != null && vps.semaphore === 'vermelho') {
    return {
      type: 'engagement_collapse',
      severity: 'critical',
      title: `Só ${formatPtBr(input.vpsPct)}% dos seus seguidores viram este post`,
      description: withTranslation(vps.statusText, 'vps_pct', input.vpsPct),
      natureza: 'tecnica',
      probableCause:
        'Alcance na base é quantos dos seus seguidores viram o post — não é nota de qualidade nem de proposta de valor. Enquanto ele estiver baixo, "post ruim" e "post que não circulou" parecem a mesma coisa.',
      immediateAction:
        'Mantenha o mesmo formato e mude só o horário nas próximas 4 publicações. Se o alcance na base continuar baixo, aí investigamos se a conta está sendo limitada — não comece por aí.',
      confidenceLevel: vps.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: vps.thresholdSource,
      confidenceScore: vps.confidenceScore,
      ruleDeclaration: vps.ruleDeclaration,
      snapshotId: input.snapshotId,
      metricName: 'vps_pct',
      metricValue: input.vpsPct,
      thresholdValue: null,
    }
  }

  if (polemic.zeroInflated) {
    const isWithinNormalRange =
      polemic.semaphore !== 'vermelho' &&
      (polemic.confidenceScore === null || polemic.confidenceScore >= 0.75)

    return {
      type: 'polemic_score_high',
      severity: isWithinNormalRange ? 'info' : 'warning',
      title: isWithinNormalRange
        ? `${formatPtBr(input.polemicScorePct)}% dos seus posts têm gente discordando nos comentários — isso é normal no seu segmento`
        : `${formatPtBr(input.polemicScorePct)}% dos seus posts têm gente discordando nos comentários`,
      description: polemic.statusText,
      natureza: 'tecnica',
      probableCause: isWithinNormalRange
        ? 'A maioria das contas do seu segmento não tem esse tipo de comentário em nenhum post. O seu número está na faixa de quem tem — não é sinal de crise e não é convite para criar briga.'
        : 'Há mais gente discordando nos comentários do que o normal do seu segmento. Pode ser dúvida útil ou ataque — o número sozinho não diferencia.',
      immediateAction: isWithinNormalRange
        ? 'Não mude o tom dos posts por este cartão. Releia em 30 dias, com mais posts publicados.'
        : 'Leia os 20 comentários mais recentes. Se forem pergunta e opinião, mantenha o tom. Se forem ataque, feche a moderação desses posts.',
      confidenceLevel: polemic.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: polemic.thresholdSource,
      confidenceScore: polemic.confidenceScore,
      ruleDeclaration: polemic.ruleDeclaration,
      snapshotId: input.snapshotId,
      metricName: 'polemic_score_pct',
      metricValue: input.polemicScorePct,
      thresholdValue: null,
    }
  }

  if (polemic.semaphore === 'vermelho') {
    return {
      type: 'polemic_score_high',
      severity: 'warning',
      title: `${formatPtBr(input.polemicScorePct)}% dos seus posts têm gente discordando nos comentários — acima do normal`,
      description: withTranslation(polemic.statusText, 'polemic_score_pct', input.polemicScorePct),
      natureza: 'tecnica',
      probableCause:
        'Há mais gente discordando nos comentários do que o recorte costuma ver. Pode ser conversa útil ou briga. Não é meta para subir.',
      immediateAction:
        'Leia os 20 comentários mais recentes. Se forem pergunta e opinião, mantenha o tom. Se forem ataque, feche a moderação desses posts.',
      confidenceLevel: polemic.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: polemic.thresholdSource,
      confidenceScore: polemic.confidenceScore,
      ruleDeclaration: polemic.ruleDeclaration,
      snapshotId: input.snapshotId,
      metricName: 'polemic_score_pct',
      metricValue: input.polemicScorePct,
      thresholdValue: null,
    }
  }

  if (er.semaphore === 'vermelho' || er.semaphore === 'ambar') {
    const isLowConfidenceAmber =
      er.semaphore === 'ambar' && er.confidenceScore !== null && er.confidenceScore < 0.75
    const isMissingConfidence = er.confidenceScore === null

    if (isLowConfidenceAmber || isMissingConfidence) {
      const card = buildLowConfidenceCard(
        'er_real_pct',
        input.erRealPct,
        er.ruleDeclaration ?? '',
        er.confidenceScore
      )
      return {
        type: 'engagement_collapse',
        severity: 'warning',
        title: card.title,
        description: withTranslation(
          buildLowConfidenceWarning(er.ruleDeclaration ?? ''),
          'er_real_pct',
          input.erRealPct
        ),
        natureza: 'tecnica',
        probableCause: card.probableCause,
        immediateAction: card.immediateAction,
        confidenceLevel: er.confidenceLevel,
        dataSource: 'real_snapshot',
        thresholdSource: er.thresholdSource,
        confidenceScore: er.confidenceScore,
        ruleDeclaration: er.ruleDeclaration,
        snapshotId: input.snapshotId,
        metricName: 'er_real_pct',
        metricValue: input.erRealPct,
        thresholdValue: null,
      }
    }

    return {
      type: 'engagement_collapse',
      severity: er.semaphore === 'vermelho' ? 'critical' : 'warning',
      title: `As pessoas veem o post e não fazem nada com ele — só ${formatPtBr(input.erRealPct)}% curtem, comentam, salvam ou compartilham`,
      description: withTranslation(er.statusText, 'er_real_pct', input.erRealPct),
      natureza: 'tecnica',
      probableCause:
        'As pessoas veem o post. Falta curtida, salvamento, comentário ou compartilhamento. O conteúdo não está pedindo nada que a pessoa queira fazer.',
      immediateAction:
        'No próximo post, peça uma coisa só: salvar, ou responder uma pergunta com 2 opções. Mesmo formato. Não troque o produto e o pedido ao mesmo tempo.',
      confidenceLevel: er.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: er.thresholdSource,
      confidenceScore: er.confidenceScore,
      ruleDeclaration: er.ruleDeclaration,
      snapshotId: input.snapshotId,
      metricName: 'er_real_pct',
      metricValue: input.erRealPct,
      thresholdValue: null,
    }
  }

  // ✅ CORRIGIDO (execução ORBIT, 14/09/2026): antes, este bloco sempre
  // dizia "Engajamento saudável" usando er.ruleDeclaration — mas com PR-A,
  // er.ruleDeclaration hoje é 'Ainda não há recorte de mercado calibrado
  // para esta métrica.' (er/vps fora de MARKET_RPC_METRICS). Colar essa
  // frase depois de "saudável" fabricava positivo sem base — o mesmo erro
  // em espelho de fabricar negativo. Quando não há régua, o card é
  // informativo (severity 'info', sem alegação de saúde), não elogio.
  //
  // ✅ FIX (15/09/2026, TS2345): o título abaixo mencionava
  // formatPtBr(input.vpsPct) diretamente — quebra de tipo porque vpsPct
  // pode ser null (ORB-DEBT-034). Trocado por formatVpsSegment(), que já
  // devolve a frase inteira ("X% dos seguidores viram" ou o aviso de
  // indisponibilidade) sem forçar um número onde não há dado.
  if (er.semaphore === 'neutro') {
    return {
      type: 'engagement_collapse',
      severity: 'info',
      title: `Engajamento no período — ${formatPtBr(input.erRealPct)}% agem no post, ${formatVpsSegment(input.vpsPct)}`,
      description: `${er.statusText} ${vps.statusText}`.trim(),
      natureza: 'tecnica',
      probableCause: 'n/a — sem régua de mercado calibrada para ER real/VPS hoje.',
      immediateAction: 'Acompanhe estes dois números na própria série, semana a semana. Não são comparáveis a mercado ainda.',
      confidenceLevel: 'L2',
      dataSource: 'real_snapshot',
      thresholdSource: null,
      confidenceScore: null,
      ruleDeclaration: er.ruleDeclaration,
      snapshotId: input.snapshotId,
      metricName: 'er_real_pct',
      metricValue: input.erRealPct,
      thresholdValue: null,
    }
  }

  return {
    type: 'engagement_collapse',
    severity: 'info',
    title: `Engajamento saudável para o seu porte — ${formatPtBr(input.erRealPct)}% agem no post, ${formatVpsSegment(input.vpsPct)}`,
    description: withTranslation(
      `${er.ruleDeclaration ?? ''} O formato que gerou isso é o seu ativo. Repita-o.`.trim(),
      'er_real_pct',
      input.erRealPct
    ),
    natureza: 'tecnica',
    probableCause: 'n/a',
    immediateAction: 'Nas próximas 4 peças, copie o formato que funcionou. Só depois teste uma variação.',
    confidenceLevel: 'L0',
    dataSource: 'real_snapshot',
    thresholdSource: er.thresholdSource,
    confidenceScore: er.confidenceScore,
    ruleDeclaration: er.ruleDeclaration,
    snapshotId: input.snapshotId,
    metricName: 'er_real_pct',
    metricValue: input.erRealPct,
    thresholdValue: null,
  }
}

/* -------------------------------------------------------------------------- */
/*  Exportação                                                                */
/* -------------------------------------------------------------------------- */

function computeExportable(
  severity: AlertSeverity,
  confidenceScore: number | null | undefined
): boolean {
  const isGreenEquivalent = severity === 'info' || severity === 'success'
  if (!isGreenEquivalent) return false
  if (confidenceScore === null || confidenceScore === undefined) return false
  return true
}

export function toCriticalAlert(draft: AlertDraft): CriticalAlertData {
  return {
    id: crypto.randomUUID(),
    title: draft.title,
    body: draft.description ?? draft.immediateAction,
    exportable: computeExportable(draft.severity, draft.confidenceScore),
    severity: draft.severity,
    description: draft.description ?? null,
    actionUrl: null,
    natureza: draft.natureza,
    probableCause: draft.probableCause,
    immediateAction: draft.immediateAction,
    dataSource: draft.dataSource,
  }
}