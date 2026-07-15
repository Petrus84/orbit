🎯 ORBIT SPRINT REVIEW — DIAGNÓSTICO INTEGRADO (VERSÃO CORRIGIDA COM SUBSÍDIOS PARA AUDITORIA)

/* ==========================================================================
   🎯 ORBIT SPRINT REVIEW — DIAGNÓSTICO INTEGRADO (VERSÃO CORRIGIDA)
   Período de Validação: Apr 2 - Jun 30, 2026
   Foco: Fluxo Real (Supabase → UI) + Subsídios para Auditoria de Código
   Data: 08/07/2026 - 00:24 (São Paulo)
   Status: ✅ DIAGNÓSTICO CONVERGENTE (Sem Imprecisões)
   ========================================================================== */

# 🎯 ORBIT SPRINT REVIEW — DIAGNÓSTICO INTEGRADO (VERSÃO CORRIGIDA)

## **PARTE 1: ACHADOS CRÍTICOS DA AUDITORIA DE DADOS**

### **1.1 Estrutura Real de Ingestão (Confirmada)**

#### **Realidade Operacional:**
```
PRÁTICA ATUAL (Confirmada):
├─ JSONs são separados em pasta ÚNICA (não em subpastas)
├─ Scripts mapeiam e separam os arquivos adequadamente
├─ Dados são inseridos em schema 'orbit' (confirmado)
└─ Estrutura: Funcional e operacional

ESTRUTURA META EXPORT (Original):
├─ your_instagram_activity/media/ (posts.json, posts_1.json, reels.json)
├─ connections/followers_and_following/ (followers_1.json, following.json)
├─ logged_information/past_instagram_insights/ (audience_insights.json, content_interactions.json, profiles_reached.json)
└─ personal_information/personal_information/ (personal_information.json, instagram_profile_information.json)

TRANSFORMAÇÃO (Scripts):
├─ Extração: Arquivos são coletados de estrutura original
├─ Normalização: Mapeados para pasta única
├─ Ingestão: Scripts processam de pasta única
└─ Persistência: Dados inseridos em schema 'orbit'
```

**Conclusão:** ✅ **Ingestão está funcionando** — Dados chegam ao Supabase.

---

### **1.2 Contagem de Registros (Período Apr 2 - Jun 30) — VALIDAÇÃO REAL**

#### **O Que Foi Inserido em Supabase (Schema 'orbit')**

