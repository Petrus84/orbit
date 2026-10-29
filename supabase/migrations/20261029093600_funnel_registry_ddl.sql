-- ============================================================================
-- Funnel registry — estrutura
-- Efeito na tela: tipo de funil por cliente (link | dm), etapas com origem e
-- confiança, referência de conversão por segmento (com fonte e ressalva),
-- varredura de DMs e quem/onde informou a venda.
-- Idempotente. Escrita só por service_role; leitura por authenticated.
-- Pré-requisitos (conferidos no banco em 11/10/2026): orbit.can_read_client(uuid) e
-- orbit.has_workspace_access(). O padrão vigente das tabelas é sel_<tabela> (SELECT, authenticated)
-- + svc_<tabela>_all (service_role); o authenticated_select_own_* da ADR-005 já não é o usado.
-- ============================================================================
begin;

-- 1. Venda: acontece fora do Instagram e é informada. funnel_data.vendas_updated_by
--    já diz QUEM informou; aqui entram ONDE a venda ocorreu e QUANDO foi informada.
alter table orbit.funnel_data
  add column if not exists vendas_channel text,
  add column if not exists vendas_reported_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'funnel_data_vendas_channel_chk') then
    alter table orbit.funnel_data add constraint funnel_data_vendas_channel_chk
      check (vendas_channel is null or vendas_channel in
        ('site_externo','whatsapp','dm_instagram','marketplace','presencial','outro'));
  end if;
end $$;

comment on column orbit.funnel_data.vendas_channel is
  'Onde a venda aconteceu (fora do Instagram ou na DM). Informado por vendas_updated_by.';

-- 2. Etapas do funil por tipo
create table if not exists orbit.funnel_stage_registry (
  funnel_type        text     not null check (funnel_type in ('link','dm')),
  stage_key          text     not null,
  stage_order        smallint not null,
  label              text     not null,
  source             text     not null check (source in ('instagram_export','dm_scan','external_reported')),
  default_confidence text     not null check (default_confidence in ('L0','L1','L2')),
  parent_key         text,
  absence_what       text,
  absence_why        text,
  primary key (funnel_type, stage_key),
  unique (funnel_type, stage_order),
  foreign key (funnel_type, parent_key) references orbit.funnel_stage_registry (funnel_type, stage_key)
);

-- 3. Referência de conversão por segmento (estudo setorial 10/10/2026).
--    O número também vive em ref_thresholds.conversion_rate_pct; esta tabela
--    guarda o que o banco não tinha: evento medido, fonte, grau e ressalva.
create table if not exists orbit.funnel_conversion_benchmark (
  segment          text primary key,
  value_pct        numeric(6,3) check (value_pct is null or (value_pct >= 0 and value_pct <= 100)),
  event_measured   text not null,
  source_grade     text not null check (source_grade in ('A','B','C','n/a')),
  confidence_level text not null default 'L2' check (confidence_level in ('L0','L1','L2')),
  is_proxy         boolean not null default true,
  source_name      text,
  source_url       text,
  source_year      text,
  caveat           text,
  updated_at       timestamptz not null default now(),
  check ((value_pct is null) = (source_grade = 'n/a'))
);

-- 4. Varredura de DMs (agregado mensal; nunca o texto das mensagens)
create table if not exists orbit.ig_dm_funnel_snapshot (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references orbit.clients (id),
  period_start     date not null,
  period_end       date not null,
  grade_a          integer not null default 0 check (grade_a >= 0), -- venda fechada (evidência forte)
  grade_b          integer not null default 0 check (grade_b >= 0), -- fechamento provável
  grade_c          integer not null default 0 check (grade_c >= 0), -- pedido/intenção sem pagamento
  grade_d          integer not null default 0 check (grade_d >= 0), -- só consulta de preço
  grade_e          integer not null default 0 check (grade_e >= 0), -- conversa sobre produto
  followups_pending integer not null default 0 check (followups_pending >= 0), -- conversas B e C (lista de follow-up)
  confidence_level text not null default 'L1' check (confidence_level in ('L0','L1','L2')),
  source_note      text,
  created_at       timestamptz not null default now(),
  check (period_end >= period_start),
  check (followups_pending <= grade_b + grade_c), -- follow-up só existe para B e C
  unique (client_id, period_start, period_end)
);

