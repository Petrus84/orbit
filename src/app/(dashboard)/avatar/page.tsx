/* ==========================================================================
   ORBIT · Avatar Page
   Caminho: src/app/instagram/avatar/page.tsx
   Versão: 2.1.0

   FIX TS2613: import nomeado { AvatarScreen } — AvatarScreen.tsx não tem default export
   FIX TS2322: PERIOD_START/END passados como Date (sem .toISOString())
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
      periodStart={PERIOD_START}   // ✅ Date — sem .toISOString()
      periodEnd={PERIOD_END}       // ✅ Date — sem .toISOString()
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0C0C0F' }}>

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
              type="button"
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

        <div style={{ flex: 1, overflow: 'auto' }}>
          <AvatarScreen clientId={activeClient.id} />
        </div>

      </div>
    </OrbitDashboardProvider>
  )
}