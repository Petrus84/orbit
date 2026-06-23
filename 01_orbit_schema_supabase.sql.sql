-- =============================================================================
-- ORBIT · SPRINT 2 — SCHEMA SQL PARA SUPABASE SQL EDITOR
-- Arquivo: 01_orbit_schema_supabase.sql
-- Executar EM ORDEM no SQL Editor do Supabase (Project → SQL Editor → New query)
-- 
-- ⚠️  IMPORTANTE: O schema public.* original NÃO será tocado.
--     Todas as tabelas novas vivem em orbit.*
--     Os repositórios atuais continuam funcionando via public.* (sem regressão)
--     A migração de leitura acontece nos arquivos TypeScript (documentos 03-06)
-- =============================================================================

BEGIN;

-- ============================================================================
-- BLOCO 1 · SCHEMA + ROLES + SEARCH_PATH
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS orbit;

-- Supabase exige que o schema esteja no search_path das roles para o PostgREST
-- expô-lo via REST API (necessário para supabase.from('tabela') funcionar
-- quando o client tiver db.schema: 'orbit')
ALTER ROLE postgres    SET search_path TO orbit, public, extensions;
ALTER ROLE authenticated SET search_path TO orbit, public, extensions;
ALTER ROLE anon        SET search_path TO orbit, public, extensions;
ALTER ROLE service_role SET search_path TO orbit, public, extensions;

GRANT USAGE ON SCHEMA orbit TO anon, authenticated, service_role, public;

-- ============================================================================
-- BLOCO 2 · ENUMS
-- Criados condicionalmente para ser idempotente (re-executável sem erro)
-- ============================================================================

DO $$
BEGIN
  -- content_format: formatos de conteúdo orgânico Instagram
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'content_format' AND n.nspname = 'orbit'
  ) THEN
    CREATE TYPE orbit.content_format AS ENUM (
      'reel',
      'static_post',
      'carousel',
      'story',
      'live',
      'igtv'
    );
  END IF;

  -- confidence_level: rastreia origem e confiabilidade de cada métrica
  -- L0 = API/export direto · L1 = calculado com fórmula conhecida · L2 = benchmark
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'confidence_level' AND n.nspname = 'orbit'
  ) THEN
    CREATE TYPE orbit.confidence_level AS ENUM ('L0', 'L1', 'L2');
  END IF;

  -- health_status: semáforo de saúde (carteira, avatares, criativos)
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'health_status' AND n.nspname = 'orbit'
  ) THEN
    CREATE TYPE orbit.health_status AS ENUM (
      'healthy',
      'warning',
      'critical',
      'unknown'
    );
  END IF;
END
$$;

-- ============================================================================
-- BLOCO 3 · TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- orbit.clients
-- SSOT de contexto de negócio, thresholds operacionais e configuração de avatar
-- Referencia public.clients.id via instagram_account_id (ponte de leitura)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orbit.clients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identificação básica (espelha public.clients)
  name                  TEXT        NOT NULL,
  handle                TEXT        NOT NULL UNIQUE,   -- "@cpimportstore"
  email                 TEXT,

  -- Ponte com o schema público (para leituras cross-schema sem migrar tudo)
  -- Quando não nulo, permite JOIN com public.clients, public.kpi_snapshots etc.
  public_client_id      UUID        REFERENCES public.clients(id) ON DELETE SET NULL,

  -- Metas de negócio (Camada 1 do protótipo)
  monthly_ad_budget     NUMERIC(12,2),
  gross_margin_pct      NUMERIC(5,2),   -- base para C-04: ROAS_mín = 1/margem

  -- Thresholds operacionais (R-02 — alertas proativos configuráveis por cliente)
  threshold_churn_pct       NUMERIC(5,2) DEFAULT 5.0,    -- churn mensal máx (%)
  threshold_polemic_pct     NUMERIC(5,2) DEFAULT 20.0,   -- score polêmica máx (%)
  threshold_er_min          NUMERIC(5,2) DEFAULT 2.0,    -- ER real mínimo (%)
  threshold_vps_min         NUMERIC(5,2) DEFAULT 0.5,    -- VPS mínimo
  threshold_ctr_bio_min     NUMERIC(5,2) DEFAULT 3.0,    -- CTR bio mínimo (%)
  threshold_fatigue_crit    NUMERIC(5,2) DEFAULT 40.0,   -- fadiga crítica (%)
  threshold_frequency_max   NUMERIC(5,2) DEFAULT 2.5,    -- frequência máx antes saturação

  -- Avatar esperado (R-11 — base para score de alinhamento C-05)
  avatar_gender_expected    TEXT,        -- 'male' | 'female' | 'mixed'
  avatar_gender_pct         NUMERIC(5,2),  -- ex: 70.0 (70% masculino esperado)
  avatar_age_min            SMALLINT,    -- ex: 18
  avatar_age_max            SMALLINT,    -- ex: 34
  avatar_geo_primary        TEXT,        -- ex: "São Paulo"
  avatar_geo_pct            NUMERIC(5,2),
  avatar_unconscious_desire TEXT,        -- campo livre — briefing criativo

  -- RLS: nullable em dev (seed), preenchido em produção via auth
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT orbit_clients_margin_range CHECK (
    gross_margin_pct IS NULL OR gross_margin_pct BETWEEN 0 AND 100
  ),
  CONSTRAINT orbit_clients_age_range CHECK (
    avatar_age_min IS NULL OR avatar_age_max IS NULL OR
    avatar_age_min < avatar_age_max
  )
);

