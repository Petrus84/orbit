// ============================================================================
// src/hooks/useAlerts.ts
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAlerts,
  fetchCriticalAlerts,
} from "../lib/repositories/alertsRepository";
import { Alert, AlertSeverity, FetchStatus } from "../types/alert";

// ── Config ────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500; // 500 → 1000 → 2000 ms

// ── Derived counts ────────────────────────────────────────────────────────
export interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

function countBySeverity(alerts: Alert[]): AlertCounts {
  return alerts.reduce(
    (acc, a) => {
      acc[a.severity]++;
      acc.total++;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, total: 0 } as AlertCounts
  );
}

// ── Return type ───────────────────────────────────────────────────────────
export interface UseAlertsReturn {
  data: Alert[];
  counts: AlertCounts;
  status: FetchStatus;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useAlerts(filter?: AlertSeverity): UseAlertsReturn {
  const [data, setData] = useState<Alert[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Prevents setState after unmount (React 18 StrictMode safe)
  const isMountedRef = useRef(true);

  // Incrementing token — cancels stale fetches when refetch() is called
  const fetchTokenRef = useRef(0);

  // ── Fetch with exponential-backoff retry ─────────────────────────────────
  const load = useCallback(
    async (token: number): Promise<void> => {
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
              ? await fetchCriticalAlerts()
              : await fetchAlerts(filter);

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
            const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // All retries exhausted
      if (fetchTokenRef.current !== token || !isMountedRef.current) return;

      setStatus("error");
      setError(lastError?.message ?? "Erro desconhecido ao buscar alertas.");
    },
    [filter]
  );

  // ── Public refetch ────────────────────────────────────────────────────────
  const refetch = useCallback((): void => {
    const token = ++fetchTokenRef.current;
    void load(token);
  }, [load]);

  // ── Mount / filter change ─────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const token = ++fetchTokenRef.current;
    void load(token);

    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  return {
    data,
    counts: countBySeverity(data),
    status,
    error,
    lastUpdated,
    refetch,
  };
}
