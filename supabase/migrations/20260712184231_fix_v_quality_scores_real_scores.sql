CREATE OR REPLACE VIEW orbit.v_quality_scores AS
WITH latest_snapshot AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    period_start,
    period_end,
    utility_score_pct,
    polemic_score_pct,
    vps_pct,
    er_real_pct,
    created_at
  FROM orbit.ig_account_snapshots
  ORDER BY client_id, period_end DESC
)
SELECT
  gen_random_uuid() AS id,
  client_id,
  period_start,
  period_end,
  scores.score_key,
  scores.score_value::numeric AS score_value,
  CASE WHEN scores.score_value IS NULL
       THEN 'Sem dados suficientes para calcular'
       ELSE 'Sem threshold definido para esta métrica ainda'
  END AS status_text,
  'neutral'::text AS status_variant,
  created_at
FROM latest_snapshot
CROSS JOIN LATERAL (VALUES
  ('Score Utilidade', utility_score_pct),
  ('Score Polêmica',  polemic_score_pct),
  ('VPS',             vps_pct),
  ('ER Real',         er_real_pct)
) AS scores(score_key, score_value);
