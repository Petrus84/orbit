// src/app/funil/FunnelScreenWrapper.tsx
/* ==========================================================================
   ORBIT · FunnelScreenWrapper (v5 Final — SSOT Consolidado)
   Caminho: src/app/funil/FunnelScreenWrapper.tsx
   
   ✅ funnelMetricsToData() preserva erReal
   ✅ Sem duplicatas
   ✅ Código bem estruturado
   ========================================================================== */

'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import SectionHead from '@/components/common/SectionHead'
import FunnelChart from '@/components/common/FunnelChart'
import FunnelSimulator from '@/components/common/FunnelSimulator'
import type { SimulatorState } from '@/components/common/FunnelSimulator'
import type { SimulationResult } from '@/components/common/FunnelResult'
import type { UseFunnelResult, FunnelMetrics, FunnelData, FunnelStep } from '@/types/funnel'
import { calculateSimulatedFunnel } from '@/lib/repositories/funnelRepository'

// ─── INTERFACES ────────────────────────────────────────────────────────────

interface FunnelScreenWrapperProps {
  clientId: string
  periodStart: string
  periodEnd: string
  useFunnel: (clientId: string, periodStart: string, periodEnd: string) => UseFunnelResult
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────

/**
 * ✅ Transforma dados planos do banco (FunnelMetrics) em estrutura visual (FunnelData)
 * Preserva NULLs do Supabase (não medido ≠ zero)
 * Calcula percentages com segurança contra divisão por zero
 */
function funnelMetricsToData(metrics: FunnelMetrics | null): FunnelData | null {
  if (!metrics) return null

  const steps: FunnelStep[] = [
    {
      id: '1',
      label: 'Alcance',
      value: metrics.alcance,
      percentage: 100,
      color: '#8B5CF6',
      icon: 'users',
    },
    {
      id: '2',
      label: 'Visitas',
      value: metrics.visitas,
      percentage: metrics.alcance ? (metrics.visitas / metrics.alcance) * 100 : 0,
      color: '#3B82F6',
      icon: 'eye',
    },
    {
      id: '3',
      label: 'Cliques',
      value: metrics.cliques, // ✅ Preserva NULL (não medido)
      percentage:
        metrics.visitas && metrics.cliques !== null
          ? (metrics.cliques / metrics.visitas) * 100
          : 0,
      color: '#10B981',
      icon: 'click',
    },
    {
      id: '4',
      label: 'Vendas',
      value: metrics.vendas, // ✅ Preserva NULL (não medido)
      percentage:
        metrics.cliques && metrics.vendas !== null
          ? (metrics.vendas / metrics.cliques) * 100
          : 0,
      color: '#F59E0B',
      icon: 'shopping-bag',
    },
  ]

  return {
    clientId: 'current-client',
    totalValue: metrics.alcance ?? 0,
    period: 'Últimos 90 dias',
    erReal: metrics.erReal, // ✅ Preserva ER Real para cálculos
    steps,
  }
}

/**
 * ✅ Calcula CTR Link com proteção contra null e divisão por zero
 */
function calculateCtrLink(data: FunnelData | null): number {
  if (!data || data.totalValue === 0) {
    return 10 // Fallback seguro
  }

  const visitasStep = data.steps.find((s: FunnelStep) => s.id === '2')
  const cliquesStep = data.steps.find((s: FunnelStep) => s.id === '3')

  if (!visitasStep || !cliquesStep || visitasStep.value === null || cliquesStep.value === null) {
    return 10
  }

  if (visitasStep.value === 0) {
    return 10
  }

  const rawCtr = (cliquesStep.value / visitasStep.value) * 100
  return Math.min(rawCtr, 100)
}

/**
 * ✅ Calcula simulação com fórmula linear
 * Entrada: SimulatorState + ctrLink (ambos números válidos)
 * Saída: SimulationResult (sem nulls)
 */
function computeSimulation(state: SimulatorState, ctrLink: number): SimulationResult {
  const visitas = state.alcance * (state.ctrBio / 100)
  const cliques = visitas * (ctrLink / 100)
  const vendas = cliques * (state.taxaConv / 100)

  return {
    alcanceSimulado: state.alcance,
    ctrBio: state.ctrBio,
    taxaConv: state.taxaConv,
    cliques: Math.round(cliques),
    vendas: Math.round(vendas),
  }
}

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────

function ChartSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[100, 60, 30, 12].map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <div className="h-2.5 w-24 rounded bg-zinc-800" />
            <div className="h-2.5 w-16 rounded bg-zinc-800" />
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800">
            <div className="h-2 rounded-full bg-zinc-700" style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SimulatorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="h-2.5 w-40 rounded bg-zinc-800" />
            <div className="h-2.5 w-10 rounded bg-zinc-800" />
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800" />
        </div>
      ))}
      <div className="h-32 w-full rounded-2xl bg-zinc-800" />
    </div>
  )
}

interface PanelProps {
  title: string
  children: React.ReactNode
}