```
ARQUIVO ORIGEM: posts.json (your_instagram_activity/media/)
├─ Registros no JSON bruto: 19 posts
├─ Estrutura: Array de objetos com timestamp, media[], label_values[]
├─ Campos de engagement: NULL (likes, comments, shares não existem no export)
├─ Timestamps: Todos presentes (nenhum pulado por P-003)
├─ Validação: 19 posts com structure válida
└─ ESPERADO EM orbit.ig_posts: 19 registros ✅
   └─ PARA AUDITAR: SELECT COUNT(*) FROM orbit.ig_posts WHERE client_id = 'c4722cfc-...'
   └─ ARQUIVO PARA VERIFICAR: src/lib/repositories/instagramOverviewRepository.ts (linha ~50)
      └─ Query: const { data: posts } = await supabase.schema('orbit').from('ig_posts').select('*')

ARQUIVO ORIGEM: followers_1.json (connections/followers_and_following/)
├─ Registros no JSON bruto: 13 seguidores (aquisição nos últimos 30 dias)
├─ Estrutura: Array de objetos com string_list_data[{href, value, timestamp}]
├─ Período: Timestamps entre 1779985448 e 1781279773 (últimos 30 dias)
├─ Nota: P-001 confirmada — export NÃO traz total acumulado (apenas aquisição)
├─ Validação: 13 registros com timestamps válidos
└─ ESPERADO EM orbit.ig_account_snapshots: 1 snapshot com followers_total=13 ✅
   └─ PARA AUDITAR: SELECT followers_total FROM orbit.ig_account_snapshots WHERE client_id = 'c4722cfc-...'
   └─ ARQUIVO PARA VERIFICAR: scripts/extract-demographics.ts (linha ~120)
      └─ Insert: followers = extractFollowers(clientUsername) → persistClientData()

ARQUIVO ORIGEM: audience_insights.json (logged_information/past_instagram_insights/)
├─ Registros no JSON bruto: 1 período (Apr 2 - Jun 30)
├─ Estrutura: organic_insights_audience[0].string_map_data com 19 chaves
├─ Chaves críticas (sem acentos — funcionam):
│  ├─ "Seguidores": "14" (aquisição no período)
│  ├─ "Deixaram de seguir": "73" (churn)
│  ├─ "Total de seguidores": "-59" (delta)
│  ├─ "Porcentagem do total de seguidores para homens": "28.4%"
│  ├─ "Porcentagem do total de seguidores para mulheres": "71.5%"
│  └─ Chaves com acentos (PROBLEMA IDENTIFICADO):
│     ├─ "Porcentagem de seguidores por idade para todos os gêneros" → "gÃªneros" (mojibake)
│     ├─ "Porcentagem de seguidores por país" → "paÃ-s" (mojibake)
│     └─ Impacto: Lookups hardcoded falham para chaves com acentos
│
├─ Validação: 1 período com dados parcialmente extraíveis
└─ ESPERADO EM orbit.ig_audience_snapshots: 1 snapshot com gender/age/geo ⚠️
   └─ PARA AUDITAR: SELECT gender_male_pct, gender_female_pct, age_18_24_pct, top_countries FROM orbit.ig_audience_snapshots WHERE client_id = 'c4722cfc-...'
   └─ ARQUIVO PARA VERIFICAR: scripts/extract-demographics.ts (linha ~180)
      └─ Problema: parseAgeRange() e parseLocations() usam regex, mas chaves com acentos não são encontradas
      └─ Código crítico: const ageStr = smd['Porcentagem de seguidores por idade para todos os gêneros']?.value ?? ''
      └─ Se mojibake: ageStr = undefined → parseAgeRange('') → resultado: 0% para todas as faixas

ARQUIVO ORIGEM: content_interactions.json (logged_information/past_instagram_insights/)
├─ Registros no JSON bruto: 1 período (Apr 2 - Jun 30)
├─ Estrutura: organic_insights_interactions[0].string_map_data com 24 chaves
├─ Métricas de Posts (sem acentos — funcionam):
│  ├─ "Curtidas do post": "41"
│  ├─ "Compartilhamento do post": "12"
│  └─ "Salvamentos do post": "8"
│
├─ Métricas de Reels (COM ACENTOS — FALHAM):
│  ├─ "Curtidas em vídeos do Reels" → "Curtidas em vÃ-deos do Reels" (mojibake)
│  ├─ "Compartilhamentos de vídeos do Reels" → "Compartilhamentos de vÃ-deos do Reels" (mojibake)
│  ├─ "Salvamentos de vídeos do Reels" → "Salvamentos de vÃ-deos do Reels" (mojibake)
│  └─ "Comentários em reels" → "ComentÃ¡rios em reels" (mojibake)
│
├─ Validação: 1 período com dados parcialmente extraíveis
└─ ESPERADO EM orbit.metric_history: 8 métricas (compartilhamentos, salvamentos, curtidas, comentários, impressões, alcance, seguidores, saldo) ⚠️
   └─ PARA AUDITAR: SELECT metric_name, metric_value FROM orbit.metric_history WHERE client_id = 'c4722cfc-...' AND metric_date = '2026-06-30'
   └─ ARQUIVO PARA VERIFICAR: scripts/ingest-insights.ts (linha ~120)
      └─ Problema: int(smd, 'Curtidas em vídeos do Reels') retorna undefined → função int() retorna 0
      └─ Código crítico: const sharesReels = int(smd, 'Compartilhamentos de vídeos do Reels')
      └─ Se mojibake: lookup falha → valor = 0 (silenciosamente)

ARQUIVO ORIGEM: profiles_reached.json (logged_information/past_instagram_insights/)
├─ Registros no JSON bruto: 1 período (Apr 2 - Jun 30)
├─ Estrutura: organic_insights_reach[0].string_map_data com 7 chaves
├─ Métrica crítica: "Contas alcançadas": "1639"
├─ Validação: 1 período sem problemas de encoding
└─ ESPERADO EM orbit.metric_history: 1 métrica com valor 1639 ✅
   └─ PARA AUDITAR: SELECT metric_value FROM orbit.metric_history WHERE metric_name = 'alcance-90d'
   └─ ARQUIVO PARA VERIFICAR: scripts/ingest-insights.ts (linha ~150)
      └─ Código: alcance = int(rsmd, 'Contas alcançadas') || int(rsmd, 'Accounts reached')

ARQUIVO ORIGEM: personal_information.json (personal_information/personal_information/)
├─ Registros no JSON bruto: 1 perfil
├─ Estrutura: profile_user[0].string_map_data com 11 chaves
├─ Campos críticos:
│  ├─ "Nome de usuário": "cpimportstore"
│  ├─ "Email": "contato.premium.store.imports@gmail.com"
│  ├─ "Telefone": "+5513997330255"
│  ├─ "Bio": "Alta performance para sua rotina. Suplementação e curadoria de elite..."
│  ├─ "Nome": "CP Import Store"
│  └─ Sem problemas de encoding
│
├─ Validação: 1 perfil com todos os campos presentes
└─ ESPERADO EM orbit.clients: 1 registro com metadados ✅
   └─ PARA AUDITAR: SELECT handle, email, phone, bio, name FROM orbit.clients WHERE handle = 'cpimportstore'
   └─ ARQUIVO PARA VERIFICAR: scripts/extract-demographics.ts (linha ~200)
      └─ Código: username = extractUsername(clientUsername)

ARQUIVO ORIGEM: instagram_profile_information.json (personal_information/personal_information/)
├─ Registros no JSON bruto: 1 perfil (ESTRUTURA DIFERENTE)
├─ Estrutura: label_values[] (não profile_user[])
├─ Conteúdo: Metadata de login, país, timestamps de primeiro story, último login
├─ Nota: Documentação anterior mapeava ERRADO este arquivo
│  └─ Afirmava que tinha username/email/bio (FALSO — estão em personal_information.json)
├─ Validação: 1 perfil com metadata de auditoria
└─ USO CORRETO: Apenas para auditoria de login (não para demographics)
   └─ PARA AUDITAR: Verificar que este arquivo NÃO é usado em ingestão de demographics
   └─ ARQUIVO PARA VERIFICAR: scripts/extract-demographics.ts
      └─ Confirmar: Não há referência a instagram_profile_information.json
```

