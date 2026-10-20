import { describe, expect, it } from "vitest";
import {
  percentilePosition,
  respostaDaBaseMedian,
  viewsPorSeguidorMedian,
  type RefPost,
} from "./commentReference";

const post = (
  likes: number,
  comments: number,
  views: number | null,
): RefPost => ({
  likes,
  comments,
  views,
});

describe("respostaDaBaseMedian", () => {
  const posts = [10, 20, 30, 40, 50].map((l) => post(l, 0, null));
  it("mediana por post de (likes+comments)/seguidores*100", () => {
    expect(respostaDaBaseMedian(posts, 1000)).toBeCloseTo(3, 6);
  });
  it("menos de 5 posts => null", () => {
    expect(respostaDaBaseMedian(posts.slice(0, 4), 1000)).toBeNull();
  });
  it("seguidores ausentes ou < 1000 => null (nunca 0)", () => {
    expect(respostaDaBaseMedian(posts, null)).toBeNull();
    expect(respostaDaBaseMedian(posts, 999)).toBeNull();
  });
  it("ignora post sem likes ou comments", () => {
    const mixed = [...posts, { likes: null, comments: 3, views: null }];
    expect(respostaDaBaseMedian(mixed, 1000)).toBeCloseTo(3, 6);
  });
});

describe("viewsPorSeguidorMedian", () => {
  const posts = [100, 200, 300, 400, 500].map((v) => post(0, 0, v));
  it("mediana de reel_views/seguidores*100", () => {
    expect(viewsPorSeguidorMedian(posts, 1000)).toBeCloseTo(30, 6);
  });
  it("post sem views fica fora; poucos posts => null", () => {
    expect(
      viewsPorSeguidorMedian([...posts.slice(0, 4), post(1, 1, null)], 1000),
    ).toBeNull();
  });
});

describe("percentilePosition", () => {
  const ref = { p25: 0.06, p50: 0.22, p75: 0.83 };
  it.each([
    [0.01, "Abaixo do P25 da referência"],
    [0.1, "Entre o P25 e a mediana da referência"],
    [0.5, "Entre a mediana e o P75 da referência"],
    [2, "Acima do P75 da referência"],
  ])("%s => %s", (v, txt) => expect(percentilePosition(v, ref)).toBe(txt));
  it("sem valor ou sem régua => null", () => {
    expect(percentilePosition(null, ref)).toBeNull();
    expect(percentilePosition(1, { p25: null, p50: 1, p75: 2 })).toBeNull();
  });
});
