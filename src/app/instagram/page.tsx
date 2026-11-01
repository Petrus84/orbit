"use client";
import { userErrorMessage } from "@/lib/userErrorMessage";
import { useState } from "react";
import {
  OrbitDashboardProvider,
  useOrbitDashboard,
} from "@/context/OrbitDashboardContext";
import { CLIENTS, PERIOD_START, getPeriodEnd } from "@/lib/constants";
import { useClientNow } from "@/hooks/useClientNow";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppShell } from "@/components/layout/AppShell";
import { Header } from "@/components/layout/Header";
import KPICard, { type KPI } from "@/components/kpi/KPICard";
import { QualityScoresPanel } from "@/components/content/QualityScoresPanel";
import { FormatPerformanceTable } from "@/components/content/FormatPerformanceTable";
import { InsightCard } from "@/components/content/InsightCard";
import { CriticalAlert } from "@/components/content/CriticalAlert";
import { AudienceSummaryPanel } from "@/components/content/AudienceSummaryPanel";
import { WatchTimePanel } from "@/components/content/WatchTimePanel";
import { DataStatusNotice } from "@/components/content/DataStatusNotice";
import { SectorPositioningPanel } from "@/components/panels/SectorPositioningPanel";
import { PostingProfilePanel } from "@/components/panels/PostingProfilePanel";
import { GlassCard } from "@/components/common/GlassCard";
import type { PeriodRange } from "@/components/common/DateRangeControl";
import { ClientPeriodBar } from "@/components/layout/ClientPeriodBar";
import styles from "./InstagramOverviewPage.module.css";

import type {
  KPICardData,
  InsightData as Insight,
  CriticalAlertData as Alert,
} from "@/types/orbit";

// KPICardData (SSOT em src/types/orbit.ts) e KPI (contrato do componente
// KPICard) têm formas diferentes — este mapper faz a ponte entre os dois.
function mapKPICardDataToKPI(data: KPICardData): KPI {
  return {
    label: data.label,
    // Dado ausente aparece como "—", nunca como 0 (KPICard.formatValue repassa string).
    value: data.valueMissing ? "—" : data.value,
    ...(data.valueFormat ? { valueFormat: data.valueFormat } : {}),
    delta: data.delta,
    trend: data.delta > 0 ? "up" : data.delta < 0 ? "down" : "neutral",
    // FIX (19/09/2026): fallback era 'L0' — mostrava badge verde "Medido"
    // quando sourceLevel vem null/undefined, ou seja, quando na verdade não
    // sabemos a origem do dado. O fallback correto pro pior caso é 'L2'
    // (Hipótese), não o melhor. Ver KPICard.tsx FLAG_TOKENS.
    flagLevel: (data.sourceLevel as "L0" | "L1" | "L2") || "L2",
    ...(data.unit ? { unit: data.unit } : {}),
    ...(data.hasComparison === false ? { hasComparison: false } : {}),
    ...(data.provenance ? { provenance: data.provenance } : {}),
  };
}

export default function InstagramOverviewPage() {
  const clientIds = Object.keys(CLIENTS) as (keyof typeof CLIENTS)[];
  const [activeClientKey, setActiveClientKey] = useState<keyof typeof CLIENTS>(
    clientIds[0] ?? "cpimportstore",
  );
  const activeClient = CLIENTS[activeClientKey];

  // FIX v1.0.2 (ripple effect de src/lib/constants.ts): PERIOD_END não existe
  // mais como constante — "agora" só é seguro depois do mount no cliente.
  // useClientNow() retorna null no SSR/primeiro render do cliente (idênticos,
  // sem mismatch) e só preenche o valor real depois do useEffect;
  // getPeriodEnd() é o fallback estável até lá.
  const clientNow = useClientNow();
  const periodEnd = clientNow ?? getPeriodEnd();

  const [period, setPeriod] = useState<PeriodRange>({
    start: PERIOD_START,
    end: periodEnd,
  });

  const minDate = PERIOD_START;
  const maxDate = periodEnd;

  return (
    <OrbitDashboardProvider
      key={activeClient.id}
      clientId={activeClient.id}
      periodStart={period.start}
      periodEnd={period.end}
      initialActiveTab="overview"
    >
      <AppShell sidebar={<Sidebar />}>
        <div className={styles.page}>
          <ClientPeriodBar
            activeKey={activeClientKey}
            onSelect={setActiveClientKey}
            period={{
              value: period,
              onChange: setPeriod,
              minDate,
              maxDate,
            }}
          />
          <InstagramOverviewLayout />
        </div>
      </AppShell>
    </OrbitDashboardProvider>
  );
}

