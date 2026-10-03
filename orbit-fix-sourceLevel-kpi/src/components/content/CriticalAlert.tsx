/**
 * ============================================================================
 * CriticalAlert — Refatoração 15/08/2026
 * ============================================================================
 *
 * VIOLAÇÕES CORRIGIDAS:
 * - Removido `const styles: any = {}` (REGRA-07 — `any` proibido sem
 *   exceções). Esse placeholder também fazia o import de CSS Module ser
 *   inócuo: nada em `styles.*` renderizava classe real nenhuma.
 * - CSS Module restaurado de verdade: `import styles from
 *   './CriticalAlert.module.css'`.
 * - Tipos importados de `src/types/orbit.ts` (fonte de verdade), não
 *   redeclarados.
 *
 * CONTRATO REAL (verificado em orbit.ts, não assumido):
 * - `CriticalAlertData.severity` é `AlertSeverity`
 *   ('info'|'warning'|'critical'|'success') — NÃO é `ClientHealthStatus`.
 *   São dois vocabulários distintos e sobrepostos parcialmente (ver
 *   OBSERVAÇÃO 13 em orbit.ts); `ClientHealthStatus` é o vocabulário
 *   canônico de "saúde de cliente" (REGRA-09), não de "severidade de
 *   alerta". Forçar `CriticalAlertData` a falar `ClientHealthStatus`
 *   seria REGRA-01 (divergir do contrato real por conveniência).
 * - `CriticalAlertData` NÃO tem campo `action: AlertAction` — tem
 *   `actionUrl?: string | null`. O prompt original assumia uma ação
 *   estruturada que não existe neste tipo; usamos o campo real.
 * - Não existe `timestamp` em `CriticalAlertData`.
 *
 * ============================================================================
 */
import React from 'react'
import type { CriticalAlertData, AlertSeverity } from '@/types/orbit'
import styles from './CriticalAlert.module.css'

export interface CriticalAlertProps {
  alert: CriticalAlertData
  className?: string
  /** Se omitido, abre `alert.actionUrl` em nova aba. */
  onActionClick?: (actionUrl: string) => void
}

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  critical: '⚠️',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
} as const

// Ponte puramente de apresentação (severidade → classe CSS local). Não é
// um mapeamento para ClientHealthStatus — ver header.
const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  critical: styles.critical ?? '',
  warning: styles.warning ?? '',
  info: styles.info ?? '',
  success: styles.success ?? '',
}

export function CriticalAlert({ alert, className, onActionClick }: CriticalAlertProps) {
  const handleActionClick = () => {
    if (!alert.actionUrl) return
    if (onActionClick) {
      onActionClick(alert.actionUrl)
      return
    }
    window.open(alert.actionUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={[styles.card, SEVERITY_CLASS[alert.severity], className].filter(Boolean).join(' ')}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        {SEVERITY_ICON[alert.severity]}
      </span>
      <div className={styles.content}>
        <p className={styles.title}>{alert.title}</p>
        <p className={styles.body}>{alert.body}</p>
        {alert.description && alert.description !== alert.body && (
          <p className={styles.body}>{alert.description}</p>
        )}
        {alert.probableCause && (
          <p className={styles.body}>
            <strong className={styles.label}>Causa provável:</strong> {alert.probableCause}
          </p>
        )}
        {alert.immediateAction && (
          <p className={styles.actionText}>
            <strong className={styles.label}>Ação:</strong> {alert.immediateAction}
          </p>
        )}
        {alert.actionUrl && (
          <button type="button" className={styles.action} onClick={handleActionClick}>
            Ver detalhes
          </button>
        )}
      </div>
    </div>
  )
}

export default CriticalAlert