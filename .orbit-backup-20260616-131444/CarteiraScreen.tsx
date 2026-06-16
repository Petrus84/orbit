import React from 'react';
import SectionHead from '../common/SectionHead';
import ClientCard from '../common/ClientCard';
import AlertCard from '../common/AlertCard';
import type { Alert } from '../common/AlertCard';

// ─── Hook contract (implemented elsewhere) ───────────────────
// import { useClients } from '../../hooks/useClients';
// Mocked below for standalone compilation; remove mock in real use.

import type { Client } from '../common/ClientCard';



interface UseClientsResult {
  clients: Client[];
  alerts: Alert[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  refetch: () => void;
}

// ─── Loading skeleton ────────────────────────────────────────

function CardSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#18181F] p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-zinc-800" />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-3 w-32 rounded bg-zinc-800" />
          <div className="h-2.5 w-20 rounded bg-zinc-800" />
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
      </div>
      <div className="h-px w-full bg-white/5" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="h-2 w-12 rounded bg-zinc-800" />
            <div className="h-3.5 w-16 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Alert skeleton ──────────────────────────────────────────

function AlertSkeleton(): React.ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-zinc-900/40 border border-zinc-800 p-4 animate-pulse">
      <div className="mt-0.5 h-4 w-4 rounded-full bg-zinc-800" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-40 rounded bg-zinc-800" />
        <div className="h-2.5 w-60 rounded bg-zinc-800" />
        <div className="h-6 w-24 rounded-full bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-red-900/10 border border-red-500/20 p-8 text-center">
      <p className="font-sans text-sm text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-red-500/20 px-4 py-1.5 font-sans text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 border border-red-500/40"
      >
        Tentar novamente
      </button>
    </div>
  );
}

// ─── Screen ──────────────────────────────────────────────────

interface CarteiraScreenProps {
  useClients: () => UseClientsResult;
}

export default function CarteiraScreen({ useClients }: CarteiraScreenProps): React.ReactElement {
  const { clients, alerts, status, error, refetch } = useClients();

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning');

  const subtitle =
    status === 'success'
      ? `${clients.length} cliente${clients.length !== 1 ? 's' : ''} ativo${clients.length !== 1 ? 's' : ''}${
          criticalAlerts.length > 0
            ? ` · ${criticalAlerts.length} alerta${criticalAlerts.length !== 1 ? 's' : ''} crítico${criticalAlerts.length !== 1 ? 's' : ''}`
            : ''
        }`
      : undefined;

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      {/* Header */}
      <SectionHead title="Carteira de clientes" subtitle={subtitle} />

      {/* Client grid */}
      {status === 'error' && error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {status === 'loading' || status === 'idle'
            ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)
            : clients.map((client) => <ClientCard key={client.id} client={client} />)}
        </div>
      )}

      {/* Critical alerts */}
      {status === 'loading' || status === 'idle' ? (
        <div className="flex flex-col gap-2">
          <AlertSkeleton />
          <AlertSkeleton />
        </div>
      ) : criticalAlerts.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Alertas críticos">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Alertas urgentes
          </p>
          <div className="flex flex-col gap-2">
            {criticalAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