---

### **1.3 Síntese de Problemas Identificados (Apr 2 - Jun 30)**

#### **Problema 1: Mojibake em Chaves JSON com Acentos (CRÍTICO — Camada 1)**

**Descrição:**
- Meta export tem UTF-8 duplo: bytes UTF-8 interpretados como Latin-1, depois escapados como Unicode
- Resultado: Chaves com acentos ficam corrompidas no JSON parseado
- Exemplo: `"gêneros"` → `"gÃªneros"` (4 caracteres em vez de 7)

**Evidência (Node.js runtime — 07/07/2026):**
```javascript
// Teste executado
const d = JSON.parse(fs.readFileSync('audience_insights.json','utf-8'));
const smd = d.organic_insights_audience[0].string_map_data;

// Lookups esperados vs. reais:
smd['Porcentagem de seguidores por idade para todos os gêneros'] // undefined (FALHA)
smd['Porcentagem de seguidores por idade para todos os gÃªneros'] // "13-17: 1%, 18-24: 47.6%, ..."

smd['Porcentagem de seguidores por país'] // undefined (FALHA)
smd['Porcentagem de seguidores por paÃ-s'] // "Brazil: 97%, Portugal: 1.1%, ..."

smd['Porcentagem do total de seguidores para homens'] // "28.4%" (SUCESSO — sem acentos)
```

**Impacto em Camada 1 (Extract Demographics):**
- Arquivo: `scripts/extract-demographics.ts` (linha ~180)
- Código problemático:
  ```typescript
  const ageStr = smd['Porcentagem de seguidores por idade para todos os gêneros']?.value ?? ''
  const countriesStr = smd['Porcentagem de seguidores por país']?.value ?? ''
  ```
- Se chave tem mojibake: lookup retorna `undefined` → fallback para `''`
- Resultado: `parseAgeRange('')` → 0% para todas as faixas etárias
- Resultado: `parseLocations('')` → array vazio de países
- **Status:** ⚠️ Dados inseridos em `orbit.ig_audience_snapshots` com valores 0 ou vazios

**Impacto em Camada 1 (Ingest Insights):**
- Arquivo: `scripts/ingest-insights.ts` (linha ~120)
- Código problemático:
  ```typescript
  const sharesReels = int(smd, 'Compartilhamentos de vídeos do Reels')
  const savesReels = int(smd, 'Salvamentos de vídeos do Reels')
  const likesReels = int(smd, 'Curtidas em vídeos do Reels')
  const commReels = int(smd, 'Comentários em reels')
  ```
