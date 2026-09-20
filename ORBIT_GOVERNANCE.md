# ORBIT — Governança de Arquitetura e Contratos

> **Este arquivo é a fonte da verdade sobre DECISÕES e REGRAS — não sobre tipos.**
> Tipos vivem exclusivamente em `src/types/orbit.ts`. Este documento vive no repositório,
> versionado, e é a ponte entre sessões de IA (qualquer modelo, qualquer chat) e o estado
> real do projeto. Nenhuma memória de chat substitui este arquivo.

**Como manter:** toda sessão que resolve algo estrutural (regra nova, contrato corrigido,
dívida identificada) adiciona uma entrada no ADR Log (§2) e, se aplicável, atualiza o
Ledger de Dívida (§3). Nunca apague uma entrada do ADR Log — se a decisão mudar, registre
uma nova entrada marcando a antiga como `SUPERSEDED`.

**Como usar em qualquer chat novo (qualquer modelo):** cole o "Boot Prompt" da §4 no início
da conversa antes de pedir código. Isso substitui reexplicar o projeto do zero.

---

## 1. Regras Arquiteturais (numeradas, citáveis por ID)

### REGRA-01 — Proibição de Contrato Local
**Um componente NUNCA declara seu próprio tipo de domínio, mesmo que pareça mais simples.**
Toda interface de domínio (`Alert`, `Client`, `AvatarAlignment`, etc.) vem exclusivamente de
`src/types/orbit.ts`, importada — nunca redeclarada, nunca "simplificada" localmente.

- **Violação real encontrada (2026-07-19):** `AlertCard.tsx` declarava seu próprio `Alert` e
  `AlertAction`, divergente do `Alert` real de `orbit.ts` em quase todos os campos
  (`actions: AlertAction[]` vs `action: AlertAction | null`; `triggeredAt` vs `createdAt`;
  `acknowledged` vs `isResolved`). O componente "compilava sozinho" mas quebra no primeiro
  contato com dado real.
- **Por que importa:** um contrato local passa no `tsc` isoladamente e engana quem revisa.
  Só quebra na integração — exatamente o cenário "passa no código, mas eu não tinha as
  especificações" que você descreveu.
- **Checagem antes de aceitar qualquer componente novo:** toda `interface`/`type` que
  representa um dado de domínio (não um prop puramente visual tipo `className`) precisa ter
  import rastreável até `orbit.ts`. Se não tem, é violação.

### REGRA-02 — Desacoplamento Screen vs Filhos
Screens (`src/components/screens/`) orquestram layout (grid/flex/gap) e passam dados crus.
Filhos (`common/`, `features/`) resolvem cor, glow e badges isoladamente a partir de campos
de status do contrato (`status`, `severity`, `color`). Screen nunca calcula `glowColor`.

### REGRA-03 — SSOT de Design via TOKENS
Nenhum componente novo usa cor/espaçamento Tailwind arbitrário (`bg-red-500/20`,
`text-zinc-400`, `shadow-[0_0_6px...]`). Tudo vem de `src/lib/tokens.ts` / variáveis CSS do
SSOT (`--space-*`, `--r4/8/12`, `--neon-*`, `--t0/1/2`). Espaçamento sempre múltiplo de 4px.

- **Violação real encontrada (2026-07-19):** `AlertasScreen.tsx` e `AlertCard.tsx` são 100%
  Tailwind ad-hoc — nenhum `GlassCard`, nenhum `TOKENS`. Quarta convenção de cor coexistindo
  no projeto (`critical/warning/info` + `red/amber/blue` local, fora do vocabulário
  `GlowColor` = `cyan|gold|red|none` usado no resto do SSOT).

### REGRA-04 — Contraste mínimo em texto com conteúdo real
`--t3` / `--text-dim` são reservados para elementos puramente decorativos. Qualquer texto
que carregue dado real (label, valor, insight, legenda) usa `--t1` ou `--t2` — contraste
AA (4.5:1) obrigatório.

### REGRA-05 — Barras e réguas de progresso: tolerância zero para blocos grossos
Componentes de barra horizontal (progress, alinhamento, comparação) têm altura de trilho
entre 8px–10px. Nunca blocos esticados verticalmente.

### REGRA-06 — Hook como fonte de verdade de shape assíncrono
Todo hook (`useX`) segue o padrão `{ data, status: FetchStatus, error, lastUpdated, refetch }`
(`FetchStatus = 'idle'|'loading'|'success'|'error'`). Screens nunca reimplementam cálculos que
o hook já entrega pronto (ex: `AlertCounts` já vem de `useAlerts()` — a screen não recalcula
contagem na mão).

### REGRA-07 — `any` é proibido; case-sensitivity de import é estrita
Sem exceções. Caminhos de import respeitam exatamente o casing do arquivo físico.

### REGRA-08 — Componente não roteado/importado é sinalizado, não presumido morto
Antes de qualquer refatoração, checar `grep -rn "<NomeDoComponente>"` no projeto inteiro.
Se zero resultados fora da própria declaração, o componente é **órfão** — documentar no
Ledger (§3), nunca assumir que está "quase pronto para produção".

### REGRA-09 — `ClientHealthStatus` é o vocabulário canônico único de status/cor
Todo componente que representa "saúde"/"semáforo"/"nível de atenção" (badges, glow,
indicadores) resolve sua cor a partir de `ClientHealthStatus` (`healthy|warning|critical|unknown`).
Tipos legados (`AlertSeverity`, `AlignmentStatus`, `StatusVariant`, `SemaphoreColor`, `GlowColor`,
`TrendColor`, `AlignmentColor`, `MetaAdsKPIStatus`) só sobrevivem via uma ponte nomeada e
explícita (padrão: `TREND_COLOR_MAP` já existe em `orbit.ts` — generalizar esse padrão, nunca
criar um novo enum de cor paralelo). Todo componente de status **novo** nasce em `ClientHealthStatus`;
os 8 tipos legados são substituídos progressivamente, não de uma vez.
- **Origem:** `ADR-004` (decisão de 22/07/2026, confirmada em 09/08/2026). Motivada por um bug
  real confirmado: `SemaphoreColor.verde` mapeava para `GlowColor.cyan` — o nome mentia sobre a cor.
- **Exceção declarada:** badges do Relatório (client-facing) e tabelas de Meta Ads/Criativos
  ligadas a `MetaAdsKPIStatus` (tipo hoje morto, tela sem rota) — sistema visual separado, fora
  desta regra até serem auditados.
