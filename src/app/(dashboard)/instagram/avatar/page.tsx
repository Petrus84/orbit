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
  const [activeClientKey, setActiveClientKey] = useState<ClientKey>(clientKeys[0])
  const activeClient = CLIENTS[activeClientKey]

  const [period, setPeriod] = useState<PeriodRange>({ start: PERIOD_START, end: PERIOD_END })
}