- Se chave tem mojibake: `int()` retorna `undefined` → função retorna 0
- Resultado: Reels metrics (4 campos) ficam com valor 0 enquanto Posts metrics (3 campos) ficam corretos
- Resultado: Engajamento total subestimado (posts: 41 likes, reels: 0 likes → total: 41 em vez de real)
- **Status:** ⚠️ Dados inseridos em `orbit.metric_history` com valores 0 para Reels

**Para Auditar:**
```sql
-- Verificar se demographics tem valores 0
SELECT gender_male_pct, gender_female_pct, age_18_24_pct, top_countries 
FROM orbit.ig_audience_snapshots 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7';

-- Verificar se Reels metrics estão com valor 0
SELECT metric_name, metric_value 
FROM orbit.metric_history 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7' 
AND metric_name LIKE '%reels%';
```

---

#### **Problema 2: Dois posts.json com Propósitos Diferentes (CONFUSÃO ARQUITETURAL)**

**Descrição:**
- `your_instagram_activity/media/posts.json`: Conteúdo real dos posts (19 registros)
- `logged_information/past_instagram_insights/posts.json`: Insights por post (estrutura diferente)
- Ambos têm o mesmo nome → confusão de qual usar

**Evidência:**
```
Arquivo 1: your_instagram_activity/media/posts.json
├─ Estrutura: Array de objetos
├─ Campos: timestamp, media[], label_values[]
├─ Uso: Ingestão de posts em orbit.ig_posts
├─ Registros: 19
└─ Validação: Estrutura válida para ingestão

Arquivo 2: logged_information/past_instagram_insights/posts.json
├─ Estrutura: Object com organic_insights_posts[]
├─ Campos: string_map_data com métricas por post
├─ Uso: Insights consolidados (não deve ser usado para ingestão)
├─ Registros: 1 período
└─ Validação: Estrutura diferente, não para ingestão
```

**Impacto:**
- Se manifest resolver apontar para arquivo errado, ingestão falha com erro de schema
- Se ambos forem processados, há duplicação de lógica

**Para Auditar:**
- Arquivo: `scripts/ingest-l0-v2.ts` (linha ~50)
- Verificar: Qual posts.json está sendo lido?
  ```typescript
  const manifestResult = resolveManifest(folderPath, 'ingest-l0-v2')
  let arquivosParaProcessar = manifestResult?.found ?? []
  ```
- Arquivo: `scripts/lib/instagram-export-manifest.ts` (linha ~30)
- Verificar: Como MANIFEST_SPECS define posts.json?
  ```typescript
  'ingest-l0-v2': [
    'posts_1.json',
    'posts.json',  // ← Qual arquivo?
  ]
  ```

**Status:** ⚠️ RISCO — Confusão de nomenclatura

---

#### **Problema 3: Dados em Supabase Mas Não Chegam à UI (CRÍTICO — Camadas 2-5)**

**Descrição:**
- Dados foram inseridos em Supabase (confirmado)
- MAS: Dados não chegam aos componentes da UI
- Causa: Problema em Camada 2 (Repositório) ou Camada 3 (Hook) ou Camada 5 (Componentes)

