/* ==========================================================================
   ORBIT · Page — Instagram Overview (v1.2.0 — FIXES APLICADAS)
   Caminho físico real: src/app/instagram/page.tsx
   Responsabilidade: Entry point da rota /instagram conectado ao Supabase Real.
   ========================================================================== */

'use client'

import React from 'react'
import { OrbitDashboardProvider, useOrbitDashboard } from '@/context/OrbitDashboardContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/kpi/KPICard'
import { QualityScoresPanel } from '@/components/content/QualityScoresPanel'
import { FormatPerformanceTable } from '@/components/content/FormatPerformanceTable'
import { InsightCard } from '@/components/content/InsightCard'
import { CriticalAlert } from '@/components/content/CriticalAlert'
import { GlassCard } from '@/components/common/GlassCard'
import styles from './InstagramOverviewPage.module.css'

// ANTES (Como estava na página v1.2.0 causadora do erro):
// import type { KPI, Insight, Alert } from '@/types/orbit'

// ✅ DEPOIS (Correção de Contrato com Cast de Apelidos Locais):
import type { 
  KPICardData as KPI, 
  InsightData as Insight, 
  CriticalAlertData as Alert 
} from '@/types/orbit'

export default function InstagramOverviewPage() {
  return (
    <OrbitDashboardProvider
      clientId="22222222-2222-2222-2222-222222222222"
      periodStart="2026-02-23"
      periodEnd="2026-06-08"
      usePrototypeData={false}
      initialActiveTab="overview"
    >
      <InstagramOverviewLayout />
    </OrbitDashboardProvider>
  )
}

function InstagramOverviewLayout() {
  const { data, status, error } = useOrbitDashboard()

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.rightPane}>
        <Header />
        
        <main className={styles.main} id="main-content">
          {/* ESTADO: LOADING */}
          {status === 'loading' && (
            <div className={styles.stateCenter} aria-live="polite" aria-label="Carregando dados">
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.2s' }} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.4s' }} />
            </div>
          )}

          {/* ESTADO: ERRO */}
          {status === 'error' && error && (
            <div className={styles.stateCenter} role="alert">
              <p className={styles.errorText}>Erro ao carregar dados: ⚠️ {error}</p>
            </div>
          )}

          {/* ESTADO: SUCESSO */}
          {status === 'success' && data && (
            <>
              {/* Linha 1 — KPIs */}
              <section className={styles.kpiRow} aria-label="KPIs principais">
                {data.kpis.map((kpi: KPI) => (
                  <KPICard key={kpi.id} data={kpi} />
                ))}
              </section>

              {/* Linha 2 — Quality + Performance */}
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

              {/* Linha 3 — Alertas */}
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
