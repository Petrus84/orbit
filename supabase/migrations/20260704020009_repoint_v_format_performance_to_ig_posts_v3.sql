DROP VIEW orbit.v_format_performance;

CREATE VIEW orbit.v_format_performance AS
SELECT
  (array_agg(id))[1] AS id,
  client_id,
  min(published_at)::date AS period_start,
  max(published_at)::date AS period_end,
  CASE content_format
    WHEN 'reel'        THEN 'Reels'
    WHEN 'story'       THEN 'Stories'
    WHEN 'static_post' THEN 'Estático'
    WHEN 'carousel'    THEN 'Carrossel'
    WHEN 'live'        THEN 'Live'
    WHEN 'igtv'        THEN 'IGTV'
  END AS format_name,
  count(*) AS post_count,
  COALESCE(sum(shares), 0) AS share_count,
  'Estável'::text AS trend_label,
  'gold'::text AS trend_color
FROM orbit.ig_posts
WHERE confidence_level = ANY (ARRAY['L0'::orbit.confidence_level, 'L1'::orbit.confidence_level])
   OR confidence_level::text = 'healthy'::text
GROUP BY client_id, content_format;

GRANT SELECT ON orbit.v_format_performance TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';