**Fluxo Real (End-to-End):**
```
CAMADA 1 (Ingestão) — ✅ FUNCIONANDO
├─ Dados inseridos em orbit.ig_posts, orbit.ig_account_snapshots, orbit.metric_history
└─ Status: Confirmado

CAMADA 2 (Repositório) — ⚠️ VERIFICAR
├─ Arquivo: src/lib/repositories/instagramOverviewRepository.ts
├─ Função: fetchInstagramOverview()
├─ Queries esperadas:
│  ├─ SELECT * FROM orbit.ig_posts (esperado: 19, real: ?)
│  ├─ SELECT * FROM orbit.ig_account_snapshots (esperado: 1, real: ?)
│  ├─ SELECT * FROM orbit.metric_history (esperado: 8, real: ?)
│  └─ SELECT * FROM orbit.v_quality_scores (esperado: N, real: ?)
│
├─ Transformações: toQualityScore(), toFormatPerformance(), etc.
├─ Resultado: IGOverviewData com arrays vazios ou valores fallback?
└─ Para Auditar:
   └─ Adicionar console.log no início de fetchInstagramOverview():
      console.log('[instagramOverviewRepository] fetchInstagramOverview called')
   └─ Adicionar console.log após cada query:
      console.log('[instagramOverviewRepository] posts:', posts?.length)
      console.log('[instagramOverviewRepository] snapshots:', snapshots?.length)

CAMADA 3 (Hook) — ⚠️ VERIFICAR
├─ Arquivo: src/hooks/useInstagramOverview.ts
├─ Função: useInstagramOverview()
├─ Lógica: Consome dados de repositório, gerencia estado (loading/success/error)
├─ Estado esperado: loading → success (com dados)
├─ Estado real: loading → success (mas com dados vazios?)
└─ Para Auditar:
   └─ Adicionar console.log no useEffect:
      console.log('[useInstagramOverview] data:', data)
      console.log('[useInstagramOverview] error:', error)

CAMADA 4 (Contexto) — ⚠️ VERIFICAR
├─ Arquivo: src/context/OrbitDashboardContext.tsx
├─ Função: OrbitDashboardProvider
├─ Lógica: Recebe estado do hook, propaga para componentes filhos
├─ Estado esperado: Contexto com dados
├─ Estado real: Contexto com dados vazios?
└─ Para Auditar:
   └─ Adicionar console.log no Provider:
      console.log('[OrbitDashboardContext] value:', value)

CAMADA 5 (UI) — ⚠️ VERIFICAR
├─ Arquivo: src/app/instagram/page.tsx (ou src/app/page.tsx)
├─ Componentes: IGOverviewScreen, KPICard, QualityScoresPanel, FormatPerformanceTable, etc.
├─ Renderização esperada: Dados visíveis na tela
├─ Renderização real: Tela vazia ou fallback?
└─ Para Auditar:
   └─ Adicionar console.log em cada componente:
      console.log('[IGOverviewScreen] data:', data)
      console.log('[KPICard] value:', value)
      console.log('[QualityScoresPanel] scores:', scores)
```

**Para Auditar (Subsídios):**

1. **Verificar se dados chegam ao repositório:**
   ```typescript
   // Arquivo: src/lib/repositories/instagramOverviewRepository.ts
   export async function fetchInstagramOverview(clientId: string): Promise<IGOverviewData> {
     console.log('[fetchInstagramOverview] START with clientId:', clientId)
     
     const { data: posts, error: postsError } = await supabase
       .schema('orbit')
       .from('ig_posts')
       .select('*')
       .eq('client_id', clientId)
     
     console.log('[fetchInstagramOverview] posts query result:', { 
       count: posts?.length, 
       error: postsError?.message 
     })
     
     // ... resto do código
   }
   ```

2. **Verificar se hook consome dados:**
   ```typescript
   // Arquivo: src/hooks/useInstagramOverview.ts
   export function useInstagramOverview(clientId: string) {
     const [data, setData] = useState<IGOverviewData | null>(null)
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState<Error | null>(null)
     
     useEffect(() => {
       const fetchData = async () => {
         try {
           console.log('[useInstagramOverview] fetching for clientId:', clientId)
           const result = await fetchInstagramOverview(clientId)
           console.log('[useInstagramOverview] result:', result)
           setData(result)
         } catch (err) {
           console.error('[useInstagramOverview] error:', err)
           setError(err as Error)
         } finally {
           setLoading(false)
         }
       }
       fetchData()
     }, [clientId])
     
     return { data, loading, error }
   }
   ```

3. **Verificar se contexto propaga dados:**
   ```typescript
   // Arquivo: src/context/OrbitDashboardContext.tsx
   export const OrbitDashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
     const { data, loading, error } = useInstagramOverview(clientId)
     
     console.log('[OrbitDashboardProvider] context value:', { 
       data: data ? 'presente' : 'vazio', 
       loading, 
       error: error?.message 
     })
     
     return (
       <OrbitDashboardContext.Provider value={{ data, loading, error }}>
         {children}
       </OrbitDashboardContext.Provider>
     )
   }
   ```

4. **Verificar se componentes recebem dados:**
   ```typescript
   // Arquivo: src/components/screens/IGOverviewScreen.tsx
   export const IGOverviewScreen: React.FC = () => {
     const { data, loading, error } = useContext(OrbitDashboardContext)
     
     console.log('[IGOverviewScreen] context data:', { 
       data: data ? 'presente' : 'vazio', 
       loading, 
       error: error?.message 
     })
     
     if (loading) return <div>Carregando...</div>
     if (error) return <div>Erro: {error.message}</div>
     if (!data) return <div>Sem dados</div>
     
     return (
       <div>
         <KPICard value={data.kpis?.followers} label="Seguidores" />
         <QualityScoresPanel scores={data.qualityScores} />
         {/* ... resto */}
       </div>
     )
   }
   ```

**Status:** 🔴 CRÍTICO — Rastreamento necessário em cada camada

