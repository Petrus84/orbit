// src/hooks/useFunnel.ts
// Versão: 1.0.0 (CORRIGIDO)

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFunnelData } from '../lib/repositories/funnelRepository'

import type { FetchStatus } from '../types/orbit'
import type { FunnelMetrics, UseFunnelResult, SimulatedFunnelParams } from '../types/funnel'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

// Defaults usados até o primeiro fetch resolver — mesmos valores iniciais
// que FunnelScreen.tsx já usa para o simulador (simState), para não haver
// dois "valores de partida" diferentes coexistindo na mesma tela.
const DEFAULT_PARAMS: SimulatedFunnelParams = {
  alcance: 10_000,
  ctrBio: 5,
  taxaConv: 2,
}

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

  // ✅ CORREÇÃO (L7 — useFunnel.ts): UseFunnelResult (orbit.ts) exige
  // params/setParams, que não existiam aqui — quebrava FunnelScreen.tsx e
  // qualquer outro consumidor tipado corretamente contra o contrato real.
  // Sincroniza uma vez com os valores reais assim que o fetch resolve
  // (mesmo padrão de "sync on first load" que FunnelScreen.tsx já usa
  // localmente para simState), mas continua editável depois via setParams.
  const [params, setParams] = useState<SimulatedFunnelParams>(DEFAULT_PARAMS)
  const paramsSyncedRef = useRef(false)

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

        // ✅ CORREÇÃO (Linha 70): fetchFunnelData retorna { metrics, insight }
        // Desempacotar apenas metrics para setData
        setData(result.metrics)
        setStatus('success')
        setError(null)
        setLastUpdated(new Date())

        if (!paramsSyncedRef.current) {
          // ✅ CORREÇÃO (Linha 76): acessar result.metrics.* em vez de result.*
          setParams({
            alcance: result.metrics.alcance,
            ctrBio: result.metrics.ctrBio,
            taxaConv: result.metrics.taxaConv,
          })
          paramsSyncedRef.current = true
        }
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

  return { data, status, error, lastUpdated, refetch, params, setParams }
}