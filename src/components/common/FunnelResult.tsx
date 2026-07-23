import React from 'react';
import styles from './FunnelResult.module.css';

export interface SimulationResult {
  cliques: number;
  vendas: number;
  alcanceSimulado: number;
  ctrBio: number;
  taxaConv: number;
}

interface FunnelResultProps {
  result: SimulationResult;
  baseVendas: number; // valor real para comparação
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return Math.round(v).toLocaleString('pt-BR');
}

export default function FunnelResult({ result, baseVendas }: FunnelResultProps): React.ReactElement {
  const delta = result.vendas - baseVendas;
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaClass =
    delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : styles.deltaNeutral;

  const insight =
    result.vendas > baseVendas * 1.5
      ? 'Potencial alto — vale aumentar o investimento em tráfego.'
      : result.vendas > baseVendas
      ? 'Cenário positivo — pequenos ajustes geram impacto real.'
      : result.vendas < baseVendas * 0.8
      ? 'Cenário desfavorável — revise CTR da bio ou taxa de conversão.'
      : 'Cenário similar ao atual.';

  return (
    <div className={styles.card}>
      <div className={styles.headlineBlock}>
        <span className={styles.headlineLabel}>Vendas estimadas</span>
        <div className={styles.headlineRow}>
          <span className={styles.headline}>{formatValue(result.vendas)}</span>
          <span className={`${styles.delta} ${deltaClass}`}>
            {deltaSign}
            {formatValue(delta)}
          </span>
        </div>
      </div>

      <div className={styles.secondaryRow}>
        <span className={styles.secondaryLabel}>Cliques no link</span>
        <span className={styles.secondaryValue}>{formatValue(result.cliques)}</span>
      </div>

      <p className={styles.insight}>💡 {insight}</p>
    </div>
  );
}