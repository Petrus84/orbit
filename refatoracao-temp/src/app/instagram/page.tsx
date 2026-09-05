/* ==========================================================================
   ORBIT · Page — Instagram Overview
   Caminho físico real: src/app/instagram/page.tsx

   CORREÇÃO v1.5.1 (com AudienceSummaryPanel):
   - Adicionado AudienceSummaryPanel na aba "audiencia"
   - Renderiza dados reais de gênero + cidades + alcance

   REFATORAÇÃO v1.6.0 (período dinâmico, 2026-08-31):
   - CLIENTS e PERIOD_START/PERIOD_END eram redeclarados localmente aqui,
     divergindo da SSOT (src/lib/constants.ts, que documenta explicitamente
     "Importar daqui em TODAS as páginas — nunca duplicar"). Trocado por
     import direto de constants.ts.
   - PERIOD_START/PERIOD_END deixam de ser passados fixos pro
     OrbitDashboardProvider — viram valor default de um estado (`period`)
     editável via DateRangeControl. Header.tsx continua só LENDO
     `data.meta.dateRange`/`data.meta.periodLabel` (nada mudou lá nem no
     hook useInstagramOverview) — ele reflete automaticamente o novo
     período assim que o Provider refaz o fetch.
   ========================================================================== */
'use client'
import React, { useState } from 'react'
import { OrbitDashboardProvider, useOrbitDashboard } from '@/context/OrbitDashboardContext'
import { CLIENTS, PERIOD_START, PERIOD_END } from '@/lib/constants'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/kpi/KPICard'
import { QualityScoresPanel } from '@/components/content/QualityScoresPanel'
import { FormatPerformanceTable } from '@/components/content/FormatPerformanceTable'
import { InsightCard } from '@/components/content/InsightCard'
import { CriticalAlert } from '@/components/content/CriticalAlert'
import { AudienceSummaryPanel } from '@/components/content/AudienceSummaryPanel'
import { GlassCard } from '@/components/common/GlassCard'
import { DateRangeControl, type PeriodRange } from '@/components/common/DateRangeControl'
import styles from './InstagramOverviewPage.module.css'

import type {
  KPICardData as KPI,
  InsightData as Insight,
  CriticalAlertData as Alert,
} from '@/types/orbit'

export default function InstagramOverviewPage() {
  const clientIds = Object.keys(CLIENTS) as (keyof typeof CLIENTS)[]
  const [activeClientKey, setActiveClientKey] = useState<keyof typeof CLIENTS>(clientIds[0])
  const activeClient = CLIENTS[activeClientKey]

  const [period, setPeriod] = useState<PeriodRange>({ start: PERIOD_START, end: PERIOD_END })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
        aria-label="Selecionar cliente"
      >
        {clientIds.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {clientIds.map((key) => (
              <button
                key={key}
                onClick={() => setActiveClientKey(key)}
                aria-pressed={activeClientKey === key}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: activeClientKey === key ? 700 : 400,
                  background: activeClientKey === key
                    ? 'rgba(0,200,255,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  color: activeClientKey === key ? '#00c8ff' : '#aaa',
                  transition: 'all 0.15s',
                }}
              >
                {CLIENTS[key].label}
              </button>
            ))}
          </div>
        )}

        <DateRangeControl value={period} onChange={setPeriod} minDate={PERIOD_START} maxDate={PERIOD_END} />
      </nav>

      <OrbitDashboardProvider
        key={activeClient.id}
        clientId={activeClient.id}
        periodStart={period.start}
        periodEnd={period.end}
        initialActiveTab="overview"
      >
        <InstagramOverviewLayout />
      </OrbitDashboardProvider>
    </div>
  )
}

function InstagramOverviewLayout() {
  const { data, status, error, activeTab } = useOrbitDashboard()

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.rightPane}>
        <Header />

        <main className={styles.main} id="main-content">
          {/* LOADING */}
          {status === 'loading' && (
            <div className={styles.stateCenter} aria-live="polite" aria-label="Carregando dados">
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.2s' }} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.4s' }} />
            </div>
          )}

          {/* ERRO */}
          {status === 'error' && error && (
            <div className={styles.stateCenter} role="alert">
              <p className={styles.errorText}>Erro ao carregar dados: ⚠️ {error}</p>
            </div>
          )}

          {/* SUCESSO */}
          {status === 'success' && data && (
            <>
              {/* TELA 1 — Visão Geral */}
              {activeTab === 'overview' && (
                <>
                  <section className={styles.kpiRow} aria-label="KPIs principais">
                    {data.kpis.map((kpi: KPI) => (
                      <KPICard key={kpi.id} data={kpi} />
                    ))}
                  </section>

                  <section className={styles.midRow} aria-label="Análise de conteúdo">
                    <QualityScoresPanel scores={data.qualityScores} />
                    <GlassCard glowColor="cyan" className={styles.rightPanel}>
                      <FormatPerformanceTable rows={data.formatPerformance} />
                      {data.insights.length > 0 && (
                        <div className={styles.insightStack}>
                          {data.insights.map((insight: Insight) => (
                            <InsightCard key={insight.id} insight={insight} />
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </section>
                </>
              )}

              {/* TELA 2 — Por post */}
              {activeTab === 'por-post' && (
                <section className={styles.midRow} aria-label="Dados detalhados por postagem">
                  <GlassCard glowColor="cyan">
                    <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
                      Métricas Agregadas por Formato
                    </h3>
                    <FormatPerformanceTable rows={data.formatPerformance} />
                  </GlassCard>
                </section>
              )}

              {/* TELA 3 — Audiência ✅ NOVO */}
              {activeTab === 'audiencia' && (
                <>
                  {/* ✅ AudienceSummaryPanel renderizado aqui */}
                  {data.audienceSummary && (
                    <AudienceSummaryPanel summary={data.audienceSummary} />
                  )}

                  <section className={styles.midRow} aria-label="Análise de público e seguidores">
                    <QualityScoresPanel scores={data.qualityScores} />
                    <GlassCard glowColor="cyan">
                      <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
                        🌀 Funil de E-commerce &amp; Simulador Dinâmico
                      </h3>
                      <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>
                        Métricas baseadas nos dados coletados e estruturados.
                      </p>
                      <h3 style={{ color: '#fff', marginTop: '2rem' }}>
                        👤 Avatar Alignment (Persona Psicográfica)
                      </h3>
                      <p style={{ color: '#aaa', marginTop: '0.5rem' }}>
                        Dados de audiência carregados via pipeline L0/L1.
                      </p>
                    </GlassCard>
                  </section>
                </>
              )}

              {/* Alertas críticos */}
              {data.criticalAlerts.length > 0 && (
                <section className={styles.alertRow} aria-label="Alertas críticos">
                  {data.criticalAlerts.map((alert: Alert) => (
                    <CriticalAlert key={alert.id} alert={alert} />
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
