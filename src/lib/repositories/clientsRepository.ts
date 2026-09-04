// ============================================================================
// ORBIT · Repository — Clients (v3.2.0)
//
// v3.2.0 (filtro de benchmark e suporte a snapshots):
// - 🎯 Driver principal alterado para orbit.v_carteira_clients (is_benchmark = false).
//   Isso garante que apenas os clientes reais da carteira (ex: cpimportstore,
//   eupetruchio84) cheguem à UI, filtrando as 89 contas de benchmark.
// - 🔌 Injeção nativa de snapshot_count e last_snapshot_date trazidos diretamente
//   da view agregada do Postgres.
// - Mantido o cruzamento com v_client_metrics (métricas) e v_client_health (saúde).
// ============================================================================

import { supabase } from '@/lib/supabase'
import type { Client, ClientHealthStatus } from '@/types/client'

// ── Raw shape from orbit.v_carteira_clients ───────────────────────────────
interface CarteiraClientRow {
  id: string
  name: string
  handle: string
  snapshot_count: number
  last_snapshot_date: string | null
}

// ── Raw shape from orbit.v_client_metrics ─────────────────────────────────
interface ClientMetricsRow {
  id: string
  name: string
  handle: string
  follower_balance: number | null
  engagement_real: number | null
  ctr_link: number | null
  polemic_score_pct: number | null
  follower_churn_pct: number | null
}

// ── Raw shape from orbit.v_client_health ──────────────────────────────────
interface ClientHealthRow {
  client_id: string
  health_status: 'healthy' | 'warning' | 'critical' | null
}

const STATUS_ORDER: Record<ClientHealthStatus, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
  unknown: 3,
}

function normalizeHealthStatus(status: 'healthy' | 'warning' | 'critical' | null): ClientHealthStatus {
  return status ?? 'unknown'
}

function toClient(
  carteiraRow: CarteiraClientRow,
  metrics: ClientMetricsRow | undefined,
  healthStatus: ClientHealthStatus
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
      engagement_real: metrics?.engagement_real ?? 0,
      ctr_link: metrics?.ctr_link ?? 0,
      polemic_score_pct: metrics?.polemic_score_pct ?? 0,
      follower_churn_pct: metrics?.follower_churn_pct ?? 0,
      segment: {
        gender_dominant: 'mixed',
        gender_pct: 0,
        age_range: '',
        top_city: '',
        top_city_pct: 0,
      },
    },
    lastUpdated: new Date().toISOString(),
  }
}

async function fetchHealthMap(): Promise<Map<string, ClientHealthStatus>> {
  const { data, error } = await supabase
    .from('v_client_health')
    .select('client_id, health_status')
    .returns<ClientHealthRow[]>()

  if (error) {
    throw new Error(`[clientsRepository] falha ao buscar orbit.v_client_health: ${error.message}`)
  }

  const map = new Map<string, ClientHealthStatus>()
  for (const row of data ?? []) {
    map.set(row.client_id, normalizeHealthStatus(row.health_status))
  }
  return map
}

// ── fetchClientsWithHealth ────────────────────────────────────────────────
export async function fetchClientsWithHealth(): Promise<Client[]> {
  const [
    { data: carteiraData, error: carteiraError },
    { data: metricsData, error: metricsError },
    healthMap,
  ] = await Promise.all([
    supabase
      .from('v_carteira_clients' as any)
      .select('id, name, handle, snapshot_count, last_snapshot_date')
      .returns<CarteiraClientRow[]>(),
    supabase
      .from('v_client_metrics')
      .select('id, name, handle, follower_balance, engagement_real, ctr_link, polemic_score_pct, follower_churn_pct')
      .returns<ClientMetricsRow[]>(),
    fetchHealthMap(),
  ])

  if (carteiraError) {
    throw new Error(`[clientsRepository] falha ao buscar orbit.v_carteira_clients: ${carteiraError.message}`)
  }

  if (metricsError) {
    throw new Error(`[clientsRepository] falha ao buscar orbit.v_client_metrics: ${metricsError.message}`)
  }

  const metricsMap = new Map<string, ClientMetricsRow>()
  for (const row of metricsData ?? []) {
    metricsMap.set(row.id, row)
  }

  return (carteiraData ?? [])
    .map((row) =>
      toClient(
        row,
        metricsMap.get(row.id),
        healthMap.get(row.id) ?? 'unknown'
      )
    )
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
}

// ── fetchClientById ───────────────────────────────────────────────────────
export async function fetchClientById(clientId: string): Promise<Client | null> {
  const [
    { data: carteiraData, error: carteiraError },
    { data: metricsData, error: metricsError },
    healthMap,
  ] = await Promise.all([
    supabase
      .from('v_carteira_clients' as any)
      .select('id, name, handle, snapshot_count, last_snapshot_date')
      .eq('id', clientId)
      .returns<CarteiraClientRow[]>()
      .maybeSingle(),
    supabase
      .from('v_client_metrics')
      .select('id, name, handle, follower_balance, engagement_real, ctr_link, polemic_score_pct, follower_churn_pct')
      .eq('id', clientId)
      .returns<ClientMetricsRow[]>()
      .maybeSingle(),
    fetchHealthMap(),
  ])

  if (carteiraError) {
    throw new Error(`[clientsRepository] falha ao buscar carteira para o cliente ${clientId}: ${carteiraError.message}`)
  }
  if (metricsError) {
    throw new Error(`[clientsRepository] falha ao buscar métricas para o cliente ${clientId}: ${metricsError.message}`)
  }
  if (!carteiraData) return null

  return toClient(
    carteiraData,
    metricsData ?? undefined,
    healthMap.get(clientId) ?? 'unknown'
  )
}

// ── fetchCriticalClients ──────────────────────────────────────────────────
export async function fetchCriticalClients(): Promise<Client[]> {
  const all = await fetchClientsWithHealth()
  return all.filter((c) => c.status === 'critical')
}