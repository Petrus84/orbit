// ✅ CORRETO: Copie esta estrutura
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFunnelMetrics } from '../lib/repositories/funnelRepository'
import type { FunnelMetrics, UseFunnelResult, FetchStatus } from '../types/funnel'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useFunnel(clientId: string): UseFunnelResult {
  const [data, setData] = useState<FunnelMetrics | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isMountedRef = useRef<boolean>(false)
  const fetchIdRef = useRef<number>(0)

  const load = useCallback(async (): Promise<void> => {
    if (!clientId) return

    fetchIdRef.current += 1
    const thisFetchId = fetchIdRef.current

    if (isMountedRef.current) {
      setStatus('loading')
      setError(null)
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1))
      }

      if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return

      try {
        const metrics = await fetchFunnelMetrics(clientId)

        if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return

        setData(metrics)
        setStatus('success')
        setError(null)
        setLastUpdated(new Date())
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(
          `[useFunnel] attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          lastError.message,
        )
      }
    }

    if (isMountedRef.current && thisFetchId === fetchIdRef.current) {
      setStatus('error')
      setError(lastError?.message ?? 'Erro desconhecido ao carregar métricas de funil.')
    }
  }, [clientId])

  useEffect(() => {
    isMountedRef.current = true

    setTimeout(() => {
      void load()
    }, 0)

    return () => {
      isMountedRef.current = false
    }
  }, [load])

  const refetch = useCallback((): void => {
    void load()
  }, [load])

  return {
    data,
    status,
    error,
    lastUpdated,
    refetch,
  }
}
