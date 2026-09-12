'use client'

/* ============================================================================
   FunnelStep — "cascata de retângulos"
   Redesenhado 09/09/2026 a partir do protótipo
   "Funil de Conversão · Protótipo HTML (Cascata de Retângulos)".

   Diferença central pro layout anterior: a barra de cada etapa ENCOLHE
   visualmente (100% → 85% → 60% → 30%), centralizada, em vez de sempre
   ocupar 100% da largura com um preenchimento interno proporcional. Os
   percentuais reais do funil são extremamente desiguais (100% → 1.9% →
   0.2% → 0%), então a largura da barra NÃO é 1:1 com o percentual real
   (uma barra de 0.2% de largura seria invisível) — é uma progressão
   decorativa fixa por etapa (ver BAR_WIDTH_PCT em FunnelChart.tsx), com o
   percentual real exibido como texto dentro da barra e no badge de queda.
   ============================================================================ */

import React from 'react'
import styles from './FunnelStep.module.css'
import type { FunnelStepDataExtended } from '@/types/orbit'

interface FunnelStepProps {
  step: FunnelStepDataExtended
  isLast?: boolean
  /** Largura decorativa da barra (cascata), não o percentual real. */
  barWidthPct: number
  /** "pessoas" | "cliques" | "vendas" — unidade exibida junto do valor. */
  unitLabel: string
}

function formatValue(v: number | string): string {
  if (typeof v === 'string') return v
  if (v == null || isNaN(v)) return '0'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toLocaleString('pt-BR')
}

export default function FunnelStep({ step, isLast = false, barWidthPct, unitLabel }: FunnelStepProps): React.ReactElement {
  const stepStyle = { '--step-color': step.color } as React.CSSProperties
  const hasNumericDropoff = step.dropoffPct != null

  return (
    <div className={styles.stepContainer} data-last={isLast}>
      {/* ✅ CORRIGIDO (bug de cascata, 09/09/2026): `.stepContainer` é
          flex-direction:column — aplicar `flexBasis` num filho dele
          controla a ALTURA (eixo principal em coluna), não a largura.
          A cascata "encolhendo" nunca funcionou de fato; era o bug por
          trás do desalinhamento do badge de queda no seu print. Trocado
          por `width` real + `margin:0 auto`, que centraliza e encolhe a
          etapa (bar + badge de queda juntos, mesmo contêiner) sem
          depender do eixo do flex do pai. */}
      <div className={styles.stepInner} style={{ ...stepStyle, width: `${barWidthPct}%` }}>
        <div className={styles.bar}>
          <div className={styles.barInfo}>
            <span className={styles.name}>{step.label}</span>
            <span className={styles.value}>
              {formatValue(step.value)} {unitLabel}
            </span>
          </div>
          <span className={styles.percentage}>{(step?.percentage ?? 0).toFixed(1)}%</span>
        </div>

        {(hasNumericDropoff || step.dropoffLabel) && (
          <div className={styles.dropoffWrap}>
            {hasNumericDropoff ? (
              <>
                <span className={styles.dropoffBadge}>{Math.round(step.dropoffPct as number)}%</span>
                <span className={styles.dropoffLabel}>queda</span>
              </>
            ) : (
              <span className={styles.dropoffNote}>{step.dropoffLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Conector visual entre etapas — reforça a leitura de funil/cascata
          (era código morto em CSS antes, nunca renderizado pelo JSX). */}
      {!isLast && <div className={styles.connector} aria-hidden="true" />}
    </div>
  )
}