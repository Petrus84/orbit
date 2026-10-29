import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FUNNEL_STAGES } from "./registry";

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8");

test("registry: ordem contínua a partir de 1, chaves únicas e pai sempre anterior", () => {
  for (const kind of ["link", "dm"] as const) {
    const stages = FUNNEL_STAGES[kind];
    assert.deepEqual(
      stages.map((s) => s.order),
      stages.map((_, i) => i + 1),
      kind,
    );
    assert.equal(new Set(stages.map((s) => s.key)).size, stages.length, kind);
    for (const s of stages) {
      if (s.parent === null) {
        assert.equal(s.order, 1, `${kind}/${s.key}: só a 1ª etapa não tem pai`);
        continue;
      }
      const pai = stages.find((p) => p.key === s.parent);
      assert.ok(pai, `${kind}/${s.key}: pai ${s.parent} não existe`);
      assert.ok(
        pai.order < s.order,
        `${kind}/${s.key}: pai vem depois do filho`,
      );
    }
  }
});

test("registry: venda é a única etapa informada e fecha cada funil", () => {
  for (const kind of ["link", "dm"] as const) {
    const stages = FUNNEL_STAGES[kind];
    const informadas = stages.filter((s) => s.source === "external_reported");
    assert.equal(informadas.length, 1, kind);
    assert.equal(stages[stages.length - 1]?.key, informadas[0]?.key, kind);
  }
});

test("DDL: o cta_type que escolhe o funil de DM existe em CTAType (CHECK real da coluna)", () => {
  const ddl = read(
    "../../../supabase/migrations/20261029093600_funnel_registry_ddl.sql",
  );
  const usado = [...ddl.matchAll(/o\.cta_type\s*=\s*'(\w+)'/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(usado, ["dm_comentario"]);
  const orbit = read("../../types/orbit.ts");
  const bloco = /export type CTAType =([\s\S]*?);/.exec(orbit)?.[1] ?? "";
  const validos = [...bloco.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.equal(validos.length, 5);
  for (const v of usado)
    assert.ok(validos.includes(v as string), `${v} não é um CTAType`);
});

test("DDL: leitura do direct é por cliente (can_read_client), nunca using (true)", () => {
  const ddl = read(
    "../../../supabase/migrations/20261029093600_funnel_registry_ddl.sql",
  );
  const policy =
    /create policy sel_ig_dm_funnel_snapshot on orbit\.ig_dm_funnel_snapshot[\s\S]*?;/.exec(
      ddl,
    )?.[0] ?? "";
  assert.match(policy, /for select to authenticated/);
  assert.match(policy, /can_read_client\(client_id\)/);
  assert.doesNotMatch(policy, /using\s*\(\s*true\s*\)/i);
});

test("DDL: tabelas de referência exigem has_workspace_access; authenticated nunca escreve", () => {
  const ddl = read(
    "../../../supabase/migrations/20261029093600_funnel_registry_ddl.sql",
  );
  for (const t of ["funnel_stage_registry", "funnel_conversion_benchmark"]) {
    const policy =
      new RegExp(`create policy sel_${t} on orbit\\.${t}[\\s\\S]*?;`).exec(
        ddl,
      )?.[0] ?? "";
    assert.match(policy, /has_workspace_access\(\)/, t);
  }
  const paraAuthenticated = [
    ...ddl.matchAll(
      /create policy \w+ on orbit\.\w+\s+for (\w+) to authenticated/g,
    ),
  ].map((m) => m[1]);
  assert.ok(
    paraAuthenticated.length >= 3 &&
      paraAuthenticated.every((c) => c === "select"),
    paraAuthenticated.join(","),
  );
});

test("DDL: service_role recebe GRANT de escrita nas tabelas do funil", () => {
  const ddl = read(
    "../../../supabase/migrations/20261029093600_funnel_registry_ddl.sql",
  );
  const serviceGrant =
    /grant\s+insert,\s*update,\s*delete\s+on\s+orbit\.funnel_stage_registry,\s*orbit\.funnel_conversion_benchmark,\s*orbit\.ig_dm_funnel_snapshot\s+to\s+service_role\s*;/i;

  assert.match(ddl, serviceGrant);
});
