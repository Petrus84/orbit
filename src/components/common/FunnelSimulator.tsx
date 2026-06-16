import React from 'react';
import Slider from './Slider';
import FunnelResult from './FunnelResult';
import type { SimulationResult } from './FunnelResult';

export interface SimulatorState {
  ctrBio: number;    // % — profile visit rate (0–20)
  taxaConv: number;  // % — conversion rate (0–10)
  alcance: number;   // absolute reach value
}

interface FunnelSimulatorProps {
  state: SimulatorState;
  onChange: (next: SimulatorState) => void;
  result: SimulationResult;
  baseVendas: number;
}

export default function FunnelSimulator({
  state,
  onChange,
  result,
  baseVendas,
}: FunnelSimulatorProps): React.ReactElement {
  const set = <K extends keyof SimulatorState>(key: K, value: SimulatorState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <div className="flex flex-col gap-6">
      {/* Sliders */}
      <div className="flex flex-col gap-5">
        <Slider
          label="CTR da Bio (visitas / alcance)"
          min={0}
          max={20}
          step={0.1}
          value={state.ctrBio}
          onChange={(v) => set('ctrBio', v)}
          unit="%"
        />
        <Slider
          label="Taxa de conversão (vendas / cliques)"
          min={0}
          max={10}
          step={0.1}
          value={state.taxaConv}
          onChange={(v) => set('taxaConv', v)}
          unit="%"
        />
        <Slider
          label="Alcance simulado"
          min={1_000}
          max={500_000}
          step={1_000}
          value={state.alcance}
          onChange={(v) => set('alcance', v)}
          formatDisplay={(v) =>
            v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)
          }
          unit=""
        />
      </div>

      {/* Live result */}
      <FunnelResult result={result} baseVendas={baseVendas} />
    </div>
  );
}
