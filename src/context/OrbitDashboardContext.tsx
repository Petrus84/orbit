/* ==========================================================================
   ORBIT · Context — OrbitDashboardContext
   Versão: 1.4.0  |  Data: 2026-06-11
   Responsabilidade: Orquestrar dados do Repositório + estado da UI
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
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  clientId: string
  usePrototypeData: boolean
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
  children: ReactNode
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
  
  // ✅ CRÍTICO: Inicializa com false para usar dados REAIS do Supabase
  // useState(true) ativaria mocks de prototypeConstants.ts
  const [usePrototypeData, setUsePrototypeData] = useState(
    hookParams.usePrototypeData ?? false
  )

  // ✅ FIX v1.4.0: REMOVE duplicação de lógica
  // O hook useInstagramOverview já busca dados do repositório
  // Não precisa fazer await supabase aqui
  const overviewState = useInstagramOverview({
    ...hookParams,
    usePrototypeData,  // ← Propaga o estado dinâmico
  })

  const value = useMemo<OrbitDashboardContextValue>(
    () => ({
      ...overviewState,  // ← Dados reais já vêm daqui
      activeTab,
      setActiveTab,
      clientId: hookParams.clientId,
      usePrototypeData,
      setUsePrototypeData,
    }),
    [overviewState, activeTab, hookParams.clientId, usePrototypeData]
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