- **Achado relacionado (11/08/2026):** o enum `alert_severity` do banco diverge do `AlertSeverity`
  de TS em 13 valores (ver ORB-DEBT-027) e reforça por que esta regra existe — `alert_severity`
  é justamente um dos "tipos legados" que deveria estar migrando para `ClientHealthStatus`, não
  crescendo em paralelo.

### REGRA-10 — Estado do Banco ≠ Estado do Código
Um reset de branch/commit local (`git`) **nunca** desfaz migrations já aplicadas no Supabase
remoto (schema, RLS policies, triggers, `security_invoker`). Antes de assumir que qualquer
correção de banco "se perdeu" num reset, verificar o estado real do projeto Supabase
(`smifhuvzroznlmbrvhaj`) — não assumir a partir do estado do repositório local. O inverso
também vale: corrigir um arquivo `.ts`/`.tsx` local não garante que o banco esteja alinhado
a ele — os dois precisam ser verificados de forma independente.
- **Origem:** confirmado em 09/08/2026 — reset local (`git`) na branch principal não afetou as
  3 migrations de RLS/multi-tenancy nem o `security_invoker = true` nas 13 views de `orbit`,
  aplicadas via Supabase MCP em sessão separada. Ver `ADR-005`.

---

## 2. ADR Log (Architecture Decision Records)

Formato: `[DATA] ID — Título` · Contexto · Decisão · Status

### 2026-07-19 — ADR-001: Migração visual do módulo Avatar para GlassCard/TOKENS
- **Contexto:** `AvatarScreen.tsx` e filhos estavam em coluna única, Tailwind ad-hoc, com
  campos fantasmas (`comparison`, `variables`, `calculations`) que não existem em
  `AvatarAlignment` (orbit.ts).
- **Decisão:** reescritos `AvatarScreen`, `AvatarComparison`, `AvatarCard`, `AlignmentBars`,
  `AlignmentFormula` usando exclusivamente campos reais do contrato, `GlassCard` + `TOKENS`,
  CSS Modules dedicados. Mapa de responsabilidades Screen-vs-Filhos aprovado pelo usuário.
- **Status:** `ACCEPTED`. Ver REGRA-01, REGRA-02, REGRA-03.

### 2026-07-19 — ADR-002: Correção de proporção e contraste (barras + tipografia)
- **Contexto:** barras de alinhamento renderizando como blocos grossos; `--t3`/`--text-dim`
  aplicado em texto com dado real, quebrando contraste AA.
- **Decisão:** trilhos fixados em 8px (REGRA-05); banimento de `--t3` em texto real, padrão
  `--t1`/`--t2` (REGRA-04). `AlignmentFormula.tsx` migrado de Tailwind puro para TOKENS.
- **Status:** `ACCEPTED`.

### 2026-07-19 — ADR-003: Auditoria de `AlertasScreen.tsx` — não integrado, contrato divergente
- **Contexto:** `AlertasScreen.tsx` e `AlertCard.tsx` auditados contra `orbit.ts`. Achados:
  (a) componente órfão — não importado em nenhuma rota, `app/alertas/page.tsx` é placeholder
  estático; (b) `Alert`/`AlertAction` locais divergem do contrato real em quase todos os
  campos (REGRA-01); (c) `useAlerts()` real (`src/hooks/useAlerts.ts`) já existe com shape
  `{ data, counts, status, error, lastUpdated, refetch }`, incompatível com o que a screen
  assume (`{ alerts, status, error, refetch }`); (d) zero aderência a TOKENS (REGRA-03).
- **Decisão:** **NÃO migrado ainda** — aguardando decisão do usuário sobre reativar ou
  descartar o módulo. Nenhum código novo gerado até essa decisão.
- **Atualização (09/08/2026):** um reset local forçado (`git`, dezenas de arquivos, centenas de
  alterações) devolveu o repositório a um estado anterior. Checklist forense independente
  (protótipo HTML `orbit-prototipo-consolidado-neon.html`, "Modo Auditoria") confirma que
  `AlertCard.tsx`/`AlertasScreen.tsx` estão **de volta ao estado quebrado original** — a
  correção que existiu em algum chat intermediário não sobreviveu ao reset (REGRA-10 não se
  aplica aqui: eram arquivos `.tsx`, não migration de banco).
- **Atualização (11/08/2026):** a tabela `alerts` está vazia em produção — nenhum alerta foi
  disparado apesar dos triggers estarem mapeados e ativos (ver ORB-DEBT-033, INC-005). Ou seja,
  mesmo se o módulo fosse religado hoje, não haveria dado real para exibir — o bloqueador de
  dados (INC-005) é anterior ao bloqueador de UI já registrado aqui.
- **Status:** `OPEN`. Ver Ledger §3, ORB-DEBT-006 e ORB-DEBT-033.

### 2026-08-09 — ADR-004: `ClientHealthStatus` como vocabulário canônico único de status
- **Contexto:** 9 tipos de status/cor coexistindo (`AlertSeverity`, `ClientHealthStatus`,
  `AlignmentStatus`, `StatusVariant`, `SemaphoreColor`, `GlowColor`, `TrendColor`,
  `AlignmentColor`, `MetaAdsKPIStatus`), resolvendo para 3 paletas visuais divergentes — com
  bug confirmado (`SemaphoreColor.verde` → `GlowColor.cyan`, nome mentindo sobre a cor) e um
  componente morto (`AlignmentBar.tsx` singular) em Tailwind cru desacoplado de token.
- **Decisão:** paleta neon (cyan/gold/red) como padrão único; `Semaphore.tsx` unificado
  (substitui `Semaphore.tsx` antigo + `SemaphoreIndicator.tsx`) usando `ClientHealthStatus`
  como vocabulário. Demais tipos migram ou mapeiam via ponte nomeada.
- **Status:** `ACCEPTED` (proposto 22/07, confirmado 09/08). Vira `REGRA-09`. A versão
  "definitiva" (deletar `SemaphoreColor`/`GLOW_MAP` do repositório) ainda não foi aplicada —
  ver ORB-DEBT-007.

### 2026-08-09 — ADR-005: Pacote de segurança RLS/multi-tenancy via `subscription_id`
- **Contexto:** `orbit.user_subscriptions` com 0 linhas, `v_client_health` sem filtro e sem
  `security_invoker`, 5 tabelas com RLS habilitada mas sem policy de escrita para `authenticated`,
  `client_onboarding` com policy `ALL` aberta para `public` (leitura E escrita irrestritas).
