/* ==========================================================================
   ORBIT · Component — Semaphore (unificado)
   Fonte única de verdade para indicador de status em toda a UI.
   Paleta: neon (decisão de 22/07/2026) — cyan/gold/red/none
   Versão: 3.1.0

   v3.1.0:
   - SemaphoreStatus = ClientHealthStatus | 'unknown'. 'unknown' é conceito
     de APRESENTAÇÃO (sem dado); no domínio isso é `null`. Use
     toSemaphoreStatus() para converter na borda da UI.
   - Mapas passam a cobrir 'info' (faltava desde sempre).
   ========================================================================== */

import React from "react";
import styles from "./Semaphore.module.css";
import type { ClientHealthStatus } from "@/types/orbit";

export type SemaphoreStatus = ClientHealthStatus | "unknown";

/** Converte o status de domínio (nullable) no vocabulário visual. */
export function toSemaphoreStatus(
  status: ClientHealthStatus | null | undefined,
): SemaphoreStatus {
  return status ?? "unknown";
}

export interface SemaphoreProps {
  status: SemaphoreStatus;
  /** Mostra o label textual ao lado do badge (default: false) */
  showLabel?: boolean;
  size?: "sm" | "md";
}

const ICON_MAP: Record<SemaphoreStatus, string> = {
  healthy: "✓",
  warning: "⚠",
  critical: "✕",
  info: "i",
  unknown: "–",
};

/** Reaproveitado por Badge/ClientCard/AlertCard para manter vocabulário consistente. */
export const STATUS_LABELS: Record<SemaphoreStatus, string> = {
  healthy: "Saudável",
  warning: "Atenção",
  critical: "Crítico",
  info: "Info",
  unknown: "Aguardando dados",
};

const CLASS_MAP: Record<SemaphoreStatus, string> = {
  healthy: styles.cyan ?? "",
  warning: styles.gold ?? "",
  critical: styles.red ?? "",
  // Sem classe dedicada ainda: cai no neutro até existir `.info` no módulo CSS.
  info: styles.info ?? styles.none ?? "",
  unknown: styles.none ?? "",
};

export default function Semaphore({
  status,
  showLabel = false,
  size = "md",
}: SemaphoreProps): React.ReactElement {
  const label = STATUS_LABELS[status];

  return (
    <span className={styles.wrapper}>
      <span
        className={[
          styles.badge,
          CLASS_MAP[status],
          size === "sm" ? styles.sm : styles.md,
        ].join(" ")}
        role="img"
        aria-label={label}
      >
        {ICON_MAP[status]}
      </span>
      {showLabel && (
        <span className={[styles.label, CLASS_MAP[status]].join(" ")}>
          {label}
        </span>
      )}
    </span>
  );
}
