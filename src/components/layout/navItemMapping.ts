/* ==========================================================================
   ORBIT · Navigation Mapping
   Caminho: src/components/layout/navItemMapping.ts
   Versão: 2.0.0

   v2.0.0:
   PROBLEMA RAIZ: O mapeamento anterior fazia o Sidebar interceptar os
   cliques em Funil e Avatar e mudar activeTab em vez de navegar para a rota.
   O resultado: a URL nunca mudava para /instagram/funil ou /instagram/avatar,
   e os componentes FunnelScreen/AvatarScreen nunca eram renderizados.

   FIX: Funil e Avatar são ROTAS INDEPENDENTES, não abas da tela /instagram.
   - Clique em Funil → navega para /instagram/funil (rota real, Next.js)
   - Clique em Avatar → navega para /instagram/avatar (rota real, Next.js)
   - Apenas 'visao-geral-ig' continua sendo aba (overview dentro de /instagram)

   O mapa NAV_ITEM_TO_TAB_MAP agora só contém 'visao-geral-ig'.
   isNavItemActive para funil/avatar usa apenas pathname (sem activeTab).
   ========================================================================== */

import type { TabId } from '../../types/orbit'

// Apenas itens que SÃO abas dentro de /instagram ficam aqui
// Funil e Avatar foram promovidos para rotas próprias
export const NAV_ITEM_TO_TAB_MAP: Record<string, TabId> = {
  'visao-geral-ig': 'overview',
  // 'funil-simulador' → REMOVIDO: é rota /instagram/funil agora
  // 'avatar-alignment' → REMOVIDO: é rota /instagram/avatar agora
} as const

export function getTabForNavItem(itemId: string): TabId | null {
  return NAV_ITEM_TO_TAB_MAP[itemId] ?? null
}

/**
 * Determina se um item de nav está ativo.
 *
 * Lógica v2.0.0:
 * - Se o item mapeia para uma aba (visao-geral-ig):
 *   ativo se pathname === href E activeTab === expectedTab
 * - Se NÃO mapeia para aba (funil-simulador, avatar-alignment, carteira, alertas):
 *   ativo apenas se pathname === href (ou começa com href para rotas aninhadas)
 */
export function isNavItemActive(
  itemId: string,
  pathname: string,
  itemHref: string,
  activeTab: TabId
): boolean {
  const expectedTab = getTabForNavItem(itemId)

  if (expectedTab) {
    // É uma aba — precisa estar na rota E na aba certa
    return pathname === itemHref && activeTab === expectedTab
  }

  // É uma rota — apenas pathname
  // Usa startsWith para cobrir sub-rotas (ex: /instagram/funil/detail)
  return pathname === itemHref || pathname.startsWith(itemHref + '/')
}

export function getNavItemMapping(): Record<string, TabId> {
  return { ...NAV_ITEM_TO_TAB_MAP }
}

export function isValidNavItem(itemId: string): boolean {
  return itemId in NAV_ITEM_TO_TAB_MAP
}