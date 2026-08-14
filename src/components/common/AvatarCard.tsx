// src/components/common/AvatarCard.tsx

import React from 'react'
import type { AvatarProfile, AlignmentStatus } from '../../types/avatar'
import styles from './AvatarCard.module.css'

export interface AvatarCardProps {
  profile: AvatarProfile
  title: string
  variant: 'expected' | 'real'
  status: AlignmentStatus
  insightLabel: string
  insightText: string
}

const STATUS_GLOW_MAP: Record<AlignmentStatus, 'cyan' | 'gold' | 'red' | 'none'> = {
  healthy: 'cyan',
  warning: 'gold',
  critical: 'red',
}

const VARIANT_ICON_MAP: Record<'expected' | 'real', string> = {
  expected: '👤',
  real: '📊',
}

// ✅ HELPER: Encontrar a faixa etária com maior percentual
function getMostCommonAgeRange(ageRange: AvatarProfile['ageRange']): string {
  const entries = Object.entries(ageRange)
  const [range] = entries.reduce((max, current) =>
    current[1] > max[1] ? current : max
  )
  return range
}

// ✅ HELPER: Encontrar a cidade/país com maior percentual
function getTopLocation(
  cities: AvatarProfile['topCities'] | undefined,
  countries: AvatarProfile['topCountries'] | undefined
): string {
  // Priorizar cidade, depois país
  if (cities && cities.length > 0) {
    return cities[0].name
  }
  if (countries && countries.length > 0) {
    return countries[0].name
  }
  return 'Não especificado'
}

export function AvatarCard({
  profile,
  title,
  variant,
  status,
  insightLabel,
  insightText,
}: AvatarCardProps): React.ReactElement {
  const glowColor = STATUS_GLOW_MAP[status]
  const icon = VARIANT_ICON_MAP[variant]
  
  // ✅ Mapear glow color para classe CSS
  const fillClass = styles[`fill${glowColor.charAt(0).toUpperCase()}${glowColor.slice(1)}`]
  const textClass = styles[`text${glowColor.charAt(0).toUpperCase()}${glowColor.slice(1)}`]
  
  // ✅ Extrair dados do perfil
  const topAgeRange = getMostCommonAgeRange(profile.ageRange)
  const topLocation = getTopLocation(profile.topCities, profile.topCountries)
  const femalePercentage = profile.gender.female
  const malePercentage = profile.gender.male

  return (
    <div className={styles.card}>
      {/* Header: Ícone + Badge */}
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <span className={`${styles.titleBadge} ${textClass}`}>{title}</span>
      </div>

      {/* Bloco: Gênero */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Gênero</p>
        
        {/* Trilho de progresso */}
        <div className={styles.genderTrack}>
          <div
            className={`${styles.genderFill} ${fillClass}`}
            style={{ width: `${femalePercentage}%` }}
          />
        </div>

        {/* Legenda */}
        <div className={styles.genderLegend}>
          <span>
            ♀ Feminino{' '}
            <span className={`${styles.genderValue} ${textClass}`}>
              {femalePercentage.toFixed(0)}%
            </span>
          </span>
          <span>
            ♂ Masculino{' '}
            <span className={`${styles.genderValue} ${textClass}`}>
              {malePercentage.toFixed(0)}%
            </span>
          </span>
        </div>
      </div>

      {/* Bloco: Faixa Etária */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Faixa Etária Principal</p>
        <p className={`${styles.value} ${textClass}`}>{topAgeRange} anos</p>
      </div>

      {/* Bloco: Geolocalização */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Geolocalização</p>
        <div className={styles.geoRow}>
          <span>📍</span>
          <span className={styles.text}>{topLocation}</span>
        </div>
      </div>

      {/* Insight (no final do card) */}
      {insightText && (
        <div className={styles.insightBlock}>
          <p className={styles.blockLabel}>{insightLabel}</p>
          <p className={styles.insightText}>{insightText}</p>
        </div>
      )}
    </div>
  )
}
