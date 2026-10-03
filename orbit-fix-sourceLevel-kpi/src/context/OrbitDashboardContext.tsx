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

import {
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
} from '@/hooks/useInstagramOverview'
import type { TabId } from '@/types/orbit'

// ─── Interface do contexto ───────────────────────────────────────────────────

// ✅ CORREÇÃO (L4 — Sidebar.tsx ao vivo): Sidebar consumia `currentClient`/
// `alertCount`, que não existiam no contexto real (TS2339, quebrava
// /instagram, o dashboard principal). Os dois campos vêm de dado que já é
// buscado por useInstagramOverview — nenhuma chamada nova:
// - currentClient.name: data.meta.clientHandle (já vem da view de overview)
// - currentClient.status: sinal real derivado da presença de alertas
//   críticos (não é um health status calculado em lugar nenhum ainda — não
//   inventado, apenas o sinal mais honesto disponível hoje)
// - alertCount: data.criticalAlerts.length (mesma lista que já populava
//   CriticalAlert.tsx em outro ponto da tela)
interface CurrentClientSummary {
  name: string
  status: 'healthy' | 'critical'
}

interface OrbitDashboardContextValue extends UseInstagramOverviewReturn {
  activeTab:     TabId
  setActiveTab:  (tab: TabId) => void
  clientId:      string
  currentClient: CurrentClientSummary | null
  alertCount:    number
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
      currentClient: overviewState.data
        ? {
            name: overviewState.data.meta.clientHandle,
            status: overviewState.data.criticalAlerts.length > 0 ? 'critical' : 'healthy',
          }
        : null,
      alertCount: overviewState.data?.criticalAlerts.length ?? 0,
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