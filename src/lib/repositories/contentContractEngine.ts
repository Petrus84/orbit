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
   ========================================================================== */

import type {
  Alert,
  AlertSeverity,
  AlertNatureza,       // ⚠️ requer patch em orbit.ts — ver orbit_ts_patch.diff.ts
  ConfidenceLevel,
  CriticalAlertData,
  InsightData,
  CalibrationMethod,     // ✅ NOVO v1.3 — SSOT em orbit.ts
  ThresholdGranularity,  // ✅ NOVO v1.3 — SSOT em orbit.ts
  RefThresholdRow,       // ✅ MOVIDO v1.3 — antes redeclarado aqui, agora SSOT em orbit.ts
  ClassifiedMetric,      // ✅ MOVIDO v1.3 — antes redeclarado aqui, agora SSOT em orbit.ts
} from '@/types/orbit'
import { supabase } from '@/lib/supabase'

// ----------------------------------------------------------------------------
// Extensões de tipo — fecham os gaps do SIPOC.
// `AlertNatureza`, `RefThresholdRow`, `ClassifiedMetric` NÃO são
// redeclarados aqui — vêm de orbit.ts (SSOT), mesma regra que orbit.ts já
// impõe em todo o resto do projeto (tipo de domínio não nasce no
// consumidor). Versões anteriores deste arquivo cometiam exatamente esse
// erro para `RefThresholdRow`/`ClassifiedMetric` — corrigido nesta revisão.
// ----------------------------------------------------------------------------

export interface AlertContractFields {
  natureza: AlertNatureza
  probableCause: string
  confidenceLevel: ConfidenceLevel
  // 'fallback_by_error' / 'fallback_by_empty' adicionados nesta revisão —
  // funnelRepository.ts (v4.0.0) já distingue os dois casos (erro do
  // Supabase vs. período sem dado) e essa distinção é genuinamente mais
  // precisa que o 'fallback_by_client' original. Mantido por compatibilidade
  // com o que já existe em orbit.content_insights.data_source; se usar
  // 'fallback_by_error'/'fallback_by_empty' em produção, rodar o ALTER
  // correspondente na coluna do banco (era CHECK/enum de 3 valores).
  dataSource: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'estimate'
  // ✅ NOVO (Content Contract v1.3): os 3 campos que o payload do frontend
  // precisa ter para métricas classificadas por régua (§0.1/§0.2). Opcionais
  // aqui de propósito — só CASO G (`resolveEngagementScoreAlert`) usa
  // `classifyMetric()`; os outros 6 resolvers são árvore-de-eliminação
  // (item 1, 2, 6, 7, 11/19), não régua de percentil, então não têm régua
  // pra declarar. Forçar esses campos em todos os resolvers inventaria uma
  // transparência de régua que não existe pra alertas rule-tree.
  thresholdSource?: ThresholdGranularity
  confidenceScore?: number | null
  ruleDeclaration?: string
}

export type AlertDraft = Pick<Alert, 'type' | 'severity' | 'title' | 'description'> &
  AlertContractFields & {
    immediateAction: string
  }

// ----------------------------------------------------------------------------
// Shape cru do retorno de `fn_classify_metric` pós-migração v1.3.
// ⚠️ NÃO EXPORTADO — é detalhe de transporte da RPC, não tipo de domínio
// (por isso não foi pra orbit.ts junto com RefThresholdRow/ClassifiedMetric).
// Os 4 primeiros campos (`semaphore`, `status_text`, `confidence_level`,
// e os originais) já existiam antes da v1.3 e estão confirmados em
// produção. `category`/`tier`/`confidence_score`/`calibration_method` e o
// par `zero_pct`/`signal_range_label` são o que a função precisa devolver
// a mais para o contrato v1.3 funcionar (§0.1, §0.2, §1.1) — **a migração
// de `fn_classify_metric` para devolver esses campos é pré-requisito desta
// revisão**; até lá, todos os acessos abaixo são defensivos com `?? null`
// e o engine cai para o texto de "régua não declarada" em vez de quebrar.
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// deriveThresholdSource — rotula qual nível da hierarquia (§0.1) o Postgres
// usou, A PARTIR do category/tier que a RPC já devolveu. Isso não decide
// nada: só traduz o que o banco escolheu pro vocabulário de
// `ThresholdGranularity`. Se um dia o banco parar de mandar category/tier,
// isso cai pra 'global' (mais conservador — nunca declara régua mais
// específica do que o confirmado).
// ----------------------------------------------------------------------------
function deriveThresholdSource(category: string | null | undefined, tier: string | null | undefined): ThresholdGranularity {
  if (!category || category === 'all') return 'global'
  if (!tier || tier === 'all') return 'category_all'
  return 'category_tier'
}

