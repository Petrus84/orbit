CREATE TABLE IF NOT EXISTS orbit.avatar_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES orbit.clients(id) ON DELETE CASCADE,
  validation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observed_interest TEXT NULL,
  observed_geo_primary TEXT NULL,
  observed_geo_pct NUMERIC(5,2) NULL,
  source TEXT NOT NULL CHECK (source IN ('instagram_insights', 'client_feedback', 'manual')),
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('L0', 'L1', 'L2')),
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, validation_date)
);

CREATE INDEX IF NOT EXISTS idx_avatar_validations_client_date
  ON orbit.avatar_validations (client_id, validation_date DESC);

COMMENT ON TABLE orbit.avatar_validations IS
  'Feedback qualitativo do cliente sobre interesse/geo real da audiência (Fase 3 do onboarding). Preenche o gap estrutural de real_interest em v_avatar_alignment, que o Instagram Insights não expõe.';
