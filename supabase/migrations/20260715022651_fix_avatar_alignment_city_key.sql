CREATE OR REPLACE FUNCTION orbit.compute_avatar_alignment(p_client_id uuid, p_audience_id uuid)
 RETURNS TABLE(gender_score numeric, age_score numeric, geo_score numeric, composite numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'orbit', 'public'
AS $function$
DECLARE
  v_client   orbit.clients%ROWTYPE;
  v_aud      orbit.ig_audience_snapshots%ROWTYPE;
  v_real_dom NUMERIC;
  v_age_sum  NUMERIC;
  v_geo_pct  NUMERIC;
  v_g_score  NUMERIC;
  v_a_score  NUMERIC;
  v_geo_scr  NUMERIC;
BEGIN
  SELECT * INTO v_client FROM orbit.clients WHERE id = p_client_id;
  SELECT * INTO v_aud    FROM orbit.ig_audience_snapshots WHERE id = p_audience_id;

  -- Gênero
  v_real_dom := CASE v_client.avatar_expected_gender
    WHEN 'male'   THEN COALESCE(v_aud.gender_male_pct,   0)
    WHEN 'female' THEN COALESCE(v_aud.gender_female_pct, 0)
    ELSE 50
  END;
  v_g_score := GREATEST(0,
    ROUND((1 - ABS(v_real_dom - COALESCE(v_client.avatar_expected_gender_pct, 50)) / 100.0) * 100, 2)
  );

  -- Idade: acumula % dentro do range esperado do cliente
  v_age_sum := 0;
  IF v_client.avatar_expected_age_min <= 17 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_13_17_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 24 AND v_client.avatar_expected_age_max >= 18 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_18_24_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 34 AND v_client.avatar_expected_age_max >= 25 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_25_34_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 44 AND v_client.avatar_expected_age_max >= 35 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_35_44_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_min <= 54 AND v_client.avatar_expected_age_max >= 45 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_45_54_pct, 0);
  END IF;
  IF v_client.avatar_expected_age_max >= 55 THEN
    v_age_sum := v_age_sum + COALESCE(v_aud.age_55_plus_pct, 0);
  END IF;
  v_a_score := LEAST(100, GREATEST(0, ROUND(v_age_sum, 2)));

  -- Geo: busca % da cidade primária no JSONB
  -- 🔧 FIX: a chave real gravada pela ingestão é "name", não "city"
  SELECT COALESCE((
    SELECT (item->>'pct')::NUMERIC
    FROM jsonb_array_elements(v_aud.top_cities) AS item
    WHERE item->>'name' ILIKE '%' || v_client.avatar_expected_geo_primary || '%'
    LIMIT 1
  ), 0) INTO v_geo_pct;

  v_geo_scr := GREATEST(0,
    ROUND((1 - ABS(v_geo_pct - COALESCE(v_client.avatar_expected_geo_pct, 20)) / 100.0) * 100, 2)
  );

  RETURN QUERY SELECT
    v_g_score,
    v_a_score,
    v_geo_scr,
    ROUND((v_g_score * 0.4) + (v_a_score * 0.4) + (v_geo_scr * 0.2), 2);
END;
$function$;
