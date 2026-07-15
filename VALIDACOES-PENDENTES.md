# Validações Pendentes — ORBIT SPRINT REVIEW

**Data:** 2026-07-08  
**Status:** ⏳ Integração de Premissas Completa — Validações Pendentes Identificadas  
**Objetivo:** Confirmar cada premissa documentada com testes práticos

---

## 1️⃣ Mojibake em Chaves JSON (CRÍTICO — Camada 1)

### Premissa Documentada
- Chaves JSON com acentos estão corrompidas (UTF-8 duplo)
- Exemplo: `"gêneros"` → `"gÃªneros"`, `"país"` → `"paÃ-s"`
- Impacto: `parseAgeRange()`, `parseLocations()`, ingest de Reels metrics retornam 0

### Validações Pendentes

**V1.1: Confirmar mojibake no arquivo real do export** ✅ **EXECUTADA**

> O caminho anterior `output/l0-ingestion/audience_insights.json` não existe neste workspace. A validação foi reexecutada no arquivo real encontrado: `output/l0-ingestion/content_interactions.json`.

```bash
node -e "const fs=require('fs'); const path='output/l0-ingestion/content_interactions.json'; const data=JSON.parse(fs.readFileSync(path,'utf8')); const smd=data.organic_insights_interactions[0].string_map_data; const mojibake=Object.keys(smd).filter(k=>k.includes('Ã')||k.includes('�')); console.log('mojibake keys', mojibake.slice(0,10)); console.log('has mojibake', mojibake.length>0);"
```

**Resultado real:**
```text
mojibake keys [
  'InteraÃ§Ãµes com o conteÃºdo',
  'VariaÃ§Ã£o de interaÃ§Ãµes com o conteÃºdo',
  'InteraÃ§Ãµes com posts',
  ...
]
has mojibake true
```

**Conclusão:** o mojibake está confirmado no export real disponível em `output/l0-ingestion/content_interactions.json`. O arquivo `audience_insights.json` não está presente neste workspace.

**V1.2: Confirmar mojibake em content_interactions.json** ✅ **EXECUTADA**

**V1.3: Verificar dados em Supabase (após ingestão)** ✅ **EXECUTADA**

**Resultado:**
```json
gender_male_pct: "95.80"
gender_female_pct: "4.10"
age_18_24_pct: "0.00"  ⚠️ ANORMAL — esperado percentual real, não 0
```

**Análise Crítica:**
- ✅ Dados **EXISTEM** em `orbit.ig_audience_snapshots`
- ✅ Gender distribution foi parseado corretamente (sem mojibake evidente aqui)
- ⚠️ **PROBLEMA**: `age_18_24_pct: "0.00"` — valor suspeito (deveria ter percentual real)
- **Indicador**: Chaves de idade não foram encontradas no JSON → fallback para 0%
- **Próxima investigação**: Executar V1.1 (Node.js parsing) para confirmar mojibake

**V1.4: Verificar código em scripts/extract-demographics.ts**
- [ ] Linhas ~180: Verificar se lookup usa chave com acentos ou mojibake
- [ ] Confirmar se `parseAgeRange()` recebe string vazia → retorna 0%

**V1.5: Verificar código em scripts/ingest-insights.ts**
- [ ] Linhas ~120: Verificar se `int(smd, 'Curtidas em vídeos do Reels')` falha
- [ ] Confirmar se função `int()` retorna 0 para chaves com mojibake

---

## 2️⃣ Duplicidade de posts.json (RISCO — Camada 1)

### Premissa Documentada
- Dois arquivos posts.json com propósitos diferentes
- `your_instagram_activity/media/posts.json` (19 registros para ingestão)
- `logged_information/past_instagram_insights/posts.json` (insights consolidados)
- Risco: Ingestão pode apontar para arquivo errado

### Validações Pendentes

**V2.1: Verificar qual posts.json está sendo lido**
```bash
# No diretório que contém os JSONs:
ls -la */*/posts.json
# Output esperado:
# your_instagram_activity/media/posts.json
# logged_information/past_instagram_insights/posts.json
```

**V2.2: Verificar MANIFEST_SPECS em scripts/lib/instagram-export-manifest.ts**
- [ ] Qual arquivo está definido para `ingest-l0-v2`?
- [ ] Se ambos estão, qual é processado primeiro?

**V2.3: Verificar resolveManifest() em scripts/lib/resolveClientId.ts**
```javascript
// Linha que precisa ser inspecionada:
const manifestResult = resolveManifest(folderPath, 'ingest-l0-v2')
console.log('[resolveManifest] found:', manifestResult?.found)
// Deve listar:
// - your_instagram_activity/media/posts.json
// - Não deve listar logged_information/past_instagram_insights/posts.json
```