COMMENT ON TABLE  orbit.clients IS
  'SSOT de contexto de negócio por cliente. Camada 1 do sistema Orbit.';
COMMENT ON COLUMN orbit.clients.public_client_id IS
  'FK para public.clients.id — ponte de leitura cross-schema sem migrar o legado.';
COMMENT ON COLUMN orbit.clients.user_id IS
  'NULL durante desenvolvimento (seed). Obrigatório em produção via auth.uid().';

-- ----------------------------------------------------------------------------
-- orbit.ig_posts
-- Um registro por post orgânico publicado
-- Fonte primária: posts.json / ingest-l0 (via post_external_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orbit.ig_posts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES orbit.clients(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identificação (chave composta garante idempotência do UPSERT)
  post_external_id    TEXT        NOT NULL,
  content_format      orbit.content_format NOT NULL,
  caption             TEXT,
  published_at        TIMESTAMPTZ NOT NULL,

  -- Métricas brutas (L0 — vindas do export / ingestão)
  reach               BIGINT,
  impressions         BIGINT,
  likes               BIGINT,
  comments            BIGINT,
  shares              BIGINT,
  saves               BIGINT,

  -- GENERATED COLUMNS (L1 — calculadas atomicamente, protegidas contra /0)
  -- C-01: ER Real = (saves + shares + comments) / alcance × 100
  -- Não usa curtidas — são ruído de baixo custo cognitivo
  er_real_pct         NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE
      WHEN reach > 0
        AND saves IS NOT NULL
        AND shares IS NOT NULL
        AND comments IS NOT NULL
      THEN ROUND(((saves + shares + comments)::NUMERIC / reach) * 100, 4)
      ELSE NULL
    END
  ) STORED,

  -- R-05: Score polêmica = comentários / curtidas × 100
  -- Threshold crítico: > 20%
  polemic_score_pct   NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE
      WHEN likes > 0 AND comments IS NOT NULL
      THEN ROUND((comments::NUMERIC / likes) * 100, 4)
      ELSE NULL
    END
  ) STORED,

  -- R-05: Score utilidade = (saves + shares) / alcance × 100
  -- Threshold saudável: > 2%
  utility_score_pct   NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE
      WHEN reach > 0
        AND saves IS NOT NULL
        AND shares IS NOT NULL
      THEN ROUND(((saves + shares)::NUMERIC / reach) * 100, 4)
      ELSE NULL
    END
  ) STORED,

  confidence_level    orbit.confidence_level NOT NULL DEFAULT 'L0',

  UNIQUE (client_id, post_external_id)
);

COMMENT ON TABLE orbit.ig_posts IS
  'Posts orgânicos do Instagram com métricas brutas (L0) e scores calculados (L1).';
COMMENT ON COLUMN orbit.ig_posts.er_real_pct IS
  'C-01: (saves+shares+comments)/reach×100. Threshold vermelho: <0.5%. Não usa curtidas.';
