


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "orbit";


ALTER SCHEMA "orbit" OWNER TO "postgres";


CREATE TYPE "orbit"."ads_platform" AS ENUM (
    'meta',
    'google',
    'tiktok',
    'linkedin'
);


ALTER TYPE "orbit"."ads_platform" OWNER TO "postgres";


CREATE TYPE "orbit"."alert_severity" AS ENUM (
    'critical',
    'warning',
    'info',
    'success'
);


ALTER TYPE "orbit"."alert_severity" OWNER TO "postgres";


CREATE TYPE "orbit"."alert_type" AS ENUM (
    'ctr_below_threshold',
    'engagement_collapse',
    'avatar_misalignment',
    'creative_fatigue',
    'roas_below_minimum',
    'follower_churn_high',
    'polemic_score_high',
    'boost_opportunity',
    'budget_pace'
);


ALTER TYPE "orbit"."alert_type" OWNER TO "postgres";


CREATE TYPE "orbit"."asset_status" AS ENUM (
    'active',
    'paused',
    'archived',
    'draft',
    'under_review'
);


ALTER TYPE "orbit"."asset_status" OWNER TO "postgres";


CREATE TYPE "orbit"."campaign_objective" AS ENUM (
    'awareness',
    'reach',
    'traffic',
    'engagement',
    'leads',
    'app_promotion',
    'sales',
    'video_views'
);


ALTER TYPE "orbit"."campaign_objective" OWNER TO "postgres";


CREATE TYPE "orbit"."confidence_level" AS ENUM (
    'L0',
    'L1',
    'L2'
);


ALTER TYPE "orbit"."confidence_level" OWNER TO "postgres";


CREATE TYPE "orbit"."content_format" AS ENUM (
    'reel',
    'static_post',
    'carousel',
    'story',
    'live',
    'igtv'
);


ALTER TYPE "orbit"."content_format" OWNER TO "postgres";


CREATE TYPE "orbit"."fatigue_cause" AS ENUM (
    'creative_saturation',
    'segmentation_issue',
    'offer_issue',
    'healthy'
);


ALTER TYPE "orbit"."fatigue_cause" OWNER TO "postgres";


CREATE TYPE "orbit"."gender_category" AS ENUM (
    'male',
    'female',
    'non_binary',
    'mixed'
);


ALTER TYPE "orbit"."gender_category" OWNER TO "postgres";


CREATE TYPE "orbit"."health_status" AS ENUM (
    'healthy',
    'warning',
    'critical',
    'unknown'
);


ALTER TYPE "orbit"."health_status" OWNER TO "postgres";


CREATE TYPE "orbit"."ingest_script" AS ENUM (
    'ingest-l0-v2',
    'ingest-insights',
    'extract-demographics',
    'manual'
);


ALTER TYPE "orbit"."ingest_script" OWNER TO "postgres";


CREATE TYPE "orbit"."period_source" AS ENUM (
    'instagram_export',
    'meta_api',
    'google_ads_api',
    'ga4_api',
    'manual_input'
);


ALTER TYPE "orbit"."period_source" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "orbit"."check_churn_alert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'orbit', 'public'
    AS $$
DECLARE
  v_client        orbit.clients%ROWTYPE;
  v_monthly_churn NUMERIC;
BEGIN
  SELECT * INTO v_client FROM orbit.clients WHERE id = NEW.client_id;

  -- FIX-03: NEW.period_days agora existe (GENERATED na tabela)
  v_monthly_churn := NEW.follower_churn_pct
                     / NULLIF(NEW.period_days::NUMERIC / 30.0, 0);

  IF v_monthly_churn > v_client.threshold_churn_monthly_max THEN
    INSERT INTO orbit.alerts (
      client_id, alert_type, severity,
      metric_name, metric_value, threshold_value,
      snapshot_id, title, description, suggested_action,
      is_resolved
    )
    VALUES (
      NEW.client_id,
      'follower_churn_high',
      CASE
        WHEN v_monthly_churn > v_client.threshold_churn_monthly_max * 1.5
          THEN 'critical'
        ELSE 'warning'
      END::orbit.alert_severity,
      'follower_churn_monthly_pct',
      ROUND(v_monthly_churn, 2),
      v_client.threshold_churn_monthly_max,
      NEW.id,
      'Churn de seguidores acima do threshold',
      format('Churn mensal estimado: %s%% (threshold: %s%%)',
        ROUND(v_monthly_churn, 2), v_client.threshold_churn_monthly_max),
      'Verificar desalinhamento de avatar e conteúdo publicado no período',
      FALSE
    )
    -- FIX-06: ON CONFLICT agora especifica a constraint correta
    ON CONFLICT ON CONSTRAINT alerts_dedup
    DO UPDATE SET
      metric_value  = EXCLUDED.metric_value,
      severity      = EXCLUDED.severity,
      description   = EXCLUDED.description,
      created_at    = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "orbit"."check_churn_alert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "orbit"."compute_avatar_alignment"("p_client_id" "uuid", "p_audience_id" "uuid") RETURNS TABLE("gender_score" numeric, "age_score" numeric, "geo_score" numeric, "composite" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'orbit', 'public'
    AS $$
DECLARE
  v_client   orbit.clients%ROWTYPE;
  v_aud      orbit.ig_audience_snapshots%ROWTYPE;
  v_real_dom NUMERIC;
  v_age_sum  NUMERIC;
  v_geo_pct  NUMERIC;
  v_g_score  NUMERIC;
  v_a_score  NUMERIC;
  v_geo_scr  NUMERIC;
BEGIN
  SELECT * INTO v_client FROM orbit.clients WHERE id = p_client_id;
  SELECT * INTO v_aud    FROM orbit.ig_audience_snapshots WHERE id = p_audience_id;

  -- Gênero
  v_real_dom := CASE v_client.avatar_expected_gender
    WHEN 'male'   THEN COALESCE(v_aud.gender_male_pct,   0)
    WHEN 'female' THEN COALESCE(v_aud.gender_female_pct, 0)
    ELSE 50
  END;
  v_g_score := GREATEST(0,
    ROUND((1 - ABS(v_real_dom - COALESCE(v_client.avatar_expected_gender_pct, 50)) / 100.0) * 100, 2)
  );

  -- Idade: acumula % dentro do range esperado do cliente
  v_age_sum := 0;
  IF v_client.avatar_expected_age_min <= 17 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_13_17_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 24 AND v_client.avatar_expected_age_max >= 18 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_18_24_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 34 AND v_client.avatar_expected_age_max >= 25 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_25_34_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 44 AND v_client.avatar_expected_age_max >= 35 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_35_44_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 54 AND v_client.avatar_expected_age_max >= 45 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_45_54_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_max >= 55 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_55_plus_pct, 0);
  END IF;
  v_a_score := LEAST(100, GREATEST(0, ROUND(v_age_sum, 2)));

  -- Geo: busca % da cidade primária no JSONB
  -- 🔧 FIX: a chave real gravada pela ingestão é "name", não "city"
  SELECT COALESCE((
    SELECT (item->>'pct')::NUMERIC
    FROM jsonb_array_elements(v_aud.top_cities) AS item
    WHERE item->>'name' ILIKE '%' || v_client.avatar_expected_geo_primary || '%'
    LIMIT 1
  ), 0) INTO v_geo_pct;

  v_geo_scr := GREATEST(0,
    ROUND((1 - ABS(v_geo_pct - COALESCE(v_client.avatar_expected_geo_pct, 20)) / 100.0) * 100, 2)
  );

  RETURN QUERY SELECT
    v_g_score,
    v_a_score,
    v_geo_scr,
    ROUND((v_g_score * 0.4) + (v_a_score * 0.4) + (v_geo_scr * 0.2), 2);
END;
$$;


ALTER FUNCTION "orbit"."compute_avatar_alignment"("p_client_id" "uuid", "p_audience_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "orbit"."eval_boost_candidate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'orbit', 'public'
    AS $$
DECLARE
  v_followers_total INTEGER;
  v_shares_pct      NUMERIC;
  v_save_rate       NUMERIC;
  v_conditions      SMALLINT := 0;
BEGIN
  SELECT followers_total INTO v_followers_total
  FROM orbit.ig_account_snapshots
  WHERE client_id = NEW.client_id
  ORDER BY period_end DESC LIMIT 1;

  -- Condição 1: shares > 2% da base de seguidores
  IF v_followers_total > 0 AND COALESCE(NEW.shares, 0) > 0 THEN
    v_shares_pct := (NEW.shares::NUMERIC / v_followers_total) * 100;
    IF v_shares_pct > 2 THEN
      v_conditions := v_conditions + 1;
    END IF;
  END IF;

  -- Condição 2: save rate > 3% do alcance
  IF COALESCE(NEW.reach, 0) > 0 AND COALESCE(NEW.saves, 0) > 0 THEN
    v_save_rate := (NEW.saves::NUMERIC / NEW.reach) * 100;
    IF v_save_rate > 3 THEN
      v_conditions := v_conditions + 1;
    END IF;
  END IF;

  -- Condição 3: alcance não-seguidores > 40%
  -- (implementação futura — requer join com snapshot de alcance)

  NEW.boost_conditions_met := v_conditions;
  NEW.is_boost_candidate   := (v_conditions >= 1);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "orbit"."eval_boost_candidate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "orbit"."metric_has_negative_slope"("p_client_id" "uuid", "p_metric_name" "text", "p_platform" "text", "p_days" integer DEFAULT 14) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'orbit', 'public'
    AS $$
  WITH ordered AS (
    SELECT
      metric_date,
      metric_value,
      LAG(metric_value) OVER (ORDER BY metric_date) AS prev_value
    FROM orbit.metric_history
    WHERE client_id   = p_client_id
      AND metric_name = p_metric_name
      AND platform    = p_platform
    ORDER BY metric_date DESC
    LIMIT p_days
  )
  SELECT COALESCE(
    bool_and(metric_value < prev_value),
    FALSE
  )
  FROM ordered
  -- FIX-05: exclui a linha mais antiga onde prev_value é NULL
  WHERE prev_value IS NOT NULL;
$$;


ALTER FUNCTION "orbit"."metric_has_negative_slope"("p_client_id" "uuid", "p_metric_name" "text", "p_platform" "text", "p_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "orbit"."metric_has_negative_slope"("p_client_id" "uuid", "p_metric_name" "text", "p_platform" "text", "p_days" integer) IS 'R-06: TRUE se a métrica caiu por p_days consecutivos. FIX-05: filtra LAG NULL da primeira linha.';



CREATE OR REPLACE FUNCTION "orbit"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'orbit', 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "orbit"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "orbit"."ads_ga4_landing_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "page_path" "text" NOT NULL,
    "source_medium" "text",
    "sessions" integer,
    "engaged_sessions" integer,
    "bounce_rate_pct" numeric(5,2),
    "avg_session_sec" numeric(8,2),
    "scroll_depth_50_pct" numeric(5,2),
    "cta_clicks" integer,
    "conversions" integer,
    "conversion_rate_pct" numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ((COALESCE("sessions", 0) > 0) AND ("conversions" IS NOT NULL)) THEN "round"(((("conversions")::numeric / ("sessions")::numeric) * (100)::numeric), 2)
    ELSE NULL::numeric
END) STORED
);


