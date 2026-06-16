// src/hooks/useInstagramOverview.ts
// ORBIT · Hook — Instagram Visão Geral
// Versão: 1.0.1
//
// Features:
//   ✅ Retry com backoff exponencial (máx 3 tentativas)
//   ✅ Polling opcional (pollingIntervalMs)
//   ✅ Realtime Supabase opcional (enableRealtime)
//   ✅ isMountedRef — safe em React 18 StrictMode
//   ✅ refetch() manual
//   ✅ lastUpdated: Date | null
//   ✅ Strict TypeScript (sem any)
//
// v1.0.1 — buildPrototypeData() atualizado para o shape unificado de tipos:
//   statusVariant: 'ok' | 'warn' | 'neutral'  (era 'success' | 'warning' | 'danger')
//   criticalAlerts: CriticalAlertData[]        (era string[])

import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import {fetchInstagramOverview} from "../lib/repositories/instagramRepository";
import {
  AsyncState,
  FetchStatus,
  IGOverviewData,
} from "../types/instagram";

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const MAX_RETRIES       = 3;
const BACKOFF_BASE_MS   = 800;   // 800 ms → 1.6 s → 3.2 s

// ─────────────────────────────────────────────
// Tipos do hook
// ─────────────────────────────────────────────

export interface UseInstagramOverviewParams {
  clientId:            string
  periodStart:         Date
  periodEnd:           Date
  /** Se true, usa dados de protótipo em vez de chamar o Supabase */
  usePrototypeData?:   boolean
  /** Intervalo em ms para polling automático. null = sem polling. */
  pollingIntervalMs?:  number | null
  /** Se true, abre canal Realtime no Supabase para kpi_snapshots */
  enableRealtime?:     boolean
}

export interface UseInstagramOverviewReturn extends AsyncState<IGOverviewData | null> {
  /** Recarrega os dados manualmente (reseta o contador de retries) */
  refetch:      () => void
  /** Timestamp do último fetch bem-sucedido */
  lastUpdated:  Date | null
}

// ─────────────────────────────────────────────
// Dados de protótipo (evita chamada real ao Supabase)
// ─────────────────────────────────────────────

function buildPrototypeData(clientId: string): IGOverviewData {
  const now   = new Date();
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  return {
    meta: {
      clientHandle: "@prototype",
      periodLabel:  "Últimos 90 dias",
      dateRange:    { start, end: now },
    },
    kpis: [
      {
        id:         `${clientId}-reach`,
        label:      "Alcance 90d",
        value:      48_320,
        unit:       "",
        delta:      12.4,
        deltaLabel: "vs período anterior",
        semaphore:  "verde",
        glowColor:  "cyan",
        subtitle:   "Contas únicas alcançadas",
      },
      {
        id:         `${clientId}-link-clicks`,
        label:      "Cliques no Link",
        value:      1_240,
        unit:       "",
        delta:      -8.2,
        deltaLabel: "vs período anterior",
        semaphore:  "ambar",
        glowColor:  "gold",
        subtitle:   "Cliques na bio + stories",
      },
      {
        id:         `${clientId}-followers`,
        label:      "Seguidores Totais",
        value:      12_870,
        unit:       "",
        delta:      3.1,
        deltaLabel: "crescimento",
        semaphore:  "verde",
        glowColor:  "cyan",
        subtitle:   "Base acumulada",
      },
      {
        id:         `${clientId}-balance`,
        label:      "Saldo 90 Dias",
        value:      -320,
        unit:       "",
        delta:      -14.6,
        deltaLabel: "ganhos - perdas",
        semaphore:  "vermelho",
        glowColor:  "red",
        subtitle:   "Novos − cancelamentos",
      },
    ],
    qualityScores: [
      {
        id:            `${clientId}-utility`,
        label:         "Utilidade",
        value:         7.8,
        unit:          "/10",
        statusText:    "Bom",
        statusVariant: "ok",
        glowColor:     "cyan",
      },
      {
        id:            `${clientId}-relevance`,
        label:         "Relevância",
        value:         6.2,
        unit:          "/10",
        statusText:    "Atenção",
        statusVariant: "warn",
        glowColor:     "gold",
      },
      {
        id:            `${clientId}-authenticity`,
        label:         "Autenticidade",
        value:         8.5,
        unit:          "/10",
        statusText:    "Excelente",
        statusVariant: "ok",
        glowColor:     "cyan",
      },
      {
        id:            `${clientId}-coherence`,
        label:         "Coerência",
        value:         5.1,
        unit:          "/10",
        statusText:    "Crítico",
        statusVariant: "warn",
        glowColor:     "red",
      },
    ],
    formatPerformance: [
      { id: "fp-1", format: "Reels",      posts: 24, shares: 312, trendLabel: "+18%", trendColor: "cyan" },
      { id: "fp-2", format: "Carrosséis", posts: 18, shares: 198, trendLabel: "+6%",  trendColor: "gold" },
      { id: "fp-3", format: "Stories",    posts: 60, shares:  44, trendLabel: "-3%",  trendColor: "red"  },
      { id: "fp-4", format: "Estáticas",  posts: 12, shares:  88, trendLabel: "+2%",  trendColor: "cyan" },
    ],
    insights: [
      { id: "i-1", text: "Saldo 90 Dias está em nível crítico (−14.6% vs período anterior)." },
      { id: "i-2", text: "Cliques no Link requer atenção — variação de −8.2%." },
    ],
    criticalAlerts: [
      {
        id:       "alert-balance",
        title:    "Saldo 90 Dias",
        body:     "−14.6% vs período anterior — intervenção necessária.",
        severity: "critical",
      },
    ],
  };
}

