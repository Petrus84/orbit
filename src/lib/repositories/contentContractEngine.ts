/* ==========================================================================
   ORBIT · contentContractEngine.ts
   Content Contract v1.5.1 + textos de cliente (06/09/2026)

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
  ThresholdGranularity,
  CalibrationMethod,
  SetorBenchmark,
} from '@/types/orbit'
import { supabase } from '@/lib/supabase'

export interface AlertContractFields {
  natureza: AlertNatureza
  probableCause: string
  confidenceLevel: ConfidenceLevel
  dataSource: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'estimate'
  thresholdSource?: ThresholdGranularity
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
  vpsPct: number
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

const CALIBRATED_SETOR_BENCHMARK_CATEGORIES: ReadonlySet<SetorBenchmark> = new Set([
  'comercio_direto_ecommerce_social',
  'infoprodutor_educador_pago',
  'servico_consultoria_profissional',
  'patrocinio_publicidade_marca',
  'membership_assinatura_comunidade',
  'monetizacao_nativa_plataforma',
  'autoridade_personal_branding_b2b',
])

const SETOR_LABEL: Record<string, string> = {
  comercio_direto_ecommerce_social: 'lojas que vendem pelo Instagram',
  infoprodutor_educador_pago: 'infoprodutores e cursos',
  servico_consultoria_profissional: 'serviços e consultorias',
  patrocinio_publicidade_marca: 'marcas que vivem de publicidade',
  membership_assinatura_comunidade: 'assinaturas e comunidades',
  monetizacao_nativa_plataforma: 'contas que monetizam na própria plataforma',
  autoridade_personal_branding_b2b: 'autoridade e personal branding B2B',
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
}

const ZERO_INFLATED_EVENT_NOUN: Record<string, string> = {
  er_real_pct: 'ação de quem viu (curtida, comentário, salvamento ou compartilhamento)',
  vps_pct: 'alcance dentro da própria base de seguidores',
  polemic_score_pct: 'gente discordando nos comentários (não só curtindo)',
  utility_score_pct: 'salvamento ou compartilhamento',
  cta_rate_pct: 'pedido de compra',
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
}

const BOUNDED_PERCENT_METRICS: ReadonlySet<string> = new Set([
  'vps_pct',
  'er_real_pct',
  'utility_score_pct',
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
/*  Utilitários de tradução numérica                                          */
/* -------------------------------------------------------------------------- */

function formatPtBr(value: number, decimals: number = 1): string {
  return value.toFixed(decimals).replace('.', ',')
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

  const min = parseFloat(numbers[0])
  const max = parseFloat(numbers[1])
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
  ctrBio: number
  dataSource: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty'
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
  }

  const ctrText = `De cada 100 pessoas que abrem sua bio, ${formatPtBr(result.ctrBio)} clicam no link`

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
/*  Score de engajamento                                                      */
/* -------------------------------------------------------------------------- */

export async function resolveEngagementScoreAlert(
  input: EngagementScoreInput,
  category?: string | null,
  tier?: string | null
): Promise<AlertDraft> {
  const categoryForClassify = category ?? undefined
  const tierForClassify = tier ?? undefined

  const [er, vps, polemic] = await Promise.all([
    classifyMetric('er_real_pct', input.erRealPct, categoryForClassify, tierForClassify),
    classifyMetric('vps_pct', input.vpsPct, categoryForClassify, tierForClassify),
    classifyMetric('polemic_score_pct', input.polemicScorePct, categoryForClassify, tierForClassify),
  ])

  if (input.vpsPct < 0 || input.vpsPct > 100) {
    return {
      type: 'engagement_collapse',
      severity: 'warning',
      title: `Alcance na base em ${formatPtBr(input.vpsPct)}% — fora do que um post sozinho comporta`,
      description: vps.statusText,
      natureza: 'tecnica',
      probableCause:
        'Alcance na base deveria ser, no máximo, 100 em cada 100 seguidores por post. Este valor só faz sentido se for soma de vários posts — e, se for, o cartão precisa dizer isso.',
      immediateAction:
        'Confirme se este número é de um post ou somado no período antes de usar este cartão para qualquer decisão.',
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

  if (vps.semaphore === 'vermelho') {
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

  return {
    type: 'engagement_collapse',
    severity: 'info',
    title: `Engajamento saudável para o seu porte — ${formatPtBr(input.erRealPct)}% agem no post, ${formatPtBr(input.vpsPct)}% dos seguidores viram`,
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
    dataSource: draft.dataSource,
  }
}