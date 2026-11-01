import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Service role: somente local/server-side. Nunca no browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CLIENTS: Record<string, string> = {
  cpimportstore: "2141d077-0d82-4fda-83df-558377f105ff",
  eupetruchio84: "c4722cfc-cff2-4a03-a457-f14ee8c9e0e7",
  mauricioartphoto: "344445c9-08c5-4c07-be1b-c9f8f8e12865",
  djcaiodogao: "c2779193-d3a0-4fc7-b392-ad64fea4273f",
  dogativo: "e45927a7-4f3d-4fd3-bac7-543cc3545dc1",
  ac_enxovais: "a131cba6-bd51-4d86-b7be-a9e7ee481e98",
};

// benchmark provisório usa industry_reference; não misturar com o esquema "system".
const TIER_SCHEME = "industry_reference";

const THRESHOLD_METRICS = [
  "polemic_score_pct",
  "engagement_public",
  "play_to_view_ratio",
  "er_real_pct",
  "vps_pct",
  "utility_score_pct",
] as const;

const EXPECTED_KPI_COUNT = 34;
const EXPECTED_RUNTIME_KPI_COUNT = 22;

interface SourceRequirement {
  source: string;
  fields: readonly string[];
}

interface KpiAuditSpec {
  id: string;
  screen: string;
  requirements: readonly SourceRequirement[];
}

interface ScreenSourceSpec {
  id: string;
  relation: string;
  screen: string;
  scope: "client" | "client_record" | "category" | "global";
}

interface ScreenSourceAudit {
  id: string;
  relation: string;
  screen: string;
  rowCount: number | null;
  sampleRows: number;
  columns: string[];
  nonNullColumns: string[];
  nonNullPaths: string[];
  error: string | null;
}

interface KpiSourceCheck {
  source: string;
  relation: string;
  rowCount: number | null;
  requiredFields: string[];
  missingFields: string[];
  nullFieldsInSample: string[];
  error: string | null;
}

interface KpiAuditRow {
  id: string;
  name: string;
  contractStatus: string | null;
  screen: string;
  status:
    | "FONTES_E_CAMPOS_PRESENTES"
    | "SEM_LINHAS_NA_FONTE"
    | "CAMPOS_AUSENTES"
    | "INPUTS_NULOS_NA_AMOSTRA"
    | "ERRO_DE_CONSULTA";
  sources: KpiSourceCheck[];
}

const SCREEN_DATA_SOURCES: readonly ScreenSourceSpec[] = [
  {
    id: "clients",
    relation: "clients",
    screen: "Perfil do cliente",
    scope: "client_record",
  },
  {
    id: "raw_ig_ingest",
    relation: "raw_ig_ingest",
    screen: "Ingestão Instagram",
    scope: "client",
  },
  {
    id: "client_followers_history",
    relation: "client_followers_history",
    screen: "Carteira / seguidores",
    scope: "client",
  },
  {
    id: "ig_account_snapshots",
    relation: "ig_account_snapshots",
    screen: "Overview / Audiência / Funil",
    scope: "client",
  },
  {
    id: "ig_posts",
    relation: "ig_posts",
    screen: "Conteúdo / Posts",
    scope: "client",
  },
  {
    id: "v_kpi_snapshots",
    relation: "v_kpi_snapshots",
    screen: "Overview / KPIs",
    scope: "client",
  },
  {
    id: "v_quality_scores",
    relation: "v_quality_scores",
    screen: "Overview / scores",
    scope: "client",
  },
  {
    id: "v_format_performance",
    relation: "v_format_performance",
    screen: "Overview / formatos",
    scope: "client",
  },
  {
    id: "ig_audience_snapshots",
    relation: "ig_audience_snapshots",
    screen: "Audiência",
    scope: "client",
  },
  {
    id: "v_avatar_alignment",
    relation: "v_avatar_alignment",
    screen: "Avatar",
    scope: "client",
  },
  {
    id: "funnel_data",
    relation: "funnel_data",
    screen: "Funil",
    scope: "client",
  },
  {
    id: "v_funnel_context",
    relation: "v_funnel_context",
    screen: "Funil / contexto e benchmark",
    scope: "client",
  },
  {
    id: "v_ig_dm_funnel",
    relation: "v_ig_dm_funnel",
    screen: "Funil / DMs",
    scope: "client",
  },
  {
    id: "funnel_conversion_benchmark",
    relation: "funnel_conversion_benchmark",
    screen: "Funil / benchmark",
    scope: "category",
  },
  {
    id: "funnel_stage_registry",
    relation: "funnel_stage_registry",
    screen: "Funil / etapas",
    scope: "global",
  },
  {
    id: "ads_meta_snapshots",
    relation: "ads_meta_snapshots",
    screen: "Ads / Meta",
    scope: "client",
  },
  {
    id: "ads_google_snapshots",
    relation: "ads_google_snapshots",
    screen: "Ads / Google",
    scope: "client",
  },
  {
    id: "ads_ga4_landing_pages",
    relation: "ads_ga4_landing_pages",
    screen: "Aquisição / landing pages",
    scope: "client",
  },
  {
    id: "alerts",
    relation: "alerts",
    screen: "Alertas",
    scope: "client",
  },
  {
    id: "v_creative_fatigue",
    relation: "v_creative_fatigue",
    screen: "Ads / fadiga criativa",
    scope: "client",
  },
  {
    id: "v_boost_candidates",
    relation: "v_boost_candidates",
    screen: "Conteúdo / boost",
    scope: "client",
  },
  {
    id: "ref_thresholds",
    relation: "ref_thresholds",
    screen: "Posicionamento / referências",
    scope: "global",
  },
  {
    id: "v_meta_ads_metrics",
    relation: "v_meta_ads_metrics",
    screen: "Ads / Meta",
    scope: "client",
  },
] as const;