ALTER TABLE "orbit"."ads_ga4_landing_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ads_google_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "google_campaign_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "channel_type" "text" NOT NULL,
    "objective" "orbit"."campaign_objective",
    "status" "orbit"."asset_status" DEFAULT 'active'::"orbit"."asset_status" NOT NULL,
    "daily_budget" numeric(12,2),
    "start_date" "date",
    "end_date" "date",
    CONSTRAINT "ads_google_campaigns_channel_type_check" CHECK (("channel_type" = ANY (ARRAY['SEARCH'::"text", 'DISPLAY'::"text", 'VIDEO'::"text", 'PERFORMANCE_MAX'::"text", 'SHOPPING'::"text"])))
);


ALTER TABLE "orbit"."ads_google_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ads_google_search_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "snapshot_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_term" "text" NOT NULL,
    "match_type" "text",
    "impressions" integer,
    "clicks" integer,
    "conversions" numeric(8,2),
    "cost" numeric(12,2),
    "cpc" numeric(10,4),
    "ctr_pct" numeric(7,4),
    "conversion_rate_pct" numeric(7,4),
    "cost_per_conversion" numeric(10,4),
    CONSTRAINT "ads_google_search_terms_match_type_check" CHECK (("match_type" = ANY (ARRAY['exact'::"text", 'phrase'::"text", 'broad'::"text"])))
);


ALTER TABLE "orbit"."ads_google_search_terms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ads_google_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "snapshot_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impressions" bigint,
    "impression_share" numeric(5,2),
    "lost_is_budget_pct" numeric(5,2),
    "lost_is_rank_pct" numeric(5,2),
    "clicks" bigint,
    "ctr_pct" numeric(7,4),
    "avg_cpc" numeric(10,4),
    "conversions" numeric(10,2),
    "cost_per_conversion" numeric(10,4),
    "conversion_rate_pct" numeric(7,4),
    "revenue" numeric(12,2),
    "spend" numeric(12,2),
    "roas" numeric(8,4) GENERATED ALWAYS AS (
CASE
    WHEN ((COALESCE("spend", (0)::numeric) > (0)::numeric) AND ("revenue" IS NOT NULL)) THEN "round"(("revenue" / "spend"), 4)
    ELSE NULL::numeric
END) STORED,
    "confidence_level" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL
);


ALTER TABLE "orbit"."ads_google_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ads_meta_adsets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta_adset_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "orbit"."asset_status" DEFAULT 'active'::"orbit"."asset_status" NOT NULL,
    "daily_budget" numeric(12,2),
    "targeting_summary" "jsonb",
    "optimization_goal" "text"
);


ALTER TABLE "orbit"."ads_meta_adsets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ads_meta_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta_campaign_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "objective" "orbit"."campaign_objective" NOT NULL,
    "status" "orbit"."asset_status" DEFAULT 'active'::"orbit"."asset_status" NOT NULL,
    "budget_monthly" numeric(12,2),
    "budget_lifetime" numeric(12,2),
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "orbit"."ads_meta_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ads_meta_creatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adset_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta_creative_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "format" "orbit"."content_format",
    "status" "orbit"."asset_status" DEFAULT 'active'::"orbit"."asset_status" NOT NULL,
    "thumbnail_url" "text",
    "ig_post_id" "uuid",
    "ctr_pct_week1" numeric(7,4),
    "ctr_pct_current" numeric(7,4),
    "frequency_current" numeric(6,3),
    "fatigue_score_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("ctr_pct_week1" > (0)::numeric) AND ("ctr_pct_current" IS NOT NULL)) THEN "round"(((("ctr_pct_week1" - "ctr_pct_current") / "ctr_pct_week1") * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "fatigue_cause" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("ctr_pct_week1" IS NULL) OR ("ctr_pct_current" IS NULL)) THEN 'healthy'::"text"
    WHEN ("ctr_pct_week1" <= (0)::numeric) THEN 'healthy'::"text"
    WHEN ((((("ctr_pct_week1" - "ctr_pct_current") / "ctr_pct_week1") * (100)::numeric) > (40)::numeric) AND ("frequency_current" > 2.5)) THEN 'creative_saturation'::"text"
    WHEN ((((("ctr_pct_week1" - "ctr_pct_current") / "ctr_pct_week1") * (100)::numeric) > (40)::numeric) AND (("frequency_current" IS NULL) OR ("frequency_current" <= 2.5))) THEN 'segmentation_issue'::"text"
    WHEN (((("ctr_pct_week1" - "ctr_pct_current") / "ctr_pct_week1") * (100)::numeric) > (20)::numeric) THEN 'offer_issue'::"text"
    ELSE 'healthy'::"text"
END) STORED,
    "creative_health" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("ctr_pct_week1" IS NULL) OR ("ctr_pct_current" IS NULL) OR ("ctr_pct_week1" <= (0)::numeric)) THEN 'healthy'::"text"
    WHEN (((("ctr_pct_week1" - "ctr_pct_current") / "ctr_pct_week1") * (100)::numeric) > (40)::numeric) THEN 'critical'::"text"
    WHEN (((("ctr_pct_week1" - "ctr_pct_current") / "ctr_pct_week1") * (100)::numeric) > (20)::numeric) THEN 'warning'::"text"
    ELSE 'healthy'::"text"
END) STORED,
    CONSTRAINT "chk_creative_health" CHECK (("creative_health" = ANY (ARRAY['healthy'::"text", 'warning'::"text", 'critical'::"text"]))),
    CONSTRAINT "chk_fatigue_cause" CHECK (("fatigue_cause" = ANY (ARRAY['healthy'::"text", 'creative_saturation'::"text", 'segmentation_issue'::"text", 'offer_issue'::"text"])))
);


ALTER TABLE "orbit"."ads_meta_creatives" OWNER TO "postgres";


COMMENT ON COLUMN "orbit"."ads_meta_creatives"."fatigue_score_pct" IS 'C-08: (CTR_s1 − CTR_atual)/CTR_s1 × 100. <20% healthy, 20–40% warning, >40% critical.';



COMMENT ON COLUMN "orbit"."ads_meta_creatives"."fatigue_cause" IS 'FIX-13: TEXT (não ENUM) — cast ENUM em GENERATED não é IMMUTABLE (err 42P17). Valores: healthy|creative_saturation|segmentation_issue|offer_issue.';



COMMENT ON COLUMN "orbit"."ads_meta_creatives"."creative_health" IS 'FIX-13: TEXT (não ENUM) — mesma razão. Valores: healthy|warning|critical. CHECK constraint garante integridade.';



CREATE TABLE IF NOT EXISTS "orbit"."ads_meta_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "adset_id" "uuid",
    "creative_id" "uuid",
    "snapshot_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impressions" bigint,
    "reach" bigint,
    "frequency" numeric(6,3),
    "spend" numeric(12,2),
    "clicks" bigint,
    "link_clicks" bigint,
    "ctr_pct" numeric(7,4),
    "cpc" numeric(10,4),
    "cpm" numeric(10,4),
    "results" integer,
    "result_type" "text",
    "cost_per_result" numeric(10,4),
    "revenue" numeric(12,2),
    "roas" numeric(8,4) GENERATED ALWAYS AS (
CASE
    WHEN ((COALESCE("spend", (0)::numeric) > (0)::numeric) AND ("revenue" IS NOT NULL)) THEN "round"(("revenue" / "spend"), 4)
    ELSE NULL::numeric
END) STORED,
    "budget_allocated" numeric(12,2),
    "budget_pct_used" numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ((COALESCE("budget_allocated", (0)::numeric) > (0)::numeric) AND ("spend" IS NOT NULL)) THEN "round"((("spend" / "budget_allocated") * (100)::numeric), 2)
    ELSE NULL::numeric
END) STORED,
    "confidence_level" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL
);


ALTER TABLE "orbit"."ads_meta_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "snoozed_until" timestamp with time zone,
    "alert_type" "orbit"."alert_type" NOT NULL,
    "severity" "orbit"."alert_severity" NOT NULL,
    "metric_name" "text",
    "metric_value" numeric,
    "threshold_value" numeric,
    "ig_post_id" "uuid",
    "meta_creative_id" "uuid",
    "meta_campaign_id" "uuid",
    "google_campaign_id" "uuid",
    "snapshot_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "suggested_action" "text",
    "action_url" "text",
    "is_resolved" boolean DEFAULT false NOT NULL,
    "is_snoozed" boolean DEFAULT false NOT NULL,
    "resolved_by" "text"
);


ALTER TABLE "orbit"."alerts" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."alerts" IS 'Central de alertas proativos (R-02). Alimentada por triggers e jobs periódicos.';



COMMENT ON COLUMN "orbit"."alerts"."action_url" IS 'Deep-link para o gerenciador de ads ou tela do sistema.';



CREATE TABLE IF NOT EXISTS "orbit"."avatar_validations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "validation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "observed_interest" "text",
    "observed_geo_primary" "text",
    "observed_geo_pct" numeric(5,2),
    "source" "text" NOT NULL,
    "confidence_level" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "avatar_validations_confidence_level_check" CHECK (("confidence_level" = ANY (ARRAY['L0'::"text", 'L1'::"text", 'L2'::"text"]))),
    CONSTRAINT "avatar_validations_source_check" CHECK (("source" = ANY (ARRAY['instagram_insights'::"text", 'client_feedback'::"text", 'manual'::"text"])))
);


ALTER TABLE "orbit"."avatar_validations" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."avatar_validations" IS 'Feedback qualitativo do cliente sobre interesse/geo real da audiência (Fase 3 do onboarding). Preenche o gap estrutural de real_interest em v_avatar_alignment, que o Instagram Insights não expõe.';



