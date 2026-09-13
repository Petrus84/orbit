/* ==========================================================================
   ORBIT · Component — GlassCard
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import { type ReactNode, type MouseEventHandler } from 'react'
import styles from './GlassCard.module.css'
import type { GlowColor } from '@/types/orbit'

export interface GlassCardProps {
  children:  ReactNode
  glowColor?: GlowColor
  className?: string | undefined
  onClick?:   MouseEventHandler<HTMLDivElement>
  role?:      string
  tabIndex?:  number
}

const GLOW_CLASS: Record<GlowColor, string> = {
  cyan: styles.glowCyan ?? '',
  red:  styles.glowRed ?? '',
  gold: styles.glowGold ?? '',
  none: styles.glowNone ?? '',
}

export function GlassCard({
  children,
  glowColor = 'none',
  className,
  onClick,
  role,
  tabIndex,
}: GlassCardProps) {
  return (
    <div
      className={[styles.card, GLOW_CLASS[glowColor], className].filter(Boolean).join(' ')}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
    >
      {children}
    </div>
  )
}