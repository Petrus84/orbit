/**
 * ============================================================================
 * ClientCard — Refatoração 15/08/2026
 * ============================================================================
 *
 * O contrato de dados já estava certo nesta versão: `Client` vem do barrel
 * (`../../types/client` → `orbit.ts`), sem redeclaração local, `avatar`
 * (não `avatarUrl`), `SemaphoreStatus = ClientHealthStatus` já cobre os 4
 * valores (confirmado lendo `Semaphore.tsx` — `ICON_MAP`/`CLASS_MAP` tratam
 * 'unknown' explicitamente, não quebra a compilação).
 *
 * O QUE FOI CORRIGIDO (REGRA-03):
 * Componente inteiro estava em Tailwind com valores arbitrários que
 * coincidem exatamente com tokens do SSOT, mas sem referenciá-los:
 * - `bg-[#18181F]`            → é literalmente `--bg2`
 * - `hover:bg-[#1F1F28]`      → é literalmente `--bg3`
 * - `outline-[#C8FF57]`       → é literalmente `--acc`
 * Ou seja: alguém já sabia os valores certos, só não usou os tokens — o
 * pior cenário de REGRA-03 (paleta correta por acidente, não por fonte
 * única). Se o SSOT mudar esses valores algum dia, este componente não
 * acompanharia. Convertido para CSS Module consumindo `var(--token)`.
 * ============================================================================
 */
import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Semaphore from './Semaphore'
import type { SemaphoreStatus } from './Semaphore'
import type { Client } from '../../types/client'
import styles from './ClientCard.module.css'

interface ClientCardProps {
  client: Client
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

export default function ClientCard({ client }: ClientCardProps): React.ReactElement {
  const router = useRouter()

  const semaphoreStatus: SemaphoreStatus = client.status

  const ctrDisplay =
    client.metrics.ctr_link === 0 ? '—' : formatPercent(client.metrics.ctr_link)

  return (
    <button
      type="button"
      onClick={() => router.push(`/clients/${client.id}`)}
      className={styles.card}
    >
      {/* Header: avatar + name + semaphore */}
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

        <Semaphore status={semaphoreStatus} showLabel={false} />
      </div>

      <div className={styles.divider} />

      {/* Metrics row */}
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
        <MetricCol label="CTR link" value={ctrDisplay} dimmed={client.metrics.ctr_link === 0} />
      </div>
    </button>
  )
}