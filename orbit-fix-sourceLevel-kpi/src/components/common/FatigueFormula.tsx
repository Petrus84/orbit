import React from 'react';

export default function FatigueFormula(): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[var(--bg-card)] p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="font-sans text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Fórmula de fadiga criativa
        </span>
      </div>

      {/* Formula block */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
        <pre className="font-mono text-sm leading-relaxed text-zinc-200 whitespace-nowrap">
          <span className="text-[var(--acc)]">fadiga</span>
          <span className="text-zinc-500">{' = '}</span>
          <span className="text-white">(</span>
          <span className="text-amber-400">CTR_semana1</span>
          <span className="text-zinc-500">{' − '}</span>
          <span className="text-red-400">CTR_atual</span>
          <span className="text-white">)</span>
          <span className="text-zinc-500">{' / '}</span>
          <span className="text-amber-400">CTR_semana1</span>
          <span className="text-zinc-500">{' × '}</span>
          <span className="text-white">100</span>
        </pre>
      </div>

      {/* Thresholds legend */}
      <div className="flex flex-wrap gap-3">
        {[
          { range: '0–19%',  label: 'Saudável',  dot: 'bg-emerald-400' },
          { range: '20–39%', label: 'Atenção',   dot: 'bg-amber-400'   },
          { range: '≥ 40%',  label: 'Fatigado',  dot: 'bg-red-400'     },
        ].map(({ range, label, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
            <span className="font-mono text-[10px] text-zinc-500">{range}</span>
            <span className="font-sans text-[10px] text-zinc-600">— {label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
