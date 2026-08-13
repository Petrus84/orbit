# 📋 LEDGERS DE REGISTRO — Detalhamento Forense

> Este documento é o **detalhamento operacional** dos itens do Ledger de alto nível em
> `ORBIT_GOVERNANCE.md` §3. Cada `LEDGER-0NN` aqui tem uma linha-resumo correspondente em
> `ORB-DEBT-0NN` no documento de governança — os IDs numéricos **não são os mesmos**
> propositalmente (um Ledger pode gerar mais de um ORB-DEBT, ou vice-versa); a coluna
> "Relacionado" faz a ponte. Se um achado aqui vira regra ou decisão estrutural, ele sobe
> para `ORBIT_GOVERNANCE.md` (ADR ou REGRA) — este arquivo nunca é a fonte de regras, só de
> evidência.

---

## Índice de sessões

- **2026-08-11, ~02:09 AM** — Auditoria do pipeline de ingestão (seed, parsers, manifest).
  Gerou LEDGER-001 a LEDGER-010, promovidos a `ORB-DEBT-020` a `ORB-DEBT-026` em governança.
- **2026-08-11, ~03:25 AM** — Reconciliação de enums DB↔TS (CSV de 27 linhas) + matriz de
  decisão de bloqueadores de negócio (INC-001 a INC-008). Gerou LEDGER-011 a LEDGER-013,
  promovidos a `ORB-DEBT-027` a `ORB-DEBT-034` em governança.

---

## Sessão 02:09 AM — Pipeline de Ingestão

### LEDGER-001: Staging Tables (raw_ig_ingest, ig_import_sessions) = Código Morto
**Severidade:** 🔴 CRÍTICO · **Módulo:** Ingest Pipeline / Supabase Schema
**Promovido para:** `ORB-DEBT-020`, decisão em `ADR-007`/`ADR-008`

**Achado:**
- Tabelas `orbit.raw_ig_ingest` (1 linha por JSON) e `orbit.ig_import_sessions` (1 linha por ZIP)
  foram desenhadas no schema (migrations aplicadas, DDL correto, RLS configurada).
- **Nenhum dos 3 scripts de ingestão grava nessas tabelas.**
- Pipeline real: `fs.readFileSync(arquivo.json)` → parse Zod em memória → `INSERT` direto em
  tabelas finais (`ig_posts`, `ig_audience_snapshots`, `metric_history`, etc.).
- Repositório "bruto" do JSON = pasta local (`PASTA_OPERATIONAL`/`PASTA_LEAD` do `.env.local`),
  não Supabase.
- `raw_payload` em `raw_ig_ingest` permanece NULL (0 linhas inseridas desde rev. 4).

**Implicações:**
1. Auditoria de ingestão: impossível rastrear "qual JSON foi processado quando" — não há
   `import_session` nem `ingested_at`.
2. Deduplicação: sem `export_zip_hash`, risco de reprocessar o mesmo export 2x, duplicando
   posts/métricas.
3. Recuperação: se um script falha no meio, não há "checkpoint" — precisa rodar tudo de novo
   ou fazer rollback manual.
4. Conformidade: dados brutos nunca persistem no banco — impossível auditoria forense ou
   re-parse com lógica nova sem o arquivo local.

**Status:** `OPEN` — decisão pendente registrada em `ADR-007` (implementar vs remover staging).

---

### LEDGER-002: seed-dynamic.ts Quebrado — Aponta para public.* (Deletado)
**Severidade:** 🔴 CRÍTICO · **Módulo:** Seed / Provisioning
**Promovido para:** `ORB-DEBT-021`

**Achado:**
```
$ npm run db:seed
🚨 CRÍTICO: Falha na esteira de provisionamento do SaaS:
   Falha crítica ao registrar agência: Could not find the table 'public.agencies'
   in the schema cache
```

**Raiz:** `seed-dynamic.ts` chama `.from('agencies')` / `.from('clients')` sem `.schema('orbit')`
— o client Supabase JS assume `public` por padrão. Após deletar `public.agencies` (ver
LEDGER-003), a chamada falha.

**Linhas afetadas:** `seed-dynamic.ts:35` (`agencies`), `seed-dynamic.ts:65` (`clients`).

**Patch necessário:** adicionar `.schema('orbit')` antes de `.from(...)` nas duas chamadas.

**Status:** `OPEN` — P0, bloqueia `npm run db:seed`.

---

### LEDGER-003: public.* Deletado Corretamente — Confirmado Seguro
**Severidade:** ✅ RESOLVIDO · **Módulo:** Supabase Schema

