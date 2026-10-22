/* ==========================================================================
   ORBIT · E2E Bloco A (itens 1–10) — harness SEGURO
   --------------------------------------------------------------------------
   Garantias de segurança:
   - `@/lib/supabase` é mockado: qualquer acesso ao banco LANÇA erro.
     Nenhuma rede, nenhuma leitura, nenhuma escrita.
   - NÃO importa syncClientAlerts nem alertsWriter.server (únicos que gravam).
   - Não lê .env, não usa service-role.
   - Só leitura de 2 arquivos-fonte via fs (opcional, para checar AlertType).

   Status por caso:
     PASS     = engine cumpre o que o doc do Bloco A prescreve
     DIVERGE  = engine existe mas contradiz o doc (bug/decisão a registrar)
     GAP      = não há resolver / dado / régua (esperado na simulação)

   Rodar:            npm run test:bloco-a
   Tolerar DIVERGE:  E2E_ALLOW_DIVERGENCE=1 npm run test:bloco-a
   Raiz do código (default "src"): ORBIT_SRC=. npx vitest run ...
   ========================================================================== */

import { describe, it, expect, vi, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Bloqueio total de DB ────────────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          `E2E-SAFE: acesso a supabase.${String(prop)} bloqueado`,
        );
      },
    },
  ),
}));

import * as engine from "@/lib/repositories/contentContractEngine";
import { isAlertType } from "@/lib/repositories/alertsRepository";

const blockedDb = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "then") return undefined;
      throw new Error(`E2E-SAFE: db.${String(prop)} bloqueado`);
    },
  },
);

// ── Coletor de resultados ───────────────────────────────────────────────────
type Status = "PASS" | "DIVERGE" | "GAP";
const rows: { item: string; status: Status; what: string; detail: string }[] =
  [];
const rec = (item: string, status: Status, what: string, detail = "") =>
  rows.push({ item, status, what, detail });
const check = (item: string, what: string, ok: boolean, detail = "") =>
  rec(item, ok ? "PASS" : "DIVERGE", what, detail);
const gap = (item: string, what: string, detail = "") =>
  rec(item, "GAP", what, detail);

const text = (d: {
  probableCause?: string;
  immediateAction?: string;
  title?: string;
}) => `${d.title ?? ""} ${d.probableCause ?? ""} ${d.immediateAction ?? ""}`;

const exportsMatching = (re: RegExp) =>
  Object.keys(engine).filter((k) => re.test(k));

afterAll(() => {
  console.table(rows);
  const n = (s: Status) => rows.filter((r) => r.status === s).length;
  console.log(
    `\nResumo: PASS=${n("PASS")}  DIVERGE=${n("DIVERGE")}  GAP=${n("GAP")}`,
  );
});

/* ───────────────────────── A1 — CTR bio 1,4% (limite 3%) ─────────────────── */
describe("A1 CTR bio", () => {
  const base = {
    ctrValue: 1.4,
    threshold: 3,
    daysBelowThreshold: 45,
    linkIsWorking: true,
  };

  it("link quebrado → crítico, reavaliar em 7 dias", () => {
    const d = engine.resolveCtrBioAlert({
      ...base,
      linkIsWorking: false,
      originBreakdown: null,
    });
    expect(d.type).toBe("ctr_below_threshold");
    check("A1", "link quebrado => critical", d.severity === "critical");
    check(
      "A1",
      "link quebrado menciona 7 dias",
      /7 dias/.test(d.immediateAction),
    );
  });

  it("sem rastreio de origem → instalar rastreio (L2, warning)", () => {
    const d = engine.resolveCtrBioAlert({ ...base, originBreakdown: null });
    check("A1", "sem origem => L2", d.confidenceLevel === "L2");
    check(
      "A1",
      "sem origem => manda instalar rastreio",
      /rastreio/i.test(text(d)),
    );
    check(
      "A1",
      "sem origem => severity warning",
      d.severity === "warning",
      `severity=${d.severity}`,
    );
    check("A1", "propaga thresholdValue=3", d.thresholdValue === 3);
  });

  it("baixo só em 1 origem vs. baixo em todas", () => {
    const one = engine.resolveCtrBioAlert({
      ...base,
      originBreakdown: [
        { origin: "post", ctr: 0.5 },
        { origin: "busca", ctr: 4 },
      ],
    });
    const all = engine.resolveCtrBioAlert({
      ...base,
      originBreakdown: [
        { origin: "post", ctr: 1 },
        { origin: "busca", ctr: 1.2 },
      ],
    });
    check(
      "A1",
      "1 origem fraca => 'não mexa na bio'",
      /não mexa na bio/i.test(one.immediateAction),
    );
    check(
      "A1",
      "todas fracas => 1 elemento por vez",
      /um elemento só/i.test(all.immediateAction),
    );
  });

  it("dados: sem tabela de origem populada / flag de link", () => {
    gap(
      "A1",
      "origem de visita e linkIsWorking não existem no banco",
      "ver probe SQL A1",
    );
  });

  it("nenhum orquestrador chama resolveCtrBioAlert", () => {
    gap(
      "A1",
      "resolver existe mas não está ligado a syncClientAlerts",
      "só testável em isolamento",
    );
  });
});

