/* ==========================================================================
   ORBIT · Component — GlassCard
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import { type ReactNode, type MouseEventHandler } from "react";
import styles from "./GlassCard.module.css";
import type { GlowColor } from "@/types/orbit";

export interface GlassCardProps {
  children: ReactNode;
  glowColor?: GlowColor;
  className?: string | undefined;
  onClick?: MouseEventHandler<HTMLDivElement>;
  role?: string;
  tabIndex?: number;
  "aria-label"?: string | undefined;
  "data-testid"?: string | undefined;
}

const GLOW_CLASS: Record<GlowColor, string> = {
  cyan: styles.glowCyan ?? "",
  red: styles.glowRed ?? "",
  gold: styles.glowGold ?? "",
  green: styles.glowGreen ?? "",
  none: styles.glowNone ?? "",
};

export function GlassCard({
  children,
  glowColor = "none",
  className,
  onClick,
  role,
  tabIndex,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: GlassCardProps) {
  return (
    <div
      className={[styles.card, GLOW_CLASS[glowColor], className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}
