"use server";

// ============================================================================
// src/actions/syncClientAlerts.ts (v5.0.1)
//
// v5.0.1: staleness lê a MESMA fonte do semáforo da Carteira
//   (orbit.v_client_health.last_updated); ig_account_snapshots só entra como
//   fallback de data e como snapshot_id (necessário para reabrir alertas).
//   Polêmica depende de fetchPolemicMedianInPeriod usar o oráculo SSC-1
//   (n >= 5, likes > 0) — ver PATCHES.md §C.
//
// Mudanças (v5.0.0 — Opção B, escopo completo):
// 1) Passa a avaliar TRÊS fontes de alerta: Engajamento, Polêmica e
//    Staleness (dado desatualizado). Antes só o Engajamento era avaliado, e a
//    Carteira (v_client_health) pintava "Crítico" sem nenhum alerta no banco.
// 2) Todos os drafts são acumulados e deduplicados por chave
//    (type + metricName) antes de ir para upsertAlertsBatch — o resolver de
//    Engajamento também pode devolver um draft de polêmica, e o writer só
//    aceita uma linha por chave.
// 3) Auto-resolve: chave "saudável" (métrica presente e sem alerta) fecha o
//    alerta aberto da mesma chave. Métrica AUSENTE nunca fecha alerta —
//    ausência de dado não é saúde.
//
// Mudanças (v4.1.0 - Fechamento SSC-1/SSC-2):
// - Aceita startIso/endIso da UI (sem hardcode de 90 dias) para que a
//   mediana de Polêmica seja igual à do Card de Qualidade na mesma janela.
//
// Herdado da v4.0.0: sessão + RLS; leitura com client de cookies; escrita via
// upsertAlertsBatch (find-or-update, idempotente).
// ============================================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchLatestEngagementScoreSnapshot,
  fetchClientOnboarding,
} from "@/lib/repositories/instagramOverviewRepository";
import type { OrbitDbClient } from "@/lib/repositories/instagramOverviewRepository";
import {
  resolveEngagementScoreAlert,
  resolvePolemicAlert,
  resolveStalenessAlert,
  mapSegmentToCategory,
  mapFollowersToTier,
  POLEMIC_ALERT_TYPE,
  POLEMIC_METRIC_NAME,
  STALENESS_ALERT_TYPE,
  STALENESS_METRIC_NAME,
} from "@/lib/repositories/contentContractEngine";
import type { AlertDraft } from "@/lib/repositories/contentContractEngine";
import {
  upsertAlertsBatch,
  resolveOpenAlertForKey,
} from "@/lib/repositories/alertsWriter.server";
import type { AlertKey } from "@/lib/repositories/alertsWriter.server";
import type { AlertSeverity } from "@/types/alert";

const PERSIST_INFO_ALERTS = false;
const AUTO_RESOLVED_BY = "system:syncClientAlerts";

export interface SyncClientAlertsResult {
  success: boolean;
  alertsGenerated: number;
  alertsUpdated: number;
  alertsSkipped: number;
  alertsAutoResolved: number;
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

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  success: 0,
  info: 1,
  warning: 2,
  critical: 3,
};

const keyOf = (type: string, metricName: string | null | undefined): string =>
  `${type}|${metricName ?? ""}`;

// Último snapshot da conta, SEM filtro de janela: staleness mede "quanto tempo
// faz desde a última coleta", não "o que existe na janela da tela".
// ⚠️ Confirmar que bate com orbit.v_carteira_clients.last_snapshot_date (o que o
// ClientCard exibe). Se a view usar outra coluna, troque aqui.
type LatestSnapshotMeta = { id: string; period_end: string };

async function fetchLatestSnapshotMeta(
  clientId: string,
  db: OrbitDbClient,
): Promise<LatestSnapshotMeta | null> {
  const { data, error } = await db
    .schema("orbit")
    .from("ig_account_snapshots")
    .select("id, period_end")
    .eq("client_id", clientId)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<LatestSnapshotMeta, { merge: false }>();

  if (error) {
    throw new Error(
      `[Orquestrador] leitura do último snapshot falhou: ${error.message}`,
    );
  }
  return data ?? null;
}

// Mesma fonte do badge da Carteira (v_client_health). Se a view não tiver
// linha ou last_updated vier null, devolve null e o chamador usa o fallback.
type HealthFreshnessRow = { last_updated: string | null };

