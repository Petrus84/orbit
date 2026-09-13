/* ==========================================================================
   ORBIT · Component — InsightCard
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import styles                   from './InsightCard.module.css'
import type { InsightData }     from '@/types/orbit'

export interface InsightCardProps {
  insight: InsightData
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">💡</span>
      <p className={styles.text}>
        <strong className={styles.label}>Insight:</strong>{' '}
        {insight.text}
      </p>
    </div>
  )
}