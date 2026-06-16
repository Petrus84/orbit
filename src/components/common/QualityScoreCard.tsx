import React from 'react';

export interface QualityScore {
  label: string;
  value: number | null;
  status: 'ok' | 'neutral' | 'warn';
  statusText: string;
}

interface QualityScoreCardProps {
  score: QualityScore;
}

type StatusTokens = {
  ring: string;
  valueBg: string;
  valueText: string;
  dot: string;
  statusText: string;
};

const STATUS_TOKENS: Record<QualityScore['status'], StatusTokens> = {
  ok: {
    ring:       'border-emerald-500/30',
    valueBg:    'bg-emerald-900/20',
    valueText:  'text-emerald-400',
    dot:        'bg-emerald-400 shadow-[0_0_6px_2px_rgba(46,204,113,0.45)]',
    statusText: 'text-emerald-400/80',
  },
  neutral: {
    ring:       'border-zinc-700',
    valueBg:    'bg-zinc-800/40',
    valueText:  'text-zinc-300',
    dot:        'bg-zinc-500',
    statusText: 'text-zinc-500',
  },
  warn: {
    ring:       'border-amber-500/30',
    valueBg:    'bg-amber-900/20',
    valueText:  'text-amber-400',
    dot:        'bg-amber-400 shadow-[0_0_6px_2px_rgba(255,176,32,0.45)]',
    statusText: 'text-amber-400/80',
  },
};

export default function QualityScoreCard({ score }: QualityScoreCardProps): React.ReactElement {
  const tokens = STATUS_TOKENS[score.status];
  const displayValue = score.value === null ? 'N/A' : `${score.value.toFixed(2)}%`;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border bg-[#18181F] p-4 ${tokens.ring}`}>
      {/* Label */}
      <span className="font-sans text-xs font-medium uppercase tracking-widest text-zinc-500">
        {score.label}
      </span>

      {/* Value pill */}
      <div className={`flex w-fit items-center rounded-xl px-3 py-1.5 ${tokens.valueBg}`}>
        <span className={`font-mono text-xl font-bold tabular-nums leading-none ${tokens.valueText}`}>
          {displayValue}
        </span>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${tokens.dot}`} aria-hidden="true" />
        <span className={`font-sans text-xs leading-snug ${tokens.statusText}`}>
          {score.statusText}
        </span>
      </div>
    </div>
  );
}
