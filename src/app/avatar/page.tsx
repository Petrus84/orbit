/* ==========================================================================
   ORBIT · Avatar Page (L4 — Rota)
   Caminho: src/app/instagram/avatar/page.tsx
   Versão: 2.0.0

   FIX 404: Esta rota não existia — Sidebar apontava para /instagram/avatar
   mas o arquivo não estava no filesystem.

   FIX AvatarScreen: O componente recebe clientId como prop OU lê de useParams.
   Como a rota não tem [clientId] na URL, passamos via prop explícita.

   FIX usePrototypeData: Removido do OrbitDashboardProvider (v2.0.0).

   FIX periodStart.toISOString(): OrbitDashboardProvider espera Date, não string.
   Esta versão passa Date diretamente (sem .toISOString()).
   ========================================================================== */

'use client'

import { useState } from 'react'
import { CLIENTS, PERIOD_START, PERIOD_END, type ClientKey } from '@/lib/constants'
import { OrbitDashboardProvider } from '@/context/OrbitDashboardContext'
import { AvatarScreen } from '@/components/screens/AvatarScreen'

export default function AvatarPage() {
  const clientKeys = Object.keys(CLIENTS) as ClientKey[]
  const [activeClientKey, setActiveClientKey] = useState<ClientKey>(clientKeys[0])
  const activeClient = CLIENTS[activeClientKey]

  return (
    <OrbitDashboardProvider
      clientId={activeClient.id}
      periodStart={PERIOD_START}   // ✅ Date — não .toISOString()
      periodEnd={PERIOD_END}       // ✅ Date — não .toISOString()
      // ✅ usePrototypeData REMOVIDO (v2.0.0 do context)
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

        {/* AvatarScreen com clientId explícito (não depende de useParams) */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <AvatarScreen clientId={activeClient.id} />
        </div>
      </div>
    </OrbitDashboardProvider>
  )
}