function InstagramOverviewLayout() {
  const { data, status, error, activeTab } = useOrbitDashboard();

  return (
    <div className={styles.rightPane}>
      <Header />

      <main className={styles.main} id="main-content">
        {/* LOADING */}
        {status === "loading" && (
          <div
            className={styles.stateCenter}
            aria-live="polite"
            aria-label="Carregando dados"
          >
            <span className={styles.loadingDot} />
            <span
              className={styles.loadingDot}
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className={styles.loadingDot}
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        )}

        {/* ERRO */}
        {status === "error" && error && (
          <div className={styles.stateCenter} role="alert">
            <p className={styles.errorText}>
              Não foi possível carregar: ⚠️ {userErrorMessage(error)}
            </p>
          </div>
        )}

        {/* SUCESSO */}
        {status === "success" && data && (
          <>
            <DataStatusNotice notices={data.dataStatusNotices ?? []} />

            {/* TELA 1 — Visão Geral */}
            {activeTab === "overview" && (
              <>
                <section
                  className={`${styles.kpiRow} ${data.kpis.length > 4 ? styles.kpiRowExpanded : ""}`}
                  aria-label="KPIs principais"
                >
                  {data.kpis.map((kpi: KPICardData) => (
                    <KPICard key={kpi.id} kpi={mapKPICardDataToKPI(kpi)} />
                  ))}
                </section>

                <section
                  className={styles.midRow}
                  aria-label="Análise de conteúdo"
                >
                  <QualityScoresPanel scores={data.qualityScores} />
                  <GlassCard glowColor="none" className={styles.rightPanel}>
                    <FormatPerformanceTable
                      rows={data.formatPerformance}
                      expandable={false}
                    />
                    {data.insights.length > 0 && (
                      <div className={styles.insightStack}>
                        {data.insights.map((insight: Insight) => (
                          <InsightCard key={insight.id} insight={insight} />
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </section>

                {/* Tempo assistido por Reel: só aparece com dado suficiente
                    (≥ 3 Reels com tempo médio informado). */}
                {data.watchTime && (
                  <section
                    className={styles.tabContent}
                    aria-label="Tempo assistido por Reel"
                  >
                    <WatchTimePanel watchTime={data.watchTime} />
                  </section>
                )}
              </>
            )}

            {/* TELA 2 — Por post
                  ✅ CORRIGIDO 06/09/2026: usa `tabContent` (flex de largura cheia),
                  não `midRow` (grid de 2 colunas da Visão Geral).
                  ✅ RWP-3 (06/10/2026): PostingProfilePanel mora aqui, depois da
                  tabela de formatos. Cadência e mix são contagem de posts. */}
            {activeTab === "por-post" && (
              <section
                className={styles.tabContent}
                aria-label="Dados detalhados por postagem"
              >
                <GlassCard glowColor="cyan">
                  <h3
                    style={{
                      color: "var(--text-primary)",
                      marginBottom: "1rem",
                    }}
                  >
                    Métricas Agregadas por Formato
                  </h3>
                  <FormatPerformanceTable rows={data.formatPerformance} />
                </GlassCard>

                <PostingProfilePanel
                  cadence={data.cadence}
                  mix={data.mix}
                  benchmark={data.benchmarkCadence}
                />
              </section>
            )}

            {/* TELA 3 — Audiência ✅ NOVO */}
            {activeTab === "audiencia" && (
              <div className={styles.tabContent}>
                {/* Painel de Posicionamento */}
                {data.positioning && (
                  <SectorPositioningPanel positioning={data.positioning} />
                )}

                {/* Painel de Resumo de Audiência */}
                {data.audienceSummary && (
                  <AudienceSummaryPanel
                    summary={data.audienceSummary}
                    // Injetando as expectativas do banco de dados:
                    expectedGenderCategory={
                      data.onboarding?.avatar_expected_gender
                    }
                    expectedGenderPct={
                      data.onboarding?.avatar_expected_gender_pct
                    }
                  />
                )}
              </div>
            )}

            {/* Alertas críticos */}
            {data.criticalAlerts.length > 0 && (
              <section
                className={styles.alertRow}
                aria-label="Alertas críticos"
              >
                {data.criticalAlerts.map((alert: Alert) => (
                  <CriticalAlert key={alert.id} alert={alert} />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
