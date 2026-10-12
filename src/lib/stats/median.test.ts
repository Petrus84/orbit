import test from "node:test";
import assert from "node:assert/strict";
import { medianOf } from "./median";

test("medianOf: ímpar, par, não ordenado", () => {
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(medianOf([4, 1, 3, 2]), 2.5);
  assert.equal(medianOf([7]), 7);
});

test("medianOf: vazio ou só não-finitos => null (nunca 0)", () => {
  assert.equal(medianOf([]), null);
  assert.equal(medianOf([Number.NaN, Number.POSITIVE_INFINITY]), null);
});

test("medianOf: ignora não-finitos e não muta a entrada", () => {
  const input = [5, Number.NaN, 1, 3];
  assert.equal(medianOf(input), 3);
  assert.deepEqual(input.slice(0, 1), [5]);
});

test("medianOf: zero é valor real, não ausência", () => {
  assert.equal(medianOf([0, 0, 0]), 0);
});
