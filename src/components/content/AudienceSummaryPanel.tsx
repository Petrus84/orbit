/* ==========================================================================
   ORBIT · Component — AudienceSummaryPanel
   Substitui o placeholder hardcoded da aba "Audiência". Mostra só dado real:
   split de gênero e top cidades (ig_audience_snapshots), alcance por
   seguidor/visitas de perfil/cliques de link (ig_account_snapshots).
   Versão: 1.0.0  |  Data: 2026-08-31

   Faixa etária (age_*_pct) NÃO aparece aqui — bug confirmado de ingestão
   grava zero fixo pra toda faixa (ver ingest-from-zip.ts,
   extractDemographicsBlock). Expor esse campo mostraria "0% em tudo" como
   se fosse dado real. Volta quando o parser for corrigido.
   ========================================================================== */

import { GlassCard }             from '@/components/common/GlassCard'
import styles                    from './AudienceSummaryPanel.module.css'
import type { AudienceSummary }  from '@/types/orbit'

export interface AudienceSummaryPanelProps {
  summary: AudienceSummary
}

function formatPct(value: number | null): string {
  return value != null ? `${value.toFixed(1)}%` : '—'
}

export function AudienceSummaryPanel({ summary }: AudienceSummaryPanelProps) {
  const hasGender = summary.genderFemalePct != null || summary.genderMalePct != null
  const hasCities = summary.topCities.length > 0

  return (
    <GlassCard glowColor="cyan" className={styles.panel}>
      <p className={styles.panelTitle}>AUDIÊNCIA — {summary.periodLabel}</p>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Alcance por seguidor</p>
          <p className={styles.statValue}>{formatPct(summary.reachFollowersPct)}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Visitas ao perfil</p>
          <p className={styles.statValue}>{summary.profileVisits ?? '—'}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Cliques no link</p>
          <p className={styles.statValue}>{summary.linkClicks ?? '—'}</p>
        </div>
      </div>

      {hasGender && (
        <div className={styles.genderBlock}>
          <p className={styles.blockLabel}>GÊNERO</p>
          <div className={styles.genderBar}>
            {summary.genderFemalePct != null && (
              <div
                className={styles.genderBarFemale}
                style={{ width: `${summary.genderFemalePct}%` }}
              />
            )}
            {summary.genderMalePct != null && (
              <div
                className={styles.genderBarMale}
                style={{ width: `${summary.genderMalePct}%` }}
              />
            )}
          </div>
          <div className={styles.genderLegend}>
            <span><span className={styles.dotFemale} /> Feminino {formatPct(summary.genderFemalePct)}</span>
            <span><span className={styles.dotMale} /> Masculino {formatPct(summary.genderMalePct)}</span>
            {summary.genderOtherPct != null && summary.genderOtherPct > 0 && (
              <span>Outro {formatPct(summary.genderOtherPct)}</span>
            )}
          </div>
        </div>
      )}

      {hasCities && (
        <div className={styles.citiesBlock}>
          <p className={styles.blockLabel}>PRINCIPAIS CIDADES</p>
          <div className={styles.citiesList}>
            {summary.topCities.slice(0, 5).map((city) => (
              <div key={city.name} className={styles.cityRow}>
                <span className={styles.cityName}>{city.name}</span>
                <span className={styles.cityPct}>{city.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasGender && !hasCities && (
        <p className={styles.emptyState}>Sem dado de audiência para este período ainda.</p>
      )}
    </GlassCard>
  )
}