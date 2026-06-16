/* ==========================================================================
   ORBIT · Navigation Mapping (v1.0.0)
   Caminho físico real: src/components/layout/navItemMapping.ts
   Responsabilidade: Centralizar mapeamento de item.id → TabId
   Data: 2026-06-12 - 22:45 (São Paulo)
   Status: ✅ PRONTO PARA PRODUÇÃO
   ========================================================================== */

import type { TabId } from '../../types/orbit'

/**
 * Mapeamento centralizado de itens de navegação para abas.
 * 
 * BENEFÍCIOS:
 * ✅ Single Source of Truth (SSOT) — evita duplicação
 * ✅ Fácil manutenção — alterar em um lugar afeta tudo
 * ✅ Tipagem segura — TypeScript garante consistência
 * ✅ Testabilidade — funções puras e isoladas
 * 
 * ORIGEM: P0_task_spec.md (Seção 3.1 - Ubiquitous Language)
 */
export const NAV_ITEM_TO_TAB_MAP: Record<string, TabId> = {
  'visao-geral-ig': 'overview',
  'funil-simulador': 'por-post',
  'avatar-alignment': 'audiencia',
} as const

/**
 * Obtém a aba correspondente para um item de navegação.
 * 
 * @param itemId - ID do item de navegação (ex: 'funil-simulador')
 * @returns TabId correspondente ou null se não encontrado
 * 
 * @example
 * const tabId = getTabForNavItem('funil-simulador')
 * // Retorna: 'por-post'
 */
export function getTabForNavItem(itemId: string): TabId | null {
  return NAV_ITEM_TO_TAB_MAP[itemId] ?? null
}

/**
 * Verifica se um item de navegação está ativo.
 * 
 * LÓGICA:
 * 1. Se o item NÃO mapeia para uma aba → apenas verificar pathname
 * 2. Se o item mapeia para uma aba → verificar AMBAS as condições:
 *    - pathname === itemHref (rota correta)
 *    - activeTab === expectedTab (aba correta)
 * 
 * @param itemId - ID do item de navegação
 * @param pathname - Rota atual (ex: '/instagram/funil')
 * @param itemHref - href do item (ex: '/instagram/funil')
 * @param activeTab - Aba ativa no contexto (ex: 'por-post')
 * @returns true se o item está ativo
 * 
 * @example
 * // Caso 1: Item que mapeia para aba
 * isNavItemActive('funil-simulador', '/instagram/funil', '/instagram/funil', 'por-post')
 * // Retorna: true (rota correta E aba correta)
 * 
 * @example
 * // Caso 2: Item que NÃO mapeia para aba
 * isNavItemActive('carteira', '/carteira', '/carteira', 'overview')
 * // Retorna: true (apenas rota correta)
 */
export function isNavItemActive(
  itemId: string,
  pathname: string,
  itemHref: string,
  activeTab: TabId
): boolean {
  const expectedTab = getTabForNavItem(itemId)
  
  // Se o item não mapeia para uma aba, apenas verificar pathname
  if (!expectedTab) {
    return pathname === itemHref
  }
  
  // Se mapeia para uma aba, verificar AMBAS as condições
  return pathname === itemHref && activeTab === expectedTab
}

/**
 * Obtém o mapeamento completo para fins de debug/logging.
 * 
 * @returns Objeto com todos os mapeamentos
 * 
 * @example
 * const mapping = getNavItemMapping()
 * console.log(mapping)
 * // {
 * //   'visao-geral-ig': 'overview',
 * //   'funil-simulador': 'por-post',
 * //   'avatar-alignment': 'audiencia'
 * // }
 */
export function getNavItemMapping(): Record<string, TabId> {
  return { ...NAV_ITEM_TO_TAB_MAP }
}

/**
 * Valida se um itemId é válido (existe no mapeamento).
 * 
 * @param itemId - ID do item a validar
 * @returns true se o itemId existe no mapeamento
 * 
 * @example
 * isValidNavItem('funil-simulador') // true
 * isValidNavItem('item-inexistente') // false
 */
export function isValidNavItem(itemId: string): boolean {
  return itemId in NAV_ITEM_TO_TAB_MAP
}




