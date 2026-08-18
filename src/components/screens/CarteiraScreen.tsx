// src/components/screens/CarteiraScreen.tsx
//
// v2.0.0 (integração real — substitui a versão anterior):
// A versão anterior nunca era renderizada por rota nenhuma (/carteira era
// placeholder estático) e definia sua própria interface local
// `UseClientsResult` (`{clients, alerts, status, error, refetch}`) — uma
// TERCEIRA forma, diferente tanto do UseClientsResult real de orbit.ts
// quanto de qualquer versão anterior do hook. Também importava `Alert`/
// `Client` dos componentes de UI (AlertCard/ClientCard) em vez do barrel
// de tipos, violando o mesmo padrão já corrigido em AlertasScreen.tsx.
//
// Consumo agora, alinhado ao padrão real do projeto (mesma injeção de
// hook via prop que AlertasScreen.tsx/FunnelScreen.tsx já usam):
// - useClients(): UseClientsResult — data: Client[] | null
// - useAlerts(filter): UseAlertsReturn — reaproveitado igual está,
//   filtrado para 'critical'. Não existe hook separado "useClientAlerts";
//   alertsRepository.ts já não filtra por cliente (é cross-client, mesma
//   decisão já registrada em app/alertas/page.tsx), então pedir só os
//   críticos aqui é a forma correta de mostrar "alertas urgentes" na
//   Carteira sem duplicar lógica de fetch.

import React from 'react'
import SectionHead from '../common/SectionHead'
import ClientCard from '../common/ClientCard'
import AlertCard from '../common/AlertCard'
import type { Client, UseClientsResult } from '../../types/client'
import type { Alert } from '../../types/alert'
import type { UseAlertsReturn } from '../../hooks/useAlerts'

// ─── Loading skeletons ───────────────────────────────────────

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
  )
}

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
  )
}

// ─── Error state ─────────────────────────────────────────────

interface ErrorStateProps {
  message: string
  onRetry: () => void
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
  )
}

// ─── Empty state ─────────────────────────────────────────────

function EmptyState(): React.ReactElement {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/20 py-12">
      <p className="font-sans text-sm text-zinc-500">Nenhum cliente na carteira.</p>
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────

interface CarteiraScreenProps {
  useClients: () => UseClientsResult
  useAlerts: (filter?: 'critical' | 'warning' | 'info') => UseAlertsReturn
}

export default function CarteiraScreen({
  useClients,
  useAlerts,
}: CarteiraScreenProps): React.ReactElement {
  const { data, status, error, refetch } = useClients()
  const { data: criticalAlerts, status: alertsStatus } = useAlerts('critical')

  const clients: Client[] = data ?? []
  const isLoading = status === 'loading' || status === 'idle'
  const isAlertsLoading = alertsStatus === 'loading' || alertsStatus === 'idle'

  const subtitle =
    status === 'success'
      ? `${clients.length} cliente${clients.length !== 1 ? 's' : ''} ativo${clients.length !== 1 ? 's' : ''}${
          criticalAlerts.length > 0
            ? ` · ${criticalAlerts.length} alerta${criticalAlerts.length !== 1 ? 's' : ''} crítico${criticalAlerts.length !== 1 ? 's' : ''}`
            : ''
        }`
      : undefined

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#0C0C0F] px-4 py-6 sm:px-6">
      <SectionHead title="Carteira de clientes" subtitle={subtitle} />

      {/* Grade de clientes */}
      {status === 'error' && error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Carregando clientes">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      {/* Alertas críticos */}
      {isAlertsLoading ? (
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
            {criticalAlerts.map((alert: Alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}