/* ───────────────────── A2 — alcance −40%, ER sobe ───────────────────────── */
describe("A2 alcance↓ ER↑", () => {
  const base = {
    engagementChangePct: 40,
    windowDays: 60,
    allFormatsDroppedSimultaneously: null,
  };

  it("saldo de seguidores caindo", () => {
    const d = engine.resolveEngagementCollapseAlert({
      ...base,
      followerBalanceTrend: -50,
      formatMixChanged: false,
    });
    // Doc A2: warning se saldo caindo
    check(
      "A2",
      "saldo<0 => warning (doc)",
      d.severity === "warning",
      `engine=${d.severity}`,
    );
  });

  it("saldo estável + mix mudou → correlação espúria", () => {
    const d = engine.resolveEngagementCollapseAlert({
      ...base,
      followerBalanceTrend: 0,
      formatMixChanged: true,
    });
    check(
      "A2",
      "mix mudou => não é crise (≠ critical)",
      d.severity !== "critical",
    );
  });

  it("saldo estável + mix igual → info", () => {
    const d = engine.resolveEngagementCollapseAlert({
      ...base,
      followerBalanceTrend: 10,
      formatMixChanged: false,
    });
    check(
      "A2",
      "saldo estável => info",
      d.severity === "info",
      `engine=${d.severity}`,
    );
  });

  it("saldo ausente → L2 + pede o dado", () => {
    const d = engine.resolveEngagementCollapseAlert({
      ...base,
      followerBalanceTrend: null,
      formatMixChanged: null,
    });
    check("A2", "sem saldo => L2", d.confidenceLevel === "L2");
  });

  it("modelo do input não representa 'ER subiu'", () => {
    gap(
      "A2",
      "input só tem engagementChangePct (queda); cenário A2 é alcance↓+ER↑",
      "limitação estrutural",
    );
  });
});

/* ───────────────────── A3 / A4 — churn e VPS por amostra ────────────────── */
describe("A3/A4 sem lógica", () => {
  it("A3 churn: sem resolver / sem regra de base pequena", () => {
    const ks = exportsMatching(/churn/i);
    if (ks.length === 0)
      gap(
        "A3",
        "nenhum export de churn no engine (follower_churn_high só no DB/check_churn_alert)",
      );
    else check("A3", "export de churn existe", true, ks.join(","));
    gap("A3", "regra 'base<100 => info' não implementada no engine");
  });

  it("A4 VPS: método de coleta / margem de erro não modelados", () => {
    const ks = exportsMatching(/sample|amostra|margin|margem/i);
    if (ks.length === 0)
      gap("A4", "sem campo/função de tamanho de amostra ou método de coleta");
    else check("A4", "export de amostragem existe", true, ks.join(","));
  });
});

