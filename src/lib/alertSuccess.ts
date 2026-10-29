/* ==========================================================================
   ORBIT · lib/alertSuccess.ts
   Critério de sucesso + mensagem do gestor, derivados do AlertDraft.

   Módulo PURO (sem supabase) — mesmo motivo de lib/stats/*: o engine importa
   lib/supabase, que lança em Node sem NEXT_PUBLIC_SUPABASE_*, então nada que
   viva dentro do engine é testável. Os números do engine (limiar, janelas)
   chegam por `SuccessRules`: ficam num lugar só, sem cópia.

   Regra: sem critério honesto => null. Nunca inventa meta nem janela.
   ========================================================================== */

import { formatPtBr } from "@/lib/format";
import { CONFIANCA } from "@/lib/ui-labels";
import type { AlertSuccessCriteria } from "@/types/orbit";
import type { AlertDraft } from "@/lib/repositories/contentContractEngine";

/** Números do engine de que o critério depende. Montado no engine, lido aqui. */
export interface SuccessRules {
  /** ALGO_RISK_AMBER_THRESHOLD (razão, ex.: 0.3). */
  algoRiskAmber: number;
  /** ALGO_RISK_N_RECENT (posts na janela recente R). */
  algoRiskRecentPosts: number;
  /** ALGO_RISK_BASELINE_MAX_POSTS (teto de posts do baseline B). */
  algoRiskBaselinePosts: number;
  /** STALENESS_WARNING_DAYS. */
  stalenessWarnDays: number;
  /** STALENESS_METRIC_NAME. */
  stalenessMetricName: string;
}

const ALGO_RISK_METRIC_NAME = "algo_risk_score";

export function deriveSuccessCriteria(
  draft: Pick<AlertDraft, "metricName" | "metricValue" | "severity">,
  rules: SuccessRules,
): AlertSuccessCriteria | null {
  const name = draft.metricName;
  const value = draft.metricValue;
  if (!name || value === undefined || !Number.isFinite(value)) return null;

  if (name === ALGO_RISK_METRIC_NAME) {
    // O alerta só existe com score >= limiar; abaixo disso não há "hoje" a melhorar.
    if (value < rules.algoRiskAmber) return null;
    return {
      metricName: name,
      label: "queda da mediana de engajamento",
      unit: "%",
      baseline: Math.round(value * 100),
      target: Math.round(rules.algoRiskAmber * 100),
      targetInclusive: false, // o alerta some com score < limiar
      direction: "lower_is_better",
      // O score só muda quando posts novos entram na janela recente; com
      // cadência baixa, "14 dias" não mede nada. Janela em posts: metade de R.
      window: {
        amount: Math.floor(rules.algoRiskRecentPosts / 2),
        unit: "posts",
      },
      measureHow: `Mediana de curtidas + comentários dos ${rules.algoRiskRecentPosts} posts mais recentes contra a dos até ${rules.algoRiskBaselinePosts} anteriores, na mesma conta. Só muda quando posts novos entram nessa janela.`,
    };
  }

  if (name === rules.stalenessMetricName) {
    return {
      metricName: name,
      label: "idade da última coleta",
      unit: "dias",
      baseline: value,
      target: rules.stalenessWarnDays,
      targetInclusive: true, // idade <= limite não gera alerta
      direction: "lower_is_better",
      // Janela = a da própria ação do engine: critical "hoje", warning "nesta semana".
      window: { amount: draft.severity === "critical" ? 1 : 7, unit: "dias" },
      measureHow: "Data da última coleta de dados desta conta.",
    };
  }

  // er_real_pct, vps_pct, engagement_public, polemic_score_pct e demais:
  // sem critério honesto hoje (ver patch, seção "O que ficou de fora").
  return null;
}

export function buildManagerMessage(
  draft: Pick<
    AlertDraft,
    "title" | "probableCause" | "immediateAction" | "confidenceLevel"
  >,
): string {
  const partes: string[] = [draft.title.replace(/\.$/, "") + "."];
  if (draft.probableCause && draft.probableCause !== "n/a") {
    partes.push(`Hipótese de causa: ${draft.probableCause}`);
  }
  partes.push(`Próximo passo: ${draft.immediateAction}`);
  partes.push(`Confiança da leitura: ${CONFIANCA[draft.confidenceLevel]}.`);
  return partes.join(" ");
}

const fmt = (v: number): string =>
  Number.isInteger(v) ? String(v) : formatPtBr(v, 1);

function windowText(w: AlertSuccessCriteria["window"]): string {
  if (w.unit === "dias") {
    return `dentro de ${w.amount} ${w.amount === 1 ? "dia" : "dias"}`;
  }
  return `depois de ${w.amount} ${w.amount === 1 ? "nova publicação" : "novas publicações"}`;
}

export function successCriteriaText(c: AlertSuccessCriteria): string {
  const un = c.unit === "%" ? "%" : c.unit === "dias" ? " dias" : "";
  const lower = c.direction === "lower_is_better";
  const bound = lower
    ? c.targetInclusive
      ? "até"
      : "abaixo de"
    : c.targetInclusive
      ? "a partir de"
      : "acima de";
  const hoje = c.baseline == null ? "" : `Hoje: ${fmt(c.baseline)}${un}. `;
  return `${hoje}Sucesso: ${c.label} ${bound} ${fmt(c.target)}${un}, ${windowText(c.window)}. Como medir: ${c.measureHow}`;
}
