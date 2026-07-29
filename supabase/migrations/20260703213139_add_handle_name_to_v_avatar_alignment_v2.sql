CREATE OR REPLACE VIEW orbit.v_avatar_alignment AS
SELECT c.id,
    c.id AS client_id,
        CASE
            WHEN c.avatar_expected_gender = 'male'::orbit.gender_category THEN COALESCE(c.avatar_expected_gender_pct, 50::numeric)
            WHEN c.avatar_expected_gender = 'female'::orbit.gender_category THEN 100::numeric - COALESCE(c.avatar_expected_gender_pct, 50::numeric)
            ELSE 50::numeric
        END AS expected_gender_male,
        CASE
            WHEN c.avatar_expected_gender = 'male'::orbit.gender_category THEN 100::numeric - COALESCE(c.avatar_expected_gender_pct, 50::numeric)
            WHEN c.avatar_expected_gender = 'female'::orbit.gender_category THEN COALESCE(c.avatar_expected_gender_pct, 50::numeric)
            ELSE 50::numeric
        END AS expected_gender_female,
    concat(COALESCE(c.avatar_expected_age_min::text, '18'::text), '–', COALESCE(c.avatar_expected_age_max::text, '65'::text)) AS expected_age_range,
    c.avatar_expected_geo_primary AS expected_geo,
    COALESCE(c.avatar_expected_geo_pct, 100::numeric) AS expected_geo_pct,
    c.avatar_unconscious_desire AS expected_interest,
    aud.gender_male_pct AS real_gender_male,
    aud.gender_female_pct AS real_gender_female,
        CASE
            WHEN GREATEST(COALESCE(aud.age_18_24_pct, 0::numeric), COALESCE(aud.age_25_34_pct, 0::numeric), COALESCE(aud.age_35_44_pct, 0::numeric), COALESCE(aud.age_45_54_pct, 0::numeric), COALESCE(aud.age_55_plus_pct, 0::numeric)) = COALESCE(aud.age_18_24_pct, 0::numeric) THEN '18–24'::text
            WHEN GREATEST(COALESCE(aud.age_18_24_pct, 0::numeric), COALESCE(aud.age_25_34_pct, 0::numeric), COALESCE(aud.age_35_44_pct, 0::numeric), COALESCE(aud.age_45_54_pct, 0::numeric), COALESCE(aud.age_55_plus_pct, 0::numeric)) = COALESCE(aud.age_25_34_pct, 0::numeric) THEN '25–34'::text
            WHEN GREATEST(COALESCE(aud.age_18_24_pct, 0::numeric), COALESCE(aud.age_25_34_pct, 0::numeric), COALESCE(aud.age_35_44_pct, 0::numeric), COALESCE(aud.age_45_54_pct, 0::numeric), COALESCE(aud.age_55_plus_pct, 0::numeric)) = COALESCE(aud.age_35_44_pct, 0::numeric) THEN '35–44'::text
            WHEN GREATEST(COALESCE(aud.age_18_24_pct, 0::numeric), COALESCE(aud.age_25_34_pct, 0::numeric), COALESCE(aud.age_35_44_pct, 0::numeric), COALESCE(aud.age_45_54_pct, 0::numeric), COALESCE(aud.age_55_plus_pct, 0::numeric)) = COALESCE(aud.age_45_54_pct, 0::numeric) THEN '45–54'::text
            ELSE '55+'::text
        END AS real_age_range,
    (aud.top_cities -> 0) ->> 'name'::text AS real_geo,
    ((aud.top_cities -> 0) ->> 'pct'::text)::numeric AS real_geo_pct,
    COALESCE(aud.avatar_composite_score, 0::numeric) AS alignment_score,
        CASE
            WHEN aud.id IS NULL THEN 'warning'::orbit.health_status
            WHEN COALESCE(aud.avatar_composite_score, 0::numeric) >= 85::numeric THEN 'healthy'::orbit.health_status
            WHEN COALESCE(aud.avatar_composite_score, 0::numeric) >= 70::numeric THEN 'warning'::orbit.health_status
            ELSE 'critical'::orbit.health_status
        END AS alignment_status,
    c.handle,
    c.name
   FROM orbit.clients c
     LEFT JOIN LATERAL ( SELECT ig_audience_snapshots.id,
            ig_audience_snapshots.client_id,
            ig_audience_snapshots.import_session,
            ig_audience_snapshots.created_at,
            ig_audience_snapshots.period_start,
            ig_audience_snapshots.period_end,
            ig_audience_snapshots.gender_female_pct,
            ig_audience_snapshots.gender_male_pct,
            ig_audience_snapshots.gender_other_pct,
            ig_audience_snapshots.age_13_17_pct,
            ig_audience_snapshots.age_18_24_pct,
            ig_audience_snapshots.age_25_34_pct,
            ig_audience_snapshots.age_35_44_pct,
            ig_audience_snapshots.age_45_54_pct,
            ig_audience_snapshots.age_55_plus_pct,
            ig_audience_snapshots.top_cities,
            ig_audience_snapshots.top_countries,
            ig_audience_snapshots.confidence_level,
            ig_audience_snapshots.avatar_gender_alignment_score,
            ig_audience_snapshots.avatar_age_alignment_score,
            ig_audience_snapshots.avatar_geo_alignment_score,
            ig_audience_snapshots.avatar_composite_score
           FROM orbit.ig_audience_snapshots
          WHERE ig_audience_snapshots.client_id = c.id
          ORDER BY ig_audience_snapshots.period_end DESC
         LIMIT 1) aud ON true;