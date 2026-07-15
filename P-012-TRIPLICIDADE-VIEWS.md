# P-012 — Triplicidade de v_quality_scores e Duplicidade de v_format_performance

**Data de Descoberta:** 2026-07-08  
**Status:** 🔴 **CRÍTICA — CAUSA POTENCIAL DE "DADOS NÃO CHEGAM À UI"**  
**Tipo:** Lacuna Arquitetural (Views)  
**Impacto:** Camadas 2-5 (Repository → UI)

---

## 🎯 Problema Resumido

Três variantes de `v_quality_scores` coexistem no schema `orbit`:
1. `v_quality_scores` (base)
2. `v_quality_scores_calculate` (intermediária?)
3. `v_quality_scores_calculated` (final?)

Duas variantes de `v_format_performance`:
1. `v_format_performance` (base)
2. `v_format_performance_calculated` (final?)

**Questão crítica:** Repository consulta QUAL variante? Se consultar a versão desatualizada ou incompleta → dados não chegam aos componentes.

---

## 📋 Evidência

**Query executada (V4.1):**
```sql
SELECT table_schema, table_name FROM information_schema.tables 
WHERE table_schema = 'orbit' AND table_type = 'VIEW'
ORDER BY table_name;
```

**Resultado:**
```
Tabela                              | Schema
------------------------------------|-------
v_quality_scores                    | orbit
v_quality_scores_calculate          | orbit  ← EXTRA
v_quality_scores_calculated         | orbit  ← EXTRA
v_format_performance                | orbit
v_format_performance_calculated     | orbit  ← EXTRA
```

**Confirmação:** 3 variantes de quality_scores, 2 de format_performance.

---

## 🔍 Hipóteses sobre Causa

### H1: Iteração Incompleta de Refactor
- Desenvolvedor criou `v_quality_scores_calculated` (versão melhorada)
- Deixou variantes antigas: `v_quality_scores`, `v_quality_scores_calculate`
- Resultado: 3 versões coexistindo, nenhuma foi deletada

**Indicador:** Nomes com sufixos `_calculate` (singular, ativo?) vs `_calculated` (passado, completo?)

### H2: Diferentes Propósitos (Staging)
- `v_quality_scores_calculate` → view que calcula (inserindo em tabela staging)
- `v_quality_scores_calculated` → view final consumida por app
- `v_quality_scores` → legacy (não deveria mais ser usada)

**Indicador:** Se propósitos diferentes, qual é consultada por repository?

### H3: Erro de Criação de View
- Comando de CREATE VIEW foi rodado 3 vezes por erro
- Cada execução criou sufixo diferente
- Resultado: duplicação acidental

**Indicador:** Se logs de criação de views estão disponíveis, podem confirmar datas

---

## ⚠️ Impacto Cascata (Por Que Isso Causa "Dados Não Chegam")

### Cenário A: Repository Consulta View Incompleta
```
1. Repository: SELECT * FROM orbit.v_quality_scores_calculate
   ↓ (se view incompleta ou em staging)
2. Resultado: 0 linhas (ou dados parciais)
   ↓
3. Hook: qualityScores = []
   ↓
4. Componente: <QualityScoresPanel scores={[]} />
   ↓
5. UI: "Sem dados" aparece (apesar de dados reais em v_quality_scores_calculated)
```

### Cenário B: Repository Consulta View Errada
```
1. Repository: SELECT * FROM orbit.v_quality_scores
   ↓ (se base está vazia porque tudo foi movido para _calculated)
2. Resultado: 0 linhas
   ↓
3. Cascata idêntica ao Cenário A
```

### Impacto em P-011 (Mascaramento)
- P-011 diz: "24 JSON → 0 banco"
- **MAS**: Se dados EXISTEM em `v_quality_scores_calculated` mas repository consulta `v_quality_scores` → mesmo sintoma
- **Conclusão**: P-012 pode estar **MASCARANDO** P-011 ou **CAUSANDO** o mesmo efeito

---

## 🔧 Investigação Necessária

### Passo 1: Verificar qual view contém dados

```sql
-- Contar linhas em cada variante
SELECT 
  'v_quality_scores' as view_name,
  COUNT(*) as row_count
FROM orbit.v_quality_scores

UNION ALL

SELECT 
  'v_quality_scores_calculate',
  COUNT(*)
FROM orbit.v_quality_scores_calculate

UNION ALL

SELECT 
  'v_quality_scores_calculated',
  COUNT(*)
FROM orbit.v_quality_scores_calculated

ORDER BY view_name;
```

