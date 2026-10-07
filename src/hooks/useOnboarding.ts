// ============================================================================
// src/hooks/useOnboarding.ts
// Versão: 1.0.0
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchClientOnboarding, upsertClientOnboarding } from '@/lib/repositories/onboardingRepository'
import type { ClientOnboarding, ClientOnboardingWrite, FetchStatus } from '@/types/orbit'

type OnboardingStatus = FetchStatus | 'not_found'

export interface UseOnboardingReturn {
  data: ClientOnboarding | null
  status: OnboardingStatus
  error: string | null
  save: (data: ClientOnboardingWrite) => Promise<boolean>
  refetch: () => void
}

export function useOnboarding(clientId: string): UseOnboardingReturn {
  const [state, setState] = useState<{
    clientId: string
    data: ClientOnboarding | null
    status: OnboardingStatus
    error: string | null
  } | null>(null)

  const isMountedRef = useRef(false)
  const fetchIdRef = useRef(0)
  const clientIdRef = useRef(clientId)

  const load = useCallback(async () => {
    if (!clientId) return null
    return fetchClientOnboarding(clientId)
  }, [clientId])

  const applyResult = useCallback((result: Awaited<ReturnType<typeof fetchClientOnboarding>>, requestId: number) => {
    if (!isMountedRef.current || requestId !== fetchIdRef.current) return
    setState({
      clientId,
      data: result.status === 'found' ? result.data : null,
      status: result.status === 'found' ? 'success' : 'not_found',
      error: null,
    })
  }, [clientId])

  const applyError = useCallback((err: unknown, requestId: number) => {
    if (!isMountedRef.current || requestId !== fetchIdRef.current) return
    setState({
      clientId,
      data: null,
      status: 'error',
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    })
  }, [clientId])

  useEffect(() => {
    isMountedRef.current = true
    clientIdRef.current = clientId
    if (clientId) {
      const requestId = ++fetchIdRef.current
      void load().then((result) => {
        if (result) applyResult(result, requestId)
      }).catch((err: unknown) => applyError(err, requestId))
    }

    return () => {
      isMountedRef.current = false
      fetchIdRef.current += 1
    }
  }, [clientId, load, applyError, applyResult])

  const save = useCallback(
    async (onboarding: ClientOnboardingWrite): Promise<boolean> => {
      if (onboarding.client_id !== clientId || clientIdRef.current !== clientId) {
        return false
      }

      const success = await upsertClientOnboarding(onboarding)
      if (success && isMountedRef.current && clientIdRef.current === clientId) {
        const requestId = ++fetchIdRef.current
        try {
          const result = await load()
          if (result) applyResult(result, requestId)
        } catch (err) {
          applyError(err, requestId)
        }
      }
      return success
    },
    [clientId, load, applyError, applyResult]
  )

  const refetch = useCallback(() => {
    if (!clientId) return
    const requestId = ++fetchIdRef.current
    void load().then((result) => {
      if (result) applyResult(result, requestId)
    }).catch((err: unknown) => applyError(err, requestId))
  }, [clientId, load, applyError, applyResult])

  const activeState = state?.clientId === clientId ? state : null
  const data = activeState?.data ?? null
  const status = clientId ? activeState?.status ?? 'loading' : 'not_found'
  const error = activeState?.error ?? null

  return { data, status, error, save, refetch }
}
