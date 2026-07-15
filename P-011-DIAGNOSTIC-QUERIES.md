# P-011 Diagnóstico — Queries Executáveis para Cause Root Analysis

**Problema:** 24 posts com timestamp válido no JSON; 0 no banco para `cpimportstore` e `eupetruchio84`

**Objetivo:** Determinar QUAL das 5 hipóteses (H1–H5) explica o desaparecimento dos posts

---

## Queries de Diagnóstico — Execute em Ordem

Todas no **Supabase SQL Editor** com schema `orbit`.

### Passo 1: Validar Client IDs no Banco (H4)

```sql
-- H4: Os client_ids estão no banco com os handles corretos?
SELECT 
  id, 
  handle, 
  name
FROM orbit.clients 
WHERE handle IN ('cpimportstore', 'eupetruchio84')
ORDER BY handle;
```

**Resultado esperado:**
```
id                                      | handle         | name
2141d077-0d82-4fda-83df-558377f105ff   | cpimportstore  | ...
c4722cfc-cff2-4a03-a457-f14ee8c9e0e7   | eupetruchio84  | ...
```

**Se DIFERENTE:**
- ⚠️ **H4 CONFIRMADA** — Os client_ids no JSON não correspondem aos reais no banco
- Próximo passo: Comparar handle no JSON com os handles reais no banco

**Se IGUAL:**
- ✓ Client IDs estão corretos
- Prosseguir para Passo 2

---

### Passo 2: Verificar Registros Brutos de Ingestão (H1)

```sql
-- H1: Há registros brutos de ingestão para esses clients?
SELECT 
  COUNT(*) as raw_records,
  COUNT(DISTINCT client_id) as unique_clients,
  MIN(ingested_at) as primeira_ingestao,
  MAX(ingested_at) as ultima_ingestao
FROM orbit.raw_ig_ingest
WHERE client_id IN (
  '2141d077-0d82-4fda-83df-558377f105ff', 
  'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7'
);
```

**Resultado esperado (se OK):**
- `raw_records` > 0 (deve ter pelo menos 24)
- `unique_clients` = 2

**Se `raw_records = 0`:**
- ⚠️ **H1 CONFIRMADA** — Ingestão nunca rodou para esses clients
- Investigar: Por que `ingest-l0-v2.ts` não foi executado?

**Se `raw_records > 0`:**
- ✓ Dados brutos entraram
- Prosseguir para Passo 3

---

### Passo 3: Verificar Status de Processamento (H1/H3)

```sql
-- H1/H3: Foram processados de raw para ig_posts?
SELECT 
  client_id,
  COUNT(*) as raw_count,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processados,
  COUNT(*) FILTER (WHERE error_code IS NOT NULL) as com_erro,
  MAX(error_code) as ultimo_erro_code,
  MAX(error_message) as ultimo_erro_msg
FROM orbit.raw_ig_ingest
WHERE client_id IN (
  '2141d077-0d82-4fda-83df-558377f105ff', 
  'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7'
)
GROUP BY client_id
ORDER BY client_id;
```

**Resultado esperado (se OK):**
- Todos os `raw_count` = `processados` (nenhum erro)

**Se `com_erro > 0`:**
- ⚠️ **H3 CONFIRMADA** — Script falhou silenciosamente
- Revisar `error_code` e `error_message`; re-executar ingestão com debug

**Se `processados = 0` e `raw_count > 0`:**
- ⚠️ **H1 RECONFIRMADA** — Registros brutos nunca foram processados
- Investigar se função `process_raw_ingestion()` foi chamada

---

### Passo 4: Verificar Dados em orbit.ig_posts (H2)

```sql
-- H2/H5: Estão em ig_posts? Quando foram inseridos/deletados?
SELECT 
  client_id,
  COUNT(*) as total_posts,
  MIN(posted_at) as data_post_mais_antiga,
  MAX(posted_at) as data_post_mais_recente,
  MIN(created_at) as criado_em,
  MAX(updated_at) as atualizado_em
FROM orbit.ig_posts
WHERE client_id IN (
  '2141d077-0d82-4fda-83df-558377f105ff', 
  'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7'
)
GROUP BY client_id
ORDER BY client_id;
```

