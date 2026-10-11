import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  computeSaturation,
  diasDaJanela,
  runFunnelSimulation,
  somaOuNulo,
} from "./funnelMath";
import { FUNNEL_STAGES } from "../funnel/registry";

const st = { alcance: 20000, ctrBio: 2, taxaConv: 3 };

test("engajamento: próprio quando existe, senão valor padrão rotulado como fallback", () => {
  const a = computeSaturation(st, {
    alcanceRealHistorico: 10000,
    erRealNativo: 4,
  });
  assert.equal(a.engajamentoFonte, "proprio");
  assert.equal(a.engajamentoEfetivo, 4);
  const b = computeSaturation(st, {
    alcanceRealHistorico: 10000,
    erRealNativo: null,
  });
  assert.equal(b.engajamentoFonte, "fallback_fixo");
  assert.equal(b.engajamentoEfetivo, 1.5);
});
test("sem engajamento próprio a conta é idêntica à versão anterior (1,5%)", () => {
  const r = computeSaturation(st, {
    alcanceRealHistorico: 10000,
    erRealNativo: null,
  });
  assert.ok(
    Math.abs(r.friccao - Math.pow(2, Math.max(0.1, 0.25 - 1.5 * 0.02))) < 1e-12,
  );
});
test("vendas = alcance × visita × clique × conversão sem saturação", () => {
  const { result } = runFunnelSimulation(st, 10, {
    alcanceRealHistorico: 40000,
    erRealNativo: null,
  });
  assert.ok(Math.abs(result.vendas - 20000 * 0.02 * 0.1 * 0.03) < 1e-9);
});
test("registry TS == seed SQL (mesmas etapas, ordem, origem e confiança)", () => {
  const sql = readFileSync(
    new URL(
      "../../../supabase/migrations/20261011120100_funnel_registry_seed.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const rows = [
    ...sql.matchAll(
      /\('(link|dm)','(\w+)',\s*(\d+),'([^']*)',\s*'(\w+)','(L\d)'/g,
    ),
  ];
  const fromSql = rows
    .map((m) => `${m[1]}|${m[2]}|${m[3]}|${m[5]}|${m[6]}`)
    .sort();
  const fromTs = (["link", "dm"] as const)
    .flatMap((k) =>
      FUNNEL_STAGES[k].map(
        (s) => `${k}|${s.key}|${s.order}|${s.source}|${s.confidence}`,
      ),
    )
    .sort();
  assert.equal(fromSql.length, 12);
  assert.deepEqual(fromSql, fromTs);
});

test("somaOuNulo: venda não informada é null, zero explícito é dado", () => {
  assert.equal(somaOuNulo([]), null);
  assert.equal(somaOuNulo([null, undefined]), null);
  assert.equal(somaOuNulo([null, 3, null]), 3);
  assert.equal(somaOuNulo([0]), 0);
  assert.equal(somaOuNulo([2, 5]), 7);
  assert.equal(somaOuNulo([Number.NaN]), null);
});

test("diasDaJanela: conta o primeiro e o último dia", () => {
  assert.equal(diasDaJanela("2026-07-08", "2026-10-05"), 90);
  assert.equal(diasDaJanela("2026-10-05", "2026-10-05"), 1);
  assert.equal(diasDaJanela("2026-01-01", "2026-10-11"), 284);
  assert.equal(diasDaJanela("x", "2026-10-05"), null);
});
