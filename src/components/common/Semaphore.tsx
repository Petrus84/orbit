/* ==========================================================================
   ORBIT · Component — Semaphore (unificado)
   Fonte única de verdade para indicador de status em toda a UI.
   Substitui: components/common/Semaphore.tsx (antigo) +
              components/kpi/SemaphoreIndicator.tsx (antigo)
   Paleta: neon (decisão de 22/07/2026) — cyan/gold/red/none
   Versão: 3.0.0
   ========================================================================== */

import React from 'react'
import styles from './Semaphore.module.css'
import type { ClientHealthStatus } from '../../types/orbit'

// Vocabulário canônico único. ClientHealthStatus já cobre os 4 estados
// reais do produto (healthy/warning/critical/unknown) — todo componente
// que hoje usa AlertSeverity, AlignmentStatus ou SemaphoreColor para
// desenhar um "semáforo" deve migrar para este tipo.
export type SemaphoreStatus = ClientHealthStatus

export interface SemaphoreProps {
  status: SemaphoreStatus
  /** Mostra o label textual ao lado do badge (default: false) */
  showLabel?: boolean
  size?: 'sm' | 'md'
}

const ICON_MAP: Record<SemaphoreStatus, string> = {
  healthy: '✓',
  warning: '⚠',
  critical: '✕',
  unknown: '–',
}

/** Reaproveitado por Badge/AlertCard para manter vocabulário consistente. */
export const STATUS_LABELS: Record<SemaphoreStatus, string> = {
  healthy: 'Saudável',
  warning: 'Atenção',
  critical: 'Crítico',
  unknown: 'Sem dado',
}

const CLASS_MAP: Record<SemaphoreStatus, string> = {
  healthy: styles.cyan,
  warning: styles.gold,
  critical: styles.red,
  unknown: styles.none,
}

export default function Semaphore({
  status,
  showLabel = false,
  size = 'md',
}: SemaphoreProps): React.ReactElement {
  const label = STATUS_LABELS[status]

  return (
    <span className={styles.wrapper}>
      <span
        className={[styles.badge, CLASS_MAP[status], size === 'sm' ? styles.sm : styles.md].join(' ')}
        role="img"
        aria-label={label}
      >
        {ICON_MAP[status]}
      </span>
      {showLabel && (
        <span className={[styles.label, CLASS_MAP[status]].join(' ')}>{label}</span>
      )}
    </span>
  )
}