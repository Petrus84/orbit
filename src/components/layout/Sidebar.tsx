/* ==========================================================================
   ORBIT · Component — Sidebar
   Largura fixa: 240px. Nav items com hover + active state.
   Versão: 1.0.0  |  Data: 2026-06-01
   ========================================================================== */

'use client'

import React      from 'react'
import Link       from 'next/link'
import { usePathname } from 'next/navigation'
import styles     from './Sidebar.module.css'

// ─── Definição de navegação ────────────────────────────────────────────────

interface NavItem {
  id:      string
  label:   string
  href:    string
  icon:    string   // texto/emoji simples
  badge?:  number
  badgeVariant?: 'default' | 'alert'
  section: 'visao-geral' | 'instagram'
}

const NAV_ITEMS: NavItem[] = [
  {
    id:          'carteira',
    label:       'Carteira',
    href:        '/carteira',
    icon:        '📁',
    badge:       2,
    badgeVariant: 'default',
    section:     'visao-geral',
  },
  {
    id:          'alertas',
    label:       'Alertas',
    href:        '/alertas',
    icon:        '🔔',
    badge:       3,
    badgeVariant: 'alert',
    section:     'visao-geral',
  },
  {
    id:          'visao-geral-ig',
    label:       'Visão geral IG',
    href:        '/instagram',
    icon:        '📊',
    section:     'instagram',
  },
  {
    id:          'funil-simulador',
    label:       'Funil + Simulador',
    href:        '/instagram/funil',
    icon:        '🌀',
    section:     'instagram',
  },
  {
    id:          'avatar-alignment',
    label:       'Avatar Alignment',
    href:        '/instagram/avatar',
    icon:        '👤',
    section:     'instagram',
  },
]

// ─── Componente ───────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  const visaoGeralItems = NAV_ITEMS.filter((i) => i.section === 'visao-geral')
  const instagramItems  = NAV_ITEMS.filter((i) => i.section === 'instagram')

  return (
    <aside className={styles.sidebar} aria-label="Navegação principal">
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoBadge} aria-hidden="true">O</div>
        <div>
          <p className={styles.logoName}>ORBIT</p>
          <p className={styles.logoSub}>SOCIAL INTELLIGENCE</p>
        </div>
      </div>

      {/* Cliente ativo */}
      <div className={styles.clientBox}>
        <p className={styles.clientLabel}>CLIENTE ATIVO</p>
        <div className={styles.clientName}>
          <span>CP Import Store</span>
          <span className={styles.clientDot} aria-label="Ativo" />
        </div>
      </div>

      {/* Seção: Visão Geral */}
      <p className={styles.sectionLabel}>VISÃO GERAL</p>
      <nav>
        <ul className={styles.navList} role="list">
          {visaoGeralItems.map((item) => (
            <NavItemRow
              key={item.id}
              item={item}
              // 💡 Garante booleano puro mesmo que o pathname seja temporariamente null
              isActive={pathname === item.href}
            />
          ))}
        </ul>
      </nav>

      {/* Seção: Instagram */}
      <p className={styles.sectionLabel}>INSTAGRAM</p>
      <nav>
        <ul className={styles.navList} role="list">
          {instagramItems.map((item) => (
            <NavItemRow
              key={item.id}
              item={item}
              // 💡 RESOLUÇÃO DO BUG-2: Ativa /instagram de forma exata e sub-rotas com o trailing slash '/'
              isActive={
                pathname === item.href ||
                !!(pathname && pathname.startsWith(item.href + '/'))
              }
            />
          ))}
        </ul>
      </nav>
    </aside>
  )
}


// ─── Sub-componente ───────────────────────────────────────────────────────

interface NavItemRowProps {
  item:     NavItem
  isActive: boolean
}

function NavItemRow({ item, isActive }: NavItemRowProps) {
  return (
    <li>
      <Link
        href={item.href}
        className={[styles.navItem, isActive ? styles.navItemActive : ''].join(' ')}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
        <span className={styles.navLabel}>{item.label}</span>
        {item.badge !== undefined && (
          <span
            className={[
              styles.badge,
              item.badgeVariant === 'alert' ? styles.badgeAlert : styles.badgeDefault,
            ].join(' ')}
            aria-label={`${item.badge} notificações`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  )
}