COMMENT ON COLUMN orbit.ig_posts.polemic_score_pct IS
  'R-05: comments/likes×100. Threshold crítico: >20% (risco de indexação negativa).';

-- ----------------------------------------------------------------------------
-- orbit.ig_account_snapshots
-- KPIs de conta agregados por período (substitui public.kpi_snapshots modelo EAV)
-- Uma linha por janela temporal por cliente
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orbit.ig_account_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES orbit.clients(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  confidence_level    orbit.confidence_level NOT NULL DEFAULT 'L0',

  -- Seguidores (fonte: followers_1.json)
  followers_total     BIGINT,
  followers_gained    BIGINT,
  followers_lost      BIGINT,

  -- Navegação de perfil
  profile_visits      BIGINT,
  link_clicks         BIGINT,

  -- Alcance e impressões (fonte: profiles_reached.json / audience_insights.json)
  reach               BIGINT,
  impressions         BIGINT,

  -- Engajamento total do período
  likes_total         BIGINT,
  comments_total      BIGINT,
  shares_total        BIGINT,
  saves_total         BIGINT,

  -- GENERATED COLUMNS (L1)

  -- C-02: VPS = alcance / total_seguidores
  -- Threshold: <0.4 conta em queda algorítmica
  vps                 NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE
      WHEN followers_total > 0 AND reach IS NOT NULL
      THEN ROUND((reach::NUMERIC / followers_total), 4)
      ELSE NULL
    END
  ) STORED,

  -- C-01 (nível conta): ER Real agregado do período
  er_real_pct         NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE
      WHEN reach > 0
        AND saves_total IS NOT NULL
        AND shares_total IS NOT NULL
        AND comments_total IS NOT NULL
      THEN ROUND(
        ((saves_total + shares_total + comments_total)::NUMERIC / reach) * 100,
        4
      )
      ELSE NULL
    END
  ) STORED,

  -- C-03: Churn mensal estimado = unfollows / followers_início × 100
  -- followers_início = total + lost - gained
  follower_churn_pct  NUMERIC(7,4) GENERATED ALWAYS AS (
    CASE
      WHEN followers_total IS NOT NULL
        AND followers_lost IS NOT NULL
        AND followers_gained IS NOT NULL
        AND (followers_total + followers_lost - followers_gained) > 0
      THEN ROUND(
        (followers_lost::NUMERIC /
         (followers_total + followers_lost - followers_gained)) * 100,
        4
      )
      ELSE NULL
    END
  ) STORED,

  -- Saldo líquido de seguidores no período
  followers_net       BIGINT GENERATED ALWAYS AS (
    CASE
      WHEN followers_gained IS NOT NULL AND followers_lost IS NOT NULL
      THEN followers_gained - followers_lost
      ELSE NULL
    END
  ) STORED,

  UNIQUE (client_id, period_end),
  CONSTRAINT orbit_snap_period CHECK (period_end >= period_start)
);

COMMENT ON TABLE orbit.ig_account_snapshots IS
  'KPIs de conta agregados por período. Substitui public.kpi_snapshots (modelo EAV).';
COMMENT ON COLUMN orbit.ig_account_snapshots.vps IS
  'C-02: reach/followers_total. Threshold saudável: >0.7. Crítico: <0.4.';
COMMENT ON COLUMN orbit.ig_account_snapshots.follower_churn_pct IS
  'C-03: unfollows/followers_início×100. Threshold crítico: >1.5%/mês.';

-- ----------------------------------------------------------------------------
-- orbit.ig_audience_snapshots
-- Demographics da audiência por período
-- Fonte: audience_insights.json (extract-demographics)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orbit.ig_audience_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES orbit.clients(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  period_end          DATE        NOT NULL,
  confidence_level    orbit.confidence_level NOT NULL DEFAULT 'L1',

  -- Gênero (fonte: audience_insights.json → string_map_data['Gênero'])
  gender_male_pct     NUMERIC(5,2),
  gender_female_pct   NUMERIC(5,2),

  -- Faixa etária (fonte: string_map_data['Faixa etária'])
  age_13_17_pct       NUMERIC(5,2),
  age_18_24_pct       NUMERIC(5,2),
  age_25_34_pct       NUMERIC(5,2),
  age_35_44_pct       NUMERIC(5,2),
  age_45_plus_pct     NUMERIC(5,2),

  -- Cidades (flat para simplicidade — top 2 suficientes para MVP)
  top_city_1          TEXT,
  top_city_1_pct      NUMERIC(5,2),
  top_city_2          TEXT,
  top_city_2_pct      NUMERIC(5,2),

  UNIQUE (client_id, period_end),
  CONSTRAINT orbit_aud_gender_sum CHECK (
    COALESCE(gender_male_pct, 0) + COALESCE(gender_female_pct, 0) <= 101
  )
);

