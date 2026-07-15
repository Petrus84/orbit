// src/components/common/FunnelChart.tsx
'use client'

import React from 'react'
import FunnelStep from './FunnelStep'
import type { FunnelData, FunnelStep as FunnelStepType } from '@/types/orbit'
import type { FunnelStepData } from './FunnelStep'

interface FunnelChartProps {
  data: FunnelData
}

/**
 * ✅ Adapter: Transforma FunnelStep (orbit.ts) → FunnelStepData (FunnelStep.tsx espera)
 * 
 * Mapeamento:
 * - FunnelStep.label (orbit) → FunnelStepData.label
 * - FunnelStep.value (orbit, null | number) → FunnelStepData.value (number, null → 0)
 * - FunnelStep.percentage (orbit) → FunnelStepData.percentage
 * - FunnelStep.color (orbit, hex) → FunnelStepData.color (hex)
 * - glowColor gerado: hex → rgba com alpha 0.4
 * 
 * Descartados:
 * - FunnelStep.id (não usado em renderização)
 * - FunnelStep.icon (não usado em renderização)
 */
function adaptStepToData(step: FunnelStepType): FunnelStepData {
  /**
   * ✅ Converte hex color (#RRGGBB) para rgba(r, g, b, a)
   * Exemplo: '#8B5CF6' → 'rgba(139, 92, 246, 0.4)'
   */
  const hexToRgba = (hex: string, alpha: number = 0.4): string => {
    // Remove '#' se existir
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex

    // Valida formato hex
    if (!/^[0-9A-F]{6}$/i.test(cleanHex)) {
      // Fallback se hex inválido
      return `rgba(139, 92, 246, ${alpha})`
    }

    const r = parseInt(cleanHex.slice(0, 2), 16)
    const g = parseInt(cleanHex.slice(2, 4), 16)
    const b = parseInt(cleanHex.slice(4, 6), 16)

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return {
    label: step.label,
    value: step.value ?? 0, // ✅ null → 0 (FunnelStep.tsx espera number)
    percentage: step.percentage,
    color: step.color,
    glowColor: hexToRgba(step.color, 0.4),
  }
}

/**
 * ✅ FunnelChart renderiza a estrutura canônica baseada em steps[]
 * Adapta cada step para o formato que FunnelStep.tsx espera
 */
export default function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  if (!data || data.steps.length === 0) {
    return (
      <div className="text-center text-sm text-zinc-500">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {data.steps.map((step, index) => (
        <FunnelStep
          key={step.id}
          step={adaptStepToData(step)}
          isLast={index === data.steps.length - 1}
        />
      ))}
    </div>
  )
}