- **Decisão:** 3 migrations aplicadas (função `user_owns_client()`, trigger de auto-provisionamento
  em `auth.users`, backfill da subscription da agência + vínculo dos 2 clientes reais, policies
  `SELECT`-only via `user_owns_client()` em ~19 tabelas). `security_invoker = true` aplicado nas
  13 views de `orbit`. As 5 tabelas sensíveis (`ig_import_sessions`, `raw_ig_ingest`,
  `ref_thresholds`, `ref_export_file_catalog`, `avatar_validations`) mantidas "nega tudo para
  client-side, só `service_role` escreve" — confirmado seguro: zero referência de escrita
  client-side a essas tabelas no código auditado; único write client-side do app inteiro é
  `alertsRepository.ts` → `orbit.alerts` (marcar como lido/resolvido). Se algum fluxo futuro
  precisar gravar client-side (ex: `avatar_validations` via onboarding), a policy será criada de
  forma isolada e planejada, ou via Edge Function.
- **Status:** `ACCEPTED`. Aplicado direto no Supabase remoto (projeto `smifhuvzroznlmbrvhaj`) —
  sobrevive a resets locais por definição (REGRA-10). **Ressalva aberta:** o checklist forense do
  protótipo (09/08) reafirma um achado de "RLS `anon_read_*` sem escopo em 6 tabelas" como
  `Crítico, confirmado` — precisa reconciliação para confirmar se descreve o estado PRÉ-migration
  (já corrigido por esta ADR) ou um gap remanescente. Ver ORB-DEBT-008.
- **Atualização (2026-08-12):** verificação completa ao vivo (`pg_policies`, `pg_roles`, `pg_class`
  do projeto `smifhuvzroznlmbrvhaj`, consultados diretamente via Supabase MCP) — a Decisão foi
  aplicada exatamente como descrito: `user_subscriptions` com 2 linhas (era 0 no Contexto original),
  `subscriptions` com 1 linha, os 2 clientes reais com `subscription_id` preenchido,
  `orbit.user_owns_client()` existe, 1 trigger customizado em `auth.users` existe, `security_invoker
  = true` confirmado nas 13/13 views de `orbit` (inclui `v_client_health`). `client_onboarding_open_v1`
  (a policy `ALL` aberta a `public` citada no Contexto desta ADR) **não existe mais** — substituída
  por `authenticated_select_own_client_onboarding` (SELECT-only, via `user_owns_client()`).
  **A ressalva aberta acima está `RESOLVED`:** as 6 policies `anon_read_*` (`alerts`, `clients`,
  `funnel_data`, `ig_account_snapshots`, `ig_audience_snapshots`, `ig_posts`) não existem mais —
  o achado do protótipo descrevia o estado PRÉ-migration. Ver `ORB-DEBT-008`.
  **Nota de precisão:** as "5 tabelas sensíveis" do texto acima não foram tratadas de forma
  uniforme — `avatar_validations`/`ig_import_sessions`/`raw_ig_ingest` têm SELECT liberado para
  `authenticated` via `user_owns_client()`; `ref_thresholds`/`ref_export_file_catalog` têm ZERO
  policies (nega tudo mesmo para `authenticated`). O resultado final ("seguro para client-side")
  é o mesmo nas duas subdivisões, mas o mecanismo difere — o texto original trata o grupo como
  homogêneo. `service_role` tem `rolbypassrls = true` (confirmado via `pg_roles`) — as policies
  `svc_*_all` remanescentes em várias tabelas são redundantes mas inofensivas, e isso explica por
  que a ingestão funciona em `ref_thresholds`/`ref_export_file_catalog` mesmo sem nenhuma policy
  própria para `service_role`.
  **Gap novo identificado, fora do escopo original desta ADR:** nenhuma das ~20 tabelas do padrão
  `authenticated_select_own_*` recebeu policy de `INSERT`/`UPDATE` para `authenticated` — foi
  SELECT-only por decisão explícita (texto da Decisão acima). Isso hoje bloqueia a escrita
  client-side em `orbit.client_onboarding` (e em qualquer outra tabela do mesmo grupo) para um
  usuário autenticado comum — só `service_role`/`postgres` conseguem gravar. Ver `ORB-DEBT-040`.
  Recomendação: tratar como `ADR-010` separada (escopo de escrita client-side), não reabrir esta ADR.

### 2026-08-09 — ADR-006: Protótipo HTML como artefato companion de auditoria forense e design
- **Contexto:** `orbit-prototipo-consolidado-neon.html` consolida telas do produto, uma aba de
  "Referência técnica (SSOT)", grafo de dependências, tabela de rastreabilidade e um "Modo
  Auditoria" com checklist file-a-file (❌ QUEBRA / ⚠ MISMATCH / pendente) — nível de
  granularidade que este documento (`ORBIT_GOVERNANCE.md`) não carrega.
- **Decisão:** os dois artefatos coexistem com papéis distintos. `ORBIT_GOVERNANCE.md` é a fonte
  de regras (REGRA-XX), decisões (ADR) e o ledger de alto nível. O protótipo HTML é a fonte do
  estado forense granular (arquivo+linha+erro exato) e a referência visual (leather neon,
  aprovada pelo usuário). Achados do protótipo que sejam estruturais entram no Ledger (§3) com
  origem citada; regras/decisões nunca vivem só no HTML.
- **Status:** `ACCEPTED`.

### 2026-08-11 — ADR-007: Staging tables de ingestão (raw_ig_ingest, ig_import_sessions) — decisão pendente
- **Contexto:** as tabelas `orbit.raw_ig_ingest` e `orbit.ig_import_sessions` foram desenhadas
  no schema (migrations aplicadas, DDL correto, RLS configurada), mas **nenhum** dos 3 scripts
  de ingestão (`ingest-l0-v2.ts`, `extract-demographics.ts`, `ingest-insights.ts`) grava nelas.
  O pipeline real é `arquivo JSON local → parse Zod em memória → INSERT direto nas tabelas
  finais`, sem staging, sem `import_session` como FK, sem hash de deduplicação de export. O
  "repositório bruto" de fato é a pasta local (`PASTA_OPERATIONAL`/`PASTA_LEAD` do `.env.local`),
  não o Supabase.
- **Decisão:** **pendente**. Duas opções na mesa, nenhuma aplicada:
  - **Opção A — Implementar:** wrapper em cada script que popula `ig_import_sessions` +
    `raw_ig_ingest` antes de processar, com `mark_parsed()` ao final. Ganha auditoria,
    deduplicação e recuperação de falha no meio do processamento.
  - **Opção B — Remover:** deletar as 2 tabelas do schema, aceitar ausência de staging,
    simplificar governança.
- **Status:** `OPEN`. Ver Ledger §3, ORB-DEBT-020.

