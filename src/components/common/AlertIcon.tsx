import React from 'react'
import type { AlertType } from '../../types/alert'

/**
 * 🐛 CORRIGIDO: este arquivo declarava seu PRÓPRIO `AlertType` local, com
 * 7 valores (ctr_low, cpa_high, frequency_high...) — a TERCEIRA versão
 * diferente de AlertType vista nesta revisão (a segunda foi em
 * AlertCard.tsx, com 8 valores diferentes dela). Nenhuma das duas batia
 * com o enum real `orbit.alert_type` no Postgres (9 valores — ver
 * dump_orbit.sql). Removido o `export type AlertType` local; agora importa
 * o mesmo tipo que todo o resto do app usa.
 */

interface AlertIconProps {
  type: AlertType
  className?: string
}

const ICON_MAP: Record<AlertType, string> = {
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

export default function AlertIcon({ type, className = '' }: AlertIconProps): React.ReactElement {
  return (
    <span role="img" aria-label={type} className={`text-base leading-none select-none ${className}`}>
      {ICON_MAP[type]}
    </span>
  )
}