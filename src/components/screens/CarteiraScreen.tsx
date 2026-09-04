/**
 * ============================================================================
 * CarteiraScreen — Integração Completa 04/09/2026
 * ============================================================================
 *
 * v2.0.0 (integração snapshot + alertas — 04/09/2026):
 * - ✅ Importações completas (ClientCard, AlertCard, Semaphore, etc.)
 * - ✅ Funções auxiliares (ErrorState, CardSkeleton, EmptyState)
 * - ✅ Lógica de useClients() e useAlerts('critical')
 * - ✅ Merge de dados: clientes + alertas críticos
 * - ✅ Default export
 *
 * v1.0.0 (estrutura base):
 * Tela de carteira de clientes com grid responsivo.
 * ============================================================================
 */

import React from 'react'
import SectionHead from '@/components/common/SectionHead'
import ClientCard from '@/components/common/ClientCard'
import AlertCard from '@/components/common/AlertCard'
import type { Client } from '@/types/client'
import type { Alert } from '@/types/alert'
import type { UseAlertsReturn } from '@/hooks/useAlerts'
import type { UseClientsResult } from '@/types/orbit'

// ─── Loading skeleton ────────────────────────────────────────

function CardSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-900/50 p-4 animate-pulse">
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

// ─── Error state ────────────────────────────────────────────

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

// ─── Empty state ────────────────────────────────────────────

function EmptyState(): React.ReactElement {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/20 py-12">
      <p className="font-sans text-sm text-zinc-500">Nenhum cliente na carteira.</p>
    </div>
  )
}

// ─── Screen ─────────────────────────────────────────────────

interface CarteiraScreenProps {
  useClients: () => UseClientsResult
  useAlerts: (filter?: 'critical' | 'warning' | 'info') => UseAlertsReturn
}

function CarteiraScreen({
  useClients,
  useAlerts,
}: CarteiraScreenProps): React.ReactElement {
  const { data, status, error, refetch } = useClients()
  const { data: criticalAlerts, refetch: refetchAlerts } = useAlerts('critical')

  const clients: Client[] = data ?? []
  const isLoading = status === 'loading' || status === 'idle'

  // Contadores para o cabeçalho
  const clientsWithAlerts = clients.filter((c) =>
    criticalAlerts.some((a) => a.clientId === c.id)
  ).length
  const totalAlerts = criticalAlerts.length

  const subtitle =
    status === 'success'
      ? `${clients.length} cliente${clients.length !== 1 ? 's' : ''} ativo${clients.length !== 1 ? 's' : ''}${
          clientsWithAlerts > 0
            ? ` · ${clientsWithAlerts} com alerta${clientsWithAlerts !== 1 ? 's' : ''}`
            : ''
        }${
          totalAlerts > 0
            ? ` · ${totalAlerts} alerta${totalAlerts !== 1 ? 's' : ''} crítico${totalAlerts !== 1 ? 's' : ''}`
            : ''
        }`
      : undefined

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-zinc-950 px-4 py-6 sm:px-6">
      <SectionHead title="Carteira de clientes" subtitle={subtitle} />

      {/* Grade de clientes */}
      {status === 'error' && error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          role="status"
          aria-label="Carregando clientes"
        >
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => {
            // ✅ Filtra alertas críticos mantendo compatibilidade com camelCase e snake_case
            const clientAlerts = criticalAlerts.filter(
              (a: any) => (a.clientId ?? a.client_id) === client.id
            )

            return (
              <div key={client.id} className="flex flex-col gap-2">
                {/* ✅ ClientCard com dados de snapshot */}
                <ClientCard
                  client={client}
                  healthStatus={client.status}
                  snapshotCount={client.snapshotCount}
                  lastSnapshotDate={client.lastSnapshotDate}
                />

                {/* ✅ Alertas críticos do cliente */}
                {clientAlerts.length > 0 && (
                  <div className="flex flex-col gap-1.5 pl-1">
                    {clientAlerts.map((alert: Alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onAcknowledge={() => refetchAlerts()}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Seção de alertas críticos globais */}
      {criticalAlerts.length > 0 && (
        <section
          className="mt-6 flex flex-col gap-2 border-t border-zinc-800 pt-4"
          aria-label="Alertas críticos globais"
        >
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Alertas urgentes (todos os clientes)
          </p>
          <div className="flex flex-col gap-2">
            {criticalAlerts.map((alert: Alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={() => refetchAlerts()}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

export default CarteiraScreen