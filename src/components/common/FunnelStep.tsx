import React from 'react';
import styles from './FunnelStep.module.css';

export interface FunnelStepData {
  label: string;
  value: number;
  percentage: number; // relativo à primeira etapa (alcance = 100%)
  /** Token de cor do design system, ex: 'var(--blue)', 'var(--acc)' — nunca hex solto. */
  color: string;
}

interface FunnelStepProps {
  step: FunnelStepData;
  isLast?: boolean;
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString('pt-BR');
}

export default function FunnelStep({ step, isLast = false }: FunnelStepProps): React.ReactElement {
  // --step-color é a única "cor dinâmica" do componente — e ela sempre chega
  // como um var(--token), nunca como hex. Isso preserva o SSOT mesmo com dado
  // variável por etapa (o CSS não pode saber de antemão qual token usar).
  const stepStyle = { '--step-color': step.color } as React.CSSProperties;

  return (
    <div className={styles.step}>
      <div className={styles.row}>
        <span className={styles.label}>{step.label}</span>
        <div className={styles.values}>
          <span className={styles.value}>{formatValue(step.value)}</span>
          <span className={styles.percentage} style={stepStyle}>
            {step.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className={styles.barWrap}>
        <div
          className={styles.barFill}
          style={{ ...stepStyle, width: `${Math.max(step.percentage, 0.5)}%` }}
        />
      </div>

      {!isLast && <div className={styles.connector} aria-hidden="true" />}
    </div>
  );
}