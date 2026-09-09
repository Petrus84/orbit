// src/hooks/useFunnel.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFunnelData } from '@/lib/repositories/funnelRepository'

import type { FetchStatus } from '@/types/orbit'
import type { FunnelMetrics, UseFunnelResult, SimulatedFunnelParams } from '@/types/funnel'

const DEFAULT_PARAMS: SimulatedFunnelParams = {
  alcance: 10_000,
  ctrBio: 5,
  taxaConv: 2,
}

export function useFunnel(
  clientId: string,
  periodStart: string,
  periodEnd: string
): UseFunnelResult {
  const [data, setData] = useState<FunnelMetrics | null>(null)
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [params, setParams] = useState<SimulatedFunnelParams>(DEFAULT_PARAMS)
  // ✅ TICKETS item 8
  const [setor, setSetor] = useState<UseFunnelResult['setor']>(null)

  // Tracker para controle de requisição ativa e race conditions
  const activeRequestRef = useRef<number>(0)

  // Reseta o estado do simulador quando as chaves de entrada mudarem
  const lastParamsKey = useRef<string>('')
  const currentKey = `${clientId}:${periodStart}:${periodEnd}`

  const load = useCallback(async (requestId?: number) => {
    if (!clientId) {
      setStatus('idle')
      return
    }

    const currentRequestId = requestId ?? ++activeRequestRef.current

    setStatus('loading')
    setError(null)

    try {
      const result = await fetchFunnelData(clientId, periodStart, periodEnd)

      // Se outra requisição mais nova disparou enquanto esperava, ignora essa
      if (currentRequestId !== activeRequestRef.current) return

      setData(result.metrics)
      setStatus('success')
      setError(null)
      setLastUpdated(new Date())
      setSetor(result.setor)

      // Resincroniza os parâmetros do simulador apenas se o contexto (cliente/data) mudou
      if (lastParamsKey.current !== currentKey) {
        setParams({
          alcance: result.metrics.alcance,
          // ✅ CORRIGIDO 09/09 (TICKETS item 4) — o alvo do simulador
          // ("CTR alvo da bio") sempre significou alcance→visitas (ver
          // funnelMath.ts:computeSaturation, ctrEfetivo = ctrBio/friccao
          // aplicado sobre `visitas = alcance * ctrEfetivo`). Antes lia de
          // `result.metrics.ctrBio`, que tinha o mesmo valor mas nome
          // errado; agora lê do campo com nome certo.
          ctrBio: result.metrics.profileVisitRate,
          taxaConv: result.metrics.taxaConv,
        })
        lastParamsKey.current = currentKey
      }
    } catch (err) {
      if (currentRequestId !== activeRequestRef.current) return

      const message = err instanceof Error ? err.message : 'Erro ao carregar dados do funil.'
      console.error('[useFunnel] Erro no carregamento:', message)

      setData(null)
      setStatus('error')
      setError(message)
    }
  }, [clientId, periodStart, periodEnd, currentKey])

  useEffect(() => {
    const requestId = ++activeRequestRef.current
    const loadTimer = window.setTimeout(() => {
      void load(requestId)
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
      // Invalida requisições pendentes ao desmontar ou trocar dependências
      activeRequestRef.current = requestId + 1
    }
  }, [load])

  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { data, status, error, lastUpdated, refetch, params, setParams, setor }
}