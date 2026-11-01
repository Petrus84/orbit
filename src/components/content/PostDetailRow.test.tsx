// Teste de RENDERIZAÇÃO: linha expandida do Reel mostra o tempo assistido.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostDetailRow } from "./FormatPerformanceTable";
import type { PostSummary } from "@/types/orbit";

const base: PostSummary = {
  id: "p1",
  publishedAt: "2026-10-14T12:00:00Z",
  likes: 10,
  comments: 2,
  caption: "legenda",
  polemicScorePct: 20,
  isBoostCandidate: false,
  playToViewRatio: null,
};
const html = (p: PostSummary): string =>
  renderToStaticMarkup(<PostDetailRow post={p} />);

describe("PostDetailRow — tempo assistido", () => {
  it("Reel com tempo médio e duração: mostra tempo, duração, retenção e selos", () => {
    const out = html({
      ...base,
      avgWatchSec: 4,
      durationSec: 16,
      retentionPct: 25,
    });
    expect(out).toContain("Tempo assistido: 4 s de 16 s");
    expect(out).toContain("Medido");
    expect(out).toContain("retenção 25%");
    expect(out).toContain("Estimado");
  });
  it("sem duração: só o tempo médio, sem retenção", () => {
    const out = html({
      ...base,
      avgWatchSec: 4,
      durationSec: null,
      retentionPct: null,
    });
    expect(out).toContain("Tempo assistido: 4 s");
    expect(out).not.toContain("retenção");
  });
  it("0 s é medição real e aparece", () => {
    expect(html({ ...base, avgWatchSec: 0 })).toContain("Tempo assistido: 0 s");
  });
  it("sem dado (null/ausente): não mostra a linha, nunca 0 s", () => {
    expect(html({ ...base, avgWatchSec: null })).not.toContain(
      "Tempo assistido",
    );
    expect(html(base)).not.toContain("Tempo assistido");
  });
});
