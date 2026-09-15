/* ==========================================================================
   ORBIT · Dashboard Shell Layout
   Caminho: src/app/(dashboard)/layout.tsx
   Versão: 1.0.0

   Corrige Seção 5.3 do prompt de auditoria: Sidebar/Header só eram
   montados dentro de src/app/instagram/page.tsx — /carteira, /alertas,
   /avatar, /funil, /instagram/avatar, /instagram/funil e /onboarding
   renderizavam a tela isolada, sem caminho de volta.

   Decisão confirmada com o usuário (não inventada aqui):
   - Header.tsx fica SÓ em /instagram — está fisicamente hardcoded para a
     tela de Instagram Overview (título "Instagram — CP Import Store" e as
     3 abas Overview/Por post/Audiência lidas de data.meta), então colocá-lo
     neste layout mostraria informação enganosa nas outras rotas.
   - Sidebar.tsx é reaproveitada exatamente como está (não redesenhada).
     Ela depende de useOrbitDashboard() (lança exceção sem Provider), então
     este layout paga o custo de um OrbitDashboardProvider (fetch de
     Instagram Overview) só para currentClient/alertCount funcionarem aqui
     — custo aceito explicitamente pelo usuário, não decisão unilateral.
   - Cliente usado para esse Provider "de sidebar": o primeiro de CLIENTS
     (mesma ordem usada como default em avatar/funil/onboarding). Cada
     página filha que precisa de um cliente diferente já gerencia seu
     próprio seletor + OrbitDashboardProvider aninhado (avatar/funil), que
     sobrescreve este para os componentes abaixo dele na árvore — a Sidebar
     em si, por estar acima desses providers aninhados (renderizada aqui no
     layout), sempre lê deste Provider externo.
   ========================================================================== */

'use client'

import { OrbitDashboardProvider } from '@/context/OrbitDashboardContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { CLIENTS, PERIOD_START, getPeriodEnd } from '@/lib/constants'
import { useClientNow } from '@/hooks/useClientNow'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const defaultClientKey = Object.keys(CLIENTS)[0] as keyof typeof CLIENTS
  const defaultClient = CLIENTS[defaultClientKey]

  // FIX v1.0.2 (ripple effect de src/lib/constants.ts): ver nota em
  // src/app/(dashboard)/funil/page.tsx sobre por que PERIOD_END virou
  // getPeriodEnd() + useClientNow().
  const clientNow = useClientNow()
  const periodEnd = clientNow ?? getPeriodEnd()

  return (
    <OrbitDashboardProvider
      clientId={defaultClient.id}
      periodStart={PERIOD_START}
      periodEnd={periodEnd}
    >
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </OrbitDashboardProvider>
  )
}