// ============================================================================
// ORBIT · Repository — Clients (v3.3.0)
//
// v3.3.0 (tipagem de status):
// - 🐛 CORRIGIDO: o repositório fabricava "unknown", que não pertence a
//   ClientHealthStatus (healthy/warning/critical/info). Conforme o contrato
//   do orbit.ts, "sem dado" é `null`: Client.status é `ClientHealthStatus | null`.
// - STATUS_ORDER cobre 'info' e a ordenação trata null explicitamente
//   (sem dado vai por último), em vez de indexar o Record com null.
//
// v3.2.0: driver orbit.v_carteira_clients (is_benchmark = false), snapshots
// nativos, cruzamento com v_client_metrics e v_client_health.
// ============================================================================

import { supabase } from "@/lib/supabase";
import type { Client, ClientHealthStatus } from "@/types/client";

// ── Raw shape from orbit.v_carteira_clients ───────────────────────────────
interface CarteiraClientRow {
  id: string;
  name: string;
  handle: string;
  snapshot_count: number;
  last_snapshot_date: string | null;
}

// ── Raw shape from orbit.v_client_metrics ─────────────────────────────────
interface ClientMetricsRow {
  id: string;
  name: string;
  handle: string;
  follower_balance: number | null;
  engagement_real: number | null;
  ctr_link: number | null;
  polemic_score_pct: number | null;
  follower_churn_pct: number | null;
}

// ── Raw shape from orbit.v_client_health ──────────────────────────────────
// A view só produz 3 valores (ou null); todos são membros de ClientHealthStatus.
interface ClientHealthRow {
  client_id: string;
  health_status: ClientHealthStatus | null;
}

const STATUS_ORDER: Record<ClientHealthStatus, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  healthy: 3,
};

// Sem dado (null) vai depois de todos os status conhecidos.
const NO_DATA_ORDER = Object.keys(STATUS_ORDER).length;

function statusRank(status: ClientHealthStatus | null): number {
  return status === null ? NO_DATA_ORDER : STATUS_ORDER[status];
}

function toClient(
  carteiraRow: CarteiraClientRow,
  metrics: ClientMetricsRow | undefined,
  healthStatus: ClientHealthStatus | null,
): Client {
  return {
    id: carteiraRow.id,
    handle: carteiraRow.handle,
    name: carteiraRow.name,
    avatar: undefined,
    status: healthStatus,
    snapshotCount: carteiraRow.snapshot_count ?? 0,
    lastSnapshotDate: carteiraRow.last_snapshot_date ?? null,
    metrics: {
      follower_balance: metrics?.follower_balance ?? 0,
      // null = sem medição (régua única, 17/10/2026): nunca vira 0.
      engagement_real: metrics?.engagement_real ?? null,
      ctr_link: metrics?.ctr_link ?? null,
      polemic_score_pct: metrics?.polemic_score_pct ?? null,
      follower_churn_pct: metrics?.follower_churn_pct ?? 0,
      segment: {
        gender_dominant: "mixed",
        gender_pct: 0,
        age_range: "",
        top_city: "",
        top_city_pct: 0,
      },
    },
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchHealthMap(): Promise<
  Map<string, ClientHealthStatus | null>
> {
  const { data, error } = await supabase
    .schema("orbit")
    .from("v_client_health")
    .select("client_id, health_status")
    .returns<ClientHealthRow[]>();

  if (error) {
    throw new Error(
      `[clientsRepository] falha ao buscar orbit.v_client_health: ${error.message}`,
    );
  }

  const map = new Map<string, ClientHealthStatus | null>();
  for (const row of data ?? []) {
    map.set(row.client_id, row.health_status);
  }
  return map;
}

// ── fetchClientsWithHealth ────────────────────────────────────────────────
export async function fetchClientsWithHealth(): Promise<Client[]> {
  const [
    { data: carteiraData, error: carteiraError },
    { data: metricsData, error: metricsError },
    healthMap,
  ] = await Promise.all([
    supabase
      .schema("orbit")
      .from("v_carteira_clients" as never)
      .select("id, name, handle, snapshot_count, last_snapshot_date")
      .returns<CarteiraClientRow[]>(),
    supabase
      .schema("orbit")
      .from("v_client_metrics")
      .select(
        "id, name, handle, follower_balance, engagement_real, ctr_link, polemic_score_pct, follower_churn_pct",
      )
      .returns<ClientMetricsRow[]>(),
    fetchHealthMap(),
  ]);

  if (carteiraError) {
    throw new Error(
      `[clientsRepository] falha ao buscar orbit.v_carteira_clients: ${carteiraError.message}`,
    );
  }

  if (metricsError) {
    throw new Error(
      `[clientsRepository] falha ao buscar orbit.v_client_metrics: ${metricsError.message}`,
    );
  }

  const metricsMap = new Map<string, ClientMetricsRow>();
  for (const row of metricsData ?? []) {
    metricsMap.set(row.id, row);
  }

  return (carteiraData ?? [])
    .map((row) =>
      toClient(row, metricsMap.get(row.id), healthMap.get(row.id) ?? null),
    )
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));
}

// ── fetchClientById ───────────────────────────────────────────────────────
export async function fetchClientById(
  clientId: string,
): Promise<Client | null> {
  const [
    { data: carteiraData, error: carteiraError },
    { data: metricsData, error: metricsError },
    healthMap,
  ] = await Promise.all([
    supabase
      .schema("orbit")
      .from("v_carteira_clients")
      .select("id, name, handle, snapshot_count, last_snapshot_date")
      .eq("id", clientId)
      .returns<CarteiraClientRow[]>()
      .maybeSingle(),
    supabase
      .schema("orbit")
      .from("v_client_metrics")
      .select(
        "id, name, handle, follower_balance, engagement_real, ctr_link, polemic_score_pct, follower_churn_pct",
      )
      .eq("id", clientId)
      .returns<ClientMetricsRow[]>()
      .maybeSingle(),
    fetchHealthMap(),
  ]);

  if (carteiraError) {
    throw new Error(
      `[clientsRepository] falha ao buscar carteira para o cliente ${clientId}: ${carteiraError.message}`,
    );
  }
  if (metricsError) {
    throw new Error(
      `[clientsRepository] falha ao buscar métricas para o cliente ${clientId}: ${metricsError.message}`,
    );
  }
  if (!carteiraData) return null;

  return toClient(
    carteiraData,
    metricsData ?? undefined,
    healthMap.get(clientId) ?? null,
  );
}

// ── fetchCriticalClients ──────────────────────────────────────────────────
export async function fetchCriticalClients(): Promise<Client[]> {
  const all = await fetchClientsWithHealth();
  return all.filter((c) => c.status === "critical");
}
