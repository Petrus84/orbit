# Validação de Ingestão — Resultado do Banco (Corrigido)

**Data:** 2026-07-08  
**Query executada:** Cliente ID com nome corrigido (cpimportstore, eupetruchio84)  
**Resultado:** 0 posts em orbit.ig_posts

---

## Análise do Resultado

| Comparação | JSON | Banco | Diferença |
|-----------|------|-------|-----------|
| **Posts totais** | 24 | 0 | **−24 posts** ❌ |
| **Posts com timestamp** | 24 | N/A | ✓ Todos tinham |
| **Posts com métricas** | 0 | N/A | ✓ Nenhum tinha |

---

## Classificação vs. Premissas

### ❌ Achado: Divergência NÃO EXPLICADA

| Premissa | Explicaria essa diferença? | Status |
|----------|---------------------------|--------|
| P-001 | ❌ NÃO — P-001 é sobre seguidores, não posts | Não aplica |
| P-002 | ❌ NÃO — P-002 explica ausência de métricas, não ausência de posts | Não aplica |
| P-003 | ❌ NÃO — P-003 explica skip por timestamp ausente; aqui todos tinham timestamp | **NÃO VALIDADA** |

**Conclusão:** Os 24 posts do JSON com timestamp válido **deveriam estar no banco**, mas estão completamente ausentes (0 registros).

---

## Hipóteses de Causa Raiz

| Hipótese | Evidência esperada | Como validar |
|----------|-------------------|--------------|
| **H1: Ingestão nunca rodou** | Não há registros em `raw_ig_ingest` para esses clients | `SELECT COUNT(*) FROM orbit.raw_ig_ingest WHERE client_id = '2141d077-...'` |
| **H2: Posts foram deletados pós-ingestão** | Há logs/audit trail ou timestamps muito antigos | Verificar `updated_at` mais recente em `orbit.ig_posts` (se tiver registros de outros clients) |
| **H3: Error silencioso na ingestão** | Logs de erro em `ingest-l0-v2.ts` para esses clients | Verificar terminal/logs do script de ingestão |
| **H4: Client ID mapeamento incorreto** | JSON tem client_id diferente do ID real no banco | Comparar `orbit.clients.id` com os UUIDs no JSON |
| **H5: Data de post fora do escopo de ingestão** | Posts são de período anterior ao intervalo de ingestão | Verificar `periodStart`/`periodEnd` usados em `ingest-l0-v2.ts` |

---

## Ação Imediata: Validar Hipóteses

Execute estas queries **no Supabase** (schema `orbit`):

```sql
-- H1: Verificar se há registros brutos de ingestão para esses clients
SELECT COUNT(*) as raw_ingestion_records
FROM orbit.raw_ig_ingest
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');

-- H4: Confirmar que os client_ids estão no banco
SELECT id, handle FROM orbit.clients 
WHERE handle IN ('cpimportstore', 'eupetruchio84');

-- H2/H5: Verificar data mais recente de posts em orbit.ig_posts (qualquer client)
SELECT MAX(posted_at) as data_mais_recente, MIN(posted_at) as data_mais_antiga
FROM orbit.ig_posts;

-- Contexto: Total de posts no banco (todos os clients)
SELECT COUNT(*) as total_posts_banco FROM orbit.ig_posts;
```

---

## Documentar Nova Premissa

Com base nesse achado, abrir **P-011**:

```
P-011: Posts com timestamp válido no JSON não são inseridos em orbit.ig_posts
- Motivo/Evidência: 24 posts no JSON (período 2026-05-18 a 2026-06-01) com timestamp válido; 0 em orbit.ig_posts para os mesmos clients
- Onde entra: Ingest → L0 (ETL)
- Entrada: JSON Instagram export + ingest-l0-v2.ts
- Como validar: Comparar JSON vs. raw_ig_ingest; verificar se script rodou; comparar client_ids
- Efeito se errada: Perda silenciosa de todos os posts para clientes específicos; análise completamente vazia
- Status: ABERTA - REQUER INVESTIGAÇÃO IMEDIATA
```

---

## Próximo Passo

1. Execute as 4 queries acima no Supabase
2. Responda:
   - **H1:** `raw_ingestion_records` > 0 ou = 0?
   - **H4:** Os client_ids retornam alguma linha?
   - **H2/H5:** Qual é a data mais recente de posts no banco?
   - Contexto: Há quantos posts TOTAIS no banco?
3. Com essas respostas, podemos:
   - Confirmar se é falha de ingestão (H1/H3/H5) ou falha de mapeamento de ID (H4)
   - Determinar se é um problema isolado desses 2 clients ou sistêmico
   - Decidir se precisa re-rodar ingestão ou investigar logs

---

**Status:** ❌ **VALIDAÇÃO FALHOU — Lacuna não documentada encontrada (P-011)**
