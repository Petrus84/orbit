/* ==========================================================================
   ORBIT · Component — DeltaText
   ↑ cyan (positivo) / ↓ red (negativo)
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import React from 'react'
import styles from './DeltaText.module.css'

export interface DeltaTextProps {
  value:  number       // ex: 3.1 ou -50
  label?: string       // ex: "vs 90d ant."
}

export function DeltaText({ value, label }: DeltaTextProps) {
  const isPositive = value >= 0
  const arrow      = isPositive ? '↑' : '↓'
  const absValue   = Math.abs(value)
  const formatted  = `${absValue % 1 === 0 ? absValue : absValue.toFixed(1)}%`

  return (
    <span className={styles.wrapper}>
      <span className={isPositive ? styles.positive : styles.negative}>
        {arrow} {formatted}
      </span>
      {label && (
        <span className={styles.label}>{label}</span>
      )}
    </span>
  )
}