/* ───────────────────── A5 — ER 2,1% em 8k vs 800k ───────────────────────── */
describe("A5 normalização por porte", () => {
  it("faixas de tier", () => {
    expect(engine.mapFollowersToTier(8_000)).toBe("nano");
    expect(engine.mapFollowersToTier(800_000)).toBe("macro");
    expect(engine.mapFollowersToTier(9_999)).toBe("nano");
    expect(engine.mapFollowersToTier(10_000)).toBe("micro");
    expect(engine.mapFollowersToTier(249_999)).toBe("mid");
    expect(engine.mapFollowersToTier(250_000)).toBe("macro");
    expect(engine.mapFollowersToTier(null)).toBeNull();
    rec("A5", "PASS", "mapFollowersToTier correto nas bordas");
  });

  it("ER 2,1 recebe o mesmo veredito em nano e macro?", async () => {
    const run = async (tier: string) => {
      try {
        const r = await engine.classifyMetric(
          "er_real_pct",
          2.1,
          "comercio_direto_ecommerce_social",
          tier,
          blockedDb as never,
        );
        return {
          ok: true as const,
          sem: (r as { semaphore?: string }).semaphore ?? "n/a",
        };
      } catch (e) {
        return { ok: false as const, sem: `ERRO:${String(e).slice(0, 60)}` };
      }
    };
    const [nano, macro] = await Promise.all([run("nano"), run("macro")]);
    if (nano.sem === macro.sem) {
      gap(
        "A5",
        "ER 2,1 tem veredito idêntico em 8k e 800k (sem régua por porte)",
        `nano=${nano.sem} macro=${macro.sem}`,
      );
    } else {
      check(
        "A5",
        "veredito difere por porte",
        true,
        `nano=${nano.sem} macro=${macro.sem}`,
      );
    }
  });
});

/* ───────────────────── A6 — fadiga 44% × ROAS 3,1x ──────────────────────── */
describe("A6 fadiga + ROAS ok", () => {
  const base = {
    fatiguePct: 44,
    fatigueThreshold: 40,
    daysUntilThresholdCross: null,
    roasCurrent: 3.1,
    roasTarget: 2.5,
  };

  it("ROAS estável → não troca; doc pede warning", () => {
    const d = engine.resolveCreativeFatigueAlert({
      ...base,
      roasTrend: "stable",
    });
    check("A6", "estável => nunca critical", d.severity !== "critical");
    check(
      "A6",
      "estável => warning (doc)",
      d.severity === "warning",
      `engine=${d.severity}`,
    );
    check(
      "A6",
      "estável => 'Não troque ainda'",
      /não troque/i.test(d.immediateAction),
    );
    check("A6", "propaga thresholdValue=40", d.thresholdValue === 40);
  });

  it("ROAS caindo → trocar agora", () => {
    const d = engine.resolveCreativeFatigueAlert({
      ...base,
      roasTrend: "falling",
      daysUntilThresholdCross: 9,
    });
    check("A6", "caindo => warning", d.severity === "warning");
    check(
      "A6",
      "caindo => troque criativo",
      /troque o criativo/i.test(d.immediateAction),
    );
  });

  it("tendência ausente → L2", () => {
    const d = engine.resolveCreativeFatigueAlert({ ...base, roasTrend: null });
    check("A6", "sem tendência => L2", d.confidenceLevel === "L2");
  });

  it("dados de Ads ausentes", () => {
    gap("A6", "ads_meta_* vazias; resolver não ligado ao orquestrador");
  });
});

/* ───────────────────── A7 — ROAS 3,2→2,0 com CPM +35% ───────────────────── */
describe("A7 ROAS ↓ + CPM ↑", () => {
  const base = {
    roasCurrent: 2.0,
    roasTarget: 2.5,
    roasMinViable: 1.5,
    cpmChangePctThisAccount: 35,
  };

  it("CPM subiu no mercado todo → não troca criativo", () => {
    const d = engine.resolveRoasBelowMinimumAlert({
      ...base,
      cpmChangePctMarketBenchmark: 33,
      frequencyChangePct: 0,
    });
    check(
      "A7",
      "mercado todo => 'não troque o anúncio'",
      /não troque o anúncio/i.test(d.immediateAction),
    );
  });

  it("só a conta + frequência↑ → criativo", () => {
    const d = engine.resolveRoasBelowMinimumAlert({
      ...base,
      cpmChangePctMarketBenchmark: 5,
      frequencyChangePct: 20,
    });
    check(
      "A7",
      "freq↑ => troque criativo",
      /troque o criativo/i.test(d.immediateAction),
    );
  });

  it("só a conta + freq estável → público novo", () => {
    const d = engine.resolveRoasBelowMinimumAlert({
      ...base,
      cpmChangePctMarketBenchmark: 5,
      frequencyChangePct: 0,
    });
    check(
      "A7",
      "freq estável => público novo",
      /público novo/i.test(d.immediateAction),
    );
  });

  it("sem CPM de mercado → cita CPM de mercado primeiro", () => {
    const d = engine.resolveRoasBelowMinimumAlert({
      ...base,
      cpmChangePctMarketBenchmark: null,
      frequencyChangePct: null,
    });
    check("A7", "sem benchmark => L2", d.confidenceLevel === "L2");
    check(
      "A7",
      "texto cita custo de mercado",
      /cobrando|CPM|mercado/i.test(text(d)),
    );
  });

  it("dados: margem e CPM de mercado ausentes", () => {
    gap(
      "A7",
      "gross_margin_pct nulo => roasMinViable incalculável; sem fonte de CPM de mercado",
    );
  });
});

