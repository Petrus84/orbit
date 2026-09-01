import React from 'react'
import { useParams } from 'next/navigation'
import SectionHead from '@/components/common/SectionHead'
import KPICard from '@/components/common/KPICard'
import QualityScoreCard from '@/components/common/QualityScoreCard'
import PerformanceTable from '@/components/common/PerformanceTable'
import DiagnosticAlert from '@/components/common/DiagnosticAlert'
import { AudienceSummaryPanel } from '@/components/content/AudienceSummaryPanel'

import type { KPI } from '@/components/common/KPICard'
import type { QualityScore } from '@/components/common/QualityScoreCard'
import type { PerformanceMetric } from '@/components/common/PerformanceTable'
import type { DiagnosticAlertData } from '@/components/common/DiagnosticAlert'
import type {
  IGOverviewData,
  KPICardData,
  QualityScoreItem,
  FormatPerformanceRow,
  CriticalAlertData,
  AudienceSummary,
} from '@/types/orbit'

interface UseIGOverviewResult {
  data: IGOverviewData | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  refetch: () => void
}

interface IGOverviewScreenProps {
  useIGOverview: (clientId: string) => UseIGOverviewResult
}

// ─── Mappers (transformam SSOT → componentes) ──────────────────────

function mapKPICardDataToKPI(data: KPICardData): KPI {
  return {
    label: data.label,
    value: data.value,
    delta: data.delta,
    trend: data.delta > 0 ? 'up' : data.delta < 0 ? 'down' : 'neutral',
    flagLevel: (data.sourceLevel as 'L0' | 'L1' | 'L2') || 'L0',
    unit: data.unit ?? undefined,
  }
}

function mapQualityScoreItemToQualityScore(data: QualityScoreItem): QualityScore {
  const statusMap: Record<string, 'ok' | 'neutral' | 'warn'> = {
    ok: 'ok',
    warn: 'warn',
    neutral: 'neutral',
  }
  return {
    label: data.label,
    value: typeof data.value === 'number' ? data.value : null,
    status: statusMap[data.statusVariant] || 'neutral',
    statusText: data.statusText,
  }
}

function mapFormatPerformanceRowToMetric(data: FormatPerformanceRow): PerformanceMetric {
  return {
    format: data.format,
    postCount: data.posts,
    shareCount: data.shares,
    trend: data.trendLabel,
    trendColor: data.trendColor === 'none' ? undefined : (data.trendColor as 'cyan' | 'red' | 'gold' | undefined),
  }
}

function mapCriticalAlertToDiagnostic(data: CriticalAlertData): DiagnosticAlertData | null {
  if (data.severity === 'success' || data.severity === 'info') {
    return null
  }
  return {
    id: data.id,
    title: data.title,
    body: data.body,
    severity: data.severity as 'critical' | 'warning',
  }
}

// ─── Skeletons ────────────────────────────────────────────────────

function KPISkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#18181F] p-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-2.5 w-24 rounded bg-zinc-800" />
        <div className="h-4 w-6 rounded-full bg-zinc-800" />
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-28 rounded bg-zinc-800" />
          <div className="h-2.5 w-20 rounded bg-zinc-800" />
        </div>
        <div className="h-6 w-16 rounded bg-zinc-800" />
      </div>
    </div>
  )
}

function ScoreSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#18181F] p-4 animate-pulse">
      <div className="h-2.5 w-32 rounded bg-zinc-800" />
      <div className="h-8 w-20 rounded-xl bg-zinc-800" />
      <div className="flex gap-1.5 items-center">
        <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
        <div className="h-2.5 w-28 rounded bg-zinc-800" />
      </div>
    </div>
  )
}

function TableSkeleton(): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#18181F] animate-pulse">
      <div className="border-b border-zinc-800 px-4 py-2.5">
        <div className="h-2.5 w-48 rounded bg-zinc-800" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-4 gap-2 border-b border-zinc-800/60 px-4 py-3">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-8 rounded bg-zinc-800" />
          <div className="h-3 w-8 rounded bg-zinc-800" />
          <div className="h-3 w-12 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}

function AudienceSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-cyan-500/20 bg-cyan-900/10 p-6 animate-pulse">
      <div className="h-4 w-48 rounded bg-zinc-800" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-2.5 w-20 rounded bg-zinc-800" />
            <div className="h-6 w-16 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertSkeletonRow(): React.ReactElement {
  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-800 bg-[#18181F] p-4 animate-pulse">
      <div className="h-6 w-6 rounded-full bg-zinc-800 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-40 rounded bg-zinc-800" />
        <div className="h-2.5 w-full rounded bg-zinc-800" />
        <div className="h-2.5 w-3/4 rounded bg-zinc-800" />
        <div className="h-6 w-28 rounded-full bg-zinc-800" />
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-600">
      {children}
    </p>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-900/10 p-8 text-center">
      <p className="font-sans text-sm text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-red-500/40 bg-red-500/20 px-4 py-1.5 font-sans text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
      >
        Tentar novamente
      </button>
    </div>
  )
}

// ─── Main Screen ───────────────────────────────────────────────────

export default function IGOverviewScreen({ useIGOverview }: IGOverviewScreenProps): React.ReactElement {
  const { clientId = '' } = useParams<{ clientId: string }>()
  const { data, status, error, refetch } = useIGOverview(clientId)

  const isLoading = status === 'idle' || status === 'loading'

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead
        title="Instagram · Visão Geral"
        subtitle={status === 'success' ? 'Últimos 90 dias' : undefined}
      />

      {status === 'error' && error && (
        <ErrorState message={error} onRetry={refetch} />
      )}

      {/* ── KPI Cards ── */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Indicadores principais</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? [0, 1, 2, 3].map((i) => <KPISkeleton key={i} />)
            : (data?.kpis ?? []).map((kpiData: KPICardData) => (
                <KPICard key={kpiData.label} kpi={mapKPICardDataToKPI(kpiData)} />
              ))}
        </div>
      </section>

      {/* ── Quality Scores ── */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Scores de qualidade</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? [0, 1, 2, 3].map((i) => <ScoreSkeleton key={i} />)
            : (data?.qualityScores ?? []).map((scoreData: QualityScoreItem) => (
                <QualityScoreCard
                  key={scoreData.label}
                  score={mapQualityScoreItemToQualityScore(scoreData)}
                />
              ))}
        </div>
      </section>

      {/* ── Performance Table ── */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Performance por formato</SectionLabel>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <PerformanceTable
            metrics={(data?.formatPerformance ?? []).map(mapFormatPerformanceRowToMetric)}
          />
        )}
      </section>

      {/* ── Audience Summary ── */}
      {isLoading ? (
        <AudienceSkeleton />
      ) : data?.audienceSummary ? (
        <AudienceSummaryPanel summary={data.audienceSummary} />
      ) : null}

      {/* ── Critical Alerts ── */}
      {(isLoading || (data?.criticalAlerts ?? []).length > 0) && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Alertas</SectionLabel>
          <div className="flex flex-col gap-2">
            {isLoading
              ? [0, 1, 2].map((i) => <AlertSkeletonRow key={i} />)
              : (data?.criticalAlerts ?? [])
                  .map(mapCriticalAlertToDiagnostic)
                  .filter((alert): alert is DiagnosticAlertData => alert !== null)
                  .map((alert: DiagnosticAlertData, i: number) => (
                    <DiagnosticAlert key={alert.id} alert={alert} index={i + 1} />
                  ))}
          </div>
        </section>
      )}

      {/* ── Insights ── */}
      {(isLoading || (data?.insights ?? []).length > 0) && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Insights</SectionLabel>
          <div className="flex flex-col gap-2">
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-2xl border border-zinc-800 bg-[#18181F] animate-pulse"
                  />
                ))
              : (data?.insights ?? []).map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-2xl border border-blue-500/30 bg-blue-900/20 p-4 text-sm text-blue-200"
                  >
                    {insight.text}
                  </div>
                ))}
          </div>
        </section>
      )}
    </main>
  )
}