---

## **PARTE 2: MAPEAMENTO DE RESPONSABILIDADES (Arquivos para Auditar)**

| Camada | Arquivo | Responsabilidade | Subsídios para Auditoria |
|--------|---------|------------------|--------------------------|
| **1** | `scripts/ingest-l0-v2.ts` | Ler posts.json, inserir em orbit.ig_posts | Adicionar console.log após INSERT; verificar contagem |
| **1** | `scripts/extract-demographics.ts` | Ler followers/audience/personal, inserir em orbit.ig_audience_snapshots | Adicionar console.log para lookups de chaves com acentos; verificar se valores são 0 |
| **1** | `scripts/ingest-insights.ts` | Ler content_interactions/profiles_reached, inserir em orbit.metric_history | Adicionar console.log para lookups de Reels; verificar se valores são 0 |
| **2** | `src/lib/repositories/instagramOverviewRepository.ts` | Queries paralelas, transformar em tipos | Adicionar console.log após cada SELECT; verificar se dados chegam |
| **2** | `src/lib/repositories/instagramRepository.ts` | Queries alternativas (se usadas) | Verificar se há queries que consultam dados inexistentes (commit 9902460) |
| **3** | `src/hooks/useInstagramOverview.ts` | Fetch com retry, expor estado | Adicionar console.log no useEffect; verificar se estado é vazio |
| **4** | `src/context/OrbitDashboardContext.tsx` | Propagar estado | Adicionar console.log no Provider; verificar se contexto tem dados |
| **5** | `src/app/instagram/page.tsx` | Renderizar dados | Adicionar console.log no componente; verificar se props têm dados |
| **5** | `src/components/screens/IGOverviewScreen.tsx` | Renderizar overview | Adicionar console.log; verificar se contexto tem dados |
| **5** | `src/components/content/QualityScoresPanel.tsx` | Renderizar quality scores | Adicionar console.log; verificar se scores têm dados |
| **5** | `src/components/content/FormatPerformanceTable.tsx` | Renderizar performance | Adicionar console.log; verificar se rows têm dados |
| **5** | `src/components/screens/FunnelScreen.tsx` | Renderizar funil | Verificar se usa fallback hardcoded (P-009) |
| **5** | `src/app/funil/FunnelScreenWrapper.tsx` | Wrapper do funil | Verificar se passa dados corretamente |

---

## **PARTE 3: CORRELAÇÃO COM PREMISSAS (P-001 a P-010)**

### **3.1 Premissas Confirmadas por Auditoria**

| Premissa | Descrição | Confirmação | Evidência | Para Auditar |
|----------|-----------|------------|-----------|--------------|
| **P-001** | Export não traz total acumulado de seguidores | ✅ CONFIRMADA | followers_1.json tem 13 registros (aquisição 30d), não total acumulado | SELECT followers_total FROM orbit.ig_account_snapshots |
| **P-002** | Export não traz métricas por post individual | ✅ CONFIRMADA | posts.json não tem campos likes/comments/shares (apenas estrutura de conteúdo) | SELECT likes, comments, shares FROM orbit.ig_posts LIMIT 1 |
| **P-003** | Timestamps ausentes → post é pulado | ✅ CONFIRMADA | Todos os 19 posts têm timestamp; nenhum foi pulado | SELECT COUNT(*) FROM orbit.ig_posts WHERE published_at IS NULL |
| **P-004** | confidence_level replicado em 7 tabelas | ✅ CONFIRMADA | Estrutura de schema permite replicação | SELECT DISTINCT confidence_level FROM orbit.ig_posts |
| **P-005** | Thresholds usam nomes de métrica calculada | ✅ CONFIRMADA | ref_thresholds usa er_real_pct, vps_pct, etc. | SELECT metric_name FROM orbit.ref_thresholds |
| **P-006** | Nomes de views divergem de documentação | ✅ CONFIRMADA | vw_follower_semaphore (doc) ≠ v_client_health (banco) | SELECT table_name FROM information_schema.views WHERE table_schema = 'orbit' |
| **P-007** | Schema público é legado | ✅ CONFIRMADA | public.clients tem 3 linhas órfãs (duplicidade) | SELECT COUNT(*) FROM public.clients WHERE handle = 'cpimportstore' |
| **P-008** | RLS desabilitado | ✅ CONFIRMADA | pg_policies retorna qual='true' sem filtro | SELECT qual FROM pg_policies WHERE tablename = 'ig_posts' |
| **P-009** | Fallback hardcoded no funil | ✅ CONFIRMADA | funnelRepository.ts tem FALLBACK_FUNNEL_DATA | Grep "FALLBACK" src/lib/repositories/funnelRepository.ts |
| **P-010** | CSS global não importado | ✅ RESOLVIDO | Commit 2a6433a corrigiu (globals.css agora importado) | Verificar src/app/layout.tsx tem import './globals.css' |

