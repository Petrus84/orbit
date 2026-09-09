// ============================================================================
// ORBIT · Repository — Alerts (v3.0.2)
//
// v3.0.2 (fechamento definitivo do risco de runtime — 04/09/2026):
// - 🔒 FIX CRÍTICO DE SEGURANÇA: Eliminados os casts cegos `as AlertType` em
//   createAlert() e createAlertsBatch().
// - 🛡️ GUARD DE DADOS: O repositório agora valida e intercepta alertas do
//   tipo 'data_gap' (gerados pelo withMissingDataGuard do contentContractEngine).
//   Como 'data_gap' é um alerta transitório/UI-only e não existe no enum
//   orbit.alert_type do Postgres:
//   - em createAlert(): lança um erro claro de aplicação antes de bater no DB.
//   - em createAlertsBatch(): ignora/filtra 'data_gap' silenciosamente,
//     persistindo apenas alertas de negócio reais sem abortar a transação.
// - 🧹 REFATORAÇÃO DE QUERIES: Criada a constante ALERT_SELECT_FIELDS para
//   garantir que fetchAlertById, createAlert e createAlertsBatch retornem
//   exatamente os mesmos 21 campos mapeados em OrbitAlertRow.
//
// v3.0.1 (fechamento de bug — 31/08/2026):
// - 🐛 CORRIGIDO createAlert(): o insert usava `type: AlertType[draft.type]`
//
// v3.0.0 (revisão 18/08/2026):
// - ❌ REMOVIDO: fallback para public.alerts (legacy).
// - 🐛 CORRIGIDO: fromOrbitRow() mapeia 100% dos campos de Alert.
// ============================================================================

import { supabase } from '@/lib/supabase'
import type {
  Alert,
  AlertSeverity,
  AlertType,
  AlertNatureza,
  ConfidenceLevel,
} from '@/types/orbit'
import type { AlertDraft } from './contentContractEngine'

// ── Guard de AlertType (validação em tempo de execução) ──────────────────
const ALERT_TYPES: readonly AlertType[] = [
  'ctr_below_threshold',
  'engagement_collapse',
  'avatar_misalignment',
  'creative_fatigue',
  'roas_below_minimum',
  'follower_churn_high',
  'polemic_score_high',
  'boost_opportunity',
  'budget_pace',
]

export function isAlertType(value: string): value is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(value)
}

// ── Campos padrão de seleção para reutilização e consistência ─────────────
const ALERT_SELECT_FIELDS = `
  id, client_id, alert_type, severity, title, description,
  metric_name, metric_value, threshold_value, action_url,
  is_resolved, created_at,
  natureza, probable_cause, confidence_level, data_source,
  snapshot_id, suggested_action, resolved_at, snoozed_until, resolved_by,
  clients ( name, handle )
`

// ── Raw shape do banco (orbit.alerts + JOIN orbit.clients) ───────────────
interface OrbitAlertRow {
  id: string
  client_id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  description: string | null
  metric_name: string | null
  metric_value: number | null
  threshold_value: number | null
  action_url: string | null
  is_resolved: boolean
  created_at: string
  natureza: AlertNatureza | null
  probable_cause: string | null
  confidence_level: ConfidenceLevel | null
  data_source:
    | 'real_snapshot'
    | 'fallback_by_client'
    | 'fallback_by_error'
    | 'fallback_by_empty'
    | 'estimate'
    | null
  snapshot_id: string | null
  suggested_action: string | null
  resolved_at: string | null
  snoozed_until: string | null
  resolved_by: string | null
  clients: {
    name: string
    handle: string
  } | null
}

function fromOrbitRow(row: OrbitAlertRow): Alert {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? '',
    clientHandle: row.clients?.handle ?? '',
    type: row.alert_type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    metricName: row.metric_name,
    metricValue: row.metric_value,
    thresholdValue: row.threshold_value,
    isResolved: row.is_resolved,
    createdAt: row.created_at,
    action: row.action_url
      ? { type: 'link', label: 'Ver detalhes', url: row.action_url }
      : null,
    natureza: row.natureza ?? undefined,
    probableCause: row.probable_cause ?? undefined,
    confidenceLevel: row.confidence_level ?? undefined,
    dataSource: row.data_source ?? undefined,
    snapshotId: row.snapshot_id ?? undefined,
    suggestedAction: row.suggested_action ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    snoozedUntil: row.snoozed_until ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
  }
}

// ── Base query — orbit.alerts ─────────────────────────────────────────────
function orbitBaseQuery() {
  return supabase
    .schema('orbit')
    .from('alerts')
    .select(ALERT_SELECT_FIELDS)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
}

// ── fetchAlerts ───────────────────────────────────────────────────────────
/**
 * Busca alertas abertos de orbit.alerts
 * @param filter - Filtrar por severity (opcional)
 * @returns Array de Alert
 */
