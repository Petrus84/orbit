import React from 'react';
import Slider from './Slider';
import FunnelResult from './FunnelResult';
import type { SimulationResult } from './FunnelResult';
import type { SetorBenchmark } from '@/types/orbit';
import styles from './FunnelSimulator.module.css';

export interface SimulatorState {
  ctrBio: number;
  taxaConv: number;
  alcance: number;
}

interface FunnelSimulatorProps {
  state: SimulatorState;
  onChange: (next: SimulatorState) => void;
  result: SimulationResult;
  baseVendas: number;
  alcanceRealHistorico: number;
  erRealNativo: number | null;
  setor: SetorBenchmark | null;
}

export default function FunnelSimulator({
  state,
  onChange,
  result,
  baseVendas,
  alcanceRealHistorico,
  erRealNativo,
}: FunnelSimulatorProps): React.ReactElement {
  const razaoEscala = state.alcance / (alcanceRealHistorico || 1);
  const isSaturated = razaoEscala > 1.5;
  const engajamentoEfetivo = erRealNativo !== null && erRealNativo > 0 ? erRealNativo : 1.5;

  const alphaBase = 0.25;
  const alphaDinamico = Math.max(0.1, alphaBase - engajamentoEfetivo * 0.02);
  const friccao = razaoEscala > 1 ? Math.pow(razaoEscala, alphaDinamico) : 1;

  const ctrReal = state.ctrBio / friccao;
  const convReal = state.taxaConv / friccao;

  const set = <K extends keyof SimulatorState>(key: K, value: SimulatorState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <div className={styles.wrap}>
      <div className={styles.diagnosticBox}>
        📊 SSOT: Métrica de Engajamento ({erRealNativo !== null ? 'Banco' : 'Benchmark'}):{' '}
        <strong className={styles.diagnosticStrong}>{engajamentoEfetivo}%</strong>
      </div>

      <div className={styles.slidersBlock}>
        <Slider label="CTR Alvo da Bio" min={0} max={20} step={0.1} value={state.ctrBio} onChange={(v) => set('ctrBio', v)} unit="%" />
        {razaoEscala > 1 && (
          <div className={styles.degradedHint}>↳ Degradado pela escala: {ctrReal.toFixed(2)}%</div>
        )}

        <Slider label="Taxa de Conversão" min={0} max={10} step={0.1} value={state.taxaConv} onChange={(v) => set('taxaConv', v)} unit="%" />
        {razaoEscala > 1 && (
          <div className={styles.degradedHint}>↳ Conversão real estimada: {convReal.toFixed(2)}%</div>
        )}

        <Slider label="Alcance Simulado" min={1000} max={500000} step={1000} value={state.alcance} onChange={(v) => set('alcance', v)} unit="" />
      </div>

      {isSaturated && (
        <div className={styles.saturationAlert}>
          ⚠️ <strong>Alerta de Saturação:</strong> Escala de público frio detectada fora da bolha
          histórica ({razaoEscala.toFixed(1)}x). A eficiência marginal caiu em função da Lei dos
          Rendimentos Decrescentes.
        </div>
      )}

      <FunnelResult result={result} baseVendas={baseVendas} />
    </div>
  );
}