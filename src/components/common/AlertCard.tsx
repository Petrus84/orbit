import React, { useCallback, useMemo } from 'react'
import type { Alert, AlertSeverity, AlertType, AlertAction } from '../../types/alert'
import styles from './AlertCard.module.css'

/**
 * ============================================================================
 * ALERTCARD COMPONENT — v3 (14/08/2026)
 * ============================================================================
 *
 * v2 → v3: trocado de CSS global (`alerts.css`, classes `.alert-crit` etc,
 * tokens extraídos do protótipo HTML) para CSS Module — o padrão real do
 * projeto, confirmado contra `CriticalAlert.module.css` (REGRA-07/convenção
 * de estilo). `alerts.css` global não existe mais; não importar.
 *
 * Histórico de correções da v1→v2 (mantidas):
 * 1. Campos em camelCase (`clientId`, `type`, `metricValue`,
 *    `thresholdValue`, `createdAt`) — contrato real de `Alert`.
 * 2. `AlertType` com os 9 valores reais de `orbit.alert_type` (Postgres).
 * 3. `AlertAction` é objeto (`{type, label, url?}`), não union de string —
 *    o alerta tem UMA ação (`alert.action`), não um catálogo fixo.
 * 4. Ciclo de vida real é `isResolved` (boolean) — não existe
 *    acknowledged_at/dismissed_at nem em `Alert` nem na tabela.
 * ============================================================================
 */

interface AlertCardProps {
  alert: Alert
  onDismiss?: (alertId: string) => Promise<void>
  onAcknowledge?: (alertId: string) => Promise<void>
  onActionClick?: (alert: Alert, action: AlertAction) => Promise<void>
  isLoading?: boolean
  className?: string
}

// ============================================================================
// MAPEAMENTOS — alinhados a orbit.alert_type (9 valores reais, dump_orbit.sql)
// ============================================================================

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  critical: styles.critical,
  warning: styles.warning,
  info: styles.info,
  // 'success' nunca chega até aqui na prática: v_alerts já colapsa para
  // 'info' no banco. Mapeado por segurança de tipo, não porque é esperado.
  success: styles.info,
}

const ALERT_TYPE_ICON: Record<AlertType, string> = {
  ctr_below_threshold: '⚡',
  engagement_collapse: '📉',
  avatar_misalignment: '🎯',
  creative_fatigue: '😴',
  roas_below_minimum: '💸',
  follower_churn_high: '👋',
  polemic_score_high: '🔥',
  boost_opportunity: '🚀',
  budget_pace: '⏱️',
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  ctr_below_threshold: 'CTR abaixo do limite',
  engagement_collapse: 'Colapso de engajamento',
  avatar_misalignment: 'Desalinhamento de avatar',
  creative_fatigue: 'Fadiga de criativo',
  roas_below_minimum: 'ROAS abaixo do mínimo',
  follower_churn_high: 'Churn de seguidores alto',
  polemic_score_high: 'Score de polêmica alto',
  boost_opportunity: 'Oportunidade de impulsionamento',
  budget_pace: 'Ritmo de orçamento',
}

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

const MetricComparison: React.FC<{
  metricName: string | null
  metricValue: number | null
  thresholdValue: number | null
}> = ({ metricName, metricValue, thresholdValue }) => {
  if (metricName === null || metricValue === null || thresholdValue === null) return null

  const isExceeded = metricValue > thresholdValue
  const percentDiff = thresholdValue !== 0 ? (((metricValue - thresholdValue) / thresholdValue) * 100).toFixed(1) : '—'

  return (
    <div className={styles.meta}>
      <span>
        {metricName}: <strong>{metricValue.toFixed(2)}</strong> / {thresholdValue.toFixed(2)}
      </span>
      <span>
        {isExceeded ? '+' : ''}
        {percentDiff}%
      </span>
    </div>
  )
}

const AlertStatus: React.FC<{ isResolved: boolean; createdAt: string }> = ({ isResolved, createdAt }) => {
  return (
    <div className={styles.status}>
      {isResolved ? '✓ Resolvido' : '⚠ Pendente de ação'} ·{' '}
      {new Date(createdAt).toLocaleDateString('pt-BR')}
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onDismiss,
  onAcknowledge,
  onActionClick,
  isLoading = false,
  className,
}) => {
  const [isActionLoading, setIsActionLoading] = React.useState(false)

  const alertTypeLabel = ALERT_TYPE_LABELS[alert.type as AlertType] ?? alert.type
  const alertTypeIcon = ALERT_TYPE_ICON[alert.type as AlertType] ?? '•'

  const handleDismiss = useCallback(async () => {
    if (!onDismiss) return
    try {
      setIsActionLoading(true)
      await onDismiss(alert.id)
    } catch (err) {
      console.error('Erro ao descartar alerta:', err)
    } finally {
      setIsActionLoading(false)
    }
  }, [alert.id, onDismiss])

  const handleAcknowledge = useCallback(async () => {
    if (!onAcknowledge) return
    try {
      setIsActionLoading(true)
      await onAcknowledge(alert.id)
    } catch (err) {
      console.error('Erro ao resolver alerta:', err)
    } finally {
      setIsActionLoading(false)
    }
  }, [alert.id, onAcknowledge])

  const handleAction = useCallback(async () => {
    if (!alert.action) return
    try {
      setIsActionLoading(true)
      if (onActionClick) {
        await onActionClick(alert, alert.action)
        return
      }
      if (alert.action.type === 'link' && alert.action.url) {
        window.open(alert.action.url, '_blank', 'noopener,noreferrer')
      } else if (alert.action.type === 'resolve') {
        await handleAcknowledge()
      } else if (alert.action.type === 'dismiss') {
        await handleDismiss()
      }
    } catch (err) {
      console.error('Erro ao executar ação:', err)
    } finally {
      setIsActionLoading(false)
    }
  }, [alert, onActionClick, handleAcknowledge, handleDismiss])

  const isActive = useMemo(() => !alert.isResolved, [alert.isResolved])

  return (
    <div className={[styles.card, SEVERITY_CLASS[alert.severity], className ?? ''].join(' ')}>
      {isActive && onDismiss && (
        <button
          onClick={handleDismiss}
          disabled={isActionLoading}
          className={styles.dismiss}
          title="Descartar alerta"
          aria-label="Descartar alerta"
        >
          ✕
        </button>
      )}

      <div className={styles.icon}>{alertTypeIcon}</div>

      <div className={styles.body}>
        <div className={styles.title}>{alertTypeLabel}</div>
        <p className={styles.text}>{alert.title}</p>
        {alert.description && <p className={styles.text}>{alert.description}</p>}

        <MetricComparison
          metricName={alert.metricName}
          metricValue={alert.metricValue}
          thresholdValue={alert.thresholdValue}
        />

        <div className={styles.action}>
          {isActive && alert.action && (
            <button className={styles.btn} onClick={handleAction} disabled={isActionLoading}>
              {alert.action.label}
            </button>
          )}
          {isActive && onAcknowledge && (
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={handleAcknowledge}
              disabled={isActionLoading}
            >
              Marcar como resolvido
            </button>
          )}
        </div>

        <AlertStatus isResolved={alert.isResolved} createdAt={alert.createdAt} />
      </div>

      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-gray-300" />
        </div>
      )}
    </div>
  )
}

export default AlertCard