### 2026-08-11 — ADR-008: Estratégia de deduplicação de exports — decisão pendente
- **Contexto:** sem `export_zip_hash` nem `import_session` como FK nas tabelas finais, reprocessar
  o mesmo export ZIP duas vezes duplica posts e métricas silenciosamente. Depende diretamente
  da decisão do ADR-007 — só faz sentido com staging implementado (Opção A).
- **Decisão:** **pendente**, aguardando ADR-007.
- **Status:** `OPEN`. Ver Ledger §3, ORB-DEBT-020.

### 2026-08-11 — ADR-009: Reconciliação de enums DB↔TS e fallback de dados mascarados — decisão pendente
- **Contexto:** auditoria de 27 linhas de um CSV de conciliação (DB × `orbit.ts`) encontrou
  `alert_severity` divergente entre as duas camadas (13 valores só no TS — `âmbar`, `down`,
  `flat`, `gold`, `inactive`, `neutral`, `none`, `paused`, `red`, `vermelho`, `warn`, `estável` —
  e `success` existindo no DB mas ausente no TS) e 8 enums existentes no DB sem type TS
  correspondente (`ads_platform`, `asset_status`, `campaign_objective`, `confidence_level`,
  `content_format`, `fatigue_cause`, `gender_category`, `period_source`). Uma investigação
  forense por grep, feita na sequência, mostrou que 3 candidatos do levantamento inicial
  (`health_status`, `alert_type`, e um campo citado como `max_confidence_level`) **já existem em
  `orbit.ts`** — falsos positivos, cuja nomenclatura ainda precisa de confirmação (ver
  ORB-DEBT-029). A mesma investigação encontrou 3 repositórios com `FALLBACK_*` hardcoded que
  retornam dados fake quando o Supabase falha ou não tem linhas (`avatarRepository.ts`,
  `funnelRepository.ts`), somando-se ao fallback legado já registrado em `alertsRepository.ts`
  (ORB-DEBT-019) — ou seja, o sistema hoje não quebra em runtime, mas pode exibir números
  inventados como se fossem reais.
- **Decisão:** **pendente**. Recomendação registrada, ainda não aplicada: (1) sincronizar
  `AlertSeverity` com os 4 valores reais do DB; (2) criar os 8 types faltantes em `orbit.ts`
  (após resolver ORB-DEBT-029); (3) remover os `FALLBACK_*` e propagar erro/NULL explicitamente
  em vez de mascarar com dado inventado.
- **Atualização (12/08/2026):** uma conciliação automatizada real (script, não levantamento
  manual — DB 12 enums/24 tabelas × TS 29 types/79 interfaces) **contradiz parcialmente** o
  levantamento de 11/08 em dois pontos: (a) `alert_severity` tem só 1 divergência real
  (`success` ausente do TS), não 13; (b) `alert_type` e `health_status` voltam a aparecer como
  Fantasma, contrariando a checagem forense por grep de 11/08 que os havia dado como já
  existentes em `orbit.ts`. Nenhuma das duas fontes foi descartada — a decisão desta ADR
  permanece pendente até reconciliar as duas por leitura direta do arquivo atual. A conciliação
  automatizada também revelou escopo bem maior do que o conhecido até então: 94 "fantasmas"
  no total (enums + tabelas + colunas), incluindo divergências de contrato inteiras em `alerts`,
  `clients` e `ig_audience_snapshots` (ver ORB-DEBT-035 a ORB-DEBT-039).
- **Status:** `OPEN`. Ver Ledger §3, ORB-DEBT-027 a ORB-DEBT-030 e ORB-DEBT-035 a ORB-DEBT-039.

---

### 2026-09-20 — ADR-011: Descontinuar psicografia (Panksepp/Schwartz) como diferencial
- **Contexto:** o ORBIT vinha sendo posicionado com três pilares (Funil + Avatar + Psicografia).
  Análise externa reportada pelo Lobo em 20/09/2026 (motor `orbit_v41.py`, **não reproduzida nesta
  sessão**): léxico de 150 termos deixa ~79% dos posts sem sinal; correlação fraca com o ER real
  (r ≈ 0,12 no melhor caso; n ≤ 26). Verificado no banco: a psicografia vive só em 4 colunas de
  `orbit.client_onboarding` (`expected/real_panksepp_system`, `expected/real_schwartz`), com dado
  preenchido para 2 de 5 clientes (`cpimportstore`, `eupetruchio84`); nenhuma view ou função depende
  delas (só 2 constraints `CHECK`). No app: ~127 referências em 11 arquivos, concentradas em
  `OnboardingScreen` (seções 06 e 07), schema zod, mapper e tipos gerados.
- **Decisão:** pivotar para **Funil Real + Avatar Alignment + Alertas acionáveis**. Psicografia
  deixa de ser pilar; pode voltar se for validada com léxico maior e n > 50.
- **Fase 1 — aplicada, reversível:** (1) `SHOW_PSYCHOGRAPHY = false` em
  `src/lib/onboarding/flags.ts` oculta as seções 06/07 do onboarding e renumera Metadados para 06;
  (2) `completeness()` deixa de contar os 4 campos ocultos (senão 3 de 5 clientes ficariam presos
  abaixo de 100%); (3) scripts Python arquivados em `archive/orbit-v41-psychographic-motor/`, com
  exportação dos dados em JSON; (4) dados no banco intocados.
- **Fase 2C — código morto removido (20/09/2026, pronta para deploy):** zod schema, mapper,
  `enums.ts` (2 cópias), `helpers.ts`, `orbit.ts`, `onboardingRepository.ts` e `OnboardingScreen.tsx`
  sem qualquer referência funcional à psicografia (restam só comentários históricos, sem efeito em
  runtime). `src/lib/onboarding/flags.ts` (`SHOW_PSYCHOGRAPHY`) foi deletado. Dados no banco
  permanecem intocados — o upsert deixa de enviar as 4 colunas, mas elas continuam existindo até a
  Fase 2B. Validado: `tsc --noEmit` limpo; schema/mapper testados isoladamente aceitando linha SEM
  as 4 colunas (simulação do pós-DROP). `npm run build` não pôde ser validado neste ambiente
  (bloqueio de rede a fonts.googleapis.com, não relacionado ao código).
- **Fase 2B — `DROP COLUMN`, pendente (exige aprovação explícita do Lobo):** SQL, verificação e
  rollback em `archive/orbit-v41-psychographic-motor/FASE2B_drop_columns.sql` (a criar). **Ordem
  obrigatória: 2C → deploy em produção → confirmar app funcionando → só então 2B.** Rodar antes do
  deploy quebraria a validação do onboarding para todos os clientes (schema da Fase 1 exigia as 4
  colunas — testado).
