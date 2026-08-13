/* ==========================================================================
   ORBIT · Component — CriticalAlert
   Full-width, red glow, ícone ⚠️
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import React                        from 'react'
import styles                       from './CriticalAlert.module.css'
import type { CriticalAlertData }   from '../../types/orbit'

export interface CriticalAlertProps {
  alert: CriticalAlertData
}

const SEVERITY_ICON: Record<CriticalAlertData['severity'], string> = {
  critical: '⚠️',
  warning:  '⚠️',
  info:     'ℹ️',
  success:  '✅',
}

export function CriticalAlert({ alert }: CriticalAlertProps) {
  return (
    <div
      className={[styles.card, styles[alert.severity]].join(' ')}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        {SEVERITY_ICON[alert.severity]}
      </span>
      <div className={styles.content}>
        <p className={styles.title}>{alert.title}</p>
        <p className={styles.body}>{alert.body}</p>
      </div>
    </div>
  )
}