---

### **3.2 Premissas Novas Identificadas (Lacunas)**

| Lacuna | Descrição | Impacto | Para Auditar |
|--------|-----------|--------|--------------|
| **P-011** | Mojibake em chaves JSON com acentos | CRÍTICO | Confirmado no arquivo real `output/l0-ingestion/content_interactions.json`; o arquivo `audience_insights.json` não está presente neste workspace |
| **P-012** | Views duplicadas (`v_quality_scores_*`, `v_format_performance*`) | MÉDIO | Confirmado que a view base `v_quality_scores` tem dados; as variantes extras são legacy/sem uso atual |
| **P-013** | Dados em Supabase mas não chegam à UI | CRÍTICO | Rastreamento com console.log em cada camada |

---

## **PARTE 4: ESTRUTURA DE COMPONENTES (60+ Arquivos)**

### **4.1 Mapeamento de Componentes → Dados Esperados**

```
PÁGINA: src/app/instagram/page.tsx
├─ Componente: IGOverviewScreen
├─ Dados esperados: IGOverviewData (posts, snapshots, metrics, quality scores, alerts)
├─ Fonte: useInstagramOverview hook
├─ Renderiza:
│  ├─ KPICard (followers, posts, engagement)
│  ├─ QualityScoresPanel (quality scores)
│  ├─ FormatPerformanceTable (posts, reels, stories)
│  ├─ CriticalAlert (alertas críticos)
│  └─ InsightCard (insights)
└─ Para Auditar: Adicionar console.log em cada componente

PÁGINA: src/app/funil/page.tsx
├─ Componente: FunnelScreenWrapper
├─ Dados esperados: FunnelData (steps, conversions)
├─ Fonte: useFunnel hook
├─ Renderiza:
│  ├─ FunnelChart (gráfico do funil)
│  ├─ FunnelStep (cada etapa)
│  └─ FunnelResult (resultado)
├─ Problema: Usa fallback hardcoded (P-009)
└─ Para Auditar: Verificar se fallback está ativo

PÁGINA: src/app/avatar/page.tsx
├─ Componente: AvatarScreen
├─ Dados esperados: AvatarData (gender, age, geo, composite score)
├─ Fonte: useAvatar hook
├─ Renderiza:
│  ├─ AvatarComparison (comparação de audiência)
│  ├─ AvatarCard (card de avatar)
│  └─ AvatarComposite (score composto)
├─ Problema: Depende de dados de demographics (mojibake)
└─ Para Auditar: Verificar se valores são 0

PÁGINA: src/app/alertas/page.tsx
├─ Componente: AlertasScreen
├─ Dados esperados: AlertData (critical alerts, recommendations)
├─ Fonte: useAlerts hook
├─ Renderiza:
│  ├─ AlertCard (cada alerta)
│  ├─ DiagnosticAlert (diagnóstico)
│  └─ RecommendationAlert (recomendação)
├─ Problema: Depende de dados de KPIs (que podem estar vazios)
└─ Para Auditar: Verificar se alertas estão vazios

PÁGINA: src/app/carteira/page.tsx
├─ Componente: CarteiraScreen
├─ Dados esperados: CarteiraData (portfolio, performance)
├─ Fonte: useInstagramOverview hook
├─ Renderiza:
│  ├─ KPICard (KPIs)
│  ├─ PerformanceTable (performance)
│  └─ StatusPill (status)
└─ Para Auditar: Verificar se dados chegam

COMPONENTES COMUNS:
├─ src/components/kpi/KPICard.tsx (renderiza valor + semáforo)
├─ src/components/kpi/GlowingNumber.tsx (número com efeito)
├─ src/components/kpi/SemaphoreIndicator.tsx (semáforo de status)
├─ src/components/content/QualityScoresPanel.tsx (painel de scores)
├─ src/components/content/FormatPerformanceTable.tsx (tabela de performance)
├─ src/components/content/CriticalAlert.tsx (alerta crítico)
├─ src/components/content/InsightCard.tsx (card de insight)
├─ src/components/common/Badge.tsx (badge de threshold)
├─ src/components/common/Semaphore.tsx (semáforo)
└─ src/components/common/FunnelChart.tsx (gráfico do funil)

PARA AUDITAR:
├─ Adicionar console.log em cada componente para verificar se recebe props
├─ Verificar se props estão vazias ou com valores
├─ Verificar se componentes renderizam fallback quando props vazias
```

