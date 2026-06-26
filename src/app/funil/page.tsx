/* ==========================================================================
   ORBIT · Funil Page (L4 — Rota)
   Caminho: src/app/instagram/funil/page.tsx
   Versão: 2.0.0

   FIX 404: Esta rota não existia. Sidebar apontava para /instagram/funil
   mas o arquivo não estava na pasta — Next.js retornava 404.

   FIX FunnelScreen: O componente espera a prop useFunnel (injeção de hook).
   O clientId é lido de useOrbitDashboard() dentro do FunnelScreen via
   useParams<{ clientId }>() — mas como não há [clientId] na URL, usamos
   a prop clientId do contexto injetada via wrapper abaixo.

   ARQUITETURA:
   - FunnelScreen.tsx espera: useFunnel(clientId: string) => UseFunnelResult
   - FunnelScreen lê clientId via useParams — mas a rota não tem [clientId]
   - SOLUÇÃO: Wrapper que passa clientId via prop explícita ao invés de params
   ========================================================================== */

'use client'

import { useState } from 'react'
import { CLIENTS, PERIOD_START, PERIOD_END, type ClientKey } from '@/lib/constants'
import { OrbitDashboardProvider } from '@/context/OrbitDashboardContext'
import { useFunnel } from '@/hooks/useFunnel'
import FunnelScreenWrapper from './_FunnelScreenWrapper'

export default function FunnelPage() {
  const clientKeys = Object.keys(CLIENTS) as ClientKey[]
  const [activeClientKey, setActiveClientKey] = useState<ClientKey>(clientKeys[0])
  const activeClient = CLIENTS[activeClientKey]

  return (
    <OrbitDashboardProvider
      clientId={activeClient.id}
      periodStart={PERIOD_START}
      periodEnd={PERIOD_END}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0C0C0F' }}>
        {/* Seletor de cliente */}
        <nav
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
          }}
          aria-label="Selecionar cliente"
        >
          {clientKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveClientKey(key)}
              aria-pressed={activeClientKey === key}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: activeClientKey === key
                  ? '1px solid rgba(200,255,87,0.4)'
                  : '1px solid rgba(255,255,255,0.1)',
                background: activeClientKey === key
                  ? 'rgba(200,255,87,0.1)'
                  : 'transparent',
                color: activeClientKey === key ? '#C8FF57' : '#888',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeClientKey === key ? 500 : 400,
                transition: 'all 0.15s',
              }}
            >
              {CLIENTS[key].label}
            </button>
          ))}
        </nav>

        {/* FunnelScreen com clientId explícito (não depende de useParams) */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FunnelScreenWrapper
            clientId={activeClient.id}
            useFunnel={useFunnel}
          />
        </div>
      </div>
    </OrbitDashboardProvider>
  )
}