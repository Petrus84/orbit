/* ==========================================================================
   ORBIT · Sidebar (v2.0.0 — ALINHADO ÀS 11 RNs DO SSOT)
   Caminho: src/components/layout/Sidebar.tsx
   Versão: 2.0.0 | Data: 2026-07-05

   GOVERNANÇA RÍGIDA APLICADA:
   ✅ R-01: Visão unificada de carteira — semáforo de saúde → /carteira
   ✅ R-02: Alerta proativo com threshold configurável → /alertas
   ✅ R-04: Funil interativo com simulador de cenário → /instagram/funil
   ✅ R-07: Visão unificada orgânico + pago → /instagram (overview)
   ✅ R-11: Auditoria de consistência de avatar → /instagram/avatar

   MUDANÇAS v2.0.0:
   • Removido hardcoding de cliente — agora vem do contexto OrbitDashboardContext
   • Documentação alinhada às 11 RNs para cada item de menu
   • Badges dinâmicas (alertas) derivadas do contexto, não hardcoded
   • Estrutura de tipos refatorada para máxima clareza
   • Zero ruído de "Estudo de Mercado" ou features fantasmas
   • Comentários removidos que mencionavam v1.2.2 (obsoleto)

   NOTA: Estilização mantém conformidade com ssot-design-tokens.css
   (nenhuma classe Orbit redundante adicionada)
   ========================================================================== */

'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'
import { useOrbitDashboard } from '@/context/OrbitDashboardContext'
import { NAV_ITEM_TO_TAB_MAP, isNavItemActive } from './navItemMapping'
import type { TabId } from '@/types/orbit'

/**
 * Representa um item de navegação da sidebar.
 * Cada item mapeia a uma regra de negócio (RN) específica.
 */
interface NavItem {
  id:            string
  label:         string
  href:          string
  icon:          string
  section:       'visao-geral' | 'instagram'
  ruleNumber?:   string  // Rastreabilidade: qual RN este item atende
  badge?:        number
  badgeVariant?: 'default' | 'alert'
}

/**
 * WHITELIST OFICIAL DE ITENS DE NAVEGAÇÃO
 * Alinhados às 11 RNs do SSOT. Nenhum ruído de "Estudo de Mercado".
 */
const NAV_ITEMS: NavItem[] = [
  // ── SEÇÃO: Visão Geral ─────────────────────────────────────────────────────
  {
    id:          'carteira',
    label:       'Carteira',
    href:        '/carteira',
    icon:        '📁',
    section:     'visao-geral',
    ruleNumber:  'R-01',  // Visão unificada de carteira — semáforo de saúde
  },
  {
    id:          'alertas',
    label:       'Alertas',
    href:        '/alertas',
    icon:        '🔔',
    section:     'visao-geral',
    ruleNumber:  'R-02',  // Alerta proativo com threshold configurável
    badge:       undefined,  // Dinâmico: vem do contexto
    badgeVariant: 'alert',
  },

  // ── SEÇÃO: Instagram ───────────────────────────────────────────────────────
  {
    id:         'visao-geral-ig',
    label:      'Visão geral IG',
    href:       '/instagram',
    icon:       '📊',
    section:    'instagram',
    ruleNumber: 'R-07',  // Visão unificada orgânico + pago
  },
  {
    id:         'funil-simulador',
    label:      'Funil + Simulador',
    href:       '/funil',
    icon:       '🌀',
    section:    'instagram',
    ruleNumber: 'R-04',  // Funil interativo com simulador de cenário
  },
  {
    id:         'avatar-alignment',
    label:      'Avatar Alignment',
    href:       '/avatar',
    icon:       '👤',
    section:    'instagram',
    ruleNumber: 'R-11',  // Auditoria de consistência de avatar
  },
  {
    id:         'onboarding',
    label:      'Onboarding',
    href:       '/onboarding',
    icon:       '🧭',
    section:    'instagram',
    // Sem R-XX: não está entre as 11 RNs originais do SSOT — item
    // adicionado em 2026-08-20 porque a tela/hook/repository já existiam
    // completos (ver ADR-010) e ficavam inalcançáveis sem link de menu.
  },
]

/**
 * Sidebar: Navegação principal do ORBIT
 * 
 * Renderiza itens de menu baseando-se estritamente no mapeamento oficial (NAV_ITEMS).
 * Badges de alertas são dinâmicos, derivados do contexto OrbitDashboardContext.
 * Nenhum elemento visual, botão ou link estático para "Estudo de Mercado".
 */
