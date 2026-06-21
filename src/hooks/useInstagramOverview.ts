// src/hooks/useInstagramOverview.ts
// ORBIT · Hook — Instagram Visão Geral
// Versão: 2.0.0
//
// v2.0.0:
//   ✅ usePrototypeData removido — sem mock, sem buildPrototypeData()
//   ✅ fetchInstagramOverview chamado com objeto FetchOverviewParams
//   ✅ periodStart/periodEnd: Date → string ISO antes de passar ao repositório
//   ✅ Realtime não depende mais de usePrototypeData
//   ✅ Retry, polling, refetch, lastUpdated mantidos intactos

import { useCallback, useEffect, useRef, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { fetchInstagramOverview } from '../lib/repositories/instagramOverviewRepository'
import type { AsyncState, FetchStatus, IGOverviewData } from '../types/instagram'

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const MAX_RETRIES     = 3
const BACKOFF_BASE_MS = 800   // 800ms → 1.6s → 3.2s

// ─────────────────────────────────────────────
// Tipos do hook
// ─────────────────────────────────────────────

export interface UseInstagramOverviewParams {
  clientId:           string
  periodStart:        Date
  periodEnd:          Date
  pollingIntervalMs?: number | null
  enableRealtime?:    boolean
}

export interface UseInstagramOverviewReturn extends AsyncState<IGOverviewData | null> {
  refetch:     () => void
  lastUpdated: Date | null
}

// ─────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffDelay(attempt: number): number {
  return BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.random() * 200
}

/** Converte Date para string 'YYYY-MM-DD' esperada pelo repositório */
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────

export function useInstagramOverview({
  clientId,
  periodStart,
  periodEnd,
  pollingIntervalMs = null,
  enableRealtime    = false,
}: UseInstagramOverviewParams): UseInstagramOverviewReturn {

  const [data,        setData]        = useState<IGOverviewData | null>(null)
  const [status,      setStatus]      = useState<FetchStatus>('idle')
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isMountedRef    = useRef(true)
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeRef     = useRef<RealtimeChannel | null>(null)
  const [fetchTick, setFetchTick] = useState(0)

  // ── fetch com retry ────────────────────────────────────────────────────────

  const fetchWithRetry = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return

    setStatus('loading')
    setError(null)

    let attempt = 0

    while (attempt <= MAX_RETRIES) {
      try {
        const result = await fetchInstagramOverview({
          clientId,
          periodStart: toISODate(periodStart),
          periodEnd:   toISODate(periodEnd),
        })

        if (!isMountedRef.current) return

              if (!isMountedRef.current) return
      
      // Código original restaurado: limpo de 'any' e em conformidade estrita com IGOverviewData
      setData(result)
      setStatus('success')
      setLastUpdated(new Date())
      return

        setStatus('success')
        setLastUpdated(new Date())
        return

      } catch (err: unknown) {
        attempt++

        if (attempt > MAX_RETRIES) {
          if (!isMountedRef.current) return

          const message = err instanceof Error
            ? err.message
            : 'Erro desconhecido ao buscar dados do Instagram.'

          console.error(
            `[useInstagramOverview] Falhou após ${MAX_RETRIES} tentativas:`,
            message
          )

          setStatus('error')
          setError(message)
          return
        }

        const delay = backoffDelay(attempt - 1)
        console.warn(
          `[useInstagramOverview] Tentativa ${attempt}/${MAX_RETRIES} falhou. Retry em ${Math.round(delay)}ms.`
        )
        await sleep(delay)
      }
    }
  }, [clientId, periodStart, periodEnd])

  // ── efeito principal — fetch + polling ────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true

    setTimeout(() => { void fetchWithRetry() }, 0)

    if (pollingIntervalMs && pollingIntervalMs > 0) {
      const schedule = (): void => {
        pollingTimerRef.current = setTimeout(async () => {
          if (!isMountedRef.current) return
          await fetchWithRetry()
          if (isMountedRef.current) schedule()
        }, pollingIntervalMs)
      }
      schedule()
    }

    return () => {
      isMountedRef.current = false
      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }
  }, [fetchWithRetry, pollingIntervalMs, fetchTick])

  // ── Realtime Supabase ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!enableRealtime) return

    const channel = supabase
      .channel(`ig-overview:${clientId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'kpi_snapshots',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          console.log('[useInstagramOverview] Realtime update:', payload.eventType)
          if (isMountedRef.current) void fetchWithRetry()
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR') {
          console.error('[useInstagramOverview] Realtime subscription error.')
        }
      })

    realtimeRef.current = channel

    return () => {
      if (realtimeRef.current) {
        void supabase.removeChannel(realtimeRef.current)
        realtimeRef.current = null
      }
    }
  }, [clientId, enableRealtime, fetchWithRetry])

  // ── refetch manual ────────────────────────────────────────────────────────

  const refetch = useCallback((): void => {
    setFetchTick((t) => t + 1)
  }, [])

  return { data, status, error, refetch, lastUpdated }
}


