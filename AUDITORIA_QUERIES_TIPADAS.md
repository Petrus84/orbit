# ORBIT — Auditoria de Queries Tipadas

**Data da auditoria:** 2026-09-09  
**Escopo:** código compilado em `src/`, com registro separado das cópias em `.maintenance/`  
**Objetivo:** rastrear a cadeia `Supabase → repositories → hooks → context → pages → components` e registrar todas as operações de dados encontradas no código atual.

## 1. Escopo e método

A auditoria foi feita diretamente no código-fonte atual. Foram procuradas as operações:

- `.from(...)`
- `.rpc(...)`
- `.select(...)`
- `.insert(...)`
- `.update(...)`
- `.upsert(...)`
- `.delete(...)`
- `.schema(...)`

**Resultado do escopo ativo:** 27 operações de dados em `src/lib/repositories/`:

- 26 operações baseadas em `.from(...)`
- 1 chamada RPC
- 22 leituras
- 4 escritas/mutações
- 1 rota administrativa adicional usando `supabaseAdmin`

> Observação: `Array.from(...)` encontrado em `instagramOverviewRepository.ts` não é uma query Supabase.

## 2. Clientes Supabase

| Cliente | Arquivo | Schema padrão | Uso | Risco |
|---|---|---|---|---|
| `supabase` | `src/lib/supabase.ts` | `orbit` | Código da aplicação | Baixo; queries ativas também usam `.schema('orbit')` explicitamente |
| `supabaseLegacy` | `src/lib/supabase.ts` | `public` | Cliente legado separado | Deve ser usado somente onde a origem `public` for intencional |
| `supabaseAdmin` | `src/lib/repositories/supabaseAdmin.ts` | padrão do cliente | Server-only, service role | Alto impacto de segurança; nunca importar em Client Component |

## 3. Inventário completo de queries ativas

### 3.1 `alertsRepository.ts`

| Linha | Operação | Recurso | Campos/ação | Função consumidora | Hook/tela |
|---:|---|---|---|---|---|
| 132 | `SELECT` | `orbit.alerts` | `ALERT_SELECT_FIELDS` | `fetchAlerts` | `useAlerts` → `AlertasScreen` |
| 174 | `SELECT` | `orbit.alerts` | `ALERT_SELECT_FIELDS` | `fetchCriticalAlerts` | `useAlerts` → `CarteiraScreen`/`AlertasScreen` |
| 197 | `UPDATE` | `orbit.alerts` | marca alerta como lido/resolvido | `markAlertAsRead` | `AlertCard` |
| 267 | `INSERT` | `orbit.alerts` | cria um alerta individual | `createAlert` | Server Action/orquestrador de alertas |
| 328 | `INSERT` | `orbit.alerts` | lote de alertas | `createAlertsBatch` | `syncClientAlerts` |

**Contrato:** `Alert`/`AlertDraft` em `src/types/orbit.ts` e `src/types/alert.ts`.  
**Schema:** todas as operações usam `.schema('orbit')`.  
**Nota:** `createAlert` ainda recebe `clientName` e `clientHandle`, mas a implementação atual não os usa; isso gera warning de ESLint, não altera a query.

### 3.2 `avatarRepository.ts`

| Linha | Operação | Recurso | Campos/ação | Função consumidora | Hook/tela |
|---:|---|---|---|---|---|
| 290 | `SELECT` | `orbit.v_avatar_alignment` | alinhamento de avatar por cliente | `fetchAvatarAlignment` | `useAvatar` → `AvatarScreen` |

**Contrato:** `AvatarAlignment` em `src/types/orbit.ts`.  
**Schema:** `.schema('orbit')`.  
**Risco encontrado:** a cadeia contém `.schema('orbit')` duplicado antes do `.from()` e deve ser normalizada para uma única chamada.

### 3.3 `clientsRepository.ts`

