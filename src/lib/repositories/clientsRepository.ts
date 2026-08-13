// ============================================================================
// ORBIT · Repository — Clients (v2.0.0 · Sprint 2)
//
// v2.0.0:
// - Migrado para orbit.v_client_health (primary)
//   com fallback para public.clients + public.client_metrics (legacy)
// - Campo handle usado diretamente (orbit.clients tem handle)
// - Campo instagram_account_id REMOVIDO (não existe em orbit.clients)
// - status derivado de orbit.v_client_health.health_status
// - follower_balance, engagement_real, ctr_link vindos da view calculada
// ============================================================================

import { supabase, supabaseLegacy } from '@/lib/supabase'
import { Client, ClientHealthStatus } from '../../types/client'

// ── Raw shape from orbit.v_client_health ─────────────────────────────────
interface OrbitClientHealthRow {
  id: string
  name: string
  handle: string
  health_status: ClientHealthStatus
  follower_balance: number | null
  engagement_real: number | null
  ctr_link: number | null
}

// ── Raw shape from public.* (legacy fallback) ─────────────────────────────
interface LegacyClientRow {
  id: string
  name: string
  handle: string
  avatar_url: string | null
  status: ClientHealthStatus
  client_metrics: {
    follower_balance: number
    engagement_real: number
    ctr_link: number
  } | null
}

const STATUS_ORDER: Record<ClientHealthStatus, number> = {
  critical: 0,
  warning:  1,
  healthy:  2,
}

function fromOrbitRow(row: OrbitClientHealthRow): Client {
  return {
    id:        row.id,
    name:      row.name,
    handle:    row.handle,
    avatarUrl: null,                         // orbit.clients não tem avatar_url ainda
    status:    row.health_status ?? 'healthy',
    metrics: {
      follower_balance: row.follower_balance ?? 0,
      engagement_real:  row.engagement_real  ?? 0,
      ctr_link:         row.ctr_link         ?? 0,
    },
  }
}

function fromLegacyRow(row: LegacyClientRow): Client {
  return {
    id:        row.id,
    name:      row.name,
    handle:    row.handle,
    avatarUrl: row.avatar_url,
    status:    row.status,
    metrics: {
      follower_balance: row.client_metrics?.follower_balance ?? 0,
      engagement_real:  row.client_metrics?.engagement_real  ?? 0,
      ctr_link:         row.client_metrics?.ctr_link         ?? 0,
    },
  }
}

// ── fetchClientsWithHealth ────────────────────────────────────────────────
export async function fetchClientsWithHealth(): Promise<Client[]> {
  // Primary: orbit.v_client_health
  const { data: orbitData, error: orbitError } = await supabase
    .from('v_client_health')               // orbit.v_client_health
    .select('id, name, handle, health_status, follower_balance, engagement_real, ctr_link')
    .returns<OrbitClientHealthRow[]>()

  if (!orbitError && orbitData) {
    return orbitData
      .map(fromOrbitRow)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  }

  console.warn('[clientsRepository] orbit.v_client_health indisponível. Fallback legacy...')

  // Fallback: public.clients + public.client_metrics
  const { data: legacyData, error: legacyError } = await supabaseLegacy
    .from('clients')
    .select(`
      id, name, handle, avatar_url, status,
      client_metrics ( follower_balance, engagement_real, ctr_link )
    `)
    .returns<LegacyClientRow[]>()

  if (legacyError) {
    console.error('[clientsRepository] fetchClientsWithHealth:', legacyError.message)
    throw new Error(legacyError.message)
  }

  return (legacyData ?? [])
    .map(fromLegacyRow)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
}

// ── fetchClientById ───────────────────────────────────────────────────────
export async function fetchClientById(clientId: string): Promise<Client | null> {
  const { data: orbitData, error: orbitError } = await supabase
    .from('v_client_health')
    .select('id, name, handle, health_status, follower_balance, engagement_real, ctr_link')
    .eq('id', clientId)
    .returns<OrbitClientHealthRow[]>()
    .maybeSingle()

  if (!orbitError && orbitData) {
    return fromOrbitRow(orbitData as unknown as OrbitClientHealthRow)
  }

  // Fallback
  const { data: legacyData, error: legacyError } = await supabaseLegacy
    .from('clients')
    .select(`
      id, name, handle, avatar_url, status,
      client_metrics ( follower_balance, engagement_real, ctr_link )
    `)
    .eq('id', clientId)
    .returns<LegacyClientRow[]>()
    .maybeSingle()

  if (legacyError) throw new Error(legacyError.message)
  return legacyData ? fromLegacyRow(legacyData as unknown as LegacyClientRow) : null
}

// ── fetchCriticalClients ──────────────────────────────────────────────────
export async function fetchCriticalClients(): Promise<Client[]> {
  const { data: orbitData, error: orbitError } = await supabase
    .from('v_client_health')
    .select('id, name, handle, health_status, follower_balance, engagement_real, ctr_link')
    .eq('health_status', 'critical')
    .returns<OrbitClientHealthRow[]>()

  if (!orbitError && orbitData) return orbitData.map(fromOrbitRow)

  // Fallback
  const { data, error } = await supabaseLegacy
    .from('clients')
    .select(`
      id, name, handle, avatar_url, status,
      client_metrics ( follower_balance, engagement_real, ctr_link )
    `)
    .eq('status', 'critical')
    .returns<LegacyClientRow[]>()

  if (error) throw new Error(error.message)
  return (data ?? []).map(fromLegacyRow)
}
