import React, { useCallback, useMemo } from 'react'
import type { Alert, AlertSeverity, AlertType, AlertAction } from '../../types/alert'
import './AlertCard.module.css'

/**
 * ============================================================================
 * ALERTCARD COMPONENT — reescrito 14/08/2026
 * ============================================================================
 *
 * A versão anterior deste componente tinha 4 problemas que impediam
 * compilação contra o `Alert` canônico (src/types/orbit.ts):
 *
 * 1. Campos em snake_case (`client_id`, `alert_type`, `metric_value`,
 *    `threshold`, `created_at`) que não existem em `Alert` — o contrato
 *    real é camelCase (`clientId`, `type`, `metricValue`, `thresholdValue`,
 *    `createdAt`).
 * 2. `AlertType` local com 8 valores fabricados (low_ctr, high_cpa,
 *    budget_depletion...) sem nenhuma relação com `orbit.alert_type` no
 *    Postgres (9 valores reais — ver dump_orbit.sql).
 * 3. `alert.recommended_action` e um `Record<AlertAction, ...>` tratando
 *    `AlertAction` como enum de string. Na verdade `AlertAction` é uma
 *    interface de objeto (`{ type: 'link'|'dismiss'|'resolve', label,
 *    url? }`) — não dá pra usar como chave de Record. O alerta tem UMA
 *    ação (`alert.action`), não um catálogo de 6 ações fixas.
 * 4. `alert.acknowledged_at` / `alert.dismissed_at` — não existem nem no
 *    `Alert` canônico nem na tabela `orbit.alerts` (que só tem
 *    `is_resolved`/`resolved_at`/`is_snoozed`). O ciclo de vida real é
 *    resolvido/não-resolvido, não um tri-estado acknowledge/dismiss.
 *
 * Estilo: trocado de paleta Tailwind ad-hoc (bg-red-950 etc, sem relação
 * com o design system) para as classes `.alert/.alert-crit/...` extraídas
 * do protótipo real (orbit-prototipo-consolidado-neon.html).
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
  critical: 'alert-crit',
  warning: 'alert-warn',
  info: 'alert-info',
  // 'success' nunca chega até aqui na prática: v_alerts já colapsa para
  // 'info' no banco. Mapeado por segurança de tipo, não porque é esperado.
  success: 'alert-info',
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Crítico',
  warning: 'Atenção',
  info: 'Informação',
  success: 'Informação',
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
  // Nem todo tipo de alerta tem métrica associada (ex.: avatar_misalignment
  // pode não ter). Os 3 campos são nullable em `Alert` — se faltar
  // qualquer um, não renderiza a comparação em vez de quebrar/mostrar NaN.
  if (metricName === null || metricValue === null || thresholdValue === null) return null

  const isExceeded = metricValue > thresholdValue
  const percentDiff = thresholdValue !== 0 ? (((metricValue - thresholdValue) / thresholdValue) * 100).toFixed(1) : '—'

  return (
    <div className="alert-meta">
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
    <div className={isResolved ? 'alert-status alert-status-resolved' : 'alert-status'}>
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

  // A ação vem do próprio alerta (`alert.action`), não de um catálogo fixo.
  // `type: 'link'` abre a URL sugerida; 'dismiss'/'resolve' delegam pros
  // handlers acima — ambos afetam o mesmo campo real (`is_resolved`), mas
  // 'resolve' fecha o alerta permanentemente e 'dismiss' só o esconde da
  // view atual (decisão de produto pendente de confirmação — comportamento
  // hoje é idêntico ao acknowledge).
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
    <div className={`alert ${SEVERITY_CLASS[alert.severity]} ${className ?? ''}`} style={{ position: 'relative' }}>
      {isActive && onDismiss && (
        <button
          onClick={handleDismiss}
          disabled={isActionLoading}
          className="alert-dismiss"
          title="Descartar alerta"
          aria-label="Descartar alerta"
        >
          ✕
        </button>
      )}

      <div className="alert-icon">{alertTypeIcon}</div>

      <div className="alert-body">
        <div className="alert-title">{alertTypeLabel}</div>
        <p className="alert-text">{alert.title}</p>
        {alert.description && <p className="alert-text">{alert.description}</p>}

        <MetricComparison
          metricName={alert.metricName}
          metricValue={alert.metricValue}
          thresholdValue={alert.thresholdValue}
        />

        <div className="alert-action">
          {isActive && alert.action && (
            <button className="alert-btn" onClick={handleAction} disabled={isActionLoading}>
              {alert.action.label}
            </button>
          )}
          {isActive && onAcknowledge && (
            <button
              className="alert-btn alert-btn-ghost"
              onClick={handleAcknowledge}
              disabled={isActionLoading}
            >
              Marcar como resolvido
            </button>
          )}
        </div>

        <div style={{ marginTop: '8px' }}>
          <AlertStatus isResolved={alert.isResolved} createdAt={alert.createdAt} />
        </div>
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