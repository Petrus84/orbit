import test from "node:test";
import assert from "node:assert/strict";
import { polemicMedianOfPeriod } from "./polemic";

test("n < 5 devolve null", () => {
  const posts = Array.from({ length: 4 }, () => ({ comments: 0, likes: 10 }));
  assert.equal(polemicMedianOfPeriod(posts), null);
});

test("likes 0 e comments null nao entram", () => {
  const posts = [
    { comments: 0, likes: 10 },
    { comments: 0, likes: 10 },
    { comments: 0, likes: 10 },
    { comments: 0, likes: 10 },
    { comments: 1, likes: 10 },
    { comments: 0, likes: 0 },
    { comments: null, likes: 10 },
  ];
  assert.equal(polemicMedianOfPeriod(posts), 0);
});

test("mediana de maioria zero e 0", () => {
  const posts = [
    ...Array.from({ length: 10 }, () => ({ comments: 0, likes: 10 })),
    { comments: 5, likes: 144 },
  ];
  assert.equal(polemicMedianOfPeriod(posts), 0);
});
