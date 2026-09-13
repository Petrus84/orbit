// src/app/instagram/funil/page.tsx
'use client'

import { useState } from 'react'
import { CLIENTS, PERIOD_START, PERIOD_END } from '@/lib/constants'
import { OrbitDashboardProvider } from '@/context/OrbitDashboardContext'
import FunnelScreen from '@/components/screens/FunnelScreen'
import { useFunnel } from '@/hooks/useFunnel'
import { DateRangeControl, type PeriodRange } from '@/components/common/DateRangeControl'

export default function FunnelPage() {
  const clientKeys = Object.keys(CLIENTS) as (keyof typeof CLIENTS)[]
  const initialClientKey = clientKeys[0] ?? 'cpimportstore'
  
    
  const [activeClientKey, setActiveClientKey] =
    useState<keyof typeof CLIENTS>(initialClientKey)
  const activeClient = CLIENTS[activeClientKey]

  // REFATORAÇÃO (período dinâmico, 2026-08-31): PERIOD_START/PERIOD_END de
  // constants.ts continuam sendo os valores DEFAULT (compat com o
  // comportamento anterior) — mas agora são só o valor inicial de um
  // estado que o usuário pode mudar via DateRangeControl, em vez de uma
  // constante fixa passada direto pro Provider.
  const [period, setPeriod] = useState<PeriodRange>({ start: PERIOD_START, end: PERIOD_END })

  return (
    <OrbitDashboardProvider
      clientId={activeClient.id}
      periodStart={period.start}
      periodEnd={period.end}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Client Selector Nav */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg1)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>

          <DateRangeControl value={period} onChange={setPeriod} minDate={PERIOD_START} maxDate={PERIOD_END} />
        </nav>

        {/* Funel Screen */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FunnelScreen
            clientId={activeClient.id}
            periodStart={period.start.toISOString()}
            periodEnd={period.end.toISOString()}
            useFunnel={useFunnel}
          />
        </div>
      </div>
    </OrbitDashboardProvider>
  )
}