| Linha | Operação | Recurso | Campos/ação | Função consumidora | Hook/tela |
|---:|---|---|---|---|---|
| 88 | `SELECT` | `orbit.v_client_health` | `client_id, health_status` | `fetchHealthMap` | `useClients` → `CarteiraScreen` |
| 112 | `SELECT` | `orbit.v_carteira_clients` | identidade e snapshots da carteira | `fetchClientsWithHealth` | `useClients` → `CarteiraScreen` |
| 117 | `SELECT` | `orbit.v_client_metrics` | saldo, engagement, CTR e churn | `fetchClientsWithHealth` | `useClients` → `CarteiraScreen` |
| 156 | `SELECT` | `orbit.v_carteira_clients` | identidade de um cliente | `fetchClientById` | `syncClientAlerts` |
| 163 | `SELECT` | `orbit.v_client_metrics` | métricas de um cliente | `fetchClientById` | `syncClientAlerts` |

**Schema:** `.schema('orbit')` em todas as queries.  
**Tipagem:** `v_carteira_clients` não está representada no contrato gerado atual; o código usa `as never` para preservar a query. Isso é uma dívida de geração de tipos e deve ser substituído quando a view entrar em `database.types.ts`.

### 3.4 `contentContractEngine.ts`

| Linha | Operação | Recurso | Parâmetros | Função consumidora | Tela/fluxo |
|---:|---|---|---|---|---|
| 357 | `RPC` | `orbit.fn_classify_metric` | métrica, valor, categoria e tier | `classifyMetric` | `fetchSectorPositioning`/`fetchCriticalAlerts` → Overview/Audiência |

**Schema:** RPC usa o cliente `supabase` configurado para `orbit`.  
**Contrato:** retorno validado pelo fluxo de classificação e convertido em `MetricClassification`.

### 3.5 `funnelRepository.ts`

| Linha | Operação | Recurso | Campos/ação | Função consumidora | Hook/tela |
|---:|---|---|---|---|---|
| 117 | `SELECT` | `orbit.ig_account_snapshots` | `reach_total, profile_visits, link_clicks` | `fetchFunnelData` | `useFunnel` → `FunnelScreen` |
| 127 | `SELECT` | `orbit.funnel_data` | vendas e fallback de métricas do funil | `fetchFunnelData` | `useFunnel` → `FunnelScreen` |

**Período:** sobreposição (`period_start <= end` e `period_end >= start`).  
**Fonte unificada:** alcance, visitas e cliques vêm de `ig_account_snapshots`, alinhados à aba Audiência; vendas continuam dependentes de `funnel_data`, pois não existe coluna de vendas em `ig_account_snapshots`.  
**Tratamento:** nulos são normalizados; divisão por zero retorna taxa `0`; ausência total retorna métricas zeradas reais, sem fallback mockado.

### 3.6 `instagramOverviewRepository.ts`

| Linha | Operação | Recurso | Campos/ação | Função consumidora | Hook/tela |
|---:|---|---|---|---|---|
| 297 | `SELECT` | `orbit.clients` | `handle` | `fetchInstagramOverview` | `useInstagramOverview` → Context → `/instagram` |
| 341 | `SELECT` | `orbit.v_kpi_snapshots` | KPIs principais | `fetchKPIs` | Overview → `KPICard` |
| 376 | `SELECT` | `orbit.v_quality_scores` | scores de qualidade | `fetchQualityScores` | Overview → `QualityScoresPanel` |
| 408 | `SELECT` | `orbit.ig_posts` | posts por formato e detalhes | `fetchPostsByFormat` | Overview/Por post → `FormatPerformanceTable` |
| 459 | `SELECT` | `orbit.v_format_performance` | agregados por formato | `fetchFormatPerformance` | Overview/Por post → `FormatPerformanceTable` |
| 494 | `SELECT` | `orbit.ig_account_snapshots` | compartilhamentos agregados | `fetchSharesSummary` | Overview → insights |
| 539 | `SELECT` | `orbit.ig_audience_snapshots` | gênero e cidades | `fetchAudienceSummary` | Audiência → `AudienceSummaryPanel` |
| 550 | `SELECT` | `orbit.ig_account_snapshots` | alcance por seguidor, visitas e cliques | `fetchAudienceSummary` | Audiência → `AudienceSummaryPanel` |
| 598 | `SELECT` | `orbit.client_onboarding` | onboarding completo | `fetchClientOnboarding` | Audiência/Avatar/Alertas |
| 709 | `SELECT` | `orbit.client_onboarding` | `total_followers` | `fetchTotalFollowers` | Alertas/score de engajamento |
| 727 | `SELECT` | `orbit.ig_account_snapshots` | score e alcance total | `fetchLatestEngagementScoreSnapshot` | Alertas/posicionamento |

