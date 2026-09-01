/* ==========================================================================
   ORBIT · contentContractEngine.ts
   Implementação de código do modelo de decisão descrito em
   contentContractTreeDecisionModel.md, agora conciliado com o
   **Content Contract v1.3** (24/08/2026 — substitui v1.2). Consome os tipos
   de src/types/orbit.ts (não redeclarados aqui) e o schema de
   content_contract_migrationv1.2.sql.

   REGRA DE OURO deste arquivo: nenhuma função aqui reimplementa a régua de
   threshold em JS. A régua vive uma única vez em orbit.fn_classify_metric
   (Postgres). Isso existe porque a tela de Onboarding (imagem 3, "Split de
   audiência declarado") já documenta o bug-tipo que este arquivo evita:
   `audience_split_sum` validado tanto em OnboardingScreen.tsx quanto em
   onboardingRepository.ts — mesma regra, dois lugares, garantido divergir
   um dia. Aqui: uma regra, uma chamada RPC.

   ⚠️ O QUE MUDOU NESTA REVISÃO (v1.3):
   - `RefThresholdRow` e `ClassifiedMetric` SAÍRAM daqui e foram para
     orbit.ts (SSOT) — viviam redeclarados localmente, o mesmo erro que o
     comentário original deste arquivo já apontava para `AlertNatureza`.
   - `calibration_method` ganhou 2 valores novos no banco
     (`empirical_percentile`, `empirical_percentile_zero_inflated`) — ver
     orbit.ts. Este arquivo NÃO decide threshold a partir disso; usa só
     pra saber se precisa do texto zero-inflated do Content Contract §1.1.
   - `classifyMetric()` agora também devolve `thresholdSource`,
     `confidenceScore` e `ruleDeclaration` — a régua continua decidida
     100% no Postgres; o que mudou é que o Postgres agora informa qual
     nível da hierarquia (`category+tier → category+all → global`, §0.1)
     ele usou, e este arquivo só rotula/traduz isso pro vocabulário oficial
     do contrato. Isso NÃO é reimplementar a régua — é o texto declarar a
     régua que o banco já escolheu, exigência explícita do §0.1.
   - ✅ 25/08/2026: migração de `fn_classify_metric` CONFIRMADA em produção
     (`information_schema`/`pg_proc` verificado pós-migração) — a função
     hoje devolve os 9 campos que `FnClassifyMetricRow` espera
     (`semaphore, status_text, confidence_level, category, tier,
     confidence_score, calibration_method, zero_pct, signal_range_label`),
     usando `ref_thresholds.tier_normalized` na coluna `tier` (antes vinha
     preenchida com string de confidence level por engano). CASO G está
     desbloqueado. A guarda de shape em `classifyMetric()` (ver função,
     abaixo) foi mantida como backstop defensivo, não removida — não
     decide nada sozinha, só recusa confiar num `semaphore` fora de
     {verde,ambar,vermelho}.
   - O gate de confiança do §0.2 (confidence_score < 0.75 força 🟡/🔴) é
     comportamento de TEXTO/STATUS, não de threshold — o próprio contrato
     (Introdução, item 6) atribui esse ajuste ao código, não mais ao banco.
     Implementado em `applyConfidenceGate()`.

   ⚠️ O QUE MUDOU EM 31/08/2026 (fechamento de dívida — category/tier):
   - `classifyMetric()` e `resolveEngagementScoreAlert()` passam a aceitar
     `category`/`tier` opcionais e repassá-los para `fn_classify_metric`.
     A assinatura real da função no Postgres já era
     `fn_classify_metric(p_metric_name, p_value, p_category DEFAULT NULL,
     p_tier DEFAULT NULL)` — confirmado lendo a função no dump do banco
     (31/08/2026); o TS estava desatualizado em relação a ela, não o
     contrário.
   - `mapSegmentToCategory` e `mapFollowersToTier` foram adicionados.
     Confirmados contra dados reais (`SELECT DISTINCT category,
     tier_normalized FROM orbit.ref_thresholds`, 31/08/2026): hoje só
     existe UMA categoria calibrada (`1_ecommerce_direto`), com tiers
     nano/micro/mid/macro/all — todo o resto cai em `all`/`all` (global).
     Os cortes de `mapFollowersToTier` são os TIER_BANDS oficiais do
     pipeline (`calibrate_thresholds_stratified.py`) — os mesmos que
     gravaram `tier_normalized` nas linhas reais, não uma convenção de
     mercado genérica.
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

/**
 * ✅ Mapeia setor_benchmark → category de orbit.ref_thresholds.
 * Confirmado contra dados reais (SELECT DISTINCT category FROM
 * orbit.ref_thresholds, 31/08/2026): hoje só existe UMA categoria
 * calibrada, '1_ecommerce_direto'. Os outros 8 valores de SetorBenchmark
 * não têm régua própria — devolver `null` é o comportamento correto, não
 * uma lacuna: aciona o fallback global (Nível 3, §0.1) do próprio
 * fn_classify_metric, em vez de inventar uma categoria que não existe no
 * banco. Não invente '2_...', '3_...' etc. sem confirmar contra
 * orbit.ref_thresholds primeiro.
 */
