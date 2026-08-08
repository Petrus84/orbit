-- 1. Fix estrutural: qualquer view/tabela futura criada pelo postgres em orbit
--    já nasce com SELECT liberado, mesmo se criada via DROP+CREATE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA orbit
  GRANT SELECT ON TABLES TO anon, authenticated, service_role;

-- 2. Fix pontual: reabre a porta para a view que está 403 agora.
GRANT SELECT ON orbit.v_format_performance TO anon, authenticated, service_role;