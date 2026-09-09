'use client'

import React from 'react'
import FunnelStep from './FunnelStep'
import type { FunnelStepDataExtended } from '@/types/orbit'
import styles from './FunnelChart.module.css'

export interface FunnelData {
  alcance: number
  visitas: number
  cliques: number
  vendas: number
  ctrBio: number
  taxaConv: number
  ticketMedio: number  // ✅ NOVO: R$ por venda
}

interface FunnelChartProps {
  data: FunnelData
}

const STEP_COLORS = ['var(--blue)', 'var(--acc)', 'var(--amber)', 'var(--red)']

/**
 * ✅ Calcula drop-off % entre duas etapas
 * Ex: 100 → 45 = 55% de queda
 */
function calculateDropoff(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((previous - current) / previous) * 100
}

export default function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  const base = data.alcance || 1

  // ✅ NOVO: Calcula drop-off entre etapas
  const dropoffVisitas = calculateDropoff(data.visitas, data.alcance)
  const dropoffCliques = calculateDropoff(data.cliques, data.visitas)
  const dropoffVendas = calculateDropoff(data.vendas, data.cliques)

  const steps: FunnelStepDataExtended[] = [
    {
      label: 'Alcance',
      value: data.alcance,
      percentage: 100,
      color: STEP_COLORS[0],
      dropoffPct: undefined,  // Primeira etapa não tem drop-off
    },
    {
      label: 'Visitas ao perfil',
      value: data.visitas,
      percentage: (data.visitas / base) * 100,
      color: STEP_COLORS[1],
      dropoffPct: dropoffVisitas,
      dropoffLabel: `↓ ${dropoffVisitas.toFixed(1)}% queda`,
    },
    {
      label: 'Cliques no link',
      value: data.cliques,
      percentage: (data.cliques / base) * 100,
      color: STEP_COLORS[2],
      dropoffPct: dropoffCliques,
      dropoffLabel: `↓ ${dropoffCliques.toFixed(1)}% queda`,
    },
    {
      label: 'Vendas estimadas',
      value: data.vendas,
      percentage: (data.vendas / base) * 100,
      color: STEP_COLORS[3],
      dropoffPct: dropoffVendas,
      dropoffLabel: `↓ ${dropoffVendas.toFixed(1)}% queda`,
    },
  ]

  const overallConv = data.alcance > 0 ? ((data.vendas / data.alcance) * 100).toFixed(3) : '—'
  const faturamentoEstimado = data.vendas * data.ticketMedio

  return (
    <div className={styles.list}>
      {steps.map((step, i) => (
        <FunnelStep
          key={step.label}
          step={step}
          isLast={i === steps.length - 1}
        />
      ))}

      <div className={styles.footer}>
        <div className={styles.footerStat}>
          <span className={styles.footerLabel}>Conversão geral</span>
          <span className={styles.footerValue}>{overallConv}%</span>
        </div>

        <div className={styles.footerDivider} aria-hidden="true" />

        <div className={styles.footerStat}>
          <span className={styles.footerLabel}>Faturamento estimado</span>
          <span className={styles.footerValue}>
            R$ {faturamentoEstimado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </div>
  )
}
