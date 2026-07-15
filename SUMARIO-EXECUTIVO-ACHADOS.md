# 🎯 ORBIT VALIDAÇÕES — SUMÁRIO EXECUTIVO (2026-07-08)

**Status:** 🔴 **CRÍTICO** — 2 Lacunas Descobertas + 1 Descartada  
**Tempo Total de Validações:** ~30 min (3 queries SQL)  
**Próximas Ações:** 2 horas (investigação + correção)

---

## 📊 Resultado Resumido

```
VALIDAÇÕES EXECUTADAS:
├─ V1.3 ✅ Demografia em Supabase
├─ V4.1 ✅ Views Inventory
└─ V5.1 ✅ Client IDs

ACHADOS CRÍTICOS:
├─ 🚨 P-012 NOVA: Triplicidade de views (pode estar mascarando P-011)
├─ ⚠️ P-011: 24 JSON → 0 banco (causa raiz ainda desconhecida)
└─ ✅ H4 DESCARTADA: Client_id está correto no banco
```

---

## 🎯 Achado #1: P-012 — Views Duplicadas/Triplicadas

### O Problema
```
Esperado:     Encontrado:
─────────────────────────────────────────
v_quality_scores      → v_quality_scores ✓
(único)         → v_quality_scores_calculate ✗
             → v_quality_scores_calculated ✗

v_format_performance  → v_format_performance ✓
(único)         → v_format_performance_calculated ✗
```

### Por Que É Crítico
Se `instagramOverviewRepository.ts` consulta a view errada:
```
SELECT FROM v_quality_scores  ← pode estar vazia
↓
qualityScores = []
↓
Componentes recebem [] (vazio)
↓
UI mostra "sem dados" (apesar de dados reais em v_quality_scores_calculated)
```

**Possível Efeito:** Mascarar P-011 (parece que não há dados, mas pode ser apenas view errada)

### Como Investigar (10 min)
```bash
# 1. Verificar qual view tem dados:
SELECT COUNT(*) FROM orbit.v_quality_scores;
SELECT COUNT(*) FROM orbit.v_quality_scores_calculate;
SELECT COUNT(*) FROM orbit.v_quality_scores_calculated;

# 2. Verificar qual view repository consulta:
grep -n "from(" src/lib/repositories/instagramOverviewRepository.ts

# 3. Se diferentes → P-012 confirmada → deletar variantes + atualizar código
```

**Prioridade:** 🔴 **CRÍTICA** — Resolver ANTES de investigar P-011

---

## 🎯 Achado #2: P-011 — Perda de 24 Posts

### O Problema
```
JSON: 24 posts (período 2026-05-18 a 2026-06-01)
      ↓
Banco: 0 registros em orbit.ig_posts para cpimportstore + eupetruchio84
      ↓
Diferença: -24 posts (não explicada por P-001/P-002/P-003)
```

### Status da Investigação
```
H1 (Ingestão nunca rodou):     ? ← TESTAR
H2 (Posts foram deletados):     ? ← TESTAR
H3 (Erro silencioso):          ? ← TESTAR
H4 (Client_id mismatch):      ✅ DESCARTADA (IDs estão corretos)
H5 (Período fora do escopo):   ? ← TESTAR
```

### Como Investigar (15 min)
```bash
# V5.2: Há registros brutos de ingestão?
SELECT COUNT(*) FROM orbit.raw_ig_ingest WHERE client_id IN (...);

# V5.3: Foram processados? Há erros?
SELECT COUNT(*) FILTER (WHERE error_code IS NOT NULL) FROM orbit.raw_ig_ingest WHERE client_id IN (...);

# V5.4: Foram criados em ig_posts?
SELECT COUNT(*) FROM orbit.ig_posts WHERE client_id IN (...);

# V5.5: Período de posts cobre JSON?
SELECT MIN(posted_at), MAX(posted_at) FROM orbit.ig_posts;
```

**Prioridade:** 🔴 **CRÍTICA** — Mas **APÓS** resolver P-012

---

## 🎯 Achado #3: V1.3 — Demografia Parcialmente OK

### O Problema
```
gender_male_pct: "95.80" ✅ Correto
gender_female_pct: "4.10" ✅ Correto
age_18_24_pct: "0.00" ⚠️ ANORMAL (esperado: percentual real)
```

### Indicador de Mojibake
- Dados existem em banco
- MAS age_18_24_pct = 0 para TODOS os registros
- Possível causa: parseAgeRange() recebeu chave errada (mojibake)