- **Nota de numeração:** ADR-006 já pertence ao "Protótipo HTML"; ADR-010 segue reservada à
  recomendação de escopo de escrita client-side (ver ADR-005). Por isso esta é a ADR-011.
- **Status:** Fase 1 `ACCEPTED`; Fase 2C `READY` (código, aguardando deploy); Fase 2B `PENDING`
  (DROP COLUMN, aguarda deploy da 2C + aprovação do Lobo).

## 3. Ledger de Dívida Técnica (vivo — atualizar a cada sessão)

| ID | Item | Módulo | Descoberto em | Status |
|---|---|---|---|---|
| ORB-DEBT-001 | `AlignmentBar.tsx` (singular, antigo) órfão — nada mais importa | Avatar | 2026-07-19 | `OPEN` |
| ORB-DEBT-002 | `RecommendationAlert.tsx` em Tailwind puro, fora do padrão glass/glow | Avatar | 2026-07-19 | `OPEN` |
| ORB-DEBT-003 | `KPICard.module.css` (`src/components/kpi/`) com `font-size: 9px` hardcoded | KPI | 2026-07-19 | `OPEN` |
| ORB-DEBT-004 | `IGOverviewScreen.tsx` real usa `../common/KPICard` (Tailwind, tipos locais), diverge do padrão `GlassCard`/`kpi/` tomado como referência | IG Overview | 2026-07-19 | `OPEN` — decisão pendente: alinhar ou aceitar dois padrões |
| ORB-DEBT-005 | `currentClient` no `OrbitDashboardContext` nunca é populado — sempre `undefined` em runtime | Contexto global | 2026-07-19 | `OPEN` |
| ORB-DEBT-006 | `AlertasScreen.tsx`/`AlertCard.tsx`: componente órfão (não roteado), contrato `Alert` local divergente do SSOT, `useAlerts()` real incompatível, zero TOKENS | Alertas | 2026-07-19 | `OPEN` — ver ADR-003, reconfirmado 09/08. Reforçado 11/08: tabela `alerts` vazia (ORB-DEBT-033) |
| ORB-DEBT-007 | `SemaphoreColor`/`GLOW_MAP` ainda existem em `orbit.ts` — versão "definitiva" do ADR-004 (deletar, migrar repositórios pra `ClientHealthStatus` direto) não foi aplicada | Design system / orbit.ts | 2026-08-09 | `OPEN` — ver ADR-004, REGRA-09 |
| ORB-DEBT-008 | Reconciliar achado "RLS `anon_read_*` sem escopo em 6 tabelas" (protótipo, tag crítico) contra as migrations do ADR-005 — confirmar se é achado pré-fix (já resolvido) ou gap remanescente | Segurança / Supabase | 2026-08-09 | `RESOLVED` (2026-08-12) — confirmado via `pg_policies` ao vivo: as 6 policies (`alerts`, `clients`, `funnel_data`, `ig_account_snapshots`, `ig_audience_snapshots`, `ig_posts`) não existem mais no schema `orbit`. Achado do protótipo descrevia o estado pré-migration. Ver ADR-005, atualização 12/08 |
| ORB-DEBT-009 | `orbit.ts` interno: `UseClientsResult` **duplicada dentro do próprio SSOT**, linhas 159 e 912 — consolidar em uma única definição | orbit.ts (SSOT) | 2026-08-09 | `OPEN` — viola REGRA-01 dentro da própria fonte da verdade |
| ORB-DEBT-010 | `OrbitDashboardProviderProps` duplicada: `src/context/OrbitDashboardContext.tsx` (real, estende `UseInstagramOverviewParams`) vs `src/types/orbit.ts` (desatualizada) — deprecar a versão de `orbit.ts` | Contexto global | 2026-08-09 | `OPEN` — fonte real confirmada é o context; planejar limpeza em `orbit.ts` |
| ORB-DEBT-011 | `src/hooks/useClients.ts`: conteúdo real do hook nunca foi escrito — arquivo contém JSX de tela (`CarteiraScreen`) no lugar do hook. `page.tsx:9` espera `UseClientsReturn` (com `filter`), incompatível com `UseClientsResult` que `CarteiraScreen` importa | Carteira | 2026-08-09 | `OPEN` — ❌ QUEBRA, build falha (`tsc`/`npm run build`), prioridade 1 de execução sugerida |
| ORB-DEBT-012 | `CarteiraScreen.tsx:16` — crash em runtime (`Cannot read properties of undefined (reading 'filter')`) porque `useClients()` não devolve `{ clients, alerts, ... }` no estado atual | Carteira | 2026-08-09 | `OPEN` — ❌ QUEBRA, depende de ORB-DEBT-011 |
| ORB-DEBT-013 | `ClientCard.tsx`: `Client.status` local não aceita `'unknown'` — union mais estreito (`'warning'\|'critical'\|'healthy'`) que `ClientHealthStatus` real | Carteira | 2026-08-09 | `OPEN` — ⚠ MISMATCH, relacionado a REGRA-09. Escopo ampliado por ORB-DEBT-037 (contrato `clients`↔`client` diverge em 34 campos, não só `status`) |
| ORB-DEBT-014 | `MetaAdsScreen.tsx`: contrato local espera `data` aninhado; hook real devolve shape flat | Meta Ads | 2026-08-09 | `OPEN` — ❌ QUEBRA |
| ORB-DEBT-015 | `CampaignRow.tsx`: `Campaign` local sem `fatiguePercent`/`fatigueStatus`/`cpl`/`diagnosis`/`actionRequired` | Meta Ads | 2026-08-09 | `OPEN` — ⚠ MISMATCH |
| ORB-DEBT-016 | `KPICard.tsx` (`common/`): `KPI` local diverge de `orbit.MetaAdsKPI` | Meta Ads | 2026-08-09 | `OPEN` — ⚠ MISMATCH |
| ORB-DEBT-017 | `orbit.v_client_health`: médias não clampeadas causavam badge de saúde incorreto | SQL / Supabase | 2026-08-09 | `RESOLVED` — corrigido seguindo REGRA "null propagation over COALESCE masking" (candidata a REGRA-11, ver nota abaixo) |
| ORB-DEBT-018 | *(reservado — sem registro localizado; se este ID já foi usado em outra sessão, reconciliar antes de reaproveitar)* | — | — | `OPEN` — verificar |
| ORB-DEBT-019 | `clientsRepository.ts` / `instagramOverviewRepository.ts` / `alertsRepository.ts`: fallback para `supabaseLegacy` (`public.*`) aponta pra tabelas inexistentes (dropadas em 2026-08-10). Remover os 3 blocos de fallback — `orbit.*` é fonte única agora, falha deve propagar, não mascarar | Repositories | 2026-08-10 | `OPEN` — reforçado por ORB-DEBT-030 (mesmo padrão de mascaramento em outros 2 repositórios) |
| ORB-DEBT-020 | Staging tables (`raw_ig_ingest`, `ig_import_sessions`) desenhadas no schema mas nunca escritas — pipeline real grava direto nas tabelas finais, sem auditoria, sem dedup, sem checkpoint de recuperação | Ingest Pipeline | 2026-08-11 | `OPEN` — ver ADR-007/ADR-008 |
| ORB-DEBT-021 | `seed-dynamic.ts:35,65` — `.from('agencies')`/`.from('clients')` sem `.schema('orbit')`, aponta para `public.*` (deletado 2026-08-10 por LEDGER-003) — `npm run db:seed` falha com "Could not find the table 'public.agencies'" | Seed / Provisioning | 2026-08-11 | `OPEN` — ❌ QUEBRA, bloqueia seed, prioridade P0 |
| ORB-DEBT-022 | `extract-demographics.ts` — parser de `followers_1.json` não trata o caso de `parsed.data` ser array direto vs objeto com `relationships_followers`; `followers_total` (R-01) fica sempre 0 ou incorreto | Extract Demographics | 2026-08-11 | `OPEN` — ❌ QUEBRA, P0. Causa raiz provável de ORB-DEBT-034 |
| ORB-DEBT-023 | `ingest-l0-v2.ts` — schema Zod (`ScraperPostSchema`) só aceita formato scraper; `posts.json` do export nativo do Meta é rejeitado inteiro, `ig_posts` fica vazio (R-05/R-06 não preenchidos) | Ingest L0 | 2026-08-11 | `OPEN` — ❌ QUEBRA, P0 |
| ORB-DEBT-024 | `content_interactions.json` não está registrado em `instagram-export-manifest.ts` — script não sabe procurar o arquivo, falha silenciosa (R-01/R-03 podem não ser preenchidos) | Ingest Insights | 2026-08-11 | `OPEN` — 🟡 P1 |
| ORB-DEBT-025 | `profiles_reached.json` lido sem schema Zod em `ingest-insights.ts` — parse pode falhar silenciosamente; é a fonte do GAP G1 (alcance-90d ausente em R-01) e causa raiz provável de ORB-DEBT-034 | Ingest Insights | 2026-08-11 | `OPEN` — 🟡 P1 |
| ORB-DEBT-026 | Chaves de `string_map_data` com mojibake (UTF-8 corrompido, ex. "seguidores para homensÃ") reimplementadas ad-hoc e divergentes em cada script; `metric-key-dictionary.ts` (SSOT) já existe mas não está integrado em todos os scripts | Ingest Pipeline | 2026-08-11 | `OPEN` — 🟡 P1 |
| ORB-DEBT-027 | `alert_severity`: 13 valores presentes no TS sem correspondência no DB (`âmbar`, `down`, `estável`, `flat`, `gold`, `inactive`, `neutral`, `none`, `paused`, `red`, `vermelho`, `warn`, duplicata de `warning`) e `success` existe no DB mas está ausente do TS — 17-18 registros de desalinhamento no CSV de conciliação. **⚠️ Contradito em 12/08:** uma conciliação automatizada posterior (DB×TS completo, ver `ORB-DEBT-035`) encontra `critical`/`warning`/`info` **alinhados** e aponta como único divergente real o valor `success` (existe no DB, ausente no TS) — não confirma nenhum dos 12 valores extras no TS. Não sobrescrever o achado original; as duas fontes precisam ser reconciliadas contra o `orbit.ts` atual antes de agir | orbit.ts (SSOT) | 2026-08-11 | `OPEN` — ver ADR-009, REGRA-09, contradição a resolver antes de codar |
| ORB-DEBT-028 | 8 enums existem no schema do DB sem type TS correspondente em `orbit.ts`: `ads_platform`, `asset_status`, `campaign_objective`, `confidence_level`, `content_format`, `fatigue_cause`, `gender_category`, `period_source` (valores hoje hardcoded em ~10 componentes/repositories em vez de tipados). **⚠️ Revisado em 12/08:** conciliação automatizada (`ORB-DEBT-035`) dá uma lista e uma classificação diferentes — enums genuinamente "Fantasma" (sem export type nem literal inline): `ads_platform`, `alert_type`, `asset_status`, `content_format`, `fatigue_cause`, `gender_category`, `health_status`, `ingest_script`, `period_source` (9 itens, **inclui** `alert_type` e `health_status`, que a sessão forense de 11/08 havia classificado como falsos positivos "já existem em orbit.ts" — contradição direta a resolver por leitura direta do arquivo). `campaign_objective` é reclassificado como **Divergente**, não Fantasma: existe um type `campaignobjective` em TS, mas tipado como `string` genérico (perde os 8 valores literais do DB) — problema real, mas diferente de "ausente". `confidence_level` também sai da lista de Fantasma, ver ORB-DEBT-029 | orbit.ts (SSOT) | 2026-08-11 | `OPEN` — ver ADR-009, REGRA-01, contradição a resolver antes de codar |
| ORB-DEBT-029 | Possível divergência de nomenclatura entre `confidence_level` (nome usado no levantamento inicial contra o DB) e `max_confidence_level` (citado em `orbit.ts:421` por grep forense) — não confirmado se é o mesmo campo ou dois campos distintos. **Complementado em 12/08:** conciliação automatizada (`ORB-DEBT-035`) classifica `confidence_level` como Divergente, não Fantasma — não existe um `export type` nomeado para ele em TS, mas os mesmos valores aparecem inline, duplicados e não centralizados, em 5 campos diferentes: `confidenceLevel`, `confidence_level`, `interestConfidence`, `realInterestConfidence`, `values_affect_confidence`. Isso não confirma nem descarta a hipótese de `max_confidence_level` — a ferramenta que gerou essa lista não fez grep de texto livre por esse nome específico, só comparou tipos nomeados e literais inline conhecidos | orbit.ts (SSOT) | 2026-08-11 | `OPEN` — confirmar `max_confidence_level` por leitura direta de `orbit.ts:421` antes de agir sobre ORB-DEBT-028 |
| ORB-DEBT-030 | `avatarRepository.ts` (linhas ~39-80) e `funnelRepository.ts` (linhas ~35-88) têm constantes `FALLBACK_*` hardcoded (`FALLBACK_CPIMPORTSTORE`, `FALLBACK_EUPETRUCHIO`, `FALLBACK_DEFAULT`) que renderizam dados fake (ex. `alignment_status: 'critical'`, `alcance: 1639`) quando o Supabase retorna vazio ou erro — mascaram a ausência real do dado em vez de propagar falha. Soma-se ao fallback legado já registrado em `alertsRepository.ts` (ORB-DEBT-019) | Repositories | 2026-08-11 | `OPEN` — reforça a candidata a REGRA-11 (ver nota abaixo) |
| ORB-DEBT-031 | Thresholds de métricas de qualidade não variam por tamanho de conta — CP Import Store (13 followers) e Eupetruchio (3.500 followers) usam os mesmos valores em 10 das 11 métricas configuráveis (`budget_lifetime`, `budget_monthly`, `cpl`, `ctr`, `frequency`, `roas`, entre outras) | Regras de Negócio / Thresholds | 2026-08-11 | `OPEN` — INC-001, decisão recomendada: matriz de thresholds por faixa de followers (nano/micro/macro/mega) |
| ORB-DEBT-032 | `proof_mechanism` e `setor_benchmark` = `NULL` nos dois clientes reais — impossibilita as regras de credibilidade/certificação e de comparação por vertical de mercado | Onboarding / Regras de Negócio | 2026-08-11 | `OPEN` — INC-003 / INC-004, decisão recomendada: preencher no onboarding |
| ORB-DEBT-033 | Tabela `alerts` vazia em produção — nenhum alerta foi disparado apesar dos triggers `trg_check_churn_alert` e `trg_eval_boost_candidate` estarem mapeados e ativos | Alertas | 2026-08-11 | `OPEN` — INC-005, relacionado a ORB-DEBT-006 e ADR-003 |
| ORB-DEBT-034 | `avatar_composite_score` (usado por `v_avatar_alignment`, requisito R-11) e `vps_pct` (usado por `v_quality_scores`) retornam `NULL` nos dois clientes — causa provável é `reach_followers_pct` nunca ingerido, conectando-se diretamente ao parser quebrado de `followers_1.json` (ORB-DEBT-022) e à falta de validação de `profiles_reached.json` (ORB-DEBT-025) | Avatar / Quality Scores | 2026-08-11 | `OPEN` — INC-006/007/008. **Antes de tratar como bug isolado, resolver ORB-DEBT-022/025 primeiro — provável mesma causa raiz**. Ver também ORB-DEBT-038 (o campo nem existe no tipo TS da linha) |
| ORB-DEBT-035 | Conciliação automatizada real DB×TS (script, não levantamento manual): DB tem 12 enums e 24 tabelas; TS tem 29 types e 79 interfaces. Resultado: 62 alinhados, 11 divergentes, **94 fantasmas**, 32 sugestões de mapeamento não confirmadas. Escala real do problema é maior do que qualquer contagem manual anterior (25-28) — essas contagens manuais cobriam só uma fatia (principalmente `alert_severity` + enums). **Ressalva:** os 62 "alinhados" dependem de 5 pares tabela↔interface casados só por similaridade de nome (`alerts↔alert`, `avatar_validations↔avatarvalidationrow`, `client_onboarding↔clientonboarding`, `clients↔client`, `ig_audience_snapshots↔igaudiencesnapshotrow`) e **não confirmados** pela própria ferramenta — reduz a confiança no número "62" até essa confirmação | orbit.ts (SSOT) | 2026-08-12 (recebido; execução do script não datada) | `OPEN` — fonte de referência para ORB-DEBT-027/028/029/036/037/038/039 |
| ORB-DEBT-036 | Contrato `alerts` (DB) ↔ `alert`/`Alert` (TS) diverge em 19 campos: 12 colunas só no DB (`resolved_at`, `snoozed_until`, `alert_type`, `ig_post_id`, `meta_creative_id`, `meta_campaign_id`, `google_campaign_id`, `snapshot_id`, `suggested_action`, `action_url`, `is_snoozed`, `resolved_by`) e 7 campos só no TS (`clientName`, `clientHandle`, `type`, `action`, `exportable`, `confidenceLevel`, `personaType`) | orbit.ts (SSOT) / Alertas | 2026-08-12 | `OPEN` — evidência concreta para REGRA-01/ADR-003, ver ORB-DEBT-006 |
| ORB-DEBT-037 | Contrato `clients` (DB) ↔ `client`/`Client` (TS) diverge em 34 campos: **30 colunas só no DB** (inclui `created_at`, `updated_at`, `segment`, `instagram_user_id`, `ig_username`, `ig_display_name`, `business_objective`, `gross_margin_pct`, `monthly_ad_budget`, todos os 8 `avatar_expected_*`/`avatar_unconscious_desire`/`avatar_alignment_hypothesis`, os 11 `threshold_*`, `health_status`, `health_updated_at`, `subscription_id`) e 4 campos só no TS (`avatar`, `status`, `metrics`, `lastUpdated`). Amplia consideravelmente o achado estreito já registrado em `ORB-DEBT-013` (que cobria só `status`/`'unknown'`) | orbit.ts (SSOT) / Carteira | 2026-08-12 | `OPEN` — supersede parcialmente o escopo de ORB-DEBT-013, REGRA-01 |
| ORB-DEBT-038 | Contrato `ig_audience_snapshots` (DB) ↔ `igaudiencesnapshotrow`/`IgAudienceSnapshotRow` (TS) tem 9 colunas do DB ausentes do type TS: `id`, `import_session`, `created_at`, `top_countries`, `confidence_level`, `avatar_gender_alignment_score`, `avatar_age_alignment_score`, `avatar_geo_alignment_score`, `avatar_composite_score`. Achado relevante: `avatar_composite_score` não está só `NULL` no dado (ORB-DEBT-034) — **o campo nem está modelado no tipo TS da linha**, dois problemas empilhados (dado + tipo) | orbit.ts (SSOT) / Avatar | 2026-08-12 | `OPEN` — ver ORB-DEBT-034, R-11 |
| ORB-DEBT-039 | 18 tabelas do DB sem interface TS correspondente (mesmo por similaridade de nome): `ads_ga4_landing_pages`, `ads_google_campaigns`, `ads_google_search_terms`, `ads_google_snapshots`, `ads_meta_adsets`, `ads_meta_campaigns`, `ads_meta_creatives`, `ads_meta_snapshots`, `client_reports`, `funnel_data`, `ig_account_snapshots`, `ig_import_sessions`, `ig_posts`, `metric_history`, `raw_ig_ingest`, `ref_export_file_catalog`, `ref_thresholds`, `subscriptions`, `user_subscriptions`. `raw_ig_ingest`/`ig_import_sessions` já eram esperados sem uso real (ORB-DEBT-020); `ig_posts` sem interface é achado novo e relevante — pode ser causa adicional (camada de tipos, não só dado) para os sintomas já registrados em ORB-DEBT-023 | orbit.ts (SSOT) | 2026-08-12 | `OPEN` — nenhuma ação recomendada ainda, requer decisão de escopo (quais tabelas precisam de interface própria) |

