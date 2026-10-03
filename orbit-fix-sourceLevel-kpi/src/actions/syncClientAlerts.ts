'use server'

import { fetchClientById } from '@/lib/repositories/clientsRepository'
import {
  fetchInstagramOverview,
  fetchLatestEngagementScoreSnapshot,
} from '@/lib/repositories/instagramOverviewRepository'
import { createAlertsBatch } from '@/lib/repositories/alertsRepository'
import { resolveEngagementScoreAlert } from '@/lib/repositories/contentContractEngine'
import type { AlertDraft } from '@/lib/repositories/contentContractEngine'

/* ============================================================================
   ORBIT · syncClientAlerts (Server Action v3.0.2)

   REVISÃO E CORREÇÕES (04/09/2026):
   1) 🛡️ ALINHAMENTO COM ALERTS REPOSITORY v3.0.2: `createAlertsBatch` agora
      retorna apenas os alertas efetivamente gravados na tabela `orbit.alerts`
      (descartando tipos transitórios como 'data_gap'). O retorno
      `alertsGenerated` passa a refletir exatamente `createdAlerts.length`.
   2) 🔍 CHECAGEM DE NULABILIDADE: Adicionada verificação defensiva em
      `engagementDraft` antes do `validDrafts.push()` para evitar inclusão
      de valores nulos ou indefinidos no lote.
   3) 🏷️ TIPAGEM E DADOS: 100% tipado, sem uso de `any` ou typecasts perigosos.
      Conserva os limites de data formatados via `.toISOString()` compatíveis
      com `fetchInstagramOverview`.
   ========================================================================= */

export interface SyncClientAlertsResult {
  success: boolean
  alertsGenerated: number
  clientHandle?: string | undefined
  message?: string | undefined
  error?: string | undefined
}

export async function syncClientAlerts(clientId: string): Promise<SyncClientAlertsResult> {
  try {
    // 1) Identidade + métricas consolidadas (orbit.v_client_metrics + v_client_health)
    const client = await fetchClientById(clientId)
    if (!client) {
      throw new Error(`[Orquestrador] Cliente ${clientId} não encontrado.`)
    }

    // 2) Overview do Instagram. Convertendo Date para ISO String para satisfazer
    //    o FetchOverviewParams do instagramOverviewRepository.
    const periodEndObj = new Date()
    const periodStartObj = new Date(periodEndObj)
    periodStartObj.setDate(periodStartObj.getDate() - 90)

    const overview = await fetchInstagramOverview({
      clientId,
      periodStart: periodStartObj.toISOString(),
      periodEnd: periodEndObj.toISOString(),
    })

    // 3) O Maquinário: Apenas CASO G (Engagement Score) tem fonte de dado confirmada hoje.
    const validDrafts: AlertDraft[] = []

    const engagementSnapshot = await fetchLatestEngagementScoreSnapshot(
      clientId,
      periodStartObj.toISOString(),
      periodEndObj.toISOString(),
    )
    if (engagementSnapshot) {
      const engagementDraft = await resolveEngagementScoreAlert(engagementSnapshot)
      if (engagementDraft) {
        validDrafts.push(engagementDraft)
      }
    }

    // 4) O Armazém: envia para persistência e contabiliza alertas criados em banco
    let createdAlertsCount = 0

    if (validDrafts.length > 0) {
      const batchPayload = validDrafts.map((draft) => ({
        draft,
        clientId: client.id,
        clientName: client.name,
        clientHandle: client.handle,
      }))

      // createAlertsBatch filtra tipos transitórios ('data_gap') e retorna apenas alertas reais criados
      const createdAlerts = await createAlertsBatch(batchPayload)
      createdAlertsCount = createdAlerts.length
    }

    return {
      success: true,
      alertsGenerated: createdAlertsCount,
      clientHandle: client.handle,
      message:
        createdAlertsCount === 0
          ? `Nenhum alerta gerado — resolvers de CTR/bio, avatar, funil, colapso de engajamento e fadiga de criativo aguardando fonte de dado real; engagement score sem snapshot completo ou sem alerta crítico neste ciclo. Overview carregado: ${overview.kpis.length} KPIs, ${overview.qualityScores.length} quality scores.`
          : undefined,
    }
  } catch (error) {
    console.error(`[Orquestrador] Falha ao sincronizar alertas para ${clientId}:`, error)
    return {
      success: false,
      alertsGenerated: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}