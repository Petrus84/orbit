-- Views órfãs, não referenciadas por nenhum repositório do frontend (instagramOverviewRepository.ts
-- usa apenas v_quality_scores e v_format_performance). Confirmado via pg_depend antes de dropar.
drop view if exists orbit.v_quality_scores_calculate;
drop view if exists orbit.v_quality_scores_calculated;
drop view if exists orbit.v_format_performance_calculated;