**Resultado esperado (se correto):**
```
v_quality_scores            | N > 0
v_quality_scores_calculate  | 0 ou ERRO (não deveria existir)
v_quality_scores_calculated | N > 0
```

**Resultado suspeito (indicar P-012):**
```
v_quality_scores            | 0
v_quality_scores_calculate  | 0
v_quality_scores_calculated | N > 0  ← dados EXISTEM aqui
```

### Passo 2: Verificar qual view é consultada por repository

**Arquivo:** `src/lib/repositories/instagramOverviewRepository.ts`

**Buscar linha com query de quality_scores:**
```typescript
// Procure por algo como:
const { data: qualityScores } = await supabase
  .schema('orbit')
  .from('v_quality_scores')  // ← qual nome?
  .select('*')
  .eq('client_id', clientId)
```

**Questão:** Qual view está no `.from()`? Se for `v_quality_scores` mas dados estão em `v_quality_scores_calculated` → **PROBLEMA**

### Passo 3: Verificar definição de cada view

```sql
-- Ver DDL da view
SELECT table_definition 
FROM information_schema.views 
WHERE table_name = 'v_quality_scores_calculated' 
  AND table_schema = 'orbit';
```

**Objetivo:** Confirmar se `_calculate` e `_calculated` têm definições diferentes ou iguais.

---

## 🎯 Ação de Resolução

**Prioridade:** 🔴 **CRÍTICA** — Antes de continuar com P-011

### Fase 1: Confirmação (10 min)
1. Executar Passo 1 (contar linhas em cada view)
2. Executar Passo 2 (verificar código repository)
3. Confirmar se repository está consultando view correta

### Fase 2: Correção (30 min)
**Se problema confirmado:**

**Opção A: Views duplicadas são resíduo (H1 provável)**
1. Deletar `v_quality_scores_calculate` e `v_quality_scores` (manter apenas `v_quality_scores_calculated`)
2. Atualizar repository para consultar única view final
3. Testar para confirmar dados chegam à UI

**Opção B: Views têm propósitos diferentes (H2 provável)**
1. Documentar cada view e seu propósito
2. Confirmar qual é consumida por repository
3. Referenciar variante correta no código

**Opção C: Erro de criação (H3 provável)**
1. Recrear views limpas (deletar 2, manter 1)
2. Validar que versão final é a correcta
3. Rodar testes

### Fase 3: Validação (10 min)
1. Rodar `npm run dev`
2. Abrir dashboard
3. Verificar se dados agora aparecem
4. Confirmar QualityScoresPanel renderiza com dados reais

---

## 📊 Relação com Outras Lacunas

| Lacuna | Relação com P-012 |
|--------|------------------|
| P-001 | Independente (export structure) |
| P-002 | Independente (metrics in JSON) |
| P-003 | Independente (timestamp presence) |
| P-004 | Independente (CSS import) |
| P-011 | 🔗 **CRÍTICA**: P-012 pode estar mascarando P-011 |
| P-010 | Independente (ingestão funcionava) |

**Conclusão:** Resolver P-012 pode resolver AMBOS P-011 e "dados não chegam à UI".

---

## 📝 Documentação para Revisão

- Documento: `VALIDACOES-PENDENTES.md` (V4.1 com achado P-012)
- Documento: `ORBIT SPRINT REVIEW.md` (será atualizado com P-012)
- Documento: `orbit-sprint-review-premissas.md` (será adicionada linha P-012)

---

## 🚨 Próximo Passo Imediato

Execute Passo 1 no Supabase SQL Editor para confirmar se dados estão em `v_quality_scores_calculated` mas repository consulta outra view:

```sql
SELECT 'v_quality_scores' as view_name, COUNT(*) as row_count FROM orbit.v_quality_scores
UNION ALL
SELECT 'v_quality_scores_calculate', COUNT(*) FROM orbit.v_quality_scores_calculate
UNION ALL
SELECT 'v_quality_scores_calculated', COUNT(*) FROM orbit.v_quality_scores_calculated;
```

Se resultado mostrar dados em `_calculated` e 0 nas outras → P-012 confirmada.
