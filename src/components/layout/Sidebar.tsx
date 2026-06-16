/* ==========================================================================
   ✅ SIDEBAR.TSX v1.2.2 — HIGIENIZADO (Sem ESLint Warnings)
   Caminho físico real: src/components/layout/Sidebar.tsx
   Data: 2026-06-13 - 00:06 (São Paulo)
   Status: 🎉 PRONTO PARA PRODUÇÃO (ZERO WARNINGS)
   ========================================================================== */

'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'

// ─── Imports Necessários ─────────────────────────────────────────────────
import { useOrbitDashboard } from '../../context/OrbitDashboardContext'
import { 
  NAV_ITEM_TO_TAB_MAP, 
  isNavItemActive 
} from './navItemMapping'
import type { TabId } from '../../types/orbit'

// ─── Interface de Item de Navegação ──────────────────────────────────────
interface NavItem {
  id: string
  label: string
  href: string
  icon: string 
  badge?: number
  badgeVariant?: 'default' | 'alert'
  section: 'visao-geral' | 'instagram'
}

// ─── Array de Itens de Navegação (ADERENTE AO P1_task_spec.md) ──────────
const NAV_ITEMS: NavItem[] = [
  // SEÇÃO: VISÃO GERAL
  {
    id: 'carteira',
    label: 'Carteira',
    href: '/carteira',
    icon: '📁',
    badge: 2,
    badgeVariant: 'default',
    section: 'visao-geral',
  },
  {
    id: 'alertas',
    label: 'Alertas',
    href: '/alertas',
    icon: '🔔',
    badge: 3,
    badgeVariant: 'alert',
    section: 'visao-geral',
  },
  
  // SEÇÃO: INSTAGRAM
  {
    id: 'visao-geral-ig',
    label: 'Visão geral IG',
    href: '/instagram',
    icon: '📊',
    section: 'instagram',
  },
  {
    id: 'funil-simulador',
    label: 'Funil + Simulador',
    href: '/instagram/funil',  // ✅ CORRIGIDO: P1_task_spec.md exige /instagram/funil
    icon: '🌀',
    section: 'instagram',
  },
  {
    id: 'avatar-alignment',
    label: 'Avatar Alignment',
    href: '/instagram/avatar',  // ✅ CORRIGIDO: P1_task_spec.md exige /instagram/avatar
    icon: '👤',
    section: 'instagram',
  },
]

// ─── Componente Principal: Sidebar ───────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname()
  
  // 🟢 ENGENHARIA DE INTERACTION: Puxamos as funções de estado do contexto global
  const { activeTab, setActiveTab } = useOrbitDashboard()

  // Filtrar itens por seção
  const visaoGeralItems = NAV_ITEMS.filter((i) => i.section === 'visao-geral')
  const instagramItems = NAV_ITEMS.filter((i) => i.section === 'instagram')

  return (
    <aside className={styles.sidebar} aria-label="Navegação principal">
      {/* ─── Logo ─────────────────────────────────────────────────────────── */}
      <div className={styles.logo}>
        <div className={styles.logoBadge} aria-hidden="true">O</div>
        <div>
          <p className={styles.logoName}>ORBIT</p>
          <p className={styles.logoSub}>SOCIAL INTELLIGENCE</p>
        </div>
      </div>

      {/* ─── Cliente Ativo ────────────────────────────────────────────────── */}
      <div className={styles.clientBox}>
        <p className={styles.clientLabel}>CLIENTE ATIVO</p>
        <div className={styles.clientName}>
          <span>CP Import Store</span>
          <span className={styles.clientDot} aria-label="Ativo" />
        </div>
      </div>

      {/* ─── Seção: Visão Geral ──────────────────────────────────────────── */}
      <p className={styles.sectionLabel}>VISÃO GERAL</p>
      <nav>
        <ul className={styles.navList} role="list">
          {visaoGeralItems.map((item) => (
            <NavItemRow
              key={item.id}
              item={item}
              isActive={pathname === item.href}
              onTabClick={setActiveTab}
            />
          ))}
        </ul>
      </nav>

      {/* ─── Seção: Instagram ────────────────────────────────────────────── */}
      <p className={styles.sectionLabel}>INSTAGRAM</p>
      <nav>
        <ul className={styles.navList} role="list">
          {instagramItems.map((item) => {
            // ✅ HIGIENIZADO: Usar função centralizada isNavItemActive
            // que já contém toda a lógica de destaque ativo
            const itemIsActive = isNavItemActive(
              item.id,
              pathname,
              item.href,
              activeTab
            )

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

// ─── Sub-componente com Callbacks Ativados ────────────────────────────────
interface NavItemRowProps {
  item: NavItem
  isActive: boolean
  onTabClick: (tabId: TabId) => void
}

function NavItemRow({ item, isActive, onTabClick }: NavItemRowProps) {
  
  // ✅ HIGIENIZADO: Usar mapeamento centralizado NAV_ITEM_TO_TAB_MAP
  // Interceptador de clique: Transforma chaves de navegação física em mutações de contexto React
  const handleItemClick = (e: React.MouseEvent) => {
    if (item.section === 'instagram' && item.id in NAV_ITEM_TO_TAB_MAP) {
      // Impede o Next.js de recarregar a rota cega e limpar a memória
      e.preventDefault() 
      
      // ✅ HIGIENIZADO: Usar mapeamento centralizado
      const tabId = NAV_ITEM_TO_TAB_MAP[item.id]
      onTabClick(tabId)
    }
  }

  return (
    <li>
      <Link
        href={item.href}
        className={[styles.navItem, isActive ? styles.navItemActive : ''].join(' ')}
        aria-current={isActive ? 'page' : undefined}
        onClick={handleItemClick} // 🟢 CONEXÃO REAL DA AÇÃO DO BOTÃO
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




