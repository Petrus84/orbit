import React from 'react';
import FunnelStep from './FunnelStep';
import type { FunnelStepData } from './FunnelStep';

export interface FunnelData {
  alcance: number;
  visitas: number;
  cliques: number;
  vendas: number;
  ctrBio: number;
  taxaConv: number;
}

interface FunnelChartProps {
  data: FunnelData;
}

// Blue → Amber → Red degradation palette
const STEP_COLORS: { color: string; glow: string }[] = [
  { color: '#4A90FF', glow: 'rgba(74,144,255,0.45)'  }, // alcance  — blue
  { color: '#C8FF57', glow: 'rgba(200,255,87,0.35)'  }, // visitas  — lime
  { color: '#FFB020', glow: 'rgba(255,176,32,0.45)'  }, // cliques  — amber
  { color: '#FF4444', glow: 'rgba(255,68,68,0.45)'   }, // vendas   — red
];

export default function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  const base = data.alcance || 1; // avoid div-by-zero

  const steps: FunnelStepData[] = [
    {
      label:      'Alcance',
      value:      data.alcance,
      percentage: 100,
      color:      STEP_COLORS[0].color,
      glowColor:  STEP_COLORS[0].glow,
    },
    {
      label:      'Visitas ao perfil',
      value:      data.visitas,
      percentage: (data.visitas / base) * 100,
      color:      STEP_COLORS[1].color,
      glowColor:  STEP_COLORS[1].glow,
    },
    {
      label:      'Cliques no link',
      value:      data.cliques,
      percentage: (data.cliques / base) * 100,
      color:      STEP_COLORS[2].color,
      glowColor:  STEP_COLORS[2].glow,
    },
    {
      label:      'Vendas estimadas',
      value:      data.vendas,
      percentage: (data.vendas / base) * 100,
      color:      STEP_COLORS[3].color,
      glowColor:  STEP_COLORS[3].glow,
    },
  ];

  // Conversion rate summary
  const overallConv = data.alcance > 0
    ? ((data.vendas / data.alcance) * 100).toFixed(3)
    : '—';

  return (
    <div className="flex flex-col gap-1">
      {steps.map((step, i) => (
        <FunnelStep key={step.label} step={step} isLast={i === steps.length - 1} />
      ))}

      {/* Footer: overall conversion rate */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <span className="font-sans text-xs text-zinc-500">Conversão geral</span>
        <span className="font-mono text-xs font-semibold tabular-nums text-zinc-300">
          {overallConv}%
        </span>
      </div>
    </div>
  );
}
