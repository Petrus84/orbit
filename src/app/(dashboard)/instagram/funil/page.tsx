// src/app/instagram/funil/page.tsx
"use client";

import { useState } from "react";
import { CLIENTS, PERIOD_START, getPeriodEnd } from "@/lib/constants";
import { useClientNow } from "@/hooks/useClientNow";
import { OrbitDashboardProvider } from "@/context/OrbitDashboardContext";
import FunnelScreen from "@/components/screens/FunnelScreen";
import { useFunnel } from "@/hooks/useFunnel";
import type { PeriodRange } from "@/components/common/DateRangeControl";
import { ClientPeriodBar } from "@/components/layout/ClientPeriodBar";

export default function FunnelPage() {
  const clientKeys = Object.keys(CLIENTS) as (keyof typeof CLIENTS)[];
  const initialClientKey = clientKeys[0] ?? "cpimportstore";

  const [activeClientKey, setActiveClientKey] =
    useState<keyof typeof CLIENTS>(initialClientKey);
  const activeClient = CLIENTS[activeClientKey];

  // REFATORAÇÃO (período dinâmico, 2026-08-31): PERIOD_START/PERIOD_END de
  // constants.ts continuam sendo os valores DEFAULT (compat com o
  // comportamento anterior) — mas agora são só o valor inicial de um
  // estado que o usuário pode mudar via DateRangeControl, em vez de uma
  // constante fixa passada direto pro Provider.
  // FIX v1.0.2 (ripple effect de src/lib/constants.ts): PERIOD_END não existe
  // mais como constante — "agora" só é seguro depois do mount no cliente.
  const clientNow = useClientNow();
  const periodEnd = clientNow ?? getPeriodEnd();

  const [period, setPeriod] = useState<PeriodRange>({
    start: PERIOD_START,
    end: periodEnd,
  });

  return (
    <OrbitDashboardProvider
      clientId={activeClient.id}
      periodStart={period.start}
      periodEnd={period.end}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100dvh",
        }}
      >
        {/* Client Selector Nav */}
        <ClientPeriodBar
          activeKey={activeClientKey}
          onSelect={setActiveClientKey}
          period={{
            value: period,
            onChange: setPeriod,
            minDate: PERIOD_START,
            maxDate: periodEnd,
          }}
        />

        {/* Funel Screen */}
        <div style={{ flex: 1 }}>
          <FunnelScreen
            key={`${activeClient.id}:${period.start.toISOString()}:${period.end.toISOString()}`}
            clientId={activeClient.id}
            periodStart={period.start.toISOString()}
            periodEnd={period.end.toISOString()}
            useFunnel={useFunnel}
          />
        </div>
      </div>
    </OrbitDashboardProvider>
  );
}
