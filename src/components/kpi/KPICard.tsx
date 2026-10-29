import React from "react";
import { formatIntegerPtBr, formatPtBr, formatCompactPtBr } from "@/lib/format";
import { provenanceLine } from "@/lib/provenanceText";
import type { MetricProvenance } from "@/types/orbit";
import { GlassCard } from "@/components/common/GlassCard";

export type FlagLevel = "L0" | "L1" | "L2";

export interface KPI {
  label: string;
  value: number | string;
  delta?: number;
  trend?: "up" | "down" | "neutral";
  flagLevel: FlagLevel;
  valueFormat?: "compact" | "integer";
  unit?: string;
  sparkline?: number[]; // series of values for the mini chart
  /** false = delta nulo na view: exibe "Comparação ainda indisponível", nunca 0%. */
  hasComparison?: boolean;
  provenance?: MetricProvenance;
}

interface KPICardProps {
  kpi: KPI;
}

// ─── Flag badge ───────────────────────────────────────────────

const FLAG_TOKENS: Record<
  FlagLevel,
  { bg: string; text: string; label: string }
> = {
  L0: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Medido" },
  L1: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Estimado" },
  L2: { bg: "bg-red-500/20", text: "text-red-400", label: "Hipótese" },
};

// ─── Delta arrow ──────────────────────────────────────────────

const DELTA_TOKENS: Record<
  "up" | "down" | "neutral",
  { color: string; arrow: string }
> = {
  up: { color: "text-emerald-400", arrow: "↑" },
  down: { color: "text-red-400", arrow: "↓" },
  neutral: { color: "text-[var(--text-dim)]", arrow: "→" },
};

// ─── Sparkline ────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  trend: "up" | "down" | "neutral";
}

function Sparkline({ data, trend }: SparklineProps): React.ReactElement | null {
  if (data.length < 2) return null;

  const W = 64;
  const H = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const strokeColor =
    trend === "up"
      ? "var(--green)"
      : trend === "down"
        ? "var(--red)"
        : "var(--text-dim)";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={points}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ─── Value formatter ──────────────────────────────────────────

function formatValue(
  value: number | string,
  valueFormat: KPI["valueFormat"],
): string {
  if (typeof value === "string") return value;
  if (valueFormat === "integer") return formatIntegerPtBr(value);
  return formatCompactPtBr(value);
}

// ─── Component ────────────────────────────────────────────────

export default function KPICard({ kpi }: KPICardProps): React.ReactElement {
  const flag = FLAG_TOKENS[kpi.flagLevel];
  const deltaTokens = kpi.trend ? DELTA_TOKENS[kpi.trend] : null;
  // ✅ FIX: antes havia um `defaultSparkline` fixo ([40,42,38,45,43,47,44,50])
  // usado sempre que `kpi.sparkline` era undefined — como nenhum caller real
  // preenche esse campo hoje, todo KPICard exibia o mesmo mini-gráfico fixo,
  // sem relação com o número ao lado. Agora, sem série real, não renderiza
  // sparkline nenhum — "sem dado de série" honesto em vez de tendência
  // fabricada. Quando `KPICardData` ganhar `sparkline?: number[]` populado
  // com dado real, ele passa a aparecer automaticamente.

  return (
    <GlassCard glowColor="cyan" className="flex flex-col gap-3">
      {/* Header row: label + flag */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-[length:var(--font-size-xs)] font-medium uppercase tracking-[0.03em] text-[var(--text-dim)]">
          {kpi.label}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${flag.bg} ${flag.text}`}
        >
          {flag.label}
        </span>
      </div>

      {/* Value row */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[length:var(--font-size-metric)] font-bold tabular-nums text-[var(--t0)] leading-none">
            {formatValue(kpi.value, kpi.valueFormat)}
            {kpi.unit && (
              <span className="ml-0.5 font-sans text-[length:var(--font-size-base)] font-normal text-[var(--text-dim)]">
                {kpi.unit}
              </span>
            )}
          </span>

          {/* Delta */}
          {kpi.hasComparison === false ? (
            <span className="font-sans text-[length:var(--font-size-sm)] font-normal text-[var(--text-muted)]">
              Comparação ainda indisponível
            </span>
          ) : (
            kpi.delta !== undefined &&
            deltaTokens && (
              <span
                className={`font-sans text-[length:var(--font-size-sm)] font-normal ${deltaTokens.color}`}
              >
                {deltaTokens.arrow} {formatPtBr(Math.abs(kpi.delta), 1)}%{" "}
                <span className="text-[var(--text-muted)]">
                  em relação ao período anterior
                </span>
              </span>
            )
          )}
        </div>

        {/* Sparkline — só renderiza com série real; sem dado, sem gráfico fabricado */}
        {kpi.sparkline && kpi.sparkline.length >= 2 && (
          <Sparkline data={kpi.sparkline} trend={kpi.trend ?? "neutral"} />
        )}
      </div>

      {kpi.provenance && (
        <p
          className="font-sans text-[10px] leading-snug text-[var(--text-muted)]"
          title={kpi.provenance.method}
        >
          {provenanceLine(kpi.provenance)}
        </p>
      )}
    </GlassCard>
  );
}
