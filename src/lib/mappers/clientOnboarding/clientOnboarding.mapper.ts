// clientOnboarding.mapper.ts
// Reconciliação: orbit.client_onboarding (tabela, DB) → ClientOnboarding (Contract, orbit.ts)
//
// Fonte do tipo de banco: importado direto de database.types.ts (isolamento
// de tipos). Qualquer schema drift (coluna renomeada/removida na tabela)
// quebra a compilação aqui, no ponto de origem, e não silenciosamente em
// runtime.
//
// Diferente de RefThresholdRow e AvatarAlignmentRow, este mapper tem 4
// fallbacks que NÃO são de apresentação pura — são de dado de auditoria
// (`updated_by`, `updated_at`) ou de proveniência (`values_affect_source`,
// `values_affect_confidence`). Ver comentário de cada constante abaixo.

import type { Database } from '@/types/database.types'
import type { ClientOnboarding, SchwatzValue } from '@/types/orbit'
import type {
  ValidatedClientOnboardingTableRow,
  SchwartzRawItem,
} from './clientOnboarding.schema'

type ClientOnboardingTableRow = Database['orbit']['Tables']['client_onboarding']['Row']

// ── Fallback de apresentação (baixo risco) ──────────────────────
// `priority` não é gravado no array bruto do JSONB (a coluna só guarda
// `value`) — 'low' é o fallback mais conservador da union, nunca uma
// afirmação de que o item foi de fato classificado como baixa prioridade.
const FALLBACK_SCHWARTZ_PRIORITY = 'low' as const

/**
 * Converte o ARRAY bruto de `expected_schwartz`/`real_schwartz` (forma real
 * da coluna JSONB no banco) para o `Record<string, SchwatzValue>` exigido
 * pelo Contract (`ClientOnboarding`, orbit.ts). A chave do Record é
 * `item.value` — mesma convenção usada no resto do domínio Schwartz.
 */
function schwartzArrayToRecord(
  items: readonly SchwartzRawItem[] | null
): Record<string, SchwatzValue> | null {
  if (!items) return null
  return Object.fromEntries(
    items.map((item): [string, SchwatzValue] => [
      item.value,
      { value: item.value, priority: item.priority ?? FALLBACK_SCHWARTZ_PRIORITY },
    ])
  )
}

// ── Fallbacks de proveniência (risco médio — decisão de negócio, não de
//    apresentação; ver nota da Etapa 2) ─────────────────────────────────
// `values_affect_source`: nenhum dos 3 valores da union significa
// "desconhecido". Escolhido 'onboarding' porque o registro, por definição,
// nasce nesta própria tabela — é a hipótese de menor viés, não uma
// confirmação de proveniência real. Recomendo confirmar com o time se a
// leitura correta não seria antes tornar o campo nulável no contrato.
const FALLBACK_VALUES_AFFECT_SOURCE = 'onboarding' as const
// `values_affect_confidence`: 'L0' é o nível mais baixo da escala — usado
// aqui como "sem confiança confirmada", não como afirmação de que L0 foi
// medido. É o fallback mais conservador disponível na union.
const FALLBACK_VALUES_AFFECT_CONFIDENCE = 'L0' as const

// ── Fallbacks de auditoria (risco mais alto do mapper — ver Etapa 2,
//    item 1. Recomendo tratar como sinal para tornar o contrato nulável
//    em vez de manter estes valores em produção) ────────────────────────
const FALLBACK_UPDATED_BY = 'sistema' as const
// Sentinela reconhecível (epoch), não "agora" — usar `new Date().toISOString()`
// aqui mentiria dizendo que o registro foi atualizado no momento da leitura,
// quando na verdade nunca teve `updated_at` gravado. Qualquer consumidor que
// ordene/exiba esta data deve tratar este valor como "sem data registrada",
// não como uma data real.
const FALLBACK_UPDATED_AT_UNKNOWN = '1970-01-01T00:00:00.000Z' as const

/**
 * Converte uma linha crua da tabela para o shape exigido pelo domínio.
 *
 * Pré-condição: `row` já passou por `clientOnboardingTableRowSchema.parse()`
 * (Etapa 4) — é isso que garante que `bio_links` já chega aqui com a forma
 * estruturada do contrato (não `Json` bruto), e que os campos "enum-like"
 * (`cta_type`, `funnel_maturity` etc.) já chegam estreitados para as unions
 * literais do contrato — sem type assertion neste arquivo. `expected_schwartz`/
 * `real_schwartz` são a exceção: chegam validados mas ainda na forma ARRAY
 * real da coluna JSONB — a conversão para `Record<string, SchwatzValue>`
 * (forma do Contract) é feita aqui por `schwartzArrayToRecord()`.
 *
 * `client_id` já é `NOT NULL` na tabela-base — não há hazard de identidade
 * a guardar aqui, diferente do `client_id` em `AvatarAlignmentRow` (que
 * vinha de uma view com LEFT JOIN).
 */
export function mapClientOnboardingRowToContract(
  row: ValidatedClientOnboardingTableRow
): ClientOnboarding {
  return {
    client_id: row.client_id,
    total_followers: row.total_followers,
    total_followers_source: row.total_followers_source,
    bio_links: row.bio_links,
    cta_type: row.cta_type,
    funnel_maturity: row.funnel_maturity,
    q1_engagement_period_notes: row.q1_engagement_period_notes,
    q2_content_proxy_notes: row.q2_content_proxy_notes,
    q3_misalignment_notes: row.q3_misalignment_notes,
    audience_nucleo_fiel_pct: row.audience_nucleo_fiel_pct,
    audience_consumo_passivo_pct: row.audience_consumo_passivo_pct,
    audience_curiosidade_externa_pct: row.audience_curiosidade_externa_pct,
    audience_alta_rotatividade_pct: row.audience_alta_rotatividade_pct,
    observed_content_clusters: row.observed_content_clusters,
    setor_benchmark: row.setor_benchmark,
    nicho: row.nicho,
    proof_mechanism: row.proof_mechanism,
    expected_panksepp_system: row.expected_panksepp_system,
    real_panksepp_system: row.real_panksepp_system,
    expected_schwartz: schwartzArrayToRecord(row.expected_schwartz),
    real_schwartz: schwartzArrayToRecord(row.real_schwartz),
    // null hazards de proveniência — ver constantes acima.
    values_affect_source: row.values_affect_source ?? FALLBACK_VALUES_AFFECT_SOURCE,
    values_affect_confidence:
      row.values_affect_confidence ?? FALLBACK_VALUES_AFFECT_CONFIDENCE,
    // null hazards de auditoria — ver constantes acima.
    updated_by: row.updated_by ?? FALLBACK_UPDATED_BY,
    updated_at: row.updated_at ?? FALLBACK_UPDATED_AT_UNKNOWN,
    // `avatar_expected_age_min/max`, `avatar_expected_gender`,
    // `avatar_expected_gender_pct` existem na tabela e não fazem parte do
    // Contract — intencionalmente omitidos, não é um gap deste mapper
    // (ver nota pendente no final).
  }
}

export function mapClientOnboardingRowsToContract(
  rows: readonly ValidatedClientOnboardingTableRow[]
): ClientOnboarding[] {
  return rows.map(mapClientOnboardingRowToContract)
}

export type { ClientOnboardingTableRow }