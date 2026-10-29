/* ==========================================================================
   ORBIT · Component — GlowingNumber
   Exibe números com text-shadow neon em Space Mono.
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import styles from "./GlowingNumber.module.css";
import { formatPtBr } from "@/lib/format";
import type { GlowColor } from "@/types/orbit";

export type GlowingNumberSize = "sm" | "md" | "lg" | "xl" | "metric";

export interface GlowingNumberProps {
  value: number | string;
  unit?: string;
  color?: GlowColor | "plain";
  size?: GlowingNumberSize;
}

const COLOR_CLASS: Record<GlowColor | "plain", string> = {
  plain: styles.plain ?? "",
  cyan: styles.cyan ?? "",
  red: styles.red ?? "",
  gold: styles.gold ?? "",
  green: styles.green ?? "",
  none: styles.muted ?? "",
};

const SIZE_CLASS: Record<GlowingNumberSize, string> = {
  sm: styles.sizeSm ?? "",
  md: styles.sizeMd ?? "",
  lg: styles.sizeLg ?? "",
  xl: styles.sizeXl ?? "",
  metric: styles.sizeMetric ?? "",
};

export function GlowingNumber({
  value,
  unit,
  color = "cyan",
  size = "lg",
}: GlowingNumberProps) {
  const formattedValue =
    typeof value === "number" ? formatPtBr(value, 1) : value;

  return (
    <span className={styles.wrapper}>
      <span
        className={[styles.number, COLOR_CLASS[color], SIZE_CLASS[size]].join(
          " ",
        )}
      >
        {formattedValue}
      </span>
      {unit && <span className={styles.unit}>{unit}</span>}
    </span>
  );
}