| ORB-DEBT-040 | Nenhuma das ~20 tabelas cobertas pelo padrão `authenticated_select_own_*` (criado pela ADR-005) tem policy de `INSERT`/`UPDATE` para `authenticated` — foi SELECT-only por decisão explícita. Consequência concreta e imediata: `orbit.client_onboarding` não pode ser escrita por um usuário autenticado comum via app hoje, só por `service_role`/`postgres`. `onboardingRepository.ts::upsertClientOnboarding()` é chamado a partir de `OnboardingScreen.tsx` (`'use client'`, roda no browser) — se o client Supabase usado ali for o client-side padrão (anon key + sessão do usuário, não `service_role`), o botão "Salvar Onboarding" falha hoje, silenciosamente pela RLS, independente dos dados estarem corretos. **Não confirmado ainda:** qual client Supabase `@/lib/supabase` realmente exporta — não estava nos arquivos desta sessão | Segurança / Supabase / Onboarding | 2026-08-12 | `OPEN` — 🔴 P0, bloqueia diretamente o fluxo de onboarding em andamento nesta sessão. Ver ADR-005 (atualização 12/08), recomendação de abrir ADR-010 |
| ORB-DEBT-041 | Tabela nova `orbit.content_insights` (RLS habilitada, zero policies) encontrada ao vivo — não existe no dump original de referência nem em nenhum ADR/Ledger anterior. Com RLS ligada e zero policies, está em deny-all para `authenticated`/`anon` (só `service_role` acessa, via `rolbypassrls`). Pode ser intencional (tabela ainda não exposta a client-side) ou esquecimento — não decidido aqui | Supabase Schema | 2026-08-12 | `OPEN` — decisão de escopo pendente: precisa de policy própria ou é legitimamente service_role-only? |

