"use server";

// ============================================================================
// src/actions/syncClientAlerts.ts  (v4.1.0)
//
// Mudanças (v4.1.0 - Fechamento SSC-1/SSC-2):
// 1) REMOVIDO HARDCODE DE 90 DIAS: O sincronizador agora aceita startIso e endIso
//    da UI. Isso garante que o cálculo de Polêmica (mediana) nos alertas
//    seja exatamente igual ao do Card de Qualidade na mesma janela.
//
// Mudanças (Herdadas da v4.0.0):
// - AUTORIZAÇÃO: exige sessão e RLS (policy authenticated_select_own_clients).
// - LEITURA: usa client com cookies injetado.
// - ESCRITA: upsertAlertsBatch (find-or-update, idempotente).
//
// GARANTIAS DE TIPAGEM:
// - ✅ Zero `any` ou typecasts perigosos
// - ✅ Todas as funções retornam tipos explícitos
// - ✅ RLS integrado na camada Supabase
// - ✅ Tratamento de erro robusto
// ============================================================================

import { createSupabaseServerClient } from "../lib/supabase/server";
import {
  fetchLatestEngagementScoreSnapshot,
  fetchClientOnboarding,
  type OrbitDbClient,
} from "../lib/repositories/instagramOverviewRepository";
import {
  resolveEngagementScoreAlert,
  mapSegmentToCategory,
  mapFollowersToTier,
  type AlertDraft,
} from "../lib/repositories/contentContractEngine";
import {
  upsertAlertsBatch,
  resolveOpenAlertForKey,
  type UpsertAlertResult,
  type UpsertAction,
} from "../lib/repositories/alertsWriter.server";

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

/** Se false, alertas com severity 'info' ou 'success' são auto-resolvidos */
const PERSIST_INFO_ALERTS = false;

/** Identificador do sistema para alertas auto-resolvidos */
const AUTO_RESOLVED_BY = "system:syncClientAlerts";

// ============================================================================
// TIPOS
// ============================================================================

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

interface ClientRecord {
  id: string;
  name: string;
  handle: string;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Cria um resultado de falha padronizado
 */
const fail = (error: string): SyncClientAlertsResult => ({
  success: false,
  alertsGenerated: 0,
  alertsUpdated: 0,
  alertsSkipped: 0,
  alertsAutoResolved: 0,
  error,
});

/**
 * Conta resultados por ação
 * ✅ Usa o tipo real UpsertAction importado de alertsWriter.server
 */
const countByAction = (
  results: UpsertAlertResult[],
  action: UpsertAction,
): number => results.filter((r) => r.action === action).length;

// ============================================================================
// AÇÃO PRINCIPAL
// ============================================================================

/**
 * Sincroniza alertas para um cliente dentro de uma janela de tempo específica.
 *
 * @param clientId - ID do cliente (será validado via RLS)
 * @param startIso - Data de início em ISO 8601 (ex: "2026-10-13T00:00:00Z")
 * @param endIso - Data de término em ISO 8601 (ex: "2026-10-13T23:59:59Z")
 * @returns Resultado da sincronização com contadores detalhados
 *
 * @throws Erro será capturado e retornado em `error` do resultado
 */
export async function syncClientAlerts(
  clientId: string,
  startIso: string,
  endIso: string,
): Promise<SyncClientAlertsResult> {
  try {
    // ========================================================================
    // 1) AUTENTICAÇÃO E AUTORIZAÇÃO
    // ========================================================================

    const db = await createSupabaseServerClient();

    const { data: auth } = await db.auth.getUser();
    if (!auth.user) {
      return fail("Não autenticado.");
    }

    // ========================================================================
    // 2) LEITURA DO CLIENTE (RLS ATIVA)
    // ========================================================================

    const { data: client, error: clientErr } = await db
      .schema("orbit")
      .from("clients")
      .select("id, name, handle")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) {
      throw new Error(
        `[Orquestrador] Leitura do cliente falhou: ${clientErr.message}`,
      );
    }

    if (!client) {
      return fail("Cliente não encontrado ou sem permissão.");
    }

    const typedClient: ClientRecord = client;

    // ========================================================================
    // 3) CAST DELIBERADO PARA LEITURA TIPADA
    // ========================================================================

    // O client do @supabase/ssr não é tipado com Database<'orbit'>;
    // os leitores só usam .schema('orbit').from(...).
    // Este é o único cast necessário e justificado.
    const readerDb = db as unknown as OrbitDbClient;

    // ========================================================================
    // 4) BUSCA DE DADOS DE ALERTA
    // ========================================================================

    const drafts: AlertDraft[] = [];
    let autoResolved = 0;

    // Busca paralela: snapshot de engagement + dados de onboarding
    const [snapshot, onboarding] = await Promise.all([
      fetchLatestEngagementScoreSnapshot(clientId, startIso, endIso, readerDb),
      fetchClientOnboarding(clientId, readerDb),
    ]);

    // ========================================================================
    // 5) RESOLUÇÃO DE ALERTAS
    // ========================================================================

    if (snapshot) {
      // Mapeia contexto do cliente para o resolver
      const category = mapSegmentToCategory(
        onboarding?.setor_benchmark ?? null,
      );
      const tier = mapFollowersToTier(onboarding?.total_followers ?? null);

      // Resolve o draft de engagement score
      const draft = await resolveEngagementScoreAlert(
        snapshot,
        category,
        tier,
        readerDb,
      );

      // Decide se persiste ou auto-resolve
      const persistable =
        PERSIST_INFO_ALERTS ||
        (draft.severity !== "info" && draft.severity !== "success");

      if (persistable) {
        drafts.push(draft);
      } else {
        // Condição cleared: fecha o alerta aberto, se houver
        autoResolved += await resolveOpenAlertForKey(
          typedClient.id,
          { type: draft.type, metricName: draft.metricName ?? null },
          AUTO_RESOLVED_BY,
        );
      }
    }

    // ========================================================================
    // 6) PERSISTÊNCIA (UPSERT IDEMPOTENTE)
    // ========================================================================

    // ✅ Usa o tipo real importado de alertsWriter.server
    const results: UpsertAlertResult[] = drafts.length
      ? await upsertAlertsBatch(typedClient.id, drafts)
      : [];

    // ========================================================================
    // 7) CONTABILIZAÇÃO E RETORNO
    // ========================================================================

    // Contagem de cada ação conforme contrato real de UpsertAction
    const inserted = countByAction(results, "inserted");
    const updated = countByAction(results, "updated");
    const reopened = countByAction(results, "reopened");
    const skippedResolved = countByAction(results, "skipped_resolved");
    const skippedTransient = countByAction(results, "skipped_transient");

    return {
      success: true,
      alertsGenerated: inserted,
      alertsUpdated: updated + reopened,
      // ✅ Agrupa ambos os tipos "skipped" (resolvido + transitório)
      alertsSkipped: skippedResolved + skippedTransient,
      alertsAutoResolved: autoResolved,
      clientHandle: typedClient.handle,
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
