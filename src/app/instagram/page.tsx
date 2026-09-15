'use client'
import { useState } from 'react'
import { OrbitDashboardProvider, useOrbitDashboard } from '@/context/OrbitDashboardContext'
import { CLIENTS, PERIOD_START, getPeriodEnd } from '@/lib/constants'
import { useClientNow } from '@/hooks/useClientNow'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import KPICard, { type KPI } from '@/components/kpi/KPICard'
import { QualityScoresPanel } from '@/components/content/QualityScoresPanel'
import { FormatPerformanceTable } from '@/components/content/FormatPerformanceTable'
import { InsightCard } from '@/components/content/InsightCard'
import { CriticalAlert } from '@/components/content/CriticalAlert'
import { AudienceSummaryPanel } from '@/components/content/AudienceSummaryPanel'
import { SectorPositioningPanel } from '@/components/panels/SectorPositioningPanel'
import { GlassCard } from '@/components/common/GlassCard'
import { DateRangeControl, type PeriodRange } from '@/components/common/DateRangeControl'
import styles from './InstagramOverviewPage.module.css'

import type {
KPICardData,
InsightData as Insight,
CriticalAlertData as Alert,
} from '@/types/orbit'

// KPICardData (SSOT em src/types/orbit.ts) e KPI (contrato do componente
// KPICard) têm formas diferentes — este mapper faz a ponte entre os dois.
function mapKPICardDataToKPI(data: KPICardData): KPI {
return {
  label: data.label,
  value: data.value,
  delta: data.delta,
  trend: data.delta > 0 ? 'up' : data.delta < 0 ? 'down' : 'neutral',
  flagLevel: (data.sourceLevel as 'L0' | 'L1' | 'L2') || 'L0',
  ...(data.unit ? { unit: data.unit } : {}),
}
}

export default function InstagramOverviewPage() {
const clientIds = Object.keys(CLIENTS) as (keyof typeof CLIENTS)[]
const [activeClientKey, setActiveClientKey] = useState<keyof typeof CLIENTS>(clientIds[0] ?? 'cpimportstore')
const activeClient = CLIENTS[activeClientKey]

// FIX v1.0.2 (ripple effect de src/lib/constants.ts): PERIOD_END não existe
// mais como constante — "agora" só é seguro depois do mount no cliente.
// useClientNow() retorna null no SSR/primeiro render do cliente (idênticos,
// sem mismatch) e só preenche o valor real depois do useEffect;
// getPeriodEnd() é o fallback estável até lá.
const clientNow = useClientNow()
const periodEnd = clientNow ?? getPeriodEnd()

const [period, setPeriod] = useState<PeriodRange>({ start: PERIOD_START, end: periodEnd })

const minDate = PERIOD_START
const maxDate = periodEnd

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

      {/* ✅ FIX: Passar minDate e maxDate como constantes (não mudam entre servidor/cliente) */}
      <DateRangeControl 
        value={period} 
        onChange={setPeriod} 
        minDate={minDate}
        maxDate={maxDate}
      />
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
                  {data.kpis.map((kpi: KPICardData) => (
                    <KPICard key={kpi.id} kpi={mapKPICardDataToKPI(kpi)} />
                  ))}
                </section>

                <section className={styles.midRow} aria-label="Análise de conteúdo">
                  <QualityScoresPanel scores={data.qualityScores} />
                  <GlassCard glowColor="cyan" className={styles.rightPanel}>
                    <FormatPerformanceTable rows={data.formatPerformance} expandable={false} />
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
              // ✅ CORRIGIDO 06/09/2026: estava usando `styles.midRow`
              // (grid de 2 colunas, feito pra Visão Geral: Scores + Tabela
              // lado a lado). Com só 1 card dentro, ele ocupava metade da
              // tela e a outra metade ficava vazia. `tabContent` (mesma
              // classe que a aba Audiência já usa) é flex de largura cheia.
              <section className={styles.tabContent} aria-label="Dados detalhados por postagem">
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
              <div className={styles.tabContent}>
                {/* Painel de Posicionamento */}
                {data.positioning && (
                  <SectorPositioningPanel positioning={data.positioning} />
                )}

                {/* Painel de Resumo de Audiência */}
                {data.audienceSummary && (
                  <AudienceSummaryPanel summary={data.audienceSummary} />
                )}
              </div>
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