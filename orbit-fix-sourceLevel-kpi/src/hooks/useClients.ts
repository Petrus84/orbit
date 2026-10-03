// src/hooks/useClients.ts
//
// Hook real de carteira de clientes. Contrato: UseClientsResult, definido
// em src/types/orbit.ts — única declaração existente, sem tipo concorrente:
//
//   export interface UseClientsResult extends AsyncState<Client[]> {
//     refetch: () => void
//   }
//   export interface AsyncState<T> {
//     data: T | null
//     status: FetchStatus
//     error: string | null
//   }
//
// Nada além desse shape é devolvido aqui — sem lastUpdated, sem filtro por
// parâmetro: UseClientsResult não declara nenhum dos dois. Se a tela
// precisar disso, é um campo novo em UseClientsResult (orbit.ts), não algo
// a inventar neste hook.
//
// v1.1.0 (alinhamento de padrão): a versão anterior fazia setState direto
// em load() sem guarda de desmontagem/corrida — useAlerts.ts e
// useInstagramOverview.ts (os outros dois hooks reais do projeto) já usam
// isMountedRef + token de requisição + retry com backoff. Replicado aqui
// pelo mesmo motivo que lá: evita setState em componente desmontado e
// evita que uma resposta antiga sobrescreva uma mais nova.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Client, UseClientsResult, FetchStatus } from '@/types/orbit'
import { fetchClientsWithHealth } from '@/lib/repositories/clientsRepository'

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 500 // 500ms → 1000ms → 2000ms

export function useClients(): UseClientsResult {
  const [data, setData] = useState<Client[] | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const fetchTokenRef = useRef(0)

  const load = useCallback(async (token: number): Promise<void> => {
    if (!isMountedRef.current) return

    setStatus('loading')
    setError(null)

    let attempt = 0
    let lastError: Error | null = null

    while (attempt < MAX_RETRIES) {
      if (fetchTokenRef.current !== token) return // resposta antiga, uma requisição mais nova já assumiu

      try {
        const clients = await fetchClientsWithHealth()

        if (fetchTokenRef.current !== token || !isMountedRef.current) return

        setData(clients)
        setStatus('success')
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        attempt++

        if (attempt < MAX_RETRIES) {
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1)
          await new Promise<void>((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    if (fetchTokenRef.current !== token || !isMountedRef.current) return

    // Nunca mascarar: erro vira mensagem explícita, não fallback silencioso.
    setError(lastError?.message ?? 'Erro desconhecido ao carregar clientes')
    setStatus('error')
  }, [])

  const refetch = useCallback((): void => {
    const token = ++fetchTokenRef.current
    void load(token)
  }, [load])

  useEffect(() => {
    isMountedRef.current = true
    const token = ++fetchTokenRef.current
    void load(token)

    return () => {
      isMountedRef.current = false
    }
  }, [load])

  return { data, status, error, refetch }
}