// ----------------------------------------------------------------------------
// formatCategoryLabel — só cosmética (underscore → espaço, remove prefixo
// numérico de enum tipo '1_ecommerce_direto'). Não decide régua.
// ----------------------------------------------------------------------------
function formatCategoryLabel(category: string): string {
  return category
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .trim()
}

// ----------------------------------------------------------------------------
// buildRuleDeclaration — monta o texto obrigatório do §0.1 ("Transparência
// da régua utilizada"), usando literalmente os 3 exemplos corretos do
// contrato como template por nível de granularidade.
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// applyConfidenceGate — Content Contract v1.3 §0.2. Comportamento de
// TEXTO/STATUS a partir de confidence_score, não de threshold — o próprio
// contrato atribui este ajuste ao código (Introdução, item 6), não mais ao
// banco. Regra: "Um número com baixa confiança nunca deve ser apresentado
// como fato consolidado."
//   ≥ 0.90            → não mexe (🟢 pleno, se já era 🟢)
//   0.75 – 0.89       → não força cor, mas sinaliza ressalva leve no texto
//   < 0.75            → força 🟡 se estava 🟢; nunca deixa aparecer como 🟢
//   confidence null   → trata como baixa confiança (mesma regra do < 0.75) —
//                        não presumir alta confiança na ausência do dado
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// buildZeroInflatedText — Content Contract v1.3 §1.1. Só chamado quando
// `calibration_method === 'empirical_percentile_zero_inflated'`. Nunca
// tratar o zero automaticamente como falha.
// ----------------------------------------------------------------------------
function buildZeroInflatedText(
  categoryLabel: string,
  zeroPct: number,
  signalRangeLabel: string
): string {
  return `${zeroPct.toFixed(0)}% dos posts desta ${categoryLabel} não apresentam sinal comercial explícito. Isso é o padrão da amostra, não necessariamente um problema. Os posts que apresentam sinal estão em ${signalRangeLabel}.`
}

// ----------------------------------------------------------------------------
// classifyMetric — única porta de entrada para "essa cor é essa cor por
// quê". Chama fn_classify_metric no Postgres. Não recalcula percentil
// aqui — v1.3 só adiciona rotulagem de régua (§0.1) e gate de confiança
// (§0.2) em cima do que o Postgres já decidiu.
// ----------------------------------------------------------------------------

