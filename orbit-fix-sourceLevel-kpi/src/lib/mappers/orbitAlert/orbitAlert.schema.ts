// orbitAlert.schema.ts
// Barreira de runtime para orbit.alerts.
// Colunas confirmadas via information_schema em 09/09/2026 — 26 colunas.
//
// Enums USER-DEFINED identificados (confirmados em pg_enum nesta sessão):
//   alert_type     → orbit.alert_type
//   severity       → orbit.alert_severity  (critical, warning, info, success)
//   natureza       → orbit.alert_natureza
//   confidence_level → orbit.confidence_level (L0, L1, L2)
//
// `data_source` é text com CHECK constraint (não enum nativo) — tratado
// como string restrita aqui, único ponto que realmente valida em runtime.

import { z } from 'zod'

// ── Enums (refletem os tipos orbit.* confirmados no banco) ───────────────

const alertSeverityEnum = z.enum(['critical', 'warning', 'info', 'success'])

// ✅ CORRIGIDO: os 3 valores anteriores ('tecnica'|'estrategica'|'operacional')
// não batem com `AlertNatureza` em orbit.ts (`'tecnica' | 'comunicacao'`),
// que é a fonte canônica do CHECK `orbit.alert_natureza` (content_contract_migration.sql).
const alertNaturezaEnum = z.enum(['tecnica', 'comunicacao'])
const confidenceLevelEnum = z.enum(['L0', 'L1', 'L2'])

// data_source: text com CHECK constraint no banco, não enum nativo.
// ✅ CORRIGIDO: 'model_quantile' e 'trigger' não existem em nenhuma fonte
// canônica do projeto — nem em `Alert.dataSource` (orbit.ts) nem em
// `AlertDraft.dataSource`/`FunnelResult.dataSource` (contentContractEngine.ts).
// Reduzido para os 7 valores realmente usados nas três fontes.
const dataSourceEnum = z.enum([
  'real_snapshot',
  'fallback_by_client',
  'fallback_by_error',
  'fallback_by_empty',
  'empty_database',
  'error',
  'estimate',
]).nullable()

// ── Schema de entrada (row crua do banco, com JOIN de clients) ───────────
// Inclui todas as 26 colunas reais + o resultado do JOIN com clients.
// Colunas FKs de referência (ig_post_id, meta_creative_id, etc.) são
// incluídas pois existem no banco — omissão intencional deve ser no mapper,
// não aqui.

export const orbitAlertTableRowSchema = z.object({
  // NOT NULL no banco
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  created_at: z.string(),
  alert_type: z.string(),            // enum orbit.alert_type — z.string() pois
                                     // o codegen já estreita via AlertType
  severity: alertSeverityEnum,
  title: z.string(),
  is_resolved: z.boolean(),
  is_snoozed: z.boolean(),

  // Nullable no banco
  resolved_at: z.string().nullable(),
  snoozed_until: z.string().nullable(),
  metric_name: z.string().nullable(),
  metric_value: z.number().nullable(),
  threshold_value: z.number().nullable(),
  ig_post_id: z.string().uuid().nullable(),
  meta_creative_id: z.string().uuid().nullable(),
  meta_campaign_id: z.string().uuid().nullable(),
  google_campaign_id: z.string().uuid().nullable(),
  snapshot_id: z.string().uuid().nullable(),
  description: z.string().nullable(),
  suggested_action: z.string().nullable(),
  action_url: z.string().nullable(),
  resolved_by: z.string().nullable(),
  natureza: alertNaturezaEnum.nullable(),
  probable_cause: z.string().nullable(),
  confidence_level: confidenceLevelEnum.nullable(),
  data_source: dataSourceEnum,

  // JOIN com orbit.clients (SELECT '*, clients(name, handle)')
  // `undefined` pode ocorrer se a query não incluir o join — coberto como optional.
  clients: z.object({
    name: z.string().nullable(),
    handle: z.string().nullable(),
  }).nullable().optional(),
})

export const orbitAlertTableRowListSchema = z.array(orbitAlertTableRowSchema)

/** Tipo validado — é o que orbitAlert.mapper.ts recebe como entrada. */
export type ValidatedOrbitAlertTableRow = z.infer<typeof orbitAlertTableRowSchema>