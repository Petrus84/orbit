// ============================================================================
// ORBIT · Repository — Alerts (v2.0.0 · Sprint 2)
//
// v2.0.0:
// - Migrado para orbit.alerts (primary)
//   com fallback para public.alerts (legacy)
// - orbit.alerts tem: alert_type, severity, metric_name, metric_value,
//   threshold_value, action_url, is_resolved
// - public.alerts tem: title, description, severity, read_at (sem metric_*)
// - Campos clientName/clientHandle: JOIN via orbit.clients (sem client_metrics join)
// - markAlertAsRead: usa is_resolved + resolved_at (orbit) com fallback read_at (legacy)
// ============================================================================

import { supabase, supabaseLegacy } from '@/lib/supabase'
import { Alert, AlertSeverity } from '../../types/alert'

// ── Raw shape from orbit.alerts + orbit.clients JOIN ─────────────────────
interface OrbitAlertRow {
  id: string
  client_id: string
  alert_type: string
  severity: AlertSeverity
  title: string
  description: string | null
  metric_name: string | null
  metric_value: number | null
  threshold_value: number | null
  action_url: string | null
  is_resolved: boolean
  clients: {                             // FK join com orbit.clients
    name: string
    handle: string
  } | null
}


function fromOrbitRow(row: OrbitAlertRow): Alert {
  return {
    id:           row.id,
    clientId:     row.client_id,
    clientName:   row.clients?.name   ?? '',
    clientHandle: row.clients?.handle ?? '',
    title:        row.title,
    description:  row.description ?? '',
    severity:     row.severity,
  }
}


// ── Base query — orbit.alerts ─────────────────────────────────────────────
function orbitBaseQuery() {
  return supabase
    .from('alerts')                        // orbit.alerts
    .select(`
      id, client_id, alert_type, severity, title, description,
      metric_name, metric_value, threshold_value, action_url,
      is_resolved, created_at,
      clients ( name, handle )
    `)
    .eq('is_resolved', false)              // padrão: apenas alertas abertos
    .order('created_at', { ascending: false })
}

// ── Base query — public.alerts (legacy fallback) ──────────────────────────
function legacyBaseQuery() {
  return supabaseLegacy
    .from('alerts')
    .select(`
      id, client_id, title, description, severity, created_at,
      clients ( name, handle )
    `)
    .order('created_at', { ascending: false })
}

// ── fetchAlerts ───────────────────────────────────────────────────────────
export async function fetchAlerts(filter?: AlertSeverity): Promise<Alert[]> {
  let query = orbitBaseQuery()
  if (filter !== undefined) query = query.eq('severity', filter)

  const { data: orbitData, error: orbitError } = await query.returns<OrbitAlertRow[]>()

  if (!orbitError && orbitData) return orbitData.map(fromOrbitRow)

  console.warn(`[alertsRepository] orbit.alerts indisponível (${orbitError?.message}). Fallback legacy...`)

  let legacyQuery = legacyBaseQuery()
  if (filter !== undefined) legacyQuery = legacyQuery.eq('severity', filter)

}

// ── fetchCriticalAlerts ───────────────────────────────────────────────────
export async function fetchCriticalAlerts(): Promise<Alert[]> {
  return fetchAlerts('critical')
}

// ── markAlertAsRead / markAlertResolved ───────────────────────────────────
// orbit.alerts usa is_resolved (boolean) + resolved_at (timestamp)
// public.alerts usa read_at (timestamp)
export async function markAlertAsRead(alertId: string): Promise<void> {
  // Tenta orbit.alerts primeiro
  const { error: orbitError } = await supabase
    .from('alerts')
    .update({
      is_resolved:  true,
      resolved_at:  new Date().toISOString(),
    })
    .eq('id', alertId)

  if (!orbitError) return

  console.warn(`[alertsRepository] orbit.alerts update falhou. Fallback legacy read_at...`)

  // Fallback: public.alerts.read_at
  const { error: legacyError } = await supabaseLegacy
    .from('alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', alertId)

  if (legacyError) throw new Error(legacyError.message)
}