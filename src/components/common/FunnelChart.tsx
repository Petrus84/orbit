import React from 'react';
import FunnelStep from './FunnelStep';
import type { FunnelStepData } from './FunnelStep';
import styles from './FunnelChart.module.css';

export interface FunnelData {
  alcance: number;
  visitas: number;
  cliques: number;
  vendas: number;
  ctrBio: number;
  taxaConv: number;
}

interface FunnelChartProps {
  data: FunnelData;
}

// Degradê blue → acc → amber → red, todos vindos do design system —
// nunca hex literal (antes: '#4A90FF', '#C8FF57', '#FFB020', '#FF4444').
const STEP_COLORS = ['var(--blue)', 'var(--acc)', 'var(--amber)', 'var(--red)'];

export default function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  const base = data.alcance || 1; // evita divisão por zero

  const steps: FunnelStepData[] = [
    { label: 'Alcance', value: data.alcance, percentage: 100, color: STEP_COLORS[0] },
    { label: 'Visitas ao perfil', value: data.visitas, percentage: (data.visitas / base) * 100, color: STEP_COLORS[1] },
    { label: 'Cliques no link', value: data.cliques, percentage: (data.cliques / base) * 100, color: STEP_COLORS[2] },
    { label: 'Vendas estimadas', value: data.vendas, percentage: (data.vendas / base) * 100, color: STEP_COLORS[3] },
  ];

  const overallConv = data.alcance > 0 ? ((data.vendas / data.alcance) * 100).toFixed(3) : '—';

  return (
    <div className={styles.list}>
      {steps.map((step, i) => (
        <FunnelStep key={step.label} step={step} isLast={i === steps.length - 1} />
      ))}

      <div className={styles.footer}>
        <span className={styles.footerLabel}>Conversão geral</span>
        <span className={styles.footerValue}>{overallConv}%</span>
      </div>
    </div>
  );
}