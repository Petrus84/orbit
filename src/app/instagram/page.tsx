/* ==========================================================================
   ORBIT · Page — Instagram Overview
   Caminho físico real: src/app/instagram/page.tsx

   CORREÇÃO v1.5.0 (orbit-fix.sh):
   - periodStart/periodEnd: string → Date (Erro TS2322)
   - Ambos os clientes ativos: cpimportstore + eupetruchio84
   - PERIOD_END = new Date() — captura até o post mais recente na base
   - Arquitetura aberta: adicionar clientes em CLIENTS sem mexer em mais nada
   ========================================================================== */
'use client'
import React, { useState } from 'react'
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

import type {
  KPICardData as KPI,
  InsightData as Insight,
  CriticalAlertData as Alert,
} from '@/types/orbit'

const CLIENTS: Record<string, { id: string; label: string }> = {
  cpimportstore: {
    id: '2141d077-0d82-4fda-83df-558377f105ff', 
    label: 'CP Import Store',
  },
  eupetruchio84: {
    id: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7', 
    label: 'Eupetruchio', // <── Alterado para o nome pessoal limpo!
  },
}


// ─── Janela de análise ────────────────────────────────────────────────────────
// Ambos os clientes: jan/2026 → hoje (cobre os últimos 6 meses + margem)
const PERIOD_START = new Date('2026-01-01T00:00:00-03:00')
const PERIOD_END   = new Date()   // post mais recente = agora

// ─── Página ───────────────────────────────────────────────────────────────────

export default function InstagramOverviewPage() {
  const clientIds = Object.keys(CLIENTS)
  const [activeClientKey, setActiveClientKey] = useState<string>(clientIds[0])

  const activeClient = CLIENTS[activeClientKey]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Seletor de cliente — visível apenas quando há mais de 1 */}
      {clientIds.length > 1 && (
        <nav
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
          aria-label="Selecionar cliente"
        >
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
        </nav>
      )}

      <OrbitDashboardProvider
        key={activeClient.id}           /* remonta o contexto ao trocar de cliente */
        clientId={activeClient.id}
        periodStart={PERIOD_START}
        periodEnd={PERIOD_END}
        initialActiveTab="overview"
      >
        <InstagramOverviewLayout />
      </OrbitDashboardProvider>
    </div>
  )
}

// ─── Layout interno ────────────────────────────────────────────────────────────

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

              {/* TELA 3 — Audiência */}
              {activeTab === 'audiencia' && (
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