**Achado:**
- 11 tabelas órfãs em `public.*` deletadas com sucesso: `agencies` (mock), `clients` (UUIDs
  stale), `instagram_posts` (dados corrompidos, mojibake), `kpi_snapshots` (fallback legado),
  `avatar_alignment`, `client_metrics`, `format_performance`, `funnel_data`,
  `ig_audience_snapshots`, `meta_campaigns`, `quality_scores` (todas vazias).
- 1 tabela **mantida**: `leads_prospects` (subsistema comercial ativo, fora do escopo Orbit).

**Verificações executadas:** extensões (`btree_gist`, `pg_trgm`) preservadas mantendo o schema
`public` vazio em vez de `DROP SCHEMA CASCADE`; nenhuma função/view de `orbit` dependia de
`public.*`; `leads_prospects` confirmado como subsistema separado.

**Status:** `RESOLVED` — aplicado com sucesso em 2026-08-11 02:00 AM. Relacionado a `ADR-005`.
**Nota:** esta limpeza é a causa direta de `LEDGER-002` (seed quebrado) — a correção de um
lado expôs a dívida do outro.

---

### LEDGER-004: Dados Corrompidos em public.instagram_posts — Mojibake + UUIDs Stale
**Severidade:** 🟡 INFORMATIVO (já deletado) · **Módulo:** Dados Legados

Resíduo de versão anterior do pipeline (`seed-dynamic.ts` antigo): UUIDs não canônicos,
`instagram_post_id` fabricado, contadores zerados, captions com mojibake idêntico ao
encontrado em `extract-demographics.ts` (ver LEDGER-010). Não é dado real perdido.

**Status:** `RESOLVED` — deletado junto com LEDGER-003.

---

### LEDGER-005: Pipeline Real = Sem Staging — JSON Local → Memória → Tabelas Finais
**Severidade:** 🟡 ARQUITETURA · **Módulo:** Ingest Pipeline
**Promovido para:** `ORB-DEBT-020` (mesmo item de LEDGER-001, evidência complementar)

Confirma, arquivo por arquivo (`ingest-l0-v2.ts`, `extract-demographics.ts`,
`ingest-insights.ts`), que nenhum script toca `raw_ig_ingest`. Repositório "bruto" é a pasta
local, não Supabase. Decisão A (implementar) vs B (remover) registrada em `ADR-007`.

**Status:** `OPEN` — ver `ADR-007`.

---

### LEDGER-006: followers_1.json — Array vs Objeto, Parser Quebrado
**Severidade:** 🔴 CRÍTICO · **Módulo:** Extract Demographics
**Promovido para:** `ORB-DEBT-022` — **provável causa raiz de `ORB-DEBT-034` (avatar/VPS NULL)**

**Achado:** `extract-demographics.ts` assume `parsed.data.relationships_followers[0]` como
fallback quando `parsed.data` não é array — mas o arquivo real (`followers_1.json`) é um
**array direto**, e o fallback nunca é atingido corretamente. Resultado: `followers_total = 0`
sempre (ou valor errado), e **R-01 (followers_total) não preenchido**.

**Patch necessário:** validar explicitamente `Array.isArray(raw)` (formato atual) vs
`typeof raw === 'object' && 'relationships_followers' in raw` (formato legado) antes de
reduzir a lista.

**Status:** `OPEN` — P0.

---

### LEDGER-007: posts.json — Schema Mismatch (Meta Nativo vs Scraper)
**Severidade:** 🔴 CRÍTICO · **Módulo:** Ingest L0
**Promovido para:** `ORB-DEBT-023`

**Achado:** `ingest-l0-v2.ts` valida `posts.json` contra `ScraperPostSchema` (formato
`likesCount`, `commentsCount`, `videoViewCount`), mas o export nativo do Meta usa outra
estrutura (`timestamp`, `media[]`, `label_values[]`). Posts do export Meta são **rejeitados
inteiros** — `ig_posts` fica vazio (0 linhas). Consequência: R-05 (format_performance) e
R-06 (post_recency) não preenchidos.

**Patch necessário:** criar `ExportPostSchema` paralelo e tentar os dois schemas em cascata
(`safeParse`) antes de descartar o registro.

**Status:** `OPEN` — P0.

---

### LEDGER-008: content_interactions.json — Não no Manifest, Sem Validação
**Severidade:** 🟡 MÉDIO · **Módulo:** Ingest Insights
**Promovido para:** `ORB-DEBT-024`

