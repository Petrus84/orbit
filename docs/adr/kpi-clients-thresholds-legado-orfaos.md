# ADR — bloco de threshold_* em orbit.clients: órfão, com defaults recusados

## Status
Proposta (gerada pelo robô KCR — Etapa 1 — nesta sessão). Precisa de decisão humana.

## Contexto
`orbit.clients` guarda 11 colunas de threshold configuráveis por cliente
(schema dump, linhas ~1222–1232):

| coluna                            | default | situação frente ao Doc2 |
|-----------------------------------|---------|--------------------------|
| `threshold_ctr_bio_min`           | 3.0     | não existe em nenhum dos dois docs — número novo, não documentado |
| `threshold_ctr_ads_min`           | 1.0     | é o `defaults_legado_recusados.meta` — Doc2 chama de "proibido" |
| `threshold_ctr_search_min`        | 2.0     | é o `defaults_legado_recusados.google_search` — Doc2 chama de "proibido" |
| `threshold_cpa_max_multiplier`    | 1.5     | bate com o Doc2 (`CPA > 1.5 * media_CPA_14d`) — OK |
| `threshold_churn_monthly_max`     | 1.5     | sem KPI correspondente no Doc2 — não reconciliado |
| `threshold_fatigue_critical`      | 40.0    | é o corte da regra ANTIGA de fadiga (ver ADR de creative_fatigue_cause) |
| `threshold_frequency_max`         | 2.5     | bate com o número REFINADO do Doc2 — OK |
| `threshold_er_real_min`           | 0.5     | Doc2 diz "sem linha v2, indisponível" para er_real_pct — não deveria existir |
| `threshold_polemic_max`           | 20.0    | é a `regra_alerta_antiga_RECUSADA` exata do Doc2 (`ALERTA SE > 20%`) |
| `threshold_utility_min`           | 2.0     | é a `regra_antiga_RECUSADA` exata do Doc2 (`SAUDÁVEL SE >= 2%`) |
| `threshold_avatar_alignment_min`  | 70.0    | é a regra antiga de avatar (ver ADR de avatar_composite_score) |

## O que o KCR encontrou
Grep de cada uma das 11 colunas em `src/` e `scripts/`: nenhuma aparece fora de
`src/types/database.types.ts`, `database.types.temp.ts` e `database.types-legado.ts`
(arquivos de tipo gerados) — exceto `threshold_ctr_ads_min` e
`threshold_frequency_max`, que aparecem também em `src/types/orbit.ts`, mas só
como declaração de campo de interface, não como leitura em lógica.

Ou seja: **as 11 colunas são mortas** — nenhum resolver, repository, hook ou
action as lê hoje. Isso reduz a severidade prática (não estão causando
classificação errada em produção agora), mas mantém um risco real: são o tipo
exato de coisa que uma pessoa (ou um agente de IA lendo o schema para "entender
o produto") vai presumir que é a régua vigente, porque estão na tabela SSOT de
clientes com nomes de threshold explícitos e comentários de tabela dizendo
"SSOT de contexto de negócio e thresholds".

## Decisão a tomar
1. Dropar as colunas cujo valor é uma regra explicitamente recusada
   (`threshold_polemic_max`, `threshold_utility_min`, `threshold_avatar_alignment_min`,
   `threshold_fatigue_critical`, `threshold_ctr_ads_min`, `threshold_ctr_search_min`,
   `threshold_er_real_min`) — ou, no mínimo, `COMMENT ON COLUMN ... IS 'DEPRECATED —
   regra recusada, ver contracts/kpi/registry.json'` em cada uma.
2. Para `threshold_ctr_bio_min` e `threshold_churn_monthly_max`: decidir se são
   regras de gestão legítimas ainda não documentadas no Contrato v2 (e então
   adicioná-las formalmente) ou também órfãs a dropar.
3. `threshold_cpa_max_multiplier` e `threshold_frequency_max`: manter — batem
   com o vigente — mas ligar de fato algum resolver a elas (hoje também não são
   lidas em lugar nenhum).

## Evidência
- `20260925dump_orbit.sql`, `CREATE TABLE orbit.clients`, linhas ~1203–1232
- grep de cada uma das 11 colunas em `src/` e `scripts/`: só em arquivos de tipo gerados
