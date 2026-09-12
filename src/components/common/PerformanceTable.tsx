import React from 'react';

export interface PerformanceMetric {
  format: string;
  postCount: number;
  shareCount: number;
  trend: string;
  trendColor?: 'cyan' | 'red' | 'gold' | undefined;
}

interface PerformanceTableProps {
  metrics: PerformanceMetric[];
}

const TREND_COLOR_MAP: Record<NonNullable<PerformanceMetric['trendColor']>, string> = {
  cyan: 'text-cyan-400',
  red:  'text-red-400',
  gold: 'text-amber-400',
};

const FORMAT_ICON: Record<string, string> = {
  REELS:     '🎬',
  IMAGE:     '🖼',
  CAROUSEL:  '📑',
  STORIES:   '⭕',
  VIDEO:     '▶',
};

function getFormatIcon(format: string): string {
  return FORMAT_ICON[format.toUpperCase()] ?? '📄';
}

export default function PerformanceTable({ metrics }: PerformanceTableProps): React.ReactElement {
  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-[#18181F] py-10">
        <p className="font-sans text-sm text-zinc-600">Sem dados de performance disponíveis.</p>
      </div>
    );
  }

  const totalPosts  = metrics.reduce((s, m) => s + m.postCount,  0);
  const totalShares = metrics.reduce((s, m) => s + m.shareCount, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#18181F]">
      {/* Table header */}
      <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 px-4 py-2.5">
        {(['Formato', 'Posts', 'Shares', 'Trend'] as const).map((col) => (
          <span
            key={col}
            className="font-sans text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
          >
            {col}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-800/60">
        {metrics.map((metric) => {
          const trendClass = metric.trendColor
            ? TREND_COLOR_MAP[metric.trendColor]
            : 'text-zinc-400';

          return (
            <div
              key={metric.format}
              className="grid grid-cols-4 items-center gap-2 px-4 py-3 transition-colors hover:bg-zinc-800/30"
            >
              {/* Format */}
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{getFormatIcon(metric.format)}</span>
                <span className="font-sans text-sm font-medium text-zinc-200 capitalize">
                  {metric.format.charAt(0).toUpperCase() + metric.format.slice(1).toLowerCase()}
                </span>
              </div>

              {/* Posts */}
              <span className="font-mono text-sm tabular-nums text-zinc-300">
                {metric.postCount}
              </span>

              {/* Shares */}
              <span className="font-mono text-sm tabular-nums text-zinc-300">
                {metric.shareCount}
              </span>

              {/* Trend */}
              <span className={`font-sans text-xs font-medium ${trendClass}`}>
                {metric.trend}
              </span>
            </div>
          );
        })}
      </div>

      {/* Totals footer */}
      <div className="grid grid-cols-4 gap-2 border-t border-zinc-800 bg-zinc-900/30 px-4 py-2.5">
        <span className="font-sans text-xs font-semibold text-zinc-500">Total</span>
        <span className="font-mono text-xs font-semibold tabular-nums text-zinc-400">
          {totalPosts}
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-zinc-400">
          {totalShares}
        </span>
        <span />
      </div>
    </div>
  );
}
