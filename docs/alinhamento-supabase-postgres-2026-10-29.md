# Alinhamento técnico — Postgres e Supabase (Orbit)

**Data:** 29/10/2026  
**Escopo:** schema `orbit` e `public`, contratos TypeScript, leituras de funil,
benchmarks e tratamento de dados ausentes.

## Resumo executivo

O repositório já usa `supabase.schema("orbit")` nas consultas centrais do funil
e mantém fallback para `null` quando as views opcionais não estão disponíveis.
Também já aplica os filtros `category = 'global'` e `tier_normalized = 'all'`
em `fetchCommentReference`.

Foram encontrados dois desvios antes deste alinhamento:

1. `v_funnel_context` e `v_ig_dm_funnel`, definidos na migration
   `20261029093600_funnel_registry_ddl.sql`, não constavam em
   `src/types/database.types.ts`. As declarações das duas views foram
   sincronizadas com as colunas do DDL para habilitar consultas tipadas. Essa
   sincronização local **não comprova** que o arquivo inteiro foi gerado pelo
   CLI contra o banco remoto.
2. O mapper de `v_avatar_alignment` convertia percentuais e score nulos em
   `0`. Agora os nulos permanecem nulos até o contrato e a interface, que
   mostram `Indisponível`/`—` sem calcular um falso alinhamento.

## Geração dos tipos e views de funil

Comando de referência, a executar depois de aplicar as migrations no banco
alvo:

```powershell
supabase gen types typescript --schema orbit,public > src/types/database.types.ts
```

O comando deve ser executado em um ambiente autenticado contra o projeto
correto. Após a geração, conferir especialmente:

- `orbit.v_funnel_context`, com as colunas definidas na migration
  `20261029093600_funnel_registry_ddl.sql`;
- `orbit.v_ig_dm_funnel`, incluindo as métricas agregadas e os períodos;
- ausência de diferenças locais não relacionadas antes de substituir o
  arquivo atual, que já contém alterações preexistentes.

Até a execução e comparação desse comando, o estado é: **tipos das duas views
sincronizados localmente com o DDL; geração completa via CLI e correspondência
com o banco remoto pendentes de validação**.

O repositório não contém evidência verificável de execução do CLI contra o
banco remoto. A ata registra a validação em Postgres 16 como realizada pela
equipe; isso não foi reproduzido nesta alteração. A configuração local foi
alinhada para declarar Postgres 16; a versão real da instância ainda deve ser
confirmada antes de comparar resultados.

## Contratos de aplicação

### Views e fallback do funil

- `fetchFunnelContext` consulta `orbit.v_funnel_context` pelo cliente.
- `fetchDmFunnel` consulta `orbit.v_ig_dm_funnel` pelo cliente e período.
- As consultas usam `supabase.schema("orbit")` com tipos de
  `Database["orbit"]["Views"]`; foi removido o adaptador `orbitViews()` com
  casts genéricos.
- Erros de leitura são registrados e retornam `null`. A tela pode manter o
  fluxo padrão de funil por link sem interromper a navegação.

### Referência de comentários

`fetchCommentReference` mantém os filtros obrigatórios:

```text
category = 'global'
tier_normalized = 'all'
```

O resultado vazio continua sem criar benchmarks artificiais. Recomenda-se
monitorar a existência de linhas da régua no ambiente após cada atualização
de dados.

### Alinhamento de audiência

As colunas percentuais e `alignment_score` aceitam `number | null` no contrato.
Ausência de dado não equivale a zero. Barras sem dados suficientes não recebem
status saudável/crítico; a interface apresenta `—` ou `Indisponível`.

## Matriz de métricas e guardas

Esta tabela registra o contrato informado na ata. A presença de uma regra
nesta ata não substitui a validação da expressão no SQL/RPC e no motor TS
correspondente.

| Métrica                      | Fórmula/fonte                                                                   | Guarda ou tratamento                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `er_real_pct`                | `(saves + shares + comments) / reach * 100`                                     | Exigir `sample_count > 0`; não confundir com engajamento público simples.    |
| `vps_pct`                    | `((reach_total * reach_followers_pct / 100) / followers_total) * 100`           | Semáforo provisório quando `sample_count = 0`; não usar RPC de mercado.      |
| `algo_risk_score`            | mediana/IQR dos 12 posts recentes dividida pela mediana/IQR de até 30 seguintes | Com menos de 6 posts recentes ou baseline vazia, retornar `NULL`, nunca `0`. |
| `engagement_public`          | `likes + comments` em `ig_posts`                                                | Insumo interno do `algo_risk_score`; não é percentual nem card isolado.      |
| `benchmark_category`         | Mapeamento nos 5 eixos SSOT v1.3                                                | Se `is_benchmark = false` e houver categoria, resetar a categoria.           |
| `followers_net_balance`      | `COALESCE(followers_new, 0) - COALESCE(followers_lost, 0)`                      | Usar `COALESCE` para evitar propagação de nulos.                             |
| `ctr_bio_organic`            | `link_clicks / profile_visits * 100`                                            | Retornar `NULL` quando `profile_visits <= 0`.                                |
| `avatar_gender / age / city` | Desvio entre audiência real e esperada                                          | Preservar `NULL`; não converter ausência em `0%`.                            |
| `cadencia_posts`             | `n_posts / (span_dias / 7)` posts/semana                                        | Exigir ao menos 3 posts na janela.                                           |

## Migrações e segurança

As migrations do registro de funil estão em:

- `20261029093600_funnel_registry_ddl.sql`
- `20261029093700_funnel_registry_seed.sql`
- `20261029093800_ig_dm_funnel_ac_enxovais.sql`

Os timestamps foram movidos para depois da última versão aplicada no Alpha
informada nesta auditoria (`20261019231153`), evitando exigir `--include-all`
por causa desses arquivos. O DDL concede `INSERT`, `UPDATE` e `DELETE` a
`service_role` explicitamente: `BYPASSRLS` não substitui privilégios SQL.
O seed já fornece as 12 etapas de funil e os 7 benchmarks de segmento; deve
ser aplicado após o DDL e antes da carga de snapshots de DM.

Não foi feita aplicação de DDL em staging ou produção nesta alteração. Antes
do rollout, a equipe responsável deve aplicar as migrations na ordem,
verificar as policies RLS e `security_invoker` das views, e validar o acesso
por tenant em cada ambiente. Não declarar rollout homogêneo até registrar a
versão aplicada e o resultado dessas verificações.

## Encaminhamentos

1. Aplicar e validar as migrations em staging; repetir a validação antes de
   produção.
2. Gerar novamente `database.types.ts` via CLI contra cada ambiente de
   referência, comparar o diff e preservar alterações locais não relacionadas.
3. Executar testes de regressão para views disponíveis/indisponíveis, filtros
   de benchmark e percentuais nulos do avatar.
4. Compartilhar esta ata e o arquivo de tipos validado com a equipe Supabase,
   identificando explicitamente o ambiente e a data da geração.
