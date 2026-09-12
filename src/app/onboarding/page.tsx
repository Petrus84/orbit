/* ==========================================================================
   ORBIT · Onboarding Page
   Caminho: src/app/onboarding/page.tsx
   Versão: 1.0.0

   Corrige ORB-DEBT (Seção 5.1 do prompt de auditoria): OnboardingScreen.tsx,
   useOnboarding.ts e onboardingRepository.ts já existiam e eram reais, mas
   nenhuma rota App Router montava esse fluxo — /onboarding retornava 404.

   Padrão de seleção de cliente replicado de src/app/avatar/page.tsx (rota
   client-scoped), não inventado aqui.

   ⚠️ ORB-DEBT-040 (ver relatório final / novo ADR): onboardingRepository.ts
   usa o client `supabase` padrão (anon key, client-side) para
   upsertClientOnboarding(). As tabelas do padrão authenticated_select_own_*
   (ADR-005) são SELECT-only para `authenticated` — não há policy de
   INSERT/UPDATE. Isso significa que o botão "Salvar" nesta tela falha hoje,
   silenciosamente, por RLS, independente desta rota estar religada
   corretamente. Este arquivo NÃO tenta corrigir RLS — está fora do escopo
   desta tarefa (Seção 3, "NÃO pode").
   ========================================================================== */

'use client'

import { useState } from 'react'
import OnboardingScreen from '@/components/screens/OnboardingScreen'
import { CLIENTS, type ClientKey } from '@/lib/constants'

export default function OnboardingPage() {
  const clientKeys = Object.keys(CLIENTS) as ClientKey[]
  const [activeClientKey, setActiveClientKey] = useState<ClientKey>(clientKeys[0] ?? 'cpimportstore')
  const activeClient = CLIENTS[activeClientKey]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <nav
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 20px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg1)',
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
      </nav>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <OnboardingScreen clientId={activeClient.id} />
      </div>
    </div>
  )
}