export function mapSegmentToCategory(setorBenchmark: SetorBenchmark | null): string | null {
  if (setorBenchmark === 'comercio_direto_ecommerce_social') {
    return '1_ecommerce_direto'
  }
  return null
}

/**
 * ✅ Mapeia total_followers → tier_normalized de orbit.ref_thresholds.
 * Cortes = TIER_BANDS oficiais do pipeline (calibrate_thresholds_stratified.py),
 * os mesmos que gravaram tier_normalized nas linhas reais do banco — não
 * uma convenção de mercado genérica.
 *   nano   [0,         9_999]
 *   micro  [10_000,    49_999]
 *   mid    [50_000,   249_999]
 *   macro  [250_000,  999_999]
 *   mega   [1_000_000,    +∞]
 * Fonte: client_onboarding.total_followers — NUNCA
 * ig_account_snapshots.followers_total do último período (vem null,
 * confirmado 31/08/2026).
 * `null` de retorno é esperado e correto quando não há base (followers
 * ausente): a RPC faz COALESCE(p_tier, 'all').
 */
export function mapFollowersToTier(followers: number | null | undefined): string | null {
  if (followers == null || followers < 0) return null
  if (followers < 10_000) return 'nano'
  if (followers < 50_000) return 'micro'
  if (followers < 250_000) return 'mid'
  if (followers < 1_000_000) return 'macro'
  return 'mega'
}

function deriveThresholdSource(category: string | null | undefined, tier: string | null | undefined): ThresholdGranularity {
  if (!category || category === 'all') return 'global'
  if (!tier || tier === 'all') return 'category_all'
  return 'category_tier'
}

function formatCategoryLabel(category: string): string {
  return category
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .trim()
}

function buildRuleDeclaration(
  thresholdSource: ThresholdGranularity,
  category: string | null | undefined,
  tier: string | null | undefined
): string {
  switch (thresholdSource) {
    case 'category_tier':
      return `Comparado à faixa de referência para ${formatCategoryLabel(category ?? '')} de porte ${tier} (régua de categoria + porte).`
    case 'category_all':
      return `Comparado ao padrão observado em contas ${formatCategoryLabel(category ?? '')} (régua de categoria, sem quebra por porte).`
    case 'global':
    default:
      return 'Comparado ao benchmark global (régua mais ampla e de maior confiança estatística).'
  }
}

function applyConfidenceGate(
  semaphore: 'verde' | 'ambar' | 'vermelho',
  confidenceScore: number | null
): { semaphore: 'verde' | 'ambar' | 'vermelho'; caveat: string | null } {
  if (confidenceScore === null) {
    return {
      semaphore: semaphore === 'verde' ? 'ambar' : semaphore,
      caveat: 'confiança da régua não informada pela RPC — tratado como baixa confiança por precaução',
    }
  }
  if (confidenceScore < 0.75) {
    return {
      semaphore: semaphore === 'verde' ? 'ambar' : semaphore,
      caveat: 'ainda não temos amostra suficiente para confiança plena nesta régua',
    }
  }
  if (confidenceScore < 0.9) {
    return {
      semaphore,
      caveat: 'confiança moderada — dado utilizável com ressalva leve',
    }
  }
  return { semaphore, caveat: null }
}

function buildZeroInflatedText(
  categoryLabel: string,
  zeroPct: number,
  signalRangeLabel: string
): string {
  return `${zeroPct.toFixed(0)}% dos posts desta ${categoryLabel} não apresentam sinal comercial explícito. Isso é o padrão da amostra, não necessariamente um problema. Os posts que apresentam sinal estão em ${signalRangeLabel}.`
}

