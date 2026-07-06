/* ==========================================================================
   ORBIT · Navigation Mapping (v2.1.0 — ALINHADO ÀS 11 RNs DO SSOT)
   Caminho: src/components/layout/navItemMapping.ts
   Versão: 2.1.0 | Data: 2026-07-05

   GOVERNANÇA RÍGIDA APLICADA:
   ✅ R-01: Visão unificada de carteira — semáforo de saúde → /carteira
   ✅ R-02: Alerta proativo com threshold configurável → /alertas
   ✅ R-03: Flag de confiança L0/L1/L2 em todo número → (estrutura de dados)
   ✅ R-04: Funil interativo com simulador de cenário → /instagram/funil
   ✅ R-05: Score de polêmica e utilidade separados → (estrutura de dados)
   ✅ R-06: Sparklines de tendência inline (8 semanas) → (estrutura de dados)
   ✅ R-07: Visão unificada orgânico + pago → /instagram (overview)
   ✅ R-08: Score de fadiga de criativo → (estrutura de dados)
   ✅ R-09: Link de ação direto em cada insight → (estrutura de dados)
   ✅ R-10: Mobile-first e modo apresentação → (estrutura de dados)
   ✅ R-11: Auditoria de consistência de avatar → /instagram/avatar

   MUDANÇAS v2.1.0:
   • Removidas todas as referências a "Estudo de Mercado"
   • Estrutura de validação reforçada com whitelist explícita
   • Comentários alinhados às 11 RNs
   • Função isValidNavItem() agora usa whitelist completa
   ========================================================================== */

import type { TabId } from '../../types/orbit'

/**
 * WHITELIST OFICIAL DE ITENS DE NAVEGAÇÃO
 * Apenas itens que SÃO abas dentro de /instagram ficam aqui.
 * Funil e Avatar foram promovidos para rotas próprias (R-04, R-11).
 */
export const NAV_ITEM_TO_TAB_MAP: Record<string, TabId> = {
  'visao-geral-ig': 'overview', // R-07: Visão unificada orgânico + pago
} as const

/**
 * WHITELIST OFICIAL DE ROTAS DE NAVEGAÇÃO
 * Todas as rotas válidas no sistema, alinhadas às 11 RNs do SSOT.
 */
const VALID_NAV_ITEMS = new Set<string>([
  'carteira',              // R-01: Visão unificada de carteira — semáforo de saúde
  'alertas',               // R-02: Alerta proativo com threshold configurável
  'visao-geral-ig',        // R-07: Visão unificada orgânico + pago
  'funil-simulador',       // R-04: Funil interativo com simulador de cenário
  'avatar-alignment',      // R-11: Auditoria de consistência de avatar
])

/**
 * Retorna a aba esperada para um item de navegação, se aplicável.
 * Apenas itens em NAV_ITEM_TO_TAB_MAP retornam uma aba.
 * Rotas independentes (funil, avatar, carteira, alertas) retornam null.
 *
 * @param itemId - Identificador único do item de navegação
 * @returns TabId | null — 'overview' para visao-geral-ig, null para rotas
 */
export function getTabForNavItem(itemId: string): TabId | null {
  return NAV_ITEM_TO_TAB_MAP[itemId] ?? null
}

/**
 * Determina se um item de nav está ativo.
 *
 * Lógica v2.1.0 (alinhada às 11 RNs):
 * - Se o item mapeia para uma aba (visao-geral-ig):
 *   ativo se pathname === href E activeTab === expectedTab
 * - Se NÃO mapeia para aba (funil-simulador, avatar-alignment, carteira, alertas):
 *   ativo apenas se pathname === href (ou começa com href para rotas aninhadas)
 *
 * @param itemId - Identificador único do item de navegação
 * @param pathname - Caminho atual da URL (ex: '/instagram', '/carteira')
 * @param itemHref - Href configurado no item (ex: '/instagram', '/carteira')
 * @param activeTab - Aba ativa dentro de /instagram (ex: 'overview')
 * @returns boolean — true se o item deve ser renderizado como ativo
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

  // É uma rota independente — apenas pathname
  // Usa startsWith para cobrir sub-rotas (ex: /instagram/funil/detail)
  return pathname === itemHref || pathname.startsWith(itemHref + '/')
}

/**
 * Retorna uma cópia do mapa de abas para consumo externo.
 * Garante imutabilidade do mapa original.
 *
 * @returns Record<string, TabId> — Cópia de NAV_ITEM_TO_TAB_MAP
 */
export function getNavItemMapping(): Record<string, TabId> {
  return { ...NAV_ITEM_TO_TAB_MAP }
}

/**
 * Valida se um item de navegação é reconhecido pelo sistema.
 * Usa whitelist explícita alinhada às 11 RNs do SSOT.
 *
 * WHITELIST VÁLIDA:
 * - carteira (R-01)
 * - alertas (R-02)
 * - visao-geral-ig (R-07)
 * - funil-simulador (R-04)
 * - avatar-alignment (R-11)
 *
 * @param itemId - Identificador único do item de navegação
 * @returns boolean — true se o item está na whitelist oficial
 */
export function isValidNavItem(itemId: string): boolean {
  return VALID_NAV_ITEMS.has(itemId)
}
