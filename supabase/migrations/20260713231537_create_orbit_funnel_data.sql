CREATE TABLE orbit.funnel_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES orbit.clients(id) ON DELETE CASCADE,
  alcance integer NOT NULL DEFAULT 0,
  visitas integer NOT NULL DEFAULT 0,
  cliques integer NOT NULL DEFAULT 0,
  vendas integer NOT NULL DEFAULT 0,
  ctr_bio numeric NOT NULL DEFAULT 0,
  taxa_conv numeric NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funnel_data_pkey PRIMARY KEY (id)
);

ALTER TABLE orbit.funnel_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read_funnel_data ON orbit.funnel_data
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY svc_funnel_data_all ON orbit.funnel_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);
