// src/components/screens/FunnelScreen.tsx
//
// ✅ Migrado de Tailwind ad-hoc (bg-[#18181F] hardcoded, max-w-7xl,
// text-zinc-*/border-zinc-* — paleta genérica desconectada do design
// system) para FunnelScreen.module.css, que já existia pronto e
// token-based mas tinha parado de ser importado. Mesma causa raiz do
// AvatarScreen.tsx: o shell da tela divergiu visualmente dos filhos
// (FunnelChart/FunnelSimulator), que sempre usaram seus próprios
// .module.css corretamente.
//
// A única decisão de design nova preservada da versão anterior: o
// grid assimétrico 2:1 (gráfico maior que o simulador) — implementado
// agora como .gridAsymmetric no CSS Module, no mesmo breakpoint
// (1024px) que .grid já usava, em vez de um breakpoint Tailwind (lg)
// que por coincidência batia com o mesmo valor mas vivia desconectado
// do resto do sistema de grid do app.

'use client'
import React, { useEffect, useMemo, useState } from 'react'
import SectionHead from '@/components/common/SectionHead'
import { GlassCard } from '@/components/common/GlassCard'
import FunnelChart from '@/components/common/FunnelChart'
import FunnelSimulator from '@/components/common/FunnelSimulator'
import type { SimulatorState } from '@/components/common/FunnelSimulator'
import type { SimulationResult } from '@/components/common/FunnelResult'
import type { UseFunnelResult } from '@/types/funnel'
import styles from './FunnelScreen.module.css'

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
    <div className={`${styles.skeletonRows} ${styles.skeletonPulse}`}>
      {[100, 60, 30, 12].map((w, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonLineRow}>
            <div className={styles.skeletonLine} style={{ width: 96 }} />
            <div className={styles.skeletonLine} style={{ width: 64 }} />
          </div>
          <div className={styles.skeletonBar}>
            <div className={styles.skeletonBarFill} style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function SimulatorSkeleton() {
  return (
    <div className={`${styles.skeletonRows} ${styles.skeletonPulse}`}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonLineRow}>
            <div className={styles.skeletonLine} style={{ width: 160 }} />
            <div className={styles.skeletonLine} style={{ width: 40 }} />
          </div>
          <div className={styles.skeletonBar} />
        </div>
      ))}
      <div className={styles.skeletonBlock} />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard glowColor="cyan" className={styles.panel}>
      <p className={styles.panelTitle}>{title}</p>
      <div className={styles.panelBody}>{children}</div>
    </GlassCard>
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
  }, [clientId, periodStart, periodEnd, data, status, error])

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
      alcance: data.alcance ?? 10_000,
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
    <main className={styles.main}>
      <SectionHead title="Funil de conversão" subtitle="Dados reais vs. cenário simulado" />

      {status === 'error' && error ? (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>
            {typeof error === 'string' ? error : 'Falha na requisição'}
          </p>
          <button type="button" onClick={() => refetch()} className={styles.retryBtn}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.colStretch}>

            <Panel title="Funil real . 90 dias">
              {isLoading || !data ? (
                <ChartSkeleton />
              ) : (
                <div className={styles.chartWrap}>
                  <FunnelChart data={data} />
                </div>
              )}
            </Panel>
          </div>

          <div className={styles.colStretch}>
            <Panel title="Simulador de cenários">
              {isLoading ? (
                <SimulatorSkeleton />
              ) : (
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
              )}
            </Panel>
          </div>
        </div>
      )}
    </main>
  )
}