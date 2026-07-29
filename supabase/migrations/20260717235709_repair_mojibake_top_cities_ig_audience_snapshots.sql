UPDATE orbit.ig_audience_snapshots s
SET top_cities = fixed.arr
FROM (
  SELECT
    id,
    jsonb_agg(
      CASE
        WHEN elem->>'name' ~ '[ÃÂ]'
        THEN jsonb_set(elem, '{name}', to_jsonb(convert_from(convert_to(elem->>'name', 'LATIN1'), 'UTF8')))
        ELSE elem
      END
      ORDER BY ord
    ) AS arr
  FROM orbit.ig_audience_snapshots, jsonb_array_elements(top_cities) WITH ORDINALITY AS t(elem, ord)
  GROUP BY id
) fixed
WHERE s.id = fixed.id
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(s.top_cities) e WHERE e->>'name' ~ '[ÃÂ]'
  );
