/* ==========================================================================
   ORBIT · Component — WatchTimePanel
   Card "Tempo assistido por Reel" (Overview).

   Selos (lib/ui-labels CONFIANCA):
   - Tempo médio assistido = Medido (L0): número direto da Meta, em segundos
     inteiros (a Meta arredonda).
   - Retenção = Estimado (L1): derivada (tempo médio ÷ duração), não é métrica
     da Meta.
   Sem referência de setor/porte: a coleta pública (Apify) não traz tempo
   assistido, então não existe régua para comparar. A tela diz isso.
   Sem dado suficiente (< 3 Reels) o card não aparece.
   ========================================================================== */

import { GlassCard } from "@/components/common/GlassCard";
import { formatPtBr } from "@/lib/format";
import { provenanceLine } from "@/lib/provenanceText";
import { CONFIANCA } from "@/lib/ui-labels";
import type { MetricProvenance, WatchTimeSummary } from "@/types/orbit";
import styles from "./WatchTimePanel.module.css";

export interface WatchTimePanelProps {
  watchTime: WatchTimeSummary | null | undefined;
}

const PROVENANCE: MetricProvenance = {
  source: "tempo médio de reprodução informado pela Meta (importado)",
  period: "header_window",
  method:
    "mediana por Reel no período; retenção = tempo médio ÷ duração do Reel (derivada, não é métrica da Meta); a Meta informa o tempo médio em segundos inteiros; mínimo de 3 Reels (amostra leve até 7, robusta a partir de 8)",
};

const reelsText = (n: number): string => (n === 1 ? "1 Reel" : `${n} Reels`);

const secondsText = (value: number): string =>
  `${formatPtBr(value, Number.isInteger(value) ? 0 : 1)} s`;

export function WatchTimePanel({ watchTime }: WatchTimePanelProps) {
  if (!watchTime) return null;

  return (
    <GlassCard
      glowColor="cyan"
      className={styles.panel}
      aria-label="Tempo assistido por Reel"
    >
      <p className={styles.panelTitle}>TEMPO ASSISTIDO POR REEL</p>

      <div className={styles.grid}>
        <div className={styles.box}>
          <p className={styles.label}>Tempo médio assistido (mediana)</p>
          <p className={styles.value}>
            {secondsText(watchTime.avgWatchMedianSec)}
          </p>
          <p className={styles.meta}>
            <span className={styles.sealMeasured}>{CONFIANCA.L0}</span>{" "}
            {reelsText(watchTime.knownReels)} · amostra {watchTime.band}
          </p>
        </div>

        {watchTime.retentionMedianPct !== null && (
          <div className={styles.box}>
            <p className={styles.label}>Retenção (mediana)</p>
            <p className={styles.value}>
              {formatPtBr(watchTime.retentionMedianPct, 0)}%
            </p>
            <p className={styles.meta}>
              <span className={styles.sealEstimated}>{CONFIANCA.L1}</span>{" "}
              {reelsText(watchTime.retentionKnownReels)} · amostra{" "}
              {watchTime.retentionBand} · tempo médio ÷ duração
            </p>
            {watchTime.inconsistentReels > 0 && (
              <p className={styles.meta}>
                {reelsText(watchTime.inconsistentReels)} com tempo médio acima
                da duração ficou fora desta conta.
              </p>
            )}
          </div>
        )}
      </div>

      <p className={styles.referenceNote}>
        Sem referência de setor ou porte: a coleta pública das contas de
        referência não traz tempo assistido.
      </p>
      <p className={styles.provenanceNote}>{provenanceLine(PROVENANCE)}</p>
    </GlassCard>
  );
}
