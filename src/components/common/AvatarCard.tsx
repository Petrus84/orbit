/* ==========================================================================
   ORBIT · Component — AvatarCard
   Renderiza um perfil (esperado ou real) dentro de um GlassCard, resolvendo
   seu próprio glowColor a partir do `status` contratual recebido.
   Versão: 2.1.0
   ========================================================================== */

import React from 'react'
import { GlassCard } from './GlassCard'
import type { AvatarProfile, AlignmentStatus } from '../../types/avatar'
import type { GlowColor } from '../../types/orbit'
import styles from './AvatarCard.module.css'

export interface AvatarCardProps {
  profile: AvatarProfile
  title: string
  variant: 'expected' | 'real'
  status: AlignmentStatus
  insightLabel: string
  insightText: string
}

const STATUS_TO_GLOW: Record<AlignmentStatus, GlowColor> = {
  healthy: 'cyan',
  warning: 'gold',
  critical: 'red',
}

const VARIANT_ICON: Record<'expected' | 'real', string> = {
  expected: '👤',
  real: '📊',
}

const CONFIDENCE_LABEL: Record<'L0' | 'L1' | 'L2', string> = {
  L0: 'Não validado',
  L1: 'Validação parcial',
  L2: 'Validado com cliente',
}

const FILL_CLASS: Record<GlowColor, string> = {
  cyan: styles.fillCyan,
  gold: styles.fillGold,
  red: styles.fillRed,
  none: styles.fillNone,
}

const TEXT_CLASS: Record<GlowColor, string> = {
  cyan: styles.textCyan,
  gold: styles.textGold,
  red: styles.textRed,
  none: styles.textNone,
}

/**
 * Fallback de governança: nunca renderiza vazio. Se o repositório devolver
 * string vazia para unconsciousDesireMapped/misalignmentHypothesis, exibe
 * um estado explícito em vez de um bloco em branco (filosofia N/A do projeto).
 */
function resolveInsight(text: string): { text: string; isFallback: boolean } {
  const trimmed = text.trim()
  if (trimmed.length > 0) return { text: trimmed, isFallback: false }
  return {
    text: 'Governança: dado ainda não mapeado para este cliente.',
    isFallback: true,
  }
}

export function AvatarCard({
  profile,
  title,
  variant,
  status,
  insightLabel,
  insightText,
}: AvatarCardProps): React.ReactElement {
  const glowColor = STATUS_TO_GLOW[status]
  const insight = resolveInsight(insightText)

  return (
    <GlassCard glowColor={glowColor} className={styles.card}>
      <div className={styles.header}>
        <span aria-hidden="true" className={styles.icon}>
          {VARIANT_ICON[variant]}
        </span>
        <span className={styles.titleBadge}>{title}</span>
      </div>

      {/* Gênero */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Gênero</p>
        <div className={styles.genderTrack}>
          <span
            className={[styles.genderFill, FILL_CLASS[glowColor]].join(' ')}
            style={{ width: `${profile.gender.female}%` }}
          />
        </div>
        <div className={styles.genderLegend}>
          <span>
            ♀ Feminino{' '}
            <span className={[styles.genderValue, TEXT_CLASS[glowColor]].join(' ')}>
              {profile.gender.female}%
            </span>
          </span>
          <span>
            ♂ Masculino{' '}
            <span className={[styles.genderValue, TEXT_CLASS[glowColor]].join(' ')}>
              {profile.gender.male}%
            </span>
          </span>
        </div>
      </div>

      {/* Faixa etária */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Faixa Etária</p>
        <p className={styles.value}>{profile.ageRange} anos</p>
      </div>

      {/* Interesse */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Interesse Principal</p>
        <p className={styles.text}>
          {profile.interest || 'N/A'}
          {profile.interestConfidence && (
            <span className={styles.confidenceTag}>
              {' '}
              · {CONFIDENCE_LABEL[profile.interestConfidence]}
            </span>
          )}
        </p>
      </div>

      {/* Geo */}
      <div className={styles.block}>
        <p className={styles.blockLabel}>Geolocalização</p>
        <p className={styles.geoRow}>
          <span aria-hidden="true">📍</span> {profile.geo || 'N/A'}
        </p>
      </div>

      {/* Insight (unconsciousDesireMapped / misalignmentHypothesis) */}
      <div className={styles.insightBlock}>
        <p className={styles.blockLabel}>{insightLabel}</p>
        <p
          className={
            insight.isFallback
              ? [styles.insightText, styles.insightFallback].join(' ')
              : styles.insightText
          }
        >
          {insight.text}
        </p>
      </div>
    </GlassCard>
  )
}