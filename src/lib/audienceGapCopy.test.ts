import { describe, expect, it } from "vitest";
import { buildGapReading } from "./audienceGapCopy";

describe("buildGapReading", () => {
  it("público acima do definido => positivo, sem a palavra meta", () => {
    const r = buildGapReading(96, 90);
    expect(r.status).toBe("positive");
    expect(r.headline).toContain("6,0 pontos acima");
    expect(`${r.headline} ${r.hint}`).not.toMatch(/meta|gap|restante/i);
  });

  it("igual ao definido => positivo, sem número", () => {
    expect(buildGapReading(90, 90).headline).toBe(
      "Seu público já é como você definiu.",
    );
  });

  it("perto (94 contra 100) => 'quase lá' com pontos faltando", () => {
    const r = buildGapReading(94, 100);
    expect(r.status).toBe("positive");
    expect(r.headline).toContain("faltam 6,0 pontos");
  });

  it("longe => atenção, e manda checar quem compra antes de mudar conteúdo", () => {
    const r = buildGapReading(60, 100);
    expect(r.status).toBe("attention");
    expect(r.hint).toMatch(/quem compra/);
  });
});