COMMENT ON TABLE orbit.ig_audience_snapshots IS
  'Demographics da audiência por período. Fonte: audience_insights.json.';

-- ----------------------------------------------------------------------------
-- orbit.alerts
-- Alertas proativos disparados por jobs/triggers (R-02)
-- Substitui public.alerts (que não tem metric_name/threshold, só leitura)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orbit.alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES orbit.clients(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  alert_type          TEXT        NOT NULL,
  severity            TEXT        NOT NULL
                        CHECK (severity IN ('critical', 'warning', 'info')),
  title               TEXT        NOT NULL,
  description         TEXT,

  -- Contexto do alerta — permite reproduzir o diagnóstico
  metric_name         TEXT,
  metric_value        NUMERIC,
  threshold_value     NUMERIC,

  -- Link de ação direta (resolve gap "insight sem destino" da carta)
  action_url          TEXT,

  -- Referência ao objeto que gerou o alerta
  ig_post_id          UUID REFERENCES orbit.ig_posts(id) ON DELETE SET NULL,
  snapshot_id         UUID,   -- orbit.ig_account_snapshots.id (sem FK formal)

  is_resolved         BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ
);

COMMENT ON TABLE orbit.alerts IS
  'Alertas proativos (R-02). Campo action_url resolve gap de insight sem destino.';