function Panel({ title, children }: PanelProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#18181F] p-5">
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-600">
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────

export default function FunnelScreenWrapper({
  clientId,
  periodStart,
  periodEnd,
  useFunnel,
}: FunnelScreenWrapperProps): React.ReactElement {
  // ✅ Busca dados do hook
  const { data: rawData, status, error, refetch } = useFunnel(clientId, periodStart, periodEnd)

  // ✅ Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('[FunnelScreenWrapper]')
      console.log('clientId:', clientId)
      console.log('status:', status)
      console.log('error:', error)
      console.log('rawData:', rawData)
      console.groupEnd()
    }
  }, [clientId, rawData, status, error])

  const isLoading = status === 'idle' || status === 'loading'

  // ✅ Converte FunnelMetrics → FunnelData (preserva erReal)
  const data = useMemo<FunnelData | null>(() => {
    return funnelMetricsToData(rawData)
  }, [rawData])

  // ✅ Estado do simulador com sincronização segura
  const [simState, setSimState] = useState<SimulatorState>(() => ({
    ctrBio: 5,
    taxaConv: 2,
    alcance: 10_000,
  }))

  // ✅ Sincroniza simulador com dados reais (sem useEffect com setState)
  const [synced, setSynced] = useState(false)
  if (data && !synced && data.totalValue > 0) {
    setSimState({
      ctrBio: rawData?.ctrBio ?? 5,
      taxaConv: rawData?.taxaConv ?? 2,
      alcance: rawData?.alcance ?? 10_000,
    })
    setSynced(true)
  }

  // ✅ Calcula CTR Link com proteção contra null
  const ctrLink = useMemo<number>(() => {
    return calculateCtrLink(data)
  }, [data])

  // ✅ Resultado da simulação com repositório (5 argumentos + type guard)
  const simResult = useMemo<SimulationResult>(() => {
    // Fallback se não há dados reais
    if (!data || !rawData) {
      return computeSimulation(simState, ctrLink)
    }

    try {
      // ✅ DETECTA O SEGMENTO DINAMICAMENTE
      const segmento =
        rawData?.alcance && rawData.alcance > 50_000
          ? 'ECOMMERCE_COMMODITY'
          : 'PROFESSIONAL_SERVICES'

      // ✅ CHAMADA COM 5 ARGUMENTOS (sincronizada com repositório)
      const repoResult = calculateSimulatedFunnel(
        {
          alcance: simState.alcance,
          ctrBio: simState.ctrBio,
          taxaConv: simState.taxaConv,
        },
        ctrLink,
        rawData?.alcance ?? 443, // 3º arg: âncora histórica real
        segmento, // 4º arg: contexto baseado no Avatar/Porteiro
        rawData?.erReal ?? null // 5º arg: ER Real vindo da view via FK (ex: 0.8542)
      )

      // ✅ PROTEÇÃO DISCRIMINADA DE UNIÃO (Evita erro TS2339)
      if (repoResult && repoResult.status === 'success' && 'data' in repoResult) {
        return {
          alcanceSimulado: repoResult.data.alcance,
          ctrBio: repoResult.data.ctrBio,
          taxaConv: repoResult.data.taxaConv,
          cliques: repoResult.data.cliques ?? 0,
          vendas: repoResult.data.vendas ?? 0,
        }
      }

      // Erro do repositório — fallback para cálculo local
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[FunnelScreenWrapper] Erro ao calcular simulação: ${repoResult.reason}`,
          repoResult.message
        )
      }
      return computeSimulation(simState, ctrLink)
    } catch (err) {
      // Exceção inesperada — fallback
      if (process.env.NODE_ENV === 'development') {
        console.error('[FunnelScreenWrapper] Erro inesperado ao calcular simulação:', err)
      }
      return computeSimulation(simState, ctrLink)
    }
  }, [simState, ctrLink, data, rawData])

  // ✅ Base de vendas com fallback seguro
  const baseVendas = useMemo<number>(() => {
    return rawData?.vendas ?? 0
  }, [rawData?.vendas])

  // ✅ Callback para refetch
  const handleRefetch = useCallback(() => {
    refetch()
  }, [refetch])

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead
        title="Funil de conversão"
        subtitle="Dados reais vs. cenário simulado"
      />

      {status === 'error' && error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center">
          <p className="text-sm text-red-400 mb-4">
            {typeof error === 'string' ? error : 'Falha na requisição'}
          </p>
          <button
            type="button"
            onClick={handleRefetch}
            className="rounded-full border border-red-500/40 bg-red-500/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Funil real · 90 dias">
            {isLoading || !data ? <ChartSkeleton /> : <FunnelChart data={data} />}
          </Panel>

          <Panel title="Simulador de cenários">
            {isLoading ? (
              <SimulatorSkeleton />
            ) : (
              <FunnelSimulator
                state={simState}
                onChange={setSimState}
                result={simResult}
                baseVendas={baseVendas}
              />
            )}
          </Panel>
        </div>
      )}
    </main>
  )
}
