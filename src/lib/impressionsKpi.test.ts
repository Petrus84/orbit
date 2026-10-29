import { describe, expect, it } from "vitest";
import { aggregatePostImpressions } from "./impressionsKpi";

describe("aggregatePostImpressions", () => {
  it("soma impressões existentes, preserva zero e ignora valores ausentes", () => {
    expect(
      aggregatePostImpressions([
        { impressions: 120, confidence_level: "L0" },
        { impressions: 0, confidence_level: "L1" },
        { impressions: null, confidence_level: "L0" },
      ]),
    ).toEqual({ total: 120, sourceLevel: "L1" });
  });

  it("não transforma a ausência de valores em zero", () => {
    expect(
      aggregatePostImpressions([{ impressions: null, confidence_level: "L0" }]),
    ).toEqual({ total: null, sourceLevel: undefined });
    expect(aggregatePostImpressions([])).toEqual({
      total: null,
      sourceLevel: undefined,
    });
  });

  it("usa o menor nível de confiança entre os valores incluídos", () => {
    expect(
      aggregatePostImpressions([
        { impressions: 40, confidence_level: "L0" },
        { impressions: 20, confidence_level: "L2" },
        { impressions: null, confidence_level: "L1" },
      ]),
    ).toEqual({ total: 60, sourceLevel: "L2" });
  });
});