`content_interactions.json` é processado por `ingest-insights.ts` mas não está registrado em
`instagram-export-manifest.ts` — o script não sabe que deve procurar o arquivo; se ausente,
falha silenciosamente. Possível impacto em R-01 (engagement_rate) e R-03 (content_quality).

**Patch necessário:** adicionar as chaves `content_interactions.json` e `profiles_reached.json`
à seção `ingest-insights` do `MANIFEST_SPECS`.

**Status:** `OPEN` — P1.

---

### LEDGER-009: profiles_reached.json — Sem Validação, Resolve GAP G1
**Severidade:** 🟡 MÉDIO · **Módulo:** Ingest Insights
**Promovido para:** `ORB-DEBT-025` — **provável causa raiz de `ORB-DEBT-034` (VPS NULL)**

`profiles_reached.json` contém `organic_insights_reach` (alcance real de 90 dias), mas
`ingest-insights.ts` lê o arquivo sem schema Zod — parse pode falhar silenciosamente. Este é
o gap que explica a ausência de `reach_followers_pct`, que por sua vez é a métrica que
`vps_pct` (VPS) precisa para ser calculada (ver LEDGER-013 / INC-008 abaixo).

**Patch necessário:** criar `ReachFileSchema` e usar `resolveIntMetric` sobre
`string_map_data` com fallback logado (`logMissingKey`).

**Status:** `OPEN` — P1.

---

### LEDGER-010: Mojibake em Chaves de string_map_data — SSOT Centralizado
**Severidade:** 🟡 MÉDIO · **Módulo:** Ingest Pipeline
**Promovido para:** `ORB-DEBT-026`

