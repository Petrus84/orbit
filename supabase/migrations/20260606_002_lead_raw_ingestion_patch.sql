-- ==========================================================================
-- ORBIT · Patch de banco — lead_raw_ingestion
-- Executar no Supabase SQL Editor
-- ==========================================================================

-- 1. A tabela lead_raw_ingestion foi criada sem UNIQUE(post_external_id, client_id)
--    O upsert do script v2 depende dessa constraint para idempotência.
--    Se já existir, o comando abaixo é seguro (IF NOT EXISTS).

ALTER TABLE public.lead_raw_ingestion
  ADD CONSTRAINT IF NOT EXISTS lead_unique_post_client
  UNIQUE (post_external_id, client_id);

-- 2. Adicionar coluna owner_username (para facilitar queries sem JOIN)
--    A tabela atual não tem esse campo explícito.

ALTER TABLE public.lead_raw_ingestion
  ADD COLUMN IF NOT EXISTS owner_username text;

-- 3. RLS — verificar se está ativo
ALTER TABLE public.lead_raw_ingestion ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por agency (service role do script bypassa isso)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_raw_ingestion'
      AND policyname = 'lead_agency_isolation'
  ) THEN
    CREATE POLICY "lead_agency_isolation" ON public.lead_raw_ingestion
      FOR ALL
      USING (agency_id = current_setting('app.agency_id', true));
  END IF;
END $$;

-- 4. View de análise de leads (para módulo de prospecção / pipeline de vendas)
CREATE OR REPLACE VIEW public.v_lead_analysis AS
SELECT
  client_id                                           AS lead_username,
  owner_username,
  agency_id,
  COUNT(*)                                            AS total_posts,
  COUNT(*) FILTER (WHERE product_type = 'Video')      AS posts_video,
  COUNT(*) FILTER (WHERE product_type = 'Image')      AS posts_imagem,
  COUNT(*) FILTER (WHERE product_type = 'Sidecar')    AS posts_carrossel,
  ROUND(AVG(play_rate)::numeric, 4)                   AS avg_play_rate,
  ROUND(AVG(likes_count)::numeric, 1)                 AS avg_likes,
  ROUND(AVG(comments_count)::numeric, 1)              AS avg_comments,
  COALESCE(
    SUM((comment_signals->>'intencao_compra')::int), 0
  )                                                   AS total_intencao_compra,
  COALESCE(
    SUM((comment_signals->>'intencao_produto')::int), 0
  )                                                   AS total_intencao_produto,
  COUNT(*) FILTER (WHERE uses_original_audio = true)  AS posts_audio_original,
  COUNT(*) FILTER (WHERE is_coautoria = true)         AS posts_coautoria,
  COUNT(*) FILTER (WHERE play_rate < 0.35)            AS posts_retencao_critica,
  COUNT(*) FILTER (WHERE play_rate >= 0.50)           AS posts_retencao_boa,
  MIN(posted_at)                                      AS primeiro_post,
  MAX(posted_at)                                      AS ultimo_post,
  MAX(ingested_at)                                    AS ultima_ingestao
FROM public.lead_raw_ingestion
GROUP BY client_id, owner_username, agency_id;

-- 5. Garantia de isolamento: confirmar que views do dashboard
--    NÃO referenciam lead_raw_ingestion

SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('v_kpi_snapshots', 'v_quality_scores', 'v_format_performance')
  AND definition ILIKE '%lead_raw_ingestion%';
-- Deve retornar 0 linhas. Se retornar alguma, há contaminação de dados.
