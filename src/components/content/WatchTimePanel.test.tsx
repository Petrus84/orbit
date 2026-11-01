// Teste de RENDERIZAÇÃO (V9): monta o componente e confere o que a tela mostra.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WatchTimePanel } from "./WatchTimePanel";
import type { WatchTimeSummary } from "@/types/orbit";

const full: WatchTimeSummary = {
  knownReels: 18,
  avgWatchMedianSec: 4,
  band: "robusta",
  retentionKnownReels: 18,
  retentionMedianPct: 20.87,
  retentionBand: "robusta",
  inconsistentReels: 0,
};

const html = (w: WatchTimeSummary | null | undefined): string =>
  renderToStaticMarkup(<WatchTimePanel watchTime={w} />);

describe("WatchTimePanel", () => {
  it("sem dado => não renderiza nada (sem dado, sem tela)", () => {
    expect(html(null)).toBe("");
    expect(html(undefined)).toBe("");
  });

  it("mostra tempo médio e retenção com os selos certos", () => {
    const out = html(full);
    expect(out).toContain("TEMPO ASSISTIDO POR REEL");
    expect(out).toContain("4 s");
    expect(out).toContain("21%");
    expect(out).toContain("Medido");
    expect(out).toContain("Estimado");
    expect(out).toContain("18 Reels");
    expect(out).toContain("amostra robusta");
  });

  it("declara a ausência de referência de setor e a proveniência", () => {
    const out = html(full);
    expect(out).toContain("Sem referência de setor ou porte");
    expect(out).toContain(
      "Fonte: tempo médio de reprodução informado pela Meta",
    );
    expect(out).toContain("não é métrica da Meta");
  });

  it("retenção ausente (menos de 3 Reels com duração) não vira 0%", () => {
    const out = html({
      ...full,
      retentionKnownReels: 1,
      retentionMedianPct: null,
      retentionBand: "insuficiente",
    });
    expect(out).toContain("4 s");
    expect(out).not.toContain("Retenção");
    expect(out).not.toContain("0%");
  });

  it("avisa quando Reels inconsistentes ficam fora da retenção", () => {
    const out = html({ ...full, inconsistentReels: 2 });
    expect(out).toContain("2 Reels com tempo médio acima da duração");
  });
});
