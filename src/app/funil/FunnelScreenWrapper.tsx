/* ==========================================================================
   ORBIT · FunnelScreenWrapper
   Caminho: src/app/instagram/funil/_FunnelScreenWrapper.tsx
   Versão: 1.0.0

   Problema: FunnelScreen.tsx lê clientId via useParams<{ clientId }>()
   mas a rota /instagram/funil NÃO tem [clientId] na URL.
   useParams() retorna {} → clientId = '' → hook não busca nada → tela vazia.

   Solução: Este wrapper recebe clientId como prop e passa diretamente
   ao useFunnel. O FunnelScreen original não precisa ser modificado —
   apenas substituímos a source do clientId.
   ========================================================================== */

'use client'

import React, { useEffect, useState, useMemo } from 'react'
import SectionHead from '@/components/common/SectionHead'
import FunnelChart from '@/components/common/FunnelChart'
import FunnelSimulator from '@/components/common/FunnelSimulator'
import type { FunnelData } from '@/components/common/FunnelChart'
import type { SimulatorState } from '@/components/common/FunnelSimulator'
import type { SimulationResult } from '@/components/common/FunnelResult'
import type { UseFunnelResult } from '@/types/funnel'

interface FunnelScreenWrapperProps {
  clientId: string
  periodStart: string
  periodEnd: string
  useFunnel: (clientId: string, periodStart: string, periodEnd: string) => UseFunnelResult
}

// Fórmula: visitas = alcance × ctrBio/100 · cliques = visitas × ctrLink/100
function computeSimulation(state: SimulatorState, ctrLink: number): SimulationResult {
  const visitas = state.alcance * (state.ctrBio / 100)
  const cliques = visitas * (ctrLink / 100)
  const vendas  = cliques * (state.taxaConv / 100)
  return {
    alcanceSimulado: state.alcance,
    ctrBio: state.ctrBio,
    taxaConv: state.taxaConv,
    cliques: Math.round(cliques),
    vendas:  Math.round(vendas),
  }
}

function ChartSkeleton() {
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

function SimulatorSkeleton() {
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#18181F] p-5">
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-600">
        {title}
      </p>
      {children}
    </div>
  )
}

export default function FunnelScreenWrapper({ clientId, periodStart, periodEnd, useFunnel }: FunnelScreenWrapperProps) {
  // Passa clientId + período para o hook useFunnel
  const { data, status, error, refetch } = useFunnel(clientId, periodStart, periodEnd)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('[FunnelScreenWrapper]')
      console.log('clientId:', clientId)
      console.log('status:', status)
      console.log('error:', error)
      console.log('data:', data)
      console.groupEnd()
    }
  }, [clientId, data, status, error])

  const isLoading = status === 'idle' || status === 'loading'

  const [simState, setSimState] = useState<SimulatorState>({
    ctrBio:   5,
    taxaConv: 2,
    alcance:  10_000,
  })

  const [synced, setSynced] = useState(false)
  if (data && !synced) {
    setSimState({ ctrBio: data.ctrBio, taxaConv: data.taxaConv, alcance: data.alcance })
    setSynced(true)
  }

  const ctrLink = useMemo(() => {
    if (!data || data.visitas === 0) return 10
    return (data.cliques / data.visitas) * 100
  }, [data])

  const simResult = useMemo(() => computeSimulation(simState, ctrLink), [simState, ctrLink])
  const baseVendas = data?.vendas ?? 0

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead title="Funil de conversão" subtitle="Dados reais vs. cenário simulado" />

      {status === 'error' && error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={refetch}
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
              <FunnelSimulator state={simState} onChange={setSimState} result={simResult} baseVendas={baseVendas} />
            )}
          </Panel>
        </div>
      )}
    </main>
  )
}