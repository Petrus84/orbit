"use strict";
/**
 * scripts/reconcile-kpi-contracts.ts
 *
 * Robô KCR (Etapa 1 do pipeline ORBIT — KPI Contract Registry).
 * Lê contracts/kpi/inbox/briefing-v1.json (Doc 1) e contracts/kpi/inbox/contract-v2.json
 * (Doc 2), casa por kpi_nome, e faz uma checagem MECÂNICA (grep, não semântica) de:
 *   - se a coluna/writer citados no Doc 2 aparecem no dump de schema
 *   - se o writer citado aparece definido em src/lib/repositories/contentContractEngine.ts
 *   - se o writer citado é de fato CHAMADO em algum outro arquivo do repo (não só definido)
 *
 * Isto NÃO substitui leitura humana da lógica — só reduz o trabalho manual de achar
 * "NÃO ENCONTRADO" e "escrito mas nunca chamado" (RWP escondido dentro do KCR).
 *
 * Uso:
 *   npx tsx scripts/reconcile-kpi-contracts.ts
 *
 * Variáveis de ambiente:
 *   ORBIT_SCHEMA_DUMP  caminho para o dump SQL do schema `orbit` (DDL).
 *                      Default: supabase/dump_completo.sql (não existe neste
 *                      repo ainda — gere com `supabase db dump` ou aponte para
 *                      o dump que você já tem, ex: 20260925dump_orbit.sql).
 *
 * Saída:
 *   contracts/kpi/registry.json
 *   contracts/kpi/reconciliation.json
 *
 * Zero invenção: qualquer coluna/writer não encontrado vira "NÃO ENCONTRADO"
 * no relatório — o script nunca assume que algo existe.
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var ROOT = process.cwd();
var INBOX = (0, node_path_1.join)(ROOT, "contracts/kpi/inbox");
var SCHEMA_DUMP_PATH =
  (_a = process.env.ORBIT_SCHEMA_DUMP) !== null && _a !== void 0
    ? _a
    : (0, node_path_1.join)(ROOT, "supabase/20260928dump_orbit.sql");
var ENGINE_PATH = (0, node_path_1.join)(
  ROOT,
  "src/lib/repositories/contentContractEngine.ts",
);
function readJson(path, label) {
  if (!(0, node_fs_1.existsSync)(path)) {
    console.error(
      "PARAR \u2014 evid\u00EAncia insuficiente: "
        .concat(label, " n\u00E3o encontrado em ")
        .concat(path, "."),
    );
    process.exit(1);
  }
  return JSON.parse((0, node_fs_1.readFileSync)(path, "utf-8"));
}
function walk(dir, exts, acc) {
  if (acc === void 0) {
    acc = [];
  }
  if (!(0, node_fs_1.existsSync)(dir)) return acc;
  for (var _i = 0, _a = (0, node_fs_1.readdirSync)(dir); _i < _a.length; _i++) {
    var entry = _a[_i];
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === "dist" ||
      entry === "_archived" ||
      entry === "refatoracao-temp"
    )
      continue;
    var full = (0, node_path_1.join)(dir, entry);
    var st = (0, node_fs_1.statSync)(full);
    if (st.isDirectory()) walk(full, exts, acc);
    else if (exts.includes((0, node_path_1.extname)(full))) acc.push(full);
  }
  return acc;
}
function main() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  var doc2 = readJson(
    (0, node_path_1.join)(INBOX, "contract-v2.json"),
    "Doc 2 (contract-v2.json)",
  );
  var doc1 = readJson(
    (0, node_path_1.join)(INBOX, "briefing-v1.json"),
    "Doc 1 (briefing-v1.json)",
  );
  var doc1ByName = new Map(
    doc1.map(function (e) {
      return [e.kpi_nome, e];
    }),
  );
  var schemaDumpExists = (0, node_fs_1.existsSync)(SCHEMA_DUMP_PATH);
  var schemaDump = schemaDumpExists
    ? (0, node_fs_1.readFileSync)(SCHEMA_DUMP_PATH, "utf-8")
    : "";
  if (!schemaDumpExists) {
    console.warn(
      "AVISO: dump de schema n\u00E3o encontrado em ".concat(
        SCHEMA_DUMP_PATH,
        '. Binding check ficar\u00E1 "N\u00C3O CONFERIDO" para todos os KPIs.',
      ),
    );
  }
  var engineSrc = (0, node_fs_1.existsSync)(ENGINE_PATH)
    ? (0, node_fs_1.readFileSync)(ENGINE_PATH, "utf-8")
    : "";
  var allTsFiles = walk((0, node_path_1.join)(ROOT, "src"), [
    ".ts",
    ".tsx",
  ]).concat(walk((0, node_path_1.join)(ROOT, "scripts"), [".ts"]));
  function writerDefined(name) {
    return new RegExp(
      "export\\s+(async\\s+)?function\\s+".concat(name, "\\b"),
    ).test(engineSrc);
  }
  function writerCalled(name) {
    var callRe = new RegExp("\\b".concat(name, "\\("));
    var files = [];
    for (
      var _i = 0, allTsFiles_1 = allTsFiles;
      _i < allTsFiles_1.length;
      _i++
    ) {
      var file = allTsFiles_1[_i];
      if (file === ENGINE_PATH) continue; // não conta a própria definição
      var content = (0, node_fs_1.readFileSync)(file, "utf-8");
      if (callRe.test(content)) files.push(file.replace(ROOT + "/", ""));
    }
    return { called: files.length > 0, files: files };
  }
  var registry = [];
  var reconciliation = [];
  for (var _i = 0, doc2_1 = doc2; _i < doc2_1.length; _i++) {
    var e = doc2_1[_i];
    var doc1Match =
      (_a = doc1ByName.get(e.kpi_nome)) !== null && _a !== void 0 ? _a : null;
    var recusadaKey = Object.keys(e).find(function (k) {
      return (
        k.startsWith("regra_antiga") ||
        k.startsWith("regra_calculo_antiga") ||
        k.startsWith("regra_alerta_antiga") ||
        k.startsWith("defaults_legado")
      );
    });
    // writer citado no texto do Doc2 (campo "writer"), se houver
    var writerField = typeof e.writer === "string" ? e.writer : null;
    var writerNameMatch =
      writerField === null || writerField === void 0
        ? void 0
        : writerField.match(/([a-zA-Z][a-zA-Z0-9]*Alert)\b/);
    var writerName =
      (_b =
        writerNameMatch === null || writerNameMatch === void 0
          ? void 0
          : writerNameMatch[1]) !== null && _b !== void 0
        ? _b
        : null;
    var writerVerdict = void 0;
    if (!writerName) {
      writerVerdict = "sem_writer_declarado";
    } else if (!writerDefined(writerName)) {
      writerVerdict = "N\u00C3O ENCONTRADO: fun\u00E7\u00E3o "
        .concat(writerName, " n\u00E3o existe em ")
        .concat(ENGINE_PATH.replace(ROOT + "/", ""));
    } else {
      var _l = writerCalled(writerName),
        called = _l.called,
        files = _l.files;
      writerVerdict = called
        ? "chamado em: ".concat(files.join(", "))
        : 'escrito mas NUNCA CHAMADO fora da pr\u00F3pria defini\u00E7\u00E3o \u2014 RWP pendente antes de considerar "vigente" em produ\u00E7\u00E3o';
    }
    // binding: procura, no dump de schema (se existir), qualquer coluna citada em
    // fonte_preferencial/metrica_instagram/regra_calculo (heurística simples: snake_case tokens)
    var candidateText = [
      e.fonte_preferencial,
      e.metrica_instagram,
      e.regra_calculo,
    ]
      .filter(Boolean)
      .join(" ");
    var columnTokens = Array.from(
      new Set(
        (_c = candidateText.match(/[a-z_]{4,}(?:\.[a-z_]{2,})?/g)) !== null &&
          _c !== void 0
          ? _c
          : [],
      ),
    );
    var foundColumns = schemaDumpExists
      ? columnTokens.filter(function (t) {
          return schemaDump.includes(t.split(".").pop());
        })
      : [];
    registry.push({
      kpi_id: e.kpi_id,
      kpi_nome: e.kpi_nome,
      status_doc2: e.status,
      regra_calculo_vigente:
        (_f =
          (_e =
            (_d = e.regra_calculo) !== null && _d !== void 0
              ? _d
              : e.regua_vigente) !== null && _e !== void 0
            ? _e
            : e.regra_refinada) !== null && _f !== void 0
          ? _f
          : null,
      regra_recusada: recusadaKey ? e[recusadaKey] : null,
      writer_declarado: writerField,
      writer_check: writerVerdict,
      binding_check: schemaDumpExists
        ? foundColumns.length
          ? "poss\u00EDvel match de coluna: ".concat(foundColumns.join(", "))
          : "NÃO ENCONTRADO: nenhum token reconhecido no dump — confira manualmente"
        : "NÃO CONFERIDO: dump de schema ausente (ver ORBIT_SCHEMA_DUMP)",
    });
    reconciliation.push({
      kpi_id: e.kpi_id,
      kpi_nome: e.kpi_nome,
      presente_no_doc1: Boolean(doc1Match),
      regra_doc1:
        (_g =
          doc1Match === null || doc1Match === void 0
            ? void 0
            : doc1Match.regra_calculo) !== null && _g !== void 0
          ? _g
          : null,
      regra_doc2:
        (_k =
          (_j =
            (_h = e.regra_calculo) !== null && _h !== void 0
              ? _h
              : e.regua_vigente) !== null && _j !== void 0
            ? _j
            : e.regra_refinada) !== null && _k !== void 0
          ? _k
          : null,
      regra_recusada_explicita: recusadaKey ? e[recusadaKey] : null,
      diff:
        doc1Match && doc1Match.regra_calculo !== e.regra_calculo
          ? "refinado"
          : doc1Match
            ? "igual"
            : "novo_no_doc2",
    });
  }
  (0, node_fs_1.writeFileSync)(
    (0, node_path_1.join)(ROOT, "contracts/kpi/registry.json"),
    JSON.stringify(
      { gerado_em: new Date().toISOString(), kpis: registry },
      null,
      2,
    ),
  );
  (0, node_fs_1.writeFileSync)(
    (0, node_path_1.join)(ROOT, "contracts/kpi/reconciliation.json"),
    JSON.stringify(
      { gerado_em: new Date().toISOString(), reconciliacao: reconciliation },
      null,
      2,
    ),
  );
  var naoWireados = registry.filter(function (r) {
    return (
      typeof r.writer_check === "string" &&
      r.writer_check.includes("NUNCA CHAMADO")
    );
  });
  console.log("\nKCR rodou. ".concat(registry.length, " KPIs processados."));
  console.log(
    "Writers escritos mas nunca chamados (RWP pendente): ".concat(
      naoWireados.length,
    ),
  );
  for (
    var _m = 0, naoWireados_1 = naoWireados;
    _m < naoWireados_1.length;
    _m++
  ) {
    var r = naoWireados_1[_m];
    console.log("  - ".concat(r.kpi_id, ": ").concat(r.writer_declarado));
  }
  console.log(
    "\nArquivos gerados: contracts/kpi/registry.json, contracts/kpi/reconciliation.json",
  );
}
main();
