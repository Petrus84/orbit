import test from "node:test";
import assert from "node:assert/strict";
import { computeFormatTrend, trendCopy, type TrendPost } from "./formatTrend";

const post = (
  day: number,
  likes: number | null,
  comments: number | null,
): TrendPost => ({
  publishedAt: `2026-03-${String(day).padStart(2, "0")}T12:00:00Z`,
  likes,
  comments,
});

test("menos de 5 posts: amostra insuficiente (RN-15)", () => {
  const t = computeFormatTrend([
    post(1, 5, 1),
    post(2, 5, 1),
    post(3, 5, 1),
    post(4, 5, 1),
  ]);
  assert.deepEqual(t, { status: "insufficient_sample", posts: 4 });
  assert.equal(trendCopy(t).label, "Tendência com 5 posts; hoje são 4");
});

test("5 posts mas só 2 por metade: nomeia a falta, não inventa seta", () => {
  const t = computeFormatTrend([
    post(1, 9, 1),
    post(2, 9, 1),
    post(3, 9, 1),
    post(4, 20, 1),
    post(5, 20, 1),
  ]);
  assert.equal(t.status, "no_data");
});

test("subindo: mediana recente > antiga em mais de 15%", () => {
  const t = computeFormatTrend([
    post(1, 8, 2),
    post(2, 9, 1),
    post(3, 10, 0),
    post(4, 14, 1),
    post(5, 16, 4),
    post(6, 18, 2),
  ]);
  assert.equal(t.status, "ok");
  if (t.status === "ok") {
    assert.equal(t.direction, "subindo");
    assert.equal(t.olderMedian, 10);
    assert.equal(t.newerMedian, 20);
  }
  assert.deepEqual(trendCopy(t), { label: "Subindo (+100%)", color: "cyan" });
});

test("caindo; a ordem das linhas não importa (ordena por data)", () => {
  const rows = [
    post(5, 1, 0),
    post(1, 10, 2),
    post(4, 2, 0),
    post(2, 9, 1),
    post(6, 1, 0),
    post(3, 8, 0),
  ];
  const t = computeFormatTrend(rows);
  assert.equal(t.status === "ok" && t.direction, "caindo");
  assert.deepEqual(trendCopy(t), { label: "Caindo (−90%)", color: "red" });
});

test("exatamente 15% não muda a seta (passa de 15% = estrito)", () => {
  const t = computeFormatTrend([
    post(1, 20, 0),
    post(2, 20, 0),
    post(3, 20, 0),
    post(4, 23, 0),
    post(5, 23, 0),
    post(6, 23, 0),
  ]);
  assert.equal(t.status === "ok" && t.direction, "estavel");
});

test("um post viral não decide a seta (mediana de 3)", () => {
  const t = computeFormatTrend([
    post(1, 5, 0),
    post(2, 5, 0),
    post(3, 5, 0),
    post(4, 5, 0),
    post(5, 5, 0),
    post(6, 500, 50),
  ]);
  assert.equal(t.status === "ok" && t.direction, "estavel");
});

test("nulo nunca vira 0: posts sem curtidas ou comentários ficam fora", () => {
  const t = computeFormatTrend([
    post(1, null, 1),
    post(2, 10, null),
    post(3, 10, 0),
    post(4, 10, 0),
    post(5, 10, 0),
    post(6, 10, 0),
    post(7, 10, 0),
    post(8, 10, 0),
  ]);
  assert.equal(t.status === "ok" && t.postsWithData, 6);
});

test("poucos posts com dado: nomeia a ausência, cor none", () => {
  const t = computeFormatTrend([
    post(1, null, null),
    post(2, null, null),
    post(3, null, null),
    post(4, 5, 0),
    post(5, 5, 0),
  ]);
  assert.equal(t.status, "no_data");
  assert.deepEqual(trendCopy(t), {
    label: "Tendência: faltam curtidas e comentários em posts suficientes",
    color: "none",
  });
});

test("base antiga 0: subindo sem percentual; 0 e 0 = estável", () => {
  const up = computeFormatTrend([
    post(1, 0, 0),
    post(2, 0, 0),
    post(3, 0, 0),
    post(4, 3, 0),
    post(5, 4, 0),
    post(6, 5, 0),
  ]);
  assert.deepEqual(trendCopy(up), { label: "Subindo", color: "cyan" });
  const flat = computeFormatTrend([1, 2, 3, 4, 5, 6].map((d) => post(d, 0, 0)));
  assert.equal(flat.status === "ok" && flat.direction, "estavel");
});

test("número ímpar de posts com dado: o do meio sai", () => {
  const t = computeFormatTrend([
    post(1, 10, 0),
    post(2, 10, 0),
    post(3, 10, 0),
    post(4, 999, 0),
    post(5, 20, 0),
    post(6, 20, 0),
    post(7, 20, 0),
  ]);
  assert.equal(t.status === "ok" && t.olderMedian, 10);
  assert.equal(t.status === "ok" && t.newerMedian, 20);
});
