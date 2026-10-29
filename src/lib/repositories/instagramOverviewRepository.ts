/* ==========================================================================
   ORBIT · Repository — Instagram Overview (v4.3.3)

   v4.3.3 (remove fallbacks legados mortos, 01/09/2026):
   - v_kpi_snapshots, v_quality_scores, v_format_performance só existem no
     schema orbit — nunca existiram no projeto legado (supabaseLegacy). Os
     fallbacks que tentavam repetir a MESMA query contra supabaseLegacy
     eram código morto: nunca poderiam funcionar, porque essas views nunca
     existiram lá. Removidos. Se a query em orbit falhar, a função degrada
     para lista vazia — não tenta de novo contra um client que
     estruturalmente não tem a view.
   - CONFIDENCE_LEVELS agora com `as const` — sem isso, o TS infere
     `string[]` (tipo largo) e `.in('confidence_level', CONFIDENCE_LEVELS)`
     rejeita porque a coluna espera o enum literal ('L0'|'L1'|'L2').
   - `import { any, z } from 'zod'` corrigido para `import { z } from 'zod'`
     — `any` não é um export de zod, sobrou de edição manual anterior.
   - fetchPostsByFormat exportado diretamente na declaração, em vez de um
     `export { fetchPostsByFormat }` solto no fim do arquivo — elimina o
     erro de "definição circular do alias de importação" causado por chaves
     desalinhadas em edições anteriores.
   - insights volta a usar generateInsights(formatPerformance) em vez de
     array vazio hardcoded.

   v4.3.2 (correção de type safety — .overrideTypes() com merge: false, 01/09/2026):
   - 6 ocorrências de `.overrideTypes<T>()` trocadas por
     `.overrideTypes<T, { merge: false }>()` — resolve TS2322 causado pelo
     merge automático de tipos quando usado com `.maybeSingle()/.single()`.

   v4.3.1 (fechamento de dívida — .returns() → .overrideTypes(), 31/08/2026):
   - 6 ocorrências de `.maybeSingle()/.single().returns<T>()` trocadas por
     `.overrideTypes<T>()`. `PostRowRaw` (type derivado) removido — não
     usado em lugar nenhum do arquivo.

   v4.3.0 (reconciliação category/tier — 31/08/2026):
   - Novo fetchClientOnboarding(): busca a linha completa de
     orbit.client_onboarding do cliente — SSOT único pra setor/nicho/porte/
     audiência.
   - Novo fetchSectorPositioning(): monta SectorPositioning combinando
     client_onboarding + fetchLatestEngagementScoreSnapshot (reaproveitado)
     + classifyMetric() com category/tier resolvidos via
     mapSegmentToCategory/mapFollowersToTier (contentContractEngine.ts).
   - fetchCriticalAlerts agora resolve category/tier do onboarding e passa
     pra resolveEngagementScoreAlert, em vez de classificar sempre no
     fallback global.

   v4.2.0 (fechamento de dívidas — 26/08/2026):
   - criticalAlerts deixa de ser hardcoded []: chama
     fetchLatestEngagementScoreSnapshot() → resolveEngagementScoreAlert()
     (CASO G) → toCriticalAlert().
   - fetchLatestEngagementScoreSnapshot: vps_pct deixou de ler a coluna
     GERADA de ig_account_snapshots (depende de followers_total, sempre
     NULL por bloqueio deliberado em extract-demographics.ts/
     ingest-insights.ts). Passa a computar vps_pct = reach_total /
     client_onboarding.total_followers * 100 — mesma fórmula que
     orbit.v_quality_scores já usa. Classificação continua 100% em
     fn_classify_metric via classifyMetric().
   - Novo fetchSharesSummary(): shares real agregado por conta/período,
     nunca distribuído por post (ig_posts.shares é null até ORB-DEBT-043
     ser fechado).
   - Novo fetchAudienceSummary(): gênero/cidades + alcance por seguidor/
     visitas/cliques, agregados por conta/período, pega o snapshot mais
     recente do período (nunca soma múltiplas linhas). Idade fica de fora
     até o hardcode-zero de ingestão ser corrigido em outro arquivo.
   - Novo fetchPostsByFormat(): agrupa posts por formato, conectado a
     fetchFormatPerformance via postsDetail. Filtra confidence_level
     ['L0','L1'] pra evitar divergência de contagem entre card e lista.

   v4.1.0 (Sprint 2 — REFATORADO):
   - Migrado para schema orbit.*. Header handle via .select('handle')
     (instagram_account_id não existe no orbit).
   ========================================================================== */

import { supabase } from "@/lib/supabase";
import { repairMojibake } from "@/lib/textRepair";
import { polemicMedianOfPeriod } from "@/lib/stats/polemic";
import { periodUpperExclusive } from "@/lib/stats/period";
import { computeFormatTrend, trendCopy } from "@/lib/stats/formatTrend";
import { z } from "zod";

import type {
  IGOverviewData,
  DashboardHeaderMeta,
  KPICardData,
  MetricProvenance,
  FormatPerformanceRow,
  QualityScoreItem,
  InsightData,
  SemaphoreColor,
  GlowColor,
  CriticalAlertData,
  SharesSummary,
  PostSummary,
  AudienceSummary,
  ClientOnboarding,
  OnboardingGenderExpectation,
  SectorPositioning,
  CommentReferenceItem,
  AlgoRiskScore,
  ConfidenceLevel,
} from "@/types/orbit";

import {
  buildScoreCopy,
  VALIDATION_NOTE,
  type SemaphoreKey,
} from "@/lib/scoreStatusCopy";
// FIX (reforma do vocabulário de cor): substitui o dicionário local
// SEMAPHORE_UI e o `as GlowColor` por validadores centralizados em orbit.ts.
import { SEMAPHORE_TO_GLOW, toSemaphoreColor } from "@/types/orbit";
import {
  commentTextStateNote,
  percentilePosition,
  postsComComentario,
  postsComComentarioText,
  refNullReason,
  respostaDaBaseMedian,
  viewsPorSeguidorMedian,
} from "@/lib/stats/commentReference";
import {
  resolveEngagementScoreAlert,
  resolveAlgoRiskScoreAlert,
  toCriticalAlert,
  mapSegmentToCategory,
  mapFollowersToTier,
  classifyMetric,
  computeAlgoRiskScore,
  computePostingCadence,
  computeFormatMix,
} from "./contentContractEngine";
import { buildFormatInsights } from "@/lib/formatInsights";
import {
  buildDataStatusNotices,
  type ClientDataFacts,
} from "@/lib/dataStatusCopy";
import {
  isKpiValueMissing,
  kpiDisplayFor,
  kpiHasComparison,
} from "@/lib/kpiDisplay";
import {
  aggregatePostImpressions,
  type PostImpressionsRow,
} from "@/lib/impressionsKpi";

type RawRow = Record<string, unknown>;

// ── Constantes de configuração ──────────────────────────────────────────

const KPI_METRIC_KEYS = [
  "alcance-90d",
  "seguidores-totais",
  "saldo-90-dias",
  "cliques-no-link",
];

// ✅ 09/09 — REGRESSÃO CORRIGIDA: 'cliques-no-link' tinha sido removido de
// KPI_METRIC_KEYS (fora do .in() da query, a linha nunca voltava do banco)
// e KPI_ORDER (ordenação canônica) tinha desaparecido junto, voltando a
// ordenar por calculated_at desc. Resultado: o 4º KPICard do Overview
// ("Cliques no link") não aparecia mais, mesmo com dado real em
// orbit.v_kpi_snapshots. Ver CHANGELOG_08-09-2026_paridade-protótipo.md,
// item 4 — este era o comportamento correto documentado lá.
const KPI_ORDER = [
  "seguidores-totais",
  "saldo-90-dias",
  "alcance-90d",
  "cliques-no-link",
];

// Rótulo e proveniência (fonte, período, método — RN-23) dos KPIs vivem em
// lib/kpiDisplay.ts (kpiDisplayFor), junto das regras de "dado ausente". Nota sobre o
// saldo: "saldo-90-dias" é só a CHAVE no banco; a definição real está no texto de
// proveniência de lá e não é a mesma medida de v_client_metrics.follower_balance.

const FORMAT_LABEL: Record<string, string> = {
  reel: "Reels",
  static_post: "Estático",
  carousel: "Carrossel",
  story: "Stories",
  live: "Live",
  igtv: "IGTV",
};

const CONFIDENCE_LEVELS = ["L0", "L1"] as const;

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

// ── Schemas (validação de dados do banco) ───────────────────────────────

const KpiRowSchema = z
  .object({
    id: z.string(),
    client_id: z.string(),
    period_start: z.string().optional(),
    period_end: z.string().optional(),
    metric_key: z.string().optional(),
    metric: z.string().optional(),
    metric_value: z.union([z.number(), z.string()]).nullable().optional(),
    value: z.union([z.number(), z.string()]).nullable().optional(),
    delta_pct: z
      .union([z.number(), z.string()])
      .nullable()
      .optional()
      .default(0),
    semaphore: z
      .enum(["verde", "ambar", "vermelho"])
      .nullable()
      .optional()
      .default("ambar"),
    subtitle: z.string().nullable().optional().default(null),
    calculated_at: z.string().optional(),
    // FIX (19/09/2026): coluna existe em orbit.v_kpi_snapshots desde sempre
    // (confirmado no banco: seguidores-totais = L0, alcance-90d/cliques-no-link
    // = L1 pro cpimportstore) mas nunca tinha sido lida — kpiRowToCardData()
    // não populava `sourceLevel`, e o card caía no fallback (ver KPICard.tsx).
    confidence_level: z.enum(["L0", "L1", "L2"]).nullable().optional(),
  })
  .refine((data) => data.metric_key || data.metric, {
    message: "Deve ter 'metric_key' ou 'metric'",
  });

type KpiRow = z.infer<typeof KpiRowSchema>;