export async function classifyMetric(
  metricName: string,
  value: number
): Promise<ClassifiedMetric> {
  const { data, error } = await supabase.rpc('fn_classify_metric', {
    p_metric_name: metricName,
    p_value: value,
  })

  if (error || !data?.[0]) {
    // Content Contract: sem régua ou erro de leitura, não inventar cor.
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

  // ⚠️ GUARDA ADICIONADA (auditoria contra orbit_schema.sql, 25/08/2026):
  // fn_classify_metric() hoje devolve RETURNS TABLE(category, tier,
  // confidence_score, calibration_method, zero_pct, signal_range_label) —
  // 6 colunas. NÃO devolve semaphore/status_text/confidence_level como
  // campos próprios; `row.semaphore` chega `undefined` do Supabase (não
  // lança erro — só não tem essa chave). Sem esta guarda, o `undefined`
  // vazava pra applyConfidenceGate() e o resolver de CASO G nunca batia
  // 'vermelho'/'ambar', caindo sempre no branch "Engajamento saudável" —
  // uma falsa negativa silenciosa, o padrão que a REGRA-11 existe pra
  // proibir. A migração correta é dar match no RETURNS TABLE real da
  // função pra incluir esses 3 campos (ver proposta de migração enviada
  // separadamente); até lá, isto trata o shape errado como "classificação
  // indisponível", igual ao caminho já existente pra ausência de dado —
  // não decide semáforo nenhum sozinho, só recusa confiar num campo que
  // não existe.
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

// ----------------------------------------------------------------------------
// Guard genérico — formaliza a regra mais repetida do Content Contract Tree
// (itens 1, 4, 15, 25, 29): se o dado que decide entre causas concorrentes
// não existir, o alerta É a ausência do dado, não um chute sobre a causa.
// ----------------------------------------------------------------------------

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

// ============================================================================
// CASO A — CTR bio abaixo do threshold (item 1 do Content Contract Tree)
// Confronta com o alerta real hoje exibido (imagem 2):
//   "CTR bio abaixo do threshold — CP Import Store. CTR atual: 0.9% ·
//    Threshold: 3% · Há 14 dias abaixo do limite. Bio sem CTA específico
//    para o catálogo atual." → botões: Simular funil / Ignorar 7 dias
// O alerta atual já assume a causa ("bio sem CTA específico") sem checar se
// existe quebra de CTR por origem de tráfego. Pelo item 1, essa é a causa
// errada até prova em contrário — reescrever a bio contra ela desperdiça o
// único teste limpo da conta.
// ============================================================================

export interface CtrBioInput {
  ctrValue: number
  threshold: number
  daysBelowThreshold: number
  linkIsWorking: boolean
  originBreakdown: { origin: string; ctr: number }[] | null // null = dado ainda não coletado
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

// ============================================================================
// CASO B — Avatar declarado × avatar real (itens 11 e 19)
// Confronta com Avatar Alignment real (imagem 5): declarado Masculino 70%
// vs. real Feminino 71.7% (dado de API, badge de confiança "L0" na tela).
// Regra do item 11: dado de conversão pesa mais que briefing declarado —
// SEMPRE, sem exceção — mas a RECOMENDAÇÃO de pivô é uma decisão de negócio
// (L2), não um fato. A tela atual mistura os dois numa única severidade
// "Crítico" sem separar visualmente qual parte é dado (L0) e qual é
// julgamento (L2) — é exatamente a distinção que este resolver formaliza.
//
// ⚠️ Pré-requisito antes de codificar isto em produção: a fórmula de
// score_total na tela usa 3 variáveis (gênero 40% / idade 40% / geo 20%),
// mas o modelo de 4 eixos já registrado (gênero 25% / idade 20% / geo 20% /
// valores-afeto 35%) não bate com esses pesos. As duas fórmulas não podem
// coexistir no banco — decidir qual é a canônica é pré-condição para este
// resolver calcular `score` de forma confiável; até lá, ele só usa o score
// já calculado a montante, não recalcula.
// ============================================================================

export interface AvatarDivergenceInput {
  declaredDominant: string
  realDominant: string
  realSource: 'instagram_insights' | 'client_feedback' | 'manual'
  realConfidence: ConfidenceLevel
  isRealFromConversionData: boolean // true = dado de conversão; false = só engajamento (armadilha do item 19)
  productAdaptableToRealAudience: boolean | null // null = ainda não avaliado com o cliente
}

export function resolveAvatarAlert(input: AvatarDivergenceInput): AlertDraft {
  if (!input.isRealFromConversionData) {
    // Armadilha do item 19: "avatar real" por engajamento engaja mais e
    // compra menos — não é o mesmo que avatar real por conversão.
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
    severity: 'critical', // é decisão estratégica, não operacional — item 11
    title: `Avatar declarado (${input.declaredDominant}) diverge do avatar real de conversão (${input.realDominant})`,
    description: null,
    natureza: 'comunicacao', // a ação daqui pra frente é de negócio/discurso, não de correção técnica
    probableCause: 'dado de conversão real diverge do briefing declarado no onboarding',
    immediateAction:
      input.productAdaptableToRealAudience === null
        ? 'decidir com o cliente: pivotar avatar de marketing para o público real, ou adaptar produto — decisão executiva, não automática'
        : input.productAdaptableToRealAudience
          ? 'pivotar avatar de marketing para o público real; produto já é vendável a ele'
          : 'decisão executiva mais cara: adaptar produto ou aceitar mercado real menor que o imaginado',
    confidenceLevel: input.realConfidence, // L0 no dado; a UI deve exibir a recomendação com um segundo selo (L2) separado
    dataSource: 'real_snapshot',
  }
}

// ============================================================================
// CASO C — Fallback do Funil (imagem 4)
// funnelRepository.fetchFunnelData() cai em FALLBACK_BY_CLIENT quando não há
// linha em orbit.ig_account_snapshots para o período. O simulador então usa
// CTR bio 4.6% calculado sobre esse fallback como se fosse dado do período
// pedido. Isso é o oposto da regra de governança "null deve propagar
// visivelmente" — o fallback está mascarado atrás de um número que parece
// ao vivo.
// ============================================================================

export interface FunnelResult {
  reach: number
  ctrBio: number
  dataSource: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty'
  fallbackClientId?: string
  errorMessage?: string  // preenchido só quando dataSource === 'fallback_by_error'
}

export function buildFunnelInsight(result: FunnelResult): InsightData & AlertContractFields {
  const isFallback = result.dataSource !== 'real_snapshot'

  const fallbackReason: Record<Exclude<FunnelResult['dataSource'], 'real_snapshot'>, string> = {
    fallback_by_client: 'ausência de linha em orbit.ig_account_snapshots para o período solicitado',
    fallback_by_empty:  'período solicitado existe na tabela mas sem linha retornada (funil vazio)',
    fallback_by_error:  `erro do Supabase ao buscar funnel_data${result.errorMessage ? `: ${result.errorMessage}` : ''}`,
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

// ============================================================================
// CASO D — Colapso de engajamento (item 2 da árvore)
// Confronta com o alerta real hoje exibido (imagem 1/2): "Petruchio Fitness
// — engajamento em colapso (-68.9% em 90d). Todos os formatos caindo
// simultaneamente. Sinal de ruptura de contrato com o algoritmo — não
// sazonalidade." Saldo de seguidores no mesmo card: -92.
//
// O item 2 da árvore dá o dado que decide ANTES de aceitar "ruptura de
// algoritmo" como causa: (1) saldo de seguidores caiu junto? (2) a queda é
// uniforme entre formatos ou é troca de mix (ex: migrou de Reels pra
// Carrossel, o que derruba a métrica por razão estrutural, não por saúde
// de conta)? O alerta atual já escreve a conclusão ("ruptura de contrato")
// sem expor esses dois checks — este resolver formaliza os dois antes de
// confirmar a causa.
// ============================================================================

export interface EngagementCollapseInput {
  engagementChangePct: number          // ex: -68.9
  windowDays: number                   // ex: 90
  followerBalanceTrend: number | null  // ex: -92; null = ainda não coletado
  formatMixChanged: boolean | null     // true = composição de formato mudou no período; null = não verificado
  allFormatsDroppedSimultaneously: boolean | null
}

export function resolveEngagementCollapseAlert(input: EngagementCollapseInput): AlertDraft {
  const base = withMissingDataGuard(
    input.followerBalanceTrend,
    'coletar saldo de seguidores do período antes de classificar a causa — é o dado que decide entre ruptura de algoritmo e mudança de mix de formato (item 2)',
    (followerBalance) => {
      if (followerBalance < 0) {
        // saldo caiu junto → item 2: "provável ruptura de algoritmo com
        // base fiel reagindo melhor ao pouco que resta (mais grave)"
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
        // item 2: "mistura de formato mudou → correlação espúria, não causal"
        return {
          type: 'engagement_collapse' as const,
          severity: 'warning' as AlertSeverity,
          title: 'Queda de engajamento coincide com mudança de mix de formato',
          description: null,
          probableCause: 'troca de composição de formato explica a métrica — correlação espúria, não ruptura',
          immediateAction: 'não agir sobre a queda isoladamente; reavaliar após 30 dias de mix estável',
        }
      }

      // saldo estável/positivo e mix não mudou → item 2: "provável melhora
      // real de qualidade de conteúdo com alcance limitado por escala natural"
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
    // item 2, alert_fields explícito: confidence_level L1 mesmo no branch
    // "confirmado" — é inferência sobre saldo+mix, não causa raiz confirmada
    // por fonte externa (Meta, guideline enforcement).
    confidenceLevel: input.followerBalanceTrend === null ? 'L2' : 'L1',
    dataSource: 'real_snapshot',
  }
}

// ============================================================================
// CASO E — Fadiga de criativo (item 6 + governança do item 17)
// Confronta com o alerta real hoje exibido (imagem 2): "Criativo com fadiga
// — CP Import Store. Criativo 'Gadgets-Unboxing-v2' com fadiga de 38%
// (threshold crítico: 40%). Frequência: 2.3. Cruzará o limite em 4-6 dias
// no ritmo atual." → severity hoje: Atenção (warning), sem mencionar ROAS.
//
// Item 6 é explícito: fadiga por si só NUNCA é gatilho de troca — o gatilho
// real é a tendência do ROAS. O alerta atual dispara só com % de fadiga e
// frequência, sem checar se o indicador de resultado (ROAS) já está caindo.
// Item 17 complementa: não recalibrar o threshold de fadiga pra baixo só
// pra "pegar" um caso — investigar causa alternativa primeiro.
// ============================================================================

export interface CreativeFatigueInput {
  fatiguePct: number              // ex: 38
  fatigueThreshold: number        // ex: 40
  daysUntilThresholdCross: number | null
  roasTrend: 'rising' | 'stable' | 'falling' | null   // null = ainda não coletado
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
          severity: 'warning' as AlertSeverity, // item 6: warning, nunca critical, mesmo cruzando o threshold
          title: `Fadiga de criativo em ${input.fatiguePct}% com ROAS em queda`,
          description: null,
          probableCause: 'fadiga já está corroendo resultado, ainda não cruzou o threshold de meta',
          immediateAction: `trocar o criativo agora, antes de cruzar o threshold de meta (ação proativa)${input.daysUntilThresholdCross ? ` — ${input.daysUntilThresholdCross} dias no ritmo atual` : ''}`,
        }
      }

      // estável ou subindo apesar da fadiga → item 6: aguardar
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

// ============================================================================
// CASO F — ROAS abaixo do mínimo viável (árvore de eliminação do item 7)
// Confronta com o alerta real hoje exibido (imagem 2): "ROAS abaixo da meta
// — CP Import Store. ROAS atual: 2.1x · Meta: 2.5x · ROAS mínimo viável
// (margem do catálogo gadgets): 2.5x. Operando no limite de rentabilidade."
//
// Aqui meta = mínimo viável — não é "abaixo do ideal", é "abaixo do que
// sustenta margem". Item 7 é explícito: "nunca trocar criativo como
// primeira resposta a queda de ROAS sem isolar se o CPM subiu no mercado
// geral primeiro — é o erro mais caro do bloco inteiro". O alerta atual só
// mostra "Ver campanhas" como ação, sem a árvore de eliminação por trás.
// ============================================================================

export interface RoasBelowMinimumInput {
  roasCurrent: number
  roasTarget: number
  roasMinViable: number
  cpmChangePctThisAccount: number | null
  cpmChangePctMarketBenchmark: number | null  // null = sem assinatura/dado de benchmark de mercado
  frequencyChangePct: number | null
}

export function resolveRoasBelowMinimumAlert(input: RoasBelowMinimumInput): AlertDraft {
  const belowFloor = input.roasCurrent <= input.roasMinViable

  const base = withMissingDataGuard(
    input.cpmChangePctMarketBenchmark,
    'obter benchmark de CPM do mercado no período — sem ele não é possível isolar leilão mais caro (mercado inteiro) de problema específico da conta (item 7); enquanto isso, não trocar criativo como primeira resposta',
    (marketCpm) => {
      const marketWide = input.cpmChangePctThisAccount !== null &&
        Math.abs((input.cpmChangePctThisAccount ?? 0) - marketCpm) < 10 // dentro de ~10pp = "acompanha o mercado"

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
    // piso de rentabilidade rompido é urgência financeira — sempre critical,
    // independente de a árvore de eliminação já ter rodado ou não.
    severity: belowFloor ? 'critical' : base.severity,
    immediateAction: belowFloor && input.cpmChangePctMarketBenchmark === null
      ? 'pausar campanhas abaixo do piso de rentabilidade enquanto a causa é isolada — não esperar o diagnóstico completo para conter a perda'
      : base.immediateAction,
    natureza: 'tecnica',
    confidenceLevel: input.cpmChangePctMarketBenchmark === null ? 'L2' : 'L1',
    dataSource: 'real_snapshot',
  }
}

// ============================================================================
// CASO G — Scores de orbit.ig_account_snapshots (er_real_pct, utility_score_pct,
// polemic_score_pct, vps_pct). Decisão registrada: _pct é a convenção
// canônica — utilidade_score/polemica_score (PT) foram depreciados em
// deprecate_pt_metric_names.sql.
//
// ⚠️ DIFERENÇA DELIBERADA vs. os outros 6 resolvers: este é `async`. Os
// outros recebem o resultado da classificação já pronto no input (o
// caller decide como obter isso). Este chama classifyMetric() direto,
// porque os 4 valores vêm juntos do mesmo snapshot e não faz sentido o
// caller rodar 4 RPCs manualmente antes de montar o input.
//
// ⚠️ NÃO adotei o draft que você recebeu como veio: ele comparava
// `input.erRealPct < input.benchmark.erRealMin` direto em JS — isso
// reimplementa a régua fora do Postgres, exatamente a regra de ouro que
// este arquivo existe pra evitar (ver cabeçalho do arquivo). Troquei por
// classifyMetric(), que já lê de orbit.ref_thresholds.
//
// ⚠️ 'algorithm_distribution_low' e 'engagement_healthy' (tipos usados no
// draft) NÃO estão confirmados no enum real orbit.alert_type (só temos
// certeza dos 9 valores documentados no SSOT). Não inventei valor novo —
// reusei 'engagement_collapse' para os 3 branches, diferenciando por
// severity. Se você quiser tipos dedicados, precisa confirmar/criar no
// enum do banco antes — troca de 1 string aqui depois que existir.
// ============================================================================

export interface EngagementScoreInput {
  erRealPct: number
  utilityScorePct: number
  polemicScorePct: number
  vpsPct: number
}

export async function resolveEngagementScoreAlert(input: EngagementScoreInput): Promise<AlertDraft> {
  const [er, vps, polemic] = await Promise.all([
    classifyMetric('er_real_pct', input.erRealPct),
    classifyMetric('vps_pct', input.vpsPct),
    classifyMetric('polemic_score_pct', input.polemicScorePct),
  ])

  // ⚠️ v1.3: os 3 campos de régua/confiança do payload (thresholdSource,
  // confidenceScore, ruleDeclaration) sempre vêm da métrica que decidiu o
  // branch abaixo — nunca de uma das outras duas. Misturar a régua de uma
  // métrica com o número de outra seria exatamente o tipo de mentira sobre
  // a régua que a §9 (Nota de governança) proíbe.

  if (vps.semaphore === 'vermelho') {
    return {
      type: 'engagement_collapse',
      severity: 'critical',
      // 🔴 template §3: "Ainda não sabemos [pergunta], porque [causa
      // técnica], Para resolver: [ação + responsável]" — aqui a "causa
      // técnica concreta" É o próprio resultado da régua (VPS vermelho),
      // não falta de dado, então o texto usa o statusText já pronto.
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
    // §1.1: se polemic_score_pct usa calibração zero-inflated, o
    // `statusText` já vem pronto no template zero-inflated (via
    // classifyMetric) — não sobrescrever com um título que ignore isso.
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
    // 🟡 template §2 nunca mostra número — só aplica quando a régua caiu
    // pra ambar POR confiança insuficiente (er.confidenceScore < 0.75),
    // que é o caso "estrutura pronta, aguardando confiança". Ambar por
    // valor abaixo do threshold (não por confiança) segue o template 🟢/🔴
    // normal, que pode mostrar número — são causas diferentes de ambar.
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

  // 🟢 template §1: "[valor] ([período]) — [comparação com a régua
  // utilizada], [o que isso prova ou o que fazer]." Período não está no
  // input deste resolver (EngagementScoreInput não carrega período) — se
  // vier a ser exigido no texto exportável (§5), precisa entrar no input.
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