const KPI_AUDIT_MATRIX: readonly KpiAuditSpec[] = [
  {
    id: "followers_net_balance",
    screen: "Carteira / seguidores",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["followers_new", "followers_lost"],
      },
      {
        source: "client_followers_history",
        fields: ["total_followers", "measured_at"],
      },
    ],
  },
  {
    id: "followers_semaphore",
    screen: "Carteira / seguidores",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["followers_net", "period_end"],
      },
    ],
  },
  {
    id: "engagement_period_delta",
    screen: "Engajamento / série",
    requirements: [
      { source: "ig_posts", fields: ["likes", "comments", "published_at"] },
    ],
  },
  {
    id: "engagement_semaphore",
    screen: "Engajamento / série",
    requirements: [
      { source: "ig_posts", fields: ["likes", "comments", "published_at"] },
    ],
  },
  {
    id: "cpr_vs_goal",
    screen: "Ads / Meta e Google",
    requirements: [
      { source: "ads_meta_snapshots", fields: ["cost_per_result", "spend"] },
      {
        source: "ads_google_snapshots",
        fields: ["cost_per_conversion", "spend"],
      },
    ],
  },
  {
    id: "cpr_semaphore",
    screen: "Ads / Meta e Google",
    requirements: [
      { source: "ads_meta_snapshots", fields: ["cost_per_result", "spend"] },
      {
        source: "ads_google_snapshots",
        fields: ["cost_per_conversion", "spend"],
      },
    ],
  },
  {
    id: "ctr_ads",
    screen: "Ads / Meta e Google",
    requirements: [
      { source: "ads_meta_snapshots", fields: ["clicks", "impressions"] },
      { source: "ads_google_snapshots", fields: ["clicks", "impressions"] },
    ],
  },
  {
    id: "ctr_bio_organic",
    screen: "Funil",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["link_clicks", "profile_visits"],
      },
    ],
  },
  {
    id: "ctr_below_threshold_alert",
    screen: "Alertas / Ads",
    requirements: [
      { source: "alerts", fields: ["alert_type", "metric_name"] },
      { source: "ads_meta_snapshots", fields: ["ctr_pct", "spend"] },
      { source: "ads_google_snapshots", fields: ["ctr_pct", "spend"] },
    ],
  },
  {
    id: "cpa",
    screen: "Ads / Meta e Google",
    requirements: [
      { source: "ads_meta_snapshots", fields: ["spend", "results"] },
      { source: "ads_google_snapshots", fields: ["spend", "conversions"] },
    ],
  },
  {
    id: "ad_frequency",
    screen: "Ads / Meta",
    requirements: [
      { source: "ads_meta_snapshots", fields: ["frequency", "roas"] },
    ],
  },
  {
    id: "confidence_l0",
    screen: "Transversal / confiança",
    requirements: [
      { source: "ig_posts", fields: ["confidence_level"] },
      { source: "ig_account_snapshots", fields: ["reach_confidence"] },
    ],
  },
  {
    id: "confidence_l1",
    screen: "Transversal / confiança",
    requirements: [
      { source: "ig_posts", fields: ["confidence_level"] },
      { source: "ig_account_snapshots", fields: ["interactions_confidence"] },
    ],
  },
  {
    id: "confidence_l2",
    screen: "Transversal / confiança",
    requirements: [
      { source: "ig_posts", fields: ["confidence_level"] },
      { source: "ig_account_snapshots", fields: ["followers_confidence"] },
    ],
  },
  {
    id: "organic_funnel_sales_estimate",
    screen: "Funil / simulador",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["reach_total", "profile_visits", "link_clicks"],
      },
      {
        source: "v_funnel_context",
        fields: ["funnel_type", "conversion_benchmark_pct"],
      },
      {
        source: "funnel_conversion_benchmark",
        fields: ["segment", "value_pct"],
      },
      { source: "funnel_stage_registry", fields: ["funnel_type", "stage_key"] },
    ],
  },
  {
    id: "polemic_score_pct",
    screen: "Posicionamento / comentários",
    requirements: [
      { source: "ig_posts", fields: ["comments", "likes"] },
      { source: "ref_thresholds", fields: ["metric_name", "percentile_p50"] },
    ],
  },
  {
    id: "utility_score_pct",
    screen: "Insights / utilidade (sem tile)",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["interactions_saves", "interactions_shares", "reach_total"],
      },
    ],
  },
  {
    id: "er_real_pct",
    screen: "Posicionamento / ER real",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: [
          "interactions_saves",
          "interactions_shares",
          "interactions_comments",
          "reach_total",
        ],
      },
    ],
  },
  {
    id: "vps_c02",
    screen: "Posicionamento / alcance na base",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["reach_total", "reach_followers_pct", "followers_total"],
      },
    ],
  },
  {
    id: "sparkline_8w",
    screen: "Tendência / série temporal",
    requirements: [
      { source: "ig_account_snapshots", fields: ["period_end", "reach_total"] },
      { source: "v_kpi_snapshots", fields: ["metric_value", "metric_date"] },
    ],
  },
  {
    id: "boost_candidate",
    screen: "Conteúdo / boost",
    requirements: [
      {
        source: "ig_posts",
        fields: ["is_boost_candidate", "boost_conditions_met"],
      },
      { source: "v_boost_candidates", fields: ["client_id"] },
    ],
  },
  {
    id: "creative_fatigue_score",
    screen: "Ads / fadiga criativa",
    requirements: [
      {
        source: "v_creative_fatigue",
        fields: ["fatigue_score_pct", "ctr_pct_week1", "ctr_pct_current"],
      },
    ],
  },
  {
    id: "creative_fatigue_cause",
    screen: "Ads / fadiga criativa",
    requirements: [
      {
        source: "v_creative_fatigue",
        fields: ["fatigue_cause", "creative_health"],
      },
    ],
  },
  {
    id: "avatar_gender",
    screen: "Avatar",
    requirements: [
      {
        source: "v_avatar_alignment",
        fields: ["expected_gender_male", "real_gender_male"],
      },
      {
        source: "ig_audience_snapshots",
        fields: ["gender_male_pct", "gender_female_pct"],
      },
    ],
  },
  {
    id: "avatar_age",
    screen: "Avatar",
    requirements: [
      {
        source: "v_avatar_alignment",
        fields: ["expected_age_range", "real_age_range"],
      },
      {
        source: "ig_audience_snapshots",
        fields: ["age_18_24_pct", "age_25_34_pct"],
      },
    ],
  },
  {
    id: "avatar_city",
    screen: "Avatar",
    requirements: [
      { source: "v_avatar_alignment", fields: ["expected_geo", "real_geo"] },
      { source: "ig_audience_snapshots", fields: ["top_cities"] },
    ],
  },
  {
    id: "reach_follower_split",
    screen: "Audiência",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["reach_total", "reach_followers_pct", "reach_non_followers"],
      },
    ],
  },
  {
    id: "save_rate",
    screen: "Audiência / saves",
    requirements: [
      {
        source: "ig_account_snapshots",
        fields: ["interactions_saves", "reach_total"],
      },
    ],
  },
  {
    id: "format_performance",
    screen: "Overview / formatos",
    requirements: [
      {
        source: "v_format_performance",
        fields: ["format_name", "post_count", "interactions"],
      },
      { source: "ig_posts", fields: ["content_format", "published_at"] },
    ],
  },
  {
    id: "audience_peak",
    screen: "Conteúdo / horário",
    requirements: [
      { source: "ig_posts", fields: ["published_at", "content_format"] },
    ],
  },
  {
    id: "ads_pace",
    screen: "Ads / ritmo de orçamento",
    requirements: [
      {
        source: "ads_meta_snapshots",
        fields: ["spend", "budget_allocated", "snapshot_date"],
      },
      { source: "ads_google_snapshots", fields: ["spend", "snapshot_date"] },
    ],
  },
  {
    id: "google_impression_share",
    screen: "Ads / Google",
    requirements: [
      {
        source: "ads_google_snapshots",
        fields: ["impression_share", "impressions"],
      },
    ],
  },
  {
    id: "lp_cvr",
    screen: "Aquisição / landing pages",
    requirements: [
      {
        source: "ads_ga4_landing_pages",
        fields: ["conversions", "sessions", "conversion_rate_pct"],
      },
    ],
  },
  {
    id: "cpm_market_delta",
    screen: "Ads / CPM e benchmark",
    requirements: [
      {
        source: "ads_meta_snapshots",
        fields: ["cpm", "objective", "snapshot_date"],
      },
      { source: "ref_thresholds", fields: ["metric_name", "percentile_p50"] },
    ],
  },
] as const;

