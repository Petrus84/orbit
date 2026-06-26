/* ==========================================================================
   ORBIT · Context — OrbitDashboardContext
   Caminho: src/context/OrbitDashboardContext.tsx
   Versão: 2.0.0

   v2.0.0:
   - usePrototypeData removido (era flag de mock — removido do hook também)
   - clientId exposto no contexto para screens que precisam (FunnelScreen, AvatarScreen)
   - setActiveTab exposto para Sidebar controlar abas sem prop drilling
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

// ─── Interface do contexto ───────────────────────────────────────────────────

interface OrbitDashboardContextValue extends UseInstagramOverviewReturn {
  activeTab:    TabId
  setActiveTab: (tab: TabId) => void
  clientId:     string
}

// ─── Criação do contexto ──────────────────────────────────────────────────────

const OrbitDashboardContext = createContext<OrbitDashboardContextValue | null>(null)

// ─── Props do Provider ────────────────────────────────────────────────────────

export interface OrbitDashboardProviderProps extends UseInstagramOverviewParams {
  children:          ReactNode
  initialActiveTab?: TabId
  // usePrototypeData REMOVIDO em v2.0.0
}

// ─── Provider ─────────────────────────────────────────────────────────────────

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

// ─── Hook de consumo ──────────────────────────────────────────────────────────

export function useOrbitDashboard(): OrbitDashboardContextValue {
  const ctx = useContext(OrbitDashboardContext)

  if (!ctx) {
    throw new Error(
      '[useOrbitDashboard] Deve ser usado dentro de <OrbitDashboardProvider>.'
    )
  }

  return ctx
}