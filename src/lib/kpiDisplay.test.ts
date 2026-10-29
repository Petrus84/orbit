import { describe, expect, it } from "vitest";
import { provenanceLine } from "./provenanceText";
import {
  isKpiValueMissing,
  kpiDisplayFor,
  kpiHasComparison,
} from "./kpiDisplay";

const period = { start: "2026-07-08", end: "2026-10-05" };

describe("kpiDisplayFor", () => {
  it.each([
    "seguidores-totais",
    "saldo-90-dias",
    "alcance-90d",
    "cliques-no-link",
  ])("%s declara fonte, período e método (RN-23)", (key) => {
    const d = kpiDisplayFor(key, period);
    expect(d).not.toBeNull();
    expect(d!.provenance.source.length).toBeGreaterThan(0);
    expect(d!.provenance.method.length).toBeGreaterThan(0);
    expect(d!.provenance.period).toBe("snapshot");
  });

  it("distingue as duas fontes de impressões e seus períodos", () => {
    const account = kpiDisplayFor("impressions-account", period)!;
    const posts = kpiDisplayFor("impressions-posts", period)!;

    expect(account.label).toBe("IMPRESSÕES DA CONTA");
    expect(account.provenance.period).toBe("snapshot");
    expect(account.provenance.periodLabel).toBe("08/07/2026 a 05/10/2026");
    expect(account.provenance.method).toContain("snapshots não são somados");
    expect(posts.label).toBe("IMPRESSÕES DOS POSTS");
    expect(posts.provenance.period).toBe("header_window");
    expect(posts.provenance.method).toContain("período escolhido");
  });

  it("alcance-90d: o card se chama 'Alcance' e mostra as datas da coleta", () => {
    const d = kpiDisplayFor("alcance-90d", period)!;
    expect(d.label).toBe("ALCANCE 90D");
    expect(provenanceLine(d.provenance)).toBe(
      "Fonte: última coleta de dados da conta (arquivo exportado) · Período: 08/07/2026 a 05/10/2026 · Método: Pessoas únicas alcançadas pela conta na janela do arquivo exportado (cerca de 90 dias). É o total da conta informado pela coleta, não a soma dos posts nem dos stories.",
    );
  });

  it("período ausente ou inválido não inventa data", () => {
    expect(
      kpiDisplayFor("alcance-90d")!.provenance.periodLabel,
    ).toBeUndefined();
    expect(
      kpiDisplayFor("alcance-90d", { start: "x", end: null })!.provenance
        .periodLabel,
    ).toBeUndefined();
  });

  it("rótulos que já existiam não mudam", () => {
    expect(kpiDisplayFor("seguidores-totais")!.label).toBe("SEGUIDORES TOTAIS");
    expect(kpiDisplayFor("cliques-no-link")!.label).toBe("CLIQUES NO LINK");
    expect(kpiDisplayFor("saldo-90-dias")!.label).toBe(
      "SALDO DE SEGUIDORES (ENTRE MEDIÇÕES)",
    );
  });

  it("chave desconhecida => null (cai no rótulo derivado da chave)", () => {
    expect(kpiDisplayFor("outra-coisa")).toBeNull();
  });
});

describe("isKpiValueMissing", () => {
  it("nulo e não finito são ausentes em qualquer KPI", () => {
    for (const k of [
      "seguidores-totais",
      "alcance-90d",
      "cliques-no-link",
      "saldo-90-dias",
    ]) {
      expect(isKpiValueMissing(k, null)).toBe(true);
      expect(isKpiValueMissing(k, undefined)).toBe(true);
      expect(isKpiValueMissing(k, "abc")).toBe(true);
    }
  });
  it("alcance 0 = falta do dado (mesma regra do aviso snapshot_sem_alcance)", () => {
    expect(isKpiValueMissing("alcance-90d", 0)).toBe(true);
    expect(isKpiValueMissing("alcance-90d", "0")).toBe(true);
    expect(isKpiValueMissing("alcance-90d", 1470)).toBe(false);
  });
  it("cliques 0 e saldo 0 são valores reais", () => {
    expect(isKpiValueMissing("cliques-no-link", 0)).toBe(false);
    expect(isKpiValueMissing("saldo-90-dias", 0)).toBe(false);
  });
  it("impressões 0 é um valor real e impressões nulas são ausentes", () => {
    for (const key of ["impressions-account", "impressions-posts"]) {
      expect(isKpiValueMissing(key, 0)).toBe(false);
      expect(isKpiValueMissing(key, null)).toBe(true);
    }
  });
});

describe("kpiHasComparison", () => {
  it("delta nulo => sem comparação", () => {
    expect(kpiHasComparison("alcance-90d", 1470, null, false)).toBe(false);
  });
  it("saldo 0 com delta 0 (0÷0) => sem comparação", () => {
    expect(kpiHasComparison("saldo-90-dias", 0, 0, false)).toBe(false);
    expect(kpiHasComparison("saldo-90-dias", 0, "0", false)).toBe(false);
  });
  it("saldo com valor e variação reais mantém a comparação", () => {
    expect(kpiHasComparison("saldo-90-dias", 12, 8.5, false)).toBe(true);
  });
  it("variação 0 de um KPI com base real continua sendo comparação", () => {
    expect(kpiHasComparison("alcance-90d", 1470, 0, false)).toBe(true);
  });
  it("valor ausente => sem comparação", () => {
    expect(kpiHasComparison("alcance-90d", 0, 3, true)).toBe(false);
  });
});