const PostRowRawSchema = z.object({
  id: z.string(),
  content_format: z.string(),
  published_at: z.string(),
  likes: z.number().nullable(),
  comments: z.number().nullable(),
  caption: z.string().nullable(),
  polemic_score_pct: z.number().nullable(),
  is_boost_candidate: z.boolean().nullable(),
  // ✅ NOVO (2026-09-18): play_to_view_ratio — calculado no banco para Reels.
  // Ausente em posts não-Reel; a coluna pode não existir em rows antigas →
  // optional().nullable() para não rejeitar snapshots sem a coluna.
  play_to_view_ratio: z.number().optional().nullable(),
});

// ✅ 09/09 — cópia local duplicada removida; usa repairMojibake de
// @/lib/textRepair (mesma função, um único lugar, cobre caption/
// top_cities/real_geo). Ver TICKETS DE CORREÇÃO item 3.

// ── Mapas de transformação ──────────────────────────────────────────────

const GLOW_MAP: Record<SemaphoreColor, GlowColor> = {
  verde: "cyan",
  ambar: "gold",
  vermelho: "red",
  // ✅ NOVO (PR-A): 'neutro' vem de ClassifiedMetric (contentContractEngine.ts),
  // não da view v_kpi_snapshots — mas o Record exige as 4 chaves de
  // SemaphoreColor agora. KPICardData.semaphore hoje só vem do banco
  // ('verde'|'ambar'|'vermelho'); este ramo existe só pra satisfazer o tipo.
  neutro: "none",
};

type PostingProfileRow = {
  published_at: string;
  content_format: string | null;
  created_at: string | null;
  import_session: string | null;
};

// Data de coleta da conta = a mais recente entre os posts, usando o processed_at
// da sessão de import concluída (status 'done') e, na falta dela, o created_at
// do post. É a MESMA âncora da view v_benchmark_cadence_by_segment: a recência
// ("último post N dias antes da coleta") não pode ser medida até hoje, porque o
// dado só fala até o momento em que foi coletado.
async function fetchCollectedAt(
  clientId: string,
  rows: PostingProfileRow[],
): Promise<string | null> {
  const hasSessions = rows.some((r) => r.import_session);
  const processedBySession = new Map<string, string>();

  if (hasSessions) {
    const { data, error } = await supabase
      .schema("orbit")
      .schema("orbit")
      .from("ig_import_sessions")
      .select("id, processed_at")
      .eq("client_id", clientId)
      .eq("status", "done")
      .returns<{ id: string; processed_at: string | null }[]>();

    if (error) {
      // Não derruba o painel: sem sessão, cai no created_at dos posts.
      console.error("[fetchCollectedAt]", error.message);
    } else {
      for (const s of data ?? []) {
        if (s.processed_at) processedBySession.set(s.id, s.processed_at);
      }
    }
  }

  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    const fromSession = r.import_session
      ? processedBySession.get(r.import_session)
      : undefined;
    const candidate = fromSession ?? r.created_at;
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
      latest = candidate;
    }
  }
  return latest;
}

async function fetchPostingProfile(
  clientId: string,
  start: string,
  end: string,
) {
  const { data, error } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("ig_posts")
    .select("published_at, content_format, created_at, import_session")
    .neq("content_format", "story")
    .eq("client_id", clientId)
    .gte("published_at", start)
    .lt("published_at", periodUpperExclusive(end))
    .in("confidence_level", CONFIDENCE_LEVELS)
    .returns<PostingProfileRow[]>();

  if (error) throw new Error(`[fetchPostingProfile] ${error.message}`);

  const rows = data ?? [];
  const collectedAt = await fetchCollectedAt(clientId, rows);
  return {
    cadence: computePostingCadence(
      rows.map((r) => r.published_at),
      start,
      end,
      collectedAt,
    ),
    mix: computeFormatMix(rows.map((r) => r.content_format)),
  };
}

// ── Funções de transformação ────────────────────────────────────────────

export function kpiRowToCardData(row: KpiRow): KPICardData {
  const key = row.metric_key ?? row.metric ?? "unknown";
  // Sem `?? 0`: nulo não pode virar o número 0 (RN-22d). `valueMissing` faz o
  // card mostrar "—" em vez de "0" (ver kpiDisplay.isKpiValueMissing).
  const rawVal = row.metric_value ?? row.value;
  const valueMissing = isKpiValueMissing(key, rawVal);
  const numVal = valueMissing ? 0 : toFiniteNumber(rawVal);
  const delta = toFiniteNumber(row.delta_pct);
  const semaphore: SemaphoreColor =
    (row.semaphore as SemaphoreColor) ?? "ambar";
  const display = kpiDisplayFor(key, {
    start: row.period_start,
    end: row.period_end,
  });

  return {
    id: row.id,
    label: display?.label ?? key.toUpperCase().replace(/-/g, " "),
    value: numVal,
    ...(valueMissing ? { valueMissing: true } : {}),
    ...(key === "seguidores-totais" ? { valueFormat: "integer" as const } : {}),
    unit: null,
    delta,
    // PR-B / N11 ("Δ 0% 0%"): `delta` já é renderizado por <DeltaText> como
    // seta + percentual (ex.: "↑ 3.1%"). Este `deltaLabel` é o SUBLABEL ao
    // lado, não um segundo valor — interpolar o mesmo % de novo duplicava o
    // número (e no caso delta=0 duplicava literalmente "0% 0%"). Texto fixo
    // de comparação, sem repetir o dado.
    deltaLabel: "vs período anterior",
    semaphore,
    glowColor: GLOW_MAP[semaphore],
    subtitle: row.subtitle ?? null,
    // FIX (19/09/2026): campo existia em KPICardData (orbit.ts:506) e nunca
    // era preenchido aqui — todo card caía no fallback de KPI.tsx/IGOverview,
    // mostrando "Hipótese" (ou antes, "Medido" por acidente) pra dado que o
    // banco já classifica corretamente. `?? undefined`, não `?? 'L2'`: null
    // aqui é "a view não calculou confiança pra essa linha", que é um caso
    // genuinamente diferente de "calculou e é baixa confiança" — não
    // inventar um nível que o dado não afirma.
    sourceLevel: row.confidence_level ?? undefined,
    ...(display ? { provenance: display.provenance } : {}),
    // toFiniteNumber(null) vira 0: sem este flag um delta nulo aparecia como
    // "0,0%". Nulo = sem comparação (SSOT v1.5, Seção 9). Também sem comparação:
    // valor ausente e saldo 0 com delta 0 (0÷0) — ver kpiDisplay.kpiHasComparison.
    ...(kpiHasComparison(key, numVal, row.delta_pct, valueMissing)
      ? {}
      : { hasComparison: false }),
  };
}

function dedupeByMetric(rows: KpiRow[]): KpiRow[] {
  const latestByMetric = new Map<string, KpiRow>();
  for (const row of rows) {
    const key = row.metric_key ?? row.metric ?? "unknown";
    const existing = latestByMetric.get(key);
    if (!existing) {
      latestByMetric.set(key, row);
      continue;
    }
    const existingTs = existing.calculated_at
      ? Date.parse(existing.calculated_at)
      : 0;
    const currentTs = row.calculated_at ? Date.parse(row.calculated_at) : 0;
    if (currentTs > existingTs) latestByMetric.set(key, row);
  }
  return Array.from(latestByMetric.values());
}

// Ordena pela ordem canônica do protótipo (KPI_ORDER), não pela ordem de
// chegada do banco — sem isso os cards embaralham a cada snapshot novo
// porque a query vem ordenada por calculated_at desc.
function sortByCanonicalOrder(rows: KpiRow[]): KpiRow[] {
  return [...rows].sort((a, b) => {
    const keyA = a.metric_key ?? a.metric ?? "unknown";
    const keyB = b.metric_key ?? b.metric ?? "unknown";
    const idxA = KPI_ORDER.indexOf(keyA);
    const idxB = KPI_ORDER.indexOf(keyB);
    return (
      (idxA === -1 ? KPI_ORDER.length : idxA) -
      (idxB === -1 ? KPI_ORDER.length : idxB)
    );
  });
}

// ── Interfaces públicas ─────────────────────────────────────────────────

export interface FetchOverviewParams {
  clientId: string;
  periodStart: string;
  periodEnd: string;
}

export interface EngagementScoreSnapshot {
  snapshotId: string;
  erRealPct: number;
  // KCR-C5/RWP-1: tile Utilidade fora do Overview e utility_score_pct sem
  // régua. Ausência de utilidade não derruba mais ER Real e Polêmica.
  utilityScorePct: number | null;
  // SSC-1: mediana por post no período (fetchPolemicMedianInPeriod), não a
  // coluna do snapshot. null = nenhum post do período com polemic_score_pct;
  // não derruba ER Real/VPS (mesma regra da utilidade).
  polemicScorePct: number | null;
  // ✅ FIX (15/09/2026): `number | null` — ver comentário em
  // EngagementScoreInput (contentContractEngine.ts). Reach_followers_pct
  // não ingerido (ORB-DEBT-034) é um estado real, não um erro que deva
  // derrubar o snapshot inteiro.
  vpsPct: number | null;
}

interface EngagementScoreSnapshotRow {
  id: string;
  er_real_pct: number | null;
  utility_score_pct: number | null;
  reach_total: number | null;
  // ✅ FIX (v8.2 §1.4 — VPS C-02): faltava essa coluna. Sem ela o cálculo
  // caía pra reach_total/totalFollowers puro (ver comentário no v4.2.0
  // acima) — é literalmente a métrica errada, "reach/followers", que o
  // doc chama de "outra variável" e que dá 111% (1985/1785) em vez do
  // VPS C-02 real (~7,2%).
  reach_followers_pct: number | null;
  period_end: string;
}

// ── Função principal (orquestrador) ─────────────────────────────────────

