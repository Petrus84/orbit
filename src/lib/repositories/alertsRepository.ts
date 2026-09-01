// ============================================================================
// ORBIT · Repository — Alerts (v3.0.1)
//
// v3.0.1 (fechamento de bug — 31/08/2026):
// - 🐛 CORRIGIDO createAlert(): o insert usava `type: AlertType[draft.type]`
//   — dois bugs numa linha só. (1) a coluna real é `alert_type`, não `type`
//   (TS2353). (2) `AlertType` é um type do TypeScript (union de string),
//   sem existência em runtime — indexar nele como `AlertType[x]` é inválido
//   (TS2693), provavelmente resquício de confundir um union type escrito à
//   mão com um enum gerado do Postgres. `draft.type`/`alert.type` já é a
//   string correta; não precisa (e não pode) passar por `AlertType[...]`.
// - ⚠️ RISCO ABERTO, não resolvido por este patch: `Alert.type`/
//   `AlertDraft.type` são tipados como `string` solto em orbit.ts, não como
//   `AlertType`. Apliquei `as AlertType` em createAlert() e
//   createAlertsBatch() só pra destravar o build — mas
//   contentContractEngine.ts usa `type: 'data_gap'`
//   (withMissingDataGuard, 4 call sites) e 'data_gap' NÃO está no union
//   `AlertType` (9 valores). Se um draft com esse type chegar aqui, o cast
//   mente pro compilador e o INSERT pode ser rejeitado em runtime pelo
//   Postgres (se orbit.alert_type for ENUM de verdade). Decisão pendente:
//   'data_gap' vira o 10º valor real do enum, ou alertas desse tipo nunca
//   deveriam ser persistidos em orbit.alerts (ficam só como insight de
//   tela)? Não decidido aqui.
//
// v3.0.0 (revisão 18/08/2026):
// - ❌ REMOVIDO: fallback para public.alerts (legacy). orbit.alerts é a
//   única fonte agora — não há mais supabaseLegacy neste arquivo.
// - 🐛 CORRIGIDO: fromOrbitRow() só preenchia 7 dos 14 campos obrigatórios
//   de `Alert` (faltava type, metricName, metricValue, thresholdValue,
//   isResolved, createdAt, action). Mapeamento completo abaixo.
// - 🐛 CORRIGIDO: a versão anterior não tinha `return` depois de montar a
//   query legacy — função terminava sem devolver nada em caso de falha.
//   Como o legacy foi removido, isso deixou de existir; agora o erro
//   propaga (throw).
// - createdAt PERMANECE string, não Date. orbit.ts documenta isso
//   explicitamente — quem precisar de Date faz `new Date(alert.createdAt)`.
// - alert_type agora é `AlertType` (9 valores reais), não `string` solto.
// - 🆕 ADICIONADO: campos novos (natureza, probableCause, confidenceLevel,
//   dataSource) — mapeados de probable_cause, confidence_level, data_source
//   do banco. Pré-requisito: ALTER TABLE já rodou (ver migration).
// - 🆕 ADICIONADO: createAlert() e draftToAlert() — caminho de escrita para
//   resolvers do contentContractEngine.ts.
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

// ── Raw shape from orbit.alerts + orbit.clients JOIN ─────────────────────
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
  // ✅ NOVO: campos do Content Contract
  natureza: AlertNatureza | null
  probable_cause: string | null
  confidence_level: ConfidenceLevel | null
  data_source: 'real_snapshot' | 'fallback_by_client' | 'fallback_by_error' | 'fallback_by_empty' | 'estimate' | null
  // ✅ JOIN
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
    // ✅ NOVO: mapeamento dos campos do Content Contract
    natureza: row.natureza ?? undefined,
    probableCause: row.probable_cause ?? undefined,
    confidenceLevel: row.confidence_level ?? undefined,
    dataSource: row.data_source ?? undefined,
  }
}

