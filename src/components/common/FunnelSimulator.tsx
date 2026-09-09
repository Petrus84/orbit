'use client'

import React from 'react';
import Slider from './Slider';
import type { SetorBenchmark } from '@/types/orbit';
import styles from './FunnelSimulator.module.css';

interface SaturationOutput {
  razaoEscala: number;
  isSaturated: boolean;
  engajamentoEfetivo: number;
  ctrEfetivo: number;
  convEfetivo: number;
}

export interface SimulatorState {
  ctrBio: number;
  taxaConv: number;
  alcance: number;
  /**
   * Ticket médio (R$) — premissa única aplicada ao cenário real e ao
   * simulado (ver nota em FunnelResult.tsx). Editável aqui porque não há,
   * ainda, receita real vinda do banco.
   */
  ticketMedio: number;
}

interface FunnelSimulatorProps {
  state: SimulatorState;
  onChange: (next: SimulatorState) => void;
  /**
   * Calculado por src/lib/funnelMath.ts (fonte única) e passado pronto —
   * este componente só exibe. Antes, FunnelSimulator recalculava a mesma
   * coisa localmente só para o texto de aviso, e esse cálculo paralelo
   * nunca alimentava o resultado real (era puro teatro visual). Ver
   * FunnelScreen.tsx.
   */
  saturation: SaturationOutput;
  erRealNativo: number | null;
  setor: SetorBenchmark | null;
}

// ✅ MOVIDO (09/09/2026): `result`/`baseVendas`/`baseCliques`/`onSaveGoal`
// saíram daqui — este componente parou de renderizar <FunnelResult> (era a
// "continuação" do card do simulador que misturava premissas com
// resultado/receita). FunnelResult agora é um terceiro card próprio,
// renderizado direto por FunnelScreen.tsx, que já tem tudo que ele precisa.
export default function FunnelSimulator({
  state,
  onChange,
  saturation,
  erRealNativo,
}: FunnelSimulatorProps): React.ReactElement {
  const { razaoEscala, isSaturated, engajamentoEfetivo, ctrEfetivo, convEfetivo } = saturation;

  const set = <K extends keyof SimulatorState>(key: K, value: SimulatorState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <div className={styles.wrap}>
      <div className={styles.diagnosticBox}>
        SSOT · Métrica de engajamento ({erRealNativo !== null ? 'Banco' : 'Benchmark'}):{' '}
        <strong className={styles.diagnosticStrong}>{engajamentoEfetivo}%</strong>
      </div>

      {/* ✅ REORDENADO (09/09/2026): premissas agora seguem a MESMA ordem
          do funil real (FunnelChart.tsx / dados de useFunnel): Alcance →
          Visita/Clique → Venda. Antes a ordem era CTR bio → Conversão →
          Alcance → Ticket, o que colocava o resultado do topo do funil
          (Alcance) depois de duas taxas que dependem dele — invertido em
          relação ao card "Funil Real" ao lado. Ticket médio continua por
          último por ser uma premissa financeira (R$/venda), não uma etapa
          do funil. */}
      <div className={styles.slidersBlock}>
        <div className={styles.sliderGroup}>
          <Slider
            label="Alcance simulado"
            helpText="Quantas pessoas a publicação ou campanha deve alcançar."
            min={1000}
            max={500000}
            step={1000}
            value={state.alcance}
            onChange={(v) => set('alcance', v)}
            unit=""
          />
        </div>

        <div className={styles.sliderGroup}>
          <Slider
            label="CTR alvo da bio"
            helpText="A porcentagem de pessoas que devem clicar no link depois de visitar a bio."
            min={0}
            max={20}
            step={0.1}
            value={state.ctrBio}
            onChange={(v) => set('ctrBio', v)}
            unit="%"
          />
          {razaoEscala > 1 && (
            <div className={styles.degradedHint}>
              ↳ Aplicado na simulação: {ctrEfetivo.toFixed(2)}% (degradado pela escala)
            </div>
          )}
        </div>

        <div className={styles.sliderGroup}>
          <Slider
            label="Taxa de conversão"
            helpText="A porcentagem de cliques que pode virar uma venda."
            min={0}
            max={10}
            step={0.1}
            value={state.taxaConv}
            onChange={(v) => set('taxaConv', v)}
            unit="%"
          />
          {razaoEscala > 1 && (
            <div className={styles.degradedHint}>
              ↳ Aplicado na simulação: {convEfetivo.toFixed(2)}% (degradado pela escala)
            </div>
          )}
        </div>

        <div className={styles.sliderGroup}>
          <Slider
            label="Ticket médio (R$)"
            helpText="O valor médio estimado de cada venda."
            min={10}
            max={1000}
            step={5}
            value={state.ticketMedio}
            onChange={(v) => set('ticketMedio', v)}
            formatDisplay={(v) => `R$ ${v.toFixed(0)}`}
          />
        </div>
      </div>

      {isSaturated && (
        <div className={styles.saturationAlert}>
          <strong>Alerta de saturação:</strong> escala de público frio detectada fora da bolha
          histórica ({razaoEscala.toFixed(1)}x). O CTR e a conversão acima já estão sendo
          reduzidos nas vendas estimadas — não é só um aviso, é o número que você está vendo.
        </div>
      )}

      <div className={styles.footerActions}>
        <button type="button" className={styles.exportBtn}>
          Exportar Cenário
        </button>
      </div>
    </div>
  );
}