// src/components/screens/FunnelScreen.tsx
'use client'

import React, { useMemo, useState, useCallback } from 'react'
import SectionHead from '@/components/common/SectionHead'
import FunnelChart from '@/components/common/FunnelChart'
import FunnelSimulator from '@/components/common/FunnelSimulator'
import type { SimulatorState } from '@/components/common/FunnelSimulator'
import type { SimulationResult } from '@/components/common/FunnelResult'
import type { UseFunnelResult, FunnelMetrics, FunnelData } from '@/types/orbit'
import { calculateSimulatedFunnel } from '@/lib/repositories/funnelRepository'

interface FunnelScreenProps {
  clientId: string
  periodStart: string
  periodEnd: string
  useFunnel: (clientId: string, periodStart: string, periodEnd: string) => UseFunnelResult
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────

/**
 * ✅ BLINDAGEM 1: Cálculo seguro de CTR com null-coalescing
 * Protege contra divisão por zero e valores inválidos
 */
function calculateCtrLink(data: FunnelMetrics | null): number {
  if (!data) return 10

  const visitas = data.visitas ?? 0
  const cliques = data.cliques ?? 0

  if (visitas === 0 || cliques === 0) {
    return 10
  }

  const rawCtr = (cliques / visitas) * 100
  return rawCtr > 100 ? 100 : rawCtr
}

/**
 * ✅ CORREÇÃO A: Mapeamento Flat → steps[], preservando o null real do Supabase
 */
function buildChartData(data: FunnelMetrics | null): FunnelData | null {
  if (!data) return null

  return {
    clientId: 'current-client',
    totalValue: data.alcance ?? 0,
    period: 'Últimos 90 dias',
    erReal: data.erReal ?? null, // ✅ Adiciona erReal (pode ser null)
    steps: [
      {
        id: '1',
        label: 'Alcance',
        value: data.alcance,
        percentage: 100,
        color: '#8B5CF6',
        icon: 'users',
      },
      {
        id: '2',
        label: 'Visitas',
        value: data.visitas,
        percentage: data.alcance ? (data.visitas / data.alcance) * 100 : 0,
        color: '#3B82F6',
        icon: 'eye',
      },
      {
        id: '3',
        label: 'Cliques',
        value: data.cliques, // ✅ Preserva o null original do Supabase
        percentage:
          data.visitas && data.cliques !== null ? (data.cliques / data.visitas) * 100 : 0,
        color: '#10B981',
        icon: 'click',
      },
      {
        id: '4',
        label: 'Vendas',
        value: data.vendas, // ✅ Preserva o null original do Supabase
        percentage:
          data.cliques && data.vendas !== null ? (data.vendas / data.cliques) * 100 : 0,
        color: '#F59E0B',
        icon: 'shopping-bag',
      },
    ],
  }
}

/**
 * Skeleton para o gráfico durante carregamento
 */
function ChartSkeleton(): React.ReactElement {
  return (
    <div className="flex w-full flex-col gap-4 animate-pulse">
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

/**
 * Skeleton para o simulador durante carregamento
 */
function SimulatorSkeleton(): React.ReactElement {
  return (
    <div className="flex w-full flex-col gap-5 animate-pulse">
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

/**
 * Painel reutilizável com estilo consistente
 */
interface PanelProps {
  title: string
  children: React.ReactNode
}

function Panel({ title, children }: PanelProps): React.ReactElement {
  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-800/40 bg-[#18181F] p-6 shadow-lg">
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </p>
      <div className="flex flex-1 w-full flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────

/**
 * Componente Principal: FunnelScreen
 * ✅ SEM useEffect com setState (elimina cascading renders)
 * ✅ Tipagem forte de ponta a ponta
 * ✅ 5 argumentos para calculateSimulatedFunnel (SSOT)
 * ✅ Type guard discriminado
 * ✅ Nulos reais preservados no gráfico
 * ✅ Fallback do catch usa travas de mercado
 */
export default function FunnelScreen({
  clientId,
  periodStart,
  periodEnd,
  useFunnel,
}: FunnelScreenProps): React.ReactElement {
  // ─── HOOKS DE DADOS ────────────────────────────────────────────────────

  const { data, status, error, refetch } = useFunnel(clientId, periodStart, periodEnd)

  const isLoading = status === 'idle' || status === 'loading'

  // ─── SINCRONICIDADE CORRIGIDA (SEM useEffect) ──────────────────────────

  /**
   * ✅ CHAVE: useMemo cria initialSimState de forma estável
   * Isso garante que simState sempre esteja sincronizado com data
   * SEM causar cascading renders
   */
  const initialSimState = useMemo<SimulatorState>(() => {
    if (!data) {
      return {
        ctrBio: 5,
        taxaConv: 2,
        alcance: 10_000,
      }
    }

    return {
      ctrBio: data.ctrBio ?? 5,
      taxaConv: data.taxaConv ?? 2,
      alcance: data.alcance ?? 10_000,
    }
  }, [data])

  /**
   * ✅ SOLUÇÃO: useState com inicializador (função)
   * A função é chamada UMA VEZ na montagem
   * Depois, simState é controlado apenas por setSimState
   * Nenhum useEffect com setState = nenhum cascading render
   */
  const [simState, setSimState] = useState<SimulatorState>(() => initialSimState)

  // ─── CÁLCULOS DERIVADOS ───────────────────────────────────────────────

  /**
   * ✅ BLINDAGEM 1: CTR Link com proteção contra divisão por zero
   */
  const ctrLink = useMemo<number>(() => {
    return calculateCtrLink(data)
  }, [data])

  /**
   * ✅ CORREÇÃO A: dados do gráfico preservando null real (steps[]) + erReal
   */
  const chartData = useMemo<FunnelData | null>(() => {
    return buildChartData(data)
  }, [data])

  /**
   * ✅ Resultado da simulação com repositório (5 argumentos + type guard)
   */
  const simResult = useMemo<SimulationResult>(() => {
    // Fluxo 1: Sem dados reais
    if (!data) {
      return {
        alcanceSimulado: simState.alcance,
        ctrBio: simState.ctrBio,
        taxaConv: simState.taxaConv,
        cliques: 0,
        vendas: 0,
      }
    }

    // ✅ Detecta o segmento dinamicamente
    const segmento = data.alcance > 50_000 ? 'ECOMMERCE_COMMODITY' : 'PROFESSIONAL_SERVICES'

    try {
      // ✅ CHAMADA COM 5 ARGUMENTOS (contrato do repositório)
      const repoResult = calculateSimulatedFunnel(
        {
          alcance: simState.alcance,
          ctrBio: simState.ctrBio,
          taxaConv: simState.taxaConv,
        },
        ctrLink,
        data.alcance ?? 443, // 3º arg: âncora de escala
        segmento, // 4º arg: contexto do avatar
        data.erReal ?? null // 5º arg: ER Real da View via FK
      )

      // Fluxo 2: Sucesso do repositório
      // ✅ TYPE GUARD DISCRIMINADO: só acessa .data se status === 'success'
      if (repoResult.status === 'success') {
        return {
          alcanceSimulado: repoResult.data.alcance,
          ctrBio: repoResult.data.ctrBio,
          taxaConv: repoResult.data.taxaConv,
          cliques: repoResult.data.cliques ?? 0,
          vendas: repoResult.data.vendas ?? 0,
        }
      }

      // Fluxo 3: Erro de negócio do repositório
      if (process.env.NODE_ENV === 'development') {
        console.error(
          '[FunnelScreen] Erro ao calcular simulação:',
          repoResult.reason,
          repoResult.message
        )
      }

      // ✅ CORREÇÃO B: fallback com travas estáticas de mercado
      const maxCTR = segmento === 'ECOMMERCE_COMMODITY' ? 3.0 : 10.0
      const maxConv = segmento === 'ECOMMERCE_COMMODITY' ? 2.0 : 6.0

      const visitas = simState.alcance * (Math.min(simState.ctrBio, maxCTR) / 100)
      const cliques = visitas * (ctrLink / 100)
      const vendas = cliques * (Math.min(simState.taxaConv, maxConv) / 100)

      return {
        alcanceSimulado: simState.alcance,
        ctrBio: Math.min(simState.ctrBio, maxCTR),
        taxaConv: Math.min(simState.taxaConv, maxConv),
        cliques: Math.round(cliques),
        vendas: Math.round(vendas),
      }
    } catch (err) {
      // Fluxo 4: Fallback se algo quebrar de forma inesperada
      if (process.env.NODE_ENV === 'development') {
        console.error('[FunnelScreen] Erro inesperado ao calcular simulação:', err)
      }

      // ✅ CORREÇÃO B: mesmas travas de mercado
      const maxCTR = segmento === 'ECOMMERCE_COMMODITY' ? 3.0 : 10.0
      const maxConv = segmento === 'ECOMMERCE_COMMODITY' ? 2.0 : 6.0

      const visitas = simState.alcance * (Math.min(simState.ctrBio, maxCTR) / 100)
      const cliques = visitas * (ctrLink / 100)
      const vendas = cliques * (Math.min(simState.taxaConv, maxConv) / 100)

      return {
        alcanceSimulado: simState.alcance,
        ctrBio: Math.min(simState.ctrBio, maxCTR),
        taxaConv: Math.min(simState.taxaConv, maxConv),
        cliques: Math.round(cliques),
        vendas: Math.round(vendas),
      }
    }
  }, [simState, ctrLink, data])

  // ─── DADOS PARA RENDERIZAÇÃO ──────────────────────────────────────────

  /**
   * ✅ BLINDAGEM 2: Base de vendas com fallback seguro
   */
  const baseVendas = useMemo<number>(() => {
    return data?.vendas ?? 0
  }, [data?.vendas])

  // ─── CALLBACKS ────────────────────────────────────────────────────────

  /**
   * ✅ Callback seguro para refetch
   */
  const handleRefetch = useCallback(() => {
    refetch()
  }, [refetch])

  // ─── RENDERIZAÇÃO ─────────────────────────────────────────────────────

  return (
    <main className="mx-auto flex w-full max-w-7xl min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-8 sm:px-6 lg:px-8">
      <SectionHead
        title="Funil de conversão"
        subtitle="Dados reais vs. cenário simulado"
      />

      {status === 'error' && error ? (
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center">
          <p className="mb-4 text-sm text-red-400">
            {typeof error === 'string' ? error : 'Falha na requisição'}
          </p>
          <button
            type="button"
            onClick={handleRefetch}
            className="rounded-full border border-red-500/40 bg-red-500/20 px-4 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/30"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 items-stretch lg:grid-cols-3">
          {/* Painel Esquerdo: Gráfico do Funil Real */}
          <div className="flex w-full flex-col lg:col-span-2">
            <Panel title="Funil real · 90 dias">
              {isLoading || !chartData ? (
                <ChartSkeleton />
              ) : (
                <div className="flex min-h-[350px] w-full items-center justify-center">
                  <FunnelChart data={chartData} />
                </div>
              )}
            </Panel>
          </div>

          {/* Painel Direito: Simulador */}
          <div className="flex w-full flex-col">
            <Panel title="Simulador de cenários">
              {isLoading ? (
                <SimulatorSkeleton />
              ) : (
                <div className="flex h-full w-full flex-col justify-between">
                  <FunnelSimulator
                    state={simState}
                    onChange={setSimState}
                    result={simResult}
                    baseVendas={baseVendas}
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
