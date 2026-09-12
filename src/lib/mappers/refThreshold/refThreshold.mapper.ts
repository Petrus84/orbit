// refThreshold.mapper.ts
// Reconciliação: orbit.ref_thresholds (tabela, DB) → RefThresholdRow (Contract, orbit.ts)
//
// Fonte do tipo de banco: importado direto de database.types.ts (isolamento
// de tipos). Qualquer schema drift (coluna renomeada/removida na tabela)
// quebra a compilação aqui, no ponto de origem, e não silenciosamente em
// runtime.
//
// Diferença estrutural em relação ao AvatarAlignmentMapper: aqui a fonte é
// uma TABELA, não uma view com LEFT JOIN — logo a maioria das colunas já é
// NOT NULL no banco e bate 1:1 com o contrato sem fallback. O único null
// hazard real é `sample_count`. `threshold_source` e `direction` têm um
// problema diferente (não é nulidade, é precisão de tipo não garantida pelo
// banco) e por isso NÃO são tratados aqui — são resolvidos na barreira Zod
// (refThreshold.schema.ts), que é o único lugar seguro para estreitar
// `string | null` para a union literal do contrato sem type assertion.

import type { Database } from '@/types/database.types'
import type { RefThresholdRow } from '@/types/orbit'
import type { ValidatedRefThresholdTableRow } from './refThreshold.schema'

/**
 * Row real retornada por `select * from orbit.ref_thresholds`.
 */
type RefThresholdTableRow = Database['orbit']['Tables']['ref_thresholds']['Row']

// Único fallback de apresentação deste mapper.
const FALLBACK_SAMPLE_COUNT = 0 as const

/**
 * Converte uma linha crua da tabela para o shape exigido pelo domínio.
 *
 * Pré-condição: `row` já passou por `refThresholdTableRowSchema.parse()`
 * (Etapa 4) — é isso que garante, em runtime, que `threshold_source` e
 * `direction` já chegam aqui tipados como `ThresholdSource | null` e
 * `MetricDirection | null` de fato, e não como `string | null` genérico.
 * Sem essa validação prévia, este mapper não compilaria sem type assertion.
 *
 * `metric_name` e `id` já são NOT NULL na tabela-base (não são view com
 * LEFT JOIN) — não há hazard de identidade a guardar aqui, diferente do
 * `client_id` no AvatarAlignmentMapper.
 */
export function mapRefThresholdRowToContract(
  row: ValidatedRefThresholdTableRow
): RefThresholdRow {
  return {
    metric_name: row.metric_name,
    category: row.category,
    tier_normalized: row.tier_normalized,
    // `tier` é alias opcional só para consumidores antigos (ver comentário
    // de `RefThresholdRow` em orbit.ts) — espelha `tier_normalized`.
    tier: row.tier_normalized,
    dataset_id: row.dataset_id,
    threshold_source: row.threshold_source,
    observation_unit: row.observation_unit,
    direction: row.direction,
    percentile_p10: row.percentile_p10,
    percentile_p25: row.percentile_p25,
    percentile_p50: row.percentile_p50,
    percentile_p75: row.percentile_p75,
    percentile_p90: row.percentile_p90,
    sample_mean: row.sample_mean,
    sample_std: row.sample_std,
    // único null hazard real da entidade: contrato exige `number`, banco
    // permite `null` (linha de referência ainda sem amostra calculada).
    sample_count: row.sample_count ?? FALLBACK_SAMPLE_COUNT,
    confidence_score: row.confidence_score,
    green_min: row.green_min,
    green_max: row.green_max,
    amber_min: row.amber_min,
    amber_max: row.amber_max,
    red_min: row.red_min,
    red_max: row.red_max,
    zero_count: row.zero_count,
    zero_rate: row.zero_rate,
    notes: row.notes,
    benchmark_note: row.benchmark_note,
    // `id`, `formula`, `mrr_ref`, `unit`, `calibration_method` existem na
    // tabela e não fazem parte do Contract — intencionalmente omitidos,
    // não é um gap deste mapper (ver nota pendente no final).
  }
}

/**
 * Versão em lote. Diferente do AvatarAlignmentMapper, não há descarte de
 * linha aqui: como não há hazard de identidade (id/metric_name já são NOT
 * NULL na tabela), toda linha validada pelo schema é mapeável.
 */
export function mapRefThresholdRowsToContract(
  rows: readonly ValidatedRefThresholdTableRow[]
): RefThresholdRow[] {
  return rows.map(mapRefThresholdRowToContract)
}

// Tipo re-exportado para deixar explícito, na assinatura das funções acima,
// que a entrada esperada já passou pela barreira Zod — não é o
// `RefThresholdTableRow` cru do codegen.
export type { RefThresholdTableRow }