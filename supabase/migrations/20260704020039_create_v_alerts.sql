CREATE VIEW orbit.v_alerts AS
SELECT
  a.id,
  a.client_id  AS "clientId",
  c.name       AS "clientName",
  c.handle     AS "clientHandle",
  a.title,
  COALESCE(a.description, '')::text AS description,
  CASE a.severity
    WHEN 'success' THEN 'info'   -- 'success' não existe no AlertSeverity do frontend (critical|warning|info)
    ELSE a.severity::text
  END AS severity,
  a.created_at AS "createdAt",
  a.is_resolved,
  a.is_snoozed
FROM orbit.alerts a
JOIN orbit.clients c ON c.id = a.client_id;

GRANT SELECT ON orbit.v_alerts TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