export async function classifyMetric(
  metricName: string,
  value: number,
  category?: string | null,
  tier?: string | null
): Promise<ClassifiedMetric> {
  const { data, error } = await supabase.rpc('fn_classify_metric', {
    p_metric_name: metricName,
    p_value: value,
    p_category: category ?? undefined,
    p_tier: tier ?? undefined,
  })

  if (error || !data?.[0]) {
    return {
      semaphore: 'ambar',
      statusText: `classificação indisponível para ${metricName} — não decidir sem o dado que falta`,
      confidenceLevel: 'L2',
      thresholdSource: 'global',
      confidenceScore: null,
      ruleDeclaration: 'régua não pôde ser determinada — sem dado de classificação retornado pela RPC.',
      calibrationMethod: null,
      zeroInflated: null,
    }
  }

  const row = data[0] as FnClassifyMetricRow

  const VALID_SEMAPHORES = ['verde', 'ambar', 'vermelho'] as const
  if (!VALID_SEMAPHORES.includes(row.semaphore as typeof VALID_SEMAPHORES[number])) {
    return {
      semaphore: 'ambar',
      statusText: `classificação indisponível para ${metricName} — fn_classify_metric() não devolveu semaphore/status_text/confidence_level no shape esperado (esperado desde a migração de 25/08/2026 — verificar se a RPC foi revertida ou se este cliente está batendo numa versão antiga em cache)`,
      confidenceLevel: 'L2',
      thresholdSource: 'global',
      confidenceScore: null,
      ruleDeclaration: 'régua não pôde ser determinada — RPC com shape incompatível.',
      calibrationMethod: null,
      zeroInflated: null,
    }
  }

  const thresholdSource = deriveThresholdSource(row.category, row.tier)
  const ruleDeclaration = buildRuleDeclaration(thresholdSource, row.category, row.tier)
  const confidenceScore = row.confidence_score ?? null
  const { semaphore, caveat } = applyConfidenceGate(row.semaphore, confidenceScore)

  const isZeroInflated = row.calibration_method === 'empirical_percentile_zero_inflated'
  const zeroInflated = isZeroInflated && row.zero_pct != null && row.signal_range_label
    ? { zeroPct: row.zero_pct, signalRangeLabel: row.signal_range_label }
    : null

  const statusText = zeroInflated
    ? buildZeroInflatedText(formatCategoryLabel(row.category ?? ''), zeroInflated.zeroPct, zeroInflated.signalRangeLabel)
    : caveat
      ? `${row.status_text} (${caveat})`
      : row.status_text

  return {
    semaphore,
    statusText,
    confidenceLevel: row.confidence_level,
    thresholdSource,
    confidenceScore,
    ruleDeclaration,
    calibrationMethod: row.calibration_method ?? null,
    zeroInflated,
  }
}

function withMissingDataGuard<TInput>(
  requiredData: TInput | null | undefined,
  missingDataAction: string,
  onPresent: (data: TInput) => Omit<AlertDraft, 'natureza' | 'confidenceLevel' | 'dataSource'>
): Pick<AlertDraft, 'title' | 'description' | 'severity' | 'type' | 'probableCause' | 'immediateAction'> {
  if (requiredData === null || requiredData === undefined) {
    return {
      type: 'data_gap',
      severity: 'warning',
      title: 'Causa indeterminável — dado necessário ausente',
      description: null,
      probableCause: 'causa indeterminável sem o dado que decide entre as hipóteses candidatas',
      immediateAction: missingDataAction,
    }
  }
  return onPresent(requiredData)
}

export interface CtrBioInput {
  ctrValue: number
  threshold: number
  daysBelowThreshold: number
  linkIsWorking: boolean
  originBreakdown: { origin: string; ctr: number }[] | null
}

