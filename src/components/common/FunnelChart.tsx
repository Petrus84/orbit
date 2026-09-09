'use client'

import React from 'react'
import FunnelStep from './FunnelStep'
import type { FunnelStepDataExtended } from '@/types/orbit'
import styles from './FunnelChart.module.css'

export interface FunnelData {
  alcance: number
  visitas: number
  // ✅ CORRIGIDO 09/09 (TICKETS item 7) — number | null pra distinguir
  // "sem dado no período" (mostra "—") de "zero real" (mostra "0").
  cliques: number | null
  vendas: number | null
  taxaConv: number
  ticketMedio: number  // ✅ NOVO: R$ por venda
}

interface FunnelChartProps {
  data: FunnelData
}

// ✅ CORRIGIDO (harmonização de cores, 09/09/2026): antes usava
// ['var(--blue)', 'var(--acc)', 'var(--amber)', 'var(--red)']. `--acc` no
// protótipo HTML avulso era um alias de `--blue` (#18a0ff) — mas no SSOT
// real (ssot-design-tokens.css) `--acc` é #C8FF57 (verde-lima, cor de
// destaque de marca, sem relação com --blue). Isso injetava lima-neon na
// 2ª etapa do funil sem intenção. Trocado para o vocabulário GlowColor
// ('cyan'|'gold'|'red'|'none'), o mesmo já usado em KPICardData,
// QualityScoreItem, FormatPerformanceRow e no glow do próprio GlassCard
// deste painel (glowColor="cyan" em FunnelScreen.tsx) — etapas 1 e 2
// (informativas) usam o mesmo cyan do card; a partir da 3ª etapa (onde a
// queda vira relevante) entra gold, e a etapa crítica usa red.
const STEP_COLORS = ['var(--neon-cyan)', 'var(--neon-cyan)', 'var(--neon-gold)', 'var(--neon-red)']
const BAR_WIDTH_PCT = [100, 85, 60, 30] as const
const STEP_UNITS = ['pessoas', 'pessoas', 'cliques', 'vendas'] as const

/**
 * ✅ Calcula drop-off % entre duas etapas
 * Ex: 100 → 45 = 55% de queda
 * Retorna null quando `current` for null (sem dado), pra não fabricar
 * "100% de queda" a partir de ausência de dado.
 */
function calculateDropoff(current: number | null, previous: number): number | null {
  if (current == null) return null
  if (previous === 0) return 0
  return ((previous - current) / previous) * 100
}

export default function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  const base = data.alcance || 1

  // ✅ NOVO: Calcula drop-off entre etapas
  const dropoffVisitas = calculateDropoff(data.visitas, data.alcance)
  const dropoffCliques = calculateDropoff(data.cliques, data.visitas)
  const dropoffVendas = calculateDropoff(data.vendas, data.cliques ?? 0)

  const steps: FunnelStepDataExtended[] = [
    {
      label: 'Alcance',
      isLast: false,
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
      dropoffPct: dropoffVisitas ?? undefined,
      dropoffLabel: dropoffVisitas != null ? `↓ ${dropoffVisitas.toFixed(1)}% queda` : undefined,
    },
    {
      label: 'Cliques no link',
      value: data.cliques ?? '—',
      percentage: data.cliques != null ? (data.cliques / base) * 100 : 0,
      color: STEP_COLORS[2],
      dropoffPct: dropoffCliques ?? undefined,
      dropoffLabel: dropoffCliques != null ? `↓ ${dropoffCliques.toFixed(1)}% queda` : 'sem dado no período',
    },
    {
      label: 'Vendas estimadas',
      value: data.vendas ?? '—',
      percentage: data.vendas != null ? (data.vendas / base) * 100 : 0,
      color: STEP_COLORS[3],
      dropoffPct: dropoffVendas ?? undefined,
      dropoffLabel: dropoffVendas != null ? `↓ ${dropoffVendas.toFixed(1)}% queda` : 'sem dado no período',
    },
  ]

  const overallConv = data.alcance > 0 && data.vendas != null ? ((data.vendas / data.alcance) * 100).toFixed(3) : '—'
  const faturamentoEstimado = data.vendas != null ? data.vendas * data.ticketMedio : null

  return (
    <div className={styles.list}>
      {steps.map((step, i) => (
        <FunnelStep
          key={step.label}
          step={step}
          isLast={i === steps.length - 1}
          barWidthPct={BAR_WIDTH_PCT[i]}
          unitLabel={STEP_UNITS[i]}
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
            {faturamentoEstimado != null
              ? `R$ ${faturamentoEstimado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}