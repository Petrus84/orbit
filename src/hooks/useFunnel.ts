// src/hooks/useFunnel.ts
// Versão: 1.0.0 (ORIGINAL)

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFunnelData } from '../lib/repositories/funnelRepository'

import type { AsyncState, FetchStatus } from '../types/orbit'
import type { FunnelMetrics, UseFunnelResult } from '../types/funnel'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

function getRetryDelay(attemptIndex: number): number {
  return BASE_DELAY_MS * 2 ** attemptIndex
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useFunnel(
  clientId: string,
  periodStart: string,
  periodEnd: string
): UseFunnelResult {
  const [data, setData]     = useState<FunnelMetrics | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError]   = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isMountedRef = useRef(true)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current

    setStatus('loading')
    setError(null)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await fetchFunnelData(
          clientId,
          periodStart,
          periodEnd
        )

        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return
        }

        setData(result)
        setStatus('success')
        setError(null)
        setLastUpdated(new Date())
        return
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Erro desconhecido ao buscar dados do funil.'

        const isLastAttempt = attempt === MAX_RETRIES

        if (isLastAttempt) {
          if (!isMountedRef.current || requestId !== requestIdRef.current) {
            return
          }

          console.error(`[useFunnel] Falha após ${MAX_RETRIES} tentativas:`, message)
          setData(null)
          setStatus('error')
          setError(message)
          return
        }

        console.warn(
          `[useFunnel] Tentativa ${attempt}/${MAX_RETRIES} falhou, tentando novamente...`,
          message
        )

        await wait(getRetryDelay(attempt - 1))

        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return
        }
      }
    }
  }, [clientId, periodStart, periodEnd])

  useEffect(() => {
    isMountedRef.current = true

    setTimeout(() => {
      void load()
    }, 0)

    return () => {
      isMountedRef.current = false
    }
  }, [load])

  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { data, status, error, lastUpdated, refetch }
}
