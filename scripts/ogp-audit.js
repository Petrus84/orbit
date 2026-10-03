"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/ogp-audit.ts
var supabase_js_1 = require("@supabase/supabase-js");
var node_fs_1 = require("node:fs");
var dotenv_1 = require("dotenv");
dotenv_1.default.config({ path: '.env.local' });
var supabase = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
var PAGE_SIZE = 1000;
/** Mapa operacional conhecido. O script também descobre clients que existem no banco e não estão aqui. */
var KNOWN_CLIENTS = {
    cpimportstore: '2141d077-0d82-4fda-83df-558377f105ff',
    eupetruchio84: 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7',
    mauricioartphoto: '344445c9-08c5-4c07-be1b-c9f8f8e12865',
    djcaiodogao: 'c2779193-d3a0-4fc7-b392-ad64fea4273f',
    dogativo: 'e45927a7-4f3d-4fd3-bac7-543cc3545dc1',
};
var FACT_CATALOG = [
    { screen: 'carteira', table: 'clients', requiredForReady: true, note: 'cliente existe' },
    { screen: 'carteira', table: 'client_onboarding', requiredForReady: false, note: 'onboarding 1:1' },
    { screen: 'instagram', table: 'ig_account_snapshots', requiredForReady: true, note: 'KPI followers/reach/ER' },
    { screen: 'instagram', table: 'ig_posts', requiredForReady: false, note: 'grade de conteúdo' },
    { screen: 'instagram', table: 'ig_import_sessions', requiredForReady: false, note: 'vigência da ingestão' },
    { screen: 'avatar', table: 'ig_audience_snapshots', requiredForReady: true, note: 'audiência observada' },
    { screen: 'avatar', table: 'avatar_alignment_snapshot', requiredForReady: false, note: 'score vs esperado' },
    { screen: 'avatar', table: 'avatar_validations', requiredForReady: false, note: 'validação humana' },
    { screen: 'alertas', table: 'alerts', requiredForReady: false, note: 'empty é produto' },
    { screen: 'funil', table: 'funnel_data', requiredForReady: true, note: 'alcance→visita→clique→venda' },
    { screen: 'instagram', table: 'raw_ig_ingest', requiredForReady: false, note: 'pipeline bruto' },
];
function countExactAll(table, clientId) {
    return __awaiter(this, void 0, void 0, function () {
        var q, _a, count, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    q = supabase
                        .schema('orbit')
                        .from(table)
                        .select('*', { count: 'exact', head: true });
                    if (clientId) {
                        q = q.eq('client_id', clientId);
                    }
                    return [4 /*yield*/, q];
                case 1:
                    _a = _b.sent(), count = _a.count, error = _a.error;
                    if (error)
                        return [2 /*return*/, { count: -1, error: error.message }];
                    return [2 /*return*/, { count: count !== null && count !== void 0 ? count : 0, error: null }];
            }
        });
    });
}
// ✅ CORRETO (Opção 3: Type guard se precisar de unknown)
function countExactWhere(table, clientId, whereField, whereValue) {
    return __awaiter(this, void 0, void 0, function () {
        var q, _a, count, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // Validar que whereValue é um tipo permitido
                    if (typeof whereValue !== 'string' && typeof whereValue !== 'number' && typeof whereValue !== 'boolean') {
                        return [2 /*return*/, { count: -1, error: 'whereValue deve ser string, number ou boolean' }];
                    }
                    q = supabase
                        .schema('orbit')
                        .from(table)
                        .select('*', { count: 'exact', head: true })
                        .eq('client_id', clientId)
                        .eq(whereField, whereValue) // ✅ Agora é tipado corretamente
                    ;
                    return [4 /*yield*/, q];
                case 1:
                    _a = _b.sent(), count = _a.count, error = _a.error;
                    if (error)
                        return [2 /*return*/, { count: -1, error: error.message }];
                    return [2 /*return*/, { count: count !== null && count !== void 0 ? count : 0, error: null }];
            }
        });
    });
}
function fetchAll(table, columns, clientId, orderBy) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, count, countError, totalExpected, rows, from, q, _b, data, error;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, supabase
                        .schema('orbit')
                        .from(table)
                        .select('*', { count: 'exact', head: true })
                        .eq('client_id', clientId)];
                case 1:
                    _a = _c.sent(), count = _a.count, countError = _a.error;
                    if (countError)
                        return [2 /*return*/, { rows: [], truncated: false, error: countError.message }];
                    totalExpected = count !== null && count !== void 0 ? count : 0;
                    rows = [];
                    from = 0;
                    _c.label = 2;
                case 2:
                    if (!(rows.length < totalExpected)) return [3 /*break*/, 4];
                    q = supabase
                        .schema('orbit')
                        .from(table)
                        .select(columns)
                        .eq('client_id', clientId)
                        .range(from, from + PAGE_SIZE - 1);
                    if (orderBy)
                        q = q.order(orderBy, { ascending: false });
                    return [4 /*yield*/, q];
                case 3:
                    _b = _c.sent(), data = _b.data, error = _b.error;
                    if (error)
                        return [2 /*return*/, { rows: rows, truncated: true, error: error.message }];
                    if (!(data === null || data === void 0 ? void 0 : data.length))
                        return [3 /*break*/, 4];
                    rows.push.apply(rows, data);
                    from += PAGE_SIZE;
                    return [3 /*break*/, 2];
                case 4: return [2 /*return*/, { rows: rows, truncated: rows.length !== totalExpected, error: null }];
            }
        });
    });
}
function gateOf(opts) {
    if (!opts.schemaOk)
        return 'A_SCHEMA';
    if (opts.ingestFailed && !opts.readyFactsPresent)
        return 'C_HOLD_INGEST';
    if (!opts.readyFactsPresent)
        return opts.emptyAllowed ? 'B_EMPTY' : 'C_HOLD_INGEST';
    return 'RWP';
}
function numOrNull(v) {
    return typeof v === 'number' ? v : null;
}
function strOrNull(v) {
    return typeof v === 'string' ? v : null;
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, dbClients, clientsError, clientsErrorMessage, byId2, _i, _b, c, id, knownIds, extraInDb, missingInDb, report, targets, _c, targets_1, target, client, tables, counts, _d, tables_1, table, _e, _f, sessions, failedSessions, pendingSessions, lastSession, snapshots, latestSnap, snapQuality, posts, postRows, postStats, confSum, audience, latestAudience, alertsOpen, rawUnparsed, expectedAvatar, schemaOk, ingestBlocked, screens, row, _g, _h, c, _j, missingInDb_1, _k, handle, id, _l, extraInDb_1, c;
        var _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
        return __generator(this, function (_13) {
            switch (_13.label) {
                case 0: return [4 /*yield*/, supabase
                        .schema('orbit')
                        .from('clients')
                        .select('id, handle, name, ig_username, instagram_user_id, health_status, avatar_expected_gender, avatar_expected_age_min, avatar_expected_age_max, avatar_expected_geo_primary, avatar_unconscious_desire')];
                case 1:
                    _a = _13.sent(), dbClients = _a.data, clientsError = _a.error;
                    clientsErrorMessage = (_m = clientsError === null || clientsError === void 0 ? void 0 : clientsError.message) !== null && _m !== void 0 ? _m : null;
                    if (clientsError) {
                        console.error('❌ schema/clients inacessível:', clientsError.message);
                        process.exit(1);
                    }
                    byId2 = new Map();
                    for (_i = 0, _b = (dbClients !== null && dbClients !== void 0 ? dbClients : []); _i < _b.length; _i++) {
                        c = _b[_i];
                        id = strOrNull(c.id);
                        if (id)
                            byId2.set(id, c);
                    }
                    knownIds = new Set(Object.values(KNOWN_CLIENTS));
                    extraInDb = (dbClients !== null && dbClients !== void 0 ? dbClients : []).filter(function (c) {
                        var id = c.id;
                        return typeof id === 'string' ? !knownIds.has(id) : true;
                    });
                    missingInDb = Object.entries(KNOWN_CLIENTS).filter(function (_a) {
                        var id = _a[1];
                        return !byId2.has(id);
                    });
                    report = {
                        timestamp: new Date().toISOString(),
                        protocol: 'OGP',
                        catalog: FACT_CATALOG,
                        universe: {
                            knownMap: Object.keys(KNOWN_CLIENTS).length,
                            dbClients: (dbClients !== null && dbClients !== void 0 ? dbClients : []).length,
                            extraInDb: extraInDb.map(function (c) { var _a; return ({ id: String(c.id), handle: (_a = strOrNull(c.handle)) !== null && _a !== void 0 ? _a : '' }); }),
                            missingInDb: missingInDb,
                        },
                        clients: [],
                    };
                    targets = __spreadArray(__spreadArray([], Object.entries(KNOWN_CLIENTS).map(function (_a) {
                        var handle = _a[0], id = _a[1];
                        return ({ handle: handle, id: id, from: 'map' });
                    }), true), extraInDb.map(function (c) {
                        var _a;
                        return ({
                            handle: (_a = strOrNull(c.handle)) !== null && _a !== void 0 ? _a : '',
                            id: String(c.id),
                            from: 'db',
                        });
                    }), true);
                    _c = 0, targets_1 = targets;
                    _13.label = 2;
                case 2:
                    if (!(_c < targets_1.length)) return [3 /*break*/, 14];
                    target = targets_1[_c];
                    client = (_o = byId2.get(target.id)) !== null && _o !== void 0 ? _o : null;
                    console.log("\n\u23F3 OGP ".concat(target.handle, " (").concat(target.id, ")"));
                    tables = [
                        'ig_account_snapshots',
                        'ig_posts',
                        'ig_audience_snapshots',
                        'avatar_alignment_snapshot',
                        'avatar_validations',
                        'alerts',
                        'funnel_data',
                        'client_onboarding',
                        'ig_import_sessions',
                        'raw_ig_ingest',
                    ];
                    counts = {};
                    _d = 0, tables_1 = tables;
                    _13.label = 3;
                case 3:
                    if (!(_d < tables_1.length)) return [3 /*break*/, 6];
                    table = tables_1[_d];
                    _e = counts;
                    _f = table;
                    return [4 /*yield*/, countExactAll(table, target.id)];
                case 4:
                    _e[_f] = _13.sent();
                    _13.label = 5;
                case 5:
                    _d++;
                    return [3 /*break*/, 3];
                case 6: return [4 /*yield*/, fetchAll('ig_import_sessions', 'id, status, export_period_start, export_period_end, files_missing, error_log, processed_at', target.id, 'created_at')];
                case 7:
                    sessions = _13.sent();
                    failedSessions = sessions.rows.filter(function (s) { return strOrNull(s.status) === 'failed'; }).length;
                    pendingSessions = sessions.rows.filter(function (s) {
                        var st = strOrNull(s.status);
                        return st === 'pending' || st === 'processing';
                    }).length;
                    lastSession = (_p = sessions.rows[0]) !== null && _p !== void 0 ? _p : null;
                    return [4 /*yield*/, fetchAll('ig_account_snapshots', 'id, period_start, period_end, followers_total, followers_confidence, reach_total, reach_confidence, profile_visits, link_clicks, er_real_pct', target.id, 'period_end')];
                case 8:
                    snapshots = _13.sent();
                    latestSnap = (_q = snapshots.rows[0]) !== null && _q !== void 0 ? _q : null;
                    snapQuality = {
                        total: snapshots.rows.length,
                        withoutFollowers: snapshots.rows.filter(function (s) { return s.followers_total == null; }).length,
                        followersL0: snapshots.rows.filter(function (s) { return strOrNull(s.followers_confidence) === 'L0'; }).length,
                    };
                    return [4 /*yield*/, fetchAll('ig_posts', 'id, reach, impressions, confidence_level, content_format', target.id)];
                case 9:
                    posts = _13.sent();
                    postRows = posts.rows;
                    postStats = {
                        total: postRows.length,
                        truncated: posts.truncated,
                        l0: postRows.filter(function (p) { return strOrNull(p.confidence_level) === 'L0'; }).length,
                        l1: postRows.filter(function (p) { return strOrNull(p.confidence_level) === 'L1'; }).length,
                        l2: postRows.filter(function (p) { return strOrNull(p.confidence_level) === 'L2'; }).length,
                        withReach: postRows.filter(function (p) { return p.reach != null; }).length,
                        inconsistent: postRows.filter(function (p) { return strOrNull(p.confidence_level) !== 'L0' && p.reach == null; }).length,
                        negative: postRows.filter(function (p) {
                            var reach = numOrNull(p.reach);
                            var impressions = numOrNull(p.impressions);
                            return (reach != null && reach < 0) || (impressions != null && impressions < 0);
                        }).length,
                    };
                    confSum = postStats.l0 + postStats.l1 + postStats.l2;
                    return [4 /*yield*/, fetchAll('ig_audience_snapshots', 'id, period_end, gender_female_pct, gender_male_pct, avatar_composite_score, confidence_level', target.id, 'period_end')];
                case 10:
                    audience = _13.sent();
                    latestAudience = (_r = audience.rows[0]) !== null && _r !== void 0 ? _r : null;
                    return [4 /*yield*/, countExactWhere('alerts', target.id, 'is_resolved', false)];
                case 11:
                    alertsOpen = _13.sent();
                    return [4 /*yield*/, countExactWhere('raw_ig_ingest', target.id, 'parsed', false)];
                case 12:
                    rawUnparsed = _13.sent();
                    expectedAvatar = client &&
                        client.avatar_expected_gender != null &&
                        client.avatar_expected_age_min != null &&
                        client.avatar_expected_age_max != null;
                    schemaOk = Object.values(counts).every(function (c) { return c.error == null; });
                    ingestBlocked = failedSessions > 0 || pendingSessions > 0 || ((_s = rawUnparsed.count) !== null && _s !== void 0 ? _s : 0) > 0;
                    screens = {
                        carteira: {
                            gate: gateOf({
                                schemaOk: schemaOk,
                                ingestFailed: false,
                                readyFactsPresent: Boolean(client),
                                emptyAllowed: false,
                            }),
                            reasons: [
                                client ? 'clients row existe' : 'clients row AUSENTE',
                                ((_u = (_t = counts.client_onboarding) === null || _t === void 0 ? void 0 : _t.count) !== null && _u !== void 0 ? _u : 0) > 0 ? 'onboarding presente' : 'onboarding ausente (B aceitável)',
                            ],
                        },
                        instagram: {
                            gate: gateOf({
                                schemaOk: schemaOk,
                                ingestFailed: ingestBlocked && snapshots.rows.length === 0,
                                readyFactsPresent: snapshots.rows.length > 0 && (latestSnap === null || latestSnap === void 0 ? void 0 : latestSnap.followers_total) != null,
                                emptyAllowed: false,
                            }),
                            reasons: [
                                "snapshots=".concat(snapQuality.total),
                                "posts=".concat(postStats.total, " reach=").concat(postStats.withReach),
                                latestSnap
                                    ? "\u00FAltimo per\u00EDodo ".concat((_v = strOrNull(latestSnap.period_start)) !== null && _v !== void 0 ? _v : '', "\u2192").concat((_w = strOrNull(latestSnap.period_end)) !== null && _w !== void 0 ? _w : '')
                                    : 'sem período',
                                lastSession ? "import ".concat((_x = strOrNull(lastSession.status)) !== null && _x !== void 0 ? _x : 'unknown') : 'sem import_session',
                            ],
                        },
                        avatar: {
                            gate: gateOf({
                                schemaOk: schemaOk,
                                ingestFailed: ingestBlocked && audience.rows.length === 0,
                                readyFactsPresent: Boolean(expectedAvatar && latestAudience),
                                emptyAllowed: false,
                            }),
                            reasons: [
                                expectedAvatar ? 'avatar esperado preenchido em clients' : 'avatar esperado INCOMPLETO em clients',
                                "audience_snapshots=".concat(audience.rows.length),
                                "alignment=".concat((_z = (_y = counts.avatar_alignment_snapshot) === null || _y === void 0 ? void 0 : _y.count) !== null && _z !== void 0 ? _z : 0),
                                "validations=".concat((_1 = (_0 = counts.avatar_validations) === null || _0 === void 0 ? void 0 : _0.count) !== null && _1 !== void 0 ? _1 : 0),
                            ],
                        },
                        alertas: {
                            gate: gateOf({
                                schemaOk: schemaOk,
                                ingestFailed: false,
                                readyFactsPresent: true,
                                emptyAllowed: true,
                            }),
                            reasons: ["alerts=".concat((_3 = (_2 = counts.alerts) === null || _2 === void 0 ? void 0 : _2.count) !== null && _3 !== void 0 ? _3 : 0), "abertos=".concat(alertsOpen.count)],
                        },
                        funil: {
                            gate: gateOf({
                                schemaOk: schemaOk,
                                ingestFailed: false,
                                readyFactsPresent: ((_5 = (_4 = counts.funnel_data) === null || _4 === void 0 ? void 0 : _4.count) !== null && _5 !== void 0 ? _5 : 0) > 0,
                                emptyAllowed: false,
                            }),
                            reasons: [
                                "funnel_data=".concat((_7 = (_6 = counts.funnel_data) === null || _6 === void 0 ? void 0 : _6.count) !== null && _7 !== void 0 ? _7 : 0),
                                (latestSnap === null || latestSnap === void 0 ? void 0 : latestSnap.profile_visits) != null ? 'snapshot tem profile_visits (origem derivável)' : 'snapshot sem profile_visits',
                            ],
                        },
                    };
                    row = {
                        handle: target.handle,
                        clientId: target.id,
                        source: target.from,
                        client: client,
                        counts: counts,
                        pipeline: {
                            sessions: sessions.rows.length,
                            failedSessions: failedSessions,
                            pendingSessions: pendingSessions,
                            lastSession: lastSession,
                            rawUnparsed: rawUnparsed.count,
                            rawError: rawUnparsed.error,
                        },
                        quality: {
                            snapshots: snapQuality,
                            latestSnap: latestSnap,
                            posts: Object.assign({}, posts, {
                                confidenceSumMismatch: confSum !== postStats.total,
                                total: postStats.total,
                            }),
                            latestAudience: latestAudience,
                        },
                        screens: screens,
                        errors: __spreadArray(__spreadArray([
                            clientsErrorMessage
                        ], Object.entries(counts)
                            .filter(function (_a) {
                            var v = _a[1];
                            return v.error;
                        })
                            .map(function (_a) {
                            var t = _a[0], v = _a[1];
                            return "".concat(t, ": ").concat(v.error);
                        }), true), [
                            (_8 = sessions.error) !== null && _8 !== void 0 ? _8 : null,
                            (_9 = snapshots.error) !== null && _9 !== void 0 ? _9 : null,
                            (_10 = posts.error) !== null && _10 !== void 0 ? _10 : null,
                            (_11 = audience.error) !== null && _11 !== void 0 ? _11 : null,
                        ], false).filter(function (x) { return typeof x === 'string' && x.length > 0; }),
                    };
                    report.clients.push(row);
                    _13.label = 13;
                case 13:
                    _c++;
                    return [3 /*break*/, 2];
                case 14:
                    console.log('\n\n═══════════════════════════════════════════════════════════════════');
                    console.log('OGP — GATES POR TELA (começar no banco)');
                    console.log('═══════════════════════════════════════════════════════════════════');
                    console.log("".concat('cliente'.padEnd(20), " ").concat('carteira'.padEnd(14), " ").concat('instagram'.padEnd(14), " ").concat('avatar'.padEnd(14), " ").concat('alertas'.padEnd(14), " ").concat('funil'));
                    for (_g = 0, _h = report.clients; _g < _h.length; _g++) {
                        c = _h[_g];
                        console.log("".concat(String(c.handle).padEnd(20), " ").concat(c.screens.carteira.gate.padEnd(14), " ").concat(c.screens.instagram.gate.padEnd(14), " ").concat(c.screens.avatar.gate.padEnd(14), " ").concat(c.screens.alertas.gate.padEnd(14), " ").concat(c.screens.funil.gate));
                    }
                    if (missingInDb.length) {
                        console.log('\n🔴 no mapa KNOWN_CLIENTS e ausentes em orbit.clients:');
                        for (_j = 0, missingInDb_1 = missingInDb; _j < missingInDb_1.length; _j++) {
                            _k = missingInDb_1[_j], handle = _k[0], id = _k[1];
                            console.log("   ".concat(handle, " ").concat(id));
                        }
                    }
                    if (extraInDb.length) {
                        console.log('\n⚠️  no banco e fora do mapa KNOWN_CLIENTS:');
                        for (_l = 0, extraInDb_1 = extraInDb; _l < extraInDb_1.length; _l++) {
                            c = extraInDb_1[_l];
                            console.log("   ".concat(String((_12 = c.handle) !== null && _12 !== void 0 ? _12 : ''), " ").concat(String(c.id)));
                        }
                    }
                    node_fs_1.default.writeFileSync('ogp-report.json', JSON.stringify(report, null, 2));
                    console.log('\n✅ ogp-report.json gravado');
                    console.log('Leitura do gate: RWP = pode ligar page | B_EMPTY = page só com empty state | C_HOLD_INGEST = não ligue L4 | A_SCHEMA = tabela/acesso quebrado');
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('❌', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
