/* ==========================================================================
   ORBIT · Component — QualityScoresPanel
   Grade 2×2: Score Utilidade · Score Polêmica · VFE · ER Real
   Versão: 1.0.1  |  Data: 2026-06-07

   MUDANÇA v1.0.1 — apenas a lógica de classe do scoreBox:
   - Adicionado case 'gold' → styles.boxGold  (estava ausente, caia em boxNeutral)
   - Adicionado case 'none' → styles.boxNeutral (cobertura defensiva)
   Nenhum outro trecho foi alterado.
   ========================================================================== */

import React from 'react'
import { GlassCard }             from '@/components/common/GlassCard'
import { GlowingNumber }         from '@/components/kpi/GlowingNumber'
import styles                    from './QualityScoresPanel.module.css'
import type { QualityScoreItem } from '@/types/orbit'

export interface QualityScoresPanelProps {
  scores: QualityScoreItem[]
}

const STATUS_ICON: Record<'ok' | 'warn' | 'neutral', string> = {
  ok:      '▲',
  warn:    '▲',
  neutral: '—',
}

// Mapa completo: cobre todos os valores de GlowColor
function scoreBoxClass(glowColor: QualityScoreItem['glowColor']): string {
  switch (glowColor) {
    case 'cyan': return styles.boxCyan
    case 'red':  return styles.boxRed
    case 'gold': return styles.boxGold     // NOVO v1.0.1 — era ignorado, entrava em default
    default:     return styles.boxNeutral  // 'none' + qualquer valor inesperado
  }
}

export function QualityScoresPanel({ scores }: QualityScoresPanelProps) {
  return (
    <GlassCard glowColor="cyan" className={styles.panel}>
      <p className={styles.panelTitle}>SCORES DE QUALIDADE DE CONTEÚDO</p>

      <div className={styles.grid}>
        {scores.map((score) => (
          <div
            key={score.id}
            className={[styles.scoreBox, scoreBoxClass(score.glowColor)].join(' ')}
          >
            <p className={styles.scoreLabel}>{score.label}</p>

            <div className={styles.scoreValue}>
              {score.value === 'N/A' ? (
                <span className={styles.naValue}>N/A</span>
              ) : (
                <GlowingNumber
                  value={score.value as number}
                  unit={score.unit}
                  color={score.glowColor}
                  size="md"
                />
              )}
            </div>

            <p className={[
              styles.statusText,
              score.statusVariant === 'ok'   ? styles.statusOk
              : score.statusVariant === 'warn' ? styles.statusWarn
              : styles.statusNeutral,
            ].join(' ')}>
              {STATUS_ICON[score.statusVariant]} {score.statusText}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}