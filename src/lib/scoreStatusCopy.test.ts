import { describe, expect, it } from "vitest";
import { buildScoreCopy, type ScoreReference } from "./scoreStatusCopy";

const base: ScoreReference = {
  value: null,
  semaphore: null,
  category: null,
  source: null,
  direction: null,
  greenMin: null,
  greenMax: null,
  redMin: null,
  redMax: null,
  p50: null,
};

// ER Real hoje: régua global de gestão interna (ref_thresholds id 96).
const erGestao: ScoreReference = {
  ...base,
  value: 0.101,
  semaphore: "vermelho",
  category: "global",
  source: "gestao_interna",
  direction: "higher_is_better",
  greenMin: 2,
  redMax: 0.5,
  metric: "er_real_pct",
};

// Polêmica hoje: célula v2 do setor, execução legacy não verificada.
const polemica: ScoreReference = {
  ...base,
  value: 4.5,
  semaphore: "ambar",
  category: "comercio_direto_ecommerce_social",
  source: "category",
  direction: "lower_is_better",
  greenMax: 2.57,
  redMin: 10,
  p50: 3.68,
  metric: "polemic_score_pct",
};

describe("proveniência da régua não muda o que já está na tela", () => {
  it("ER/VPS de gestão: mesma saída com e sem os campos de proveniência", () => {
    const sem = buildScoreCopy(erGestao);
    const com = buildScoreCopy({
      ...erGestao,
      datasetId: "internal_management_thresholds_v1",
      validationStatus: "nao_aplicavel",
    });
    expect(com).toEqual(sem);
    expect(com.action).toBeNull();
    expect(com.note).toContain("Referência provisória de gestão");
  });

  it("polêmica com execução legacy 'nao_verificado': saída idêntica à de hoje", () => {
    const sem = buildScoreCopy(polemica);
    const com = buildScoreCopy({
      ...polemica,
      datasetId: "benchmark_58_v2_real_schema",
      validationStatus: "nao_verificado",
    });
    expect(com).toEqual(sem);
    expect(com.action).not.toBeNull();
  });
});

describe("régua em validação", () => {
  it("rotula como método em validação e não gera Ação", () => {
    const pronto = buildScoreCopy(polemica);
    const emValidacao = buildScoreCopy({
      ...polemica,
      validationStatus: "em_validacao",
    });
    expect(pronto.action).not.toBeNull();
    expect(emValidacao.action).toBeNull();
    expect(emValidacao.note).toBe("Levantamento próprio, método em validação.");
    expect(emValidacao.text).toBe(pronto.text);
  });

  it("junta com a nota de gestão sem perder nenhuma das duas", () => {
    const c = buildScoreCopy({ ...erGestao, validationStatus: "em_validacao" });
    expect(c.note).toContain("Referência provisória de gestão");
    expect(c.note).toContain("método em validação");
  });
});

describe("valor 0 só vira 'sem comentários' para polêmica", () => {
  const verdeZero: ScoreReference = {
    ...polemica,
    value: 0,
    semaphore: "verde",
  };

  it("polêmica com mediana 0", () => {
    expect(buildScoreCopy(verdeZero).text).toContain(
      "A maioria dos posts do período não recebeu comentários",
    );
  });

  it("outra métrica lower_is_better com 0 usa o texto padrão", () => {
    const c = buildScoreCopy({ ...verdeZero, metric: "outra_metrica" });
    expect(c.text).toContain("Dentro do padrão");
    expect(c.text).not.toContain("comentários");
  });

  it("sem metric (chamador antigo) também usa o texto padrão", () => {
    const { metric: _metric, ...semMetric } = verdeZero;
    expect(buildScoreCopy(semMetric).text).toContain("Dentro do padrão");
  });
});

describe("quatro métricas novas: 'nao_verificado' vira método em validação; legacy não muda", () => {
  const nova: ScoreReference = {
    ...base,
    value: 20,
    semaphore: "ambar",
    category: "global",
    source: "benchmark_empirico",
    direction: "higher_is_better",
    greenMin: 64.59,
    redMax: 1.4,
    metric: "tom_dos_comentarios",
  };
  it.each([
    "resposta_da_base",
    "views_por_seguidor",
    "intencao_nos_comentarios",
    "tom_dos_comentarios",
  ])("%s: nota presente e sem Ação", (metric) => {
    const c = buildScoreCopy({
      ...nova,
      metric,
      validationStatus: "nao_verificado",
    });
    expect(c.note).toContain("método em validação");
    expect(c.action).toBeNull();
  });
  it("polêmica legacy 'nao_verificado' continua com Ação e sem nota", () => {
    const sem = buildScoreCopy(polemica);
    const com = buildScoreCopy({
      ...polemica,
      validationStatus: "nao_verificado",
    });
    expect(com).toEqual(sem);
    expect(com.action).not.toBeNull();
  });
  it("er_real_pct e vps_pct (nao_aplicavel) idem", () => {
    expect(
      buildScoreCopy({ ...erGestao, validationStatus: "nao_aplicavel" }),
    ).toEqual(buildScoreCopy(erGestao));
  });
});
