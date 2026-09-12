// refThreshold.schema.ts
// Barreira de runtime: nenhum dado cruza o repositório sem passar por aqui.

import { z } from 'zod'
import type { RefThresholdRow, ThresholdSource, MetricDirection } from '@/types/orbit'

// `threshold_source` e `direction` são `string | null` soltos no
// database.types.ts — NÃO são ENUM nativo do Postgres (confirmado: o
// codegen só materializa `Database["orbit"]["Enums"][...]` para ENUMs
// reais, e essas duas colunas não aparecem lá). Podem estar restritas por
// CHECK constraint no banco, mas isso não é verificável a partir do
// arquivo gerado — ver observação do documento de Etapa 1, §0.3.
//
// Por isso a union literal do contrato (`ThresholdSource`, `MetricDirection`
// em orbit.ts) não pode ser assumida como garantida pelo tipo do banco. Este
// schema é o único ponto do sistema que de fato confere isso: se o Postgres
// devolver um valor fora da lista abaixo, a validação falha aqui — nunca via
// `as ThresholdSource` silencioso dentro do mapper.
const thresholdSourceEnum = z.enum(['category', 'category_tier', 'global', 'tier'])
const metricDirectionEnum = z.enum([
  'higher_is_better',
  'lower_is_better',
  'signal_intensity',
])

// Confere em tempo de build que a lista acima não ficou defasada em relação
// à union literal declarada em orbit.ts (se alguém adicionar um valor a
// `ThresholdSource`/`MetricDirection` e esquecer de atualizar aqui, ou
// vice-versa, o `tsc` aponta o erro nestas duas linhas).
type _AssertThresholdSourceInSync = z.infer<typeof thresholdSourceEnum> extends ThresholdSource
  ? ThresholdSource extends z.infer<typeof thresholdSourceEnum>
    ? true
    : never
  : never
type _AssertMetricDirectionInSync = z.infer<typeof metricDirectionEnum> extends MetricDirection
  ? MetricDirection extends z.infer<typeof metricDirectionEnum>
    ? true
    : never
  : never
const _syncCheck1: _AssertThresholdSourceInSync = true
const _syncCheck2: _AssertMetricDirectionInSync = true
void _syncCheck1
void _syncCheck2

/**
 * Valida o payload cru de `select * from orbit.ref_thresholds`
 * ANTES de entrar no mapper. Cobre TODAS as colunas da tabela, incluindo as
 * que o Contract não consome (`id`, `formula`, `mrr_ref`, `unit`,
 * `calibration_method`) — descartadas explicitamente no mapper, não aqui,
 * para manter esta camada fiel ao shape real do banco.
 *
 * É esta validação — não o tipo do TypeScript — que de fato garante que
 * `threshold_source`/`direction` chegam ao mapper já estreitados para as
 * unions literais do contrato.
 */
export const refThresholdTableRowSchema = z.object({
  id: z.number(),
  metric_name: z.string(),
  category: z.string().nullable(),
  tier_normalized: z.string().nullable(),
  dataset_id: z.string().nullable(),
  threshold_source: thresholdSourceEnum.nullable(),
  observation_unit: z.string().nullable(),
  direction: metricDirectionEnum.nullable(),
  formula: z.string().nullable(),
  mrr_ref: z.string().nullable(),
  unit: z.string().nullable(),
  calibration_method: z
    .enum([
      'percentile_relative',
      'percentile_based',
      'percentile_based_lower_better',
      'empirical_percentile',
      'empirical_percentile_zero_inflated',
    ])
    .nullable(),
  percentile_p10: z.number().nullable(),
  percentile_p25: z.number().nullable(),
  percentile_p50: z.number().nullable(),
  percentile_p75: z.number().nullable(),
  percentile_p90: z.number().nullable(),
  sample_mean: z.number().nullable(),
  sample_std: z.number().nullable(),
  sample_count: z.number().nullable(),
  confidence_score: z.number().nullable(),
  green_min: z.number().nullable(),
  green_max: z.number().nullable(),
  amber_min: z.number().nullable(),
  amber_max: z.number().nullable(),
  red_min: z.number().nullable(),
  red_max: z.number().nullable(),
  zero_count: z.number().nullable(),
  zero_rate: z.number().nullable(),
  notes: z.string().nullable(),
  benchmark_note: z.string().nullable(),
})

export const refThresholdTableRowListSchema = z.array(refThresholdTableRowSchema)

/** Tipo já validado — é isto que `refThreshold.mapper.ts` recebe como entrada. */
export type ValidatedRefThresholdTableRow = z.infer<typeof refThresholdTableRowSchema>

/**
 * Valida a SAÍDA do mapper — o shape que efetivamente atravessa para a UI.
 * `satisfies z.ZodType<RefThresholdRow>` amarra este schema ao tipo TS real:
 * se `RefThresholdRow` mudar em orbit.ts e este schema não acompanhar, o
 * `tsc` aponta o erro aqui, em tempo de build — não em produção.
 */
export const refThresholdRowSchema = z.object({
  metric_name: z.string(),
  category: z.string().nullable(),
  tier_normalized: z.string().nullable(),
  tier: z.string().nullable().optional(),
  dataset_id: z.string().nullable(),
  threshold_source: thresholdSourceEnum.nullable(),
  observation_unit: z.string().nullable(),
  direction: metricDirectionEnum.nullable(),
  percentile_p10: z.number().nullable(),
  percentile_p25: z.number().nullable(),
  percentile_p50: z.number().nullable(),
  percentile_p75: z.number().nullable(),
  percentile_p90: z.number().nullable(),
  sample_mean: z.number().nullable(),
  sample_std: z.number().nullable(),
  sample_count: z.number(),
  confidence_score: z.number().nullable(),
  green_min: z.number().nullable(),
  green_max: z.number().nullable(),
  amber_min: z.number().nullable(),
  amber_max: z.number().nullable(),
  red_min: z.number().nullable(),
  red_max: z.number().nullable(),
  zero_count: z.number().nullable(),
  zero_rate: z.number().nullable(),
  notes: z.string().nullable(),
  benchmark_note: z.string().nullable(),
}) satisfies z.ZodType<RefThresholdRow>

/**
 * Uso típico no repositório:
 *
 *   const raw = await supabase.from('ref_thresholds').select('*')
 *   const parsedRows = refThresholdTableRowListSchema.parse(raw.data)
 *   const contract = mapRefThresholdRowsToContract(parsedRows)
 *   // defesa em profundidade, opcional: revalida a saída antes de expor à UI
 *   contract.forEach((row) => refThresholdRowSchema.parse(row))
 */