-- ============================================================================
-- BLOCO 4 · ÍNDICES DE PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orbit_posts_client_date
  ON orbit.ig_posts (client_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_orbit_posts_format
  ON orbit.ig_posts (client_id, content_format);

CREATE INDEX IF NOT EXISTS idx_orbit_snap_client_date
  ON orbit.ig_account_snapshots (client_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_orbit_aud_client_date
  ON orbit.ig_audience_snapshots (client_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_orbit_alerts_open
  ON orbit.alerts (client_id, severity)
  WHERE NOT is_resolved;

CREATE INDEX IF NOT EXISTS idx_orbit_clients_public_id
  ON orbit.clients (public_client_id)
  WHERE public_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orbit_clients_user_id
  ON orbit.clients (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orbit_clients_handle
  ON orbit.clients (handle);

-- ============================================================================
-- BLOCO 5 · VIEWS ANALÍTICAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW 1: v_kpi_snapshots
-- Compatibilidade EAV para instagramOverviewRepository.ts (sem reescrever o repo)
-- Pivota as colunas de ig_account_snapshots para o formato metric_key/value
-- que o KpiRowSchema espera
-- CORREÇÃO: semaphore usa apenas 'verde' | 'ambar' | 'vermelho' (enum do Zod)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW orbit.v_kpi_snapshots AS

SELECT
  id,
  client_id,
  period_start::TEXT,
  period_end::TEXT,
  'alcance-90d'        AS metric_key,
  reach                AS value,
  'ambar'::TEXT        AS semaphore,   -- ← 'info' causaria descarte silencioso no Zod
  NULL::TEXT           AS subtitle,
  updated_at::TEXT     AS calculated_at
FROM orbit.ig_account_snapshots
WHERE reach IS NOT NULL

UNION ALL

SELECT
  id, client_id,
  period_start::TEXT, period_end::TEXT,
  'seguidores-totais'  AS metric_key,
  followers_total      AS value,
  CASE
    WHEN followers_total >= 5000  THEN 'verde'
    WHEN followers_total >= 1000  THEN 'ambar'
    ELSE 'vermelho'
  END::TEXT            AS semaphore,
  NULL::TEXT           AS subtitle,
  updated_at::TEXT     AS calculated_at
FROM orbit.ig_account_snapshots
WHERE followers_total IS NOT NULL

UNION ALL

SELECT
  id, client_id,
  period_start::TEXT, period_end::TEXT,
  'saldo-90-dias'      AS metric_key,
  followers_net        AS value,
  CASE
    WHEN followers_net >= 0  THEN 'verde'
    ELSE 'vermelho'
  END::TEXT            AS semaphore,
  NULL::TEXT           AS subtitle,
  updated_at::TEXT     AS calculated_at
FROM orbit.ig_account_snapshots
WHERE followers_net IS NOT NULL;

COMMENT ON VIEW orbit.v_kpi_snapshots IS
  'Compatibilidade EAV para instagramOverviewRepository.ts. '
  'Pivota colunas de ig_account_snapshots para metric_key/value. '
  'Semaphore restrito a verde|ambar|vermelho (enum Zod do repositório).';

-- ----------------------------------------------------------------------------
-- VIEW 2: v_quality_scores_calculated
-- Calcula ER Real, Score Polêmica e Score Utilidade a partir de ig_posts
-- Substitui public.quality_scores (tabela manual)
-- Formato compatível com fetchQualityScores → v_quality_scores_calculated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW orbit.v_quality_scores_calculated AS

WITH aggregated AS (
  SELECT
    p.client_id,
    MAX(p.updated_at) AS last_post_at,
    -- ER Real (C-01)
    ROUND(
      AVG(CASE WHEN p.er_real_pct IS NOT NULL THEN p.er_real_pct END), 2
    ) AS avg_er_real,
    -- Score polêmica (R-05)
    ROUND(
      AVG(CASE WHEN p.polemic_score_pct IS NOT NULL THEN p.polemic_score_pct END), 2
    ) AS avg_polemic,
    -- Score utilidade (R-05)
    ROUND(
      AVG(CASE WHEN p.utility_score_pct IS NOT NULL THEN p.utility_score_pct END), 2
    ) AS avg_utility,
    COUNT(*)::INTEGER AS post_count
  FROM orbit.ig_posts p
  GROUP BY p.client_id
)
SELECT
  gen_random_uuid()                AS id,
  a.client_id,

  -- ER Real
  'er-real'                        AS score_key,
  a.avg_er_real                    AS score_value,
  CASE
    WHEN a.avg_er_real >= 2.0  THEN 'Engajamento real saudável'
    WHEN a.avg_er_real >= 0.5  THEN 'Engajamento real abaixo do ideal'
    ELSE 'Engajamento real crítico'
  END                              AS status_text,
  CASE
    WHEN a.avg_er_real >= 2.0  THEN 'ok'
    WHEN a.avg_er_real >= 0.5  THEN 'warn'
    ELSE 'neutral'
  END                              AS status_variant

FROM aggregated a
WHERE a.avg_er_real IS NOT NULL

UNION ALL

SELECT
  gen_random_uuid(), a.client_id,
  'polemic-score', a.avg_polemic,
  CASE
    WHEN a.avg_polemic <= 5   THEN 'Conteúdo não polarizador'
    WHEN a.avg_polemic <= 20  THEN 'Polêmica moderada — monitorar'
    ELSE 'Conteúdo polarizador — revisar narrativa'
  END,
  CASE
    WHEN a.avg_polemic <= 5   THEN 'ok'
    WHEN a.avg_polemic <= 20  THEN 'warn'
    ELSE 'neutral'
  END
FROM aggregated a
WHERE a.avg_polemic IS NOT NULL

UNION ALL

SELECT
  gen_random_uuid(), a.client_id,
  'utility-score', a.avg_utility,
  CASE
    WHEN a.avg_utility >= 2.0 THEN 'Conteúdo com alto valor percebido'
    WHEN a.avg_utility >= 1.0 THEN 'Utilidade abaixo do ideal'
    ELSE 'Baixo valor percebido — revisar formatos'
  END,
  CASE
    WHEN a.avg_utility >= 2.0 THEN 'ok'
    WHEN a.avg_utility >= 1.0 THEN 'warn'
    ELSE 'neutral'
  END
FROM aggregated a
WHERE a.avg_utility IS NOT NULL;

COMMENT ON VIEW orbit.v_quality_scores_calculated IS
  'Scores de qualidade calculados de orbit.ig_posts. '
  'Compatível com fetchQualityScores → v_quality_scores_calculated. '
  'Substitui public.quality_scores (tabela manual).';

-- ----------------------------------------------------------------------------
-- VIEW 3: v_format_performance_calculated
-- Performance por formato de conteúdo calculada de ig_posts
-- Compatível com fetchFormatPerformance → v_format_performance_calculated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW orbit.v_format_performance_calculated AS

SELECT
  gen_random_uuid()                   AS id,
  p.client_id,
  p.content_format::TEXT              AS format_name,
  COUNT(*)::INTEGER                   AS post_count,
  COALESCE(SUM(p.shares), 0)::INTEGER AS share_count,
  CASE
    WHEN AVG(p.er_real_pct) >= 2.0  THEN 'Alta performance'
    WHEN AVG(p.er_real_pct) >= 0.5  THEN 'Performance moderada'
    ELSE 'Baixa performance'
  END                                  AS trend_label,
  CASE
    WHEN AVG(p.er_real_pct) >= 2.0  THEN 'cyan'
    WHEN AVG(p.er_real_pct) >= 0.5  THEN 'gold'
    ELSE 'red'
  END                                  AS trend_color
FROM orbit.ig_posts p
GROUP BY p.client_id, p.content_format;

COMMENT ON VIEW orbit.v_format_performance_calculated IS
  'Performance por formato calculada de orbit.ig_posts. '
  'Compatível com fetchFormatPerformance → v_format_performance_calculated.';

-- ----------------------------------------------------------------------------
-- VIEW 4: v_client_health
-- Semáforo de saúde da carteira (tela Carteira do protótipo)
-- Compatível com clientsRepository → fetchClientsWithHealth
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW orbit.v_client_health AS

SELECT
  oc.id,
  oc.name,
  oc.handle,

  -- Status calculado com base nos últimos KPIs disponíveis
  CASE
    WHEN snap.er_real_pct < oc.threshold_er_min             THEN 'critical'
    WHEN snap.er_real_pct < (oc.threshold_er_min * 1.5)    THEN 'warning'
    WHEN snap.follower_churn_pct > oc.threshold_churn_pct  THEN 'warning'
    WHEN snap.follower_net_calc < 0                         THEN 'warning'
    ELSE 'healthy'
  END::orbit.health_status              AS health_status,

  snap.period_end                       AS last_snapshot_date,
  snap.followers_total,
  snap.followers_net                    AS follower_balance,
  snap.er_real_pct                      AS engagement_real,
  snap.follower_churn_pct,
  snap.vps,

  -- Cliques no link / visitas ao perfil = CTR bio
  CASE
    WHEN COALESCE(snap.profile_visits, 0) > 0 AND snap.link_clicks IS NOT NULL
    THEN ROUND((snap.link_clicks::NUMERIC / snap.profile_visits) * 100, 2)
    ELSE NULL
  END                                   AS ctr_link,

  -- Alertas abertos
  (
    SELECT COUNT(*)
    FROM orbit.alerts a
    WHERE a.client_id = oc.id AND NOT a.is_resolved AND a.severity = 'critical'
  )::INTEGER                            AS open_critical_alerts,

  (
    SELECT COUNT(*)
    FROM orbit.alerts a
    WHERE a.client_id = oc.id AND NOT a.is_resolved
  )::INTEGER                            AS open_alerts_total

FROM orbit.clients oc
LEFT JOIN LATERAL (
  SELECT
    *,
    (followers_gained - followers_lost)  AS follower_net_calc
  FROM orbit.ig_account_snapshots
  WHERE client_id = oc.id
  ORDER BY period_end DESC
  LIMIT 1
) snap ON TRUE;

COMMENT ON VIEW orbit.v_client_health IS
  'Semáforo de saúde da carteira. Alimenta tela Carteira do protótipo. '
  'Compatível com clientsRepository após migração do campo handle.';

-- ----------------------------------------------------------------------------
-- VIEW 5: v_avatar_alignment
-- Alinhamento entre avatar esperado (orbit.clients) e audiência real
-- Compatível com avatarRepository.ts (campos esperados: expected_*, real_*)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW orbit.v_avatar_alignment AS

SELECT
  aud.id,
  aud.client_id,

  -- Dados reais da audiência
  aud.gender_male_pct     AS real_gender_male,
  aud.gender_female_pct   AS real_gender_female,
  aud.age_25_34_pct       AS real_age_primary,
  aud.top_city_1          AS real_geo,
  aud.top_city_1_pct      AS real_geo_pct,

  -- Expectativas cadastradas em orbit.clients
  c.avatar_gender_pct     AS expected_gender_male,
  c.avatar_geo_primary    AS expected_geo,
  c.avatar_unconscious_desire AS expected_interest,
  CONCAT(c.avatar_age_min, '–', c.avatar_age_max) AS expected_age_range,

  -- Dados reais de idade (range concatenado do maior bucket)
  CASE
    WHEN aud.age_25_34_pct >= aud.age_18_24_pct
     AND aud.age_25_34_pct >= COALESCE(aud.age_35_44_pct, 0)
    THEN '25–34'
    WHEN aud.age_18_24_pct >= COALESCE(aud.age_35_44_pct, 0)
    THEN '18–24'
    ELSE '35–44'
  END AS real_age_range,

  -- C-05: Score de alinhamento de gênero
  -- score_gênero = 1 − |real_male_pct − expected_pct| / 100 → × 100
  GREATEST(0, ROUND(
    (1 - ABS(
      COALESCE(aud.gender_male_pct, 0) -
      COALESCE(c.avatar_gender_pct, 50)
    ) / 100.0) * 100, 2
  ))                       AS alignment_score,

  -- Status derivado do score composto
  CASE
    WHEN GREATEST(0, (1 - ABS(
      COALESCE(aud.gender_male_pct, 0) - COALESCE(c.avatar_gender_pct, 50)
    ) / 100.0) * 100) >= 85  THEN 'healthy'
    WHEN GREATEST(0, (1 - ABS(
      COALESCE(aud.gender_male_pct, 0) - COALESCE(c.avatar_gender_pct, 50)
    ) / 100.0) * 100) >= 70  THEN 'warning'
    ELSE 'critical'
  END::orbit.health_status AS alignment_status

FROM orbit.ig_audience_snapshots aud
JOIN orbit.clients c ON c.id = aud.client_id;

COMMENT ON VIEW orbit.v_avatar_alignment IS
  'Alinhamento avatar esperado × audiência real. '
  'Compatível com avatarRepository.ts (campos expected_*, real_*, alignment_score).';

-- ============================================================================
-- BLOCO 6 · RLS (Row Level Security)
-- ============================================================================

ALTER TABLE orbit.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit.ig_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit.ig_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit.ig_audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbit.alerts               ENABLE ROW LEVEL SECURITY;

-- ── Policies de PRODUÇÃO (isolamento por user_id) ──────────────────────────

CREATE POLICY "prod_clients_select"
  ON orbit.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "prod_clients_insert"
  ON orbit.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prod_clients_update"
  ON orbit.clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabelas filhas: isolamento via subquery em clients
CREATE POLICY "prod_ig_posts_select"
  ON orbit.ig_posts FOR SELECT
  USING (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "prod_ig_posts_insert"
  ON orbit.ig_posts FOR INSERT
  WITH CHECK (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "prod_snapshots_select"
  ON orbit.ig_account_snapshots FOR SELECT
  USING (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "prod_snapshots_insert"
  ON orbit.ig_account_snapshots FOR INSERT
  WITH CHECK (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "prod_audience_select"
  ON orbit.ig_audience_snapshots FOR SELECT
  USING (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "prod_audience_insert"
  ON orbit.ig_audience_snapshots FOR INSERT
  WITH CHECK (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "prod_alerts_select"
  ON orbit.alerts FOR SELECT
  USING (client_id IN (
    SELECT id FROM orbit.clients WHERE user_id = auth.uid()
  ));

-- ── Bypass de desenvolvimento local (Sprint 2 — remover no Sprint 3) ───────
-- ⚠️  COMBINA com políticas de produção via OR (permissive).
--     Remover ANTES do deploy em produção real.

CREATE POLICY "dev_clients_select"
  ON orbit.clients FOR SELECT TO public USING (true);

CREATE POLICY "dev_clients_insert"
  ON orbit.clients FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "dev_ig_posts_select"
  ON orbit.ig_posts FOR SELECT TO public USING (true);

CREATE POLICY "dev_ig_posts_insert"
  ON orbit.ig_posts FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "dev_snapshots_select"
  ON orbit.ig_account_snapshots FOR SELECT TO public USING (true);

CREATE POLICY "dev_snapshots_insert"
  ON orbit.ig_account_snapshots FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "dev_audience_select"
  ON orbit.ig_audience_snapshots FOR SELECT TO public USING (true);

CREATE POLICY "dev_audience_insert"
  ON orbit.ig_audience_snapshots FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "dev_alerts_select"
  ON orbit.alerts FOR SELECT TO public USING (true);

-- Documentar deprecação para não esquecer no Sprint 3
COMMENT ON POLICY "dev_clients_select" ON orbit.clients IS
  'DEPRECATED Sprint 2. Remover antes do deploy em produção (Sprint 3).';
COMMENT ON POLICY "dev_clients_insert" ON orbit.clients IS
  'DEPRECATED Sprint 2. Remover antes do deploy em produção (Sprint 3).';

-- ============================================================================
-- BLOCO 7 · TRIGGER updated_at (automático em todos os UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION orbit.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orbit_clients_updated_at
  BEFORE UPDATE ON orbit.clients
  FOR EACH ROW EXECUTE FUNCTION orbit.set_updated_at();

CREATE TRIGGER trg_orbit_posts_updated_at
  BEFORE UPDATE ON orbit.ig_posts
  FOR EACH ROW EXECUTE FUNCTION orbit.set_updated_at();

CREATE TRIGGER trg_orbit_snapshots_updated_at
  BEFORE UPDATE ON orbit.ig_account_snapshots
  FOR EACH ROW EXECUTE FUNCTION orbit.set_updated_at();

CREATE TRIGGER trg_orbit_audience_updated_at
  BEFORE UPDATE ON orbit.ig_audience_snapshots
  FOR EACH ROW EXECUTE FUNCTION orbit.set_updated_at();

-- ============================================================================
-- BLOCO 8 · GRANTS para PostgREST expor as views via REST
-- ============================================================================

GRANT SELECT ON orbit.v_kpi_snapshots                  TO anon, authenticated;
GRANT SELECT ON orbit.v_quality_scores_calculated       TO anon, authenticated;
GRANT SELECT ON orbit.v_format_performance_calculated   TO anon, authenticated;
GRANT SELECT ON orbit.v_client_health                   TO anon, authenticated;
GRANT SELECT ON orbit.v_avatar_alignment                TO anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA orbit TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA orbit TO service_role;

COMMIT;

-- =============================================================================
-- VALIDAÇÃO PÓS-EXECUÇÃO
-- Cole no SQL Editor após o bloco acima para confirmar que tudo foi criado
-- =============================================================================
/*
-- Tabelas criadas:
SELECT tablename FROM pg_tables WHERE schemaname = 'orbit' ORDER BY tablename;
-- Esperado: alerts, clients, ig_account_snapshots, ig_audience_snapshots, ig_posts

-- Enums criados:
SELECT typname FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'orbit')
ORDER BY typname;
-- Esperado: confidence_level, content_format, health_status

-- Views criadas:
SELECT viewname FROM pg_views WHERE schemaname = 'orbit' ORDER BY viewname;
-- Esperado: v_avatar_alignment, v_client_health, v_format_performance_calculated,
--           v_kpi_snapshots, v_quality_scores_calculated

-- RLS ativo:
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'orbit' ORDER BY tablename;
-- Esperado: rowsecurity = true em todas as 5 tabelas

-- Testar GENERATED COLUMNS (divisão por zero deve retornar NULL, não erro):
INSERT INTO orbit.clients (name, handle) VALUES ('Teste', '@teste_validacao');
INSERT INTO orbit.ig_posts (
  client_id, content_format, post_external_id, published_at,
  reach, likes, comments, shares, saves
)
SELECT id, 'reel', 'post-zero-reach', now(), 0, 0, 0, 0, 0
FROM orbit.clients WHERE handle = '@teste_validacao';

SELECT er_real_pct, polemic_score_pct, utility_score_pct
FROM orbit.ig_posts WHERE post_external_id = 'post-zero-reach';
-- Esperado: NULL | NULL | NULL (sem erro de divisão por zero)

-- Limpar teste:
DELETE FROM orbit.clients WHERE handle = '@teste_validacao';
*/