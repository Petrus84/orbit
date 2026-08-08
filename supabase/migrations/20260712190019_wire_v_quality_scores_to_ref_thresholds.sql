CREATE OR REPLACE VIEW orbit.v_quality_scores AS
WITH latest_snapshot AS (
  SELECT DISTINCT ON (client_id)
    client_id, period_start, period_end,
    utility_score_pct, polemic_score_pct, vps_pct, er_real_pct, created_at
  FROM orbit.ig_account_snapshots
  ORDER BY client_id, period_end DESC
),
unpivoted AS (
  SELECT
    client_id, period_start, period_end, created_at,
    scores.metric_name, scores.display_label, scores.score_value
  FROM latest_snapshot
  CROSS JOIN LATERAL (VALUES
    ('utility_score_pct', 'Score Utilidade', utility_score_pct),
    ('polemic_score_pct', 'Score Polêmica',  polemic_score_pct),
    ('vps_pct',           'VPS',             vps_pct),
    ('er_real_pct',       'ER Real',         er_real_pct)
  ) AS scores(metric_name, display_label, score_value)
)
SELECT
  gen_random_uuid()            AS id,
  u.client_id,
  u.period_start,
  u.period_end,
  u.display_label              AS score_key,
  u.score_value::numeric       AS score_value,
  CASE
    WHEN u.score_value IS NULL THEN 'Sem dados suficientes para calcular'
    WHEN t.metric_name IS NULL THEN 'Sem threshold definido para esta métrica ainda'
    WHEN (t.red_min   IS NOT NULL OR t.red_max   IS NOT NULL)
     AND (t.red_min   IS NULL OR u.score_value >= t.red_min)
     AND (t.red_max   IS NULL OR u.score_value <= t.red_max)   THEN 'Crítico'
    WHEN (t.green_min IS NOT NULL OR t.green_max IS NOT NULL)
     AND (t.green_min IS NULL OR u.score_value >= t.green_min)
     AND (t.green_max IS NULL OR u.score_value <= t.green_max) THEN 'Saudável'
    ELSE 'Atenção'
  END AS status_text,
  CASE
    WHEN u.score_value IS NULL OR t.metric_name IS NULL THEN 'neutral'
    WHEN (t.red_min   IS NOT NULL OR t.red_max   IS NOT NULL)
     AND (t.red_min   IS NULL OR u.score_value >= t.red_min)
     AND (t.red_max   IS NULL OR u.score_value <= t.red_max)   THEN 'warn'
    WHEN (t.green_min IS NOT NULL OR t.green_max IS NOT NULL)
     AND (t.green_min IS NULL OR u.score_value >= t.green_min)
     AND (t.green_max IS NULL OR u.score_value <= t.green_max) THEN 'ok'
    ELSE 'neutral'
  END AS status_variant,
  u.created_at
FROM unpivoted u
LEFT JOIN orbit.ref_thresholds t ON t.metric_name = u.metric_name;
