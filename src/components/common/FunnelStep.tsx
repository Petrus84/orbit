'use client'

import React from 'react'
import styles from './FunnelStep.module.css'
import type { FunnelStepDataExtended } from '@/types/orbit'

interface FunnelStepProps {
  step: FunnelStepDataExtended
  isLast?: boolean
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toLocaleString('pt-BR')
}

export default function FunnelStep({ step, isLast = false }: FunnelStepProps): React.ReactElement {
  const stepStyle = { '--step-color': step.color } as React.CSSProperties

  return (
    <div className={styles.step}>
      <div className={styles.row}>
        <span className={styles.label}>{step.label}</span>
        <div className={styles.values}>
          <span className={styles.value}>{formatValue(step.value)}</span>
          <span className={styles.percentage} style={stepStyle}>
            {step.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className={styles.barWrap}>
        <div
          className={styles.barFill}
          style={{ ...stepStyle, width: `${Math.max(step.percentage, 0.5)}%` }}
        />
      </div>

      {step.dropoffPct !== undefined && step.dropoffPct > 0 && (
        <div className={styles.dropoffBadge} style={stepStyle}>
          {step.dropoffLabel}
        </div>
      )}

      {!isLast && <div className={styles.connector} aria-hidden="true" />}
    </div>
  )
}
