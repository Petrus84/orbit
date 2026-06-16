import React from 'react';

export interface SimulationResult {
  cliques: number;
  vendas: number;
  alcanceSimulado: number;
  ctrBio: number;
  taxaConv: number;
}

interface FunnelResultProps {
  result: SimulationResult;
  baseVendas: number; // real value to compare against
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return Math.round(v).toLocaleString('pt-BR');
}

export default function FunnelResult({ result, baseVendas }: FunnelResultProps): React.ReactElement {
  const delta = result.vendas - baseVendas;
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500';

  const insight =
    result.vendas > baseVendas * 1.5
      ? 'Potencial alto — vale aumentar o investimento em tráfego.'
      : result.vendas > baseVendas
      ? 'Cenário positivo — pequenos ajustes geram impacto real.'
      : result.vendas < baseVendas * 0.8
      ? 'Cenário desfavorável — revise CTR da bio ou taxa de conversão.'
      : 'Cenário similar ao atual.';

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#C8FF57]/20 bg-[#C8FF57]/5 p-4">
      {/* Big number */}
      <div className="flex flex-col gap-0.5">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Vendas estimadas
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-bold tabular-nums text-[#C8FF57] leading-none">
            {formatValue(result.vendas)}
          </span>
          <span className={`font-mono text-sm font-semibold tabular-nums ${deltaColor}`}>
            {deltaSign}{formatValue(delta)}
          </span>
        </div>
      </div>

      {/* Cliques secundário */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <span className="font-sans text-xs text-zinc-500">Cliques no link</span>
        <span className="font-mono text-sm font-bold tabular-nums text-amber-400">
          {formatValue(result.cliques)}
        </span>
      </div>

      {/* Insight text */}
      <p className="font-sans text-xs leading-relaxed text-zinc-400 border-t border-zinc-800 pt-3">
        💡 {insight}
      </p>
    </div>
  );
}