Chaves de `string_map_data` chegam com UTF-8 corrompido (ex. "Porcentagem do total de
seguidores para homensÃ", "Contas alcanÃ§adas"). Cada script reimplementa sua própria lista
de variantes hardcoded e divergente; se um export novo trouxer variante desconhecida, o
script retorna `0` silenciosamente. `metric-key-dictionary.ts` (SSOT) já existe mas não está
integrado em todos os scripts.

**Status:** `OPEN` — P1.

---

## Sessão 03:25 AM — Reconciliação de Enums DB↔TS

### LEDGER-011: Reconciliação de 27 linhas do CSV — alert_severity + 8 enums fantasma reais
**Severidade:** 🔴 CRÍTICO · **Módulo:** orbit.ts (SSOT) / Design System
**Promovido para:** `ORB-DEBT-027`, `ORB-DEBT-028`, `ORB-DEBT-029` — decisão em `ADR-009`

**Achado (primeira passada, CSV bruto):**
- `alert_severity`: DB tem `critical, info, success, warning`; TS (`AlertSeverity`) tem 15
  valores, incluindo 12 que não existem no DB (`âmbar`, `down`, `estável`, `flat`, `gold`,
  `inactive`, `neutral`, `none`, `paused`, `red`, `vermelho`, `warn`) e não inclui `success`.
  Total: 17-18 registros de desalinhamento bidirecional, dependendo de como duplicatas de
  `warning` são contadas nas duas passadas do CSV (inconsistência interna do próprio
  levantamento — não reconciliada, ver nota abaixo).
- 11 enums do DB listados originalmente como "FANTASMA" (sem type TS): `ads_platform`,
  `alert_type`, `asset_status`, `campaign_objective`, `confidence_level`, `content_format`,
  `fatigue_cause`, `gender_category`, `health_status`, `ingest_script`, `period_source`.

**Achado (segunda passada, forense via grep):**
- 3 dos 11 candidatos **já existem em `orbit.ts`**: `health_status` (linha 418),
  `max_confidence_level` (linha 421 — nome diferente de `confidence_level`, ver nota),
  `alert_type` (linhas 448, 470). São falsos positivos do levantamento inicial.
- Restam **8 enums genuinamente ausentes de `orbit.ts`**: `ads_platform`, `asset_status`,
  `campaign_objective`, `confidence_level`, `content_format`, `fatigue_cause`,
  `gender_category`, `period_source` — todos com valores hardcoded em 8+ componentes/
  repositories (`AlertCard.tsx`, `CampaignRow.tsx`, `ClientCard.tsx`, `FatigueIndicator.tsx`,
  `AlertasScreen.tsx`, `avatarRepository.ts`, `MetaAdsScreen.tsx`, entre outros) e/ou em
  mapeamentos como `Semaphore.tsx` (`HEALTH_ICON`/`HEALTH_LABEL`/`HEALTH_COLOR`).
- `ingest_script` não foi reclassificado explicitamente nas duas categorias acima — permanece
  como pendência de verificação, não confirmar como resolvido sem checar de novo.

**⚠️ Nota de qualidade do dado:** os números finais reportados nas duas passadas se
contradizem entre si (a primeira fala em 28 registros = 11 fantasma + 17 desalinhados; a
segunda recalcula para 25 = 3 falsos positivos + 8 hardcoded + 0 sem fallback + 17
desalinhados, mas o próprio texto da segunda passada também menciona "10 ausentes" em vez de
11 em outro trecho). **Não tratar "25" nem "28" como número final até nova contagem direta
contra `orbit.ts` e o schema do banco** — os dois relatórios servem como mapa de onde
procurar, não como contagem auditada.

**Descoberta lateral (fallback mascarando ausência):** 3 repositories usam `FALLBACK_*` para
mascarar ausência de dado — ver LEDGER-012.

**Status:** `OPEN` — decisão de correção pendente em `ADR-009`. Antes de implementar,
resolver `ORB-DEBT-029` (nomenclatura `confidence_level` vs `max_confidence_level`) e refazer
a contagem final.

---

### LEDGER-012: Fallback Hardcoded Mascarando Ausência de Dado (3 repositórios)
**Severidade:** 🔴 CRÍTICO · **Módulo:** Repositories
**Promovido para:** `ORB-DEBT-030` (reforça `ORB-DEBT-019`)

**Achado:**
1. **`avatarRepository.ts` (linhas ~39-80):** `FALLBACK_CPIMPORTSTORE` e
   `FALLBACK_EUPETRUCHIO` com `alignment_status` hardcoded (`'critical'`, `'warning'`).
   Disparado quando Supabase retorna vazio ou erro — tela renderiza dado fake sem indicar
   isso ao usuário.
2. **`funnelRepository.ts` (linhas ~35-88):** `FALLBACK_CPIMPORTSTORE` (`alcance: 1639,
   visitas: 75, cliques: 4`) e `FALLBACK_DEFAULT` (zeros). Disparado quando não há dado no
   banco — tela mostra números inventados como se fossem reais.
3. **`alertsRepository.ts` (linhas ~6-11):** comentário explícito "com fallback para
   `public.alerts` (legacy)" — já registrado separadamente em `ORB-DEBT-019`, cujas tabelas
   legadas foram deletadas em `LEDGER-003`, então esse fallback específico hoje **quebra** em
   vez de mascarar (aponta para tabela que não existe mais).

**Implicação central:** o sistema não quebra em runtime na maioria dos casos, mas exibe dado
incorreto como se fosse real — o oposto do padrão adotado na correção de `ORB-DEBT-017`
(propagar `NULL` em vez de mascarar). Ver nota sobre candidata a REGRA-11 em
`ORBIT_GOVERNANCE.md` §3.

**Status:** `OPEN` — nenhuma correção aplicada ainda.

---

### LEDGER-013: Matriz de Bloqueadores de Negócio (INC-001 a INC-008)
**Severidade:** 🔴 CRÍTICA (7 de 8 itens) · **Módulo:** Regras de Negócio / Dados
**Promovido para:** `ORB-DEBT-031`, `ORB-DEBT-032`, `ORB-DEBT-033`, `ORB-DEBT-034`

Consolidação de uma matriz de decisão com 6 bloqueadores executivos e 7 implicações
críticas (IMP-001 a IMP-007), cruzando o CSV de 27 linhas com achados que o CSV **não**
capturava (INC-006/INC-007/INC-008 — 33% dos bloqueadores, "fantasmas" fora do escopo do
CSV original).

| ID | Título | Realidade encontrada | Opção recomendada (não aplicada) | Esforço | Relacionado |
|---|---|---|---|---|---|
| INC-001 | Thresholds não variam por tamanho | CP Import (13 followers) e Eupetruchio (3.500) têm os mesmos thresholds em 10/11 métricas | Matriz de thresholds por faixa (nano/micro/macro/mega) | 3-4 dias | `ORB-DEBT-031` |
| INC-002 | Thresholds variam parcialmente por categoria | Só 2 métricas diferem hoje (`polemic_max`, `utility_min`) | — (impacto médio, não bloqueador) | — | — |
| INC-003 | `proof_mechanism` vazio | `NULL` em ambos os clientes | Preencher no onboarding | 1 dia | `ORB-DEBT-032` |
| INC-004 | `setor_benchmark` vazio | `NULL` em ambos os clientes | Preencher no onboarding | 1 dia | `ORB-DEBT-032` |
| INC-005 | Alertas não disparando | Tabela `alerts` vazia apesar dos triggers ativos | Investigar por que triggers não persistem linha | — | `ORB-DEBT-033`, `ADR-003` |
| INC-006 | Churn não validado com dados reais | CP Import: `period_days = 0` (risco de divisão por zero) | Normalizar cálculo para 30 dias | — | — |
| INC-007 | Avatar alignment nulo | `avatar_composite_score` NULL em ambos | Validar ingestão (`extract-demographics.ts`) | 1-2 dias | `ORB-DEBT-034`, `ORB-DEBT-022` |
| INC-008 | VPS retorna NULL | `reach_followers_pct` nunca ingerido | Adicionar aos scripts de ETL | 1 dia | `ORB-DEBT-034`, `ORB-DEBT-025` |

**Conexão causal identificada nesta consolidação (não estava explícita nos documentos
originais):** INC-006/007/008 foram descobertos numa sessão posterior (03:25) à auditoria do
pipeline de ingestão (02:09, ver LEDGER-006 e LEDGER-009). É altamente provável que sejam o
**mesmo problema visto de dois ângulos**: o parser quebrado de `followers_1.json`
(`ORB-DEBT-022`) e a falta de validação de `profiles_reached.json` (`ORB-DEBT-025`) explicam
por que `reach_followers_pct` nunca chega ao banco — o que por sua vez explica `vps_pct` e
`avatar_composite_score` sempre `NULL`. **Recomendação: não abrir uma frente de correção
separada para INC-007/008 — resolver primeiro ORB-DEBT-022/025 e reavaliar se o problema
persiste.**

**Recomendação de release (não decidida pelo usuário ainda):**
- *Não liberar para produção* até resolver os 7 bloqueadores críticos (todos exceto INC-002/006).
- *Liberar para staging* após INC-003, INC-004, INC-005, INC-007, INC-008 resolvidos.
- *Liberar para produção* após INC-001 e testes com dados reais dos dois clientes.

**Status:** `OPEN` — nenhuma decisão de IMP-001 a IMP-007 foi confirmada pelo usuário; todas
permanecem como recomendação registrada.

---

## Resumo de Patches Críticos Pendentes (P0/P1, todas as sessões)

| # | Arquivo | Problema | Ledger | ORB-DEBT | Prioridade |
|---|---------|----------|--------|----------|-----------|
| 1 | seed-dynamic.ts | `.from('agencies'/'clients')` sem `.schema('orbit')` | LEDGER-002 | ORB-DEBT-021 | 🔴 P0 |
| 2 | extract-demographics.ts | `followers_1.json` array vs objeto | LEDGER-006 | ORB-DEBT-022 | 🔴 P0 |
| 3 | ingest-l0-v2.ts | `posts.json` Meta nativo vs scraper | LEDGER-007 | ORB-DEBT-023 | 🔴 P0 |
| 4 | instagram-export-manifest.ts | `content_interactions.json` não registrado | LEDGER-008 | ORB-DEBT-024 | 🟡 P1 |
| 5 | ingest-insights.ts | `profiles_reached.json` sem validação | LEDGER-009 | ORB-DEBT-025 | 🟡 P1 |
| 6 | extract-demographics.ts / ingest-insights.ts | Mojibake em chaves | LEDGER-010 | ORB-DEBT-026 | 🟡 P1 |
| 7 | orbit.ts | `AlertSeverity` divergente do DB | LEDGER-011 | ORB-DEBT-027 | 🔴 crítico, ver ADR-009 |
| 8 | orbit.ts | 8 enums sem type TS | LEDGER-011 | ORB-DEBT-028 | 🟡 alto, ver ADR-009 |
| 9 | avatarRepository.ts / funnelRepository.ts | `FALLBACK_*` mascarando dado ausente | LEDGER-012 | ORB-DEBT-030 | 🔴 crítico |

---

## Candidatas a ADR (todas ainda pendentes)

- **ADR-007** *(já promovido a governança, status `OPEN`)*: staging tables — implementar ou remover?
- **ADR-008** *(já promovido, status `OPEN`)*: estratégia de deduplicação de exports.
- **ADR-009** *(já promovido, status `OPEN`)*: reconciliação de enums DB↔TS e remoção de fallback mascarado.

## Candidatas a ORB-DEBT (histórico — todas já incorporadas em `ORBIT_GOVERNANCE.md` §3)

`ORB-DEBT-020` a `ORB-DEBT-034` — ver tabela acima para o mapeamento Ledger → ORB-DEBT.