// ─────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────

/** Aguarda `ms` milissegundos. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calcula delay exponencial com jitter simples. */
function backoffDelay(attempt: number): number {
  return BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * 200;
}

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

export function useInstagramOverview({
  clientId,
  periodStart,
  periodEnd,
  usePrototypeData   = false,
  pollingIntervalMs  = null,
  enableRealtime     = false,
}: UseInstagramOverviewParams): UseInstagramOverviewReturn {

  const [data,        setData]        = useState<IGOverviewData | null>(null);
  const [status,      setStatus]      = useState<FetchStatus>("idle");
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Guarda para evitar setState em componente desmontado (StrictMode safe)
  const isMountedRef    = useRef(true);
  // Permite cancelar polling ao desmontar
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Canal Realtime
  const realtimeRef     = useRef<RealtimeChannel | null>(null);
  // Trigger de refetch manual (incrementar força novo useEffect run)
  const [fetchTick, setFetchTick] = useState(0);

  // ── fetch com retry ────────────────────────────────────────────────────

  const fetchWithRetry = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;

    setStatus("loading");
    setError(null);

    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        let result: IGOverviewData;

        if (usePrototypeData) {
          // Simula latência de rede em modo protótipo
          await sleep(400);
          result = buildPrototypeData(clientId);
        } else {
          result = await fetchInstagramOverview(clientId, periodStart, periodEnd);
        }

        if (!isMountedRef.current) return;

        setData(result);
        setStatus("success");
        setLastUpdated(new Date());
        return; // sucesso — sair do loop

      } catch (err: unknown) {
        attempt++;

        if (attempt > MAX_RETRIES) {
          if (!isMountedRef.current) return;

          const message =
            err instanceof Error ? err.message : "Erro desconhecido ao buscar dados do Instagram.";

          console.error(
            `[useInstagramOverview] Falhou após ${MAX_RETRIES} tentativas:`,
            message
          );

          setStatus("error");
          setError(message);
          return;
        }

        const delay = backoffDelay(attempt - 1);
        console.warn(
          `[useInstagramOverview] Tentativa ${attempt}/${MAX_RETRIES} falhou. Retry em ${Math.round(delay)}ms.`
        );
        await sleep(delay);
      }
    }
  }, [clientId, periodStart, periodEnd, usePrototypeData]);

  // ── efeito principal — fetch + polling ────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;

       // Fetch imediato (Adiado para evitar cascading renders)
    setTimeout(() => {
      void fetchWithRetry();
    }, 0);

    // Polling
    if (pollingIntervalMs && pollingIntervalMs > 0) {
      const schedule = (): void => {
        pollingTimerRef.current = setTimeout(async () => {
          if (!isMountedRef.current) return;
          await fetchWithRetry();
          if (isMountedRef.current) schedule(); // re-agenda
        }, pollingIntervalMs);
      };
      schedule();
    }


    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [fetchWithRetry, pollingIntervalMs, fetchTick]);

  // ── Realtime Supabase ─────────────────────────────────────────────────

  useEffect(() => {
    if (!enableRealtime || usePrototypeData) return;

    // Inscreve no canal de kpi_snapshots do cliente
    const channel = supabase
      .channel(`ig-overview:${clientId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "kpi_snapshots",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          console.log("[useInstagramOverview] Realtime update:", payload.eventType);
          if (isMountedRef.current) {
            void fetchWithRetry();
          }
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "CHANNEL_ERROR") {
          console.error("[useInstagramOverview] Realtime subscription error.");
        }
      });

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) {
        void supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
    };
  }, [clientId, enableRealtime, usePrototypeData, fetchWithRetry]);

  // ── refetch manual ────────────────────────────────────────────────────

  const refetch = useCallback((): void => {
    setFetchTick((t) => t + 1);
  }, []);

  // ─────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────

  return {
    data,
    status,
    error,
    refetch,
    lastUpdated,
  };
}