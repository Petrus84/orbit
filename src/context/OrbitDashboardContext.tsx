/* ==========================================================================
   ORBIT · Context — OrbitDashboardContext
   Caminho: src/context/OrbitDashboardContext.tsx
   Versão: 2.1.0

   v2.1.0 (correção ORBIT-BUG-01):
   - currentClient adicionado ao contexto, resolvido via fetchClientById(clientId)
     (mesmo repositório já usado em outras partes do app — nenhum fetch novo criado)
   - Nenhum novo Context foi criado: Sidebar já vive dentro da árvore do
     OrbitDashboardProvider (única árvore que a renderiza hoje), então
     currentClient cabe aqui sem introduzir CarteiraContext/AlertasContext
   - alertCount NÃO foi adicionado aqui de propósito: useAlerts() já é global
     (não depende de clientId) e deve ser chamado direto no componente que
     precisa do badge — ver Sidebar.tsx

   v2.0.0:
   - usePrototypeData removido (era flag de mock — removido do hook também)
   - clientId exposto no contexto para screens que precisam (FunnelScreen, AvatarScreen)
   - setActiveTab exposto para Sidebar controlar abas sem prop drilling
   ========================================================================== */

'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  useInstagramOverview,
  type UseInstagramOverviewParams,
  type UseInstagramOverviewReturn,
} from '../hooks/useInstagramOverview'
import { fetchClientById } from '../lib/repositories/clientsRepository'
import type { Client, TabId } from '../types/orbit'

// ─── Interface do contexto ───────────────────────────────────────────────────

interface OrbitDashboardContextValue extends UseInstagramOverviewReturn {
  activeTab:     TabId
  setActiveTab:  (tab: TabId) => void
  clientId:      string
  currentClient: Client | null
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
  const [currentClient, setCurrentClient] = useState<Client | null>(null)

  const overviewState = useInstagramOverview(hookParams)

  // ── Resolve o Client completo a partir do clientId ────────────────────────
  // fetchClientById já existe em clientsRepository.ts (usado em outros pontos
  // do app) — nenhuma query nova foi criada para esta correção.
  useEffect(() => {
    let cancelled = false

    fetchClientById(hookParams.clientId)
      .then((client) => {
        if (!cancelled) setCurrentClient(client)
      })
      .catch((err) => {
        console.error('[OrbitDashboardProvider] Falha ao buscar currentClient:', err)
        if (!cancelled) setCurrentClient(null)
      })

    return () => {
      cancelled = true
    }
  }, [hookParams.clientId])

  const value = useMemo<OrbitDashboardContextValue>(
    () => ({
      ...overviewState,
      activeTab,
      setActiveTab,
      clientId: hookParams.clientId,
      currentClient,
    }),
    [overviewState, activeTab, hookParams.clientId, currentClient]
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