/* ==========================================================================
   ORBIT · Component — SemaphoreIndicator
   Ícones: ✓ (verde) · ⚠ (ambar) · ✕ (vermelho)
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import React from 'react'
import styles from './SemaphoreIndicator.module.css'
import type { SemaphoreColor } from '../../types/orbit'

export interface SemaphoreIndicatorProps {
  color: SemaphoreColor
}

const ICON_MAP: Record<SemaphoreColor, string> = {
  verde:    '✓',
  ambar:    '⚠',
  vermelho: '✕',
}

const COLOR_CLASS: Record<SemaphoreColor, string> = {
  verde:    styles.verde,
  ambar:    styles.ambar,
  vermelho: styles.vermelho,
}

const ARIA_LABEL: Record<SemaphoreColor, string> = {
  verde:    'Status positivo',
  ambar:    'Status de atenção',
  vermelho: 'Status crítico',
}

export function SemaphoreIndicator({ color }: SemaphoreIndicatorProps) {
  return (
    <span
      className={[styles.badge, COLOR_CLASS[color]].join(' ')}
      aria-label={ARIA_LABEL[color]}
      role="img"
    >
      {ICON_MAP[color]}
    </span>
  )
}
