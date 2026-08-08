GRANT SELECT ON orbit.v_avatar_alignment TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
