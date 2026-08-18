// ─── useAvatar ────────────────────────────────────────────────────────────────
// Custom React hook for the Avatar Alignment screen.
// Handles fetching, retry with exponential backoff, and race-condition safety
// under React 18 StrictMode (double-invoke of effects).
// 
// ✅ MELHORIAS v2.0:
// - Diferencia entre NO_DATA, NETWORK_ERROR, VALIDATION_FAILED e UNKNOWN
// - Não usa fallback silencioso
// - Feedback claro ao usuário sobre o tipo de erro

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAvatarAlignment, AvatarRepositoryError } from '../lib/repositories/avatarRepository'
import type { AvatarAlignment, FetchStatus } from '../types/avatar'

// ─── Public shape ─────────────────────────────────────────────────────────────

export interface UseAvatarReturn {
  data: AvatarAlignment | null
  status: FetchStatus
  error: string | null
  errorCode: 'NO_DATA' | 'VALIDATION_FAILED' | 'NETWORK_ERROR' | 'UNKNOWN' | null
  lastUpdated: Date | null
  refetch: () => void
  isRetrying: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3
const BASE_DELAY_MS = 500

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAvatar(clientId: string): UseAvatarReturn {
  const [data, setData] = useState<AvatarAlignment | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<'NO_DATA' | 'VALIDATION_FAILED' | 'NETWORK_ERROR' | 'UNKNOWN' | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const isMountedRef = useRef<boolean>(false)
  const fetchIdRef = useRef<number>(0)

  // ─── Core fetch with retry ───────────────────────────────────────────────

  const load = useCallback(async (): Promise<void> => {
    if (!clientId) {
      setStatus('error')
      setError('clientId é obrigatório')
      setErrorCode('VALIDATION_FAILED')
      return
    }

    fetchIdRef.current += 1
    const thisFetchId = fetchIdRef.current

    if (isMountedRef.current) {
      setStatus('loading')
      setError(null)
      setErrorCode(null)
      setIsRetrying(false)
    }

    let lastError: AvatarRepositoryError | Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Exponential backoff before retries (skip on first attempt)
      if (attempt > 0) {
        if (isMountedRef.current) {
          setIsRetrying(true)
        }
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1))
      }

      // Abort if unmounted or superseded
      if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return

      try {
        const alignment = await fetchAvatarAlignment(clientId)

        // Final guard before committing state
        if (!isMountedRef.current || thisFetchId !== fetchIdRef.current) return

        setData(alignment)
        setStatus('success')
        setError(null)
        setErrorCode(null)
        setLastUpdated(new Date())
        setIsRetrying(false)
        return // ← success: exit retry loop
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        // ✅ DIFERENCIAÇÃO: Extrair código de erro se for AvatarRepositoryError
        let errorCode: 'NO_DATA' | 'VALIDATION_FAILED' | 'NETWORK_ERROR' | 'UNKNOWN' = 'UNKNOWN'
        if (err instanceof AvatarRepositoryError) {
          errorCode = err.code
        }

        console.error(
          `[useAvatar] attempt ${attempt + 1}/${MAX_RETRIES} failed (${errorCode}):`,
          lastError.message
        )

        // ✅ NÃO RETENTA: Se for NO_DATA (cliente não tem avatar configurado)
        if (err instanceof AvatarRepositoryError && err.code === 'NO_DATA') {
          if (isMountedRef.current && thisFetchId === fetchIdRef.current) {
            setStatus('error')
            setError(lastError.message)
            setErrorCode('NO_DATA')
            setIsRetrying(false)
          }
          return // Não tenta novamente
        }

        // ✅ RETENTA: Se for erro de rede
        if (err instanceof AvatarRepositoryError && err.code === 'NETWORK_ERROR') {
          if (attempt < MAX_RETRIES - 1) {
            console.warn(`[useAvatar] Erro de rede detectado. Tentando novamente em ${BASE_DELAY_MS * Math.pow(2, attempt)}ms...`)
            continue // Tenta novamente
          }
        }
      }
    }

    // All retries exhausted
    if (isMountedRef.current && thisFetchId === fetchIdRef.current) {
      const finalErrorCode = lastError instanceof AvatarRepositoryError ? lastError.code : 'UNKNOWN'
      setStatus('error')
      setError(lastError?.message ?? 'Erro desconhecido ao carregar alinhamento de avatar.')
      setErrorCode(finalErrorCode)
      setIsRetrying(false)
    }
  }, [clientId])

  // ─── Effect ──────────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true

    // Adia a execução para evitar renderizações síncronas em cascata
    setTimeout(() => {
      void load()
    }, 0)

    return () => {
      isMountedRef.current = false
    }
  }, [load])

  // ─── Public API ───────────────────────────────────────────────────────────

  const refetch = useCallback((): void => {
    void load()
  }, [load])

  return {
    data,
    status,
    error,
    errorCode,
    lastUpdated,
    refetch,
    isRetrying,
  }
}