**V2.4: Comparar contagem de registros após ingestão**
```sql
-- Deve ter ~19 registros para eupetruchio84
SELECT COUNT(*) as total_posts FROM orbit.ig_posts 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7';

-- Se tiver muito mais que 19, significa que ambos os posts.json foram ingeridos
-- Se tiver 19, significa que apenas o correto foi ingerido
```

---

## 3️⃣ Dados em Supabase Mas Não na UI (CRÍTICO — Camadas 2-5)

### Premissa Documentada
- Ingestão funciona (Camada 1)
- Dados chegam a Supabase
- MAS: Dados não renderizam nos componentes
- Foco: Rastrear fluxo Supabase → UI com logging

### Validações Pendentes

#### **Camada 2: instagramOverviewRepository.ts**

**V3.1: Verificar se queries retornam dados**
```typescript
// Arquivo: src/lib/repositories/instagramOverviewRepository.ts
// Adicionar logging na função fetchInstagramOverview():

export async function fetchInstagramOverview(params: IGOverviewParams): Promise<IGOverviewData> {
  console.log('[instagramOverviewRepository] START fetchInstagramOverview', params)
  
  const [postsResult, accountResult, kpiResult] = await Promise.allSettled([...])
  
  console.log('[instagramOverviewRepository] postsResult:', postsResult.status, postsResult.value?.length ?? 0)
  console.log('[instagramOverviewRepository] accountResult:', accountResult.status, accountResult.value?.length ?? 0)
  console.log('[instagramOverviewRepository] kpiResult:', kpiResult.status, kpiResult.value?.length ?? 0)
  
  return {
    qualityScores: posts?.map(toQualityScore) ?? [],
    formatPerformance: posts?.map(toFormatPerformance) ?? [],
    criticalAlerts: []
  }
}
```

**V3.2: Verificar queries SQL individuais**
```sql
-- V3.2a: Quality Scores View
SELECT * FROM orbit.v_quality_scores 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7'
LIMIT 5;

-- V3.2b: Format Performance View
SELECT * FROM orbit.v_format_performance 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7'
LIMIT 5;

-- V3.2c: KPI Snapshots
SELECT * FROM orbit.v_kpi_snapshots 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7'
LIMIT 5;
```

#### **Camada 3: useInstagramOverview Hook**

**V3.3: Verificar se hook recebe dados do repositório**
```typescript
// Arquivo: src/hooks/useInstagramOverview.ts
// Adicionar logging na função hook:

useEffect(() => {
  console.log('[useInstagramOverview] Iniciando fetch para client:', clientId)
  
  const timer = setTimeout(() => {
    fetchInstagramOverview({ clientId, periodStart, periodEnd })
      .then(data => {
        console.log('[useInstagramOverview] Dados recebidos:', data)
        setData(data)
      })
      .catch(error => {
        console.error('[useInstagramOverview] Erro na fetch:', error)
        setError(error)
      })
  }, delay)
  
  return () => clearTimeout(timer)
}, [clientId, periodStart, periodEnd, delay])
```

#### **Camada 5: Componentes**

**V3.4: Verificar se componentes recebem props**
```typescript
// Arquivo: src/components/content/QualityScoresPanel.tsx
// Adicionar logging no início da função:

export function QualityScoresPanel({ scores }: QualityScoresPanelProps) {
  console.log('[QualityScoresPanel] Props recebidas:', scores)
  
  return (
    // ... resto do componente
  )
}

// Arquivo: src/components/content/FormatPerformanceTable.tsx
export function FormatPerformanceTable({ rows }: FormatPerformanceTableProps) {
  console.log('[FormatPerformanceTable] Props recebidas:', rows)
  
  return (
    // ... resto do componente
  )
}
```

**V3.5: Verificar renderização final na página**
```typescript
// Arquivo: src/app/instagram/page.tsx
// Adicionar logging após useOrbitDashboard:

export default function InstagramPage() {
  const { data, status, error } = useOrbitDashboard()
  
  console.log('[InstagramPage] Contexto:', { data, status, error })
  
  if (status === 'loading') {
    return <div>Carregando...</div>
  }
  
  if (error) {
    return <div>Erro: {error.message}</div>
  }
  
  return (
    <>
      <QualityScoresPanel scores={data.qualityScores} />
      <FormatPerformanceTable rows={data.formatPerformance} />
      {data.criticalAlerts.map(alert => <CriticalAlert alert={alert} />)}
    </>
  )
}
```

---

## 4️⃣ Views e Tabelas Existem? (CRÍTICO — Camada 1)

