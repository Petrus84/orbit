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

// `median` = mediana de interações por post (só posts com os 4 campos).
const row = (
  format: string,
  interactions: number | null,
  known: number,
  total: number,
  median: number | null,
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
  interactionsMedian: median,
  interactionsKnownPosts: known,
  interactionsTotalPosts: total,
});

describe("buildFormatInsights", () => {
  // Caso real da tela: Reels 106/5, Carrossel 72 (6 de 22), Estático 16/2.
  // Mediana por post: Reels 20, Carrossel 11 (a média daria 21,2 e 12,0).
  const real = [
    row("Reels", 106, 5, 5, 20),
    row("Carrossel", 72, 6, 22, 11),
    row("Estático", 16, 2, 2, 8),
  ];

  it("compara a MEDIANA por post e diz o que fazer, em vez de listar somas", () => {
    const [comp] = buildFormatInsights(real);
    expect(comp?.text).toContain("Reels rende mais por post");
    expect(comp?.text).toContain("mediana de 20,0");
    expect(comp?.text).toContain("11,0");
    expect(comp?.text).not.toContain("21,2"); // não é a média
    expect(comp?.action).toMatch(/dê mais espaço ao formato Reels/);
    expect(comp?.confidenceLevel).toBe("L2");
  });

  it("explica por que o Estático ficou fora da comparação (precisa de 5)", () => {
    const [comp] = buildFormatInsights(real);
    expect(comp?.basis).toContain("Estático (2 posts) fica fora");
    expect(comp?.basis).toContain("precisa de 5");
  });

  it("declara a faixa da amostra pelo menor grupo (5 a 7 = leve)", () => {
    const [comp] = buildFormatInsights(real);
    expect(comp?.basis).toContain("amostra leve");
  });

  it("os dois grupos com 8 ou mais posts => amostra robusta", () => {
    const [comp] = buildFormatInsights([
      row("Reels", 300, 8, 8, 30),
      row("Carrossel", 160, 9, 9, 15),
    ]);
    expect(comp?.basis).toContain("amostra robusta");
  });

  it("4 posts completos não bastam (mínimo 5): sem comparação", () => {
    expect(
      buildFormatInsights([
        row("Reels", 80, 4, 4, 20),
        row("Carrossel", 40, 4, 4, 10),
      ]),
    ).toEqual([]);
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
      row("Reels", 100, 5, 5, 20),
      row("Carrossel", 90, 5, 5, 18),
    ]);
    expect(comp?.text).toContain("parecidos");
  });

  it("só um formato com dado suficiente => pede teste de outro formato", () => {
    const [comp] = buildFormatInsights([
      row("Reels", 100, 5, 5, 20),
      row("Estático", 10, 1, 1, 10),
    ]);
    expect(comp?.action).toMatch(/5 posts em outro formato/);
    expect(comp?.basis).toContain("amostra leve");
  });

  it("segundo colocado com mediana 0 => sem 'N× mais' inventado", () => {
    const [comp] = buildFormatInsights([
      row("Reels", 100, 5, 5, 20),
      row("Carrossel", 3, 5, 5, 0),
    ]);
    expect(comp?.text).toContain("Reels rende mais por post");
    expect(comp?.text).not.toMatch(/Infinity|NaN|×/);
  });

  it("mediana ausente (null) fica fora: ausência não vira 0", () => {
    expect(buildFormatInsights([row("Reels", null, 0, 3, null)])).toEqual([]);
  });

  it("destaca o post com mais reação e sugere repetir o assunto", () => {
    const out = buildFormatInsights([
      row("Reels", 100, 3, 3, 30, [
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
    expect(buildFormatInsights([row("Reels", null, 0, 3, null)])).toEqual([]);
  });
});
