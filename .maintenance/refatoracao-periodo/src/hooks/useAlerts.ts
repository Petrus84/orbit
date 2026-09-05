// ============================================================================
// src/hooks/useAlerts.ts
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAlerts, fetchCriticalAlerts } from '@/lib/repositories/alertsRepository'
import type { Alert, AlertSeverity, FetchStatus } from '@/types/alert'

// ── Config ────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 500 // 500 → 1000 → 2000 ms

// ── Derived counts ────────────────────────────────────────────────────────
// ⚠️ Este AlertCounts (com `total`) é INTENCIONALMENTE diferente do
// `AlertCounts` já exportado em orbit.ts (que não tem `total` — ver
// comentário no próprio orbit.ts sobre isso já ter sido sinalizado e não
// resolvido). Os dois nomes iguais para shapes diferentes em arquivos
// diferentes é confuso — mas resolver isso é decisão de arquitetura sua,
// não algo que dava pra decidir sozinho aqui. Deixei como
// `AlertSeverityCounts` para não colidir e não fingir que são a mesma coisa.
export interface AlertSeverityCounts {
  critical: number
  warning: number
  info: number
  total: number
}

/**
 * 🐛 CORRIGIDO: a versão anterior fazia `acc[a.severity]++` direto.
 * orbit.alert_severity tem 4 valores reais no Postgres (critical, warning,
 * info, success) — e esta query busca de `orbit.alerts` (tabela crua), não
 * de `v_alerts` (que colapsa 'success' em 'info'). Ou seja: uma linha com
 * severity='success' É possível aqui, e `acc['success']++` corrompia o
 * objeto silenciosamente (chave fantasma com NaN, sem quebrar o TS porque
 * o acesso é por index dinâmico). Normalizado abaixo: 'success' conta como
 * 'info' na UI, mesmo critério que a view v_alerts já usa no banco.
 */
function countBySeverity(alerts: Alert[]): AlertSeverityCounts {
  return alerts.reduce(
    (acc, a) => {
      const bucket: 'critical' | 'warning' | 'info' =
        a.severity === 'success' ? 'info' : a.severity
      acc[bucket]++
      acc.total++
      return acc
    },
    { critical: 0, warning: 0, info: 0, total: 0 } as AlertSeverityCounts
  )
}

// ── Return type ───────────────────────────────────────────────────────────
export interface UseAlertsReturn {
  data: Alert[]
  counts: AlertSeverityCounts
  status: FetchStatus
  error: string | null
  lastUpdated: Date | null
  refetch: () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useAlerts(filter?: AlertSeverity): UseAlertsReturn {
  const [data, setData] = useState<Alert[]>([])
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isMountedRef = useRef(true)
  const fetchTokenRef = useRef(0)

  const load = useCallback(
    async (token: number): Promise<void> => {
      if (!isMountedRef.current) return

      setStatus('loading')
      setError(null)

      let attempt = 0
      let lastError: Error | null = null

      while (attempt < MAX_RETRIES) {
        if (fetchTokenRef.current !== token) return

        try {
          const result =
            filter === 'critical' ? await fetchCriticalAlerts() : await fetchAlerts(filter)

          if (fetchTokenRef.current !== token || !isMountedRef.current) return

          setData(result)
          setStatus('success')
          setLastUpdated(new Date())
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

      setStatus('error')
      setError(lastError?.message ?? 'Erro desconhecido ao buscar alertas.')
    },
    [filter]
  )

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

  return {
    data,
    counts: countBySeverity(data),
    status,
    error,
    lastUpdated,
    refetch,
  }
}