
import React from 'react';
import { AlignmentBar as AlignmentBarType } from '../../types/avatar';

interface AlignmentBarProps {
  bar: AlignmentBarType;
}

// ✅ Mapear AlignmentColor ('green' | 'amber' | 'red') → STATUS_COLORS
const COLOR_TO_STATUS = {
  green: 'healthy',
  amber: 'warning',
  red: 'critical',
} as const;

// ✅ STATUS_COLORS com chaves corretas
const STATUS_COLORS = {
  critical: {
    realBar: 'bg-rose-500',
    alignment: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-500',
  },
  warning: {
    realBar: 'bg-amber-500',
    alignment: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  healthy: {
    realBar: 'bg-emerald-500',
    alignment: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
} as const;

export const AlignmentBar: React.FC<AlignmentBarProps> = ({ bar }) => {
  // ✅ DEBUG: Log para ver o que está chegando
  console.log('AlignmentBar received:', { 
    label: bar.label, 
    color: bar.color,
    variance: bar.variance,
    expected: bar.expected,
    real: bar.real,
  });

  // ✅ SEGURANÇA: Validar e fazer fallback
  const status = COLOR_TO_STATUS[bar.color as keyof typeof COLOR_TO_STATUS] ?? 'healthy';
  
  console.log('Mapped status:', status);
  
  const colors = STATUS_COLORS[status];
  
  console.log('Colors object:', colors);

  if (!colors) {
    // ✅ CORRIGIDO: Usar template literals
    console.error(`❌ ERRO: colors é undefined para status: "${status}"`);
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded text-red-300">
        Erro ao renderizar barra: status inválido &quot;{status}&quot;
      </div>
    );
  }

  const alignmentPct = Math.max(0, Math.round(100 - bar.variance));

  return (
    <div className="space-y-2">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-sm font-medium text-gray-300">{bar.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Esperado:{' '}
            <span className="text-violet-400 font-semibold">{bar.expected}%</span>
          </span>
          <span className="text-xs text-gray-500">
            Real:{' '}
            <span className={`font-semibold ${colors.alignment}`}>
              {bar.real}%
            </span>
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-5 rounded-full bg-gray-800 overflow-hidden">
        {/* Expected bar (background reference) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-violet-900/70 transition-all duration-700"
          style={{ width: `${bar.expected}%` }}
          title={`Esperado: ${bar.expected}%`}
        />
        {/* Real bar (overlay) */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full opacity-90 transition-all duration-700 ${colors.realBar}`}
          style={{ width: `${bar.real}%` }}
          title={`Real: ${bar.real}%`}
        />
        {/* Expected marker line */}
        <div
          className="absolute inset-y-0 w-0.5 bg-violet-400/80 z-10"
          style={{ left: `${bar.expected}%` }}
          title="Linha alvo"
        />
      </div>

      {/* Alignment score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Alinhamento:</span>
          <span
            className={`text-xs font-bold border rounded px-1.5 py-0.5 ${colors.badge}`}
          >
            {alignmentPct}%
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1.5 rounded-sm bg-violet-900" />
            Esperado
          </span>
          <span className="flex items-center gap-1">
            <span className={`inline-block w-3 h-1.5 rounded-sm ${colors.realBar}`} />
            Real
          </span>
        </div>
      </div>
    </div>
  );
};
