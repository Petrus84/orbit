import React, { useState } from 'react'
import SectionHead from '../common/SectionHead'
import AlertCard from '../common/AlertCard'
// 🐛 CORRIGIDO: importava `Alert` de '../common/AlertCard'. AlertCard é um
// componente de UI, não deveria re-exportar tipo de domínio — e o `Alert`
// que ele exportava lá era uma versão fabricada, incompatível com o
// contrato real (ver AlertCard.tsx). Fonte correta é o barrel de tipos.
import type { Alert } from '../../types/alert'
import type { UseAlertsReturn } from '../../hooks/useAlerts'

// ─── Filter tabs ──────────────────────────────────────────────

type FilterTab = 'all' | 'critical' | 'warning' | 'info'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'critical', label: 'Críticos' },
  { id: 'warning', label: 'Atenção' },
  { id: 'info', label: 'Info' },
]

const TAB_ACTIVE: Record<FilterTab, string> = {
  all: 'bg-zinc-700 text-white',
  critical: 'bg-red-500/20 text-red-400 border border-red-500/40',
  warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  info: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
}

// ─── Skeleton ─────────────────────────────────────────────────

function AlertSkeleton(): React.ReactElement {
  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 animate-pulse">
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <div className="h-5 w-5 rounded bg-zinc-800" />
        <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex justify-between gap-2">
          <div className="h-3.5 w-48 rounded bg-zinc-800" />
          <div className="h-2.5 w-10 rounded bg-zinc-800" />
        </div>
        <div className="h-2.5 w-full rounded bg-zinc-800" />
        <div className="h-2.5 w-3/4 rounded bg-zinc-800" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-24 rounded-full bg-zinc-800" />
          <div className="h-6 w-20 rounded-full bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────

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

// ─── Empty state ──────────────────────────────────────────────

function EmptyState({ tab }: { tab: FilterTab }): React.ReactElement {
  const messages: Record<FilterTab, string> = {
    all: 'Nenhum alerta encontrado.',
    critical: 'Nenhum alerta crítico. Tudo certo por aqui.',
    warning: 'Nenhum alerta de atenção no momento.',
    info: 'Nenhuma informação pendente.',
  }
  return (
    <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/20 py-12">
      <p className="font-sans text-sm text-zinc-500">{messages[tab]}</p>
    </div>
  )
}

// ─── Badge counter ────────────────────────────────────────────

function TabBadge({ count, tab }: { count: number; tab: FilterTab }): React.ReactElement | null {
  if (count === 0) return null
  const colors: Record<FilterTab, string> = {
    all: 'bg-zinc-600 text-zinc-300',
    critical: 'bg-red-500/30 text-red-400',
    warning: 'bg-amber-500/30 text-amber-400',
    info: 'bg-blue-500/30 text-blue-400',
  }
  return (
    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${colors[tab]}`}>
      {count}
    </span>
  )
}

// ─── Screen ───────────────────────────────────────────────────

interface AlertasScreenProps {
  useAlerts: (filter?: 'critical' | 'warning' | 'info') => UseAlertsReturn
}

export default function AlertasScreen({ useAlerts }: AlertasScreenProps): React.ReactElement {
  // 🐛 CORRIGIDO: a versão anterior desestruturava `{ alerts, status, error, refetch }`.
  // O hook real (useAlerts.ts) devolve `data`, não `alerts` — e também já
  // devolve `counts` pronto, então não precisa recalcular com 3x .filter().
  const { data: alerts, counts, status, error, refetch } = useAlerts()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const tabCounts: Record<FilterTab, number> = {
    all: counts.total,
    critical: counts.critical,
    warning: counts.warning,
    info: counts.info,
  }

  const visibleAlerts: Alert[] =
    activeTab === 'all' ? alerts : alerts.filter((a) => a.severity === activeTab)

  // 🐛 CORRIGIDO: a versão anterior ordenava por `a.acknowledged` e
  // `a.triggeredAt` — nenhum dos dois existe em `Alert` (nem na tabela
  // orbit.alerts). Os campos reais são `isResolved` (boolean) e
  // `createdAt` (string). Critério: não-resolvidos primeiro, depois mais
  // recentes primeiro.
  const sortedAlerts = [...visibleAlerts].sort((a, b) => {
    if (a.isResolved !== b.isResolved) return a.isResolved ? 1 : -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const subtitle =
    status === 'success'
      ? `${counts.total} alerta${counts.total !== 1 ? 's' : ''}${
          counts.critical > 0 ? ` · ${counts.critical} crítico${counts.critical !== 1 ? 's' : ''}` : ''
        }`
      : undefined

  const isLoading = status === 'idle' || status === 'loading'

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead title="Central de alertas" subtitle={subtitle} />

      <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Filtrar alertas">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? TAB_ACTIVE[tab.id]
                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {!isLoading && <TabBadge count={tabCounts[tab.id]} tab={tab.id} />}
          </button>
        ))}
      </div>

      {status === 'error' && error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando alertas">
          {[0, 1, 2, 3].map((i) => (
            <AlertSkeleton key={i} />
          ))}
        </div>
      ) : sortedAlerts.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="flex flex-col gap-3" role="tabpanel">
          {sortedAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onAcknowledge={async () => refetch()} />
          ))}
        </div>
      )}
    </main>
  )
}