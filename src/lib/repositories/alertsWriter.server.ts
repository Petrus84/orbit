// ============================================================================
// src/lib/repositories/alertsWriter.server.ts   (NOVO — SERVER-ONLY) · v2
//
// Substitui createAlertsBatch() no caminho de sincronização.
// Premissa (confirmada no banco por outra sessão, a re-verificar no preflight F):
//   orbit.alerts tem UNIQUE alerts_dedup_state (client_id, alert_type, metric_name),
//   SEM is_resolved => no máximo UMA linha por chave, aberta ou resolvida.
//   É a mesma chave que orbit.check_churn_alert usa em ON CONFLICT ON CONSTRAINT.
// Comportamento (espelha a função SQL: atualiza e REABRE):
//   sem linha                         -> insert
//   linha aberta                      -> update no lugar
//   resolvida + mesmo snapshot_id     -> pula (usuário já tratou esse dado)
//   resolvida + snapshot_id novo      -> reabre
//   resolvida + draft sem snapshot_id -> pula (evita reabrir a cada sync)
// Nunca grava is_snoozed/snoozed_until em linha aberta.
// ============================================================================

import { supabaseAdmin } from "@/lib/repositories/supabaseAdmin";
import { isAlertType } from "@/lib/repositories/alertsRepository";
import type { AlertDraft } from "@/lib/repositories/contentContractEngine";

export type UpsertAction =
  | "inserted"
  | "updated"
  | "reopened"
  | "skipped_resolved"
  | "skipped_transient";

export interface UpsertAlertResult {
  type: string;
  metricName: string | null;
  action: UpsertAction;
  id?: string;
}

function toRow(clientId: string, d: AlertDraft) {
  return {
    client_id: clientId,
    alert_type: d.type,
    severity: d.severity,
    title: d.title,
    description: d.description ?? null,
    natureza: d.natureza ?? null,
    probable_cause: d.probableCause ?? null,
    confidence_level: d.confidenceLevel ?? null,
    data_source: d.dataSource ?? null,
    metric_name: d.metricName ?? null,
    metric_value: d.metricValue ?? null,
    threshold_value: d.thresholdValue ?? null,
    snapshot_id: d.snapshotId ?? null,
    suggested_action: d.immediateAction ?? null,
  };
}

function alerts() {
  return supabaseAdmin.schema("orbit").from("alerts");
}

type Existing = {
  id: string;
  is_resolved: boolean;
  snapshot_id: string | null;
};

async function findByKey(
  clientId: string,
  type: string,
  metric: string | null,
): Promise<Existing | null> {
  let q = alerts()
    .select("id, is_resolved, snapshot_id")
    .eq("client_id", clientId)
    .eq("alert_type", type);
  q = metric === null ? q.is("metric_name", null) : q.eq("metric_name", metric);
  // abertas primeiro (cobre dado legado com NULL em metric_name, que o UNIQUE não deduplica)
  const { data, error } = await q
    .order("is_resolved", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error)
    throw new Error(`[alertsWriter] busca por chave falhou: ${error.message}`);
  return (data?.[0] as Existing | undefined) ?? null;
}

export interface AlertKey {
  type: string;
  metricName: string | null;
}

/**
 * Resolve (is_resolved=true) o alerta ABERTO de uma chave cuja condição deixou
 * de valer — mesmo papel do ramo ELSE de orbit.check_churn_alert. Usado quando o
 * engine devolve um draft não persistível (info/success) para a mesma chave:
 * sem isso, um warning antigo ficaria aberto para sempre.
 * Só mexe em linha aberta; devolve quantas foram resolvidas.
 */
export async function resolveOpenAlertForKey(
  clientId: string,
  key: AlertKey,
  resolvedBy: string,
): Promise<number> {
  if (!isAlertType(key.type)) return 0;
  let q = alerts()
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq("client_id", clientId)
    .eq("alert_type", key.type)
    .eq("is_resolved", false);
  q =
    key.metricName === null
      ? q.is("metric_name", null)
      : q.eq("metric_name", key.metricName);
  const { data, error } = await q.select("id");
  if (error)
    throw new Error(
      `[alertsWriter] auto-resolve falhou (${key.type}/${key.metricName ?? "null"}): ${error.message}`,
    );
  return data?.length ?? 0;
}

export async function upsertAlertsBatch(
  clientId: string,
  drafts: AlertDraft[],
): Promise<UpsertAlertResult[]> {
  const out: UpsertAlertResult[] = [];

  for (const draft of drafts) {
    const metric = draft.metricName ?? null;
    const res = (action: UpsertAction, id?: string): void => {
      out.push(
        id
          ? { type: draft.type, metricName: metric, action, id }
          : { type: draft.type, metricName: metric, action },
      );
    };

    if (!isAlertType(draft.type)) {
      res("skipped_transient");
      continue;
    }

    const row = toRow(clientId, draft);
    let existing = await findByKey(clientId, draft.type, metric);

    if (!existing) {
      const { data, error } = await alerts().insert(row).select("id").single();
      if (!error && data) {
        res("inserted", data.id);
        continue;
      }
      if (error?.code !== "23505") {
        throw new Error(
          `[alertsWriter] insert falhou (${draft.type}/${metric ?? "null"}): ${error?.message}`,
        );
      }
      existing = await findByKey(clientId, draft.type, metric); // corrida com check_churn_alert/outro sync
      if (!existing)
        throw new Error(
          "[alertsWriter] 23505 sem linha correspondente — verificar constraints de orbit.alerts",
        );
    }

    const { client_id: _c, alert_type: _t, ...mutable } = row;
    void _c;
    void _t;

    if (existing.is_resolved) {
      const sameSnapshot =
        !draft.snapshotId || existing.snapshot_id === draft.snapshotId;
      if (sameSnapshot) {
        res("skipped_resolved", existing.id);
        continue;
      }
      // created_at = now() espelha check_churn_alert: "início da ocorrência atual"
      // só muda ao REABRIR de resolvido. Sem isso o alerta reaberto ficava com a
      // data/posição antigas na Central.
      const { error } = await alerts()
        .update({
          ...mutable,
          is_resolved: false,
          resolved_at: null,
          resolved_by: null,
          is_snoozed: false,
          snoozed_until: null,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error)
        throw new Error(
          `[alertsWriter] reabertura falhou (${existing.id}): ${error.message}`,
        );
      res("reopened", existing.id);
      continue;
    }

    const { error } = await alerts().update(mutable).eq("id", existing.id);
    if (error)
      throw new Error(
        `[alertsWriter] update falhou (${existing.id}): ${error.message}`,
      );
    res("updated", existing.id);
  }

  return out;
}
