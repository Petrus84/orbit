// ============================================================================
// src/hooks/useClients.ts
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchClientsWithHealth,
  fetchCriticalClients,
} from "../lib/repositories/clientsRepository";
import { Client, FetchStatus } from "../types/client";

// ── Config ────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500; // doubles each attempt: 500 → 1000 → 2000

// ── Return type ───────────────────────────────────────────────────────────
export interface UseClientsReturn {
  data: Client[];
  status: FetchStatus;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useClients(
  filter: "all" | "critical" = "all"
): UseClientsReturn {
  const [data, setData] = useState<Client[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Prevents setState calls after unmount (React 18 StrictMode safe)
  const isMountedRef = useRef(true);

  // Incrementing token — each refetch() bumps it, cancelling previous runs
  const fetchTokenRef = useRef(0);

  // ── Fetch with exponential-backoff retry ────────────────────────────────
  const load = useCallback(async (token: number): Promise<void> => {
    if (!isMountedRef.current) return;

    setStatus("loading");
    setError(null);

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < MAX_RETRIES) {
      // Abort if a newer fetch was triggered
      if (fetchTokenRef.current !== token) return;

      try {
        const result =
          filter === "critical"
            ? await fetchCriticalClients()
            : await fetchClientsWithHealth();

        // Final stale-check before committing state
        if (fetchTokenRef.current !== token || !isMountedRef.current) return;

        setData(result);
        setStatus("success");
        setLastUpdated(new Date());
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempt++;

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 500ms, 1000ms, 2000ms
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    if (fetchTokenRef.current !== token || !isMountedRef.current) return;

    setStatus("error");
    setError(lastError?.message ?? "Erro desconhecido ao buscar clientes.");
  }, [filter]);

  // ── Public refetch ───────────────────────────────────────────────────────
  const refetch = useCallback((): void => {
    const token = ++fetchTokenRef.current;
    void load(token);
  }, [load]);

  // ── Mount / filter change ────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const token = ++fetchTokenRef.current;
    void load(token);

    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  return { data, status, error, lastUpdated, refetch };
}
