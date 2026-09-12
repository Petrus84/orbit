/* ==========================================================================
   ORBIT · Component — Header
   60px fixed. Título + handle + date range + 3 abas: Overview · Por post · Audiência
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

'use client'

import styles                     from './Header.module.css'
import { useOrbitDashboard }      from '@/context/OrbitDashboardContext'
import type { TabId }             from '@/types/orbit'

// ─── Abas — exatamente 3, na ordem do protótipo ───────────────────────────

interface TabDefinition {
  id:    TabId
  label: string
}

const TABS: TabDefinition[] = [
  { id: 'overview',   label: 'Overview'  },
  { id: 'por-post',   label: 'Por post'  },
  { id: 'audiencia',  label: 'Audiência' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDateRange(start: Date, end: Date): string {

  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
  const locale = 'pt-BR'
  const f = new Date(start).toLocaleDateString(locale, opts)
  const t = new Date(end).toLocaleDateString(locale, opts)
  return `${f} – ${t}`
}

// ─── Componente ───────────────────────────────────────────────────────────

export function Header() {
  const { data, activeTab, setActiveTab } = useOrbitDashboard()

  const meta = data?.meta

  const dateLabel = meta
    ? formatDateRange(meta.dateRange.start, meta.dateRange.end)
    : '—'

  return (
    <header className={styles.header} role="banner">
      {/* Título + contexto */}
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Instagram — CP Import Store</h1>
        <p className={styles.subtitle}>
          {meta?.clientHandle ?? '—'}
          <span className={styles.dot}>·</span>
          {meta?.periodLabel ?? '—'}
        </p>
      </div>

      {/* Spacer */}
      <div className={styles.spacer} />

      {/* Date range pill */}
      <div className={styles.datePill} aria-label="Período selecionado">
        <span className={styles.datePillIcon} aria-hidden="true">📅</span>
        <span className={styles.datePillText}>{dateLabel}</span>
      </div>

      {/* Abas — 3 exatas */}
      <nav className={styles.tabGroup} aria-label="Visualizações do dashboard">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={[
              styles.tab,
              activeTab === tab.id ? styles.tabActive : '',
            ].join(' ')}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
