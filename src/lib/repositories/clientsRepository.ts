// ============================================================================
// src/lib/repositories/clientsRepository.ts
// ============================================================================

import { supabase } from "../supabaseClient";
import { Client, ClientStatus } from "../../types/client";

// ── Raw shape returned by Supabase (snake_case) ───────────────────────────
interface RawClientRow {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  status: ClientStatus;
  client_metrics: {
    follower_balance: number;
    engagement_real: number;
    ctr_link: number;
  } | null;
}

// ── Status sort order (critical first) ───────────────────────────────────
const STATUS_ORDER: Record<ClientStatus, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
};

// ── Transform helper ──────────────────────────────────────────────────────
function toClient(row: RawClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    status: row.status,
    metrics: {
      follower_balance: row.client_metrics?.follower_balance ?? 0,
      engagement_real: row.client_metrics?.engagement_real ?? 0,
      ctr_link: row.client_metrics?.ctr_link ?? 0,
    },
  };
}

// ── fetchClientsWithHealth ────────────────────────────────────────────────
export async function fetchClientsWithHealth(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      `
      id,
      name,
      handle,
      avatar_url,
      status,
      client_metrics (
        follower_balance,
        engagement_real,
        ctr_link
      )
    `
    )
    .returns<RawClientRow[]>();

  if (error) {
    console.error("[clientsRepository] fetchClientsWithHealth:", error.message);
    throw new Error(error.message);
  }

  const clients = (data ?? []).map(toClient);

  // Sort critical → warning → healthy client-side
  // (Supabase doesn't support ordering by a custom enum sequence directly)
  return clients.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );
}

// ── fetchClientById ───────────────────────────────────────────────────────
export async function fetchClientById(
  clientId: string
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      `
      id,
      name,
      handle,
      avatar_url,
      status,
      client_metrics (
        follower_balance,
        engagement_real,
        ctr_link
      )
    `
    )
    .eq("id", clientId)
    .returns<RawClientRow[]>()
    .maybeSingle();

  if (error) {
    console.error("[clientsRepository] fetchClientById:", error.message);
    throw new Error(error.message);
  }

  return data ? toClient(data as unknown as RawClientRow) : null;
}

// ── fetchCriticalClients ──────────────────────────────────────────────────
export async function fetchCriticalClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      `
      id,
      name,
      handle,
      avatar_url,
      status,
      client_metrics (
        follower_balance,
        engagement_real,
        ctr_link
      )
    `
    )
    .eq("status", "critical")
    .returns<RawClientRow[]>();

  if (error) {
    console.error("[clientsRepository] fetchCriticalClients:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map(toClient);
}
