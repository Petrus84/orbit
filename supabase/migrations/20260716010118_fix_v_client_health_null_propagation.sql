CREATE OR REPLACE VIEW orbit.v_client_health AS
SELECT
  c.id AS client_id,
  c.handle,
  c.name AS avatar_name,
  count(mh.id) AS metric_count,

  CASE
    WHEN count(mh.id) = 0 THEN NULL::numeric(5,2)
    ELSE round(avg(LEAST(100::numeric, GREATEST(0::numeric, mh.metric_value))))::numeric(5,2)
  END AS avg_quality_score,

  CASE
    WHEN count(mh.id) = 0 THEN NULL::text
    WHEN avg(LEAST(100::numeric, GREATEST(0::numeric, mh.metric_value))) >= 75 THEN 'healthy'::text
    WHEN avg(LEAST(100::numeric, GREATEST(0::numeric, mh.metric_value))) >= 50 THEN 'warning'::text
    ELSE 'critical'::text
  END AS health_status,

  max(mh.recorded_at) AS last_updated,
  EXTRACT(day FROM now() - max(mh.recorded_at))::integer AS days_since_update,
  max(mh.confidence_level) AS max_confidence_level
FROM orbit.clients c
LEFT JOIN orbit.metric_history mh
  ON c.id = mh.client_id
  AND mh.metric_date >= (CURRENT_DATE - interval '30 days')
GROUP BY c.id, c.handle, c.name
ORDER BY
  CASE health_status
    WHEN 'critical' THEN 0
    WHEN 'warning'  THEN 1
    WHEN 'healthy'  THEN 2
    ELSE 3
  END,
  avg_quality_score DESC NULLS LAST;