export function Sidebar() {
  // usePathname() tipa como `string | null` (pode ser null durante certas
  // transições de rota no App Router). isNavItemActive() e as comparações
  // abaixo (`pathname === item.href`) esperam sempre uma string — o
  // fallback '' nunca bate com nenhum item.href real, então o comportamento
  // visual não muda (nenhum item fica marcado como ativo nesse instante).
  const pathname = usePathname() ?? ''
  const { activeTab, setActiveTab, currentClient, alertCount } = useOrbitDashboard()

  // Separar itens por seção
  const visaoGeralItems = NAV_ITEMS.filter(i => i.section === 'visao-geral')
  const instagramItems = NAV_ITEMS.filter(i => i.section === 'instagram')

  // Enriquecer itens com badges dinâmicos
  const visaoGeralItemsEnriched = visaoGeralItems.map(item => {
    if (item.id === 'alertas') {
      return { ...item, badge: alertCount ?? 0 }
    }
    return item
  })

  return (
    <aside className={styles.sidebar} aria-label="Navegação principal do ORBIT">
      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div className={styles.logo}>
        <div className={styles.logoBadge} aria-hidden="true">O</div>
        <div>
          <p className={styles.logoName}>ORBIT</p>
          <p className={styles.logoSub}>SOCIAL INTELLIGENCE</p>
        </div>
      </div>

      {/* ── Cliente Ativo (Dinâmico) ────────────────────────────────────────── */}
      {currentClient && (
        <div className={styles.clientBox}>
          <p className={styles.clientLabel}>CLIENTE ATIVO</p>
          <div className={styles.clientName}>
            <span>{currentClient.name}</span>
            <span
              className={styles.clientDot}
              data-status={currentClient.status}
              aria-label={`Status: ${currentClient.status}`}
            />
          </div>
        </div>
      )}

      {/* ── Seção: Visão Geral ──────────────────────────────────────────────── */}
      <p className={styles.sectionLabel}>VISÃO GERAL</p>
      <nav aria-label="Navegação de visão geral">
        <ul className={styles.navList} role="list">
          {visaoGeralItemsEnriched.map(item => (
            <NavItemRow
              key={item.id}
              item={item}
              isActive={pathname === item.href}
              onTabClick={setActiveTab}
            />
          ))}
        </ul>
      </nav>

      {/* ── Seção: Instagram ────────────────────────────────────────────────── */}
      <p className={styles.sectionLabel}>INSTAGRAM</p>
      <nav aria-label="Navegação de Instagram">
        <ul className={styles.navList} role="list">
          {instagramItems.map(item => {
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

// ─────────────────────────────────────────────────────────────────────────────
// NavItemRow: Componente de linha de item de navegação
// ─────────────────────────────────────────────────────────────────────────────

interface NavItemRowProps {
  item:       NavItem
  isActive:   boolean
  onTabClick: (tabId: TabId) => void
}

/**
 * NavItemRow: Renderiza uma linha de item de navegação.
 * 
 * Lógica de clique (v2.0.0):
 * - Se o item está em NAV_ITEM_TO_TAB_MAP (aba dentro de /instagram):
 *   → Intercepta clique, chama setActiveTab(), previne navegação padrão
 * - Se o item NÃO está no mapa (rota independente):
 *   → Permite navegação padrão do Next.js
 * 
 * @param item - Definição do item de navegação
 * @param isActive - Se o item está ativo (baseado em pathname + activeTab)
 * @param onTabClick - Callback para mudar aba (apenas para itens em NAV_ITEM_TO_TAB_MAP)
 */
function NavItemRow({ item, isActive, onTabClick }: NavItemRowProps) {
  const pathname = usePathname()

  const handleItemClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Intercepta como troca de aba SOMENTE se:
    //   1. o item está no mapa de abas (visao-geral-ig → 'overview'), E
    //   2. o usuário já está fisicamente em /instagram.
    // Sem o item 2, clicar em "Visão geral IG" a partir de QUALQUER outra
    // rota (Carteira, Alertas, Funil, Avatar, Onboarding) ficava sem efeito
    // visível: o preventDefault() bloqueava a navegação real do Next.js e
    // setActiveTab() mudava o estado do OrbitDashboardProvider errado (o
    // "provider de sidebar" do layout compartilhado, que não renderiza
    // nada dependente de activeTab) — a página parecia "não clicável".
    if (
      item.section === 'instagram' &&
      item.id in NAV_ITEM_TO_TAB_MAP &&
      pathname === item.href
    ) {
      e.preventDefault()
      const tabId = NAV_ITEM_TO_TAB_MAP[item.id]
      onTabClick(tabId)
    }
    // Caso contrário: <Link> navega normalmente para item.href.
  }

  return (
    <li>
      <Link
        href={item.href}
        className={[
          styles.navItem,
          isActive ? styles.navItemActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-current={isActive ? 'page' : undefined}
        data-rule={item.ruleNumber}
        onClick={handleItemClick}
      >
        <span className={styles.navIcon} aria-hidden="true">
          {item.icon}
        </span>
        <span className={styles.navLabel}>{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span
            className={[
              styles.badge,
              item.badgeVariant === 'alert'
                ? styles.badgeAlert
                : styles.badgeDefault,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${item.badge} ${item.id === 'alertas' ? 'alertas' : 'notificações'}`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  )
}