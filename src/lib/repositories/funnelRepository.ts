/* =============================================================================
  ORBIT · Repository — Funil Interativo + Simulador
  Caminho: src/lib/repositories/funnelRepository.ts
  ============================================================================= */

import { supabase } from "@/lib/supabase";
import { buildFunnelInsight } from "./contentContractEngine";
import { somaOuNulo } from "./funnelMath";
import type {
  FunnelMetrics,
  InsightData,
  SetorBenchmark,
  FunnelContext,
  DmFunnelSummary,
  FunnelKind,
  ConversionSourceGrade,
} from "@/types/funnel";
import type { ConfidenceLevel } from "@/types/orbit";
import type { AlertContractFields } from "./contentContractEngine";

interface AccountSnapshotRow {
  reach_total: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  period_start: string;
  period_end: string;
}

interface FunnelDataRow {
  id: string;
  client_id: string;
  alcance: number;
  visitas: number;
  cliques: number | null;
  vendas: number | null;
  period_start: string;
  period_end: string;
  created_at: string;
}

// ✅ CORRIGIDO 09/09 (TICKETS item 5) — ctr_bio/taxa_conv eram buscadas do
// banco e descartadas (tudo era recalculado do zero). Decisão: banco não é
// fonte de verdade pra essas 2 colunas, então pararam de ser selecionadas
// na query também (ver .select() abaixo) — evita payload morto e deixa
// explícito que o cálculo é sempre local.

function mapRowsToFunnelMetrics(rows: FunnelDataRow[]): FunnelMetrics {
  const alcance = rows.reduce((sum, r) => sum + (r.alcance ?? 0), 0);
  const visitas = rows.reduce((sum, r) => sum + (r.visitas ?? 0), 0);
  // ✅ TICKETS item 7 — null quando ninguém informou o valor (sem linha, ou
  // linha com a coluna nula); número (inclusive 0 explícito) quando informado.
  // Antes `r.vendas ?? 0` transformava "venda não informada" em 0 assim que
  // existia uma linha de funnel_data só com alcance/visitas.
  const cliques = somaOuNulo(rows.map((r) => r.cliques));
  const vendas = somaOuNulo(rows.map((r) => r.vendas));

  return {
    alcance,
    visitas,
    cliques,
    vendas,
    // ✅ TICKETS item 4 — nomes corretos (ver types/orbit.ts).
    profileVisitRate: alcance > 0 ? (visitas / alcance) * 100 : 0,
    linkCtrPct: visitas > 0 && cliques != null ? (cliques / visitas) * 100 : 0,
    taxaConv:
      cliques != null && cliques > 0 && vendas != null
        ? (vendas / cliques) * 100
        : 0,
  };
}

function toFiniteNumber(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0;
}

function mapFunnelMetrics(
  accountSnapshot: AccountSnapshotRow | null,
  funnelRows: FunnelDataRow[],
): FunnelMetrics {
  const fallback = mapRowsToFunnelMetrics(funnelRows);
  const alcance = accountSnapshot
    ? accountSnapshot.reach_total == null
      ? fallback.alcance
      : toFiniteNumber(accountSnapshot.reach_total)
    : fallback.alcance;
  const visitas = accountSnapshot
    ? accountSnapshot.profile_visits == null
      ? fallback.visitas
      : toFiniteNumber(accountSnapshot.profile_visits)
    : fallback.visitas;
  // ✅ TICKETS item 7 — cliques só vira número quando accountSnapshot tem
  // link_clicks OU o fallback (funnel_data) tinha linha(s) de verdade;
  // caso contrário fica null ("sem dado"), não 0.
  const cliques =
    accountSnapshot && accountSnapshot.link_clicks != null
      ? toFiniteNumber(accountSnapshot.link_clicks)
      : fallback.cliques;
  // vendas não tem fonte em ig_account_snapshots — vem só de funnel_data.
  const vendas = fallback.vendas;

  return {
    alcance,
    visitas,
    cliques,
    vendas,
    profileVisitRate: alcance > 0 ? (visitas / alcance) * 100 : 0,
    linkCtrPct: visitas > 0 && cliques != null ? (cliques / visitas) * 100 : 0,
    taxaConv:
      cliques != null && cliques > 0 && vendas != null
        ? (vendas / cliques) * 100
        : 0,
  };
}

function toISOString(date: Date | string): string {
  if (typeof date === "string") return date;
  return date.toISOString();
}

const EMPTY_FUNNEL_METRICS: FunnelMetrics = {
  alcance: 0,
  visitas: 0,
  cliques: null,
  vendas: null,
  profileVisitRate: 0,
  linkCtrPct: 0,
  taxaConv: 0,
};

// ============================================================================
// Contexto do funil (tipo + benchmark de conversão) e resumo de DMs
// ============================================================================

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
};

async function fetchFunnelContext(
  clientId: string,
): Promise<FunnelContext | null> {
  const { data, error } = await supabase
    .schema("orbit")
    .from("v_funnel_context")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    console.warn(
      "[funnelRepository] v_funnel_context indisponível:",
      error.message,
    );
    return null;
  }
  if (!data) return null;
  const eventMeasured = data.benchmark_event_measured;
  const funnelType: FunnelKind = data.funnel_type === "dm" ? "dm" : "link";
  return {
    funnelType,
    segment: data.segment,
    benchmark:
      eventMeasured !== null
        ? {
            valuePct: data.conversion_benchmark_pct,
            eventMeasured,
            sourceGrade: (data.benchmark_source_grade ??
              "n/a") as ConversionSourceGrade,
            confidenceLevel: (data.benchmark_confidence ??
              "L2") as ConfidenceLevel,
            isProxy: data.benchmark_is_proxy !== false,
            sourceName: data.benchmark_source_name,
            sourceUrl: data.benchmark_source_url,
            sourceYear: data.benchmark_source_year,
            caveat: data.benchmark_caveat,
          }
        : null,
  };
}

