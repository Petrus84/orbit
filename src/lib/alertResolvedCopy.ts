/* ==========================================================================
   ORBIT · lib/alertResolvedCopy.ts
   Texto do histórico de alertas resolvidos (aba "Resolvidos" da Central).
   Módulo PURO: sem supabase, sem React — testável e importável pela tela e
   pelo repositório sem ciclo.

   Regra de voz (a mesma do engine): o texto só afirma o que o dado prova.
   - resolved_by "system:*" = o sync fechou o alerta. O sync fecha também
     quando o resolver devolve um card informativo (sem régua, comparação
     curta). Logo "a métrica voltou ao normal" seria afirmar recuperação que
     o banco não registra. Única exceção provada: data_outdated, que só fecha
     quando a coleta está dentro do prazo.
   - fechamento manual não grava resolved_by: diz quando, não "por quê".
   ========================================================================== */

import type { Alert } from "@/types/alert";

/** Teto da consulta de resolvidos (fetchResolvedAlerts). Fonte única. */
export const RESOLVED_ALERTS_LIMIT = 50;

const DAY_MS = 86_400_000;

type ResolutionInput = Pick<
  Alert,
  "type" | "createdAt" | "resolvedAt" | "resolvedBy"
>;

/**
 * Dias entre o início da ocorrência e o fechamento. created_at é o início da
 * ocorrência atual (o writer zera created_at ao reabrir), então a conta não
 * soma ciclos anteriores. Negativo ou inválido => null.
 */
export function daysOpen(createdAt: string, resolvedAt: string): number | null {
  const start = new Date(createdAt).getTime();
  const end = new Date(resolvedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.floor((end - start) / DAY_MS);
}

export function describeResolution(alert: ResolutionInput): string | null {
  if (!alert.resolvedAt) return null;
  const when = new Date(alert.resolvedAt);
  if (!Number.isFinite(when.getTime())) return null;

  const parts: string[] = [`Resolvido em ${when.toLocaleDateString("pt-BR")}.`];

  if (alert.resolvedBy?.startsWith("system:")) {
    parts.push(
      alert.type === "data_outdated"
        ? "Fechado automaticamente: os dados da conta foram atualizados."
        : "Fechado automaticamente na sincronização: a condição deste alerta deixou de ser detectada.",
    );
  }

  const open = daysOpen(alert.createdAt, alert.resolvedAt);
  if (open !== null && open >= 1) {
    parts.push(`Ficou aberto por ${open} ${open === 1 ? "dia" : "dias"}.`);
  }

  return parts.join(" ");
}

/** "Crítico" -> "Resolvido · era crítico". Mantém a severidade como histórico. */
export function resolvedBadgeLabel(severityLabel: string): string {
  return `Resolvido · era ${severityLabel.toLocaleLowerCase("pt-BR")}`;
}

export const RESOLVED_EMPTY_COPY =
  "Nenhum alerta resolvido ainda. Quando um alerta for fechado, o registro aparece aqui.";

export function resolvedLimitNote(shown: number): string | null {
  return shown >= RESOLVED_ALERTS_LIMIT
    ? `Mostrando os ${RESOLVED_ALERTS_LIMIT} resolvidos mais recentes.`
    : null;
}
