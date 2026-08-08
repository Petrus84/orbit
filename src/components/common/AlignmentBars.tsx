/* ==========================================================================
   ORBIT · Component — AlignmentBars
   Lista de barras de alinhamento por variável, dentro de um único GlassCard.
   Trilhos compactos (8px) — réguas finas de dashboard, não blocos.
   Versão: 2.1.0
   ========================================================================== */

import React from 'react'
import { GlassCard } from './GlassCard'
import type { AlignmentBar, AlignmentColor } from '../../types/avatar'
import type { GlowColor } from '../../types/orbit'
import styles from './AlignmentBars.module.css'

export interface AlignmentBarsProps {
  bars: AlignmentBar[]
}

const COLOR_TO_GLOW: Record<AlignmentColor, GlowColor> = {
  success: 'cyan',
  warning: 'gold',
  danger: 'red',
}

const DOT_CLASS: Record<GlowColor, string> = {
  cyan: styles.dotCyan,
  gold: styles.dotGold,
  red: styles.dotRed,
  none: styles.dotNone,
}

const FILL_CLASS: Record<GlowColor, string> = {
  cyan: styles.fillCyan,
  gold: styles.fillGold,
  red: styles.fillRed,
  none: styles.fillNone,
}

const PILL_CLASS: Record<GlowColor, string> = {
  cyan: styles.pillCyan,
  gold: styles.pillGold,
  red: styles.pillRed,
  none: styles.pillNone,
}

function clampAlignmentPct(variance: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - variance)))
}

export function AlignmentBars({ bars }: AlignmentBarsProps): React.ReactElement {
  return (
    <section className={styles.wrapper}>
      <span className={styles.sectionLabel}>Alinhamento por Variável</span>

      <GlassCard glowColor="none" className={styles.card}>
        <div className={styles.list}>
          {bars.map((bar, index) => {
            const glow = COLOR_TO_GLOW[bar.color]
            const alignmentPct = clampAlignmentPct(bar.variance)

            return (
              <div
                key={bar.label}
                className={index === 0 ? styles.item : `${styles.item} ${styles.itemDivider}`}
              >
                <div className={styles.labelRow}>
                  <div className={styles.labelLeft}>
                    <span className={[styles.dot, DOT_CLASS[glow]].join(' ')} aria-hidden="true" />
                    <span className={styles.label}>{bar.label}</span>
                  </div>
                  <div className={styles.metricsRight}>
                    <span>
                      Esperado <span className={styles.metricValue}>{bar.expected}%</span>
                    </span>
                    <span>
                      Real <span className={styles.metricValue}>{bar.real}%</span>
                    </span>
                  </div>
                </div>

                {/* Régua fina — 8px, tolerância zero para blocos grossos */}
                <div className={styles.track}>
                  <span className={styles.expectedFill} style={{ width: `${bar.expected}%` }} />
                  <span
                    className={[styles.realFill, FILL_CLASS[glow]].join(' ')}
                    style={{ width: `${bar.real}%` }}
                  />
                  <span className={styles.targetLine} style={{ left: `${bar.expected}%` }} />
                </div>

                <div className={styles.footRow}>
                  <span className={[styles.alignmentPill, PILL_CLASS[glow]].join(' ')}>
                    Alinhamento: {alignmentPct}%
                  </span>
                  <span className={styles.legend}>
                    <span>
                      <span className={styles.legendSwatchExpected} /> Esperado
                    </span>
                    <span>
                      <span className={[styles.legendSwatch, FILL_CLASS[glow]].join(' ')} /> Real
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>
    </section>
  )
}