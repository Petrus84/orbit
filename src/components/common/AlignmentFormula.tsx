/* ==========================================================================
   ORBIT · Component — AlignmentFormula
   Painel da fórmula de afinidade matemática, tipografia mono, SSOT de cor.
   Migrado de Tailwind arbitrário (gray-950, violet-400...) para TOKENS.
   Versão: 2.0.0 (primeira migração — antes fora do escopo v1/v2 das barras)
   ========================================================================== */

import React from 'react'
import { GlassCard } from './GlassCard'
import styles from './AlignmentFormula.module.css'

interface WeightItem {
  key: string
  label: string
  weight: string
}

const WEIGHTS: WeightItem[] = [
  { key: 'alinhamento_genero', label: 'Gênero', weight: '40%' },
  { key: 'alinhamento_faixa_etaria', label: 'Faixa Etária', weight: '35%' },
  { key: 'alinhamento_geo', label: 'Geolocalização', weight: '25%' },
]

export function AlignmentFormula(): React.ReactElement {
  return (
    <section className={styles.wrapper}>
      <span className={styles.sectionLabel}>Fórmula de Cálculo</span>

      <GlassCard glowColor="none" className={styles.card}>
        <div className={styles.codeBlock}>
          <div className={styles.line}>
            <span className={styles.varName}>score</span>
            <span className={styles.operator}> = </span>
            <span className={styles.paren}>(</span>
          </div>
          <div className={`${styles.line} ${styles.indent}`}>
            <span className={styles.varName}>alinhamento_genero</span>
            <span className={styles.operator}> × </span>
            <span className={styles.weight}>0.40</span>
            <span className={styles.weightComment}>peso 40%</span>
          </div>
          <div className={`${styles.line} ${styles.indent}`}>
            <span className={styles.operator}>+ </span>
            <span className={styles.varName}>alinhamento_faixa_etaria</span>
            <span className={styles.operator}> × </span>
            <span className={styles.weight}>0.35</span>
            <span className={styles.weightComment}>peso 35%</span>
          </div>
          <div className={`${styles.line} ${styles.indent}`}>
            <span className={styles.operator}>+ </span>
            <span className={styles.varName}>alinhamento_geo</span>
            <span className={styles.operator}> × </span>
            <span className={styles.weight}>0.25</span>
            <span className={styles.weightComment}>peso 25%</span>
          </div>
          <div className={styles.line}>
            <span className={styles.paren}>)</span>
          </div>

          <div className={styles.divider}>
            <div className={styles.subFormula}>
              <span className={styles.varName}>alinhamento_X</span>
              <span className={styles.operator}> = </span>
              <span className={styles.subExpr}>1 − |esperado − real| / 100</span>
            </div>
          </div>
        </div>

        <div className={styles.legendGrid}>
          {WEIGHTS.map((item) => (
            <div key={item.key} className={styles.legendTile}>
              <span className={styles.legendValue}>{item.weight}</span>
              <span className={styles.legendLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  )
}