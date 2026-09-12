// src/components/common/AvatarCard.tsx

import React from 'react'
import type { AvatarProfile, AlignmentStatus } from '@/types/avatar'
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

// AvatarProfile.ageRange já é a faixa etária dominante calculada (string,
// ex.: "18-24"), não uma distribuição por faixa — não há o que reduzir aqui.
// (Achado novo: a versão anterior chamava Object.entries(ageRange) sobre
// uma string, o que não quebra a compilação — TS aceita string em Object.
// entries({}) — mas nunca calculava nada útil em runtime.)
function getMostCommonAgeRange(ageRange: AvatarProfile['ageRange']): string {
  return ageRange || 'Não especificado'
}

// AvatarProfile real (orbit.ts) não tem topCities/topCountries — o campo
// equivalente de localização é `geo` (string única, já resolvida no
// repositório). Substituído por leitura direta, sem inventar um shape que
// não existe no contrato.
//
// PR-B / N1: `geo || 'Não especificado'` só cobria string vazia. O
// avatarRepository já normaliza "", "null", "undefined" antes de montar o
// profile, mas este componente não deve depender só disso — defesa em
// profundidade contra o mesmo dado sentinela, sem `String(null)`.
const EMPTY_GEO_SENTINELS = new Set(['', 'null', 'undefined'])

function getTopLocation(geo: AvatarProfile['geo']): string {
  const trimmed = (geo ?? '').trim()
  return EMPTY_GEO_SENTINELS.has(trimmed.toLowerCase()) ? 'Não especificado' : trimmed
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
  const topLocation = getTopLocation(profile.geo)
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