### Premissa Documentada
- Repositório consulta: `orbit.v_quality_scores`, `orbit.v_format_performance`, `orbit.v_kpi_snapshots`
- Não está claro se essas views existem no schema `orbit` ou em `public`
- Problema anterior: P-006 (views nomeadas incorretamente)

### Validações Pendentes

**V4.1: Inventário de views em orbit schema** ✅ **EXECUTADA**

**Resultado (13 views encontradas):**
```
✅ v_alerts
✅ v_audience_alignment
✅ v_avatar_alignment
✅ v_boost_candidates
✅ v_client_health
✅ v_creative_fatigue
✅ v_format_performance           (base)
❌ v_format_performance_calculated (duplicata / legacy)
✅ v_kpi_snapshots
✅ v_quality_scores                (base)
❌ v_quality_scores_calculate      (duplicata / legacy)
❌ v_quality_scores_calculated     (duplicata / legacy)
✅ v_roas_viability
```

**Conclusão baseada no teste real:**
- A view de qualidade usada pelo repository, `v_quality_scores`, tem 16 linhas.
- As demais variantes (`v_quality_scores_calculate` e `v_quality_scores_calculated`) têm 0 linhas.
- O código em `src/lib/repositories/instagramOverviewRepository.ts` já consulta `v_quality_scores`, ou seja, a consulta atual está usando a versão com dados.

**Interpretação correta para P-012:**
- A duplicidade de views é um resíduo de governança/limpeza de schema, mas não é a causa imediata do problema observado.
- O problema atual é mais alinhado a um problema de ingestão/parse de JSON (mojibake) e não a um erro de escolha da view no repository.

**Ação recomendada:**
- Manter a view base como fonte canônica por enquanto.
- Marcar as variantes extras como `legacy` / `resíduo` para futura limpeza.
- Não bloquear a análise de P-011 em cima de P-012.

**V4.2: Inventário de views em public schema (fallback)**
```sql
-- Listar todas as views no schema public
SELECT 
  table_schema, 
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'VIEW'
ORDER BY table_name;
```

**V4.3: Verificar se views esperadas existem**
```sql
-- Verificar existência de cada view
SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'orbit' AND table_name = 'v_quality_scores') as v_quality_scores_exists;
SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'orbit' AND table_name = 'v_format_performance') as v_format_performance_exists;
SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'orbit' AND table_name = 'v_kpi_snapshots') as v_kpi_snapshots_exists;
```

**V4.4: Verificar duplicação (P-006)**
```sql
-- Se v_quality_scores existe em ambos schemas
SELECT 
  table_schema, 
  table_name,
  COUNT(*) as count
FROM information_schema.views
WHERE table_name LIKE 'v_quality%' OR table_name LIKE 'v_format%' OR table_name LIKE 'v_kpi%'
GROUP BY table_schema, table_name
ORDER BY table_name;
```

---

## 5️⃣ P-011: Ingestão Completa (24 JSON → 0 Banco)

### Premissa Documentada
- 24 posts com timestamp válido no JSON
- 0 registros em `orbit.ig_posts` para os mesmos clients
- Causa: Desconhecida (5 hipóteses: H1–H5)

### Validações Pendentes

**V5.1–V5.5: Executar queries de diagnóstico P-011 (veja P-011-DIAGNOSTIC-QUERIES.md)**

**V5.1 — Passo 1: Handles em Banco?** ✅ **EXECUTADA**
```json
[
  { "id": "2141d077-0d82-4fda-83df-558377f105ff", "handle": "cpimportstore" },
  { "id": "c4722cfc-cff2-4a03-a457-f14ee8c9e0e7", "handle": "eupetruchio84" }
]
```
**✅ Resultado**: Ambos clients EXISTEM com IDs corretos  
**✅ Conclusão**: **H4 (client_id mismatch) DESCARTADA** ✗

**Implicação para V5.2+**: Problema NÃO é mapeamento de cliente. Continuar para próximos passos.

**V5.2 — Passo 2: raw_ig_ingest tem registros?** ⏳ **PENDENTE**
```sql
SELECT COUNT(*) as raw_records FROM orbit.raw_ig_ingest 
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');
```
**Resultado esperado:**
- Se 0 → **H1 CONFIRMADA**: Ingestão nunca rodou
- Se > 0 → dados brutos entraram, prosseguir para V5.3

**V5.3 — Passo 3: Registros foram processados com sucesso?** ⏳ **PENDENTE**
```sql
SELECT 
  COUNT(*) as total_raw,
  COUNT(*) FILTER (WHERE error_code IS NOT NULL) as com_erro,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processados
FROM orbit.raw_ig_ingest 
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');
```
**Resultado esperado:**
- Se `com_erro > 0` → **H3 CONFIRMADA**: Erro silencioso no processamento
- Se `processados = 0` mas `total_raw > 0` → **H1 RECONFIRMADA**: Nunca foram processados