CREATE TABLE IF NOT EXISTS "orbit"."client_onboarding" (
    "client_id" "uuid" NOT NULL,
    "total_followers" integer NOT NULL,
    "total_followers_source" "text" NOT NULL,
    "bio_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cta_type" "text",
    "funnel_maturity" "text",
    "q1_engagement_period_notes" "text",
    "q2_content_proxy_notes" "text",
    "q3_misalignment_notes" "text",
    "audience_nucleo_fiel_pct" numeric(5,2),
    "audience_consumo_passivo_pct" numeric(5,2),
    "audience_curiosidade_externa_pct" numeric(5,2),
    "audience_alta_rotatividade_pct" numeric(5,2),
    "observed_content_clusters" "text",
    "setor_benchmark" "text",
    "nicho" "text",
    "proof_mechanism" "text",
    "expected_panksepp_system" "text",
    "real_panksepp_system" "text",
    "expected_schwartz" "jsonb",
    "real_schwartz" "jsonb",
    "values_affect_source" "text" DEFAULT 'manual'::"text",
    "values_affect_confidence" "text" DEFAULT 'L1'::"text",
    "updated_by" "text" DEFAULT 'pet'::"text",
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "audience_split_sum" CHECK ((("audience_nucleo_fiel_pct" IS NULL) OR ("abs"(((((COALESCE("audience_nucleo_fiel_pct", (0)::numeric) + COALESCE("audience_consumo_passivo_pct", (0)::numeric)) + COALESCE("audience_curiosidade_externa_pct", (0)::numeric)) + COALESCE("audience_alta_rotatividade_pct", (0)::numeric)) - (100)::numeric)) < 0.1))),
    CONSTRAINT "client_onboarding_cta_type_check" CHECK (("cta_type" = ANY (ARRAY['link_direto'::"text", 'linktree_multilink'::"text", 'dm_comentario'::"text", 'nenhum'::"text"]))),
    CONSTRAINT "client_onboarding_expected_panksepp_system_check" CHECK (("expected_panksepp_system" = ANY (ARRAY['SEEKING'::"text", 'CARE'::"text", 'PLAY'::"text", 'LUST'::"text", 'FEAR'::"text", 'RAGE'::"text", 'PANIC_GRIEF'::"text"]))),
    CONSTRAINT "client_onboarding_funnel_maturity_check" CHECK (("funnel_maturity" = ANY (ARRAY['nao_implementado'::"text", 'implementado_fragmentado'::"text", 'implementado_unificado'::"text"]))),
    CONSTRAINT "client_onboarding_proof_mechanism_check" CHECK (("proof_mechanism" = ANY (ARRAY['prova_social'::"text", 'autoridade'::"text", 'escassez_urgencia'::"text", 'associacao_marca'::"text", 'resultado_documentado'::"text", 'nenhum_observavel'::"text"]))),
    CONSTRAINT "client_onboarding_real_panksepp_system_check" CHECK (("real_panksepp_system" = ANY (ARRAY['SEEKING'::"text", 'CARE'::"text", 'PLAY'::"text", 'LUST'::"text", 'FEAR'::"text", 'RAGE'::"text", 'PANIC_GRIEF'::"text"]))),
    CONSTRAINT "client_onboarding_setor_benchmark_check" CHECK (("setor_benchmark" = ANY (ARRAY['comercio_direto_ecommerce_social'::"text", 'comissionamento_afiliados'::"text", 'infoprodutor_educador_pago'::"text", 'servico_consultoria_profissional'::"text", 'patrocinio_publicidade_marca'::"text", 'membership_assinatura_comunidade'::"text", 'monetizacao_nativa_plataforma'::"text", 'autoridade_personal_branding_b2b'::"text", 'pre_monetizacao_a_validar'::"text"]))),
    CONSTRAINT "client_onboarding_total_followers_source_check" CHECK (("total_followers_source" = ANY (ARRAY['manual_print_confirmado'::"text", 'instagram_api'::"text", 'estimate'::"text"]))),
    CONSTRAINT "client_onboarding_values_affect_confidence_check" CHECK (("values_affect_confidence" = ANY (ARRAY['L0'::"text", 'L1'::"text", 'L2'::"text"]))),
    CONSTRAINT "client_onboarding_values_affect_source_check" CHECK (("values_affect_source" = ANY (ARRAY['onboarding'::"text", 'client_feedback'::"text", 'manual'::"text"])))
);


ALTER TABLE "orbit"."client_onboarding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."client_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "title" "text" NOT NULL,
    "visible_metrics" "jsonb",
    "wins_narrative" "text",
    "priorities" "jsonb",
    "manager_note" "text",
    "hide_internal_metrics" boolean DEFAULT true NOT NULL,
    "pdf_url" "text",
    "exported_at" timestamp with time zone
);


ALTER TABLE "orbit"."client_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "segment" "text",
    "instagram_user_id" "text",
    "ig_username" "text",
    "ig_display_name" "text",
    "business_objective" "text",
    "gross_margin_pct" numeric(5,2),
    "monthly_ad_budget" numeric(12,2),
    "avatar_expected_gender" "orbit"."gender_category",
    "avatar_expected_gender_pct" numeric(5,2),
    "avatar_expected_age_min" smallint,
    "avatar_expected_age_max" smallint,
    "avatar_expected_geo_primary" "text",
    "avatar_expected_geo_pct" numeric(5,2),
    "avatar_unconscious_desire" "text",
    "threshold_ctr_bio_min" numeric(5,2) DEFAULT 3.0,
    "threshold_ctr_ads_min" numeric(5,2) DEFAULT 1.0,
    "threshold_ctr_search_min" numeric(5,2) DEFAULT 2.0,
    "threshold_cpa_max_multiplier" numeric(5,2) DEFAULT 1.5,
    "threshold_churn_monthly_max" numeric(5,2) DEFAULT 1.5,
    "threshold_fatigue_critical" numeric(5,2) DEFAULT 40.0,
    "threshold_frequency_max" numeric(5,2) DEFAULT 2.5,
    "threshold_er_real_min" numeric(5,2) DEFAULT 0.5,
    "threshold_polemic_max" numeric(5,2) DEFAULT 20.0,
    "threshold_utility_min" numeric(5,2) DEFAULT 2.0,
    "threshold_avatar_alignment_min" numeric(5,2) DEFAULT 70.0,
    "health_status" "orbit"."health_status" DEFAULT 'healthy'::"orbit"."health_status" NOT NULL,
    "health_updated_at" timestamp with time zone,
    "subscription_id" "uuid",
    "avatar_expected_interest" "text",
    "avatar_alignment_hypothesis" "text",
    CONSTRAINT "clients_age_range" CHECK (("avatar_expected_age_min" < "avatar_expected_age_max")),
    CONSTRAINT "clients_margin_range" CHECK ((("gross_margin_pct" >= (0)::numeric) AND ("gross_margin_pct" <= (100)::numeric)))
);


ALTER TABLE "orbit"."clients" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."clients" IS 'Carteira de clientes — Camada 1 do sistema. SSOT de contexto de negócio e thresholds.';



COMMENT ON COLUMN "orbit"."clients"."ig_username" IS 'Fonte: personal_information.json → profile_user[0].string_map_data.Username.value';



COMMENT ON COLUMN "orbit"."clients"."gross_margin_pct" IS 'Usado em C-04: ROAS_mínimo = 1 / (gross_margin_pct / 100)';



COMMENT ON COLUMN "orbit"."clients"."avatar_unconscious_desire" IS 'Desejo inconsciente hipotetizado do público (distinto de avatar_expected_interest).';



COMMENT ON COLUMN "orbit"."clients"."avatar_expected_interest" IS 'Interesse principal esperado do avatar (ex: "Performance esportiva"). Distinto de avatar_unconscious_desire.';



COMMENT ON COLUMN "orbit"."clients"."avatar_alignment_hypothesis" IS 'Hipótese analítica/interpretativa sobre o desalinhamento observado, curada manualmente pela agência.';



