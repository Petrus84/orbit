import { describe, expect, it } from "vitest";
import { buildFormatInsights } from "./formatInsights";
import type { FormatPerformanceRow, PostSummary } from "@/types/orbit";

const post = (
  id: string,
  likes: number | null,
  comments: number | null,
  caption: string | null = null,
): PostSummary => ({
  id,
  publishedAt: "2026-09-10T12:00:00Z",
  likes,
  comments,
  caption,
  polemicScorePct: null,
  isBoostCandidate: false,
  playToViewRatio: null,
});

const row = (
  format: string,
  interactions: number | null,
  known: number,
  total: number,
  postsDetail: PostSummary[] = [],
): FormatPerformanceRow => ({
  id: format,
  format,
  posts: total,
  shares: 0,
  trendLabel: "",
  trendColor: "none",
  postsDetail,
  interactions,
  interactionsKnownPosts: known,
  interactionsTotalPosts: total,
});

describe("buildFormatInsights", () => {
  // Caso real da tela: Reels 106/5, Carrossel 72 (6 de 22), Estático 16/2.
  const real = [
    row("Reels", 106, 5, 5),
    row("Carrossel", 72, 6, 22),
    row("Estático", 16, 2, 2),
  ];

  it("compara por post e diz o que fazer, em vez de listar somas", () => {
    const [comp] = buildFormatInsights(real);
    expect(comp?.text).toContain("Reels rende mais por post");
    expect(comp?.text).toContain("21,2");
    expect(comp?.text).toContain("12,0");
    expect(comp?.action).toMatch(/dê mais espaço ao formato Reels/);
    expect(comp?.confidenceLevel).toBe("L2");
  });

  it("explica por que o Estático ficou fora da comparação", () => {
    const [comp] = buildFormatInsights(real);
    expect(comp?.basis).toContain("Estático (2 posts) fica fora");
  });

  it("avisa a cobertura baixa do Carrossel com ação", () => {
    const cob = buildFormatInsights(real).find((i) =>
      i.id.startsWith("insight-cobertura-"),
    );
    expect(cob?.text).toContain("só 6 de 22 posts");
    expect(cob?.action).toMatch(/Complete/);
  });

  it("formatos parecidos => não aponta vencedor", () => {
    const [comp] = buildFormatInsights([
      row("Reels", 100, 5, 5),
      row("Carrossel", 90, 5, 5),
    ]);
    expect(comp?.text).toContain("parecidos");
  });

  it("só um formato com dado suficiente => pede teste de outro formato", () => {
    const [comp] = buildFormatInsights([
      row("Reels", 100, 5, 5),
      row("Estático", 10, 1, 1),
    ]);
    expect(comp?.action).toMatch(/3 posts em outro formato/);
  });

  it("destaca o post com mais reação e sugere repetir o assunto", () => {
    const out = buildFormatInsights([
      row("Reels", 100, 3, 3, [
        post("a", 10, 1),
        post("b", 80, 20, "Promoção de inverno"),
        post("c", 5, 0),
      ]),
    ]);
    const melhor = out.find((i) => i.id === "insight-melhor-post");
    expect(melhor?.text).toContain("Promoção de inverno");
    expect(melhor?.action).toMatch(/Reaproveite esse assunto/);
  });

  it("sem dado nenhum => nenhuma leitura", () => {
    expect(buildFormatInsights([row("Reels", null, 0, 3)])).toEqual([]);
  });
});