// ATENÇÃO: em ig_posts a semântica de L0/L1/L2 NÃO está confirmada.
// (Em fn_classify_metric: L0 = cortes calibrados e amostra >= 100; L1 = amostra
// pequena; L2 = sem cortes/sem threshold.) Aqui os níveis são só rótulos: o
// relatório cruza cada nível com a presença de reach para revelar o significado.
type ConfidenceLevel = "L0" | "L1" | "L2";

interface IgPostRow {
  id: string;
  published_at: string;
  content_format: string;
  caption: string | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  confidence_level: ConfidenceLevel;
  is_boost_candidate: boolean;
  boost_conditions_met: number;
  er_real_pct: number | null;
  polemic_score_pct: number | null;
  utility_score_pct: number | null;
}

interface LevelCross {
  total: number;
  withReach: number;
}

interface PostStats {
  total: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  byLevel: Record<ConfidenceLevel, LevelCross>;
  unknownLevel: number; // valor fora de L0/L1/L2
  boostCandidates: number;
  negativeMetrics: number;
  avgReach: number | null;
  avgErRealPct: number | null;
  avgUtilityScorePct: number | null;
}

interface PostSample {
  published_at: string;
  content_format: string;
  caption: string;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  confidence_level: ConfidenceLevel;
}

interface ClientProfile {
  found: boolean;
  dbName: string | null;
  handle: string | null;
  isBenchmark: boolean | null;
  benchmarkCategory: string | null;
  funnelSegment: string | null;
  followers: number | null;
  followersSource: string | null;
  followersAsOf: string | null;
  tierScheme: string;
  tier: string | null;
}

interface ResolutionRow {
  metric: string;
  thresholdId: number | null;
  level: number | null; // 1-4; null = sem threshold
  validationStatus: string | null;
}

interface ClientAudit {
  clientId: string;
  clientName: string;
  profile: ClientProfile;
  resolution: ResolutionRow[];
  screenData: ScreenSourceAudit[];
  kpiCoverage: KpiAuditRow[];
  runtimeKpiCoverage: KpiAuditRow[];
  stats: PostStats;
  byFormat: Record<string, PostStats>;
  samplesWithReach: PostSample[];
  samplesWithoutReach: PostSample[];
  truncated: boolean;
}

const PAGE_SIZE = 1000;