// ── Base query — orbit.alerts ─────────────────────────────────────────────
function orbitBaseQuery() {
  return supabase
    .from('alerts')
    .select(
      `
      id, client_id, alert_type, severity, title, description,
      metric_name, metric_value, threshold_value, action_url,
      is_resolved, created_at,
      natureza, probable_cause, confidence_level, data_source,
      clients ( name, handle )
    `
    )
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
    .from('alerts')
    .select(
      `
      id, client_id, alert_type, severity, title, description,
      metric_name, metric_value, threshold_value, action_url,
      is_resolved, created_at,
      natureza, probable_cause, confidence_level, data_source,
      clients ( name, handle )
    `
    )
    .eq('id', alertId)
    .single()
    .returns<OrbitAlertRow>()

  if (error) {
    if (error.code === 'PGRST116') return null // não encontrado
    throw new Error(
      `[alertsRepository] falha ao buscar alerta ${alertId}: ${error.message}`
    )
  }

  return data ? fromOrbitRow(data) : null
}

// ── markAlertAsRead / markAlertResolved ───────────────────────────────────
/**
 * Marca um alerta como resolvido
 * ⚠️ orbit.alerts usa is_resolved (boolean) + resolved_at (timestamp)
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
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
// NOVO: Caminho de escrita — Resolvers → Persistência
// ============================================================================

/**
 * Converte AlertDraft (saída dos resolvers) em Alert (pronto pra persistir)
 * Preenche campos obrigatórios que os resolvers não conhecem
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
    type: draft.type,
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
 *
 * Fluxo típico:
 *   const draft = resolveCtrBioAlert(input)
 *   await createAlert(draft, clientId, clientName, clientHandle)
 *
 * ⚠️ Pré-requisito: ALTER TABLE orbit.alerts já rodou (migration)
 * ⚠️ RISCO ABERTO (ver changelog v3.0.1 no topo do arquivo): `alert.type`
 * vem de `Alert.type: string` solto, não de `AlertType`. O cast abaixo
 * destrava o build mas não protege contra draft.type === 'data_gap'
 * (produzido por withMissingDataGuard em contentContractEngine.ts), que
 * não existe no union AlertType nem, possivelmente, no enum real do
 * Postgres — se chegar aqui, o INSERT pode falhar em runtime. Decisão
 * pendente com o DG: adicionar 'data_gap' ao enum real, ou nunca chamar
 * createAlert()/createAlertsBatch() com um draft desse tipo.
 */
export async function createAlert(
  draft: AlertDraft,
  clientId: string,
  clientName: string,
  clientHandle: string
): Promise<Alert> {
  const alert = draftToAlert(draft, clientId, clientName, clientHandle)

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      client_id: clientId,
      alert_type: alert.type as AlertType,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      natureza: alert.natureza,
      probable_cause: alert.probableCause,
      confidence_level: alert.confidenceLevel,
      data_source: alert.dataSource,
    })
    .select(
      `
      id, client_id, alert_type, severity, title, description,
      metric_name, metric_value, threshold_value, action_url,
      is_resolved, created_at,
      natureza, probable_cause, confidence_level, data_source,
      clients ( name, handle )
    `
    )
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
 * Batch: cria múltiplos alertas de uma vez
 * ⚠️ Mesmo risco aberto do createAlert() acima (draft.type === 'data_gap').
 */
export async function createAlertsBatch(
  drafts: Array<{
    draft: AlertDraft
    clientId: string
    clientName: string
    clientHandle: string
  }>
): Promise<Alert[]> {
  const rows = drafts.map((d) => ({
    client_id: d.clientId,
    alert_type: d.draft.type as AlertType,
    severity: d.draft.severity,
    title: d.draft.title,
    description: d.draft.description,
    natureza: d.draft.natureza,
    probable_cause: d.draft.probableCause,
    confidence_level: d.draft.confidenceLevel,
    data_source: d.draft.dataSource,
  }))

  const { data, error } = await supabase
    .from('alerts')
    .insert(rows)
    .select(
      `
      id, client_id, alert_type, severity, title, description,
      metric_name, metric_value, threshold_value, action_url,
      is_resolved, created_at,
      natureza, probable_cause, confidence_level, data_source,
      clients ( name, handle )
    `
    )
    .returns<OrbitAlertRow[]>()

  if (error) {
    throw new Error(
      `[alertsRepository] falha ao criar alertas em batch: ${error.message}`
    )
  }

  return (data ?? []).map(fromOrbitRow)
}