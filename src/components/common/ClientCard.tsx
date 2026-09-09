/**
 * ============================================================================
 * ClientCard — Refatoração 15/08/2026 + Integração Snapshot 04/09/2026
 * ============================================================================
 *
 * v2.0.1 (integração snapshot — 04/09/2026):
 * - ✅ MANTIDO: CSS Module, Semaphore, Router, Image, MetricCol
 * - ✅ NOVO: Props opcionais healthStatus, snapshotCount, lastSnapshotDate
 * - ✅ NOVO: Fallbacks que priorizam props, depois recorrem ao client
 * - ✅ NOVO: Snapshot info renderizado acima das métricas
 * - ✅ NOVO: Regra estrita para CTR: NULL/undefined → '—', 0 → '0.0%'
 *
 * v2.0.2 (SSOT vs protótipo — 07/09/2026):
 * - 🐛 CORRIGIDO: o protótipo (client-card) mostra o semáforo JUNTO com um
 *   badge de texto ("Crítico"/"Saudável"). O componente já tinha as classes
 *   prontas para isso (`.statusBadge`, `.statusHealthy`, `.statusWarning`,
 *   `.statusCritical`, `.statusUnknown` em ClientCard.module.css) mas nunca
 *   as usava — `showLabel` do Semaphore ficava fixo em `false` e o card
 *   renderizava só o círculo, sem rótulo. Adicionado o badge de status
 *   reaproveitando `STATUS_LABELS` (fonte única, já exportada por
 *   Semaphore.tsx) — não duplica vocabulário novo.
 *
 * v1.0.0 (15/08/2026):
 * O contrato de dados já estava certo: `Client` vem do barrel
 * (`../../types/client` → `orbit.ts`), sem redeclaração local.
 * Convertido para CSS Module consumindo `var(--token)` (REGRA-03).
 * ============================================================================
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Semaphore, { STATUS_LABELS } from './Semaphore'
import type { SemaphoreStatus } from './Semaphore'
import type { Client, ClientHealthStatus } from '@/types/client'
import styles from './ClientCard.module.css'

export interface ClientCardProps {
  client: Client
  healthStatus?: ClientHealthStatus
  snapshotCount?: number
  lastSnapshotDate?: string | null
}

function formatFollowerBalance(value: number): string {
  const sign = value >= 0 ? '+' : ''
  if (Math.abs(value) >= 1000) {
    return `${sign}${(value / 1000).toFixed(1)}k`
  }
  return `${sign}${value}`
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '--'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '--'
  }
}

const STATUS_BADGE_CLASS: Record<ClientHealthStatus, string> = {
  healthy: styles.statusHealthy,
  warning: styles.statusWarning,
  critical: styles.statusCritical,
  unknown: styles.statusUnknown,
}

interface MetricColProps {
  label: string
  value: string
  dimmed?: boolean
}

function MetricCol({ label, value, dimmed }: MetricColProps): React.ReactElement {
  return (
    <div className={styles.metricCol}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={[styles.metricValue, dimmed ? styles.metricValueDimmed : ''].join(' ')}>
        {value}
      </span>
    </div>
  )
}

export default function ClientCard({
  client,
  healthStatus: propHealthStatus,
  snapshotCount: propSnapshotCount,
  lastSnapshotDate: propLastSnapshotDate,
}: ClientCardProps): React.ReactElement {
  const router = useRouter()

  // ✅ Fallbacks que priorizam as props e recorrem ao objeto client
  const healthStatus: ClientHealthStatus = propHealthStatus ?? client.status ?? 'unknown'
  const snapshotCount = propSnapshotCount ?? client.snapshotCount ?? 0
  const lastSnapshotDate = propLastSnapshotDate ?? client.lastSnapshotDate ?? null

  // ✅ Cast seguro: healthStatus é ClientHealthStatus, que é compatível com SemaphoreStatus
  const semaphoreStatus: SemaphoreStatus = healthStatus

  // ✅ Regra estrita: NULL/undefined exibe '—', 0 exibe '0.0%'
  const ctrDisplay =
    client.metrics.ctr_link == null
      ? '—'
      : formatPercent(client.metrics.ctr_link)

  return (
    <button
      type="button"
      onClick={() => router.push(`/clients/${client.id}`)}
      className={styles.card}
      aria-label={`Abrir cliente ${client.name}`}
    >
      <div className={styles.header}>
        {client.avatar ? (
          <Image
            src={client.avatar}
            alt={client.name}
            width={40}
            height={40}
            className={styles.avatarImage}
          />
        ) : (
          <div aria-hidden="true" className={styles.avatarFallback}>
            {client.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className={styles.identity}>
          <span className={styles.name}>{client.name}</span>
          <span className={styles.handle}>{client.handle}</span>
        </div>

        <span className={styles.semaphoreWrap}>
          <Semaphore status={semaphoreStatus} showLabel={false} />
          <span className={`${styles.statusBadge} ${STATUS_BADGE_CLASS[healthStatus]}`}>
            {STATUS_LABELS[healthStatus]}
          </span>
        </span>
      </div>

      <div className={styles.divider} />

      {snapshotCount > 0 && lastSnapshotDate && (
        <div className={styles.snapshotInfo}>
          <span className={styles.snapshotLabel}>Último Snapshot</span>
          <span className={styles.snapshotValue}>
            {formatDate(lastSnapshotDate)} · {snapshotCount}
          </span>
        </div>
      )}

      <div className={styles.metricsRow}>
        <MetricCol
          label="Saldo seg."
          value={formatFollowerBalance(client.metrics.follower_balance)}
          dimmed={client.metrics.follower_balance === 0}
        />
        <MetricCol
          label="Eng. real"
          value={formatPercent(client.metrics.engagement_real)}
          dimmed={client.metrics.engagement_real === 0}
        />
        <MetricCol label="CTR link" value={ctrDisplay} dimmed={client.metrics.ctr_link == null} />
      </div>
    </button>
  )
}