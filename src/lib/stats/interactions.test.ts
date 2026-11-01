import { describe, expect, it } from "vitest";
import { summarizeInteractionsByFormat } from "./interactions";

const r = (
  fmt: string,
  likes: number | null,
  comments: number | null,
  shares: number | null,
  saves: number | null,
) => ({ content_format: fmt, likes, comments, shares, saves });

const label = (f: string): string => (f === "reel" ? "Reels" : f);

describe("summarizeInteractionsByFormat", () => {
  it("soma e mediana só dos posts com os quatro campos", () => {
    const m = summarizeInteractionsByFormat(
      [
        r("reel", 1, 1, 1, 1), // 4
        r("reel", 10, 0, 0, 0), // 10
        r("reel", 100, 0, 0, 0), // 100 (viral)
        r("reel", 5, null, 0, 0), // sem dado: fora de tudo
      ],
      label,
    );
    expect(m.get("Reels")).toEqual({
      interactions: 114,
      interactionsMedian: 10, // a média (38) esconderia o post típico
      knownPosts: 3,
      totalPosts: 4,
    });
  });

  it("formato sem nenhum post completo => null, nunca 0", () => {
    const m = summarizeInteractionsByFormat(
      [r("static_post", 3, null, 0, 0)],
      label,
    );
    expect(m.get("static_post")).toEqual({
      interactions: null,
      interactionsMedian: null,
      knownPosts: 0,
      totalPosts: 1,
    });
  });

  it("post com zero interações conhecido conta como 0 de verdade", () => {
    const m = summarizeInteractionsByFormat([r("reel", 0, 0, 0, 0)], label);
    expect(m.get("Reels")?.interactionsMedian).toBe(0);
    expect(m.get("Reels")?.knownPosts).toBe(1);
  });
});
