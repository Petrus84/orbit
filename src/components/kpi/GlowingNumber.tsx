/* ==========================================================================
   ORBIT · Component — GlowingNumber
   Exibe números com text-shadow neon em Space Mono.
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import styles from './GlowingNumber.module.css'
import type { GlowColor } from '@/types/orbit'

export type GlowingNumberSize = 'sm' | 'md' | 'lg' | 'xl'

export interface GlowingNumberProps {
  value:  number | string
  unit?:  string
  color?: GlowColor
  size?:  GlowingNumberSize
}

const COLOR_CLASS: Record<GlowColor, string> = {
  cyan:  styles.cyan ?? '',
  red:   styles.red ?? '',
  gold:  styles.gold ?? '',
  green: styles.green ?? '',
  none:  styles.muted ?? '',
}

const SIZE_CLASS: Record<GlowingNumberSize, string> = {
  sm: styles.sizeSm ?? '',
  md: styles.sizeMd ?? '',
  lg: styles.sizeLg ?? '',
  xl: styles.sizeXl ?? '',
}

export function GlowingNumber({
  value,
  unit,
  color = 'cyan',
  size  = 'lg',
}: GlowingNumberProps) {
  const formattedValue =
    typeof value === 'number'
      ? value.toLocaleString('pt-BR')
      : value

  return (
    <span className={styles.wrapper}>
      <span
        className={[styles.number, COLOR_CLASS[color], SIZE_CLASS[size]].join(' ')}
      >
        {formattedValue}
      </span>
      {unit && (
        <span className={styles.unit}>{unit}</span>
      )}
    </span>
  )
}