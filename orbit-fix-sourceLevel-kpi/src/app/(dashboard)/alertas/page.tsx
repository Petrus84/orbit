/* ==========================================================================
   ORBIT · Page — Alertas
   Caminho: src/app/alertas/page.tsx
   Versão: 2.0.0 (fecha ORB-DEBT-006)

   v1.0.0 (estado anterior): placeholder estático, sem import de hook ou
   screen — "Aguardando gatilhos do schema orbit." Nenhuma integração.

   v2.0.0:
   - Integra AlertasScreen (components/screens/AlertasScreen.tsx) via
     injeção do hook useAlerts, mesmo padrão de FunnelPage/AvatarPage
     (hook passado como prop, não chamado direto na página).
   - SEM seletor de cliente / OrbitDashboardProvider: ao contrário de
     Funil e Avatar, esta tela é cross-client — alertsRepository.ts não
     filtra por client_id, cada alerta já vem com clientName/clientHandle
     via join. Adicionar um client-switcher aqui exigiria estender o
     repositório primeiro (fora do escopo desta integração).
   - Depende de duas correções aplicadas em 14/08/2026 que NÃO estavam no
     estado anterior do repo: hooks/useAlerts.ts (contagem por severidade
     sem o bug de 'success'/NaN) e components/screens/AlertasScreen.tsx
     (contrato correto do hook, campos reais de Alert). Colar só este
     arquivo sem os outros dois reintroduz os bugs já documentados.
   ========================================================================== */

'use client'

import AlertasScreen from '@/components/screens/AlertasScreen'
import { useAlerts } from '@/hooks/useAlerts'

export default function AlertasPage() {
  return <AlertasScreen useAlerts={useAlerts} />
}