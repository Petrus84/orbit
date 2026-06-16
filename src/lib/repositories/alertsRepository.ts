// ============================================================================
// src/lib/repositories/alertsRepository.ts
// ============================================================================

import { supabase } from "../supabaseClient";
import { Alert, AlertSeverity } from "../../types/alert";

// ── Raw shape returned by Supabase (snake_case) ───────────────────────────
interface RawAlertRow {
  id: string;
  client_id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  created_at: string;
  clients: {
    name: string;
    handle: string;
  } | null;
}

// ── Transform helper ──────────────────────────────────────────────────────
function toAlert(row: RawAlertRow): Alert {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "",
    clientHandle: row.clients?.handle ?? "",
    title: row.title,
    description: row.description,
    severity: row.severity,
    createdAt: new Date(row.created_at),
  };
}

// ── Base query builder ────────────────────────────────────────────────────
function baseQuery() {
  return supabase
    .from("alerts")
    .select(
      `
      id,
      client_id,
      title,
      description,
      severity,
      created_at,
      clients (
        name,
        handle
      )
    `
    )
    .order("created_at", { ascending: false });
}

// ── fetchAlerts ───────────────────────────────────────────────────────────
export async function fetchAlerts(filter?: AlertSeverity): Promise<Alert[]> {
  let query = baseQuery();

  if (filter !== undefined) {
    query = query.eq("severity", filter);
  }

  const { data, error } = await query.returns<RawAlertRow[]>();

  if (error) {
    console.error("[alertsRepository] fetchAlerts:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(toAlert);
}

// ── fetchCriticalAlerts ───────────────────────────────────────────────────
export async function fetchCriticalAlerts(): Promise<Alert[]> {
  return fetchAlerts("critical");
}

// ── markAlertAsRead ───────────────────────────────────────────────────────
export async function markAlertAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ read_at: new Date().toISOString() })
    .eq("id", alertId);

  if (error) {
    console.error("[alertsRepository] markAlertAsRead:", error.message);
    throw new Error(error.message);
  }
}
