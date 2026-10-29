-- ============================================================================
-- DMs A.C. Enxovais — agregado mensal (varredura_vendas_instagram_AC_enxovais.xlsx)
-- Aplicar após 20261029093600_funnel_registry_ddl.sql.
-- Totais conferidos contra a planilha: 172 conversas · A/B/C/D/E = 10/19/26/94/23 · 45 follow-ups (aba Follow-up: conversas B e C).
-- Mês pela data da 1ª mensagem da conversa. Sem texto de mensagem, sem nome de cliente.
-- Roda só se o cliente existir; a conferência final só dispara se as linhas entraram.
-- ============================================================================
begin;

with v(period_start, period_end, a, b, c, d, e, fu) as (values
  ('2025-10-06','2025-10-31',1,4,2,3,1,6),
  ('2025-11-01','2025-11-30',1,5,4,8,5,9),
  ('2025-12-01','2025-12-31',1,2,2,10,0,4),
  ('2026-01-01','2026-01-31',7,6,10,16,12,16),
  ('2026-02-01','2026-02-28',0,1,2,5,1,3),
  ('2026-03-01','2026-03-31',0,0,0,8,1,0),
  ('2026-04-01','2026-04-30',0,1,2,4,1,3),
  ('2026-05-01','2026-05-31',0,0,1,11,1,1),
  ('2026-06-01','2026-06-30',0,0,2,10,1,2),
  ('2026-07-01','2026-07-31',0,0,0,6,0,0),
  ('2026-08-01','2026-08-31',0,0,0,4,0,0),
  ('2026-09-01','2026-09-30',0,0,1,8,0,1),
  ('2026-10-01','2026-10-03',0,0,0,1,0,0)
)
insert into orbit.ig_dm_funnel_snapshot
  (client_id, period_start, period_end, grade_a, grade_b, grade_c, grade_d, grade_e, followups_pending, confidence_level, source_note)
select 'a131cba6-bd51-4d86-b7be-a9e7ee481e98'::uuid,
       v.period_start::date, v.period_end::date, v.a, v.b, v.c, v.d, v.e, v.fu, 'L1',
       'Varredura de DMs do Instagram, 06/10/2025–03/10/2026 (172 conversas comerciais de 334; spam, sem relação com venda, sem resposta e compras da própria loja ficaram de fora). Classificação automática por palavra-chave: confira em Mensagens-chave antes de usar como contagem oficial. 249 áudios e anexos não transcritos. Vendas combinadas depois por WhatsApp ou pessoalmente não aparecem como fechadas.'
from v
where exists (select 1 from orbit.clients where id = 'a131cba6-bd51-4d86-b7be-a9e7ee481e98'::uuid)
on conflict (client_id, period_start, period_end) do update set
  grade_a=excluded.grade_a, grade_b=excluded.grade_b, grade_c=excluded.grade_c,
  grade_d=excluded.grade_d, grade_e=excluded.grade_e, followups_pending=excluded.followups_pending,
  source_note=excluded.source_note;

do $$
declare t record;
begin
  select sum(grade_a) a, sum(grade_b) b, sum(grade_c) c, sum(grade_d) d, sum(grade_e) e, sum(followups_pending) fu
    into t from orbit.ig_dm_funnel_snapshot
   where client_id = 'a131cba6-bd51-4d86-b7be-a9e7ee481e98'::uuid;
  if t.a is not null and (t.a, t.b, t.c, t.d, t.e, t.fu) is distinct from (10, 19, 26, 94, 23, 45) then
    raise exception 'DM A.C. Enxovais: totais divergem da planilha (A/B/C/D/E/fu = %/%/%/%/%/%)', t.a, t.b, t.c, t.d, t.e, t.fu;
  end if;
end $$;

-- PASSO MANUAL (não automático): para a tela usar o funil de DM nesta conta,
-- client_onboarding.cta_type precisa ser 'dm_comentario' (o CHECK da coluna aceita só
-- link_direto | linktree_multilink | dm_comentario | nenhum | link_bio). Confira o valor atual antes:
--   select cta_type from orbit.client_onboarding where client_id = 'a131cba6-bd51-4d86-b7be-a9e7ee481e98';
--   update orbit.client_onboarding set cta_type = 'dm_comentario' where client_id = 'a131cba6-bd51-4d86-b7be-a9e7ee481e98';

commit;