export function resolveCtrBioAlert(input: CtrBioInput): AlertDraft {
  if (!input.linkIsWorking) {
    return {
      type: 'ctr_below_threshold',
      severity: 'critical',
      title: 'Link da bio quebrado',
      description: null,
      natureza: 'tecnica',
      probableCause: 'link quebrado ou redirecionamento lento',
      immediateAction: 'consertar o link e reavaliar CTR em 7 dias',
      confidenceLevel: 'L0',
      dataSource: 'real_snapshot',
    }
  }

  const base = withMissingDataGuard(
    input.originBreakdown,
    'instalar rastreamento de origem de tráfego (post vs. hashtag vs. busca) antes de qualquer mudança de bio',
    (breakdown) => {
      const lowOnlyInOneOrigin = breakdown.some((o) => o.ctr < input.threshold) &&
        breakdown.some((o) => o.ctr >= input.threshold)

      return lowOnlyInOneOrigin
        ? {
            type: 'ctr_below_threshold' as const,
            severity: 'warning' as AlertSeverity,
            title: 'CTR baixo concentrado em uma origem de tráfego',
            description: null,
            probableCause: 'origem específica de tráfego, não a bio em si',
            immediateAction: 'investigar/cortar a origem de baixa intenção antes de tocar na bio',
          }
        : {
            type: 'ctr_below_threshold' as const,
            severity: 'warning' as AlertSeverity,
            title: 'CTR uniformemente baixo entre origens',
            description: null,
            probableCause: 'bio/oferta — problema é uniforme, não de origem',
            immediateAction: 'reescrever bio, uma variável por vez, e reavaliar em 14 dias',
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
      title: 'Avatar "real" declarado por engajamento, não por conversão',
      description: null,
      natureza: 'tecnica',
      probableCause: 'engajamento alto pode não coincidir com quem efetivamente compra',
      immediateAction: 'cruzar avatar por engajamento vs. avatar por conversão antes de qualquer decisão de pivô',
      confidenceLevel: 'L2',
      dataSource: 'real_snapshot',
    }
  }

  return {
    type: 'avatar_misalignment',
    severity: 'critical',
    title: `Avatar declarado (${input.declaredDominant}) diverge do avatar real de conversão (${input.realDominant})`,
    description: null,
    natureza: 'comunicacao',
    probableCause: 'dado de conversão real diverge do briefing declarado no onboarding',
    immediateAction:
      input.productAdaptableToRealAudience === null
        ? 'decidir com o cliente: pivotar avatar de marketing para o público real, ou adaptar produto — decisão executiva, não automática'
        : input.productAdaptableToRealAudience
          ? 'pivotar avatar de marketing para o público real; produto já é vendável a ele'
          : 'decisão executiva mais cara: adaptar produto ou aceitar mercado real menor que o imaginado',
    confidenceLevel: input.realConfidence,
    dataSource: 'real_snapshot',
  }
}

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
    fallback_by_client: 'ausência de linha em orbit.ig_account_snapshots para o período solicitado',
    fallback_by_empty: 'período solicitado existe na tabela mas sem linha retornada (funil vazio)',
    fallback_by_error: `erro do Supabase ao buscar funnel_data${result.errorMessage ? `: ${result.errorMessage}` : ''}`,
  }

  return {
    id: crypto.randomUUID(),
    text: isFallback
      ? `CTR bio de ${result.ctrBio.toFixed(1)}% calculado sobre dado de fallback (${fallbackReason[result.dataSource as Exclude<FunnelResult['dataSource'], 'real_snapshot'>]}) — não usar para decisão de investimento sem confirmar período real.`
      : `CTR bio de ${result.ctrBio.toFixed(1)}% no período.`,
    natureza: 'tecnica',
    probableCause: isFallback
      ? `${fallbackReason[result.dataSource as Exclude<FunnelResult['dataSource'], 'real_snapshot'>]} — confirmar ingestão do período real antes de usar este número em projeção de vendas`
      : 'n/a',
    confidenceLevel: isFallback ? 'L2' : 'L0',
    dataSource: result.dataSource,
  }
}

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
    'coletar saldo de seguidores do período antes de classificar a causa — é o dado que decide entre ruptura de algoritmo e mudança de mix de formato (item 2)',
    (followerBalance) => {
      if (followerBalance < 0) {
        return {
          type: 'engagement_collapse' as const,
          severity: 'critical' as AlertSeverity,
          title: `Engajamento em colapso (${input.engagementChangePct.toFixed(1)}% em ${input.windowDays}d) com perda de seguidores`,
          description: null,
          probableCause: 'ruptura de distribuição pelo algoritmo — base fiel também caindo, não é reposicionamento voluntário de público',
          immediateAction: 'verificar shadowban/violação de guideline recente antes de qualquer mudança de estratégia de conteúdo; não tratar como problema de pauta',
        }
      }

      if (input.formatMixChanged) {
        return {
          type: 'engagement_collapse' as const,
          severity: 'warning' as AlertSeverity,
          title: 'Queda de engajamento coincide com mudança de mix de formato',
          description: null,
          probableCause: 'troca de composição de formato explica a métrica — correlação espúria, não ruptura',
          immediateAction: 'não agir sobre a queda isoladamente; reavaliar após 30 dias de mix estável',
        }
      }

      return {
        type: 'engagement_collapse' as const,
        severity: 'info' as AlertSeverity,
        title: 'Queda de alcance com saldo de seguidores estável',
        description: null,
        probableCause: 'alcance limitado por escala natural, não ruptura — checar se ER subiu no mesmo período',
        immediateAction: 'confirmar tendência de ER antes de descartar como saudável (item 2, ação padrão)',
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

export interface CreativeFatigueInput {
  fatiguePct: number
  fatigueThreshold: number
  daysUntilThresholdCross: number | null
  roasTrend: 'rising' | 'stable' | 'falling' | null
  roasCurrent: number
  roasTarget: number
}

export function resolveCreativeFatigueAlert(input: CreativeFatigueInput): AlertDraft {
  const base = withMissingDataGuard(
    input.roasTrend,
    'coletar tendência de ROAS dos últimos 7-14 dias — é o dado que decide entre trocar o criativo agora ou aguardar (item 6); fadiga sozinha não é gatilho',
    (trend) => {
      if (trend === 'falling') {
        return {
          type: 'creative_fatigue' as const,
          severity: 'warning' as AlertSeverity,
          title: `Fadiga de criativo em ${input.fatiguePct}% com ROAS em queda`,
          description: null,
          probableCause: 'fadiga já está corroendo resultado, ainda não cruzou o threshold de meta',
          immediateAction: `trocar o criativo agora, antes de cruzar o threshold de meta (ação proativa)${input.daysUntilThresholdCross ? ` — ${input.daysUntilThresholdCross} dias no ritmo atual` : ''}`,
        }
      }

      return {
        type: 'creative_fatigue' as const,
        severity: 'info' as AlertSeverity,
        title: `Fadiga de criativo em ${input.fatiguePct}% com ROAS estável (${input.roasCurrent}x vs. meta ${input.roasTarget}x)`,
        description: null,
        probableCause: 'fadiga declarada mas criativo ainda efetivo — os dois indicadores medem coisas diferentes em horizontes diferentes',
        immediateAction: 'aguardar; trocar agora desperdiça um ativo que ainda funciona. Não recalibrar o threshold de fadiga pra baixo (item 17) — investigar causa alternativa se a conversão cair antes do threshold ser cruzado',
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

  const base = withMissingDataGuard(
    input.cpmChangePctMarketBenchmark,
    'obter benchmark de CPM do mercado no período — sem ele não é possível isolar leilão mais caro (mercado inteiro) de problema específico da conta (item 7); enquanto isso, não trocar criativo como primeira resposta',
    (marketCpm) => {
      const marketWide = input.cpmChangePctThisAccount !== null &&
        Math.abs((input.cpmChangePctThisAccount ?? 0) - marketCpm) < 10

      if (marketWide) {
        return {
          type: 'roas_below_minimum' as const,
          severity: 'critical' as AlertSeverity,
          title: `ROAS ${input.roasCurrent}x no limite de rentabilidade — CPM subiu no mercado inteiro`,
          description: null,
          probableCause: 'leilão mais caro por sazonalidade/concorrência de mercado, não qualidade de criativo ou público',
          immediateAction: 'ajustar lance ou aguardar estabilização do leilão — não trocar criativo',
        }
      }

      if (input.frequencyChangePct !== null && input.frequencyChangePct > 0) {
        return {
          type: 'roas_below_minimum' as const,
          severity: 'critical' as AlertSeverity,
          title: `ROAS ${input.roasCurrent}x no limite de rentabilidade — CPM subiu só nesta conta com frequência em alta`,
          description: null,
          probableCause: 'fadiga de criativo é a causa provável (CPM sobe isolado + frequência em alta)',
          immediateAction: 'trocar criativo',
        }
      }

      return {
        type: 'roas_below_minimum' as const,
        severity: 'critical' as AlertSeverity,
        title: `ROAS ${input.roasCurrent}x no limite de rentabilidade — causa não isolada por criativo`,
        description: null,
        probableCause: 'público pode estar saturado — CPM sobe isolado sem aumento de frequência',
        immediateAction: 'testar público novo antes de qualquer outra ação',
      }
    }
  )

  return {
    ...base,
    severity: belowFloor ? 'critical' : base.severity,
    immediateAction: belowFloor && input.cpmChangePctMarketBenchmark === null
      ? 'pausar campanhas abaixo do piso de rentabilidade enquanto a causa é isolada — não esperar o diagnóstico completo para conter a perda'
      : base.immediateAction,
    natureza: 'tecnica',
    confidenceLevel: input.cpmChangePctMarketBenchmark === null ? 'L2' : 'L1',
    dataSource: 'real_snapshot',
  }
}

export interface EngagementScoreInput {
  erRealPct: number
  utilityScorePct: number
  polemicScorePct: number
  vpsPct: number
}

export async function resolveEngagementScoreAlert(
  input: EngagementScoreInput,
  category?: string | null,
  tier?: string | null
): Promise<AlertDraft> {
  const [er, vps, polemic] = await Promise.all([
    classifyMetric('er_real_pct', input.erRealPct, category, tier),
    classifyMetric('vps_pct', input.vpsPct, category, tier),
    classifyMetric('polemic_score_pct', input.polemicScorePct, category, tier),
  ])

  if (vps.semaphore === 'vermelho') {
    return {
      type: 'engagement_collapse',
      severity: 'critical',
      title: `Ainda não sabemos se o conteúdo está bom, porque o algoritmo não está distribuindo pros seguidores — VPS em ${input.vpsPct.toFixed(1)}% (${vps.statusText})`,
      description: null,
      natureza: 'tecnica',
      probableCause: 'baixa penetração no público próprio — possível shadowban ou desalinhamento de conteúdo',
      immediateAction: 'verificar shadowban e testar conteúdo/horário novo — responsabilidade Orbit (diagnóstico técnico)',
      confidenceLevel: vps.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: vps.thresholdSource,
      confidenceScore: vps.confidenceScore,
      ruleDeclaration: vps.ruleDeclaration,
    }
  }

  if (polemic.semaphore === 'vermelho') {
    return {
      type: 'polemic_score_high',
      severity: 'warning',
      title: polemic.zeroInflated
        ? `Polêmica ${input.polemicScorePct.toFixed(1)}% — ${polemic.statusText}`
        : `Polêmica em ${input.polemicScorePct.toFixed(1)}% (${polemic.ruleDeclaration})`,
      description: polemic.zeroInflated ? null : polemic.statusText,
      natureza: 'tecnica',
      probableCause: 'razão comentários/curtidas alta — conteúdo dividindo opinião',
      immediateAction: 'avaliar se é debate saudável (ok) ou hate (moderar/ajustar tom)',
      confidenceLevel: polemic.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: polemic.thresholdSource,
      confidenceScore: polemic.confidenceScore,
      ruleDeclaration: polemic.ruleDeclaration,
    }
  }

  if (er.semaphore === 'vermelho' || er.semaphore === 'ambar') {
    const isLowConfidenceAmber = er.semaphore === 'ambar' &&
      er.confidenceScore !== null && er.confidenceScore < 0.75

    return {
      type: 'engagement_collapse',
      severity: er.semaphore === 'vermelho' ? 'critical' : 'warning',
      title: isLowConfidenceAmber
        ? 'Estrutura pronta — ER Real ainda sem confiança suficiente para confirmar'
        : `ER Real em ${input.erRealPct.toFixed(1)}% — ${er.statusText}`,
      description: isLowConfidenceAmber
        ? `Volta a aparecer quando a amostra da régua atingir confiança ≥ 0,75. ${er.ruleDeclaration}`
        : null,
      natureza: 'tecnica',
      probableCause: 'conteúdo não está motivando ação (saves/shares/comments), só visualização passiva',
      immediateAction: isLowConfidenceAmber
        ? 'aguardar expansão da base de referência da régua — não decidir sobre este número ainda'
        : 'testar novo CTA ou formato de conteúdo',
      confidenceLevel: er.confidenceLevel,
      dataSource: 'real_snapshot',
      thresholdSource: er.thresholdSource,
      confidenceScore: er.confidenceScore,
      ruleDeclaration: er.ruleDeclaration,
    }
  }

  return {
    type: 'engagement_collapse',
    severity: 'info',
    title: `Engajamento saudável — ER Real ${input.erRealPct.toFixed(1)}%, VPS ${input.vpsPct.toFixed(1)}%`,
    description: `${er.ruleDeclaration} Priorize o formato que gerou esse resultado.`,
    natureza: 'tecnica',
    probableCause: 'n/a',
    immediateAction: 'continuar monitorando',
    confidenceLevel: 'L0',
    dataSource: 'real_snapshot',
    thresholdSource: er.thresholdSource,
    confidenceScore: er.confidenceScore,
    ruleDeclaration: er.ruleDeclaration,
  }
}

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
