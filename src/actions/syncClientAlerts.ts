"use server";

// ============================================================================
// src/actions/syncClientAlerts.ts  (v4.0.0 — substitui a v3.0.2)
//
// Mudanças:
// 1) AUTORIZAÇÃO: antes qualquer chamador passava um clientId arbitrário.
//    Agora exige sessão e só prossegue se o cliente é visível ao usuário via
//    RLS (policy authenticated_select_own_clients) — só então a escrita usa
//    service_role. Sem isso, trocar INSERT por service_role seria um IDOR.
// 2) LEITURA: os repositórios usavam o client anon do navegador, que no
//    servidor não tem sessão (RLS devolve vazio => "cliente não encontrado" /
//    snapshot null). O client com cookies do servidor é injetado.
// 3) ESCRITA: upsertAlertsBatch (find-or-update, idempotente) no lugar de
//    createAlertsBatch (INSERT puro, quebra em alerts_dedup).
// 4) fetchInstagramOverview removido: servia só para montar a mensagem.
// ============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchLatestEngagementScoreSnapshot,
  fetchClientOnboarding,
} from "@/lib/repositories/instagramOverviewRepository";
import type { OrbitDbClient } from "@/lib/repositories/instagramOverviewRepository";
import {
  resolveEngagementScoreAlert,
  mapSegmentToCategory,
  mapFollowersToTier,
} from "@/lib/repositories/contentContractEngine";
import type { AlertDraft } from "@/lib/repositories/contentContractEngine";
import {
  upsertAlertsBatch,
  resolveOpenAlertForKey,
} from "@/lib/repositories/alertsWriter.server";

// DECISÃO DE PRODUTO (pendente no chat): quais severidades viram linha em
// orbit.alerts. Default = só warning/critical, igual ao que a tela já faz em
// fetchCriticalAlerts (instagramOverviewRepository). Para manter a aba "Info"
// na Central, mude para true — o writer então atualiza a linha no lugar.
const PERSIST_INFO_ALERTS = false;
const AUTO_RESOLVED_BY = "system:syncClientAlerts";

export interface SyncClientAlertsResult {
  success: boolean;
  alertsGenerated: number; // inseridos
  alertsUpdated: number; // atualizados in-place ou reabertos
  alertsSkipped: number; // transitórios ou já resolvidos para o mesmo snapshot
  alertsAutoResolved: number; // abertos cuja condição acabou (draft info na mesma chave)
  clientHandle?: string | undefined;
  message?: string | undefined;
  error?: string | undefined;
}

const fail = (error: string): SyncClientAlertsResult => ({
  success: false,
  alertsGenerated: 0,
  alertsUpdated: 0,
  alertsSkipped: 0,
  alertsAutoResolved: 0,
  error,
});

export async function syncClientAlerts(
  clientId: string,
): Promise<SyncClientAlertsResult> {
  try {
    const db = await createSupabaseServerClient();

    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return fail("Não autenticado.");

    // RLS decide: se o usuário não é dono do cliente, volta null.
    const { data: client, error: clientErr } = await db
      .schema("orbit")
      .from("clients")
      .select("id, name, handle")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr)
      throw new Error(
        `[Orquestrador] leitura do cliente falhou: ${clientErr.message}`,
      );
    if (!client) return fail("Cliente não encontrado ou sem permissão.");

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 90);

    // Cast único e deliberado: o client do @supabase/ssr não é tipado com
    // Database<'orbit'>; os leitores só usam .schema('orbit').from(...).
    const readerDb = db as unknown as OrbitDbClient;

    const drafts: AlertDraft[] = [];
    let autoResolved = 0;
    const [snapshot, onboarding] = await Promise.all([
      fetchLatestEngagementScoreSnapshot(
        clientId,
        start.toISOString(),
        end.toISOString(),
        readerDb,
      ),
      fetchClientOnboarding(clientId, readerDb),
    ]);
    if (snapshot) {
      // Mesma categoria/porte que a tela usa (fetchCriticalAlerts): sem isso o
      // sync classificaria em 'all'/'all' e o alerta persistido divergiria do
      // que o usuário vê no overview.
      const category = mapSegmentToCategory(
        onboarding?.setor_benchmark ?? null,
      );
      const tier = mapFollowersToTier(onboarding?.total_followers ?? null);
      const draft = await resolveEngagementScoreAlert(
        snapshot,
        category,
        tier,
        readerDb,
      );

      const persistable =
        PERSIST_INFO_ALERTS ||
        (draft.severity !== "info" && draft.severity !== "success");
      if (persistable) {
        drafts.push(draft);
      } else {
        // Condição cleared para esta chave: fecha o alerta aberto, se houver.
        autoResolved += await resolveOpenAlertForKey(
          client.id,
          { type: draft.type, metricName: draft.metricName ?? null },
          AUTO_RESOLVED_BY,
        );
      }
    }

    const results = drafts.length
      ? await upsertAlertsBatch(client.id, drafts)
      : [];
    const count = (a: string) => results.filter((r) => r.action === a).length;

    return {
      success: true,
      alertsGenerated: count("inserted"),
      alertsUpdated: count("updated") + count("reopened"),
      alertsSkipped:
        results.length -
        count("inserted") -
        count("updated") -
        count("reopened"),
      alertsAutoResolved: autoResolved,
      clientHandle: client.handle,
      message:
        results.length === 0 && autoResolved === 0
          ? "Nenhum alerta neste ciclo: só o CASO G (engagement score) tem fonte de dado hoje e não há snapshot completo ou alerta aplicável."
          : undefined,
    };
  } catch (error) {
    console.error(
      `[Orquestrador] Falha ao sincronizar alertas para ${clientId}:`,
      error,
    );
    return fail(error instanceof Error ? error.message : "Erro desconhecido");
  }
}
