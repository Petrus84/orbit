"use client";

import { useCallback, useRef, useState } from "react";
import { syncClientAlerts } from "@/actions/syncClientAlerts";
import type { SyncClientAlertsResult } from "@/actions/syncClientAlerts";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500; // 500ms → 1000ms → 2000ms

/**
 * Hook para sincronizar alertas quando o período muda
 *
 * Gerencia o estado de sincronização, retry com backoff exponencial,
 * e evita race conditions (resposta antiga sobrescrevendo nova).
 *
 * @returns { isSyncing, syncAlerts }
 *
 * @example
 * ```tsx
 * const { isSyncing, syncAlerts } = useSyncClientAlerts();
 *
 * // Quando o período muda:
 * const result = await syncAlerts(clientId, startIso, endIso);
 * if (result.success) {
 *   console.log(`${result.alertsGenerated} alertas gerados`);
 * }
 * ```
 */
export function useSyncClientAlerts() {
  const [isSyncing, setIsSyncing] = useState(false);

  const isMountedRef = useRef(true);
  const syncTokenRef = useRef(0);

  const syncAlerts = useCallback(
    async (
      clientId: string,
      startIso: string,
      endIso: string,
    ): Promise<SyncClientAlertsResult> => {
      if (!isMountedRef.current) {
        return {
          success: false,
          alertsGenerated: 0,
          alertsUpdated: 0,
          alertsSkipped: 0,
          alertsAutoResolved: 0,
          error: "Componente desmontado",
        };
      }

      const token = ++syncTokenRef.current;
      setIsSyncing(true);

      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < MAX_RETRIES) {
        // Requisição mais nova já assumiu, abandone esta
        if (syncTokenRef.current !== token) {
          setIsSyncing(false);
          return {
            success: false,
            alertsGenerated: 0,
            alertsUpdated: 0,
            alertsSkipped: 0,
            alertsAutoResolved: 0,
            error: "Sincronização cancelada (requisição mais nova)",
          };
        }

        try {
          const result = await syncClientAlerts(clientId, startIso, endIso);

          // Validar se ainda é a requisição atual
          if (syncTokenRef.current !== token || !isMountedRef.current) {
            setIsSyncing(false);
            return result;
          }

          if (!result.success) {
            console.warn(
              `[useSyncClientAlerts] Falha ao sincronizar alertas: ${result.error}`,
            );
          } else {
            console.info(
              `[useSyncClientAlerts] Sincronização bem-sucedida: ${result.alertsGenerated} gerados, ${result.alertsUpdated} atualizados, ${result.alertsSkipped} pulados`,
            );
          }

          setIsSyncing(false);
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          attempt++;

          if (attempt < MAX_RETRIES) {
            const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
            await new Promise<void>((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // Nunca mascarar: erro vira mensagem explícita
      if (syncTokenRef.current !== token || !isMountedRef.current) {
        setIsSyncing(false);
        return {
          success: false,
          alertsGenerated: 0,
          alertsUpdated: 0,
          alertsSkipped: 0,
          alertsAutoResolved: 0,
          error: "Sincronização cancelada",
        };
      }

      setIsSyncing(false);
      return {
        success: false,
        alertsGenerated: 0,
        alertsUpdated: 0,
        alertsSkipped: 0,
        alertsAutoResolved: 0,
        error: lastError?.message ?? "Erro desconhecido ao sincronizar alertas",
      };
    },
    [],
  );

  return { isSyncing, syncAlerts };
}
