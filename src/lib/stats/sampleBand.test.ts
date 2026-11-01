import { describe, expect, it } from "vitest";
import { sampleBand } from "./sampleBand";

describe("sampleBand (R8)", () => {
  it("n < 3 é insuficiente", () => {
    expect(sampleBand(0)).toBe("insuficiente");
    expect(sampleBand(2)).toBe("insuficiente");
  });
  it("3 a 7 é leve (limites incluídos)", () => {
    expect(sampleBand(3)).toBe("leve");
    expect(sampleBand(7)).toBe("leve");
  });
  it("n >= 8 é robusta", () => {
    expect(sampleBand(8)).toBe("robusta");
    expect(sampleBand(120)).toBe("robusta");
  });
  it("entrada inválida nunca promove a amostra", () => {
    expect(sampleBand(Number.NaN)).toBe("insuficiente");
    expect(sampleBand(-5)).toBe("insuficiente");
    expect(sampleBand(Number.POSITIVE_INFINITY)).toBe("insuficiente");
    expect(sampleBand(3.5)).toBe("insuficiente");
    expect(sampleBand(8.2)).toBe("insuficiente");
  });
});