export async function fetchInstagramOverview(
  params: FetchOverviewParams,
): Promise<IGOverviewData> {
  const { clientId, periodStart, periodEnd } = params;

  const results = await Promise.allSettled([
    fetchKPIs(clientId, periodStart, periodEnd),
    fetchQualityScores(clientId, periodStart, periodEnd),
    fetchFormatPerformance(clientId, periodStart, periodEnd),
    fetchSharesSummary(clientId, periodStart, periodEnd),
    fetchAudienceSummary(clientId, periodStart, periodEnd),
    fetchCriticalAlerts(clientId, periodStart, periodEnd),
    fetchSectorPositioning(clientId, periodStart, periodEnd),
    fetchPostingProfile(clientId, periodStart, periodEnd),
    fetchOnboardingExpectations(clientId),
    fetchAccountImpressionsKpi(clientId),
    fetchPostImpressionsKpi(clientId, periodStart, periodEnd),
    fetchDataStatusNotices(clientId, periodStart, periodEnd),
  ]);

  results.forEach((res, idx) => {
    if (res.status === "rejected") {
      console.error(`[Repository] Query[${idx}] rejeitada:`, res.reason);
    }
  });

  const accountImpressionsKpi =
    results[9].status === "fulfilled"
      ? results[9].value
      : impressionsKpiData("impressions-account", null);
  const postImpressionsKpi =
    results[10].status === "fulfilled"
      ? results[10].value
      : impressionsKpiData("impressions-posts", null);
  const dataStatusNotices =
    results[11].status === "fulfilled" ? results[11].value : [];
  const kpis = [
    ...(results[0].status === "fulfilled" ? results[0].value : []),
    accountImpressionsKpi,
    postImpressionsKpi,
  ];
  const qualityScores =
    results[1].status === "fulfilled" ? results[1].value : [];
  const formatPerformance =
    results[2].status === "fulfilled" ? results[2].value : [];
  const sharesSummary: SharesSummary =
    results[3].status === "fulfilled"
      ? results[3].value
      : {
          total: null,
          periodLabel: "erro ao buscar",
          source: "account_aggregate",
        };
  const audienceSummary: AudienceSummary =
    results[4].status === "fulfilled"
      ? results[4].value
      : {
          genderFemalePct: null,
          genderMalePct: null,
          genderOtherPct: null,
          topCities: [],
          reachFollowersPct: null,
          profileVisits: null,
          linkClicks: null,
          periodLabel: "erro ao buscar",
        };
  const criticalAlerts: CriticalAlertData[] =
    results[5].status === "fulfilled" ? results[5].value : [];
  const positioning: SectorPositioning | null =
    results[6].status === "fulfilled" ? results[6].value : null;

  const postingProfile =
    results[7].status === "fulfilled" ? results[7].value : null;

  const onboarding: OnboardingGenderExpectation | null =
    results[8].status === "fulfilled" ? results[8].value : null;

  // ✅ FIX (tsc TS2339): `import.meta.env.VITE_*` é Vite — sobrou de antes
  // da migração pra Next.js, onde env var de cliente é `process.env.NEXT_PUBLIC_*`
  // (mesma convenção já usada em src/lib/supabase.ts). `import.meta.env`
  // nem existe no runtime Next/Node, então isso não rodava de verdade —
  // só quebrava o build. Não logar a key nem truncada: é debug de URL, o
  // valor da key não ajuda a diagnosticar client_id e não devia ir pro
  // console de qualquer forma.
  console.log("[fetchInstagramOverview] Iniciando busca de cliente:", {
    clientId,
    clientIdTrimmed: clientId?.trim(),
    clientIdLength: clientId?.length,
    clientIdType: typeof clientId,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const normalizedClientId = clientId?.trim();
  const { data: clientRow, error: clientError } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("clients")
    .select("handle, benchmark_category, segment")
    .eq("id", normalizedClientId)
    .maybeSingle()
    .overrideTypes<
      {
        handle: string | null;
        benchmark_category: string | null;
        segment: string | null;
      },
      { merge: false }
    >();

  // ✅ LOG DETALHADO DO RESULTADO
  console.log("[fetchInstagramOverview] Resultado da query:", {
    clientId: normalizedClientId,
    dataReceived: clientRow,
    errorCode: clientError?.code,
    errorMessage: clientError?.message,
    errorDetails: clientError?.details,
    errorHint: clientError?.hint,
  });

  if (clientError) {
    console.error("[Repository] Erro ao buscar cliente:", {
      code: clientError.code,
      message: clientError.message,
      details: clientError.details,
      hint: clientError.hint,
      clientId: normalizedClientId,
    });
  }

  const handle = clientRow?.handle ?? normalizedClientId; // ← ÚNICA DEFINIÇÃO

  // Mesma precedência da view v_benchmark_cadence_by_segment:
  // benchmark_category → setor do onboarding → segment.
  const benchmarkCategory =
    clientRow?.benchmark_category?.trim() ||
    positioning?.setorBenchmark?.trim() ||
    clientRow?.segment?.trim() ||
    null;

  const benchmarkCadence = await fetchBenchmarkCadence(benchmarkCategory);

  const meta: DashboardHeaderMeta = {
    clientHandle: `@${handle}`,
    periodLabel: "Métricas da Extração",
    dateRange: {
      start: new Date(periodStart),
      end: new Date(periodEnd),
    },
  };

  return {
    meta,
    clients: [],
    kpis,
    qualityScores,
    formatPerformance,
    sharesSummary,
    audienceSummary,
    insights: generateInsights(formatPerformance),
    criticalAlerts,
    positioning: positioning as SectorPositioning,
    cadence: postingProfile?.cadence ?? null,
    mix: postingProfile?.mix ?? null,
    benchmarkCadence,
    onboarding,
    dataStatusNotices,
  };
}

type BenchmarkCadenceRow = {
  segment_category: string;
  content_format: string;
  period_start: string;
  period_end: string;
  window_days: number | string;
  benchmark_accounts_total: number | string;
  accounts_with_posts: number | string;
  posts_total: number | string;
  mean_posts_per_day: number | string | null;
  median_posts_per_day: number | string | null;
  p25_posts_per_day: number | string | null;
  p75_posts_per_day: number | string | null;
  eligible_accounts: number | string | null;
  recent_accounts: number | string | null;
  recency_threshold_days: number | string | null;
  mean_posts_per_week: number | string | null;
  median_posts_per_week: number | string | null;
  p25_posts_per_week: number | string | null;
  p75_posts_per_week: number | string | null;
  median_posts_per_week_recent: number | string | null;
  p25_posts_per_week_recent: number | string | null;
  p75_posts_per_week_recent: number | string | null;
  median_days_last_post_to_collection: number | string | null;
};

type BenchmarkCadence = {
  segmentCategory: string;
  periodStart: string;
  periodEnd: string;
  windowDays: number;
  benchmarkAccountsTotal: number;
  accountsWithPosts: number;
  postsTotal: number;
  meanPostsPerDay: number;
  medianPostsPerDay: number;
  p25PostsPerDay: number;
  p75PostsPerDay: number;
  // Cadência no span ativo (posts/semana) — mesma régua da conta. Só contas
  // elegíveis (>= 5 posts e >= 28 dias entre primeiro e último post).
  eligibleAccounts: number;
  recentAccounts: number;
  recencyThresholdDays: number;
  meanPostsPerWeek: number;
  medianPostsPerWeek: number;
  p25PostsPerWeek: number;
  p75PostsPerWeek: number;
  // Coorte recente (último post até recencyThresholdDays da coleta da conta).
  // null = coorte vazia; nunca vira 0.
  medianPostsPerWeekRecent: number | null;
  p25PostsPerWeekRecent: number | null;
  p75PostsPerWeekRecent: number | null;
  medianDaysLastPostToCollection: number | null;
};

// Referência de cadência do segmento (período fixo da view, não o período
// selecionado no dashboard). Nunca converte dado ausente em 0: se qualquer
// estatística vier nula, a referência inteira é descartada.
async function fetchBenchmarkCadence(
  category: string | null,
): Promise<BenchmarkCadence | null> {
  const normalizedCategory = category?.trim().toLowerCase();
  if (!normalizedCategory) return null;

  const { data, error } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("v_benchmark_cadence_by_segment")
    .select(
      "segment_category, content_format, period_start, period_end, window_days, benchmark_accounts_total, accounts_with_posts, posts_total, mean_posts_per_day, median_posts_per_day, p25_posts_per_day, p75_posts_per_day, " +
        "eligible_accounts, recent_accounts, recency_threshold_days, mean_posts_per_week, median_posts_per_week, p25_posts_per_week, p75_posts_per_week, " +
        "median_posts_per_week_recent, p25_posts_per_week_recent, p75_posts_per_week_recent, median_days_last_post_to_collection",
    )
    .eq("segment_category", normalizedCategory)
    .eq("content_format", "all")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<BenchmarkCadenceRow, { merge: false }>();

  if (error || !data) {
    if (error) console.error("[fetchBenchmarkCadence]", error.message);
    return null;
  }

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const windowDays = num(data.window_days);
  const benchmarkAccountsTotal = num(data.benchmark_accounts_total);
  const accountsWithPosts = num(data.accounts_with_posts);
  const postsTotal = num(data.posts_total);
  const meanPostsPerDay = num(data.mean_posts_per_day);
  const medianPostsPerDay = num(data.median_posts_per_day);
  const p25PostsPerDay = num(data.p25_posts_per_day);
  const p75PostsPerDay = num(data.p75_posts_per_day);
  const eligibleAccounts = num(data.eligible_accounts);
  const recentAccounts = num(data.recent_accounts);
  const recencyThresholdDays = num(data.recency_threshold_days);
  const meanPostsPerWeek = num(data.mean_posts_per_week);
  const medianPostsPerWeek = num(data.median_posts_per_week);
  const p25PostsPerWeek = num(data.p25_posts_per_week);
  const p75PostsPerWeek = num(data.p75_posts_per_week);

  if (
    windowDays === null ||
    benchmarkAccountsTotal === null ||
    accountsWithPosts === null ||
    postsTotal === null ||
    meanPostsPerDay === null ||
    medianPostsPerDay === null ||
    p25PostsPerDay === null ||
    p75PostsPerDay === null ||
    eligibleAccounts === null ||
    recentAccounts === null ||
    recencyThresholdDays === null ||
    meanPostsPerWeek === null ||
    medianPostsPerWeek === null ||
    p25PostsPerWeek === null ||
    p75PostsPerWeek === null
  ) {
    return null;
  }

  return {
    segmentCategory: data.segment_category,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    windowDays,
    benchmarkAccountsTotal,
    accountsWithPosts,
    postsTotal,
    meanPostsPerDay,
    medianPostsPerDay,
    p25PostsPerDay,
    p75PostsPerDay,
    eligibleAccounts,
    recentAccounts,
    recencyThresholdDays,
    meanPostsPerWeek,
    medianPostsPerWeek,
    p25PostsPerWeek,
    p75PostsPerWeek,
    medianPostsPerWeekRecent: num(data.median_posts_per_week_recent),
    p25PostsPerWeekRecent: num(data.p25_posts_per_week_recent),
    p75PostsPerWeekRecent: num(data.p75_posts_per_week_recent),
    medianDaysLastPostToCollection: num(
      data.median_days_last_post_to_collection,
    ),
  };
}
// ── Funções de busca (queries ao banco) ──────────────────────────────────

async function fetchKPIs(
  clientId: string,
  start: string,
  end: string,
): Promise<KPICardData[]> {
  const { data: orbitData, error: orbitError } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("v_kpi_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .lte("period_start", end)
    .gte("period_end", start)
    .in("metric_key", KPI_METRIC_KEYS)
    .order("calculated_at", { ascending: false })
    .returns<RawRow[]>();

  if (orbitError) {
    console.warn(
      `[fetchKPIs] orbit.v_kpi_snapshots indisponível (${orbitError.message}).`,
    );
    return [];
  }

  if (!orbitData) return [];

  const parsedRows = orbitData
    .map((row) => {
      const parsed = KpiRowSchema.safeParse(row);
      return parsed.success ? parsed.data : null;
    })
    .filter((item): item is KpiRow => item !== null);

  return sortByCanonicalOrder(dedupeByMetric(parsedRows)).map(kpiRowToCardData);
}

interface AccountImpressionsSnapshotRow {
  impressions_total: number | null;
  impressions_confidence: ConfidenceLevel;
  period_start: string;
  period_end: string;
}

function impressionsKpiData(
  key: "impressions-account" | "impressions-posts",
  rawValue: number | null,
  sourceLevel?: ConfidenceLevel,
  period?: { start?: string | null; end?: string | null },
): KPICardData {
  const valueMissing = isKpiValueMissing(key, rawValue);
  const display = kpiDisplayFor(key, period);

  return {
    id: key,
    label: display?.label ?? key.toUpperCase().replace(/-/g, " "),
    value: valueMissing ? 0 : toFiniteNumber(rawValue),
    valueFormat: "integer",
    unit: null,
    delta: 0,
    deltaLabel: "comparação indisponível",
    semaphore: "neutro",
    glowColor: "none",
    subtitle: null,
    ...(!valueMissing && sourceLevel ? { sourceLevel } : {}),
    ...(display ? { provenance: display.provenance } : {}),
    hasComparison: false,
    ...(valueMissing ? { valueMissing: true } : {}),
  };
}

async function fetchAccountImpressionsKpi(
  clientId: string,
): Promise<KPICardData> {
  const { data, error } = await supabase
    .schema("orbit")
    .from("ig_account_snapshots")
    .select(
      "impressions_total, impressions_confidence, period_start, period_end",
    )
    .eq("client_id", clientId)
    .not("impressions_total", "is", null)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<AccountImpressionsSnapshotRow, { merge: false }>();

  if (error) {
    console.error("[fetchAccountImpressionsKpi]", error.message);
    return impressionsKpiData("impressions-account", null);
  }

  return impressionsKpiData(
    "impressions-account",
    data?.impressions_total ?? null,
    data?.impressions_confidence,
    data ? { start: data.period_start, end: data.period_end } : undefined,
  );
}

async function fetchPostImpressionsKpi(
  clientId: string,
  start: string,
  end: string,
): Promise<KPICardData> {
  const { data, error } = await supabase
    .schema("orbit")
    .from("ig_posts")
    .select("impressions, confidence_level")
    .eq("client_id", clientId)
    .gte("published_at", start)
    .lt("published_at", periodUpperExclusive(end))
    .not("impressions", "is", null)
    .neq("content_format", "story")
    .in("confidence_level", CONFIDENCE_LEVELS)
    .returns<PostImpressionsRow[]>();

  if (error) {
    console.error("[fetchPostImpressionsKpi]", error.message);
    return impressionsKpiData("impressions-posts", null);
  }

  const aggregate = aggregatePostImpressions(data ?? []);
  return impressionsKpiData(
    "impressions-posts",
    aggregate.total,
    aggregate.sourceLevel,
  );
}

async function fetchDataStatusNotices(
  clientId: string,
  start: string,
  end: string,
) {
  const [
    postsTotal,
    postsFirst,
    postsLast,
    postsInPeriod,
    postsEstimated,
    postsL2Excluded,
    snapshots,
    latestSnapshot,
  ] = await Promise.all([
    supabase
      .schema("orbit")
      .from("ig_posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .schema("orbit")
      .from("ig_posts")
      .select("published_at")
      .eq("client_id", clientId)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .overrideTypes<{ published_at: string }, { merge: false }>(),
    supabase
      .schema("orbit")
      .from("ig_posts")
      .select("published_at")
      .eq("client_id", clientId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<{ published_at: string }, { merge: false }>(),
    supabase
      .schema("orbit")
      .from("ig_posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("published_at", start)
      .lt("published_at", periodUpperExclusive(end)),
    supabase
      .schema("orbit")
      .from("ig_posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_estimated", true),
    supabase
      .schema("orbit")
      .from("ig_posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("confidence_level", "L2")
      .gte("published_at", start)
      .lt("published_at", periodUpperExclusive(end)),
    supabase
      .schema("orbit")
      .from("ig_account_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .schema("orbit")
      .from("ig_account_snapshots")
      .select("reach_total, impressions_total")
      .eq("client_id", clientId)
      .order("period_end", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<
        { reach_total: number | null; impressions_total: number | null },
        { merge: false }
      >(),
  ]);

  const queryErrors: {
    name: string;
    error: { message: string } | null;
  }[] = [
    { name: "posts total", error: postsTotal.error },
    { name: "oldest post", error: postsFirst.error },
    { name: "newest post", error: postsLast.error },
    { name: "posts in period", error: postsInPeriod.error },
    { name: "estimated posts", error: postsEstimated.error },
    { name: "L2 posts", error: postsL2Excluded.error },
    { name: "snapshot count", error: snapshots.error },
    { name: "latest snapshot", error: latestSnapshot.error },
  ];
  const failedQueries = queryErrors.flatMap(({ name, error }) =>
    error ? [`${name}: ${error.message}`] : [],
  );

  if (failedQueries.length > 0) {
    throw new Error(`[fetchDataStatusNotices] ${failedQueries.join("; ")}`);
  }

  const facts: ClientDataFacts = {
    postsTotal: postsTotal.count ?? 0,
    postsFirst: postsFirst.data?.published_at ?? null,
    postsLast: postsLast.data?.published_at ?? null,
    postsInPeriod: postsInPeriod.count ?? 0,
    postsEstimated: postsEstimated.count ?? 0,
    postsL2Excluded: postsL2Excluded.count ?? 0,
    snapshotCount: snapshots.count ?? 0,
    latestSnapshotReach: latestSnapshot.data?.reach_total ?? null,
    latestSnapshotImpressions: latestSnapshot.data?.impressions_total ?? null,
  };

  return buildDataStatusNotices(facts);
}

// NOTA (19/09/2026): ER Real e VPS têm só régua global de gestão interna
// (ref_thresholds ids 96/97, confiança 0.50, provisória); Utilidade não tem
// régua alguma. A cor do semáforo vem da view; a origem da régua ainda não é
// exposta na tela (ver pendência "meta de gestão" no changelog).

// RN-23: proveniência dos scores do Overview. Datas do snapshot entram em
// periodLabel quando o score vem de v_quality_scores (snapshot).
const ER_NO_SHARES_TEXT =
  "ER Real = (salvamentos + compartilhamentos + comentários) ÷ alcance. Ele aparece assim que a coleta trouxer os compartilhamentos.";

const QUALITY_PROVENANCE: Record<string, MetricProvenance> = {
  polemic_score_pct: {
    source: "cálculo feito post a post",
    period: "header_window",
    method:
      "mediana por post de comentários ÷ curtidas × 100 (curtidas > 0); régua do setor em validação. Não é o número do painel de Qualidade, que vem de outro cálculo",
  },
  vps_pct: {
    source: "última coleta de dados da conta",
    period: "snapshot",
    method:
      "fórmula oficial: (alcance × % do alcance em seguidores) ÷ seguidores × 100; referência de gestão do ORBIT (hipótese), ainda não é comparação de mercado",
  },
  er_real_pct: {
    source: "última coleta de dados da conta",
    period: "snapshot",
    method:
      "(salvamentos + compartilhamentos + comentários) ÷ alcance × 100; exige dado de compartilhamentos; referência de gestão do ORBIT (hipótese), ainda não é comparação de mercado",
  },
};

const fmtDateBR = (d: unknown): string =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)
    ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
    : "—";

async function fetchQualityScores(
  clientId: string,
  start: string,
  end: string,
): Promise<QualityScoreItem[]> {
  // FIX (reforma do vocabulário de cor): a cor vem do semáforo real
  // (semaphore_key da view), NÃO de status_variant — ele funde vermelho em
  // "warn" e âmbar em "neutral", o que pintava "vermelho" de dourado e
  // "âmbar" sem cor. O dicionário local foi substituído por
  // toSemaphoreColor()/SEMAPHORE_TO_GLOW (types/orbit.ts), que validam o
  // valor cru em vez de assumir que o banco só manda verde/ambar/vermelho.
  const SEMAPHORE_UI: Record<
    "verde" | "ambar" | "vermelho" | "neutro",
    { glow: GlowColor; variant: "ok" | "warn"; label: string }
  > = {
    verde: { glow: SEMAPHORE_TO_GLOW.verde, variant: "ok", label: "Verde" },
    ambar: { glow: SEMAPHORE_TO_GLOW.ambar, variant: "warn", label: "Âmbar" },
    vermelho: {
      glow: SEMAPHORE_TO_GLOW.vermelho,
      variant: "warn",
      label: "Vermelho",
    },
    neutro: { glow: SEMAPHORE_TO_GLOW.neutro, variant: "ok", label: "—" },
  };

  // Proveniência da régua (ref_dataset_id / ref_validation_status) vem da
  // migration fn_classify_metric_global_fallback_and_provenance. Se o ambiente
  // ainda não a tem, o Postgres devolve 42703 (coluna inexistente): cai no
  // select antigo em vez de zerar o painel.
  const withProvenance = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("v_quality_scores")
    .select(
      "id, score_key, metric_name, score_value, status_text, status_variant, period_start, period_end, semaphore_key, ref_category, ref_source, ref_direction, ref_green_min, ref_green_max, ref_red_min, ref_red_max, ref_p50, ref_dataset_id, ref_validation_status",
    )
    .eq("client_id", clientId)
    .lte("period_start", end)
    .gte("period_end", start)
    .returns<RawRow[]>();

  const { data: orbitRows, error: orbitError } =
    withProvenance.error?.code === "42703"
      ? await supabase
          .schema("orbit")
          .schema("orbit")
          .from("v_quality_scores")
          .select(
            "id, score_key, metric_name, score_value, status_text, status_variant, period_start, period_end, semaphore_key, ref_category, ref_source, ref_direction, ref_green_min, ref_green_max, ref_red_min, ref_red_max, ref_p50",
          )
          .eq("client_id", clientId)
          .lte("period_start", end)
          .gte("period_end", start)
          .returns<RawRow[]>()
      : withProvenance;

  if (orbitError) {
    console.error("[fetchQualityScores]", orbitError.message);
    return [];
  }
  const ageDays = (d: unknown): number | null => {
    if (typeof d !== "string") return null;
    const timestamp = Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(timestamp)
      ? null
      : Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  };

  const num = (v: unknown): number | null =>
    v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

  // SSC-1: o card de Polêmica não vem do snapshot da view (que ignora o
  // período do header): valor = mediana por post no período; semáforo =
  // fn_classify_metric sobre esse valor, mesma chamada que a view faz
  // (setor = clients.benchmark_category, porte 'all'). Os ref_* da view
  // (régua e direção) não dependem do valor e seguem alimentando o copy.
  // Se a classificação voltar degradada (L2: RPC indisponível), o valor do
  // período fica e o semáforo vai sem cor — nada de cor que ninguém calculou.
  let polemicOverride: {
    value: number | null;
    semaphore: SemaphoreKey | null;
  } | null = null;
  if ((orbitRows ?? []).some((r) => r.metric_name === "polemic_score_pct")) {
    const [median, clientRes] = await Promise.all([
      fetchPolemicMedianInPeriod(clientId, start, end),
      supabase
        .schema("orbit")
        .schema("orbit")
        .from("clients")
        .select("benchmark_category")
        .eq("id", clientId)
        .maybeSingle()
        .overrideTypes<
          { benchmark_category: string | null },
          { merge: false }
        >(),
    ]);
    if (median == null) {
      polemicOverride = { value: null, semaphore: null };
    } else {
      const classified = await classifyMetric(
        "polemic_score_pct",
        median,
        clientRes.data?.benchmark_category?.trim() || "all",
        "all",
      );
      // Classificação degradada (L2/neutro): o VALOR continua sendo o do
      // período do header; só o semáforo fica sem cor (null). Nunca volta ao
      // valor do snapshot, que é de outra janela (SSC-1: sem fallback).
      polemicOverride =
        classified.confidenceLevel !== "L2" && classified.semaphore !== "neutro"
          ? { value: median, semaphore: classified.semaphore }
          : { value: median, semaphore: null };
    }
  }

  // RN-22: ER Real nulo por falta de compartilhamentos não é "poucos posts".
  const erRowMissing = (orbitRows ?? []).some(
    (r) => r.metric_name === "er_real_pct" && r.score_value == null,
  );
  const sharesMissing = erRowMissing
    ? (await fetchSharesSummary(clientId, start, end)).total == null
    : false;

  return (orbitRows ?? []).map((row) => {
    const scoreKey = String(row.score_key);
    const metricName = row.metric_name != null ? String(row.metric_name) : "";
    const baseProv = QUALITY_PROVENANCE[metricName];
    const provenance: MetricProvenance | undefined = baseProv
      ? baseProv.period === "snapshot"
        ? {
            ...baseProv,
            periodLabel: `coleta de ${fmtDateBR(row.period_start)} a ${fmtDateBR(row.period_end)}`,
          }
        : baseProv
      : undefined;
    const rawStatus = String(row.status_text ?? "");
    const ov = row.metric_name === "polemic_score_pct" ? polemicOverride : null;
    // FIX (reforma do vocabulário de cor): sem cast cego. toSemaphoreColor
    // valida contra o vocabulário real e cai em 'neutro' se vier algo
    // inesperado; 'neutro' não existe em SemaphoreKey (buildScoreCopy só
    // aceita verde/ambar/vermelho/null), então vira null aqui.
    const rawSemaphore = ov ? ov.semaphore : (row.semaphore_key ?? null);
    const validatedSemaphore = toSemaphoreColor(
      typeof rawSemaphore === "string" ? rawSemaphore : null,
    );
    const semaphore: SemaphoreKey | null =
      validatedSemaphore === "neutro" ? null : validatedSemaphore;
    const sem = semaphore ? SEMAPHORE_UI[semaphore] : undefined;
    const value = ov
      ? ov.value
      : row.score_value != null
        ? toFiniteNumber(row.score_value)
        : null;
    const copy = buildScoreCopy({
      value: typeof value === "number" ? value : null,
      semaphore,
      category: row.ref_category != null ? String(row.ref_category) : null,
      source: row.ref_source != null ? String(row.ref_source) : null,
      direction: row.ref_direction != null ? String(row.ref_direction) : null,
      greenMin: num(row.ref_green_min),
      greenMax: num(row.ref_green_max),
      redMin: num(row.ref_red_min),
      redMax: num(row.ref_red_max),
      p50: num(row.ref_p50),
      metric: row.metric_name != null ? String(row.metric_name) : null,
      datasetId: row.ref_dataset_id != null ? String(row.ref_dataset_id) : null,
      validationStatus:
        row.ref_validation_status != null
          ? String(row.ref_validation_status)
          : null,
      dataAgeDays: ageDays(row.period_end),
    });

    return {
      id: String(row.id),
      label: scoreKey,
      value: value ?? "N/A",
      unit: "%",
      statusText:
        sharesMissing && metricName === "er_real_pct" && value == null
          ? ER_NO_SHARES_TEXT
          : copy.text ||
            rawStatus ||
            "Este indicador aparece quando o dado do período estiver disponível.",
      statusVariant: sem ? sem.variant : "neutral",
      glowColor: (sem ? sem.glow : "none") as GlowColor,
      actionText: copy.action,
      referenceNote: copy.note,
      ...(provenance ? { provenance } : {}),
    };
  });
}

export async function fetchPostsByFormat(
  clientId: string,
  start: string,
  end: string,
): Promise<Map<string, PostSummary[]>> {
  const byFormat = new Map<string, PostSummary[]>();

  const { data, error } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("ig_posts")
    .select(
      "id, content_format, published_at, likes, comments, caption, polemic_score_pct, is_boost_candidate",
    )
    .eq("client_id", clientId)
    .gte("published_at", start)
    .lt("published_at", periodUpperExclusive(end))
    .in("confidence_level", CONFIDENCE_LEVELS)
    .order("published_at", { ascending: false })
    .returns<RawRow[]>();

  if (error) {
    console.error("[fetchPostsByFormat]", error.message);
    return byFormat;
  }

  if (!data) return byFormat;

  for (const row of data) {
    const parsed = PostRowRawSchema.safeParse(row);
    if (!parsed.success) {
      console.warn(
        "[fetchPostsByFormat] Linha inválida descartada:",
        parsed.error.message,
      );
      continue;
    }

    const post = parsed.data;
    const label = FORMAT_LABEL[post.content_format] ?? post.content_format;

    const summary: PostSummary = {
      id: post.id,
      publishedAt: post.published_at,
      likes: post.likes,
      comments: post.comments,
      caption: repairMojibake(post.caption),
      polemicScorePct: post.polemic_score_pct,
      isBoostCandidate: post.is_boost_candidate ?? false,
      // ✅ NOVO (2026-09-18): null quando ausente (posts não-Reel ou coluna
      // ainda não ingerida). Zod declara optional().nullable() — nunca
      // substituir por 0: ausência é distinta de ratio zero.
      playToViewRatio: post.play_to_view_ratio ?? null,
    };

    const list = byFormat.get(label) ?? [];
    list.push(summary);
    byFormat.set(label, list);
  }

  return byFormat;
}

// ✅ RWP-5 (08/10/2026): "Interações" por formato, calculada dos posts —
// likes + comments + shares + saves (a definição de interações do Instagram).
// Regras (label = campo, nunca 0 por falta de dado):
//   - um post só entra na soma se os QUATRO campos existem; qualquer null =
//     post sem dado, fora da soma e fora de `knownPosts`;
//   - formato sem nenhum post completo => interactions = null (a tela mostra "—");
//   - cobertura parcial (knownPosts < totalPosts) fica explícita no contrato.
// Mesmo recorte de fetchPostsByFormat: cliente, período selecionado, L0/L1.
interface FormatInteractions {
  interactions: number | null;
  knownPosts: number;
  totalPosts: number;
}

type InteractionPostRow = {
  content_format: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
};

async function fetchInteractionsByFormat(
  clientId: string,
  start: string,
  end: string,
): Promise<Map<string, FormatInteractions>> {
  const byFormat = new Map<string, FormatInteractions>();

  const { data, error } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("ig_posts")
    .select("content_format, likes, comments, shares, saves")
    .eq("client_id", clientId)
    .gte("published_at", start)
    .lt("published_at", periodUpperExclusive(end))
    .in("confidence_level", CONFIDENCE_LEVELS)
    .returns<InteractionPostRow[]>();

  if (error) {
    console.error("[fetchInteractionsByFormat]", error.message);
    return byFormat;
  }

  const isNum = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);

  for (const row of data ?? []) {
    const label = FORMAT_LABEL[row.content_format] ?? row.content_format;
    const acc = byFormat.get(label) ?? {
      interactions: null,
      knownPosts: 0,
      totalPosts: 0,
    };
    acc.totalPosts += 1;
    if (
      isNum(row.likes) &&
      isNum(row.comments) &&
      isNum(row.shares) &&
      isNum(row.saves)
    ) {
      acc.knownPosts += 1;
      acc.interactions =
        (acc.interactions ?? 0) +
        row.likes +
        row.comments +
        row.shares +
        row.saves;
    }
    byFormat.set(label, acc);
  }

  return byFormat;
}

async function fetchFormatPerformance(
  clientId: string,
  start: string,
  end: string,
): Promise<FormatPerformanceRow[]> {
  const { data: orbitRows, error: orbitError } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("v_format_performance")
    .select(
      "id, format_name, post_count, share_count, trend_label, trend_color, period_start, period_end",
    )
    .eq("client_id", clientId)
    .lte("period_start", end)
    .gte("period_end", start)
    .returns<RawRow[]>();

  // A view fornece só o id/ordem das linhas. A TENDÊNCIA não vem mais dela
  // (a view usava a nota de utilidade da legenda): é calculada dos posts do
  // header por computeFormatTrend (curtidas + comentários). Se a view falhar,
  // a tabela continua existindo (a contagem vem de ig_posts).
  if (orbitError) {
    console.error("[fetchFormatPerformance]", orbitError.message);
  }

  const [postsByFormat, interactionsByFormat] = await Promise.all([
    fetchPostsByFormat(clientId, start, end),
    fetchInteractionsByFormat(clientId, start, end),
  ]);

  // Universo da tabela = formatos que têm post NO HEADER (ig_posts), na ordem
  // da view quando existe linha dela e, depois, os demais. Antes a tabela
  // partia das linhas da view: formato com post no header e sem linha na view
  // sumia (e dos Insights); formato só com histórico fora do header aparecia
  // com 0 posts.
  const viewByLabel = new Map<string, RawRow>();
  for (const row of orbitError ? [] : (orbitRows ?? [])) {
    viewByLabel.set(String(row.format_name ?? "Outros"), row);
  }
  const labels = [...viewByLabel.keys()];
  for (const label of postsByFormat.keys()) {
    if (!viewByLabel.has(label)) labels.push(label);
  }

  return labels.flatMap((label): FormatPerformanceRow[] => {
    const detail = postsByFormat.get(label) ?? [];
    if (detail.length === 0) return [];

    const row = viewByLabel.get(label);
    const inter = interactionsByFormat.get(label);

    // Tendência derivada das interações dos posts do header (VAL-7), na mesma
    // população e janela da tabela. Não depende mais da janela da view.
    const trend = trendCopy(computeFormatTrend(detail));

    return [
      {
        id: row != null ? String(row.id) : `fmt:${clientId}:${label}`,
        format: label,
        posts: detail.length,
        // Só por compatibilidade (histórico da view; a tela não exibe).
        shares: toFiniteNumber(row?.share_count),
        // RWP-5: o que a tabela mostra. null = sem dado (a tela exibe "—").
        interactions: inter?.interactions ?? null,
        interactionsKnownPosts: inter?.knownPosts ?? 0,
        interactionsTotalPosts: inter?.totalPosts ?? 0,
        // RN-15 (mínimo de 5 posts) e demais regras: ver lib/stats/formatTrend.
        trendLabel: trend.label,
        trendColor: trend.color,
        postsDetail: detail,
      },
    ];
  });
}

async function fetchSharesSummary(
  clientId: string,
  start: string,
  end: string,
): Promise<SharesSummary> {
  const { data, error } = await supabase
    .schema("orbit")
    .schema("orbit")
    .from("ig_account_snapshots")
    .select("interactions_shares, period_start, period_end")
    .eq("client_id", clientId)
    .lte("period_start", end)
    .gte("period_end", start)
    .not("interactions_shares", "is", null)
    .order("period_end", { ascending: false })
    .limit(1)
    .returns<
      {
        interactions_shares: number;
        period_start: string;
        period_end: string;
      }[]
    >();

  if (error || !data || data.length === 0) {
    return {
      total: null,
      periodLabel: "período selecionado",
      source: "account_aggregate",
    };
  }

  const row = data[0];
  if (!row) {
    return {
      total: null,
      periodLabel: "período selecionado",
      source: "account_aggregate",
    };
  }
  return {
    total: row.interactions_shares,
    periodLabel: `${row.period_start} – ${row.period_end}`,
    source: "account_aggregate",
  };
}

interface AudienceRowRaw {
  gender_female_pct: number | null;
  gender_male_pct: number | null;
  gender_other_pct: number | null;
  top_cities: { name: string; pct: number }[] | null;
  period_start: string;
  period_end: string;
}

interface AccountReachRowRaw {
  reach_followers_pct: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
}

async function fetchAudienceSummary(
  clientId: string,
  start: string,
  end: string,
): Promise<AudienceSummary> {
  const [audienceRes, accountRes] = await Promise.all([
    supabase
      .schema("orbit")
      .schema("orbit")
      .from("ig_audience_snapshots")
      .select(
        "gender_female_pct, gender_male_pct, gender_other_pct, top_cities, period_start, period_end",
      )
      .eq("client_id", clientId)
      .lte("period_start", end)
      .gte("period_end", start)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<AudienceRowRaw, { merge: false }>(),
    supabase
      .schema("orbit")
      .schema("orbit")
      .from("ig_account_snapshots")
      .select("reach_followers_pct, profile_visits, link_clicks")
      .eq("client_id", clientId)
      .lte("period_start", end)
      .gte("period_end", start)
      // ✅ 09/09 — REGRESSÃO CORRIGIDA: o .not('reach_followers_pct', 'is', null)
      // que existia aqui descartava a linha inteira (inclusive profile_visits e
      // link_clicks, que vêm preenchidos de forma independente na ingestão —
      // ver EXTERNAL_LINK_TAPS/PROFILE_VISITS_FROM em ingest-from-zip.ts) sempre
      // que só reach_followers_pct estivesse nulo (export sem a chave
      // REACH_FROM_FOLLOWERS_PCT). Efeito visível: "Cliques no link" some do
      // AudienceSummaryPanel mesmo com dado real no snapshot mais recente.
      // Basta pegar o snapshot mais recente do período, sem exigir esse campo.
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<AccountReachRowRaw, { merge: false }>(),
  ]);

  const audience = audienceRes.data;
  const account = accountRes.data;

  return {
    genderFemalePct: toFiniteNumber(audience?.gender_female_pct),
    genderMalePct: toFiniteNumber(audience?.gender_male_pct),
    genderOtherPct: toFiniteNumber(audience?.gender_other_pct),
    topCities: (audience?.top_cities ?? []).map((city) => ({
      name: repairMojibake(city.name) ?? city.name,
      pct: toFiniteNumber(city.pct),
    })),
    reachFollowersPct: toFiniteNumber(account?.reach_followers_pct),
    profileVisits: toFiniteNumber(account?.profile_visits),
    linkClicks: toFiniteNumber(account?.link_clicks),
    periodLabel: audience
      ? `${fmtDateBR(audience.period_start)} a ${fmtDateBR(audience.period_end)}`
      : "período selecionado",
  };
}

function generateInsights(formats: FormatPerformanceRow[]): InsightData[] {
  // Leitura comparativa por post + próximo passo (regras em lib/formatInsights).
  // Antes: uma frase por formato ("somou N interações"), sem comparação e sem ação.
  return buildFormatInsights(formats);
}

// ── client_onboarding (SSOT único de setor/nicho/porte/audiência) ────────

// ✅ FIX (alinhamento código/repo): `db` injetável. O default continua sendo o
// client anon do navegador (telas); Server Actions passam o client com cookies
// da sessão — sem isso o RLS devolve vazio no servidor (sem sessão).
export type OrbitDbClient = typeof supabase;

export async function fetchClientOnboarding(
  clientId: string,
  db: OrbitDbClient = supabase,
): Promise<ClientOnboarding | null> {
  const { data, error } = await db
    .schema("orbit")
    .schema("orbit")
    .from("client_onboarding")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle()
    .overrideTypes<ClientOnboarding, { merge: false }>();

  if (error || !data) return null;
  return data;
}

// Meta de gênero do avatar — só as 2 colunas que o gap do AudienceSummaryPanel
// precisa (evita o select("*") de fetchClientOnboarding). Sem linha de
// onboarding => null (estado normal, não é erro).
export async function fetchOnboardingExpectations(
  clientId: string,
  db: OrbitDbClient = supabase,
): Promise<OnboardingGenderExpectation | null> {
  const { data, error } = await db
    .schema("orbit")
    .from("client_onboarding")
    .select("avatar_expected_gender, avatar_expected_gender_pct")
    .eq("client_id", clientId)
    .maybeSingle()
    .overrideTypes<OnboardingGenderExpectation, { merge: false }>();

  if (error) {
    console.error(
      "[Repository] Erro ao buscar client_onboarding (meta de gênero):",
      error.message,
    );
    return null;
  }
  return data ?? null;
}

/* ==========================================================================
   fetchSectorPositioning — card de setor (client_onboarding, direto, sem
   cálculo) + benchmarking das 3 métricas via classifyMetric().

   ⚠️ classifyMetric() hoje NÃO diferencia por categoria/segmento —
   fn_classify_metric(p_metric_name, p_value) não tem parâmetro de
   categoria (confirmado no prosrc real da função). O que volta aqui é
   comparação GLOBAL, não "do seu setor", mesmo que setorBenchmark diga
   outra coisa. Não fabrica diferenciação que a função não faz — o
   ruleDeclaration que classifyMetric já devolve já é honesto sobre isso
   ("Comparado ao benchmark global..."). Quando fn_classify_metric ganhar
   parâmetro de categoria (migration futura, fora do escopo deste arquivo),
   esta função não precisa mudar — só a RPC por baixo fica mais precisa.

   ⚠️ er_real_pct/vps_pct: mesmos metricName do CASO G
   (resolveEngagementScoreAlert). Não há linha calibrada pra esses nomes
   em nenhuma categoria/tier hoje — vão sempre voltar "classificação
   indisponível". Decisão tomada, não é bug desta função.
   ========================================================================== */

/**
 * ✅ NOVO (18/09/2026) — algo_risk_score, família Ln. Busca os posts do
 * cliente ordenados do mais recente pro mais antigo (limit generoso o
 * bastante pra cobrir janela recente + baseline: N_RECENT=12 + até 30 de
 * baseline = 42 no cenário sem nenhum post excluído por likes null; pede
 * mais (80) pra sobrar margem quando há posts com likes null no meio).
 * Não usa RPC, não usa `ref_thresholds` — puro cálculo local sobre o
 * histórico da própria conta (computeAlgoRiskScore em
 * contentContractEngine.ts).
 */
async function fetchAlgoRiskScore(
  clientId: string,
  db: OrbitDbClient = supabase,
): Promise<AlgoRiskScore | null> {
  const { data, error } = await db
    .schema("orbit")
    .from("ig_posts")
    .select("published_at, likes, comments")
    // Stories entram em ig_posts (content_format 'story') após o ingest
    // --kind=stories. Baseline do algo_risk_score é histórico de PUBLICAÇÕES
    // do feed: story (várias por dia, sem likes/comments comparáveis) vazaria
    // pro IQR-trim e empurraria posts reais pra fora do limit(80).
    // Mesmo critério de fetchPostingProfile.
    .neq("content_format", "story")
    .eq("client_id", clientId)
    .in("confidence_level", CONFIDENCE_LEVELS)
    .order("published_at", { ascending: false })
    .limit(80)
    .returns<
      { published_at: string; likes: number | null; comments: number | null }[]
    >();

  if (error) {
    throw new Error(
      `[instagramOverviewRepository] falha ao buscar posts para algo_risk_score de ${clientId}: ${error.message}`,
    );
  }
  if (!data || data.length === 0) return null;

  return computeAlgoRiskScore(
    data.map((row) => ({
      publishedAt: row.published_at,
      likes: row.likes,
      comments: row.comments,
    })),
  );
}

/**
 * SSC-1 (10/10/2026): Polêmica = mediana por post (ficha `mediana_conta`) de
 * ig_posts.polemic_score_pct no período do header, calculada aqui — o banco
 * fornece o dado por post e não recalcula. Não cai pro snapshot da conta:
 * duas camadas pra mesma métrica foi o que o alinhamento de 10/10 recusou.
 * Recorte: cliente, [start, end], L0/L1, sem story. Post sem polemic_score_pct
 * (likes<=0 ou campo ausente) fica fora; sem nenhum => null, nunca 0.
 * A janela efetiva (header ∩ cobertura) sai sozinha: não existe post depois
 * da data de coleta.
 */
async function fetchPolemicMedianInPeriod(
  clientId: string,
  start: string,
  end: string,
  db: OrbitDbClient = supabase,
): Promise<number | null> {
  // SSC-1: a mediana é calculada por polemicMedianOfPeriod (stats/polemic.ts,
  // a função com testes), sobre comments/likes crus dos posts do header.
  // Antes lia a coluna pré-calculada polemic_score_pct, que podia divergir
  // do oráculo e não aplicava likes > 0 aqui. Stories ficam fora (decisão).
  const { data, error } = await db
    .schema("orbit")
    .schema("orbit")
    .from("ig_posts")
    .select("comments, likes")
    .neq("content_format", "story")
    .eq("client_id", clientId)
    .gte("published_at", start)
    .lt("published_at", periodUpperExclusive(end))
    .in("confidence_level", CONFIDENCE_LEVELS)
    .returns<
      { comments: number | string | null; likes: number | string | null }[]
    >();

  if (error) {
    console.error("[fetchPolemicMedianInPeriod]", error.message);
    return null;
  }

  const toNum = (v: number | string | null): number | null =>
    v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

  return polemicMedianOfPeriod(
    (data ?? []).map((r) => ({
      comments: toNum(r.comments),
      likes: toNum(r.likes),
    })),
  );
}

const COMMENT_REFERENCE_METRICS = [
  // P-4 (PO, 21/10/2026): rotular "ER por post" na tela; o nome no banco
  // (resposta_da_base) só muda na próxima migration de métrica (RN-11).
  { metric: "resposta_da_base", label: "ER por post", unit: "%" },
  { metric: "views_por_seguidor", label: "Views por seguidor", unit: "%" },
  {
    metric: "intencao_nos_comentarios",
    label: "Intenção nos comentários",
    unit: "%",
  },
  { metric: "tom_dos_comentarios", label: "Tom dos comentários", unit: "pts" },
] as const;

// RN-23: fonte, período e método declarados em cada card de referência.
const REF_PROVENANCE: Record<CommentReferenceItem["metric"], MetricProvenance> =
  {
    resposta_da_base: {
      source: "cálculo feito post a post · referência do setor",
      period: "header_window",
      method:
        "mediana por post de (curtidas + comentários) ÷ seguidores atuais × 100; mínimo 5 posts; seguidores ≥ 1.000; não é o ER Real",
    },
    views_por_seguidor: {
      source: "cálculo feito post a post · referência do setor",
      period: "header_window",
      method:
        "mediana por post de visualizações de Reel ÷ seguidores atuais × 100; mínimo 5 posts; não é o VPS",
    },
    posts_com_comentario: {
      source: "contagem de comentários por post",
      period: "header_window",
      method:
        "posts com comentário ÷ posts com contagem de comentários; mínimo 5 posts; sem cor, régua ou Ação",
    },
    intencao_nos_comentarios: {
      source: "texto dos comentários coletados · referência do setor",
      period: "header_window",
      method:
        "% de comentários com intenção; mínimo 30 comentários; informativa, sem cor",
    },
    tom_dos_comentarios: {
      source: "texto dos comentários coletados · referência do setor",
      period: "header_window",
      method:
        "(% positivo − % negativo) × 100 em posts com ≥ 3 comentários; não liberado para cor ou Ação",
    },
  };

interface CommentCountQuery {
  select(
    columns: string,
    options: { count: "exact"; head: true },
  ): {
    in(
      column: string,
      values: string[],
    ): PromiseLike<{
      count: number | null;
      error: { message: string; code?: string; details?: string } | null;
      status?: number;
      statusText?: string;
    }>;
  };
}

async function fetchCommentTextCount(
  postIds: readonly string[],
  db: OrbitDbClient,
): Promise<number | null> {
  const comments = (
    db.schema("orbit") as unknown as {
      from(relation: string): CommentCountQuery;
    }
  ).from("ig_post_comments");
  let total = 0;
  for (let i = 0; i < postIds.length; i += 100) {
    const { count, error, status, statusText } = await comments
      .select("post_id", { count: "exact", head: true })
      .in("post_id", postIds.slice(i, i + 100));
    if (error) {
      // head:true = requisição HEAD, sem corpo: error.message vem vazio.
      console.warn("[fetchCommentTextCount]", {
        status,
        statusText,
        code: error.code,
        message: error.message,
      });
      return null;
    }
    total += count ?? 0;
  }
  return total;
}
/**
 * Régua global (category 'global', tier 'all') da run orbit_comments_v2 +
 * valor do cliente quando existe cálculo. resposta_da_base e views_por_seguidor
 * saem de ig_posts (mediana por post, header, L0/L1, sem story). Intenção e tom
 * dependem de classificação do texto dos comentários: não existe por cliente
 * hoje, então ficam como referência pura. Falha vira lista vazia: o painel não
 * quebra e nada é inventado.
 */
async function fetchCommentReference(
  clientId: string,
  start: string,
  end: string,
  db: OrbitDbClient = supabase,
): Promise<CommentReferenceItem[]> {
  const names = COMMENT_REFERENCE_METRICS.map((m) => m.metric);
  const [refRes, postsRes, followers] = await Promise.all([
    db
      .schema("orbit")
      .from("ref_thresholds")
      .select(
        "id, metric_name, percentile_p25, percentile_p50, percentile_p75, sample_count",
      )
      .in("metric_name", names)
      .eq("category", "global")
      .eq("tier_normalized", "all")
      .order("id", { ascending: false }),
    db
      .schema("orbit")
      .from("ig_posts")
      .select("id, likes, comments, reel_views")
      .neq("content_format", "story")
      .eq("client_id", clientId)
      .gte("published_at", start)
      .lt("published_at", periodUpperExclusive(end))
      .in("confidence_level", CONFIDENCE_LEVELS),
    fetchTotalFollowers(clientId, db).catch((e: unknown) => {
      console.error("[fetchCommentReference] followers:", e);
      return null;
    }),
  ]);

  if (refRes.error) {
    console.error("[fetchCommentReference]", refRes.error.message);
    return [];
  }
  if (postsRes.error) {
    console.error("[fetchCommentReference] posts:", postsRes.error.message);
  }

  const posts = (postsRes.data ?? []).map((r) => ({
    likes: r.likes,
    comments: r.comments,
    views: r.reel_views,
  }));
  const textCount = await fetchCommentTextCount(
    (postsRes.data ?? []).map((r) => r.id as string),
    db,
  );
  const clientValues: Record<string, number | null> = {
    resposta_da_base: respostaDaBaseMedian(posts, followers),
    views_por_seguidor: viewsPorSeguidorMedian(posts, followers),
    intencao_nos_comentarios: null,
    tom_dos_comentarios: null,
  };

  const items: CommentReferenceItem[] = [];
  for (const m of COMMENT_REFERENCE_METRICS) {
    // order id desc: a execução mais recente vence se houver duplicata.
    const ref = (refRes.data ?? []).find((r) => r.metric_name === m.metric);
    if (!ref) continue;
    const p = {
      p25: ref.percentile_p25,
      p50: ref.percentile_p50,
      p75: ref.percentile_p75,
    };
    const clientValue = clientValues[m.metric] ?? null;
    const position = percentilePosition(clientValue, p);
    // RN-22: o "—" diz o motivo (amostra, seguidores ou texto não coletado).
    const nullNote =
      clientValue != null
        ? null
        : m.metric === "resposta_da_base"
          ? refNullReason(posts, followers, "er")
          : m.metric === "views_por_seguidor"
            ? refNullReason(posts, followers, "views")
            : commentTextStateNote(m.metric, textCount);
    items.push({
      metric: m.metric,
      label: m.label,
      unit: m.unit,
      clientValue,
      ...p,
      sampleCount: ref.sample_count,
      positionText: position,
      note: nullNote ? `${nullNote}. ${VALIDATION_NOTE}` : VALIDATION_NOTE,
      provenance: REF_PROVENANCE[m.metric],
    });
  }

  // RN-21 (P-6): informativa, sem cor, sem régua e sem Ação.
  const pcc = postsComComentario(posts);
  const pccText = postsComComentarioText(pcc);
  const pccItem: CommentReferenceItem = {
    metric: "posts_com_comentario",
    label: "Posts com comentário",
    unit: "%",
    clientValue: pcc.pct,
    p25: null,
    p50: null,
    p75: null,
    sampleCount: null,
    positionText: null,
    note: `${pccText.note}. ${VALIDATION_NOTE}`,
    valueText: pccText.valueText,
    provenance: REF_PROVENANCE.posts_com_comentario,
  };
  const at = items.findIndex((i) => i.metric === "intencao_nos_comentarios");
  items.splice(at < 0 ? items.length : at, 0, pccItem);
  return items;
}

export async function fetchSectorPositioning(
  clientId: string,
  start: string,
  end: string,
  db: OrbitDbClient = supabase,
): Promise<SectorPositioning | null> {
  const [onboarding, snapshot, algoRisk, commentReference] = await Promise.all([
    fetchClientOnboarding(clientId, db),
    fetchLatestEngagementScoreSnapshot(clientId, start, end, db),
    fetchAlgoRiskScore(clientId, db),
    fetchCommentReference(clientId, start, end, db),
  ]);

  if (!onboarding) return null;

  const category = mapSegmentToCategory(onboarding.setor_benchmark);
  const tier = mapFollowersToTier(onboarding.total_followers);
  const safeCategory = category ?? "all";
  const safeTier = tier ?? "all";

  const [erReal, vps, polemicScore] = snapshot
    ? await Promise.all([
        classifyMetric(
          "er_real_pct",
          snapshot.erRealPct,
          safeCategory,
          safeTier,
          db,
        ),
        snapshot.vpsPct !== null
          ? classifyMetric(
              "vps_pct",
              snapshot.vpsPct,
              safeCategory,
              safeTier,
              db,
            )
          : Promise.resolve(null),
        snapshot.polemicScorePct !== null
          ? classifyMetric(
              "polemic_score_pct",
              snapshot.polemicScorePct,
              safeCategory,
              safeTier,
              db,
            )
          : Promise.resolve(null),
      ])
    : [null, null, null];

  return {
    setorBenchmark: onboarding.setor_benchmark,
    nicho: onboarding.nicho,
    funnelMaturity: onboarding.funnel_maturity,
    proofMechanism: onboarding.proof_mechanism,
    erReal,
    erRealValue: snapshot?.erRealPct ?? null,
    vps,
    vpsValue: snapshot?.vpsPct ?? null,
    polemicScore,
    polemicScoreValue: snapshot?.polemicScorePct ?? null,
    algoRisk,
    commentReference,
    engagementPeriodNotes: onboarding.q1_engagement_period_notes,
    contentProxyNotes: onboarding.q2_content_proxy_notes,
    misalignmentNotes: onboarding.q3_misalignment_notes,
    observedContentClusters: onboarding.observed_content_clusters,
    audienceComposition: {
      nucleoFielPct: onboarding.audience_nucleo_fiel_pct,
      consumoPassivoPct: onboarding.audience_consumo_passivo_pct,
      curiosidadeExternaPct: onboarding.audience_curiosidade_externa_pct,
      altaRotatividadePct: onboarding.audience_alta_rotatividade_pct,
    },
  };
}

async function fetchCriticalAlerts(
  clientId: string,
  start: string,
  end: string,
  db: OrbitDbClient = supabase,
): Promise<CriticalAlertData[]> {
  const alerts: CriticalAlertData[] = [];

  const [engagementResult, algoResult] = await Promise.allSettled([
    (async () => {
      const [snapshot, onboarding] = await Promise.all([
        fetchLatestEngagementScoreSnapshot(clientId, start, end, db),
        fetchClientOnboarding(clientId, db),
      ]);
      if (!snapshot) return null;

      const category = mapSegmentToCategory(
        onboarding?.setor_benchmark ?? null,
      );
      const tier = mapFollowersToTier(onboarding?.total_followers ?? null);
      return resolveEngagementScoreAlert(snapshot, category, tier, db);
    })(),
    fetchAlgoRiskScore(clientId, db),
  ]);

  if (engagementResult.status === "rejected") {
    console.error(
      "[fetchCriticalAlerts] falha ao resolver alertas de engagement score:",
      engagementResult.reason,
    );
  } else if (
    engagementResult.value &&
    engagementResult.value.severity !== "info" &&
    engagementResult.value.severity !== "success"
  ) {
    alerts.push(toCriticalAlert(engagementResult.value));
  }

  if (algoResult.status === "rejected") {
    console.error(
      "[fetchCriticalAlerts] falha ao resolver algo_risk_score:",
      algoResult.reason,
    );
  } else if (algoResult.value) {
    const draft = resolveAlgoRiskScoreAlert({
      snapshotId: `algo_risk:${clientId}:${end}`,
      algoRiskScore: algoResult.value.value,
      nRecent: algoResult.value.recentWindowSize,
      recentMedian: algoResult.value.recentMedian,
      baselineMedian: algoResult.value.baselineMedian,
    });
    if (draft) alerts.push(toCriticalAlert(draft));
  }

  return alerts;
}

async function fetchTotalFollowers(
  clientId: string,
  db: OrbitDbClient = supabase,
): Promise<number | null> {
  const { data, error } = await db
    .schema("orbit")
    .from("client_onboarding")
    .select("total_followers")
    .eq("client_id", clientId)
    .maybeSingle()
    .overrideTypes<{ total_followers: number | null }, { merge: false }>();

  if (error) {
    throw new Error(
      `[instagramOverviewRepository] falha ao buscar total_followers de ${clientId}: ${error.message}`,
    );
  }
  return data?.total_followers ?? null;
}

export async function fetchLatestEngagementScoreSnapshot(
  clientId: string,
  start: string,
  end: string,
  db: OrbitDbClient = supabase,
): Promise<EngagementScoreSnapshot | null> {
  const [{ data, error }, totalFollowers, polemicMedian] = await Promise.all([
    db
      .schema("orbit")
      .schema("orbit")
      .from("ig_account_snapshots")
      .select(
        "id, er_real_pct, utility_score_pct, reach_total, reach_followers_pct, period_end",
      )
      .eq("client_id", clientId)
      .lte("period_start", end)
      .gte("period_end", start)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<EngagementScoreSnapshotRow, { merge: false }>(),
    fetchTotalFollowers(clientId, db),
    fetchPolemicMedianInPeriod(clientId, start, end, db),
  ]);

  if (error) {
    throw new Error(
      `[instagramOverviewRepository] falha ao buscar snapshot de engagement score para ${clientId}: ${error.message}`,
    );
  }

  if (!data) return null;

  const {
    id,
    er_real_pct,
    utility_score_pct,
    reach_total,
    reach_followers_pct,
  } = data;

  const vpsPct =
    reach_total != null &&
    reach_followers_pct != null &&
    totalFollowers != null &&
    totalFollowers > 0
      ? Math.round(
          ((reach_total * (reach_followers_pct / 100)) / totalFollowers) *
            100 *
            10000,
        ) / 10000
      : null;

  if (er_real_pct == null) {
    return null;
  }

  return {
    snapshotId: id,
    erRealPct: er_real_pct,
    utilityScorePct: utility_score_pct,
    polemicScorePct: polemicMedian,
    vpsPct,
  };
}