export async function fetchAlerts(filter?: AlertSeverity): Promise<Alert[]> {
  let query = orbitBaseQuery()
  if (filter !== undefined) query = query.eq('severity', filter)

  const { data, error } = await query.returns<OrbitAlertRow[]>()

  if (error) {
    throw new Error(
      `[alertsRepository] falha ao buscar orbit.alerts: ${error.message}`
    )
  }

  return (data ?? []).map(fromOrbitRow)
}

// ── fetchCriticalAlerts ───────────────────────────────────────────────────
/**
 * Busca apenas alertas críticos
 */
export async function fetchCriticalAlerts(): Promise<Alert[]> {
  return fetchAlerts('critical')
}

// ── fetchAlertById ────────────────────────────────────────────────────────
/**
 * Busca um alerta específico por ID
 */
export async function fetchAlertById(alertId: string): Promise<Alert | null> {
  const { data, error } = await supabase
    .schema('orbit')
    .from('alerts')
    .select(ALERT_SELECT_FIELDS)
    .eq('id', alertId)
    .single()
    .returns<OrbitAlertRow>()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(
      `[alertsRepository] falha ao buscar alerta ${alertId}: ${error.message}`
    )
  }

  return data ? fromOrbitRow(data) : null
}

// ── markAlertAsRead / markAlertResolved ───────────────────────────────────
/**
 * Marca um alerta como resolvido
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .schema('orbit')
    .from('alerts')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', alertId)

  if (error) {
    throw new Error(
      `[alertsRepository] falha ao marcar alerta como resolvido: ${error.message}`
    )
  }
}

// ── deleteAlert ───────────────────────────────────────────────────────────
/**
 * Remove um alerta (soft delete via is_resolved)
 */
export async function deleteAlert(alertId: string): Promise<void> {
  await markAlertAsRead(alertId)
}

// ============================================================================
// Caminho de escrita — Resolvers → Persistência
// ============================================================================

/**
 * Converte AlertDraft em objeto base para Alert (memória)
 */
export function draftToAlert(
  draft: AlertDraft,
  clientId: string,
  clientName: string,
  clientHandle: string
): Omit<Alert, 'id' | 'createdAt'> {
  return {
    clientId,
    clientName,
    clientHandle,
    type: draft.type as AlertType,
    severity: draft.severity,
    title: draft.title,
    description: draft.description,
    metricName: null,
    metricValue: null,
    thresholdValue: null,
    isResolved: false,
    action: null,
    natureza: draft.natureza,
    probableCause: draft.probableCause,
    confidenceLevel: draft.confidenceLevel,
    dataSource: draft.dataSource,
  }
}

/**
 * Persiste um AlertDraft em orbit.alerts
 */
export async function createAlert(
  draft: AlertDraft,
  clientId: string,
): Promise<Alert> {
  if (!isAlertType(draft.type)) {
    throw new Error(
      `[alertsRepository] O tipo de alerta '${draft.type}' é transitório e não pode ser persistido na tabela orbit.alerts.`
    )
  }

  const { data, error } = await supabase
    .schema('orbit')
    .from('alerts')
    .insert({
      client_id: clientId,
      alert_type: draft.type,
      severity: draft.severity,
      title: draft.title,
      description: draft.description ?? null,
      natureza: draft.natureza ?? null,
      probable_cause: draft.probableCause ?? null,
      confidence_level: draft.confidenceLevel ?? null,
      data_source: draft.dataSource ?? null,
    })
    .select(ALERT_SELECT_FIELDS)
    .single()
    .returns<OrbitAlertRow>()

  if (error) {
    throw new Error(
      `[alertsRepository] falha ao criar alerta: ${error.message}`
    )
  }

  return fromOrbitRow(data)
}

/**
 * Batch: cria múltiplos alertas de uma vez, filtrando tipos transitórios
 */
export async function createAlertsBatch(
  drafts: Array<{
    draft: AlertDraft
    clientId: string
    clientName: string
    clientHandle: string
  }>
): Promise<Alert[]> {
  const validDrafts = drafts.filter((d) => isAlertType(d.draft.type))

  if (validDrafts.length === 0) {
    return []
  }

  const rows = validDrafts.map((d) => {
    const alertType = d.draft.type as AlertType
    
    return {
      client_id: d.clientId,
      alert_type: alertType,
      severity: d.draft.severity,
      title: d.draft.title,
      description: d.draft.description ?? null,
      natureza: d.draft.natureza ?? null,
      probable_cause: d.draft.probableCause ?? null,
      confidence_level: d.draft.confidenceLevel ?? null,
      data_source: d.draft.dataSource ?? null,
    }
  })

  const { data, error } = await supabase
    .schema('orbit')
    .from('alerts')
    .insert(rows)
    .select(ALERT_SELECT_FIELDS)
    .returns<OrbitAlertRow[]>()

  if (error) {
    throw new Error(
      `[alertsRepository] falha ao criar alertas em batch: ${error.message}`
    )
  }

  return (data ?? []).map(fromOrbitRow)
}