-- ============================================================================
-- ORBIT · Content Contract Fit — migração schema
-- Fecha os 3 gaps identificados no MFV (SIPOC) sobre schema já confirmado:
--   1) orbit.alerts       → falta natureza / probable_cause / confidence_level
--   2) (inexistente)      → InsightData não tem persistência nem confidence
--   3) orbit.ref_thresholds → falta os campos de percentil do thresoldsfinais.json
-- Nenhuma coluna/tabela abaixo duplica o que já existe em orbit.alerts /
-- orbit.ref_thresholds (colunas confirmadas via information_schema, ver anexo
-- de schema). description/suggested_action/action_url são reaproveitados,
-- não recriados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ALERTS — separar Motor de Discurso (item 28 do Content Contract Tree)
--    e carregar confidence_level explícito (regra "não decidir sem o dado
--    que falta", itens 1/4/15/25/29).
-- ----------------------------------------------------------------------------

-- orbit.confidence_level já existe no banco (L0/L1/L2), conforme orbit.ts
-- linha ~129: "Evidência: orbit.confidence_level = L0, L1, L2". Reaproveitado,
-- não recriado.

CREATE TYPE orbit.alert_natureza AS ENUM ('tecnica', 'comunicacao');

ALTER TABLE orbit.alerts
  ADD COLUMN natureza          orbit.alert_natureza,
  ADD COLUMN probable_cause    text,
  ADD COLUMN confidence_level  orbit.confidence_level,
  ADD COLUMN data_source       text;  -- 'real_snapshot' | 'fallback_by_client' | 'estimate'
  -- data_source existe porque o Funil (Imagem 4) já produz alertas/derivações
  -- a partir de FALLBACK_BY_CLIENT sem marcar a origem no dado que chega à
  -- UI. Governança do produto: "null deve propagar visivelmente" — este
  -- campo é o que permite a UI decidir se mostra o selo de fallback.

COMMENT ON COLUMN orbit.alerts.natureza IS
  'tecnica = resolvível com dado; comunicacao = resolvível com plano de conversa (Content Contract Tree, item 28). Nunca inferir: o motor de regras decide, nunca a UI.';
COMMENT ON COLUMN orbit.alerts.confidence_level IS
  'L0 = dado direto confirmado; L1 = raciocínio fundamentado sobre premissa dada; L2 = decidível apenas quando o dado que falta existir. Alert com confidence_level=L2 nunca deveria ter severity=critical sem probable_cause explícito dizendo qual dado falta.';
COMMENT ON COLUMN orbit.alerts.data_source IS
  'Proveniência do dado que gerou o alerta. Nunca omitir quando = fallback_by_client — a UI deve renderizar isso, não escondê-lo atrás de um número que parece calculado ao vivo.';

-- ----------------------------------------------------------------------------
-- 2) CONTENT_INSIGHTS — não existe hoje (grep em orbit.ts confirma:
--    InsightData tem só {id, text}, sem tabela raw nem confidence_level).
--    É o único dos 4 formatos de copy final (Alert / Insight / QualityScore /
--    FormatPerformance) sem selo de confiança persistido.
-- ----------------------------------------------------------------------------

CREATE TABLE orbit.content_insights (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES orbit.clients(id),
  snapshot_id       uuid,                      -- rastreabilidade até o dado-fonte
  text              text NOT NULL,
  metric_name       text,                      -- FK lógica para ref_thresholds.metric_name
  confidence_level  orbit.confidence_level NOT NULL DEFAULT 'L1',
  natureza          orbit.alert_natureza NOT NULL DEFAULT 'tecnica',
  exportable        boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE orbit.content_insights IS
  'Persistência para InsightData (orbit.ts). Antes desta tabela, o insight nascia e morria como string solta na camada de apresentação, sem confidence_level nem rastro do metric_name que o gerou — impossível auditar depois se a frase era L0 ou L2 no momento em que foi escrita.';

-- ----------------------------------------------------------------------------
-- 3) REF_THRESHOLDS — absorve o corpo de thresoldsfinais.json.
--    Sem estas colunas, "GREEN" é um adjetivo sem alegação estatística por
--    trás; com elas, statusText pode citar "top 10% da amostra (n=1678)".
-- ----------------------------------------------------------------------------

CREATE TYPE orbit.calibration_method AS ENUM (
  'percentile_relative',            -- maioria dos posts = 0 (utilidade/polêmica)
  'percentile_based',               -- distribuição real e útil (ex: play_to_view)
  'percentile_based_lower_better'   -- ex: algo_risk_score
);

ALTER TABLE orbit.ref_thresholds
  ADD COLUMN calibration_method   orbit.calibration_method,
  ADD COLUMN percentile_p10       numeric,
  ADD COLUMN percentile_p25       numeric,
  ADD COLUMN percentile_p50       numeric,
  ADD COLUMN percentile_p75       numeric,
  ADD COLUMN percentile_p90       numeric,
  ADD COLUMN sample_mean          numeric,
  ADD COLUMN sample_std           numeric,
  ADD COLUMN sample_count         integer,
  ADD COLUMN confidence_score     numeric,      -- 0-1, ex: 0.95
  ADD COLUMN benchmark_note       text;         -- por que o benchmark de mercado genérico não se aplica

