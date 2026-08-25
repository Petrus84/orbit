/* ==========================================================================
   ORBIT · Component — KPICard
   Renderiza: label + semaphore | GlowingNumber | DeltaText | subtitle
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

import React from 'react'
import { GlassCard }            from '@/components/common/GlassCard'
import { GlowingNumber }        from './GlowingNumber'
import { DeltaText }            from './DeltaText'
import { SemaphoreIndicator }   from './SemaphoreIndicator'
import styles                   from './KPICard.module.css'
import type { KPICardData }     from '@/types/orbit'

export interface KPICardProps {
  data: KPICardData
}

export function KPICard({ data }: KPICardProps) {
  const { label, value, unit, delta, deltaLabel, semaphore, glowColor, subtitle } = data

  return (
    <GlassCard glowColor={glowColor} className={styles.card}>
      {/* Linha 1: label + semáforo */}
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <SemaphoreIndicator color={semaphore} />
      </div>

      {/* Linha 2: número principal */}
      <div className={styles.valueRow}>
        <GlowingNumber value={value} color={glowColor} size="lg" />
      </div>

      {/* Linha 3: unidade (se existir) */}
      {unit && (
        <div className={styles.unit}>{unit}</div>
      )}

      {/* Linha 4: delta */}
      <div className={styles.deltaRow}>
        <DeltaText value={delta} label={deltaLabel} />
      </div>

      {/* Linha 5: subtítulo (se existir) */}
      {subtitle && (
        <div className={styles.subtitle}>{subtitle}</div>
      )}
    </GlassCard>
  )
}
