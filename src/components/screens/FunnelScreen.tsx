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
import type { UseFunnelResult } from '@/types/funnel'
import { runFunnelSimulation } from '@/lib/repositories/funnelMath'
import styles from './FunnelScreen.module.css'

interface FunnelScreenProps {
  clientId: string
  periodStart: string
  periodEnd: string
  useFunnel: (clientId: string, periodStart: string, periodEnd: string) => UseFunnelResult
}

// Ticket médio (R$) ainda não tem fonte real conectada (nenhuma coluna de
// receita chega via useFunnel/FunnelMetrics) — mesmo caso de
// erRealNativo/setor logo abaixo. Usamos um valor inicial editável em vez
// de inventar uma métrica "real" que não existe no banco.
const DEFAULT_TICKET_MEDIO = 80

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
    ticketMedio: DEFAULT_TICKET_MEDIO,
  })

  const [synced, setSynced] = useState(false)

  if (data && !synced) {
    setSimState((prev) => ({
      ctrBio: data.ctrBio ?? 5,
      taxaConv: data.taxaConv ?? 2,
      alcance: data.alcance ?? 10_000,
      ticketMedio: prev.ticketMedio, // premissa do usuário, não vem do fetch
    }))
    setSynced(true)
  }

  const ctrLink = useMemo(() => {
    if (!data || !data.visitas || data.visitas === 0) return 10
    const rawCtr = (data.cliques / data.visitas) * 100
    // Trava preventiva: se a taxa calculada for bizarra por ruído do scraper, limita a amostragem
    return rawCtr > 100 ? 100 : rawCtr
  }, [data])

  // ✅ CORREÇÃO (dataflow, 2026-09-06): antes, o decaimento por saturação
  // (razaoEscala/friccao) só existia dentro de FunnelSimulator.tsx como um
  // texto de aviso — o cálculo real de vendas ignorava a saturação
  // completamente (função linear pura). Agora ambos vêm da mesma fonte
  // (src/lib/funnelMath.ts), então o número que o usuário vê É o número
  // usado no aviso, sempre.
  const alcanceRealHistorico = data?.alcance ?? 0
  const erRealNativo: number | null = null // sem fonte real conectada ainda (ver comentário abaixo)

  const { result: simResult, saturation } = useMemo(
    () =>
      runFunnelSimulation(simState, ctrLink, {
        alcanceRealHistorico,
        erRealNativo,
      }),
    [simState, ctrLink, alcanceRealHistorico, erRealNativo]
  )

  const baseVendas = data?.vendas ?? 0
  const baseCliques = data?.cliques ?? 0

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
            <Panel title="Funil real · 90 dias">
              {isLoading || !data ? (
                <ChartSkeleton />
              ) : (
                <div className={styles.chartWrap}>
                  <FunnelChart data={{ ...data, ticketMedio: simState.ticketMedio }} />
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
                  baseCliques={baseCliques}
                  // ✅ CORREÇÃO (dataflow, 2026-09-06): saturation já vem
                  // calculado por runFunnelSimulation acima — FunnelSimulator
                  // só exibe, não recalcula mais em paralelo (era isso que
                  // permitia o aviso de saturação divergir do resultado
                  // real). erRealNativo/setor continuam null: sem fonte de
                  // dado real conectada ainda nesta tela (erRealNativo viria
                  // do banco de engajamento nativo; setor viria de
                  // ClientOnboarding.setor_benchmark, domínio de onboarding
                  // não buscado aqui). Não inventar valor.
                  saturation={saturation}
                  erRealNativo={erRealNativo}
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