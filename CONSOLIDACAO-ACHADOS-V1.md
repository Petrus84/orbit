# 📊 Consolidação de Achados — Validações SQL V1.3, V4.1, V5.1

**Data:** 2026-07-08  
**Status:** ✅ Integrado com Análise Crítica  
**Objetivo:** Summarizar resultados e próximas ações obrigatórias

---

## 🎯 Achados Críticos (Ordem de Impacto)

### 1️⃣ **P-012 DESCOBERTA — Triplicidade de Views (CRÍTICA)**

**Query executada:** Inventário de views em `orbit` schema  
**Resultado:** 13 views encontradas

```
✅ Views esperadas existem:
   ├─ v_quality_scores
   ├─ v_format_performance  
   └─ v_kpi_snapshots

❌ MAS: Triplicidade de quality_scores:
   ├─ v_quality_scores (base)
   ├─ v_quality_scores_calculate (intermediária)
   └─ v_quality_scores_calculated (final)

❌ E Duplicidade de format_performance:
   ├─ v_format_performance (base)
   └─ v_format_performance_calculated (final)
```

**Análise:**
- 3 variantes = resíduo de iteração incompleta
- **Impacto crítico**: Se `instagramOverviewRepository.ts` consulta variante errada → dados não chegam à UI
- **Correlação com P-011**: Pode estar **mascarando** a causa real de "dados não chegam"
- **Prioridade**: 🔴 **CRÍTICA** — resolver ANTES de investigar P-011

**Documentação criada:** `P-012-TRIPLICIDADE-VIEWS.md` (com 3 passos de investigação + correção)

---

### 2️⃣ **V1.3 — Demografia em Supabase (PARCIALMENTE OK)**

**Query executada:** Verificar dados em `orbit.ig_audience_snapshots`  
**Resultado:** 5 linhas encontradas
```json
{
  "gender_male_pct": "95.80",
  "gender_female_pct": "4.10",
  "age_18_24_pct": "0.00"  ⚠️ ANORMAL
}
```

**Análise:**
- ✅ Gender distribution foi parseado corretamente (SEM mojibake evidente)
- ⚠️ **MAS**: `age_18_24_pct: "0.00"` é suspeito — deveria ter percentual real
- **Indicador de mojibake**: Chaves de idade não foram encontradas → fallback para 0%
- **Próxima validação necessária**: V1.1 (Node.js parsing de JSON) para confirmar

**Status:** Dados EXISTEM no banco, mas com valores suspeitos de parsing errado

---

### 3️⃣ **V5.1 — Client IDs Corretos (✅ OK)**

**Query executada:** Verificar se clients existem  
**Resultado:** Ambos encontrados
```json
[
  { "id": "2141d077-0d82-4fda-83df-558377f105ff", "handle": "cpimportstore" },
  { "id": "c4722cfc-cff2-4a03-a457-f14ee8c9e0e7", "handle": "eupetruchio84" }
]
```

**Análise:**
- ✅ Ambos clients estão mapeados corretamente
- ✅ **H4 (client_id mismatch) DESCARTADA** — problema NÃO é aqui
- **Implicação**: P-011 causa raiz NÃO é mapeamento de cliente
- **Próximos passos**: Executar V5.2–V5.5 (raw_ig_ingest → processamento → ig_posts → período)

**Status:** ✅ Validado — continuar diagnóstico P-011

---

## 📋 Próximas Validações Obrigatórias

### 🔴 PRIORIDADE 1: P-012 Investigação (Antes de P-011)

**Por quê:** Se P-012 está causando o mesmo sintoma de P-011 (dados não chegam), não faz sentido investigar P-011 sem resolver P-012 primeiro.

**Passos (veja `P-012-TRIPLICIDADE-VIEWS.md`):**

1. **Contar linhas em cada view:**
   ```sql
   SELECT 'v_quality_scores' as view_name, COUNT(*) as row_count FROM orbit.v_quality_scores
   UNION ALL
   SELECT 'v_quality_scores_calculate', COUNT(*) FROM orbit.v_quality_scores_calculate
   UNION ALL
   SELECT 'v_quality_scores_calculated', COUNT(*) FROM orbit.v_quality_scores_calculated;
   ```
   **Resultado esperado (se P-012):**
   - `v_quality_scores`: 0
   - `v_quality_scores_calculate`: 0
   - `v_quality_scores_calculated`: N > 0

2. **Verificar qual view repository consulta:**
   - Arquivo: `src/lib/repositories/instagramOverviewRepository.ts`
   - Procurar: `.from('v_quality_scores...')`
   - Confirmar: Se consulta nome errado → P-012 confirmada

3. **Corrigir (se confirmado):**
   - Deletar variantes intermediárias
   - Atualizar repository para consultar ÚNICA view final
   - Testar se dados chegam à UI

