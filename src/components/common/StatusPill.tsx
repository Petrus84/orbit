/* ==========================================================================
   ORBIT · Component — StatusPill
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import React from 'react'
import styles from './StatusPill.module.css'
import type { TrendColor } from '../../types/orbit'

export interface StatusPillProps {
  text:  string
  color: TrendColor
}

const COLOR_CLASS: Record<TrendColor, string> = {
  cyan: styles.cyan,
  red:  styles.red,
  gold: styles.gold,
}

export function StatusPill({ text, color }: StatusPillProps) {
  return (
    <span className={[styles.pill, COLOR_CLASS[color]].join(' ')}>
      {text}
    </span>
  )
}