/* ── Perfil: categoria, seguidores e tier ──────────────────────────────── */
async function fetchClientProfile(clientId: string): Promise<ClientProfile> {
  const [clientRes, onboardingRes, historyRes, tiersRes] = await Promise.all([
    supabase
      .schema("orbit")
      .from("clients")
      .select("id, name, handle, is_benchmark, benchmark_category")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .schema("orbit")
      .from("client_onboarding")
      .select(
        "client_id, total_followers, total_followers_source, setor_benchmark",
      )
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .schema("orbit")
      .from("client_followers_history")
      .select("id, total_followers, measured_at")
      .eq("client_id", clientId)
      .not("total_followers", "is", null)
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("orbit")
      .from("ref_follower_tiers")
      .select("tier, followers_min, followers_max")
      .eq("scheme", TIER_SCHEME)
      .order("followers_min", { ascending: true }),
  ]);

  for (const [label, res] of [
    ["clients", clientRes],
    ["client_onboarding", onboardingRes],
    ["client_followers_history", historyRes],
    ["ref_follower_tiers", tiersRes],
  ] as const) {
    if (res.error) throw new Error(`Erro em ${label}: ${res.error.message}`);
  }

  const client = clientRes.data;
  const onboarding = onboardingRes.data;
  const history = historyRes.data;
  const boundaries = tiersRes.data ?? [];

  // C3/V6: client_onboarding é a AUTORIDADE do valor corrente; a série
  // (client_followers_history) é mantida e só entra como fallback e para a data.
  const followers: number | null =
    onboarding?.total_followers ?? history?.total_followers ?? null;

  const tier =
    followers == null
      ? null
      : (boundaries.find(
          (b) =>
            followers >= b.followers_min &&
            (b.followers_max == null || followers <= b.followers_max),
        )?.tier ?? null);

  return {
    found: client != null,
    dbName: client?.name ?? null,
    handle: client?.handle ?? null,
    isBenchmark: client?.is_benchmark ?? null,
    benchmarkCategory: client?.benchmark_category ?? null,
    funnelSegment: onboarding?.setor_benchmark ?? null,
    followers,
    followersSource:
      onboarding?.total_followers != null
        ? `client_onboarding:${onboarding.total_followers_source ?? "?"}`
        : history?.total_followers != null
          ? "client_followers_history"
          : null,
    // Data da série só descreve o valor quando ele veio da série.
    followersAsOf:
      onboarding?.total_followers == null
        ? (history?.measured_at ?? null)
        : null,
    tierScheme: TIER_SCHEME,
    tier,
  };
}