**Ordem de execução sugerida pelo checklist forense (09/08), para os itens ❌/⚠ de Carteira/Alertas/Meta Ads:**
`useClients.ts` (real) → `ClientCard.tsx` (import de `orbit.ts`) → `AlertCard.tsx` (import do
barrel `types/alert.ts`) → `AlertasScreen.tsx` (destruturação `{ data, counts, status, error, refetch }`)
→ `MetaAdsScreen.tsx` (remover wrapper `data`) → `CampaignRow.tsx` + `KPICard.tsx` (importar de
`orbit.ts`) → `orbit.ts` (remover `UseClientsResult` duplicada).

**Atualização de prioridade (11/08/2026):** os itens de infraestrutura de ingestão/seed
(ORB-DEBT-020 a ORB-DEBT-026) são pré-requisito para validar qualquer correção de tela com
dado real — sem eles, `npm run db:seed` falha e boa parte das métricas calculadas (`avatar_composite_score`,
`vps_pct`) permanece `NULL` independentemente do que for corrigido em componentes. Recomendação:
tratar ORB-DEBT-021 (seed) → ORB-DEBT-022/023 (parsers) → ORB-DEBT-025 (validação Zod) como
bloqueadores de qualquer sprint de UI, antes da ordem de execução acima.

**Nota — candidata a REGRA-11 (não confirmada ainda):** "nunca mascarar ausência de dado com
`COALESCE`/zero ou com constante `FALLBACK_*` — propagar `NULL`/erro explicitamente" apareceu
como regra de governança já em uso na correção do ORB-DEBT-017, e agora tem evidência adicional
em 3 repositórios distintos (`alertsRepository.ts` — ORB-DEBT-019 — e `avatarRepository.ts`/
`funnelRepository.ts` — ORB-DEBT-030). O padrão está se repetindo o suficiente para justificar
formalização. Ainda não está numerada em §1 deste documento — **perguntar ao usuário se deve
virar REGRA-11 agora**, dado o número crescente de ocorrências.

