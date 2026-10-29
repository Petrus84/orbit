import { describe, expect, it } from "vitest";
import {
  RESOLVED_ALERTS_LIMIT,
  daysOpen,
  describeResolution,
  resolvedBadgeLabel,
  resolvedLimitNote,
} from "./alertResolvedCopy";

// 15h UTC: mesmo dia civil em qualquer fuso de UTC-12 a UTC+8.
const created = "2026-10-08T15:00:00.000Z";
const resolved = "2026-10-20T15:00:00.000Z";

describe("describeResolution", () => {
  it("fechamento manual: só diz quando e por quanto tempo, sem afirmar causa", () => {
    const t = describeResolution({
      type: "engagement_collapse",
      createdAt: created,
      resolvedAt: resolved,
    });
    expect(t).toBe("Resolvido em 20/10/2026. Ficou aberto por 12 dias.");
    expect(t).not.toMatch(/normal|voltou|automaticamente/i);
  });

  it("automático genérico: NÃO afirma que a métrica voltou ao normal", () => {
    const t = describeResolution({
      type: "polemic_score_high",
      createdAt: created,
      resolvedAt: resolved,
      resolvedBy: "system:syncClientAlerts",
    });
    expect(t).toContain("Fechado automaticamente na sincronização");
    expect(t).toContain("deixou de ser detectada");
    expect(t).not.toMatch(/normal|voltou/i);
  });

  it("data_outdated automático: único caso em que a recuperação é provada", () => {
    const t = describeResolution({
      type: "data_outdated",
      createdAt: created,
      resolvedAt: resolved,
      resolvedBy: "system:syncClientAlerts",
    });
    expect(t).toContain("os dados da conta foram atualizados");
  });

  it("menos de 1 dia aberto: não escreve 'aberto por 0 dias'", () => {
    const t = describeResolution({
      type: "x",
      createdAt: resolved,
      resolvedAt: "2026-10-20T18:00:00.000Z",
    });
    expect(t).toBe("Resolvido em 20/10/2026.");
  });

  it("1 dia no singular", () => {
    const t = describeResolution({
      type: "x",
      createdAt: "2026-10-19T15:00:00.000Z",
      resolvedAt: resolved,
    });
    expect(t).toContain("Ficou aberto por 1 dia.");
  });

  it("sem resolvedAt ou data inválida => null", () => {
    expect(describeResolution({ type: "x", createdAt: created })).toBeNull();
    expect(
      describeResolution({ type: "x", createdAt: created, resolvedAt: "lixo" }),
    ).toBeNull();
  });
});

describe("daysOpen", () => {
  it("fechamento antes da criação (dado inconsistente) => null, nunca negativo", () => {
    expect(daysOpen(resolved, created)).toBeNull();
  });
});

describe("rótulos", () => {
  it("badge mantém a severidade como histórico", () => {
    expect(resolvedBadgeLabel("Crítico")).toBe("Resolvido · era crítico");
    expect(resolvedBadgeLabel("Atenção")).toBe("Resolvido · era atenção");
  });
  it("nota de limite só aparece quando a lista bateu o teto", () => {
    expect(resolvedLimitNote(RESOLVED_ALERTS_LIMIT - 1)).toBeNull();
    expect(resolvedLimitNote(RESOLVED_ALERTS_LIMIT)).toContain("50");
  });
});