COMMENT ON COLUMN orbit.ref_thresholds.benchmark_note IS
  'Ex.: "Benchmark de indústria (20/40/70) não se aplica a esta amostra. Dados reais são muito mais baixos." Existe para impedir que alguém, no futuro, "corrija" green_min de volta para um número de manual sem saber que ele já foi rejeitado por dado real.';

-- Seed: os 5 metric_name de thresoldsfinais.json, mapeados 1:1 nas colunas
-- já confirmadas (green_min/max, amber_min/max, red_min/max, unit, notes)
-- + as novas colunas de percentil.
INSERT INTO orbit.ref_thresholds
  (metric_name, unit, calibration_method,
   percentile_p10, percentile_p25, percentile_p50, percentile_p75, percentile_p90,
   sample_mean, sample_std, sample_count, confidence_score,
   green_min, green_max, amber_min, amber_max, red_min, red_max,
   notes, benchmark_note)
VALUES
  ('utilidade_score', 'pts', 'percentile_relative',
   0, 0, 0, 0, 25, 8.6, 18.76, 1678, 0.95,
   25, NULL, 1, 24, NULL, 0,
   '75% dos posts têm score 0. Use como ranking relativo. GREEN = top 10% da amostra (score ≥ 25).',
   'Benchmark de indústria (20/40/70) não se aplica a esta amostra. Dados reais são muito mais baixos.'),

  ('polemica_score', 'pts', 'percentile_relative',
   0, 0, 0, 0, 15, 4.68, 10.03, 1678, 0.95,
   NULL, 5, 6, 15, 16, NULL,
   '75% dos posts têm score 0. GREEN = baixa polêmica (≤5). RED = score ≥16 (raro nesta amostra).',
   'Benchmark de indústria (5/15/30) é referência apenas.'),

  ('play_to_view_ratio', 'x', 'percentile_based',
   2.12, 2.50, 3.43, 11.76, 69.37, 38.63, 172.45, 1033, 0.95,
   11.76, NULL, 2.50, 11.76, NULL, 2.50,
   'Thresholds válidos. GREEN = top 25% da amostra.', NULL),

  ('engagement_public', 'count', 'percentile_based',
   9, 39, 195, 961, 3990, 7328.82, 75426.66, 1678, 0.95,
   961, NULL, 39, 961, NULL, 39,
   'Thresholds válidos. GREEN = top 25% da amostra.', NULL),

  ('algo_risk_score', 'pts', 'percentile_based_lower_better',
   0, 25, 32.5, 40, 50, 32.16, 17.04, 58, 0.95,
   NULL, 25, 25, 40, 40, NULL,
   'GREEN = risco baixo (≤25). RED = risco alto (≥40). Baseado em 58 contas.', NULL);

-- ----------------------------------------------------------------------------
-- 4) FUNÇÃO — classifica um valor bruto contra a régua real e devolve o
--    texto que QualityScoresPanel.tsx / InsightCard.tsx / CriticalAlert.tsx
--    devem exibir. Esta função é o que fecha o gap "QualityScoreRow.status_text
--    é texto livre, sem amarração formal ao percentil real".
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION orbit.fn_classify_metric(
  p_metric_name text,
  p_value       numeric
) RETURNS TABLE (
  semaphore    orbit.semaphore_color,   -- assume enum já existente (verde/ambar/vermelho)
  status_text  text,
  confidence_level orbit.confidence_level
) AS $$
DECLARE
  t orbit.ref_thresholds%ROWTYPE;
  v_pct text;
BEGIN
  SELECT * INTO t FROM orbit.ref_thresholds WHERE metric_name = p_metric_name;

  IF NOT FOUND THEN
    -- Regra do Content Contract: sem régua, não inventar classificação.
    RETURN QUERY SELECT
      NULL::orbit.semaphore_color,
      'sem threshold calibrado para ' || p_metric_name,
      'L2'::orbit.confidence_level;
    RETURN;
  END IF;

  -- posição percentil aproximada, só para o texto — não é o cálculo de cor
  v_pct := CASE
    WHEN p_value >= t.percentile_p90 THEN 'top 10%'
    WHEN p_value >= t.percentile_p75 THEN 'top 25%'
    WHEN p_value >= t.percentile_p50 THEN 'acima da mediana'
    WHEN p_value >= t.percentile_p25 THEN 'abaixo da mediana'
    ELSE 'bottom 25%'
  END;

  RETURN QUERY SELECT
    CASE
      WHEN t.green_min IS NOT NULL AND p_value >= t.green_min THEN 'verde'
      WHEN t.green_max IS NOT NULL AND p_value <= t.green_max THEN 'verde'
      WHEN t.red_min   IS NOT NULL AND p_value >= t.red_min   THEN 'vermelho'
      WHEN t.red_max   IS NOT NULL AND p_value <= t.red_max   THEN 'vermelho'
      ELSE 'ambar'
    END::orbit.semaphore_color,
    format('%s (%s da amostra, n=%s)', p_value, v_pct, t.sample_count),
    CASE WHEN t.sample_count < 100 THEN 'L1' ELSE 'L0' END::orbit.confidence_level;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION orbit.fn_classify_metric IS
  'Única função autorizada a decidir cor+texto de um score. status_text sempre carrega o denominador da amostra (n=) — nenhum componente de front-end deveria montar esse texto na mão, ou "GREEN" volta a virar adjetivo sem alegação estatística por trás.';
