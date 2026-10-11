/* ==========================================================================
   ORBIT · Onboarding Page
   Caminho: src/app/(dashboard)/onboarding/page.tsx
   Versão: 1.1.0

   ⚠️ ORB-DEBT-040 (ver relatório final / novo ADR): onboardingRepository.ts
   usa o client `supabase` padrão (anon key, client-side) para
   upsertClientOnboarding(). As tabelas do padrão authenticated_select_own_*
   (ADR-005) são SELECT-only para `authenticated` — não há policy de
   INSERT/UPDATE. Isso significa que o botão "Salvar" nesta tela falha hoje,
   silenciosamente, por RLS, independente desta rota estar religada
   corretamente. Este arquivo NÃO tenta corrigir RLS — está fora do escopo
   desta tarefa.
   ========================================================================== */

"use client";

import { useState } from "react";
import OnboardingScreen from "@/components/screens/OnboardingScreen";
import { ClientPeriodBar } from "@/components/layout/ClientPeriodBar";
import { CLIENTS, type ClientKey } from "@/lib/constants";

export default function OnboardingPage() {
  const clientKeys = Object.keys(CLIENTS) as ClientKey[];
  const [activeClientKey, setActiveClientKey] = useState<ClientKey>(
    clientKeys[0] ?? "cpimportstore",
  );
  const activeClient = CLIENTS[activeClientKey];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg)",
      }}
    >
      <ClientPeriodBar
        activeKey={activeClientKey}
        onSelect={setActiveClientKey}
      />

      <div style={{ flex: 1, overflow: "auto" }}>
        <OnboardingScreen clientId={activeClient.id} />
      </div>
    </div>
  );
}
