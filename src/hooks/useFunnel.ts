// src/hooks/useFunnel.ts
// ORBIT · Hook — Funil Interativo + Simulador
// Versão: 1.0.0

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFunnelData } from '../lib/repositories/funnelRepository'

// ✅ 1. Importa os estados de carregamento do almoxarifado global
import type { AsyncState, FetchStatus } from '../types/orbit'

// ✅ 2. Importa a estrutura de métricas matemáticas que você criou na oficina do funil
import type { FunnelMetrics } from '../types/funnel'

// ─────────────────────────────────────────────
// Configuração de retry
// ─────────────────────────────────────────────

/** Número máximo de tentativas em caso de falha */
const MAX_RETRIES = 3

/** Delay base do backoff exponencial (1s, 2s, 4s, ...) */
const BASE_DELAY_MS = 1000

function getRetryDelay(attemptIndex: number): number {
  return BASE_DELAY_MS * 2 ** attemptIndex
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────
// Tipo de retorno do hook
// ─────────────────────────────────────────────

export interface UseFunnelResult extends AsyncState<FunnelMetrics | null> {
  /** Timestamp da última atualização bem-sucedida (null se nunca carregou) */
  lastUpdated: Date | null
  /** Refaz a busca manualmente, reiniciando o ciclo de retries */
  refetch: () => void
}

// ─────────────────────────────────────────────
// useFunnel
// ─────────────────────────────────────────────

/**
 * Hook responsável por carregar os dados reais do funil de um cliente
 * para um período específico.
 *
 * - Busca automaticamente ao montar (ou quando os parâmetros mudam)
 * - Retry automático com backoff exponencial (até MAX_RETRIES tentativas)
 * - Protegido contra race conditions / updates pós-desmontagem
 *   (importante no React 18 StrictMode, que monta/desmonta efeitos 2x em dev)
 * - Expõe refetch() para recarregar manualmente
 *
 * @param clientId    ID do cliente
 * @param periodStart Data inicial do período (ISO string)
 * @param periodEnd   Data final do período (ISO string)
 */
export function useFunnel(
  clientId: string,
  periodStart: string,
  periodEnd: string
): UseFunnelResult {
const [data, setData]     = useState<FunnelMetrics | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError]   = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Evita updates de estado após o componente desmontar
  const isMountedRef = useRef(true)

  // Identifica a "execução" atual — invalida respostas de buscas
  // antigas quando refetch() é chamado ou os parâmetros mudam
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current

    setStatus('loading')
    setError(null)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await fetchFunnelData(clientId, periodStart, periodEnd)

        // Ignora se desmontou ou se uma nova busca já foi disparada
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

        console.error(`[useFunnel] Tentativa ${attempt}/${MAX_RETRIES} falhou, tentando novamente...`, message)

        await wait(getRetryDelay(attempt - 1))

        // Re-checa antes de tentar novamente
        if (!isMountedRef.current || requestId !== requestIdRef.current) {
          return
        }
      }
    }
  }, [clientId, periodStart, periodEnd])

    useEffect(() => {
    isMountedRef.current = true

    // 📄 Adia o disparo do estado inicial para sair do ciclo síncrono do efeito
    setTimeout(() => {
      void load()
    }, 0)

    return () => {
      isMountedRef.current = false
    }
  }, [load])

  /** Refaz a busca manualmente, reiniciando o ciclo de retries */
  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { data, status, error, lastUpdated, refetch }
}