/* ───────────────────── A8 / A9 / A10 — sem resolver ─────────────────────── */
describe("A8/A9/A10 sem resolver", () => {
  it("A8 bounce×tempo (GA4)", () => {
    const ks = exportsMatching(/bounce|ga4|landing/i);
    if (ks.length === 0)
      gap("A8", "sem resolver nem AlertType; ads_ga4_landing_pages vazia");
    else check("A8", "resolver existe", true, ks.join(","));
  });
  it("A9 Impression Share × CPC (Google)", () => {
    const ks = exportsMatching(/impression|share|cpc/i);
    if (ks.length === 0)
      gap("A9", "sem resolver nem AlertType; ads_google_snapshots vazia");
    else check("A9", "resolver existe", true, ks.join(","));
  });
  it("A10 frequência alta × CTR estável", () => {
    const ks = exportsMatching(/frequency|frequencia/i);
    if (ks.length === 0)
      gap(
        "A10",
        "sem resolver de frequência (fadiga usa fatiguePct); sem distribuição por indivíduo",
      );
    else check("A10", "resolver existe", true, ks.join(","));
  });
});

/* ───────────────────── Transversais ─────────────────────────────────────── */
describe("X — persistência e staleness (pure)", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  it("staleness: limiares 14/30 dias", async () => {
    expect(await engine.resolveStalenessAlert("2026-10-05", now)).toBeNull();
    const w = await engine.resolveStalenessAlert("2026-10-03", now);
    const c = await engine.resolveStalenessAlert("2026-09-17", now);
    expect(await engine.resolveStalenessAlert(null, now)).toBeNull();
    check("X1", "15d => warning", w?.severity === "warning");
    check("X1", "31d => critical", c?.severity === "critical");
  });

  it("data_outdated passa no guard de persistência?", async () => {
    const d = await engine.resolveStalenessAlert("2026-09-17", now);
    const ok = d ? isAlertType(d.type) : false;
    check(
      "X2",
      "isAlertType('data_outdated') (senão o writer pula e nunca fecha)",
      ok,
      "enum do DB tem data_outdated; ALERT_TYPES/AlertType no código precisa ter também",
    );
  });

  it("AlertType em types/orbit.ts contém data_outdated?", () => {
    const root = process.env.ORBIT_SRC ?? "src";
    const f = path.join(root, "types", "orbit.ts");
    if (!fs.existsSync(f)) {
      gap("X3", `arquivo não encontrado: ${f} (ajuste ORBIT_SRC)`);
    } else {
      const src = fs.readFileSync(f, "utf8");
      const m = src.match(/export type AlertType =([\s\S]*?);/);
      check(
        "X3",
        "AlertType inclui data_outdated",
        !!m && /data_outdated/.test(m[1] ?? ""),
      );
    }
  });
});

/* ───────────────────── Gate final ───────────────────────────────────────── */
describe("gate", () => {
  it("sem DIVERGE (use E2E_ALLOW_DIVERGENCE=1 para só reportar)", () => {
    const div = rows.filter((r) => r.status === "DIVERGE");
    if (process.env.E2E_ALLOW_DIVERGENCE !== "1") {
      expect(div.map((r) => `${r.item}: ${r.what}`)).toEqual([]);
    }
  });
});
