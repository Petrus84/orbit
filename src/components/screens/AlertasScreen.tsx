import React, { useState } from 'react';
import SectionHead from '../common/SectionHead';
import AlertCard from '../common/AlertCard';
import type { Alert } from '../common/AlertCard';

// ─── Hook contract ────────────────────────────────────────────
// Inject via props to keep the screen testable without mocking modules.
// Usage: <AlertasScreen useAlerts={useAlerts} />

interface UseAlertsResult {
  alerts: Alert[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  refetch: () => void;
}

// ─── Filter tabs ──────────────────────────────────────────────

type FilterTab = 'all' | 'critical' | 'warning' | 'info';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'Todos'    },
  { id: 'critical', label: 'Críticos' },
  { id: 'warning',  label: 'Atenção'  },
  { id: 'info',     label: 'Info'     },
];

const TAB_ACTIVE: Record<FilterTab, string> = {
  all:      'bg-zinc-700 text-white',
  critical: 'bg-red-500/20 text-red-400 border border-red-500/40',
  warning:  'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  info:     'bg-blue-500/20 text-blue-400 border border-blue-500/40',
};

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
  );
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
  );
}

// ─── Empty state ──────────────────────────────────────────────

function EmptyState({ tab }: { tab: FilterTab }): React.ReactElement {
  const messages: Record<FilterTab, string> = {
    all:      'Nenhum alerta encontrado.',
    critical: 'Nenhum alerta crítico. Tudo certo por aqui.',
    warning:  'Nenhum alerta de atenção no momento.',
    info:     'Nenhuma informação pendente.',
  };
  return (
    <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/20 py-12">
      <p className="font-sans text-sm text-zinc-500">{messages[tab]}</p>
    </div>
  );
}

// ─── Badge counter ────────────────────────────────────────────

function TabBadge({ count, tab }: { count: number; tab: FilterTab }): React.ReactElement | null {
  if (count === 0) return null;
  const colors: Record<FilterTab, string> = {
    all:      'bg-zinc-600 text-zinc-300',
    critical: 'bg-red-500/30 text-red-400',
    warning:  'bg-amber-500/30 text-amber-400',
    info:     'bg-blue-500/30 text-blue-400',
  };
  return (
    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${colors[tab]}`}>
      {count}
    </span>
  );
}

// ─── Screen ───────────────────────────────────────────────────

interface AlertasScreenProps {
  useAlerts: () => UseAlertsResult;
}

export default function AlertasScreen({ useAlerts }: AlertasScreenProps): React.ReactElement {
  const { alerts, status, error, refetch } = useAlerts();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const counts: Record<FilterTab, number> = {
    all:      alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning:  alerts.filter((a) => a.severity === 'warning').length,
    info:     alerts.filter((a) => a.severity === 'info').length,
  };

  const visibleAlerts =
    activeTab === 'all' ? alerts : alerts.filter((a) => a.severity === activeTab);

  // Sort: unacknowledged first, then by triggeredAt desc
  const sortedAlerts = [...visibleAlerts].sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
  });

  const subtitle =
    status === 'success'
      ? `${counts.all} alerta${counts.all !== 1 ? 's' : ''}${
          counts.critical > 0 ? ` · ${counts.critical} crítico${counts.critical !== 1 ? 's' : ''}` : ''
        }`
      : undefined;

  const isLoading = status === 'idle' || status === 'loading';

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      {/* Header */}
      <SectionHead title="Central de alertas" subtitle={subtitle} />

      {/* Filter tabs */}
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
            {!isLoading && <TabBadge count={counts[tab.id]} tab={tab.id} />}
          </button>
        ))}
      </div>

      {/* Content */}
      {status === 'error' && error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando alertas">
          {[0, 1, 2, 3].map((i) => <AlertSkeleton key={i} />)}
        </div>
      ) : sortedAlerts.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="flex flex-col gap-3" role="tabpanel">
          {sortedAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </main>
  );
}