async function fetchDmFunnel(
  clientId: string,
  start: string,
  end: string,
): Promise<DmFunnelSummary | null> {
  const { data, error } = await supabase
    .schema("orbit")
    .from("v_ig_dm_funnel")
    .select("*")
    .eq("client_id", clientId)
    .lte("period_start", end)
    .gte("period_end", start);
  if (error) {
    console.warn(
      "[funnelRepository] v_ig_dm_funnel indisponível:",
      error.message,
    );
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const sum = (values: (number | null)[]) =>
    values.reduce<number>((acc, value) => acc + (value ?? 0), 0);
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);
  const worst = rows
    .map((r) => (r.confidence_level ?? "L2") as ConfidenceLevel)
    .reduce(
      (a, b) => (CONFIDENCE_RANK[b] > CONFIDENCE_RANK[a] ? b : a),
      "L0" as ConfidenceLevel,
    );
  const periodStarts = rows
    .map((row) => row.period_start)
    .filter((value): value is string => value !== null)
    .sort();
  const periodEnds = rows
    .map((row) => row.period_end)
    .filter((value): value is string => value !== null)
    .sort();
  const periodStart = periodStarts[0];
  const periodEnd = periodEnds[periodEnds.length - 1];
  if (!periodStart || !periodEnd) return null;
  return {
    conversasComerciais: sum(rows.map((row) => row.conversas_comerciais)),
    pediuPreco: sum(rows.map((row) => row.pediu_preco)),
    intencaoCompra: sum(rows.map((row) => row.intencao_compra)),
    fechamentoProvavel: sum(rows.map((row) => row.fechamento_provavel)),
    vendaEvidenciaForte: sum(rows.map((row) => row.venda_evidencia_forte)),
    followupsPending: sum(rows.map((row) => row.followups_pending)),
    periodStart,
    periodEnd,
    confidenceLevel: worst,
    sourceNote: rows[0]?.source_note ?? null,
    partialPeriods: rows.some(
      (r) =>
        (r.period_start !== null && r.period_start < startDate) ||
        (r.period_end !== null && r.period_end > endDate),
    ),
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL: Busca dados reais + integra ContentContractEngine
// ============================================================================

export async function fetchFunnelData(
  clientId: string,
  periodStart: Date | string,
  periodEnd: Date | string,
): Promise<{
  metrics: FunnelMetrics;
  insight: InsightData & AlertContractFields;
  // ✅ TICKETS item 8 — setor_benchmark de client_onboarding, pra
  // FunnelScreen parar de passar setor={null} fixo pro simulador.
  setor: SetorBenchmark | null;
  context: FunnelContext | null;
  dm: DmFunnelSummary | null;
  igWindow: { start: string; end: string } | null;
}> {
  const start = toISOString(periodStart);
  const end = toISOString(periodEnd);

  const [accountResult, funnelResult, onboardingResult, context, dm] =
    await Promise.all([
      supabase
        .schema("orbit")
        .from("ig_account_snapshots")
        .select(
          "reach_total, profile_visits, link_clicks, period_start, period_end",
        )
        .eq("client_id", clientId)
        .lte("period_start", end)
        .gte("period_end", start)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .schema("orbit")
        .from("funnel_data")
        // ✅ TICKETS item 5 — ctr_bio/taxa_conv removidos do select: eram
        // buscados e nunca lidos (tudo recalculado localmente). Banco não é
        // fonte de verdade pra essas 2 colunas.
        .select(
          "id, client_id, alcance, visitas, cliques, vendas, period_start, period_end, created_at",
        )
        .eq("client_id", clientId)
        .lte("period_start", end)
        .gte("period_end", start)
        .order("period_end", { ascending: false }),
      supabase
        .schema("orbit")
        .from("client_onboarding")
        .select("setor_benchmark")
        .eq("client_id", clientId)
        .maybeSingle(),
      fetchFunnelContext(clientId),
      fetchDmFunnel(clientId, start, end),
    ]);

  if (accountResult.error) {
    throw accountResult.error;
  }

  if (funnelResult.error) {
    throw funnelResult.error;
  }

  const accountSnapshot = accountResult.data as AccountSnapshotRow | null;
  const funnelRows = (funnelResult.data ?? []) as FunnelDataRow[];
  const setor = (onboardingResult.data?.setor_benchmark ??
    null) as SetorBenchmark | null;

  if (!accountSnapshot && funnelRows.length === 0) {
    const insight = buildFunnelInsight({
      reach: EMPTY_FUNNEL_METRICS.alcance,
      linkCtrPct: EMPTY_FUNNEL_METRICS.linkCtrPct,
      dataSource: "empty_database",
    });
    return {
      metrics: EMPTY_FUNNEL_METRICS,
      insight,
      setor,
      context,
      dm,
      igWindow: null,
    };
  }

  const metrics = mapFunnelMetrics(accountSnapshot, funnelRows);
  const insight = buildFunnelInsight({
    reach: metrics.alcance,
    linkCtrPct: metrics.linkCtrPct,
    dataSource: "real_snapshot",
  });
  const igWindow = accountSnapshot
    ? { start: accountSnapshot.period_start, end: accountSnapshot.period_end }
    : null;
  return { metrics, insight, setor, context, dm, igWindow };
}

// ============================================================================
// FIM — cálculo de simulação vive em src/lib/funnelMath.ts (runFunnelSimulation)
// ============================================================================