**Regra de fechamento:** um item só sai do ledger como `RESOLVED` quando o código correspondente
existe no repo E uma entrada de ADR referencia a resolução. "Resolvido em chat" não conta.

---

## 4. Boot Prompt — colar no início de qualquer chat novo (qualquer modelo)

```
Estou trabalhando no projeto ORBIT (Next.js/TypeScript/Supabase). Antes de gerar qualquer
código, leia o arquivo ORBIT_GOVERNANCE.md que vou colar/anexar abaixo — ele contém as
regras arquiteturais numeradas (REGRA-XX), o histórico de decisões (ADR Log) e a dívida
técnica conhecida (Ledger). Se eu também anexar orbit-prototipo-consolidado-neon.html, trate
a aba "Modo Auditoria" dele como o estado forense granular mais recente (arquivo+linha+erro) —
ele complementa, não substitui, o Ledger deste documento (ver ADR-006). Não repita decisões já
tomadas no ADR Log sem eu pedir para revisitar. Não proponha solução para itens do Ledger sem
eu confirmar qual você está atacando. Se o código que eu colar violar uma REGRA-XX, aponte o
número da regra antes de propor a correção. Lembre-se de REGRA-10: estado do banco Supabase e
estado do código local são independentes — não presuma um a partir do outro.

[colar conteúdo de ORBIT_GOVERNANCE.md aqui]
```

---

## 5. Convenção de manutenção

- Uma sessão que **decide** algo estrutural → nova entrada no ADR Log, ID sequencial (`ADR-00N`).
- Uma sessão que **descobre** dívida sem resolver → nova linha no Ledger, ID sequencial (`ORB-DEBT-00N`).
- Uma sessão que **resolve** um item do Ledger → status muda para `RESOLVED` + referência ao ADR.
- Regras (§1) só crescem ou são refinadas — nunca removidas silenciosamente. Se uma regra for
  revogada, marcar `[REVOGADA em ADR-00N]` ao lado do ID, mantendo o texto original visível.

---

## 6. Registro de dívida operacional (Ledgers detalhados)

Os achados forenses detalhados (arquivo+linha+trecho de código, tabelas de reconciliação
DB↔TS completas, matrizes de decisão IMP-001 a IMP-007) vivem em documento separado —
`LEDGER_REGISTROS.md` — para não inflar este arquivo. Todo item que chega a esse nível de
detalhe recebe também uma linha resumida aqui em §3 (Ledger de alto nível), com o ID
`ORB-DEBT-0NN` correspondente, para que este documento continue sendo suficiente sozinho
para orientar uma sessão nova.