**Resultado esperado (se OK):**
- Cada `client_id` tem `total_posts > 0` (próximo de 6 e 18)

**Se `total_posts = 0` para ambos:**
- Posts nunca foram criados em ig_posts
- Voltamos para H1/H3 (falha de ingestão)

**Se `total_posts > 0` e `updated_at` é recente:**
- ✓ Dados estão lá
- Voltar para Passo 0 — revisar client_ids das queries anteriores

**Se `total_posts > 0` e `updated_at` é muito antigo, `updated_at` >> `posted_at`:**
- ⚠️ **H2 POSSÍVEL** — Pode ter havido DELETE + UPDATE
- Investigar logs de auditoria / RLS

---

### Passo 5: Validação de Período (H5)

```sql
-- H5: Qual é o período de posts no banco? O JSON está fora do escopo?
SELECT 
  DATE(MIN(posted_at)) as primeira_data,
  DATE(MAX(posted_at)) as ultima_data,
  COUNT(*) as total_posts
FROM orbit.ig_posts
WHERE client_id IS NOT NULL
GROUP BY 1
ORDER BY 1;
```

**Resultado esperado:**
- Deve haver posts de 2026-05-18 a 2026-06-01 (período do JSON)

**Se NÃO:**
- ⚠️ **H5 POSSÍVEL** — JSON é de período fora da janela de ingestão
- Verificar `periodStart`/`periodEnd` em `ingest-l0-v2.ts`

---

## Árvore de Decisão — Qual Hipótese?

```
Passo 1: Handle em banco? 
  SIM → Passo 2
  NÃO → H4 CONFIRMADA (client_id mismatch)

Passo 2: raw_ig_ingest > 0?
  SIM → Passo 3
  NÃO → H1 CONFIRMADA (ingestão nunca rodou)

Passo 3: Todos processados?
  SIM → Passo 4
  NÃO → H3 CONFIRMADA (erro no processamento)

Passo 4: ig_posts > 0?
  SIM → Dado está lá; revisar client_ids
  NÃO → H1 reconfirmada (processamento incompleto)

Passo 5: Período cobre JSON?
  SIM → Verificar script
  NÃO → H5 CONFIRMADA (período fora do escopo)
```

---

## Exemplo: Resultado Esperado se Tudo OK

```
Passo 1:
id                                    | handle         | name
2141d077-0d82-4fda-83df-558377f105ff | cpimportstore  | CP Import Store
c4722cfc-cff2-4a03-a457-f14ee8c9e0e7 | eupetruchio84  | Eupetruchio

Passo 2:
raw_records: 24
unique_clients: 2
primeira_ingestao: 2026-07-08 10:00:00
ultima_ingestao: 2026-07-08 10:05:00

Passo 3:
client_id                             | raw_count | processados | com_erro
2141d077-0d82-4fda-83df-558377f105ff | 6         | 6           | 0
c4722cfc-cff2-4a03-a457-f14ee8c9e0e7 | 18        | 18          | 0

Passo 4:
client_id                             | total_posts | data_post_mais_antiga | data_post_mais_recente
2141d077-0d82-4fda-83df-558377f105ff | 6           | 2026-05-18            | 2026-05-29
c4722cfc-cff2-4a03-a457-f14ee8c9e0e7 | 18          | 2026-05-25            | 2026-06-01
```

---

## Próximo Passo

1. Execute os Passos 1–5 conforme árvore de decisão
2. Documente qual hipótese foi confirmada
3. Abra issue/task com a causa raiz identificada
4. **Revise P-011:** Altere status de "Aberta" para "Confirmada — [H1/H2/H3/H4/H5]"
5. Prepare correção conforme a hipótese (re-ingestão, data fix, script fix, etc.)
