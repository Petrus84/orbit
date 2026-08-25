/* ==========================================================================
   ORBIT · Component — AvatarComparison
   Layout lado a lado (Avatar Esperado × Audiência Real) com divisor "VS".
   Resolve seu próprio glow a partir de `status` — não recebe cor pronta.
   Versão: 2.1.0
   ========================================================================== */

import React from 'react'
import { StatusPill } from './StatusPill'
import { AvatarCard } from './AvatarCard'
import type { AvatarProfile, AlignmentStatus} from '@/types/avatar'
import { ALIGNMENT_STATUS_LABEL } from '@/types/avatar'
import type { GlowColor } from '@/types/orbit'
import styles from './AvatarComparison.module.css'

export interface AvatarComparisonProps {
  expected: AvatarProfile
  real: AvatarProfile
  score: number
  status: AlignmentStatus
  unconsciousDesireMapped: string
  misalignmentHypothesis: string
}

const STATUS_TO_GLOW: Record<AlignmentStatus, GlowColor> = {
  healthy: 'cyan',
  warning: 'gold',
  critical: 'red',
}

export function AvatarComparison({
  expected,
  real,
  score,
  status,
  unconsciousDesireMapped,
  misalignmentHypothesis,
}: AvatarComparisonProps): React.ReactElement {
  const glow = STATUS_TO_GLOW[status]
  const label = ALIGNMENT_STATUS_LABEL[status]

  return (
    <section className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span className={styles.sectionLabel}>Comparação de Avatar</span>
        <StatusPill text={`${score.toFixed(1)}% — ${label}`} color={glow} />
      </div>

      <div className={styles.row}>
        <div className={styles.cardSlot}>
          <AvatarCard
            profile={expected}
            title="Avatar Esperado"
            variant="expected"
            status={status}
            insightLabel="Desejo Inconsciente Mapeado"
            insightText={unconsciousDesireMapped}
          />
        </div>

        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerLine} />
          <span className={styles.vsLabel}>VS</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.cardSlot}>
          <AvatarCard
            profile={real}
            title="Audiência Real"
            variant="real"
            status={status}
            insightLabel="Hipótese de Desalinhamento"
            insightText={misalignmentHypothesis}
          />
        </div>
      </div>
    </section>
  )
}