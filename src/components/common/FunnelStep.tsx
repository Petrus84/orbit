import React from 'react';

export interface FunnelStepData {
  label: string;
  value: number;
  percentage: number; // relative to first step (alcance = 100%)
  color: string;      // hex
  glowColor: string;  // rgba string for box-shadow
}

interface FunnelStepProps {
  step: FunnelStepData;
  isLast?: boolean;
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString('pt-BR');
}

export default function FunnelStep({ step, isLast = false }: FunnelStepProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Label + value row */}
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs font-medium text-zinc-400">{step.label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-bold tabular-nums text-white">
            {formatValue(step.value)}
          </span>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: step.color }}>
            {step.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(step.percentage, 0.5)}%`,
            backgroundColor: step.color,
            boxShadow: `0 0 8px 1px ${step.glowColor}`,
          }}
        />
      </div>

      {/* Connector line to next step */}
      {!isLast && (
        <div className="mx-auto h-3 w-px bg-zinc-800" aria-hidden="true" />
      )}
    </div>
  );
}
