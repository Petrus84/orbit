
/* ==========================================================================
   ORBIT · Page — Carteira de Clientes
   Caminho: src/app/carteira/page.tsx
   Versão: 2.0.0 (integração real)

   v1.0.0 (estado anterior): placeholder estático ("Módulo em homologação
   de dados") — não importava CarteiraScreen nem useClients. CarteiraScreen
   e toda a cadeia (useClients.ts, clientsRepository.ts) eram código morto,
   inalcançável por nenhuma rota.

   v2.0.0:
   - Integra CarteiraScreen (components/screens/CarteiraScreen.tsx) via
     injeção de hooks, mesmo padrão de AlertasPage/FunnelPage: useClients
     e useAlerts passados como prop, nunca chamados direto na página.
   - useAlerts já é cross-client (não filtra por client_id — mesma decisão
     registrada em app/alertas/page.tsx), então reaproveitar o hook aqui
     com filter='critical' é a forma correta de mostrar "alertas urgentes"
     na Carteira sem duplicar lógica de fetch.
   - Depende de três correções aplicadas nesta integração que NÃO
     estavam no estado anterior do repo: types/client.ts (barrel não
     reexportava UseClientsResult nem ClientHealthStatus), useClients.ts
     (contrato UseClientsResult real de orbit.ts, com retry/backoff) e
     clientsRepository.ts (ClientHealthStatus importado corretamente em
     vez de confundido com ClientStatus). Colar só este arquivo sem os
     outros reintroduz os bugs já documentados.
   ========================================================================== */

'use client'

import CarteiraScreen from '@/components/screens/CarteiraScreen'
import { useClients } from '@/hooks/useClients'
import { useAlerts } from '@/hooks/useAlerts'

export default function CarteiraPage() {
  return <CarteiraScreen useClients={useClients} useAlerts={useAlerts} />
}