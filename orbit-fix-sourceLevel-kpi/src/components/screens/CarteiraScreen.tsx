import React, { useState } from 'react'
import styles from './CarteiraScreen.module.css'
import SectionHead from '@/components/common/SectionHead'
import ClientCard from '@/components/common/ClientCard'
import AlertCard from '@/components/common/AlertCard'
import type { Client } from '@/types/client'
import type { UseAlertsReturn } from '@/hooks/useAlerts'
import type { UseClientsResult } from '@/types/orbit'

// ─── Filter tabs (paridade com screen-carteira do protótipo) ──

type FilterTab = 'all' | 'critical' | 'healthy'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'critical', label: 'Críticos' },
  { id: 'healthy', label: 'Saudáveis' },
]

// ─── Loading skeleton ────────────────────────────────────────

function CardSkeleton(): React.ReactElement {
  return (
    <div className={styles.cardSkeleton}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonInfo}>
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLineSmall} />
        </div>
        <div className={styles.skeletonDot} />
      </div>
      <div className={styles.skeletonDivider} />
      <div className={styles.skeletonGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonItem}>
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonValue} />
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
    <div className={styles.errorState}>
      <p className={styles.errorMessage}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={styles.retryButton}
      >
        Tentar novamente
      </button>
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────

function EmptyState({ tab }: { tab: FilterTab }): React.ReactElement {
  const messages: Record<FilterTab, string> = {
    all: 'Nenhum cliente na carteira.',
    critical: 'Nenhum cliente crítico no momento.',
    healthy: 'Nenhum cliente saudável no momento.',
  }
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyMessage}>{messages[tab]}</p>
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
  // PR-B / N9: "Com alerta" e os AlertCards embaixo de cada ClientCard são
  // sobre alertas em geral (qualquer severity) — precisam de useAlerts()
  // sem filtro. "Alertas críticos" + a seção "urgentes" continuam restritos
  // a useAlerts('critical'). Antes, os dois liam da mesma chamada filtrada
  // e "Com alerta" só contava cliente com alerta crítico.
  const { data: allAlerts, refetch: refetchAllAlerts } = useAlerts()
  const { data: criticalAlerts, refetch: refetchCriticalAlerts } = useAlerts('critical')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const allClients: Client[] = data ?? []
  const clients: Client[] =
    activeTab === 'all'
      ? allClients
      : allClients.filter((c) => c.status === activeTab)
  const isLoading = status === 'loading' || status === 'idle'

  const clientsWithAlerts = allClients.filter((c) =>
    allAlerts.some((a) => a.clientId === c.id)
  ).length
  const totalAlerts = criticalAlerts.length

  const refetchAlerts = (): void => {
    refetchAllAlerts()
    refetchCriticalAlerts()
  }

  const subtitle =
    status === 'success'
      ? `${allClients.length} cliente${allClients.length !== 1 ? 's' : ''} ativo${allClients.length !== 1 ? 's' : ''}${
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
    <main className={styles.main}>
      <div className={styles.headRow}>
        <SectionHead
          title="Carteira de clientes"
          {...(subtitle !== undefined ? { subtitle } : {})}
        />
        {/* PR-F (parcial) / TS2375: `subtitle` é `string | undefined`
            (calculado condicionalmente acima), mas SectionHeadProps.subtitle
            é opcional sob exactOptionalPropertyTypes — passar
            subtitle={undefined} explicitamente não é o mesmo que omitir a
            prop. Spread condicional garante que a chave só existe quando
            há valor. */}

        <div
          className={styles.tabsContainer}
          role="tablist"
          aria-label="Filtrar carteira"
        >
          <div className={styles.tabsList}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tab} ${
                  activeTab === tab.id ? styles.tabActive : styles.tabInactive
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardNeutral}`}>
          <p className={styles.kpiLabel}>Clientes ativos</p>
          <p className={styles.kpiValue}>{allClients.length}</p>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardWarning}`}>
          <p className={styles.kpiLabel}>Com alerta</p>
          <p className={`${styles.kpiValue} ${styles.kpiValueWarning}`}>{clientsWithAlerts}</p>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardCritical}`}>
          <p className={styles.kpiLabel}>Alertas críticos</p>
          <p className={`${styles.kpiValue} ${styles.kpiValueError}`}>{totalAlerts}</p>
        </div>
      </div>

      {status === 'error' && error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : isLoading ? (
        <div
          className={styles.skeletonsGrid}
          role="status"
          aria-label="Carregando clientes"
        >
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className={styles.clientsGrid}>
          {clients.map((client: Client) => {
            const clientAlerts = allAlerts.filter((a) => a.clientId === client.id)

            return (
              <div key={client.id} className={styles.clientWrapper}>
                <ClientCard
                  client={client}
                  healthStatus={client.status}
                  {...(client.snapshotCount !== undefined
                    ? { snapshotCount: client.snapshotCount }
                    : {})}
                  {...(client.lastSnapshotDate !== undefined
                    ? { lastSnapshotDate: client.lastSnapshotDate }
                    : {})}
                />
                {/* PR-F (parcial) / TS2375: snapshotCount?: number e
                    lastSnapshotDate?: string | null em Client — ambos podem
                    vir `undefined`. `healthStatus` fica direto porque
                    `client.status: ClientHealthStatus` nunca é undefined. */}

                {clientAlerts.length > 0 && (
                  <div className={styles.alertsContainer}>
                    {clientAlerts.map((alert) => (
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

      {criticalAlerts.length > 0 && (
        <section
          className={styles.globalAlertsSection}
          aria-label="Alertas críticos globais"
        >
          <div className={styles.globalAlertsHeader}>
            <p className={styles.globalAlertsLabel}>
              Alertas urgentes (todos os clientes)
            </p>
            <span className={styles.globalAlertsBadge}>
              {criticalAlerts.length}
            </span>
          </div>
          <div className={styles.globalAlertsList}>
            {criticalAlerts.map((alert) => (
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