/* ── Cobertura de threshold por métrica (fn_resolve_threshold) ─────────── */
async function fetchResolution(
  profile: ClientProfile,
): Promise<ResolutionRow[]> {
  const rows: ResolutionRow[] = [];
  for (const metric of THRESHOLD_METRICS) {
    const { data, error } = await supabase
      .schema("orbit")
      .rpc("fn_resolve_threshold", {
        p_metric_name: metric,
        p_category: profile.benchmarkCategory,
        p_tier: profile.tier,
      });
    if (error) {
      throw new Error(`fn_resolve_threshold(${metric}): ${error.message}`);
    }
    const first = Array.isArray(data) ? data[0] : data;
    rows.push({
      metric,
      thresholdId: first?.threshold_id ?? null,
      level: first?.resolution_level ?? null,
      validationStatus: first?.validation_status ?? null,
    });
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadKpiRegistry(): Map<
  string,
  { name: string; status: string | null }
> {
  const registryPath = path.join(
    process.cwd(),
    "contracts",
    "kpi",
    "registry.json",
  );
  const registry: unknown = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!isRecord(registry) || !Array.isArray(registry.kpis)) {
    throw new Error(
      `Formato inválido em ${registryPath}: esperado o array kpis.`,
    );
  }

  const entries = registry.kpis;
  const ids = entries.map((entry) =>
    isRecord(entry) && typeof entry.kpi_id === "string" ? entry.kpi_id : null,
  );
  const expected = KPI_AUDIT_MATRIX.map(({ id }) => id);
  const expectedSet = new Set(expected);
  const actualSet = new Set(ids.filter((id): id is string => id !== null));
  const duplicates = ids.filter(
    (id, index): id is string => id !== null && ids.indexOf(id) !== index,
  );
  const missing = expected.filter((id) => !actualSet.has(id));
  const unexpected = [...actualSet].filter((id) => !expectedSet.has(id));

  if (
    entries.length !== EXPECTED_KPI_COUNT ||
    ids.some((id) => id === null) ||
    duplicates.length > 0 ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new Error(
      [
        `Registry KCR incompatível: esperado ${EXPECTED_KPI_COUNT} IDs únicos iguais à matriz da auditoria; recebido ${entries.length}.`,
        missing.length ? `Ausentes: ${missing.join(", ")}.` : "",
        unexpected.length ? `Não mapeados: ${unexpected.join(", ")}.` : "",
        duplicates.length
          ? `Duplicados: ${[...new Set(duplicates)].join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  return new Map(
    entries.map((entry) => {
      if (!isRecord(entry) || typeof entry.kpi_id !== "string") {
        throw new Error(
          `Entrada inválida no registry KCR: ${JSON.stringify(entry)}`,
        );
      }
      return [
        entry.kpi_id,
        {
          name:
            typeof entry.kpi_nome === "string" ? entry.kpi_nome : entry.kpi_id,
          status:
            typeof entry.status_doc2 === "string" ? entry.status_doc2 : null,
        },
      ];
    }),
  );
}

interface RuntimeKpiContract {
  id: string;
  name: string;
  status: string | null;
  screen: string;
  requirements: readonly SourceRequirement[];
}

function loadRuntimeKpis(): RuntimeKpiContract[] {
  const runtimePath = path.join(
    process.cwd(),
    "contracts",
    "kpi",
    "runtime-alpha.json",
  );
  const runtime: unknown = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  if (!isRecord(runtime) || !Array.isArray(runtime.kpis)) {
    throw new Error(
      `Formato inválido em ${runtimePath}: esperado o array kpis.`,
    );
  }
  if (runtime.kpis.length !== EXPECTED_RUNTIME_KPI_COUNT) {
    throw new Error(
      `runtime-alpha.json tem ${runtime.kpis.length} KPIs; esperado ${EXPECTED_RUNTIME_KPI_COUNT}. Atualize a cobertura do script junto com o contrato.`,
    );
  }

  const seen = new Set<string>();
  return runtime.kpis.map((entry): RuntimeKpiContract => {
    if (
      !isRecord(entry) ||
      typeof entry.kpi_id !== "string" ||
      typeof entry.nome !== "string" ||
      !Array.isArray(entry.inputs)
    ) {
      throw new Error(
        `Entrada inválida no runtime-alpha.json: ${JSON.stringify(entry)}`,
      );
    }
    if (seen.has(entry.kpi_id)) {
      throw new Error(`KPI duplicada no runtime-alpha.json: ${entry.kpi_id}`);
    }
    seen.add(entry.kpi_id);

    const grouped = new Map<string, string[]>();
    for (const input of entry.inputs) {
      if (
        !isRecord(input) ||
        typeof input.source !== "string" ||
        typeof input.column !== "string"
      ) {
        throw new Error(
          `Input inválido em ${entry.kpi_id}: ${JSON.stringify(input)}`,
        );
      }
      const sourceParts = input.source.replace(/^orbit\./, "").split(".");
      const source = sourceParts.shift();
      if (!source) {
        throw new Error(`Fonte inválida em ${entry.kpi_id}: ${input.source}`);
      }
      const field = [...sourceParts, input.column].join(".");
      grouped.set(source, [...(grouped.get(source) ?? []), field]);
    }

    return {
      id: entry.kpi_id,
      name: entry.nome,
      status: typeof entry.status === "string" ? entry.status : null,
      screen:
        Array.isArray(entry.screens) &&
        entry.screens.every((screen) => typeof screen === "string")
          ? entry.screens.join(", ") || "sem tela declarada"
          : "tela não declarada",
      requirements: [...grouped].map(([source, fields]) => ({
        source,
        fields,
      })),
    };
  });
}

function summarizeSource(
  spec: ScreenSourceSpec,
  rows: Record<string, unknown>[],
  rowCount: number | null,
  error: string | null,
): ScreenSourceAudit {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  const nonNullPaths = new Set<string>();
  const collectNonNullPaths = (
    value: unknown,
    prefix: string,
    depth = 0,
  ): void => {
    if (value == null) return;
    nonNullPaths.add(prefix);
    if (isRecord(value) && depth < 3) {
      for (const [key, nestedValue] of Object.entries(value)) {
        collectNonNullPaths(nestedValue, `${prefix}.${key}`, depth + 1);
      }
    }
  };
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      collectNonNullPaths(value, key);
    }
  }
  const nonNullColumns = columns.filter((column) =>
    rows.some((row) => row[column] != null),
  );
  return {
    id: spec.id,
    relation: spec.relation,
    screen: spec.screen,
    rowCount,
    sampleRows: rows.length,
    columns,
    nonNullColumns,
    nonNullPaths: [...nonNullPaths].sort(),
    error,
  };
}

async function fetchScreenSource(
  clientId: string,
  profile: ClientProfile,
  spec: ScreenSourceSpec,
): Promise<ScreenSourceAudit> {
  let query = supabase
    .schema("orbit")
    .from(spec.relation)
    .select("*", { count: "exact" })
    .limit(5);

  if (spec.scope === "client") {
    query = query.eq("client_id", clientId);
  } else if (spec.scope === "client_record") {
    query = query.eq("id", clientId);
  } else if (spec.relation === "funnel_conversion_benchmark") {
    const segment = profile.funnelSegment ?? profile.benchmarkCategory;
    if (!segment) {
      return summarizeSource(spec, [], 0, null);
    }
    query = query.eq("segment", segment);
  } else if (spec.relation === "ref_thresholds") {
    query = query.eq("category", "global").eq("tier_normalized", "all");
  }

  const { data, count, error } = await query;
  if (error) {
    return summarizeSource(spec, [], null, error.message);
  }
  return summarizeSource(
    spec,
    (data ?? []) as Record<string, unknown>[],
    count,
    null,
  );
}

function buildKpiCoverage(
  registry: Map<string, { name: string; status: string | null }>,
  sourceAudits: ScreenSourceAudit[],
): KpiAuditRow[] {
  return buildCoverageRows(
    KPI_AUDIT_MATRIX.map((spec) => ({
      id: spec.id,
      name: registry.get(spec.id)?.name ?? spec.id,
      status: registry.get(spec.id)?.status ?? null,
      screen: spec.screen,
      requirements: spec.requirements,
    })),
    sourceAudits,
  );
}

function buildRuntimeKpiCoverage(
  contracts: RuntimeKpiContract[],
  sourceAudits: ScreenSourceAudit[],
): KpiAuditRow[] {
  return buildCoverageRows(contracts, sourceAudits);
}

function buildCoverageRows(
  specs: RuntimeKpiContract[],
  sourceAudits: ScreenSourceAudit[],
): KpiAuditRow[] {
  const sourcesById = new Map(
    sourceAudits.map((source) => [source.id, source]),
  );

  return specs.map((spec) => {
    const sources = spec.requirements.map((requirement): KpiSourceCheck => {
      const source = sourcesById.get(requirement.source);
      if (!source) {
        throw new Error(
          `Fonte ${requirement.source} não está configurada na auditoria.`,
        );
      }
      return {
        source: requirement.source,
        relation: source.relation,
        rowCount: source.rowCount,
        requiredFields: [...requirement.fields],
        missingFields:
          source.sampleRows === 0
            ? []
            : requirement.fields.filter(
                (field) =>
                  !source.columns.includes(field.split(".")[0] ?? field),
              ),
        nullFieldsInSample:
          source.sampleRows === 0
            ? []
            : requirement.fields.filter(
                (field) => !source.nonNullPaths.includes(field),
              ),
        error: source.error,
      };
    });

    let status: KpiAuditRow["status"];
    if (sources.some((source) => source.error)) {
      status = "ERRO_DE_CONSULTA";
    } else if (sources.some((source) => source.missingFields.length > 0)) {
      status = "CAMPOS_AUSENTES";
    } else if (sources.some((source) => source.rowCount === 0)) {
      status = "SEM_LINHAS_NA_FONTE";
    } else if (sources.some((source) => source.nullFieldsInSample.length > 0)) {
      status = "INPUTS_NULOS_NA_AMOSTRA";
    } else {
      status = "FONTES_E_CAMPOS_PRESENTES";
    }

    return {
      id: spec.id,
      name: spec.name,
      contractStatus: spec.status,
      screen: spec.screen,
      status,
      sources,
    };
  });
}

/* ── Busca paginada de posts ───────────────────────────────────────────── */
async function fetchAllPosts(
  clientId: string,
): Promise<{ posts: IgPostRow[]; expectedCount: number; truncated: boolean }> {
  const { count, error: countError } = await supabase
    .schema("orbit")
    .from("ig_posts")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    throw new Error(
      `Erro ao contar ig_posts de ${clientId}: ${countError.message}`,
    );
  }
  if (count == null) {
    throw new Error(
      `A contagem exata de ig_posts não foi retornada para ${clientId}.`,
    );
  }

  const totalExpected = count;
  const posts: IgPostRow[] = [];
  let from = 0;

  while (posts.length < totalExpected) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .schema("orbit")
      .from("ig_posts")
      .select("*")
      .eq("client_id", clientId)
      .order("published_at", { ascending: true })
      .order("id", { ascending: true }) // offsets estáveis entre páginas
      .range(from, to);

    if (error) {
      throw new Error(
        `Erro ao consultar ig_posts [${from}-${to}] de ${clientId}: ${error.message}`,
      );
    }
    if (!data || data.length === 0) break;

    posts.push(...(data as IgPostRow[]));
    from += PAGE_SIZE;
  }

  return {
    posts,
    expectedCount: totalExpected,
    truncated: posts.length !== totalExpected,
  };
}

function emptyStats(): PostStats {
  return {
    total: 0,
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    byLevel: {
      L0: { total: 0, withReach: 0 },
      L1: { total: 0, withReach: 0 },
      L2: { total: 0, withReach: 0 },
    },
    unknownLevel: 0,
    boostCandidates: 0,
    negativeMetrics: 0,
    avgReach: null,
    avgErRealPct: null,
    avgUtilityScorePct: null,
  };
}

function accumulate(stats: PostStats, post: IgPostRow): void {
  stats.total++;
  if (post.reach != null) stats.reach++;
  if (post.impressions != null) stats.impressions++;
  if (post.likes != null) stats.likes++;
  if (post.comments != null) stats.comments++;
  if (post.shares != null) stats.shares++;
  if (post.saves != null) stats.saves++;

  const level = stats.byLevel[post.confidence_level];
  if (level) {
    level.total++;
    if (post.reach != null) level.withReach++;
  } else {
    stats.unknownLevel++;
  }

  if (post.is_boost_candidate) stats.boostCandidates++;

  if (
    (post.reach != null && post.reach < 0) ||
    (post.impressions != null && post.impressions < 0)
  ) {
    stats.negativeMetrics++;
  }
}

function mean(values: number[], digits: number): number | null {
  if (values.length === 0) return null;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  return Number(m.toFixed(digits));
}

function finalizeAverages(stats: PostStats, posts: IgPostRow[]): void {
  stats.avgReach = mean(
    posts.flatMap((p) => (p.reach != null ? [p.reach] : [])),
    0,
  );
  stats.avgErRealPct = mean(
    posts.flatMap((p) => (p.er_real_pct != null ? [p.er_real_pct] : [])),
    2,
  );
  stats.avgUtilityScorePct = mean(
    posts.flatMap((p) =>
      p.utility_score_pct != null ? [p.utility_score_pct] : [],
    ),
    2,
  );
}

function toSample(p: IgPostRow): PostSample {
  return {
    published_at: p.published_at,
    content_format: p.content_format,
    caption: p.caption?.substring(0, 40) || "(vazio)",
    reach: p.reach,
    impressions: p.impressions,
    likes: p.likes,
    confidence_level: p.confidence_level,
  };
}

/* ── Auditoria principal ───────────────────────────────────────────────── */
async function auditClients(): Promise<ClientAudit[]> {
  const results: ClientAudit[] = [];
  const registry = loadKpiRegistry();
  const runtimeKpis = loadRuntimeKpis();

  for (const [clientName, clientId] of Object.entries(CLIENTS)) {
    console.log(`\n⏳ Auditando ${clientName}...`);

    const profile = await fetchClientProfile(clientId);
    if (!profile.found) {
      console.log(`🔴 ${clientName}: id não existe em orbit.clients`);
    }
    const resolution = await fetchResolution(profile);
    const [{ posts, expectedCount, truncated }, screenDataWithoutPosts] =
      await Promise.all([
        fetchAllPosts(clientId),
        Promise.all(
          SCREEN_DATA_SOURCES.filter((source) => source.id !== "ig_posts").map(
            (source) => fetchScreenSource(clientId, profile, source),
          ),
        ),
      ]);
    const postSamples = posts
      .slice(-5)
      .map((post) => Object.fromEntries(Object.entries(post)));
    const postSource = summarizeSource(
      SCREEN_DATA_SOURCES.find((source) => source.id === "ig_posts")!,
      postSamples,
      expectedCount,
      truncated ? "Paginação incompleta; amostra parcial." : null,
    );
    const screenData = [...screenDataWithoutPosts, postSource];
    const kpiCoverage = buildKpiCoverage(registry, screenData);
    const runtimeKpiCoverage = buildRuntimeKpiCoverage(runtimeKpis, screenData);

    if (posts.length === 0) {
      console.log(`⚠️  ${clientName}: nenhum post (segue na cobertura)`);
    }
    if (truncated) {
      console.log(`🔴 ${clientName}: PAGINAÇÃO INCOMPLETA — dado parcial`);
    }

    const stats = emptyStats();
    const byFormat: Record<string, PostStats> = {};

    for (const post of posts) {
      accumulate(stats, post);
      const fmtStats =
        byFormat[post.content_format] ??
        (byFormat[post.content_format] = emptyStats());
      accumulate(fmtStats, post);
    }

    finalizeAverages(stats, posts);
    for (const [fmt, fmtStats] of Object.entries(byFormat)) {
      finalizeAverages(
        fmtStats,
        posts.filter((p) => p.content_format === fmt),
      );
    }

    results.push({
      clientId,
      clientName,
      profile,
      resolution,
      screenData,
      kpiCoverage,
      runtimeKpiCoverage,
      stats,
      byFormat,
      samplesWithReach: posts
        .filter((p) => p.reach != null)
        .slice(0, 3)
        .map(toSample),
      samplesWithoutReach: posts
        .filter((p) => p.reach == null)
        .slice(0, 3)
        .map(toSample),
      truncated,
    });
  }

  return results;
}

/* ── Relatório ─────────────────────────────────────────────────────────── */
function pct(n: number, total: number): string {
  return total > 0 ? ((n / total) * 100).toFixed(1) : "0.0";
}

function statusOf(a: ClientAudit): string {
  const { stats, truncated } = a;
  if (truncated) return "🔴 TRUNCADO";
  if (stats.total === 0) return "⚠️  SEM POSTS";
  if (stats.negativeMetrics > 0 || stats.unknownLevel > 0)
    return "⚠️  ANOMALIA";
  if (stats.reach === stats.total) return "✅ REACH 100%";
  if (stats.reach === 0) return "❌ SEM REACH";
  return "⚠️  PARCIAL";
}

function printKpiCoverage(title: string, rows: KpiAuditRow[]): void {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const summary = [...counts]
    .map(([status, count]) => `${status}: ${count}`)
    .join(" | ");
  console.log(`\n🧮 ${title} (${rows.length}): ${summary}`);
  for (const row of rows) {
    const sourceSummary = row.sources
      .map((source) => {
        if (source.error) return `${source.source}=ERRO`;
        if (source.rowCount === 0) return `${source.source}=0 linhas`;
        if (source.missingFields.length > 0) {
          return `${source.source}=sem ${source.missingFields.join(",")}`;
        }
        if (source.nullFieldsInSample.length > 0) {
          return `${source.source}=NULL ${source.nullFieldsInSample.join(",")}`;
        }
        return `${source.source}=${source.rowCount ?? "?"} linha(s)`;
      })
      .join("; ");
    console.log(
      `   ${row.status.padEnd(27)} ${row.id} [${row.contractStatus ?? "sem status"}] — ${row.name} — ${sourceSummary || "sem inputs declarados"}`,
    );
  }
}

function printReport(audits: ClientAudit[]): void {
  const bar = "═".repeat(67);
  console.log(
    `\n\n${bar}\n🔬 AUDITORIA: ${audits.length} CLIENTES (v4)\n${bar}`,
  );
  console.log(
    `Cobertura separada: ${EXPECTED_KPI_COUNT} KPIs do registry legado/KCR (não vigente) e ${EXPECTED_RUNTIME_KPI_COUNT} contratos do runtime-alpha. Verifica fontes, colunas e nulos na amostra; não executa fórmulas nem valida renderização visual.`,
  );
  console.log(
    "Ausência de linhas significa falta de evidência/dados para a fonte, não falha automática de aplicação (especialmente Ads).",
  );

  for (const a of audits) {
    const { clientName, profile, resolution, stats, byFormat } = a;
    console.log(
      `\n\n📊 ${clientName.toUpperCase()}${a.truncated ? "  ⚠️ DADO TRUNCADO" : ""}`,
    );
    console.log("─".repeat(65));

    console.log(`\n🏷️  PERFIL:`);
    console.log(
      `   Categoria: ${profile.benchmarkCategory ?? "(sem categoria)"}`,
    );
    console.log(
      `   Seguidores: ${profile.followers ?? "N/A"} | Tier (${profile.tierScheme}): ${profile.tier ?? "sem classificação"}`,
    );
    console.log(`   Fonte: ${profile.followersSource ?? "sem dado"}`);

    console.log(`\n🖥️  FONTES DE DADOS POR TELA:`);
    for (const source of a.screenData) {
      console.log(
        `   ${source.screen.padEnd(35)} ${source.relation}: ${source.rowCount ?? "ERRO"} linha(s), amostra ${source.sampleRows}${source.error ? ` — ${source.error}` : ""}`,
      );
    }

    printKpiCoverage(
      "KPIs do registry legado/KCR (não vigente)",
      a.kpiCoverage,
    );
    printKpiCoverage(
      "Contratos do runtime-alpha (vigentes e propostas)",
      a.runtimeKpiCoverage,
    );

    console.log(
      `\n🎯 THRESHOLD POR MÉTRICA (nível 1=cat+tier, 2=cat, 3=all, 4=global):`,
    );
    for (const r of resolution) {
      console.log(
        `   ${r.metric.padEnd(20)} ${r.level == null ? "SEM THRESHOLD" : `nível ${r.level} (id ${r.thresholdId}, ${r.validationStatus ?? "?"})`}`,
      );
    }

    console.log(`\n📈 POSTS: ${stats.total}`);
    console.log(
      `   Cruzamento confidence_level × reach (semântica a confirmar):`,
    );
    for (const lvl of ["L0", "L1", "L2"] as const) {
      const c = stats.byLevel[lvl];
      console.log(
        `   ${lvl}: ${c.total} (${pct(c.total, stats.total)}%) — com reach: ${c.withReach} (${pct(c.withReach, c.total)}%)`,
      );
    }
    if (stats.unknownLevel > 0) {
      console.log(
        `   🔴 ${stats.unknownLevel} post(s) com confidence_level fora de L0/L1/L2`,
      );
    }

    console.log(`\n📊 COBERTURA DE MÉTRICAS:`);
    for (const k of [
      "reach",
      "impressions",
      "likes",
      "comments",
      "shares",
      "saves",
    ] as const) {
      console.log(
        `   ${k.padEnd(12)} ${stats[k]}/${stats.total} (${pct(stats[k], stats.total)}%)`,
      );
    }

    console.log(`\n🚩 Métricas negativas: ${stats.negativeMetrics}`);
    console.log(
      `💰 Boost candidates: ${stats.boostCandidates} | Reach médio: ${stats.avgReach ?? "N/A"} | ER real médio: ${stats.avgErRealPct ?? "N/A"}% | Utility médio: ${stats.avgUtilityScorePct ?? "N/A"}%`,
    );

    console.log(`\n📱 POR FORMATO:`);
    for (const [fmt, f] of Object.entries(byFormat)) {
      console.log(
        `   ${fmt}: ${f.total} posts | L0:${f.byLevel.L0.total} L1:${f.byLevel.L1.total} L2:${f.byLevel.L2.total} | Reach médio: ${f.avgReach ?? "N/A"}`,
      );
    }

    if (a.samplesWithoutReach.length > 0) {
      console.log(`\n❌ EXEMPLOS SEM REACH:`);
      for (const p of a.samplesWithoutReach) {
        console.log(
          `   ${p.published_at} | ${p.content_format} | ${p.confidence_level} | ${p.caption}`,
        );
      }
    }
  }

  console.log(`\n\n${bar}\n📊 RESUMO COMPARATIVO\n${bar}`);
  console.log(
    `\n${"Cliente".padEnd(18)} ${"Tier".padEnd(7)} ${"Posts".padEnd(7)} ${"Reach%".padEnd(8)} ${"L0".padEnd(6)} ${"L1".padEnd(6)} ${"L2".padEnd(6)} Status`,
  );
  console.log("─".repeat(78));
  for (const a of audits) {
    const s = a.stats;
    console.log(
      `${a.clientName.padEnd(18)} ${(a.profile.tier ?? "-").padEnd(7)} ${String(s.total).padEnd(7)} ${pct(s.reach, s.total).padEnd(8)} ${String(s.byLevel.L0.total).padEnd(6)} ${String(s.byLevel.L1.total).padEnd(6)} ${String(s.byLevel.L2.total).padEnd(6)} ${statusOf(a)}`,
    );
  }

  printCoverage(audits);
}

function printCoverage(audits: ClientAudit[]): void {
  console.log(`\n📦 COBERTURA POR CATEGORIA E TIER (${TIER_SCHEME}):`);
  const groups = new Map<string, number>();
  for (const a of audits) {
    const key = `${a.profile.benchmarkCategory ?? "(sem categoria)"} / ${a.profile.tier ?? "sem classificação"}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [key, n] of groups) console.log(`   ${key}: ${n} cliente(s)`);

  console.log(`\n🎯 CASOS SEM THRESHOLD (cliente × métrica):`);
  let none = 0;
  for (const a of audits) {
    for (const r of a.resolution) {
      if (r.level == null) {
        none++;
        console.log(`   ${a.clientName} × ${r.metric}`);
      }
    }
  }
  if (none === 0) console.log("   nenhum");
}

function exportJSON(audits: ClientAudit[]): void {
  const output = {
    timestamp: new Date().toISOString(),
    tierScheme: TIER_SCHEME,
    kpiCoverage: {
      legacyRegistryExpected: EXPECTED_KPI_COUNT,
      legacyRegistryFile: "contracts/kpi/registry.json",
      legacyRegistrySemantics:
        "Artefato legado KCR; não representa o runtime vigente.",
      runtimeAlphaExpected: EXPECTED_RUNTIME_KPI_COUNT,
      runtimeAlphaFile: "contracts/kpi/runtime-alpha.json",
      scope:
        "Presença de fontes/colunas e nulos na amostra. Não calcula fórmulas nem confirma renderização visual.",
    },
    clients: audits.map((a) => ({
      name: a.clientName,
      id: a.clientId,
      truncated: a.truncated,
      profile: a.profile,
      resolution: a.resolution,
      screenData: a.screenData,
      kpiCoverage: a.kpiCoverage,
      runtimeKpiCoverage: a.runtimeKpiCoverage,
      stats: a.stats,
      byFormat: a.byFormat,
      samples: {
        withReach: a.samplesWithReach,
        withoutReach: a.samplesWithoutReach,
      },
    })),
  };
  fs.writeFileSync("audit-report.json", JSON.stringify(output, null, 2));
  console.log(`\n✅ Relatório salvo em audit-report.json`);
}

async function main() {
  try {
    const audits = await auditClients();
    printReport(audits);
    exportJSON(audits);
  } catch (err) {
    console.error("❌ Erro:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
