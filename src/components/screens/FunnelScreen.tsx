// src/components/screens/FunnelScreen.tsx
'use client'
import React, { useEffect, useMemo, useState } from 'react'
import SectionHead from '@/components/common/SectionHead'
import FunnelChart from '@/components/common/FunnelChart'
import FunnelSimulator from '@/components/common/FunnelSimulator'
import type { SimulatorState } from '@/components/common/FunnelSimulator'
import type { SimulationResult } from '@/components/common/FunnelResult'
import type { UseFunnelResult } from '@/types/funnel'

interface FunnelScreenProps {
  clientId: string
  periodStart: string
  periodEnd: string
  useFunnel: (clientId: string, periodStart: string, periodEnd: string) => UseFunnelResult
}

function computeSimulation(state: SimulatorState, ctrLink: number): SimulationResult {
  // Ajuste matemático preventivo contra divisões espúrias por zero ou valores inteiros diretos
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

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse w-full">
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
    <div className="flex flex-col gap-5 animate-pulse w-full">
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
    <div className="flex flex-col gap-4 rounded-2xl bg-[#18181F] p-6 w-full shadow-lg border border-zinc-800/40">
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </p>
      <div className="flex-1 w-full flex flex-col justify-center items-center">
        {children}
      </div>
    </div>
  )
}

export default function FunnelScreen({ clientId, periodStart, periodEnd, useFunnel }: FunnelScreenProps) {
  const { data, status, error, refetch } = useFunnel(clientId, periodStart, periodEnd)

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('[FunnelScreen]')
      console.log('clientId:', clientId)
      console.log('periodStart:', periodStart)
      console.log('periodEnd:', periodEnd)
      console.log('status:', status)
      console.log('error:', error)
      console.log('data:', data)
      console.groupEnd()
    }
  } , [clientId, periodStart, periodEnd, data, status, error])

  const isLoading = status === 'idle' || status === 'loading'
  
  const [simState, setSimState] = useState<SimulatorState>({
    ctrBio: 5,
    taxaConv: 2,
    alcance: 10_000,
  })

  const [synced, setSynced] = useState(false)

  if (data && !synced) {
    setSimState({ 
      ctrBio: data.ctrBio ?? 5, 
      taxaConv: data.taxaConv ?? 2, 
      alcance: data.alcance ?? 10_000 
    })
    setSynced(true)
  }

  const ctrLink = useMemo(() => {
    if (!data || !data.visitas || data.visitas === 0) return 10
    const rawCtr = (data.cliques / data.visitas) * 100
    // Trava preventiva: se a taxa calculada for bizarra por ruído do scraper, limita a amostragem
    return rawCtr > 100 ? 100 : rawCtr
  }, [data])

  const simResult = useMemo(() => computeSimulation(simState, ctrLink), [simState, ctrLink])
  const baseVendas = data?.vendas ?? 0

  return (
    // 🗹 DESIGN COMPLETO: Adicionado limite de largura max-w-7xl centralizado para matar o vazio
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-8 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto">
      <SectionHead title="Funil de conversão" subtitle="Dados reais vs. cenário simulado" />

      {status === 'error' && error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center max-w-2xl mx-auto w-full">
          <p className="text-sm text-red-400 mb-4">{typeof error === 'string' ? error : 'Falha na requisição'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full border border-red-500/40 bg-red-500/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-all"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        // 🗹 GRID ASSIMÉTRICO PREMIUM: Gráfico ganha mais espaço (2/3) e o simulador se ajusta à direita (1/3)
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 w-full items-stretch">
          <div className="lg:col-span-2 flex flex-col w-full">
            <Panel title="Funil real . 90 dias">
              {isLoading || !data ? (
                <ChartSkeleton />
              ) : (
                <div className="w-full h-full min-h-[350px] flex justify-center items-center">
                  <FunnelChart data={data} />
                </div>
              )}
            </Panel>
          </div>
          
          <div className="flex flex-col w-full">
            <Panel title="Simulador de cenários">
              {isLoading ? (
                <SimulatorSkeleton />
              ) : (
                <div className="w-full h-full flex flex-col justify-between">
                  <FunnelSimulator 
                    state={simState} 
                    onChange={setSimState} 
                    result={simResult} 
                    baseVendas={baseVendas} 
                    // ✅ CORREÇÃO (L6 — FunnelScreen.tsx): FunnelSimulatorProps
                    // exige alcanceRealHistorico/erRealNativo/setor.
                    // alcanceRealHistorico vem de dado real já buscado
                    // (data.alcance). erRealNativo e setor não têm fonte de
                    // dado real conectada ainda nesta tela (erRealNativo
                    // viria do banco de engajamento nativo; setor viria de
                    // ClientOnboarding.setor_benchmark, um domínio diferente
                    // — onboarding — não buscado aqui). null é o estado
                    // legítimo que FunnelSimulator já trata: cai para
                    // benchmark (1.5%) e mostra "Benchmark" em vez de
                    // "Banco" no diagnóstico. Não inventar valor — se/quando
                    // useOnboarding(clientId) for integrado a esta tela, dá
                    // pra trocar por dado real.
                    alcanceRealHistorico={data?.alcance ?? 0}
                    erRealNativo={null}
                    setor={null}
                  />
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </main>
  )
}