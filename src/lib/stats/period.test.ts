import test from "node:test";
import assert from "node:assert/strict";
import { periodUpperExclusive } from "./period";

test("soma um dia ao fim do header (inclui o último dia)", () => {
  assert.equal(periodUpperExclusive("2026-10-18"), "2026-10-19");
});

test("vira mês, ano e fevereiro", () => {
  assert.equal(periodUpperExclusive("2026-12-31"), "2027-01-01");
  assert.equal(periodUpperExclusive("2026-02-28"), "2026-03-01");
  assert.equal(periodUpperExclusive("2028-02-28"), "2028-02-29");
});

test("timestamp completo ou valor inválido passam intactos", () => {
  assert.equal(
    periodUpperExclusive("2026-10-18T12:00:00Z"),
    "2026-10-18T12:00:00Z",
  );
  assert.equal(periodUpperExclusive("2026-13-45"), "2026-13-45");
  assert.equal(periodUpperExclusive(""), "");
});
