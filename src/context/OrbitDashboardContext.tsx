/* ==========================================================================
   ORBIT · Context — OrbitDashboardContext
   Camada: [Hook] ➔ [Context] ➔ [Componentes de tela]
   Responsabilidade: disponibilizar dados e estado para a árvore de componentes.
   Versão: 1.2.0  |  Data: 2026-06-08
   Engenharia Sprint 2: Chaveamento dinâmico + eliminação de prop-drilling
   ========================================================================== */

'use client'

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  useInstagramOverview,
  type UseInstagramOverviewParams,
  type UseInstagramOverviewReturn,
} from '../hooks/useInstagramOverview'
import type { TabId } from '../types/orbit'

// ─────────────────────────────────────────────
// Shape do contexto (ESTENDIDO COM usePrototypeData)
// ─────────────────────────────────────────────

interface OrbitDashboardContextValue extends UseInstagramOverviewReturn {
  activeTab:           TabId
  setActiveTab:        (tab: TabId) => void
  clientId:            string
  usePrototypeData:    boolean
  setUsePrototypeData: (value: boolean) => void
}

// ─────────────────────────────────────────────
// Criação do contexto
// ─────────────────────────────────────────────

const OrbitDashboardContext = createContext<OrbitDashboardContextValue | null>(null)

// ─────────────────────────────────────────────
// Props do Provider
// ─────────────────────────────────────────────

export interface OrbitDashboardProviderProps
  extends UseInstagramOverviewParams {
  children:         ReactNode
  initialActiveTab?: TabId
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function OrbitDashboardProvider({
  children,
  initialActiveTab = 'overview',
  ...hookParams
}: OrbitDashboardProviderProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialActiveTab)
  
  // ✅ FIX v1.2.0: RESPEITA a prop inicial enviada pela page.tsx
  // Se page.tsx passa usePrototypeData={false}, o estado inicia como false
  // Se não passar nada, fallback para true (segurança)
  const [usePrototypeData, setUsePrototypeData] = useState(
    hookParams.usePrototypeData ?? true
  )

  // 💡 PROPAGAÇÃO CRÍTICA: Passa usePrototypeData para o hook
  // Garante que useInstagramOverview herde o estado dinâmico
  const overviewState = useInstagramOverview({
    ...hookParams,
    usePrototypeData, // ← LINHA CRÍTICA: Propagação do estado dinâmico
  })

  const value = useMemo<OrbitDashboardContextValue>(
    () => ({
      ...overviewState,
      activeTab,
      setActiveTab,
      clientId: hookParams.clientId,
      usePrototypeData,
      setUsePrototypeData,
    }),
    [overviewState, activeTab, hookParams.clientId, usePrototypeData],
  )

  return (
    <OrbitDashboardContext.Provider value={value}>
      {children}
    </OrbitDashboardContext.Provider>
  )
}

// ─────────────────────────────────────────────
// Consumer hook — uso nos componentes de tela
// ─────────────────────────────────────────────

export function useOrbitDashboard(): OrbitDashboardContextValue {
  const ctx = useContext(OrbitDashboardContext)

  if (!ctx) {
    throw new Error(
      '[useOrbitDashboard] Deve ser usado dentro de <OrbitDashboardProvider>.',
    )
  }

  return ctx
}