**Tempo estimado:** 30 min (investigação + correção)

---

### 🔴 PRIORIDADE 2: P-011 Investigação (V5.2–V5.5)

**Por quê:** Determinar causa raiz de "24 JSON → 0 banco"

**Hipóteses restantes** (H4 descartada):
- H1: Ingestão nunca rodou (raw_ig_ingest vazio)
- H2: Posts foram deletados pós-ingestão (updated_at recente)
- H3: Erro silencioso no processamento (error_code != null)
- H5: Posts fora do período de ingestão

**Queries (ordem de execução):**

```sql
-- V5.2: raw_ig_ingest tem registros?
SELECT COUNT(*) as raw_records FROM orbit.raw_ig_ingest 
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');

-- V5.3: Foram processados?
SELECT 
  COUNT(*) as total_raw,
  COUNT(*) FILTER (WHERE error_code IS NOT NULL) as com_erro
FROM orbit.raw_ig_ingest 
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');

-- V5.4: ig_posts tem dados?
SELECT COUNT(*) as total_posts FROM orbit.ig_posts 
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');

-- V5.5: Período cobre JSON?
SELECT 
  DATE(MIN(posted_at)) as primeira_data, 
  DATE(MAX(posted_at)) as ultima_data
FROM orbit.ig_posts;
```

**Tempo estimado:** 15 min (queries) + 30 min (correção conforme resultado)

---

### 🟡 PRIORIDADE 3: Confirmar Mojibake (V1.1, V1.2)

**Por quê:** age_18_24_pct = 0.00 é suspeito; confirmar se é mojibake

**Commands:**

```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('output/l0-ingestion/audience_insights.json','utf-8'));
const smd = data.organic_insights_audience[0].string_map_data;
console.log('Chaves com Ã (mojibake):', Object.keys(smd).filter(k => k.includes('Ã')));
console.log('Lookup esperado:', smd['Porcentagem de seguidores por idade para todos os gêneros'] ?? 'NÃO ENCONTRADO');
console.log('Lookup com mojibake:', smd['Porcentagem de seguidores por idade para todos os gÃªneros'] ?? 'NÃO ENCONTRADO');
"
```

**Tempo estimado:** 5 min

---

## 🎯 Plano de Execução Recomendado

| Fase | Tarefa | Tempo | Status |
|------|--------|-------|--------|
| 1 | **P-012 Investigação** (contar linhas em views) | 10 min | ⏳ Pronto para executar |
| 2 | **P-012 Correção** (se confirmado: deletar views + atualizar repository) | 20 min | ⏳ Aguardando fase 1 |
| 3 | **V1.1/V1.2** (confirmar mojibake em Node.js) | 5 min | ⏳ Pronto para executar |
| 4 | **P-011 V5.2–V5.5** (4 queries de diagnóstico) | 15 min | ⏳ Pronto para executar (após V5.1 OK) |
| 5 | **P-011 Correção** (conforme resultado de V5.2–V5.5) | 30 min | ⏳ Aguardando fase 4 |
| 6 | **Validação final** (npm run dev, testar UI) | 10 min | ⏳ Aguardando fases 2+5 |

**Total estimado:** 1h 30 min

---

## 📁 Documentação Criada/Atualizada

- ✅ `VALIDACOES-PENDENTES.md` — Atualizado com V1.3, V4.1, V5.1 (resultados + análises)
- ✅ `P-012-TRIPLICIDADE-VIEWS.md` — Nova (investigação + correção + validação)
- ✅ `orbit-sprint-review-premissas.md` — Atualizado com P-012 na tabela e lacunas
- ✅ `P-011-DIAGNOSTIC-QUERIES.md` — Pronto (queries preparadas)

---

## 🚨 Ação Imediata

**Execute agora (ordem recomendada):**

1. **P-012 Contagem (SQL):**
   ```sql
   SELECT 'v_quality_scores' as view_name, COUNT(*) FROM orbit.v_quality_scores
   UNION ALL SELECT 'v_quality_scores_calculate', COUNT(*) FROM orbit.v_quality_scores_calculate
   UNION ALL SELECT 'v_quality_scores_calculated', COUNT(*) FROM orbit.v_quality_scores_calculated;
   ```

2. **Depois: V1.1 Mojibake (Node.js):**
   ```bash
   cd c:\Projetos\orbit-dashboard
   node -e "const fs = require('fs'); const d = JSON.parse(fs.readFileSync('output/l0-ingestion/audience_insights.json','utf-8')); const smd = d.organic_insights_audience[0].string_map_data; console.log(Object.keys(smd).filter(k => k.includes('Ã')).slice(0,5))"
   ```

3. **Depois: P-011 V5.2 (SQL):**
   ```sql
   SELECT COUNT(*) FROM orbit.raw_ig_ingest WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');
   ```

Reporte os resultados aqui e continuamos com próximas fases.
