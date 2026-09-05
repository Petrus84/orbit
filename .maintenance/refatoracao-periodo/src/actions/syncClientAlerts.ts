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
   ORBIT · syncClientAlerts (Server Action)

   PATCHES aplicados nesta revisão (auditoria completa em cima do dataflow
   real do projeto, não da versão original que foi submetida):

   1) Import trocado de `instagramRepository` (arquivo órfão — consulta
      `kpi_snapshots`/`quality_scores`/`format_performance`, que não existem
      em nenhum schema do banco; zero consumidores no dataflow real do
      projeto) para `instagramOverviewRepository` (v4.1.0, migrado pra
      `orbit.*`, é o que `useInstagramOverview.ts` já usa em produção).

   2) `discoverDateBounds()` removido inteiramente. Não existe no projeto
      real — era exclusivo do arquivo órfão. `fetchInstagramOverview` da
      versão correta já resolve os bounds de data internamente
      (orbit.ig_account_snapshots, com fallback legado), então o passo
      era redundante além de quebrado.

   3) `fetchInstagramOverview` chamado com a assinatura real:
      um único parâmetro `{ clientId, periodStart, periodEnd }`, não 3
      argumentos soltos. periodStart/periodEnd abaixo são só um chute
      inicial de 90 dias — a função substitui pelos bounds reais quando
      existem.

   4) `resolveCtrBioAlert` e `resolveCreativeFatigueAlert` NÃO são chamados
      ainda — de propósito, não por esquecimento. Os dois exigem campos
      obrigatórios (não-nuláveis) que nenhuma fonte de dado do projeto
      expõe hoje:

        CtrBioInput.threshold            → orbit.clients tem
                                            threshold_ctr_bio_min, mas
                                            orbit.v_client_metrics (usada
                                            por clientsRepository) não
                                            expõe essa coluna
        CtrBioInput.daysBelowThreshold   → sem fonte
        CtrBioInput.linkIsWorking        → sem fonte (precisa de link
                                            checker, ainda não existe)
        CreativeFatigueInput.fatiguePct,
        .fatigueThreshold, .roasCurrent,
        .roasTarget                      → orbit.ads_meta_creatives e
                                            orbit.ads_meta_snapshots têm
                                            0 linhas no banco hoje

      Só `originBreakdown` (CtrBioInput) e `roasTrend` (CreativeFatigueInput)
      aceitam `null` nos dois tipos — os demais campos citados acima são
      `number`/`boolean` obrigatórios. Preencher qualquer um deles com um
      valor inventado violaria a REGRA-11 já documentada em
      clientsRepository.ts ("não mascarar ausência de dado" — o sinal de
      dado ausente tem que ser um estado explícito, não um número chutado
      competindo com dado real).

      `resolveAvatarAlert` (CASO B), `buildFunnelInsight` (CASO C) e
      `resolveEngagementCollapseAlert` (CASO D) também continuam fora por
      falta de fonte confirmada — nenhum avatarRepository/funnelRepository
      foi auditado nesta sessão, e `followerBalanceTrend`/`formatMixChanged`
      (CASO D) não têm coluna equivalente em orbit.v_client_metrics.

      Reativar CASO A/E é condicionado a:
        a) orbit.v_client_metrics (ou nova view) passar a expor threshold/
           dias-abaixo/status-do-link, e
        b) orbit.ads_meta_creatives / ads_meta_snapshots terem dado real.

   5) `periodStart`/`periodEnd` convertidos de `Date` para `string` via
      `.toISOString()` antes de chamar `fetchInstagramOverview`. O tipo
      `FetchOverviewParams` de `instagramOverviewRepository` espera strings
      nesses dois campos, não objetos `Date`. As variáveis intermediárias
      `periodStartObj`/`periodEndObj` guardam os `Date` originais só para
      o cálculo dos 90 dias; o que trafega para o repository é sempre a
      string ISO.

   6) 🆕 CASO G (`resolveEngagementScoreAlert`) LIGADO E CONFIRMADO EM
      PRODUÇÃO (25/08/2026). É o único dos 7 resolvers com fonte de dado
      confirmada: `orbit.ig_account_snapshots` expõe
      `er_real_pct`/`utility_score_pct`/`polemic_score_pct`/`vps_pct`
      juntos na mesma linha. Nova função `fetchLatestEngagementScoreSnapshot()`
      em `instagramOverviewRepository.ts` busca a linha mais recente do
      cliente; se qualquer um dos 4 campos vier `null`, ela devolve `null`
      inteiro (REGRA-11 — não monta input parcial) e o draft simplesmente
      não é gerado para este ciclo, sem quebrar o restante do sync.
      `resolveEngagementScoreAlert` é `async` porque chama `classifyMetric()`
      → RPC `fn_classify_metric` no Postgres 3 vezes (er, vps, polemic).

      ⚠️ HISTÓRICO: uma auditoria contra `orbit_schema.sql` encontrou que
      `fn_classify_metric` devolvia só 6 das 9 colunas que
      `FnClassifyMetricRow` (contentContractEngine.ts) espera — sem
      `semaphore`/`status_text`/`confidence_level` como campos próprios, e
      com `tier` preenchido por engano com string de confidence level em
      vez de `ref_thresholds.tier_normalized`. Isso fazia `row.semaphore`
      chegar `undefined` no TS, e o resolver caía sempre no branch verde
      por engano — falsa negativa silenciosa (violação de fato da
      REGRA-11, mesmo sem nenhum código TS estar "errado"). Migração
      corretiva foi escrita, revisada e EXECUTADA — `pg_proc` pós-migração
      confirma as 9 colunas no shape certo. Uma guarda defensiva
      permanece em `classifyMetric()` como backstop (não decide nada
      sozinha), mas o caminho principal já está correto.

   `overview` continua sendo buscado e entra na mensagem de retorno abaixo,
   mesmo não alimentando nenhum resolver diretamente — serve pro
   `insights`/`formatPerformance` que a tela consome via outro caminho.
   ========================================================================= */

