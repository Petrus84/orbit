import React from 'react';

interface FatigueIndicatorProps {
  fatigue: number; // 0–100 percentage
}

type FatigueLevel = 'healthy' | 'warning' | 'critical';

function getLevel(fatigue: number): FatigueLevel {
  if (fatigue >= 40) return 'critical';
  if (fatigue >= 20) return 'warning';
  return 'healthy';
}

const LEVEL_TOKENS: Record<FatigueLevel, { bg: string; text: string; border: string; label: string }> = {
  healthy:  { bg: 'bg-emerald-900/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Saudável'  },
  warning:  { bg: 'bg-amber-900/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Atenção'   },
  critical: { bg: 'bg-red-900/20',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Fatigado'  },
};

export default function FatigueIndicator({ fatigue }: FatigueIndicatorProps): React.ReactElement {
  const level = getLevel(fatigue);
  const t = LEVEL_TOKENS[level];

  return (
    <div className="flex items-center gap-2">
      {/* Mini bar */}
      <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            level === 'healthy' ? 'bg-emerald-500' : level === 'warning' ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(fatigue, 100)}%` }}
        />
      </div>
      {/* Badge */}
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold ${t.bg} ${t.text} ${t.border}`}
      >
        {fatigue.toFixed(0)}%
      </span>
    </div>
  );
}
