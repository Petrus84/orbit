// ============================================================================
// src/types/client.ts
// ============================================================================

export type ClientStatus = "critical" | "warning" | "healthy";

export type FetchStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  data: T;
  status: FetchStatus;
  error: string | null;
}

export interface ClientMetrics {
  follower_balance: number;
  engagement_real: number;
  ctr_link: number;
}

export interface Client {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  status: ClientStatus;
  metrics: ClientMetrics;
}