export interface SyncClientAlertsResult {
  success: boolean
  alertsGenerated: number
  clientHandle?: string
  message?: string
  error?: string
}

export async function syncClientAlerts(clientId: string): Promise<SyncClientAlertsResult> {
  try {
    // 1) Identidade + métricas consolidadas (orbit.v_client_metrics + v_client_health)
    const client = await fetchClientById(clientId)
    if (!client) {
      throw new Error(`[Orquestrador] Cliente ${clientId} não encontrado.`)
    }

    // 2) Overview do Instagram. Convertendo Date para string (.toISOString())
    //    para satisfazer o FetchOverviewParams do instagramOverviewRepository.
    //    Bounds reais são resolvidos dentro da própria função
    //    (orbit.ig_account_snapshots, fallback legado) — os valores abaixo
    //    são só o chute inicial de 90 dias, calculados como Date e depois
    //    serializados para ISO string.
    const periodEndObj = new Date()
    const periodStartObj = new Date(periodEndObj)
    periodStartObj.setDate(periodStartObj.getDate() - 90)

    const overview = await fetchInstagramOverview({
      clientId,
      periodStart: periodStartObj.toISOString(),
      periodEnd: periodEndObj.toISOString(),
    })

    // 3) O Maquinário: apenas CASO G tem fonte de dado confirmada hoje —
    //    ver nota 6 no topo do arquivo. Os outros 6 resolvers ficam de fora
    //    até terem fonte real (nota 4).
    const validDrafts: AlertDraft[] = []

    const engagementSnapshot = await fetchLatestEngagementScoreSnapshot(clientId)
    if (engagementSnapshot) {
      const engagementDraft = await resolveEngagementScoreAlert(engagementSnapshot)
      validDrafts.push(engagementDraft)
    }
    // engagementSnapshot === null: cliente sem linha recente em
    // orbit.ig_account_snapshots com os 4 campos completos — não gera
    // draft para este ciclo (REGRA-11, ver fetchLatestEngagementScoreSnapshot).

    // 4) O Armazém: só grava se houver alguma coisa pra gravar.
    if (validDrafts.length > 0) {
      const batchPayload = validDrafts.map((draft) => ({
        draft,
        clientId: client.id,
        clientName: client.name,
        clientHandle: client.handle,
      }))
      await createAlertsBatch(batchPayload)
    }

    return {
      success: true,
      alertsGenerated: validDrafts.length,
      clientHandle: client.handle,
      message:
        validDrafts.length === 0
          ? `Nenhum alerta gerado — resolvers de CTR/bio, avatar, funil, colapso de engajamento e fadiga de criativo aguardando fonte de dado real; engagement score sem snapshot completo neste ciclo (ver comentário no topo do arquivo). Overview carregado: ${overview.kpis.length} KPIs, ${overview.qualityScores.length} quality scores.`
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