CREATE TABLE IF NOT EXISTS "orbit"."funnel_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "alcance" integer DEFAULT 0 NOT NULL,
    "visitas" integer DEFAULT 0 NOT NULL,
    "cliques" integer,
    "vendas" integer,
    "ctr_bio" numeric DEFAULT 0 NOT NULL,
    "taxa_conv" numeric DEFAULT 0 NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "orbit"."funnel_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."ig_account_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "import_session" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "period_days" smallint GENERATED ALWAYS AS (("period_end" - "period_start")) STORED,
    "period_source" "orbit"."period_source" DEFAULT 'instagram_export'::"orbit"."period_source" NOT NULL,
    "followers_total" integer,
    "followers_new" integer,
    "followers_lost" integer,
    "followers_net" integer GENERATED ALWAYS AS (("followers_new" - "followers_lost")) STORED,
    "followers_confidence" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL,
    "reach_total" integer,
    "reach_followers_pct" numeric(5,2),
    "reach_non_followers" integer GENERATED ALWAYS AS (
CASE
    WHEN (("reach_total" IS NOT NULL) AND ("reach_followers_pct" IS NOT NULL)) THEN ("round"((("reach_total")::numeric * ((1)::numeric - ("reach_followers_pct" / (100)::numeric)))))::integer
    ELSE NULL::integer
END) STORED,
    "reach_confidence" "orbit"."confidence_level" DEFAULT 'L1'::"orbit"."confidence_level" NOT NULL,
    "impressions_total" integer,
    "impressions_confidence" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL,
    "interactions_likes" integer,
    "interactions_comments" integer,
    "interactions_shares" integer,
    "interactions_saves" integer,
    "interactions_confidence" "orbit"."confidence_level" DEFAULT 'L1'::"orbit"."confidence_level" NOT NULL,
    "profile_visits" integer,
    "link_clicks" integer,
    "link_ctr_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("profile_visits" > 0) AND ("link_clicks" IS NOT NULL)) THEN "round"(((("link_clicks")::numeric / ("profile_visits")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "er_real_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("reach_total" > 0) AND ("interactions_saves" IS NOT NULL) AND ("interactions_shares" IS NOT NULL) AND ("interactions_comments" IS NOT NULL)) THEN "round"(((((("interactions_saves" + "interactions_shares") + "interactions_comments"))::numeric / ("reach_total")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "utility_score_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("reach_total" > 0) AND ("interactions_saves" IS NOT NULL) AND ("interactions_shares" IS NOT NULL)) THEN "round"((((("interactions_saves" + "interactions_shares"))::numeric / ("reach_total")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "polemic_score_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("interactions_likes" > 0) AND ("interactions_comments" IS NOT NULL)) THEN "round"(((("interactions_comments")::numeric / ("interactions_likes")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "vps_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("followers_total" > 0) AND ("reach_followers_pct" IS NOT NULL) AND ("reach_total" IS NOT NULL)) THEN "round"(((((("reach_total")::numeric * "reach_followers_pct") / (100)::numeric) / ("followers_total")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "follower_churn_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("followers_total" IS NOT NULL) AND ("followers_lost" IS NOT NULL) AND ("followers_new" IS NOT NULL) AND ((("followers_total" + "followers_lost") - "followers_new") > 0)) THEN "round"(((("followers_lost")::numeric / ((("followers_total" + "followers_lost") - "followers_new"))::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    CONSTRAINT "ig_snap_period" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "orbit"."ig_account_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."ig_account_snapshots" IS 'KPIs de conta agregados por período. Uma linha por janela temporal por cliente.';



COMMENT ON COLUMN "orbit"."ig_account_snapshots"."period_days" IS 'FIX-03: GENERATED de (period_end - period_start). Usada em check_churn_alert para normalização mensal.';



COMMENT ON COLUMN "orbit"."ig_account_snapshots"."er_real_pct" IS 'C-01: (saves+shares+comments)/alcance×100. Threshold vermelho: <0.5%';



COMMENT ON COLUMN "orbit"."ig_account_snapshots"."polemic_score_pct" IS 'R-05: comentários/curtidas×100. Threshold crítico: >20%';



COMMENT ON COLUMN "orbit"."ig_account_snapshots"."vps_pct" IS 'C-02: alcance de seguidores/total_seguidores×100. Threshold: <40% → queda algorítmica';



CREATE TABLE IF NOT EXISTS "orbit"."ig_audience_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "import_session" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "gender_female_pct" numeric(5,2),
    "gender_male_pct" numeric(5,2),
    "gender_other_pct" numeric(5,2),
    "age_13_17_pct" numeric(5,2),
    "age_18_24_pct" numeric(5,2),
    "age_25_34_pct" numeric(5,2),
    "age_35_44_pct" numeric(5,2),
    "age_45_54_pct" numeric(5,2),
    "age_55_plus_pct" numeric(5,2),
    "top_cities" "jsonb",
    "top_countries" "jsonb",
    "confidence_level" "orbit"."confidence_level" DEFAULT 'L1'::"orbit"."confidence_level" NOT NULL,
    "avatar_gender_alignment_score" numeric(5,2),
    "avatar_age_alignment_score" numeric(5,2),
    "avatar_geo_alignment_score" numeric(5,2),
    "avatar_composite_score" numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (("avatar_gender_alignment_score" IS NOT NULL) AND ("avatar_age_alignment_score" IS NOT NULL) AND ("avatar_geo_alignment_score" IS NOT NULL)) THEN "round"(((("avatar_gender_alignment_score" * 0.4) + ("avatar_age_alignment_score" * 0.4)) + ("avatar_geo_alignment_score" * 0.2)), 2)
    ELSE NULL::numeric
END) STORED,
    CONSTRAINT "ig_aud_gender_sum" CHECK ((((COALESCE("gender_female_pct", (0)::numeric) + COALESCE("gender_male_pct", (0)::numeric)) + COALESCE("gender_other_pct", (0)::numeric)) <= (101)::numeric)),
    CONSTRAINT "ig_aud_period" CHECK (("period_end" >= "period_start"))
);


ALTER TABLE "orbit"."ig_audience_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."ig_audience_snapshots" IS 'Demographics da audiência por período. Fonte: audience_insights.json.';



COMMENT ON COLUMN "orbit"."ig_audience_snapshots"."avatar_gender_alignment_score" IS 'Preenchido por orbit.compute_avatar_alignment(). Não é GENERATED — depende de clients.';



COMMENT ON COLUMN "orbit"."ig_audience_snapshots"."avatar_composite_score" IS 'C-05: (gender×0.4)+(age×0.4)+(geo×0.2). Threshold: <70 crítico, 70–85 atenção, >85 saudável.';



CREATE TABLE IF NOT EXISTS "orbit"."ig_import_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "export_zip_hash" "text",
    "export_period_start" "date",
    "export_period_end" "date",
    "period_days" smallint GENERATED ALWAYS AS (("export_period_end" - "export_period_start")) STORED,
    "scripts_run" "orbit"."ingest_script"[],
    "files_processed" "text"[],
    "files_missing" "text"[],
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_log" "text",
    "processed_at" timestamp with time zone,
    CONSTRAINT "ig_import_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "orbit"."ig_import_sessions" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."ig_import_sessions" IS 'Rastreia cada execução de ingestão de ZIP export Instagram. Uma sessão por ZIP.';



COMMENT ON COLUMN "orbit"."ig_import_sessions"."export_period_start" IS 'Fonte: audience_insights.json → string_map_data[''Intervalo de datas''].value (PT-BR)';



CREATE TABLE IF NOT EXISTS "orbit"."ig_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "import_session" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ig_post_uri" "text" NOT NULL,
    "ig_shortcode" "text",
    "published_at" timestamp with time zone NOT NULL,
    "content_format" "orbit"."content_format" NOT NULL,
    "caption" "text",
    "reach" integer,
    "impressions" integer,
    "likes" integer,
    "comments" integer,
    "shares" integer,
    "saves" integer,
    "profile_visits_from" integer,
    "follows_from" integer,
    "reel_duration_sec" smallint,
    "reel_plays" integer,
    "reel_avg_watch_sec" numeric(6,2),
    "er_real_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("reach" > 0) AND ("saves" IS NOT NULL) AND ("shares" IS NOT NULL) AND ("comments" IS NOT NULL)) THEN "round"(((((("saves" + "shares") + "comments"))::numeric / ("reach")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "polemic_score_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("likes" > 0) AND ("comments" IS NOT NULL)) THEN "round"(((("comments")::numeric / ("likes")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "utility_score_pct" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN (("reach" > 0) AND ("saves" IS NOT NULL) AND ("shares" IS NOT NULL)) THEN "round"((((("saves" + "shares"))::numeric / ("reach")::numeric) * (100)::numeric), 4)
    ELSE NULL::numeric
END) STORED,
    "is_boost_candidate" boolean DEFAULT false NOT NULL,
    "boost_conditions_met" smallint DEFAULT 0 NOT NULL,
    "confidence_level" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL,
    CONSTRAINT "ig_posts_non_neg" CHECK (((COALESCE("likes", 0) >= 0) AND (COALESCE("shares", 0) >= 0) AND (COALESCE("saves", 0) >= 0) AND (COALESCE("comments", 0) >= 0)))
);


ALTER TABLE "orbit"."ig_posts" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."ig_posts" IS 'Um registro por post orgânico publicado. Fonte primária: posts.json e posts_1.json.';



COMMENT ON COLUMN "orbit"."ig_posts"."is_boost_candidate" IS 'R-07: TRUE se shares>2% base OU save_rate>3% OU não-seg alcance>40%. Atualizado por trigger.';



CREATE TABLE IF NOT EXISTS "orbit"."metric_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metric_date" "date" NOT NULL,
    "metric_name" "text" NOT NULL,
    "metric_value" numeric NOT NULL,
    "platform" "text" NOT NULL,
    "confidence_level" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL,
    "source_snapshot_id" "uuid",
    CONSTRAINT "metric_history_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'meta_ads'::"text", 'google_ads'::"text", 'ga4'::"text"])))
);


ALTER TABLE "orbit"."metric_history" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."metric_history" IS 'Série temporal de KPIs para sparklines (R-06). Slope negativo 14d → alerta R-02.';



CREATE TABLE IF NOT EXISTS "orbit"."raw_ig_ingest" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "import_session" "uuid" NOT NULL,
    "ingested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_file" "text" NOT NULL,
    "source_key" "text" NOT NULL,
    "ingest_script" "orbit"."ingest_script" NOT NULL,
    "raw_payload" "jsonb" NOT NULL,
    "confidence_level" "orbit"."confidence_level" DEFAULT 'L0'::"orbit"."confidence_level" NOT NULL,
    "parsed" boolean DEFAULT false NOT NULL,
    "parse_error" "text",
    "parsed_into" "text"
);


ALTER TABLE "orbit"."raw_ig_ingest" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."raw_ig_ingest" IS 'Preserva payloads brutos dos exports Instagram. Permite reprocessamento sem re-upload.';



CREATE TABLE IF NOT EXISTS "orbit"."ref_export_file_catalog" (
    "id" integer NOT NULL,
    "filename" "text" NOT NULL,
    "status" "text" NOT NULL,
    "ingest_script" "orbit"."ingest_script",
    "destination_table" "text",
    "confidence_level" "orbit"."confidence_level",
    "mrr_refs" "text"[],
    "root_key" "text",
    "notes" "text",
    CONSTRAINT "ref_export_file_catalog_status_check" CHECK (("status" = ANY (ARRAY['pipeline'::"text", 'potential'::"text", 'ignore'::"text"])))
);


ALTER TABLE "orbit"."ref_export_file_catalog" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "orbit"."ref_export_file_catalog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "orbit"."ref_export_file_catalog_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "orbit"."ref_export_file_catalog_id_seq" OWNED BY "orbit"."ref_export_file_catalog"."id";



CREATE TABLE IF NOT EXISTS "orbit"."ref_thresholds" (
    "id" integer NOT NULL,
    "metric_name" "text" NOT NULL,
    "green_min" numeric,
    "green_max" numeric,
    "amber_min" numeric,
    "amber_max" numeric,
    "red_min" numeric,
    "red_max" numeric,
    "unit" "text",
    "formula" "text",
    "mrr_ref" "text",
    "notes" "text"
);


ALTER TABLE "orbit"."ref_thresholds" OWNER TO "postgres";


COMMENT ON TABLE "orbit"."ref_thresholds" IS 'SSOT de todos os thresholds. green/amber/red: min=piso, max=teto (NULL=sem limite nessa direção).';



CREATE SEQUENCE IF NOT EXISTS "orbit"."ref_thresholds_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "orbit"."ref_thresholds_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "orbit"."ref_thresholds_id_seq" OWNED BY "orbit"."ref_thresholds"."id";



CREATE TABLE IF NOT EXISTS "orbit"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "plan" character varying(50) NOT NULL,
    "price_monthly" numeric(10,2) NOT NULL,
    "max_clients" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_plan_check" CHECK ((("plan")::"text" = ANY ((ARRAY['plano1'::character varying, 'plano2'::character varying, 'plano3'::character varying])::"text"[])))
);


ALTER TABLE "orbit"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "orbit"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "is_super_admin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "orbit"."user_subscriptions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_alerts" WITH ("security_invoker"='on') AS
 SELECT "a"."id",
    "a"."client_id" AS "clientId",
    "c"."name" AS "clientName",
    "c"."handle" AS "clientHandle",
    "a"."title",
    COALESCE("a"."description", ''::"text") AS "description",
        CASE "a"."severity"
            WHEN 'success'::"orbit"."alert_severity" THEN 'info'::"text"
            ELSE ("a"."severity")::"text"
        END AS "severity",
    "a"."created_at" AS "createdAt",
    "a"."is_resolved",
    "a"."is_snoozed"
   FROM ("orbit"."alerts" "a"
     JOIN "orbit"."clients" "c" ON (("c"."id" = "a"."client_id")));


ALTER VIEW "orbit"."v_alerts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_audience_alignment" AS
 SELECT "id",
    "client_id",
    "period_start",
    "period_end",
    "avatar_composite_score",
        CASE
            WHEN ("avatar_composite_score" >= (85)::numeric) THEN 'healthy'::"orbit"."health_status"
            WHEN ("avatar_composite_score" >= (70)::numeric) THEN 'warning'::"orbit"."health_status"
            ELSE 'critical'::"orbit"."health_status"
        END AS "avatar_alignment_status"
   FROM "orbit"."ig_audience_snapshots";


ALTER VIEW "orbit"."v_audience_alignment" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_avatar_alignment" AS
 SELECT "c"."id",
    "c"."id" AS "client_id",
        CASE
            WHEN ("c"."avatar_expected_gender" = 'male'::"orbit"."gender_category") THEN COALESCE("c"."avatar_expected_gender_pct", (50)::numeric)
            WHEN ("c"."avatar_expected_gender" = 'female'::"orbit"."gender_category") THEN ((100)::numeric - COALESCE("c"."avatar_expected_gender_pct", (50)::numeric))
            ELSE (50)::numeric
        END AS "expected_gender_male",
        CASE
            WHEN ("c"."avatar_expected_gender" = 'male'::"orbit"."gender_category") THEN ((100)::numeric - COALESCE("c"."avatar_expected_gender_pct", (50)::numeric))
            WHEN ("c"."avatar_expected_gender" = 'female'::"orbit"."gender_category") THEN COALESCE("c"."avatar_expected_gender_pct", (50)::numeric)
            ELSE (50)::numeric
        END AS "expected_gender_female",
    "concat"(COALESCE(("c"."avatar_expected_age_min")::"text", '18'::"text"), '–', COALESCE(("c"."avatar_expected_age_max")::"text", '65'::"text")) AS "expected_age_range",
    "c"."avatar_expected_geo_primary" AS "expected_geo",
    COALESCE("c"."avatar_expected_geo_pct", (100)::numeric) AS "expected_geo_pct",
    "c"."avatar_unconscious_desire" AS "expected_interest",
    "aud"."gender_male_pct" AS "real_gender_male",
    "aud"."gender_female_pct" AS "real_gender_female",
        CASE
            WHEN (GREATEST(COALESCE("aud"."age_18_24_pct", (0)::numeric), COALESCE("aud"."age_25_34_pct", (0)::numeric), COALESCE("aud"."age_35_44_pct", (0)::numeric), COALESCE("aud"."age_45_54_pct", (0)::numeric), COALESCE("aud"."age_55_plus_pct", (0)::numeric)) = COALESCE("aud"."age_18_24_pct", (0)::numeric)) THEN '18–24'::"text"
            WHEN (GREATEST(COALESCE("aud"."age_18_24_pct", (0)::numeric), COALESCE("aud"."age_25_34_pct", (0)::numeric), COALESCE("aud"."age_35_44_pct", (0)::numeric), COALESCE("aud"."age_45_54_pct", (0)::numeric), COALESCE("aud"."age_55_plus_pct", (0)::numeric)) = COALESCE("aud"."age_25_34_pct", (0)::numeric)) THEN '25–34'::"text"
            WHEN (GREATEST(COALESCE("aud"."age_18_24_pct", (0)::numeric), COALESCE("aud"."age_25_34_pct", (0)::numeric), COALESCE("aud"."age_35_44_pct", (0)::numeric), COALESCE("aud"."age_45_54_pct", (0)::numeric), COALESCE("aud"."age_55_plus_pct", (0)::numeric)) = COALESCE("aud"."age_35_44_pct", (0)::numeric)) THEN '35–44'::"text"
            WHEN (GREATEST(COALESCE("aud"."age_18_24_pct", (0)::numeric), COALESCE("aud"."age_25_34_pct", (0)::numeric), COALESCE("aud"."age_35_44_pct", (0)::numeric), COALESCE("aud"."age_45_54_pct", (0)::numeric), COALESCE("aud"."age_55_plus_pct", (0)::numeric)) = COALESCE("aud"."age_45_54_pct", (0)::numeric)) THEN '45–54'::"text"
            ELSE '55+'::"text"
        END AS "real_age_range",
    (("aud"."top_cities" -> 0) ->> 'name'::"text") AS "real_geo",
    ((("aud"."top_cities" -> 0) ->> 'pct'::"text"))::numeric AS "real_geo_pct",
    COALESCE("aud"."avatar_composite_score", (0)::numeric) AS "alignment_score",
        CASE
            WHEN ("aud"."id" IS NULL) THEN 'warning'::"orbit"."health_status"
            WHEN (COALESCE("aud"."avatar_composite_score", (0)::numeric) >= (85)::numeric) THEN 'healthy'::"orbit"."health_status"
            WHEN (COALESCE("aud"."avatar_composite_score", (0)::numeric) >= (70)::numeric) THEN 'warning'::"orbit"."health_status"
            ELSE 'critical'::"orbit"."health_status"
        END AS "alignment_status",
    "c"."handle",
    "c"."name",
    NULL::"text" AS "real_interest"
   FROM ("orbit"."clients" "c"
     LEFT JOIN LATERAL ( SELECT "ig_audience_snapshots"."id",
            "ig_audience_snapshots"."client_id",
            "ig_audience_snapshots"."gender_female_pct",
            "ig_audience_snapshots"."gender_male_pct",
            "ig_audience_snapshots"."age_18_24_pct",
            "ig_audience_snapshots"."age_25_34_pct",
            "ig_audience_snapshots"."age_35_44_pct",
            "ig_audience_snapshots"."age_45_54_pct",
            "ig_audience_snapshots"."age_55_plus_pct",
            "ig_audience_snapshots"."top_cities",
            "ig_audience_snapshots"."avatar_composite_score",
            "ig_audience_snapshots"."period_end"
           FROM "orbit"."ig_audience_snapshots"
          WHERE ("ig_audience_snapshots"."client_id" = "c"."id")
          ORDER BY "ig_audience_snapshots"."period_end" DESC
         LIMIT 1) "aud" ON (true));


ALTER VIEW "orbit"."v_avatar_alignment" OWNER TO "postgres";


COMMENT ON VIEW "orbit"."v_avatar_alignment" IS 'Avatar esperado (orbit.clients) × audiência real (orbit.ig_audience_snapshots). Snapshot mais recente via LATERAL JOIN. alignment_status=warning quando sem snapshot (evita enum unknown inexistente).';



CREATE OR REPLACE VIEW "orbit"."v_boost_candidates" AS
 SELECT "p"."id",
    "p"."client_id",
    "c"."name" AS "client_name",
    "p"."ig_post_uri",
    "p"."content_format",
    "p"."published_at",
    "p"."shares",
    "p"."saves",
    "p"."reach",
    "p"."utility_score_pct",
    "p"."boost_conditions_met",
    "s"."followers_total",
    "round"(((("p"."shares")::numeric / (NULLIF("s"."followers_total", 0))::numeric) * (100)::numeric), 2) AS "shares_pct_of_base"
   FROM (("orbit"."ig_posts" "p"
     JOIN "orbit"."clients" "c" ON (("c"."id" = "p"."client_id")))
     LEFT JOIN LATERAL ( SELECT "ig_account_snapshots"."followers_total"
           FROM "orbit"."ig_account_snapshots"
          WHERE ("ig_account_snapshots"."client_id" = "p"."client_id")
          ORDER BY "ig_account_snapshots"."period_end" DESC
         LIMIT 1) "s" ON (true))
  WHERE ("p"."is_boost_candidate" = true)
  ORDER BY "p"."boost_conditions_met" DESC, "p"."published_at" DESC;


ALTER VIEW "orbit"."v_boost_candidates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_client_health" AS
SELECT
    NULL::"uuid" AS "client_id",
    NULL::"text" AS "handle",
    NULL::"text" AS "avatar_name",
    NULL::bigint AS "metric_count",
    NULL::numeric(5,2) AS "avg_quality_score",
    NULL::"text" AS "health_status",
    NULL::timestamp with time zone AS "last_updated",
    NULL::integer AS "days_since_update",
    NULL::"orbit"."confidence_level" AS "max_confidence_level";


ALTER VIEW "orbit"."v_client_health" OWNER TO "postgres";


COMMENT ON VIEW "orbit"."v_client_health" IS 'Client Health — Status agregado de saúde (healthy/warning/critical) por cliente.';



CREATE OR REPLACE VIEW "orbit"."v_client_metrics" AS
 SELECT "c"."id",
    "c"."name",
    "c"."handle",
    "c"."segment",
    "c"."health_status",
    "c"."monthly_ad_budget",
    "c"."gross_margin_pct",
    "snap"."followers_total",
    "snap"."followers_net" AS "follower_balance",
    "snap"."er_real_pct" AS "engagement_real",
    "snap"."link_ctr_pct" AS "ctr_link",
    "snap"."polemic_score_pct",
    "snap"."follower_churn_pct",
    "snap"."utility_score_pct",
    "snap"."vps_pct",
    "snap"."period_start",
    "snap"."period_end"
   FROM ("orbit"."clients" "c"
     LEFT JOIN LATERAL ( SELECT "ig_account_snapshots"."id",
            "ig_account_snapshots"."client_id",
            "ig_account_snapshots"."import_session",
            "ig_account_snapshots"."created_at",
            "ig_account_snapshots"."period_start",
            "ig_account_snapshots"."period_end",
            "ig_account_snapshots"."period_days",
            "ig_account_snapshots"."period_source",
            "ig_account_snapshots"."followers_total",
            "ig_account_snapshots"."followers_new",
            "ig_account_snapshots"."followers_lost",
            "ig_account_snapshots"."followers_net",
            "ig_account_snapshots"."followers_confidence",
            "ig_account_snapshots"."reach_total",
            "ig_account_snapshots"."reach_followers_pct",
            "ig_account_snapshots"."reach_non_followers",
            "ig_account_snapshots"."reach_confidence",
            "ig_account_snapshots"."impressions_total",
            "ig_account_snapshots"."impressions_confidence",
            "ig_account_snapshots"."interactions_likes",
            "ig_account_snapshots"."interactions_comments",
            "ig_account_snapshots"."interactions_shares",
            "ig_account_snapshots"."interactions_saves",
            "ig_account_snapshots"."interactions_confidence",
            "ig_account_snapshots"."profile_visits",
            "ig_account_snapshots"."link_clicks",
            "ig_account_snapshots"."link_ctr_pct",
            "ig_account_snapshots"."er_real_pct",
            "ig_account_snapshots"."utility_score_pct",
            "ig_account_snapshots"."polemic_score_pct",
            "ig_account_snapshots"."vps_pct",
            "ig_account_snapshots"."follower_churn_pct"
           FROM "orbit"."ig_account_snapshots"
          WHERE ("ig_account_snapshots"."client_id" = "c"."id")
          ORDER BY "ig_account_snapshots"."period_end" DESC
         LIMIT 1) "snap" ON (true));


ALTER VIEW "orbit"."v_client_metrics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_creative_fatigue" AS
 SELECT "cr"."id",
    "cr"."client_id",
    "c"."name" AS "client_name",
    "cr"."name" AS "creative_name",
    "cr"."format",
    "cr"."status",
    "cr"."ctr_pct_week1",
    "cr"."ctr_pct_current",
    "cr"."frequency_current",
    "cr"."fatigue_score_pct",
    "cr"."fatigue_cause",
    "cr"."creative_health",
    "cl"."threshold_fatigue_critical",
    "cl"."threshold_frequency_max",
    "s"."name" AS "adset_name",
    "camp"."name" AS "campaign_name",
    "camp"."objective"
   FROM (((("orbit"."ads_meta_creatives" "cr"
     JOIN "orbit"."ads_meta_adsets" "s" ON (("s"."id" = "cr"."adset_id")))
     JOIN "orbit"."ads_meta_campaigns" "camp" ON (("camp"."id" = "s"."campaign_id")))
     JOIN "orbit"."clients" "cl" ON (("cl"."id" = "cr"."client_id")))
     JOIN "orbit"."clients" "c" ON (("c"."id" = "cr"."client_id")))
  WHERE ("cr"."status" = 'active'::"orbit"."asset_status")
  ORDER BY "cr"."fatigue_score_pct" DESC NULLS LAST;


ALTER VIEW "orbit"."v_creative_fatigue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_format_performance" WITH ("security_invoker"='on') AS
 SELECT ("array_agg"("id"))[1] AS "id",
    "client_id",
    ("min"("published_at"))::"date" AS "period_start",
    ("max"("published_at"))::"date" AS "period_end",
        CASE "content_format"
            WHEN 'reel'::"orbit"."content_format" THEN 'Reels'::"text"
            WHEN 'story'::"orbit"."content_format" THEN 'Stories'::"text"
            WHEN 'static_post'::"orbit"."content_format" THEN 'Estático'::"text"
            WHEN 'carousel'::"orbit"."content_format" THEN 'Carrossel'::"text"
            WHEN 'live'::"orbit"."content_format" THEN 'Live'::"text"
            WHEN 'igtv'::"orbit"."content_format" THEN 'IGTV'::"text"
            ELSE NULL::"text"
        END AS "format_name",
    "count"(*) AS "post_count",
    COALESCE("sum"("shares"), (0)::bigint) AS "share_count",
    COALESCE("sum"("saves"), (0)::bigint) AS "save_count",
    'Estável'::"text" AS "trend_label",
    'gold'::"text" AS "trend_color"
   FROM "orbit"."ig_posts"
  WHERE (("confidence_level" = ANY (ARRAY['L0'::"orbit"."confidence_level", 'L1'::"orbit"."confidence_level"])) OR (("confidence_level")::"text" = 'healthy'::"text"))
  GROUP BY "client_id", "content_format";


ALTER VIEW "orbit"."v_format_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_funnel_data" AS
 SELECT "id",
    "client_id",
    "alcance" AS "reach",
    "visitas" AS "visits",
    "cliques" AS "clicks",
    "vendas" AS "sales",
    "ctr_bio" AS "ctr_bio_pct",
    "taxa_conv" AS "conversion_rate_pct",
    "period_start",
    "period_end",
    "created_at"
   FROM "orbit"."funnel_data";


ALTER VIEW "orbit"."v_funnel_data" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_kpi_snapshots" WITH ("security_invoker"='on') AS
 SELECT "id",
    "client_id",
    "metric_date" AS "period_start",
    "metric_date" AS "period_end",
    "recorded_at",
    "recorded_at" AS "calculated_at",
    "metric_date",
    "metric_name",
    "metric_name" AS "metric_key",
    "metric_name" AS "metric",
    "metric_value",
    "metric_value" AS "value",
    "platform",
    "confidence_level",
    "source_snapshot_id"
   FROM "orbit"."metric_history"
  WHERE (("confidence_level" = ANY (ARRAY['L0'::"orbit"."confidence_level", 'L1'::"orbit"."confidence_level"])) OR (("confidence_level")::"text" = 'healthy'::"text"));


ALTER VIEW "orbit"."v_kpi_snapshots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_meta_ads_metrics" AS
 SELECT "snap"."id",
    "snap"."client_id",
    "snap"."campaign_id",
    "snap"."adset_id",
    "snap"."creative_id",
    "snap"."snapshot_date",
    "snap"."impressions",
    "snap"."reach",
    "snap"."frequency",
    "snap"."spend",
    "snap"."clicks",
    "snap"."ctr_pct" AS "ctr",
    "snap"."cpc",
    "snap"."cpm",
    "snap"."results",
    "snap"."cost_per_result" AS "cpl",
    "snap"."revenue",
    "snap"."roas",
    "cr"."fatigue_score_pct" AS "fatigue_percent",
    "cr"."creative_health",
    "cr"."fatigue_cause",
    "camp"."name" AS "campaign_name",
    "camp"."objective",
    "ads"."name" AS "adset_name",
    "snap"."confidence_level"
   FROM ((("orbit"."ads_meta_snapshots" "snap"
     LEFT JOIN "orbit"."ads_meta_creatives" "cr" ON (("snap"."creative_id" = "cr"."id")))
     LEFT JOIN "orbit"."ads_meta_campaigns" "camp" ON (("snap"."campaign_id" = "camp"."id")))
     LEFT JOIN "orbit"."ads_meta_adsets" "ads" ON (("snap"."adset_id" = "ads"."id")));


ALTER VIEW "orbit"."v_meta_ads_metrics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_quality_scores" WITH ("security_invoker"='on') AS
 WITH "latest_snapshot" AS (
         SELECT DISTINCT ON ("ig_account_snapshots"."client_id") "ig_account_snapshots"."client_id",
            "ig_account_snapshots"."period_start",
            "ig_account_snapshots"."period_end",
            "ig_account_snapshots"."utility_score_pct",
            "ig_account_snapshots"."polemic_score_pct",
            "ig_account_snapshots"."vps_pct",
            "ig_account_snapshots"."er_real_pct",
            "ig_account_snapshots"."created_at"
           FROM "orbit"."ig_account_snapshots"
          WHERE ("ig_account_snapshots"."reach_total" IS NOT NULL)
          ORDER BY "ig_account_snapshots"."client_id", "ig_account_snapshots"."period_end" DESC
        ), "unpivoted" AS (
         SELECT "latest_snapshot"."client_id",
            "latest_snapshot"."period_start",
            "latest_snapshot"."period_end",
            "latest_snapshot"."created_at",
            "scores"."metric_name",
            "scores"."display_label",
            "scores"."score_value"
           FROM ("latest_snapshot"
             CROSS JOIN LATERAL ( VALUES ('utility_score_pct'::"text",'Score Utilidade'::"text","latest_snapshot"."utility_score_pct"), ('polemic_score_pct'::"text",'Score Polêmica'::"text","latest_snapshot"."polemic_score_pct"), ('vps_pct'::"text",'VPS'::"text","latest_snapshot"."vps_pct"), ('er_real_pct'::"text",'ER Real'::"text","latest_snapshot"."er_real_pct")) "scores"("metric_name", "display_label", "score_value"))
        )
 SELECT "gen_random_uuid"() AS "id",
    "u"."client_id",
    "u"."period_start",
    "u"."period_end",
    "u"."display_label" AS "score_key",
    ("u"."score_value")::numeric AS "score_value",
        CASE
            WHEN ("u"."score_value" IS NULL) THEN 'Sem dados suficientes para calcular'::"text"
            WHEN ("t"."metric_name" IS NULL) THEN 'Sem threshold definido para esta métrica ainda'::"text"
            WHEN ((("t"."red_min" IS NOT NULL) OR ("t"."red_max" IS NOT NULL)) AND (("t"."red_min" IS NULL) OR ("u"."score_value" >= "t"."red_min")) AND (("t"."red_max" IS NULL) OR ("u"."score_value" <= "t"."red_max"))) THEN 'Crítico'::"text"
            WHEN ((("t"."green_min" IS NOT NULL) OR ("t"."green_max" IS NOT NULL)) AND (("t"."green_min" IS NULL) OR ("u"."score_value" >= "t"."green_min")) AND (("t"."green_max" IS NULL) OR ("u"."score_value" <= "t"."green_max"))) THEN 'Saudável'::"text"
            ELSE 'Atenção'::"text"
        END AS "status_text",
        CASE
            WHEN (("u"."score_value" IS NULL) OR ("t"."metric_name" IS NULL)) THEN 'neutral'::"text"
            WHEN ((("t"."red_min" IS NOT NULL) OR ("t"."red_max" IS NOT NULL)) AND (("t"."red_min" IS NULL) OR ("u"."score_value" >= "t"."red_min")) AND (("t"."red_max" IS NULL) OR ("u"."score_value" <= "t"."red_max"))) THEN 'warn'::"text"
            WHEN ((("t"."green_min" IS NOT NULL) OR ("t"."green_max" IS NOT NULL)) AND (("t"."green_min" IS NULL) OR ("u"."score_value" >= "t"."green_min")) AND (("t"."green_max" IS NULL) OR ("u"."score_value" <= "t"."green_max"))) THEN 'ok'::"text"
            ELSE 'neutral'::"text"
        END AS "status_variant",
    "u"."created_at"
   FROM ("unpivoted" "u"
     LEFT JOIN "orbit"."ref_thresholds" "t" ON (("t"."metric_name" = "u"."metric_name")));


ALTER VIEW "orbit"."v_quality_scores" OWNER TO "postgres";


CREATE OR REPLACE VIEW "orbit"."v_roas_viability" AS
 SELECT "snap"."client_id",
    "c"."name" AS "client_name",
    "camp"."name" AS "campaign_name",
    "camp"."objective",
    "snap"."snapshot_date",
    "snap"."roas",
    "c"."gross_margin_pct",
    "round"((1.0 / NULLIF(("c"."gross_margin_pct" / 100.0), (0)::numeric)), 4) AS "roas_minimum_viable",
    (
        CASE
            WHEN ("snap"."roas" IS NULL) THEN NULL::"text"
            WHEN ("snap"."roas" < "round"((1.0 / NULLIF(("c"."gross_margin_pct" / 100.0), (0)::numeric)), 4)) THEN 'critical'::"text"
            WHEN ("snap"."roas" < ("round"((1.0 / NULLIF(("c"."gross_margin_pct" / 100.0), (0)::numeric)), 4) * 1.5)) THEN 'warning'::"text"
            ELSE 'healthy'::"text"
        END)::"orbit"."health_status" AS "roas_health"
   FROM (("orbit"."ads_meta_snapshots" "snap"
     JOIN "orbit"."ads_meta_campaigns" "camp" ON (("camp"."id" = "snap"."campaign_id")))
     JOIN "orbit"."clients" "c" ON (("c"."id" = "snap"."client_id")));


ALTER VIEW "orbit"."v_roas_viability" OWNER TO "postgres";


COMMENT ON VIEW "orbit"."v_roas_viability" IS 'C-04: ROAS_mínimo = 1/margem_bruta. ROAS < mínimo → destruição de margem.';



ALTER TABLE ONLY "orbit"."ref_export_file_catalog" ALTER COLUMN "id" SET DEFAULT "nextval"('"orbit"."ref_export_file_catalog_id_seq"'::"regclass");



ALTER TABLE ONLY "orbit"."ref_thresholds" ALTER COLUMN "id" SET DEFAULT "nextval"('"orbit"."ref_thresholds_id_seq"'::"regclass");



ALTER TABLE ONLY "orbit"."ads_ga4_landing_pages"
    ADD CONSTRAINT "ads_ga4_landing_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_google_snapshots"
    ADD CONSTRAINT "ads_goo_snap_unique" UNIQUE ("client_id", "snapshot_date", "campaign_id");



ALTER TABLE ONLY "orbit"."ads_google_campaigns"
    ADD CONSTRAINT "ads_google_campaigns_google_campaign_id_key" UNIQUE ("google_campaign_id");



ALTER TABLE ONLY "orbit"."ads_google_campaigns"
    ADD CONSTRAINT "ads_google_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_google_search_terms"
    ADD CONSTRAINT "ads_google_search_terms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_google_snapshots"
    ADD CONSTRAINT "ads_google_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_meta_adsets"
    ADD CONSTRAINT "ads_meta_adsets_meta_adset_id_key" UNIQUE ("meta_adset_id");



ALTER TABLE ONLY "orbit"."ads_meta_adsets"
    ADD CONSTRAINT "ads_meta_adsets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_meta_campaigns"
    ADD CONSTRAINT "ads_meta_campaigns_meta_campaign_id_key" UNIQUE ("meta_campaign_id");



ALTER TABLE ONLY "orbit"."ads_meta_campaigns"
    ADD CONSTRAINT "ads_meta_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_meta_creatives"
    ADD CONSTRAINT "ads_meta_creatives_meta_creative_id_key" UNIQUE ("meta_creative_id");



ALTER TABLE ONLY "orbit"."ads_meta_creatives"
    ADD CONSTRAINT "ads_meta_creatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ads_meta_snapshots"
    ADD CONSTRAINT "ads_meta_snap_unique" UNIQUE ("client_id", "snapshot_date", "campaign_id", "adset_id", "creative_id");



ALTER TABLE ONLY "orbit"."ads_meta_snapshots"
    ADD CONSTRAINT "ads_meta_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_dedup" UNIQUE ("client_id", "alert_type", "metric_name", "is_resolved") DEFERRABLE INITIALLY DEFERRED;



COMMENT ON CONSTRAINT "alerts_dedup" ON "orbit"."alerts" IS 'FIX-06: permite ON CONFLICT DO NOTHING em check_churn_alert e similares.';



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."avatar_validations"
    ADD CONSTRAINT "avatar_validations_client_id_validation_date_key" UNIQUE ("client_id", "validation_date");



ALTER TABLE ONLY "orbit"."avatar_validations"
    ADD CONSTRAINT "avatar_validations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "orbit"."client_reports"
    ADD CONSTRAINT "client_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."clients"
    ADD CONSTRAINT "clients_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "orbit"."clients"
    ADD CONSTRAINT "clients_instagram_user_id_key" UNIQUE ("instagram_user_id");



ALTER TABLE ONLY "orbit"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."funnel_data"
    ADD CONSTRAINT "funnel_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ig_account_snapshots"
    ADD CONSTRAINT "ig_account_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ig_audience_snapshots"
    ADD CONSTRAINT "ig_audience_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ig_import_sessions"
    ADD CONSTRAINT "ig_import_sessions_export_zip_hash_key" UNIQUE ("export_zip_hash");



ALTER TABLE ONLY "orbit"."ig_import_sessions"
    ADD CONSTRAINT "ig_import_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ig_posts"
    ADD CONSTRAINT "ig_posts_ig_shortcode_key" UNIQUE ("ig_shortcode");



ALTER TABLE ONLY "orbit"."ig_posts"
    ADD CONSTRAINT "ig_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ig_account_snapshots"
    ADD CONSTRAINT "ig_snap_unique" UNIQUE ("client_id", "period_start", "period_end", "period_source");



ALTER TABLE ONLY "orbit"."metric_history"
    ADD CONSTRAINT "metric_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."metric_history"
    ADD CONSTRAINT "metric_history_unique" UNIQUE ("client_id", "metric_date", "metric_name", "platform");



ALTER TABLE ONLY "orbit"."raw_ig_ingest"
    ADD CONSTRAINT "raw_ig_ingest_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ref_export_file_catalog"
    ADD CONSTRAINT "ref_export_file_catalog_filename_key" UNIQUE ("filename");



ALTER TABLE ONLY "orbit"."ref_export_file_catalog"
    ADD CONSTRAINT "ref_export_file_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."ref_thresholds"
    ADD CONSTRAINT "ref_thresholds_metric_name_key" UNIQUE ("metric_name");



ALTER TABLE ONLY "orbit"."ref_thresholds"
    ADD CONSTRAINT "ref_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "orbit"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_subscription_id_key" UNIQUE ("user_id", "subscription_id");



CREATE INDEX "idx_alerts_open" ON "orbit"."alerts" USING "btree" ("client_id", "severity") WHERE (NOT "is_resolved");



CREATE INDEX "idx_avatar_validations_client_date" ON "orbit"."avatar_validations" USING "btree" ("client_id", "validation_date" DESC);



CREATE INDEX "idx_client_onboarding_updated_at" ON "orbit"."client_onboarding" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_clients_subscription_id" ON "orbit"."clients" USING "btree" ("subscription_id");



CREATE INDEX "idx_goo_snap_client_date" ON "orbit"."ads_google_snapshots" USING "btree" ("client_id", "snapshot_date" DESC);



CREATE INDEX "idx_ig_aud_client_period" ON "orbit"."ig_audience_snapshots" USING "btree" ("client_id", "period_end" DESC);



CREATE INDEX "idx_ig_aud_top_cities" ON "orbit"."ig_audience_snapshots" USING "gin" ("top_cities");



CREATE INDEX "idx_ig_aud_top_countries" ON "orbit"."ig_audience_snapshots" USING "gin" ("top_countries");



CREATE INDEX "idx_ig_posts_boost" ON "orbit"."ig_posts" USING "btree" ("client_id") WHERE "is_boost_candidate";



CREATE INDEX "idx_ig_posts_client_date" ON "orbit"."ig_posts" USING "btree" ("client_id", "published_at" DESC);



CREATE INDEX "idx_ig_posts_format" ON "orbit"."ig_posts" USING "btree" ("client_id", "content_format");



CREATE INDEX "idx_ig_snap_client_period" ON "orbit"."ig_account_snapshots" USING "btree" ("client_id", "period_end" DESC);



CREATE INDEX "idx_meta_creative_health" ON "orbit"."ads_meta_creatives" USING "btree" ("client_id", "creative_health");



CREATE INDEX "idx_meta_snap_client_date" ON "orbit"."ads_meta_snapshots" USING "btree" ("client_id", "snapshot_date" DESC);



CREATE INDEX "idx_metric_history_client" ON "orbit"."metric_history" USING "btree" ("client_id", "metric_name", "metric_date" DESC);



CREATE INDEX "idx_raw_ingest_payload" ON "orbit"."raw_ig_ingest" USING "gin" ("raw_payload");



CREATE INDEX "idx_user_subscriptions_subscription_id" ON "orbit"."user_subscriptions" USING "btree" ("subscription_id");



CREATE INDEX "idx_user_subscriptions_user_id" ON "orbit"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "metric_history_lookup" ON "orbit"."metric_history" USING "btree" ("client_id", "metric_name", "metric_date" DESC);



CREATE INDEX "raw_ig_ingest_client_file" ON "orbit"."raw_ig_ingest" USING "btree" ("client_id", "source_file");



CREATE INDEX "raw_ig_ingest_unparsed" ON "orbit"."raw_ig_ingest" USING "btree" ("client_id") WHERE (NOT "parsed");



CREATE OR REPLACE VIEW "orbit"."v_client_health" AS
 SELECT "c"."id" AS "client_id",
    "c"."handle",
    "c"."name" AS "avatar_name",
    "count"("mh"."id") AS "metric_count",
        CASE
            WHEN ("count"("mh"."id") = 0) THEN NULL::numeric(5,2)
            ELSE ("round"("avg"(LEAST((100)::numeric, GREATEST((0)::numeric, "mh"."metric_value")))))::numeric(5,2)
        END AS "avg_quality_score",
        CASE
            WHEN ("count"("mh"."id") = 0) THEN NULL::"text"
            WHEN ("avg"(LEAST((100)::numeric, GREATEST((0)::numeric, "mh"."metric_value"))) >= (75)::numeric) THEN 'healthy'::"text"
            WHEN ("avg"(LEAST((100)::numeric, GREATEST((0)::numeric, "mh"."metric_value"))) >= (50)::numeric) THEN 'warning'::"text"
            ELSE 'critical'::"text"
        END AS "health_status",
    "max"("mh"."recorded_at") AS "last_updated",
    (EXTRACT(day FROM ("now"() - "max"("mh"."recorded_at"))))::integer AS "days_since_update",
    "max"("mh"."confidence_level") AS "max_confidence_level"
   FROM ("orbit"."clients" "c"
     LEFT JOIN "orbit"."metric_history" "mh" ON ((("c"."id" = "mh"."client_id") AND ("mh"."metric_date" >= (CURRENT_DATE - '30 days'::interval)))))
  GROUP BY "c"."id", "c"."handle", "c"."name"
  ORDER BY
        CASE "c"."health_status"
            WHEN 'critical'::"orbit"."health_status" THEN 0
            WHEN 'warning'::"orbit"."health_status" THEN 1
            WHEN 'healthy'::"orbit"."health_status" THEN 2
            ELSE 3
        END,
        CASE
            WHEN ("count"("mh"."id") = 0) THEN NULL::numeric(5,2)
            ELSE ("round"("avg"(LEAST((100)::numeric, GREATEST((0)::numeric, "mh"."metric_value")))))::numeric(5,2)
        END DESC NULLS LAST;



CREATE OR REPLACE TRIGGER "trg_check_churn_alert" AFTER INSERT OR UPDATE ON "orbit"."ig_account_snapshots" FOR EACH ROW EXECUTE FUNCTION "orbit"."check_churn_alert"();



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "orbit"."clients" FOR EACH ROW EXECUTE FUNCTION "orbit"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_eval_boost_candidate" BEFORE INSERT OR UPDATE ON "orbit"."ig_posts" FOR EACH ROW EXECUTE FUNCTION "orbit"."eval_boost_candidate"();



CREATE OR REPLACE TRIGGER "trg_google_campaigns_updated_at" BEFORE UPDATE ON "orbit"."ads_google_campaigns" FOR EACH ROW EXECUTE FUNCTION "orbit"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_meta_adsets_updated_at" BEFORE UPDATE ON "orbit"."ads_meta_adsets" FOR EACH ROW EXECUTE FUNCTION "orbit"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_meta_campaigns_updated_at" BEFORE UPDATE ON "orbit"."ads_meta_campaigns" FOR EACH ROW EXECUTE FUNCTION "orbit"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_meta_creatives_updated_at" BEFORE UPDATE ON "orbit"."ads_meta_creatives" FOR EACH ROW EXECUTE FUNCTION "orbit"."set_updated_at"();



ALTER TABLE ONLY "orbit"."ads_ga4_landing_pages"
    ADD CONSTRAINT "ads_ga4_landing_pages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_google_campaigns"
    ADD CONSTRAINT "ads_google_campaigns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_google_search_terms"
    ADD CONSTRAINT "ads_google_search_terms_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "orbit"."ads_google_campaigns"("id");



ALTER TABLE ONLY "orbit"."ads_google_search_terms"
    ADD CONSTRAINT "ads_google_search_terms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_google_snapshots"
    ADD CONSTRAINT "ads_google_snapshots_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "orbit"."ads_google_campaigns"("id");



ALTER TABLE ONLY "orbit"."ads_google_snapshots"
    ADD CONSTRAINT "ads_google_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_meta_adsets"
    ADD CONSTRAINT "ads_meta_adsets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "orbit"."ads_meta_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_meta_campaigns"
    ADD CONSTRAINT "ads_meta_campaigns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_meta_creatives"
    ADD CONSTRAINT "ads_meta_creatives_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "orbit"."ads_meta_adsets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_meta_creatives"
    ADD CONSTRAINT "ads_meta_creatives_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id");



ALTER TABLE ONLY "orbit"."ads_meta_creatives"
    ADD CONSTRAINT "ads_meta_creatives_ig_post_id_fkey" FOREIGN KEY ("ig_post_id") REFERENCES "orbit"."ig_posts"("id");



ALTER TABLE ONLY "orbit"."ads_meta_snapshots"
    ADD CONSTRAINT "ads_meta_snapshots_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "orbit"."ads_meta_adsets"("id");



ALTER TABLE ONLY "orbit"."ads_meta_snapshots"
    ADD CONSTRAINT "ads_meta_snapshots_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "orbit"."ads_meta_campaigns"("id");



ALTER TABLE ONLY "orbit"."ads_meta_snapshots"
    ADD CONSTRAINT "ads_meta_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ads_meta_snapshots"
    ADD CONSTRAINT "ads_meta_snapshots_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "orbit"."ads_meta_creatives"("id");



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_google_campaign_id_fkey" FOREIGN KEY ("google_campaign_id") REFERENCES "orbit"."ads_google_campaigns"("id");



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_ig_post_id_fkey" FOREIGN KEY ("ig_post_id") REFERENCES "orbit"."ig_posts"("id");



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_meta_campaign_id_fkey" FOREIGN KEY ("meta_campaign_id") REFERENCES "orbit"."ads_meta_campaigns"("id");



ALTER TABLE ONLY "orbit"."alerts"
    ADD CONSTRAINT "alerts_meta_creative_id_fkey" FOREIGN KEY ("meta_creative_id") REFERENCES "orbit"."ads_meta_creatives"("id");



ALTER TABLE ONLY "orbit"."avatar_validations"
    ADD CONSTRAINT "avatar_validations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."client_onboarding"
    ADD CONSTRAINT "client_onboarding_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."client_reports"
    ADD CONSTRAINT "client_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."clients"
    ADD CONSTRAINT "clients_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "orbit"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."funnel_data"
    ADD CONSTRAINT "funnel_data_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ig_account_snapshots"
    ADD CONSTRAINT "ig_account_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ig_account_snapshots"
    ADD CONSTRAINT "ig_account_snapshots_import_session_fkey" FOREIGN KEY ("import_session") REFERENCES "orbit"."ig_import_sessions"("id");



ALTER TABLE ONLY "orbit"."ig_audience_snapshots"
    ADD CONSTRAINT "ig_audience_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ig_audience_snapshots"
    ADD CONSTRAINT "ig_audience_snapshots_import_session_fkey" FOREIGN KEY ("import_session") REFERENCES "orbit"."ig_import_sessions"("id");



ALTER TABLE ONLY "orbit"."ig_import_sessions"
    ADD CONSTRAINT "ig_import_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ig_posts"
    ADD CONSTRAINT "ig_posts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."ig_posts"
    ADD CONSTRAINT "ig_posts_import_session_fkey" FOREIGN KEY ("import_session") REFERENCES "orbit"."ig_import_sessions"("id");



ALTER TABLE ONLY "orbit"."metric_history"
    ADD CONSTRAINT "metric_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."raw_ig_ingest"
    ADD CONSTRAINT "raw_ig_ingest_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "orbit"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."raw_ig_ingest"
    ADD CONSTRAINT "raw_ig_ingest_import_session_fkey" FOREIGN KEY ("import_session") REFERENCES "orbit"."ig_import_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "orbit"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "orbit"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Permitir leitura para usuarios autenticados" ON "orbit"."subscriptions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "orbit"."ads_ga4_landing_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_google_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_google_search_terms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_google_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_meta_adsets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_meta_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_meta_creatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ads_meta_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_read_alerts" ON "orbit"."alerts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon_read_clients" ON "orbit"."clients" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon_read_funnel_data" ON "orbit"."funnel_data" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon_read_ig_account_snapshots" ON "orbit"."ig_account_snapshots" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon_read_ig_audience_snapshots" ON "orbit"."ig_audience_snapshots" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon_read_ig_posts" ON "orbit"."ig_posts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "authenticated can read metric_history" ON "orbit"."metric_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "orbit"."client_onboarding" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_onboarding_open_v1" ON "orbit"."client_onboarding" USING (true) WITH CHECK (true);



ALTER TABLE "orbit"."client_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."funnel_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ig_account_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ig_audience_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."ig_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."metric_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "orbit"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "svc_ads_ga4_landing_pages_all" ON "orbit"."ads_ga4_landing_pages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_google_campaigns_all" ON "orbit"."ads_google_campaigns" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_google_search_terms_all" ON "orbit"."ads_google_search_terms" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_google_snapshots_all" ON "orbit"."ads_google_snapshots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_meta_adsets_all" ON "orbit"."ads_meta_adsets" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_meta_campaigns_all" ON "orbit"."ads_meta_campaigns" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_meta_creatives_all" ON "orbit"."ads_meta_creatives" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ads_meta_snapshots_all" ON "orbit"."ads_meta_snapshots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_alerts_all" ON "orbit"."alerts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_client_reports_all" ON "orbit"."client_reports" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_clients_all" ON "orbit"."clients" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_funnel_data_all" ON "orbit"."funnel_data" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ig_account_snapshots_all" ON "orbit"."ig_account_snapshots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ig_audience_snapshots_all" ON "orbit"."ig_audience_snapshots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_ig_posts_all" ON "orbit"."ig_posts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_metric_history_all" ON "orbit"."metric_history" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "orbit"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "orbit" TO "orbit_readonly";
GRANT USAGE ON SCHEMA "orbit" TO "orbit_ingest";
GRANT USAGE ON SCHEMA "orbit" TO "service_role";
GRANT USAGE ON SCHEMA "orbit" TO "anon";
GRANT USAGE ON SCHEMA "orbit" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_ga4_landing_pages" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_ga4_landing_pages" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_ga4_landing_pages" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_ga4_landing_pages" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_google_campaigns" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_google_campaigns" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_google_campaigns" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_google_campaigns" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_google_search_terms" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_google_search_terms" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_google_search_terms" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_google_search_terms" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_google_snapshots" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_google_snapshots" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_google_snapshots" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_google_snapshots" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_meta_adsets" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_meta_adsets" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_meta_adsets" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_meta_adsets" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_meta_campaigns" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_meta_campaigns" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_meta_campaigns" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_meta_campaigns" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_meta_creatives" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_meta_creatives" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_meta_creatives" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_meta_creatives" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ads_meta_snapshots" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ads_meta_snapshots" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ads_meta_snapshots" TO "anon";
GRANT SELECT ON TABLE "orbit"."ads_meta_snapshots" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."alerts" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."alerts" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."alerts" TO "service_role";
GRANT SELECT ON TABLE "orbit"."alerts" TO "anon";
GRANT SELECT ON TABLE "orbit"."alerts" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."avatar_validations" TO "anon";
GRANT SELECT ON TABLE "orbit"."avatar_validations" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."avatar_validations" TO "service_role";



GRANT SELECT ON TABLE "orbit"."client_onboarding" TO "anon";
GRANT SELECT ON TABLE "orbit"."client_onboarding" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."client_onboarding" TO "service_role";



GRANT SELECT ON TABLE "orbit"."client_reports" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."client_reports" TO "service_role";
GRANT SELECT ON TABLE "orbit"."client_reports" TO "anon";
GRANT SELECT ON TABLE "orbit"."client_reports" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."clients" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."clients" TO "service_role";
GRANT SELECT ON TABLE "orbit"."clients" TO "anon";
GRANT SELECT ON TABLE "orbit"."clients" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."funnel_data" TO "anon";
GRANT SELECT ON TABLE "orbit"."funnel_data" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."funnel_data" TO "service_role";



GRANT SELECT ON TABLE "orbit"."ig_account_snapshots" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."ig_account_snapshots" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."ig_account_snapshots" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ig_account_snapshots" TO "anon";
GRANT SELECT ON TABLE "orbit"."ig_account_snapshots" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ig_audience_snapshots" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."ig_audience_snapshots" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."ig_audience_snapshots" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ig_audience_snapshots" TO "anon";
GRANT SELECT ON TABLE "orbit"."ig_audience_snapshots" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ig_import_sessions" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."ig_import_sessions" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."ig_import_sessions" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ig_import_sessions" TO "anon";
GRANT SELECT ON TABLE "orbit"."ig_import_sessions" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ig_posts" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."ig_posts" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."ig_posts" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ig_posts" TO "anon";
GRANT SELECT ON TABLE "orbit"."ig_posts" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."metric_history" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."metric_history" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."metric_history" TO "service_role";
GRANT SELECT ON TABLE "orbit"."metric_history" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."metric_history" TO "anon";



GRANT SELECT ON TABLE "orbit"."raw_ig_ingest" TO "orbit_readonly";
GRANT SELECT,INSERT,UPDATE ON TABLE "orbit"."raw_ig_ingest" TO "orbit_ingest";
GRANT ALL ON TABLE "orbit"."raw_ig_ingest" TO "service_role";
GRANT SELECT ON TABLE "orbit"."raw_ig_ingest" TO "anon";
GRANT SELECT ON TABLE "orbit"."raw_ig_ingest" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."ref_export_file_catalog" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ref_export_file_catalog" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ref_export_file_catalog" TO "anon";
GRANT SELECT ON TABLE "orbit"."ref_export_file_catalog" TO "authenticated";



GRANT SELECT ON SEQUENCE "orbit"."ref_export_file_catalog_id_seq" TO "orbit_readonly";
GRANT ALL ON SEQUENCE "orbit"."ref_export_file_catalog_id_seq" TO "service_role";



GRANT SELECT ON TABLE "orbit"."ref_thresholds" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."ref_thresholds" TO "service_role";
GRANT SELECT ON TABLE "orbit"."ref_thresholds" TO "anon";
GRANT SELECT ON TABLE "orbit"."ref_thresholds" TO "authenticated";



GRANT SELECT ON SEQUENCE "orbit"."ref_thresholds_id_seq" TO "orbit_readonly";
GRANT ALL ON SEQUENCE "orbit"."ref_thresholds_id_seq" TO "service_role";



GRANT SELECT ON TABLE "orbit"."subscriptions" TO "anon";
GRANT SELECT ON TABLE "orbit"."subscriptions" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."subscriptions" TO "service_role";



GRANT SELECT ON TABLE "orbit"."user_subscriptions" TO "anon";
GRANT SELECT ON TABLE "orbit"."user_subscriptions" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."user_subscriptions" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_alerts" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_alerts" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_alerts" TO "service_role";



GRANT ALL ON TABLE "orbit"."v_audience_alignment" TO "service_role";
GRANT SELECT ON TABLE "orbit"."v_audience_alignment" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_audience_alignment" TO "authenticated";



GRANT ALL ON TABLE "orbit"."v_avatar_alignment" TO "service_role";
GRANT SELECT ON TABLE "orbit"."v_avatar_alignment" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_avatar_alignment" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."v_boost_candidates" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."v_boost_candidates" TO "service_role";
GRANT SELECT ON TABLE "orbit"."v_boost_candidates" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_boost_candidates" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."v_client_health" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_client_health" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."v_client_metrics" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_client_metrics" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_client_metrics" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_creative_fatigue" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."v_creative_fatigue" TO "service_role";
GRANT SELECT ON TABLE "orbit"."v_creative_fatigue" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_creative_fatigue" TO "authenticated";



GRANT SELECT ON TABLE "orbit"."v_format_performance" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_format_performance" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_format_performance" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_funnel_data" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_funnel_data" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_funnel_data" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_kpi_snapshots" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_kpi_snapshots" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_kpi_snapshots" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_meta_ads_metrics" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_meta_ads_metrics" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_meta_ads_metrics" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_quality_scores" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_quality_scores" TO "authenticated";
GRANT SELECT ON TABLE "orbit"."v_quality_scores" TO "service_role";



GRANT SELECT ON TABLE "orbit"."v_roas_viability" TO "orbit_readonly";
GRANT ALL ON TABLE "orbit"."v_roas_viability" TO "service_role";
GRANT SELECT ON TABLE "orbit"."v_roas_viability" TO "anon";
GRANT SELECT ON TABLE "orbit"."v_roas_viability" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "orbit" GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "orbit" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "orbit" GRANT SELECT ON TABLES TO "service_role";