async function fetchHealthLastUpdated(
  clientId: string,
  db: OrbitDbClient,
): Promise<string | null> {
  const { data, error } = await db
    .schema("orbit")
    .from("v_client_health")
    .select("last_updated")
    .eq("client_id", clientId)
    .maybeSingle()
    .overrideTypes<HealthFreshnessRow, { merge: false }>();

  if (error) {
    throw new Error(
      `[Orquestrador] leitura de v_client_health falhou: ${error.message}`,
    );
  }
  return data?.last_updated ?? null;
}

export async function syncClientAlerts(
  clientId: string,
  startIso: string,
  endIso: string,
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

    const readerDb = db as unknown as OrbitDbClient;

    const [snapshot, onboarding, latestSnapshot, healthLastUpdated] =
      await Promise.all([
        fetchLatestEngagementScoreSnapshot(
          clientId,
          startIso,
          endIso,
          readerDb,
        ),
        fetchClientOnboarding(clientId, readerDb),
        fetchLatestSnapshotMeta(clientId, readerDb),
        fetchHealthLastUpdated(clientId, readerDb),
      ]);

    // Todos os candidatos, antes da deduplicação.
    const candidates: AlertDraft[] = [];
    // Chaves cuja condição está comprovadamente saudável (métrica presente e
    // resolver sem alerta). Só estas podem fechar um alerta aberto.
    const healthyKeys = new Map<string, AlertKey>();

    // ── 1) Engajamento (e polêmica "normal" que ele já emite) ───────────────
    if (snapshot) {
      const category = mapSegmentToCategory(
        onboarding?.setor_benchmark ?? null,
      );
      const tier = mapFollowersToTier(onboarding?.total_followers ?? null);

      const engagementDraft = await resolveEngagementScoreAlert(
        snapshot,
        category,
        tier,
        readerDb,
      );
      candidates.push(engagementDraft);

      // ── 2) Polêmica ─────────────────────────────────────────────────────
      const polemicDraft = await resolvePolemicAlert(
        {
          snapshotId: snapshot.snapshotId,
          polemicScorePct: snapshot.polemicScorePct,
        },
        category,
        tier,
        readerDb,
      );
      if (polemicDraft) {
        candidates.push(polemicDraft);
      } else if (snapshot.polemicScorePct != null) {
        // número presente + sem alerta = saudável → pode fechar o aberto.
        healthyKeys.set(keyOf(POLEMIC_ALERT_TYPE, POLEMIC_METRIC_NAME), {
          type: POLEMIC_ALERT_TYPE,
          metricName: POLEMIC_METRIC_NAME,
        });
      }
    }

    // ── 3) Staleness ────────────────────────────────────────────────────────
    // Independe de haver snapshot na janela: conta parada é justamente o caso
    // em que a janela da tela pode estar vazia.
    const freshnessDate =
      healthLastUpdated ?? latestSnapshot?.period_end ?? null;
    const stalenessDraft = await resolveStalenessAlert(
      freshnessDate,
      new Date(),
      latestSnapshot?.id ?? null,
    );
    if (stalenessDraft) {
      candidates.push(stalenessDraft);
    } else if (freshnessDate !== null) {
      healthyKeys.set(keyOf(STALENESS_ALERT_TYPE, STALENESS_METRIC_NAME), {
        type: STALENESS_ALERT_TYPE,
        metricName: STALENESS_METRIC_NAME,
      });
    }

    // ── Deduplicação por chave: fica o draft de maior severidade ───────────
    const byKey = new Map<string, AlertDraft>();
    for (const draft of candidates) {
      const k = keyOf(draft.type, draft.metricName);
      const current = byKey.get(k);
      if (
        !current ||
        SEVERITY_RANK[draft.severity] > SEVERITY_RANK[current.severity]
      ) {
        byKey.set(k, draft);
      }
    }

    const drafts: AlertDraft[] = [];
    const resolveKeys = new Map<string, AlertKey>(healthyKeys);

    for (const [k, draft] of byKey) {
      const persistable =
        PERSIST_INFO_ALERTS ||
        (draft.severity !== "info" && draft.severity !== "success");

      if (persistable) {
        drafts.push(draft);
        resolveKeys.delete(k); // há alerta vigente nesta chave
      } else {
        // draft informativo = condição deixou de valer → fecha o aberto.
        resolveKeys.set(k, {
          type: draft.type,
          metricName: draft.metricName ?? null,
        });
      }
    }

    let autoResolved = 0;
    for (const key of resolveKeys.values()) {
      autoResolved += await resolveOpenAlertForKey(
        client.id,
        key,
        AUTO_RESOLVED_BY,
      );
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
          ? "Nenhum alerta neste ciclo para a janela especificada."
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
