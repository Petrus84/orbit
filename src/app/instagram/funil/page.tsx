// src/app/instagram/funil/page.tsx
/**
 * ORBIT · Funil Page (L4 — Rota)
 * Versão: 1.0.0
 * Responsabilidade: Renderizar FunnelScreen com seletor de clientes
 * 
 * Fluxo:
 * 1. Recebe CLIENTS (hardcoded)
 * 2. useState para activeClientKey
 * 3. Renderiza OrbitDashboardProvider com clientId
 * 4. Renderiza FunnelScreen (componente filho)
 */

'use client'

import { useState } from 'react'
import { CLIENTS, PERIOD_START, PERIOD_END } from '@/lib/constants'
import { OrbitDashboardProvider } from '@/context/OrbitDashboardContext'
import { useFunnel } from '@/hooks/useFunnel'
import FunnelScreen from '@/components/screens/FunnelScreen'

export default function FunnelPage() {
  const clientKeys = Object.keys(CLIENTS) as (keyof typeof CLIENTS)[]
  const [activeClientKey, setActiveClientKey] = useState<keyof typeof CLIENTS>(clientKeys[0])
  const activeClient = CLIENTS[activeClientKey]

  return (
    <OrbitDashboardProvider
      clientId={activeClient.id}
      periodStart={PERIOD_START}
      periodEnd={PERIOD_END}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Client Selector Nav */}
        <nav
          style={{
            display: 'flex',
            gap: '8px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg1)',
          }}
        >
          {clientKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveClientKey(key)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeClientKey === key ? '1px solid var(--acc)' : '1px solid var(--line)',
                background: activeClientKey === key ? 'var(--bg3)' : 'transparent',
                color: 'var(--t0)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeClientKey === key ? 500 : 400,
              }}
            >
              {CLIENTS[key].name}
            </button>
          ))}
        </nav>

        {/* Funel Screen */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FunnelScreen
            clientId={activeClient.id}
            periodStart={PERIOD_START.toISOString()}
            periodEnd={PERIOD_END.toISOString()}
            useFunnel={useFunnel}
          />
        </div>
      </div>
    </OrbitDashboardProvider>
  )
}