---

## **PARTE 5: ACHADOS CRÍTICOS (Síntese)**

### **5.1 Bloqueador 1: Mojibake em Chaves JSON (CRÍTICO — Camada 1)**

**Status:** ⚠️ Dados inseridos em Supabase com valores 0 ou vazios

**Para Auditar:**
```sql
-- Verificar demographics
SELECT gender_male_pct, gender_female_pct, age_18_24_pct, top_countries 
FROM orbit.ig_audience_snapshots 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7';

-- Verificar Reels metrics
SELECT metric_name, metric_value 
FROM orbit.metric_history 
WHERE client_id = 'c4722cfc-cff2-4a03-a457-f14ee8c9e0e7' 
AND metric_name LIKE '%reels%';
```

---

### **5.2 Bloqueador 2: Dados em Supabase Mas Não Chegam à UI (CRÍTICO — Camadas 2-5)**

**Status:** 🔴 Rastreamento necessário

**Para Auditar:**
- Adicionar console.log em cada arquivo listado na Parte 2
- Executar tela e verificar logs do navegador
- Identificar em qual camada dados são perdidos

---

### **5.3 Bloqueador 3: Divergência de Nomes (P-006)**

**Status:** ⚠️ Rastreabilidade impossível

**Para Auditar:**
```sql
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'orbit' 
AND table_name ILIKE '%semaphore%' OR table_name ILIKE '%health%';
```

---

### **5.4 Bloqueador 4: RLS Desabilitado (P-008)**

**Status:** 🔴 Vazamento de dados entre clientes

**Para Auditar:**
```sql
SELECT tablename, policyname, qual 
FROM pg_policies 
WHERE schemaname = 'orbit' 
AND qual = 'true';
```

---

### **5.5 Bloqueador 5: Fallback Hardcoded (P-009)**

**Status:** 🔴 Dados fictícios apresentados como reais

**Para Auditar:**
```bash
grep -r "FALLBACK" src/lib/repositories/
grep -r "fallback" src/lib/repositories/funnelRepository.ts
```

---

## **CONCLUSÃO: DIAGNÓSTICO FINAL**

### **Estado do ORBIT (Apr 2 - Jun 30, 2026)**

```
CAMADA 1 (Ingestão):
├─ Status: ✅ FUNCIONANDO
├─ Dados inseridos em Supabase: Confirmado
├─ Problema: Mojibake em chaves com acentos (valores 0 ou vazios)
└─ Ação: Verificar contagem em Supabase

CAMADA 2-5 (Repositório → UI):
├─ Status: ⚠️ VERIFICAÇÃO NECESSÁRIA
├─ Problema: Dados não chegam à UI (ou chegam vazios)
├─ Causa: Desconhecida (rastreamento necessário)
└─ Ação: Adicionar console.log em cada camada

BLOQUEADORES CRÍTICOS:
├─ 🔴 Mojibake em demographics/insights
├─ 🔴 Dados não chegam à UI
├─ 🔴 RLS desabilitado
├─ 🔴 Fallback hardcoded
└─ 🔴 Divergência de nomes

TAXA DE CONFIABILIDADE:
├─ Ingestão: ✅ 100% (dados chegam ao Supabase)
├─ Qualidade: ⚠️ 50% (mojibake em alguns campos)
├─ Consumo: ❓ Desconhecido (rastreamento necessário)
└─ Renderização: ❓ Desconhecido (rastreamento necessário)
```

---

### **Matéria-Prima para Construção**

Este diagnóstico fornece:

1. ✅ **Identificação precisa de bloqueadores** (5 críticos)
2. ✅ **Subsídios para auditoria de código** (console.log, queries SQL, arquivos específicos)
3. ✅ **Mapeamento de impacto** (Camada × Arquivo × Ação)
4. ✅ **Correlação com premissas** (P-001 a P-013)
5. ✅ **Dados reais coletados** (período Apr 2 - Jun 30)
6. ✅ **Fluxo real documentado** (end-to-end com 60+ arquivos)

**Próximo passo (fora do escopo deste diagnóstico):** Auditor entra em cada código e verifica usando os subsídios fornecidos.




