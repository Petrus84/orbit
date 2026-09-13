/* ==========================================================================
   ORBIT · Component — StatusPill
   Versão: 1.1.0  |  Data: 2026-07-15

   v1.1.0 (correção — 2026-07-15):
   - 🔧 `color` estava tipado como TrendColor ('up'|'down'|'flat'), mas todo
     lugar que renderiza <StatusPill> passa GlowColor (ex:
     QualityScoresPanel.tsx: color={score.glowColor}). TrendColor e
     GlowColor são vocabulários diferentes que coincidiam por acaso em
     'cyan'/'gold'/'red' — TrendColor nunca teve esses valores de verdade,
     era o tipo errado colado aqui.
   - Adicionada entrada 'none' ao COLOR_CLASS (GlowColor inclui 'none').
   ========================================================================== */

import styles from './StatusPill.module.css'
import type { GlowColor } from '@/types/orbit'

export interface StatusPillProps {
  text: string
  color: GlowColor
}

const COLOR_CLASS: Record<GlowColor, string> = {
  cyan: styles.cyan ?? '',
  red: styles.red ?? '',
  gold: styles.gold ?? '',
  green: styles.green ?? '',
  none: '',
}

export function StatusPill({ text, color }: StatusPillProps) {
  return (
    <span className={[styles.pill, COLOR_CLASS[color]].join(' ')}>
      {text}
    </span>
  )
}