-- 5. Views que a tela lê
create or replace view orbit.v_ig_dm_funnel with (security_invoker = true) as
select client_id,
       period_start,
       period_end,
       grade_a + grade_b + grade_c + grade_d + grade_e as conversas_comerciais,
       grade_a + grade_b + grade_c + grade_d           as pediu_preco,
       grade_a + grade_b + grade_c                     as intencao_compra,
       grade_a + grade_b                               as fechamento_provavel,
       grade_a                                         as venda_evidencia_forte,
       followups_pending,
       confidence_level,
       source_note
from orbit.ig_dm_funnel_snapshot;

-- Tipo de funil: client_onboarding.cta_type = 'dm_comentario' escolhe o funil de DM; qualquer outro
-- valor (ou ausência de onboarding) = link. O CHECK client_onboarding_cta_type_check só aceita
-- link_direto | linktree_multilink | dm_comentario | nenhum | link_bio.

create or replace view orbit.v_funnel_context with (security_invoker = true) as
select c.id as client_id,
       case when o.cta_type = 'dm_comentario' then 'dm' else 'link' end as funnel_type,
       coalesce(o.setor_benchmark, c.benchmark_category)    as segment,
       b.value_pct        as conversion_benchmark_pct,
       b.event_measured   as benchmark_event_measured,
       b.source_grade     as benchmark_source_grade,
       b.confidence_level as benchmark_confidence,
       b.is_proxy         as benchmark_is_proxy,
       b.source_name      as benchmark_source_name,
       b.source_url       as benchmark_source_url,
       b.source_year      as benchmark_source_year,
       b.caveat           as benchmark_caveat
from orbit.clients c
left join orbit.client_onboarding o on o.client_id = c.id
left join orbit.funnel_conversion_benchmark b
       on b.segment = coalesce(o.setor_benchmark, c.benchmark_category);

-- 6. Acesso
alter table orbit.funnel_stage_registry       enable row level security;
alter table orbit.funnel_conversion_benchmark enable row level security;
alter table orbit.ig_dm_funnel_snapshot       enable row level security;

do $$ begin
  -- Referência (sem client_id): mesmo critério de ref_thresholds (sel_ref_thresholds).
  if not exists (select 1 from pg_policies where schemaname='orbit' and tablename='funnel_stage_registry' and policyname='sel_funnel_stage_registry') then
    create policy sel_funnel_stage_registry on orbit.funnel_stage_registry
      for select to authenticated using (orbit.has_workspace_access());
  end if;
  if not exists (select 1 from pg_policies where schemaname='orbit' and tablename='funnel_conversion_benchmark' and policyname='sel_funnel_conversion_benchmark') then
    create policy sel_funnel_conversion_benchmark on orbit.funnel_conversion_benchmark
      for select to authenticated using (orbit.has_workspace_access());
  end if;
  -- DM é dado de cliente: leitura por can_read_client (staff ou dono), como ig_account_snapshots.
  -- Sem ins/upd/del para authenticated: a varredura entra por service_role (bypassrls).
  if not exists (select 1 from pg_policies where schemaname='orbit' and tablename='ig_dm_funnel_snapshot' and policyname='sel_ig_dm_funnel_snapshot') then
    create policy sel_ig_dm_funnel_snapshot on orbit.ig_dm_funnel_snapshot
      for select to authenticated using (orbit.can_read_client(client_id));
  end if;
  -- Espelha o padrão svc_<tabela>_all das demais (redundante com bypassrls, mas uniforme).
  if not exists (select 1 from pg_policies where schemaname='orbit' and tablename='funnel_stage_registry' and policyname='svc_funnel_stage_registry_all') then
    create policy svc_funnel_stage_registry_all on orbit.funnel_stage_registry for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='orbit' and tablename='funnel_conversion_benchmark' and policyname='svc_funnel_conversion_benchmark_all') then
    create policy svc_funnel_conversion_benchmark_all on orbit.funnel_conversion_benchmark for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='orbit' and tablename='ig_dm_funnel_snapshot' and policyname='svc_ig_dm_funnel_snapshot_all') then
    create policy svc_ig_dm_funnel_snapshot_all on orbit.ig_dm_funnel_snapshot for all to service_role using (true) with check (true);
  end if;
end $$;

grant insert, update, delete
  on orbit.funnel_stage_registry, orbit.funnel_conversion_benchmark,
     orbit.ig_dm_funnel_snapshot
  to service_role;

grant select on orbit.funnel_stage_registry, orbit.funnel_conversion_benchmark,
                orbit.ig_dm_funnel_snapshot, orbit.v_ig_dm_funnel, orbit.v_funnel_context
  to authenticated;

commit;
