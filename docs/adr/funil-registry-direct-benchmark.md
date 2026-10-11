# ADR-012 — Funil real: tipo de funil, direct (DM) e benchmark de conversão

**Data:** 2026-10-11 · **Status:** `PROPOSED` (migrations ainda não aplicadas no projeto `smifhuvzroznlmbrvhaj`)

## Contexto

O funil mostrava "90 dias" fixo, tratava taxa de conversão 0 (sem venda informada) como medição e
usava 1,5% de engajamento sem dizer que era valor padrão. Contas que vendem por DM (A.C. Enxovais)
não tinham onde mostrar as conversas, e a venda acontece fora do Instagram.

## Decisão

- `orbit.funnel_stage_registry` + `src/lib/funnel/registry.ts`: etapas por tipo (`link` | `dm`), com
  origem (`instagram_export` | `dm_scan` | `external_reported`) e confiança (L0/L1/L2). O teste
  `funnelMath.test.ts` compara TS e seed SQL.
- Tipo de funil vem de `client_onboarding.cta_type`: **`dm_comentario` → `dm`**, qualquer outro → `link`.
- `orbit.funnel_conversion_benchmark`: referência por segmento (`SetorBenchmarkOperacional`) com evento
  medido, grau da fonte, `is_proxy` e ressalva. Todos L2 até calibrar com a base.
- `orbit.ig_dm_funnel_snapshot`: agregado mensal da varredura de DMs, **sem texto de mensagem**.
  Leitura por `orbit.can_read_client(client_id)` (staff ou dono), no padrão `sel_<tabela>` +
  `svc_<tabela>_all` vigente no banco em 11/10/2026. As tabelas de referência usam
  `orbit.has_workspace_access()`, como `ref_thresholds`. `authenticated` não escreve em nenhuma.
- Sem venda informada, o simulador parte do benchmark do segmento (rotulado) ou de "sem referência".
- Tipos de domínio em `orbit.ts` (REGRA-01); sem `any` (REGRA-07).

## Pendências

- Aplicar as 3 migrations via MCP e conferir `pg_policies` e `security_invoker` (REGRA-10).
- Regenerar `database.types.ts` e trocar `orbitViews()` por `supabase.schema('orbit')`.
- Segmento `membership_assinatura_comunidade` (1 cliente, onboarding preenchido) não tem linha de
  benchmark: a tela mostra "sem referência". Os 7 benchmarks cobrem os 5 segmentos operacionais + 2 legados.
- `cta_type = 'dm_comentario'` da A.C. Enxovais é passo manual (comentado na migration 120200).

## Verificação no banco vivo (11/10/2026, somente leitura — nada foi aplicado)

- Nenhum objeto novo existe ainda (`funnel_*`, `ig_dm_funnel_snapshot`, `v_funnel_context`, `v_ig_dm_funnel`).
- `client_onboarding_cta_type_check` aceita `link_direto | linktree_multilink | dm_comentario | nenhum | link_bio`.
- `orbit.can_read_client(uuid)`, `has_workspace_access()` e `user_owns_client(uuid)` existem.
- Privilégios padrão do schema dão SELECT só a `service_role`: por isso o DDL concede `select` a `authenticated`.
- `funnel_data.vendas_channel` e `vendas_reported_at` ainda não existem (o DDL as cria).
- `funnel_data.period_start/period_end` são `timestamptz` gravados à meia-noite UTC; o filtro atual
  funciona porque os limites também são meia-noite UTC. Não é o bug do RWP-6, mas depende dessa convenção.
- `a.c_enxovais` (`a131cba6`) existe, com `cta_type = link_bio` e `setor_benchmark` preenchido;
  snapshot do Instagram de 08/07 a 05/10/2026 (90 dias).
- Dívida ORB-DEBT-032 (`setor_benchmark` NULL): resolvida para os 6 clientes com onboarding.