**V5.4 — Passo 4: Dados foram criados em ig_posts?** ⏳ **PENDENTE**
```sql
SELECT COUNT(*) as total_posts FROM orbit.ig_posts 
WHERE client_id IN ('2141d077-0d82-4fda-83df-558377f105ff', 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7');
```
**Resultado esperado:**
- Se 0 → Posts nunca foram criados (H1 final, ou H3 com erro)
- Se > 0 → OK, investigar V5.5

**V5.5 — Passo 5: Período de posts cobre JSON?** ⏳ **PENDENTE**
```sql
SELECT 
  DATE(MIN(posted_at)) as data_mais_antiga, 
  DATE(MAX(posted_at)) as data_mais_recente,
  COUNT(*) as total_posts
FROM orbit.ig_posts;
```
**Resultado esperado:**
- Deve cobrir 2026-05-18 a 2026-06-01 (período do JSON)
- Se fora do período → **H5 CONFIRMADA**

---

## 🎯 Plano de Execução de Validações

### Fase 1: SQL Queries (Camada 1 — Ingestão)
**Prioridade: ALTA**  
**Tempo estimado: 15 min**

1. Executar V1.3, V2.4, V4.1–V4.4, V5.1
2. Documentar resultados em spreadsheet
3. Classificar achados como: "OK", "FALHA", "REQUER FIX"

### Fase 2: Node.js Testes (Camada 1 — JSON Parsing)
**Prioridade: ALTA**  
**Tempo estimado: 10 min**

1. Executar V1.1, V1.2
2. Confirmar ou descartar mojibake hypothesis
3. Se confirmado mojibake: Corrigir parseAgeRange(), parseLocations(), int()

### Fase 3: Logging Adicional (Camadas 2-5 — Rastreamento)
**Prioridade: ALTA**  
**Tempo estimado: 30 min**

1. Adicionar console.log conforme V3.1–V3.5
2. Executar npm run dev
3. Abrir navegador no localhost:3000/instagram
4. Verificar console do navegador + logs do servidor
5. Rastrear dados ao longo do pipeline

### Fase 4: Code Review (Camadas 1-2)
**Prioridade: MÉDIA**  
**Tempo estimado: 20 min**

1. Revisar V1.4, V1.5, V2.2, V2.3
2. Verificar se código está usando chaves corretas ou mojibake
3. Preparar patches se necessário

---

## 📋 Resumo de Informações Pendentes por Prioridade

| Validação | Prioridade | Categoria | Status | Achados |
|-----------|-----------|-----------|--------|---------|
| V1.3 Demografia | 🔴 ALTA | Camada 1 | ✅ EXECUTADA | age_18_24_pct = 0.00 (anormal) → mojibake? |
| V4.1 Views | 🔴 ALTA | Camada 1 | ✅ EXECUTADA | **P-012 NOVA**: Triplicidade quality_scores, duplicidade format_performance |
| V5.1 Client IDs | 🔴 ALTA | Camada 1 | ✅ EXECUTADA | Ambos corretos → **H4 descartada** |
| V5.2 raw_ig_ingest | 🔴 ALTA | Camada 1 | ⏳ PENDENTE | Testar se ingestão rodou (H1) |
| V5.3 Processamento | 🔴 ALTA | Camada 1 | ⏳ PENDENTE | Testar se erros silenciosos (H3) |
| V5.4 ig_posts | 🔴 ALTA | Camada 1 | ⏳ PENDENTE | Testar se dados criados |
| V5.5 Período | 🔴 ALTA | Camada 1 | ⏳ PENDENTE | Testar se período cobre JSON (H5) |
| V1.1 Mojibake audience | 🟡 MÉDIA | Camada 1 | ⏳ PENDENTE | Confirmar chaves corrompidas |
| V1.2 Mojibake content | 🟡 MÉDIA | Camada 1 | ⏳ PENDENTE | Confirmar chaves corrompidas em Reels |
| V3.1 Repository logging | 🟡 MÉDIA | Camada 2 | ⏳ PENDENTE | Testar qual view é consultada (P-012) |
| V1.4 Code demographics | 🟢 BAIXA | Camada 1 | ⏳ PENDENTE | Revisar parseAgeRange() |
| V1.5 Code ingest | 🟢 BAIXA | Camada 1 | ⏳ PENDENTE | Revisar int() para Reels |

---

## Próximo Passo

Execute **V1.3, V4.1–V4.4, e V5.1** no Supabase SQL Editor agora e documente os resultados aqui.
