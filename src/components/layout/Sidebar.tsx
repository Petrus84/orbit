/* ==========================================================================
   ORBIT · Sidebar
   Caminho: src/components/layout/Sidebar.tsx
   Versão: 1.3.0

   v1.3.0:
   FIX RAIZ: Funil e Avatar são ROTAS, não abas.
   O Sidebar v1.2.2 interceptava TODOS os cliques da seção Instagram e
   chamava setActiveTab() em vez de deixar o Next.js navegar.
   Resultado: /instagram/funil e /instagram/avatar nunca eram visitados.

   FIX: handleItemClick só intercepta itens que estão no NAV_ITEM_TO_TAB_MAP.
   Funil e Avatar não estão mais no map → e.preventDefault() não é chamado
   → Link do Next.js navega normalmente → rota renderiza.

   Cliente ativo: ainda hardcoded como "CP Import Store" — futuro: usar contexto
   ========================================================================== */

'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'
import { useOrbitDashboard } from '../../context/OrbitDashboardContext'
import { NAV_ITEM_TO_TAB_MAP, isNavItemActive } from './navItemMapping'
import type { TabId } from '../../types/orbit'

interface NavItem {
  id:            string
  label:         string
  href:          string
  icon:          string
  badge?:        number
  badgeVariant?: 'default' | 'alert'
  section:       'visao-geral' | 'instagram'
}

const NAV_ITEMS: NavItem[] = [
  // ── Visão geral ────────────────────────────────────────────────────────────
  {
    id:           'carteira',
    label:        'Carteira',
    href:         '/carteira',
    icon:         '📁',
    badge:        2,
    badgeVariant: 'default',
    section:      'visao-geral',
  },
  {
    id:           'alertas',
    label:        'Alertas',
    href:         '/alertas',
    icon:         '🔔',
    badge:        3,
    badgeVariant: 'alert',
    section:      'visao-geral',
  },

  // ── Instagram ──────────────────────────────────────────────────────────────
  {
    id:      'visao-geral-ig',
    label:   'Visão geral IG',
    href:    '/instagram',
    icon:    '📊',
    section: 'instagram',
  },
  {
    id:      'funil-simulador',
    label:   'Funil + Simulador',
    href:    '/instagram/funil',   // ← ROTA REAL (não aba)
    icon:    '🌀',
    section: 'instagram',
  },
  {
    id:      'avatar-alignment',
    label:   'Avatar Alignment',
    href:    '/instagram/avatar',  // ← ROTA REAL (não aba)
    icon:    '👤',
    section: 'instagram',
  },
]

export function Sidebar() {
  const pathname  = usePathname()
  const { activeTab, setActiveTab } = useOrbitDashboard()

  const visaoGeralItems = NAV_ITEMS.filter(i => i.section === 'visao-geral')
  const instagramItems  = NAV_ITEMS.filter(i => i.section === 'instagram')

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
          {visaoGeralItems.map(item => (
            <NavItemRow
              key={item.id}
              item={item}
              isActive={pathname === item.href}
              onTabClick={setActiveTab}
            />
          ))}
        </ul>
      </nav>

      {/* Seção: Instagram */}
      <p className={styles.sectionLabel}>INSTAGRAM</p>
      <nav>
        <ul className={styles.navList} role="list">
          {instagramItems.map(item => {
            const itemIsActive = isNavItemActive(item.id, pathname, item.href, activeTab)
            return (
              <NavItemRow
                key={item.id}
                item={item}
                isActive={itemIsActive}
                onTabClick={setActiveTab}
              />
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

// ─── NavItemRow ───────────────────────────────────────────────────────────────

interface NavItemRowProps {
  item:        NavItem
  isActive:    boolean
  onTabClick:  (tabId: TabId) => void
}

function NavItemRow({ item, isActive, onTabClick }: NavItemRowProps) {
  const handleItemClick = (e: React.MouseEvent) => {
    // FIX v1.3.0: Só intercepta se o item está no mapa de abas.
    // Funil e Avatar NÃO estão no mapa → e.preventDefault() não é chamado
    // → Link navega normalmente para a rota real.
    if (item.section === 'instagram' && item.id in NAV_ITEM_TO_TAB_MAP) {
      e.preventDefault()
      const tabId = NAV_ITEM_TO_TAB_MAP[item.id]
      onTabClick(tabId)
    }
    // Para funil-simulador e avatar-alignment: não interceptar → navegação normal
  }

  return (
    <li>
      <Link
        href={item.href}
        className={[styles.navItem, isActive ? styles.navItemActive : ''].join(' ')}
        aria-current={isActive ? 'page' : undefined}
        onClick={handleItemClick}
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