**Período:** Overview, Audiência, scores e alertas recebem `periodStart`/`periodEnd`; snapshots usam sobreposição. Posts usam publicação dentro da janela.  
**Schema:** todas as queries usam `.schema('orbit')`.  
**Tratamento:** números passam por `toFiniteNumber`; campos nulos de audiência não viram `NaN`.

### 3.7 `onboardingRepository.ts`

| Linha | Operação | Recurso | Campos/ação | Função consumidora | Hook/tela |
|---:|---|---|---|---|---|
| 85 | `SELECT` | `orbit.client_onboarding` | onboarding do cliente | `fetchClientOnboarding` | `useOnboarding` → `OnboardingScreen` |
| 122 | `UPSERT` | `orbit.client_onboarding` | salva onboarding | `upsertClientOnboarding` | `useOnboarding` → `OnboardingScreen` |

**Schema:** `.schema('orbit')`.  
**Risco encontrado:** há `.schema('orbit')` duplicado antes das duas cadeias e isso deve ser limpo.

## 4. Rota administrativa

| Arquivo | Linha | Cliente | Operação | Recurso | Segurança |
|---|---:|---|---|---|---|
| `src/app/api/admin/clients/route.ts` | 21 | `supabaseAdmin` | `SELECT` | `orbit.clients` | Protegida por `requireAdmin`; service role somente server-side |

## 5. Cadeia de dados por módulo

### Carteira

```text
orbit.v_client_health
orbit.v_carteira_clients
orbit.v_client_metrics
        ↓
fetchClientsWithHealth()
        ↓
useClients()
        ↓
Carteira page → CarteiraScreen → ClientCard
```

Alertas críticos entram em paralelo:

```text
orbit.alerts
        ↓
fetchCriticalAlerts()
        ↓
useAlerts('critical')
        ↓
CarteiraScreen → AlertCard
```

### Central de Alertas

```text
orbit.alerts
        ↓
fetchAlerts() / fetchCriticalAlerts()
        ↓
useAlerts()
        ↓
Alertas page → AlertasScreen → AlertCard
```

### Overview e Audiência

```text
orbit.clients
orbit.v_kpi_snapshots
orbit.v_quality_scores
orbit.ig_posts
orbit.v_format_performance
orbit.ig_account_snapshots
orbit.ig_audience_snapshots
orbit.client_onboarding
orbit.fn_classify_metric()
        ↓
fetchInstagramOverview()
        ↓
useInstagramOverview()
        ↓
OrbitDashboardContext
        ↓
/instagram page
        ↓
KPICard | QualityScoresPanel | FormatPerformanceTable |
AudienceSummaryPanel | SectorPositioningPanel | CriticalAlert
```

### Funil

```text
orbit.ig_account_snapshots + orbit.funnel_data
        ↓
fetchFunnelData()
        ↓
useFunnel()
        ↓
/funil/page.tsx
        ↓
FunnelScreen → FunnelChart + FunnelSimulator
```

### Avatar

```text
orbit.v_avatar_alignment
        ↓
fetchAvatarAlignment()
        ↓
useAvatar()
        ↓
/avatar/page.tsx
        ↓
AvatarScreen
```

### Onboarding

```text
orbit.client_onboarding
        ↓
fetchClientOnboarding() / upsertClientOnboarding()
        ↓
useOnboarding()
        ↓
/onboarding/page.tsx
        ↓
OnboardingScreen
```

## 6. Hooks e contratos de estado

