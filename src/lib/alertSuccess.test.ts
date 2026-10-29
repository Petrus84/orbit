import { describe, expect, it } from "vitest";
import {
  buildManagerMessage,
  deriveSuccessCriteria,
  successCriteriaText,
  type SuccessRules,
} from "./alertSuccess";

const rules: SuccessRules = {
  algoRiskAmber: 0.3,
  algoRiskRecentPosts: 12,
  algoRiskBaselinePosts: 30,
  stalenessWarnDays: 14,
  stalenessMetricName: "snapshot_age_days",
};

describe("deriveSuccessCriteria", () => {
  it("algo_risk: baseline em %, meta = limiar do engine, janela em posts", () => {
    const c = deriveSuccessCriteria(
      { metricName: "algo_risk_score", metricValue: 0.43, severity: "warning" },
      rules,
    );
    expect(c).toMatchObject({
      baseline: 43,
      target: 30,
      targetInclusive: false,
      direction: "lower_is_better",
      window: { amount: 6, unit: "posts" },
    });
  });

  it("algo_risk abaixo do limiar => null (não há alerta a melhorar)", () => {
    expect(
      deriveSuccessCriteria(
        {
          metricName: "algo_risk_score",
          metricValue: 0.29,
          severity: "warning",
        },
        rules,
      ),
    ).toBeNull();
  });

  it("staleness: meta 14 dias inclusiva; janela depende da severidade", () => {
    const w = deriveSuccessCriteria(
      { metricName: "snapshot_age_days", metricValue: 20, severity: "warning" },
      rules,
    );
    const k = deriveSuccessCriteria(
      {
        metricName: "snapshot_age_days",
        metricValue: 40,
        severity: "critical",
      },
      rules,
    );
    expect(w).toMatchObject({
      baseline: 20,
      target: 14,
      targetInclusive: true,
      window: { amount: 7, unit: "dias" },
    });
    expect(k).toMatchObject({ window: { amount: 1, unit: "dias" } });
  });

  it.each(["er_real_pct", "vps_pct", "engagement_public", "polemic_score_pct"])(
    "%s => null (sem meta nem janela honestas)",
    (metricName) => {
      expect(
        deriveSuccessCriteria(
          { metricName, metricValue: 111, severity: "warning" },
          rules,
        ),
      ).toBeNull();
    },
  );

  it("sem métrica, sem valor ou valor não finito => null", () => {
    expect(deriveSuccessCriteria({ severity: "warning" }, rules)).toBeNull();
    expect(
      deriveSuccessCriteria(
        {
          metricName: "algo_risk_score",
          metricValue: Number.NaN,
          severity: "warning",
        },
        rules,
      ),
    ).toBeNull();
  });
});

describe("successCriteriaText", () => {
  it("algo_risk", () => {
    const c = deriveSuccessCriteria(
      { metricName: "algo_risk_score", metricValue: 0.43, severity: "warning" },
      rules,
    );
    expect(c && successCriteriaText(c)).toBe(
      "Hoje: 43%. Sucesso: queda da mediana de engajamento abaixo de 30%, depois de 6 novas publicações. Como medir: Mediana de curtidas + comentários dos 12 posts mais recentes contra a dos até 30 anteriores, na mesma conta. Só muda quando posts novos entram nessa janela.",
    );
  });

  it("staleness usa 'até' (14 dias ainda não gera alerta) e singular em 1 dia", () => {
    const c = deriveSuccessCriteria(
      {
        metricName: "snapshot_age_days",
        metricValue: 40,
        severity: "critical",
      },
      rules,
    );
    expect(c && successCriteriaText(c)).toBe(
      "Hoje: 40 dias. Sucesso: idade da última coleta até 14 dias, dentro de 1 dia. Como medir: Data da última coleta de dados desta conta.",
    );
  });
});

describe("buildManagerMessage", () => {
  const base = {
    title: "Queda de engajamento.",
    probableCause: "Mudança de formato.",
    immediateAction: "Revise os últimos 12 posts.",
    confidenceLevel: "L1" as const,
  };
  it("monta título, causa, ação e confiança; não duplica o ponto final", () => {
    expect(buildManagerMessage(base)).toBe(
      "Queda de engajamento. Hipótese de causa: Mudança de formato. Próximo passo: Revise os últimos 12 posts. Confiança da leitura: Estimado.",
    );
  });
  it("causa 'n/a' ou vazia não entra", () => {
    expect(
      buildManagerMessage({ ...base, probableCause: "n/a" }),
    ).not.toContain("Hipótese de causa");
    expect(buildManagerMessage({ ...base, probableCause: "" })).not.toContain(
      "Hipótese de causa",
    );
  });
});
