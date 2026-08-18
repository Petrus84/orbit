// ============================================================================
// src/hooks/useOnboarding.ts
// Versão: 1.0.0
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchClientOnboarding, upsertClientOnboarding } from '@/lib/repositories/onboardingRepository'
import type { ClientOnboarding, FetchStatus } from '@/types/orbit'

export interface UseOnboardingReturn {
  data: ClientOnboarding | null
  status: FetchStatus
  error: string | null
  save: (data: ClientOnboarding) => Promise<boolean>
  refetch: () => void
}

export function useOnboarding(clientId: string): UseOnboardingReturn {
  const [data, setData] = useState<ClientOnboarding | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const fetchIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!clientId) return

    fetchIdRef.current += 1
    const thisFetchId = fetchIdRef.current

    if (isMountedRef.current) {
      setStatus('loading')
      setError(null)
    }

    try {
      const result = await fetchClientOnboarding(clientId)

      if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return

      if (result) {
        setData(result)
        setStatus('success')
      } else {
        setData(null)
        setStatus('success')
      }
    } catch (err) {
      if (isMountedRef.current && thisFetchId === fetchIdRef.current) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      }
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

  const save = useCallback(
    async (onboarding: ClientOnboarding): Promise<boolean> => {
      const success = await upsertClientOnboarding(onboarding)
      if (success && isMountedRef.current) {
        setData(onboarding)
      }
      return success
    },
    []
  )

  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { data, status, error, save, refetch }
}
