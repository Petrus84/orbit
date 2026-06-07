/* ==========================================================================
   ORBIT · Page — Instagram Overview
   Caminho definitivo: src/app/instagram/page.tsx (App Router)
   Responsabilidade: Apenas montar o Provider + renderizar o layout.
   NENHUMA lógica de negócio aqui — tudo vem do Context.
   Versão: 1.0.0 | Data: 2026-06-02
   ========================================================================== */

'use client'

import React from 'react'
import { OrbitDashboardProvider, useOrbitDashboard } from '../../context/OrbitDashboardContext'
import { Sidebar } from '../../components/layout/Sidebar'
import { Header } from '../../components/layout/Header'
import { KPICard } from '../../components/kpi/KPICard'
import { QualityScoresPanel } from '../../components/content/QualityScoresPanel'
import { FormatPerformanceTable } from '../../components/content/FormatPerformanceTable'
import { InsightCard } from '../../components/content/InsightCard'
import { CriticalAlert } from '../../components/content/CriticalAlert'
import { GlassCard } from '../../components/common/GlassCard'
import styles from './InstagramOverviewPage.module.css'

// ─── Provider Wrapper (Entry Point da Rota /instagram) ────────────────────
export default function InstagramOverviewPage() {
  return (
    <OrbitDashboardProvider
      clientId="cpimportstore"
      periodStart="2026-02-23"
      periodEnd="2026-05-23"
      usePrototypeData={true}
      initialActiveTab="overview"
    >
      <InstagramOverviewLayout />
    </OrbitDashboardProvider>
  )
}

// ─── Layout Interno (Consome o Contexto Analítico) ─────────────────────────
function InstagramOverviewLayout() {
  const { data, status, error } = useOrbitDashboard()

  return (
    <div className={styles.shell}>
      {/* Sidebar — Coluna esquerda, fixa */}
      <Sidebar />

      {/* Área direita: Header + Conteúdo Dinâmico */}
      <div className={styles.rightPane}>
        {/* Header Sticky Superior */}
        <Header />

        {/* Conteúdo principal com scroll independente */}
        <main className={styles.main} id="main-content">
          
          {/* ESTADO: LOADING — Renderização dos três pontos pulsantes */}
          {status === 'loading' && (
            <div className={styles.stateCenter} aria-live="polite" aria-label="Carregando dados">
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.2s' }} />
              <span className={styles.loadingDot} style={{ animationDelay: '0.4s' }} />
            </div>
          )}

          {/* ESTADO: ERRO — Exibição defensiva de falha crítica */}
          {status === 'error' && error && (
            <div className={styles.stateCenter} role="alert">
              <p className={styles.errorText}>Erro ao carregar dados: ⚠ {error}</p>
            </div>
          )}

          {/* ESTADO: SUCESSO — Renderização hidratada do funil de e-commerce */}
          {status === 'success' && data && (
            <>
              {/* Linha 1 — Grade com os 4 KPI Cards Principais */}
              <section className={styles.kpiRow} aria-label="KPIs principais">
                {data.kpis.map((kpi) => (
                  <KPICard key={kpi.id} data={kpi} />
                ))}
              </section>

              {/* Linha 2 — Painel de Controle de Qualidade + Performance por Formato */}
              <section className={styles.midRow} aria-label="Análise de conteúdo">
                {/* Grade 2x2 de Performance Semântica */}
                <QualityScoresPanel scores={data.qualityScores} />

                {/* Direita: Tabela de Performance por Formato + Pilha de Insights */}
                <GlassCard glowColor="cyan" className={styles.rightPanel}>
                  <FormatPerformanceTable rows={data.formatPerformance} />
                  
                  {data.insights.length > 0 && (
                    <div className={styles.insightStack}>
                      {data.insights.map((insight) => (
                        <InsightCard key={insight.id} insight={insight} />
                      ))}
                    </div>
                  )}
                </GlassCard>
              </section>

              {/* Linha 3 — Alertas Críticos do Sistema de Automação (Full-Width) */}
              {data.criticalAlerts.length > 0 && (
                <section className={styles.alertRow} aria-label="Alertas críticos">
                  {data.criticalAlerts.map((alert) => (
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
