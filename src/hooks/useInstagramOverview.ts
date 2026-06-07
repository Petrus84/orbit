/* ==========================================================================
   ORBIT · Hook — useInstagramOverview
   Caminho definitivo: src/hooks/useInstagramOverview.ts
   Responsabilidade: Orquestrar fetch, estado, cache e realtime (Sem Erros ESLint).
   Aplica resolução estrita baseada no Blueprint Técnico e Relatório de PRD.
   Versão: 1.0.1 | Data: 2026-06-02
   ========================================================================== */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchInstagramOverview } from '../repositories/instagramOverviewRepository'
import type {
  InstagramOverviewData,
  AsyncState,
  FetchStatus
} from '../types/orbit'

// ─────────────────────────────────────────────
// Parâmetros do hook (Contratos de Entrada)
// ─────────────────────────────────────────────
export interface UseInstagramOverviewParams {
  clientId: string
  periodStart: string
  periodEnd: string
  /** true = usa dados hardcoded (Sprint 1); false = Supabase real */
  usePrototypeData?: boolean
  /** Intervalo de polling em ms. 0 = sem polling. Default: 0 */
  pollingIntervalMs?: number
  /** true = habilita subscription realtime Supabase */
  enableRealtime?: boolean
}

// ─────────────────────────────────────────────
// Retorno do hook (Contratos de Saída)
// ─────────────────────────────────────────────
export interface UseInstagramOverviewReturn extends AsyncState<InstagramOverviewData> {
  refetch: () => Promise<void>
  lastUpdated: Date | null
}

// ─────────────────────────────────────────────
// Hook Engine
// ─────────────────────────────────────────────
export function useInstagramOverview(
  params: UseInstagramOverviewParams
): UseInstagramOverviewReturn {
  const {
    clientId,
    periodStart,
    periodEnd,
    usePrototypeData = true,
    pollingIntervalMs = 0,
    enableRealtime = false
  } = params

  const [state, setState] = useState<AsyncState<InstagramOverviewData>>({
    data: null,
    status: 'idle',
    error: null
  })

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Tipagem explícita para evitar referências any implícitas do NodeJS.Timeout
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  // ─── Fetch principal (Transformação de Linhas Brutas) ───────────────────────
  const loadData = useCallback(async () => {
    if (!isMountedRef.current) return

    setState((prev) => ({ ...prev, status: 'loading' as FetchStatus, error: null }))

    try {
      // Chama diretamente a função exportada do repositório do programador
      const dataPayload = await fetchInstagramOverview({
        clientId,
        periodStart,
        periodEnd,
        usePrototypeData
      })

      if (!isMountedRef.current) return

      setState({ data: dataPayload, status: 'success' as FetchStatus, error: null })
      setLastUpdated(new Date())
    } catch (err: unknown) {
      if (!isMountedRef.current) return

      const message = err instanceof Error ? err.message : 'Erro desconhecido'

      setState((prev) => ({ ...prev, status: 'error' as FetchStatus, error: message }))
      console.error('[useInstagramOverview] Fetch falhou:', message)
    }
  }, [clientId, periodStart, periodEnd, usePrototypeData])


    // ─── Efeito Principal & Polling (Corrigido contra Cascading Renders) ───
  useEffect(() => {
    isMountedRef.current = true;

    // 💡 A SACADA: Executa o fetch inicial descolado do fluxo síncrono do efeito
    // Isso joga a execução para a Fila de Microtarefas, impedindo o loop de renders.
    Promise.resolve().then(() => {
      if (isMountedRef.current) {
        loadData();
      }
    });

    if (pollingIntervalMs > 0) {
      pollingRef.current = setInterval(loadData, pollingIntervalMs);
    }

    return () => {
      isMountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [loadData, pollingIntervalMs]);

  // ─── Realtime Supabase Channels (Regra SPRINT 2) ───────────
  useEffect(() => {
    if (!enableRealtime || usePrototypeData) return

    const channel = supabase
      .channel(`kpi_snapshots_${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kpi_snapshots',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          // Invalidação de cache assíncrona: Re-busca tudo sob demanda
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enableRealtime, usePrototypeData, clientId, loadData])

  return {
    data: state.data,
    status: state.status,
    error: state.error,
    refetch: loadData,
    lastUpdated
  }
}