| Hook | Repository principal | Estado exposto |
|---|---|---|
| `useAlerts` | `alertsRepository` | `data, counts, status, error, lastUpdated, refetch` |
| `useAvatar` | `avatarRepository` | `data, status, error, errorCode, lastUpdated, refetch` |
| `useClients` | `clientsRepository` | `data, status, error, refetch` |
| `useFunnel` | `funnelRepository` | `data, status, error, lastUpdated, refetch, params, setParams` |
| `useInstagramOverview` | `instagramOverviewRepository` | `data, status, error, lastUpdated, refetch` |
| `useOnboarding` | `onboardingRepository` | `data, status, error, refetch, save` |

## 7. Cópias arquivadas e escopo não compilado

Existem cópias em `.maintenance/refatoracao-periodo/src/lib/repositories/`. Elas não estão no `include` do `tsconfig.json` raiz e não fazem parte do bundle ativo. Algumas ainda apontam para fontes legadas (`kpi_snapshots`, fallbacks `public` ou queries sem o mesmo contrato atual).

Regra operacional: alterações em `.maintenance` não devem ser tratadas como correção do fluxo de produção. Se uma cópia for reativada, deve passar por nova auditoria e ser comparada com este inventário.

## 8. Achados e riscos

| Severidade | Achado | Evidência | Ação recomendada |
|---|---|---|---|
| Alta | `v_carteira_clients` não aparece no tipo gerado | casts `as never` em `clientsRepository.ts` | Regenerar `database.types.ts` incluindo a view |
| Média | `.schema('orbit')` duplicado em Avatar e Onboarding | cadeias atuais têm duas chamadas consecutivas | Remover duplicações, sem alterar o recurso consultado |
| Média | `createAlert` recebe parâmetros não usados | warning de ESLint em `alertsRepository.ts` | Remover parâmetros ou persistir apenas se o contrato exigir |
| Média | Erros de algumas queries do Overview degradam para arrays vazios | `Promise.allSettled` e retornos `[]` | Expor erro por submódulo na UI, se o produto exigir observabilidade explícita |
| Média | `v_format_performance` e `v_kpi_snapshots` dependem de views SQL | consultas tipadas por override/RawRow | Confirmar views e regenerar tipos periodicamente |
| Baixa | `supabaseLegacy` permanece disponível | cliente público separado em `supabase.ts` | Manter somente para fluxo explicitamente legado |

## 9. Checklist de manutenção

- [ ] Toda query nova declara o schema esperado ou usa um cliente com schema documentado.
- [ ] Toda query nova possui contrato em `src/types/database.types.ts` ou tipo de borda validado.
- [ ] Datas usam o período recebido pelo hook; não usar limites globais hardcoded.
- [ ] `null` é distinguido de zero antes de cálculo ou exibição.
- [ ] Repositórios não retornam dados mockados em caso de erro ou ausência.
- [ ] Hooks expõem `data`, `status`, `error` e `refetch` de forma consistente.
- [ ] Pages apenas orquestram provider/hook e não fazem query diretamente.
- [ ] Componentes de apresentação não redeclaram contratos de domínio.
- [ ] Cliente service-role não é importado em código client-side.
- [ ] Após cada alteração: `npx tsc --noEmit`, ESLint focado e, para CSS/Next, `npm run build`.

## 10. Comandos de reauditoria

```bash
# Queries Supabase em repositórios ativos
grep -RInE "\.from\(|\.rpc\(|\.schema\(" src/lib/repositories

# Hooks ligados a repositórios
grep -RInE "from '@/lib/repositories|fetch[A-Z]" src/hooks

# Páginas que usam hooks/contexto
grep -RInE "use[A-Z]|OrbitDashboardProvider|useOrbitDashboard" src/app

# Verificação técnica
npx tsc --noEmit
npx eslint src/lib/repositories src/hooks src/context src/app
npm run build
```

**Conclusão:** o fluxo ativo segue a arquitetura `Supabase → repository → hook → context/page → component`, com schema `orbit` explicitado nas queries atuais. As principais pendências são geração completa dos tipos das views, remoção de chamadas `.schema('orbit')` duplicadas e tratamento mais granular de erros degradados no Overview.
