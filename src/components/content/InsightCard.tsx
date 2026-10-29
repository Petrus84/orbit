/* ==========================================================================
   ORBIT · Component — InsightCard
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import styles from "./InsightCard.module.css";
import type { InsightData } from "@/types/orbit";
import { CONFIANCA } from "@/lib/ui-labels";

export interface InsightCardProps {
  insight: InsightData;
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        💡
      </span>
      <div className={styles.body}>
        <p className={styles.text}>{insight.text}</p>
        {insight.action && (
          <p className={styles.text}>
            <strong className={styles.label}>Próximo passo:</strong>{" "}
            {insight.action}
          </p>
        )}
        {(insight.basis || insight.confidenceLevel) && (
          <p className={styles.basis}>
            {insight.confidenceLevel && (
              <span className={styles.tag}>
                {CONFIANCA[insight.confidenceLevel]}
              </span>
            )}{" "}
            {insight.basis}
          </p>
        )}
      </div>
    </div>
  );
}
