/* ==========================================================================
   ORBIT · Context — OrbitDashboardContext
   Versão: 2.0.0  |  Data: 2026-06-20

   v2.0.0:
   ✅ usePrototypeData removido do estado, da interface e das props
   ✅ setUsePrototypeData removido
   ✅ UseInstagramOverviewParams não carrega mais flag de mock
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
// Interface do contexto
// ─────────────────────────────────────────────

interface OrbitDashboardContextValue extends UseInstagramOverviewReturn {
  activeTab:    TabId
  setActiveTab: (tab: TabId) => void
  clientId:     string
}

// ─────────────────────────────────────────────
// Criação do contexto
// ─────────────────────────────────────────────

const OrbitDashboardContext = createContext<OrbitDashboardContextValue | null>(null)

// ─────────────────────────────────────────────
// Props do Provider
// ─────────────────────────────────────────────

export interface OrbitDashboardProviderProps extends UseInstagramOverviewParams {
  children:          ReactNode
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

  const overviewState = useInstagramOverview(hookParams)

  const value = useMemo<OrbitDashboardContextValue>(
    () => ({
      ...overviewState,
      activeTab,
      setActiveTab,
      clientId: hookParams.clientId,
    }),
    [overviewState, activeTab, hookParams.clientId]
  )

  return (
    <OrbitDashboardContext.Provider value={value}>
      {children}
    </OrbitDashboardContext.Provider>
  )
}

// ─────────────────────────────────────────────
// Hook de consumo
// ─────────────────────────────────────────────

export function useOrbitDashboard(): OrbitDashboardContextValue {
  const ctx = useContext(OrbitDashboardContext)

  if (!ctx) {
    throw new Error(
      '[useOrbitDashboard] Deve ser usado dentro de <OrbitDashboardProvider>.'
    )
  }

  return ctx
}

