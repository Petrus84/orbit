import React from 'react'
import { StatusPill } from '../common/StatusPill'
import styles from './FormatPerformanceTable.module.css'
import type { FormatPerformanceRow } from '../../types/orbit'

export interface FormatPerformanceTableProps {
  rows: FormatPerformanceRow[]
}

export function FormatPerformanceTable({ rows }: FormatPerformanceTableProps) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>PERFORMANCE POR FORMATO</p>
      <table className={styles.table} aria-label="Performance por formato">
        <thead>
          <tr>
            <th className={styles.th}>FORMATO</th>
            <th className={styles.th}>POSTS</th>
            <th className={styles.th}>SHARES</th>
            {/* 🌟 ATIVADO: Coluna SSOT Master */}
            <th className={styles.th}>SAVES</th>
            <th className={styles.th}>TREND</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={styles.tr}>
              <td className={[styles.td, styles.tdFormat].join(' ')}>
                {row.format}
              </td>
              <td className={styles.td}>{row.posts}</td>
              <td className={styles.td}>{row.shares}</td>
              {/* 🌟 RENDERIZA O DADO REAL DO SUPABASE */}
              <td className={styles.td}>{row.saves ?? 0}</td>
              <td className={styles.td}>
                <StatusPill text={row.trendLabel} color={row.trendColor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}