### Como Confirmar (5 min)
```bash
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('output/l0-ingestion/audience_insights.json','utf-8'));
const smd = d.organic_insights_audience[0].string_map_data;
console.log('Chaves com Ã (mojibake):', Object.keys(smd).filter(k => k.includes('Ã')));
console.log('Lookup (esperado):', smd['Porcentagem de seguidores por idade para todos os gêneros'] ?? 'NÃO ENCONTRADO');
console.log('Lookup (mojibake):', smd['Porcentagem de seguidores por idade para todos os gÃªneros'] ?? 'NÃO ENCONTRADO');
"
```

**Prioridade:** 🟡 **MÉDIA** — Informativo, mas não bloqueia UI

---

## 📅 Plano de Ação Recomendado

```
HOJE (Fase 1-2: 30 min)
├─ [10 min] P-012: Contar linhas em views (3 queries SQL)
├─ [10 min] V1.1: Confirmar mojibake (1 comando Node.js)
└─ [10 min] P-011: Executar V5.2 (raw_ig_ingest count)

DEPOIS (Fase 3-4: 1h 30 min)
├─ [30 min] P-012: Corrigir (deletar views + atualizar repository se confirmado)
├─ [30 min] P-011: Executar V5.3–V5.5 + corrigir conforme resultado
└─ [30 min] Validação final (npm run dev, testar UI)
```

---

## 📁 Arquivos de Referência

- **`CONSOLIDACAO-ACHADOS-V1.md`** — Guia executivo com queries prontas
- **`P-012-TRIPLICIDADE-VIEWS.md`** — Investigação + correção de P-012
- **`P-011-DIAGNOSTIC-QUERIES.md`** — Queries prontas para P-011
- **`VALIDACOES-PENDENTES.md`** — Todos os testes estruturados
- **`orbit-sprint-review-premissas.md`** — Premissas atualizadas com P-012

---

## 🚨 Ação Imediata #1: P-012 Investigação

Execute agora no Supabase SQL Editor:

```sql
-- Contar linhas em cada variante (TOMAR DECISÃO SOBRE QUAL MANTER)
SELECT 'v_quality_scores' as view_name, COUNT(*) as row_count 
FROM orbit.v_quality_scores

UNION ALL

SELECT 'v_quality_scores_calculate', COUNT(*) 
FROM orbit.v_quality_scores_calculate

UNION ALL

SELECT 'v_quality_scores_calculated', COUNT(*) 
FROM orbit.v_quality_scores_calculated

ORDER BY view_name;
```

**Se resultado mostrar:**
- Dados APENAS em `_calculated` e repository consulta outra → **P-012 CONFIRMADA** ✅
- Deletar variantes base + intermediárias
- Atualizar repository para consultar `v_quality_scores_calculated`
- Rodar `npm run dev` e verificar se dados agora aparecem

---

## 🚨 Ação Imediata #2: V1.1 Mojibake (Confirmação)

Execute no terminal:

```bash
cd c:\Projetos\orbit-dashboard
node -e "const fs = require('fs'); const d = JSON.parse(fs.readFileSync('output/l0-ingestion/audience_insights.json','utf-8')); const smd = d.organic_insights_audience[0].string_map_data; console.log('Chaves com mojibake:', Object.keys(smd).filter(k => k.includes('Ã')).length > 0 ? 'SIM' : 'NÃO'); console.log('Primeiras 3 chaves com Ã:', Object.keys(smd).filter(k => k.includes('Ã')).slice(0,3));"
```

Se houver chaves com `Ã` → mojibake confirmado em audience_insights.json

---

## 📊 Matriz de Decisão

| Se P-012 | Se P-011 | Próxima Ação |
|----------|----------|-------------|
| ✅ Confirmada | TBD | Corrigir P-012 PRIMEIRO, depois P-011 |
| ❌ Não confirmada | ✅ H1/H3 | Reiniciar ingestão com debugging |
| ❌ Não confirmada | ✅ H2 | Verificar audit trail, restaurar dados |
| ❌ Não confirmada | ✅ H5 | Ajustar periodStart/periodEnd |

---

## ✅ Resultado Esperado (Após Correções)

```
ANTES:
└─ QualityScoresPanel recebe scores=[]
   └─ Renderiza: "Sem dados"

DEPOIS:
└─ QualityScoresPanel recebe scores=[{...}, {...}, ...]
   └─ Renderiza: Cards com valores reais (Utilidade: 47.6, VPS: 23.1, etc.)
```

---

**Próximo passo:** Execute P-012 investigação (query SQL acima) e reporte resultado.
