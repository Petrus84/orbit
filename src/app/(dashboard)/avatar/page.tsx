/* ==========================================================================
   ORBIT · Avatar Page
   Caminho: src/app/instagram/avatar/page.tsx
   Versão: 2.2.0

   FIX TS2613: import nomeado { AvatarScreen } — AvatarScreen.tsx não tem default export
   FIX TS2322: PERIOD_START/END passados como Date (sem .toISOString())

   REFATORAÇÃO (período dinâmico, 2026-08-31): PERIOD_START/PERIOD_END de
   constants.ts deixam de ser passados fixos pro Provider — viram só o
   valor default de um estado (`period`) editável via DateRangeControl.
   `AvatarScreen` continua recebendo só `clientId`, sem props de período —
   nada muda nela nem no hook que ela usa por baixo (useAvatar não foi
   tocado).
   ========================================================================== */

'use client'

import { useState } from 'react'
import { CLIENTS, PERIOD_START, PERIOD_END, type ClientKey } from '@/lib/constants'
import { OrbitDashboardProvider } from '@/context/OrbitDashboardContext'
import { AvatarScreen } from '@/components/screens/AvatarScreen'
import { DateRangeControl, type PeriodRange } from '@/components/common/DateRangeControl'

export default function AvatarPage() {
  const clientKeys = Object.keys(CLIENTS) as ClientKey[]
  const [activeClientKey, setActiveClientKey] = useState<ClientKey>(clientKeys[0]!)
  const activeClient = CLIENTS[activeClientKey]

  const [period, setPeriod] = useState<PeriodRange>({ start: PERIOD_START, end: PERIOD_END })

  return (
    <OrbitDashboardProvider
      clientId={activeClient.id}
      periodStart={period.start}   // ✅ Date — sem .toISOString()
      periodEnd={period.end}       // ✅ Date — sem .toISOString()
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg1)',
          }}
          aria-label="Selecionar cliente"
        >
          <div style={{ display: 'flex', gap: '8px' }}>
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
                    ? '1px solid var(--acc)'
                    : '1px solid var(--line)',
                  background: activeClientKey === key
                    ? 'var(--bg3)'
                    : 'transparent',
                  color: activeClientKey === key ? 'var(--acc)' : 'var(--t2)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeClientKey === key ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {CLIENTS[key].label}
              </button>
            ))}
          </div>

          <DateRangeControl value={period} onChange={setPeriod} minDate={PERIOD_START} maxDate={PERIOD_END} />
        </nav>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <AvatarScreen clientId={activeClient.id} />
        </div>

      </div>
    </OrbitDashboardProvider>
  )
}
