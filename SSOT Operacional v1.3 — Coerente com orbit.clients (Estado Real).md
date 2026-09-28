# ✅ SSOT Operacional v1.3 — Pipeline de Benchmarking & Content Contract (ORBIT)
**Data:** 25 de setembro de 2026  
**Base disciplinadora:** *Estado real em `orbit.clients`* + *regras de tier/células do código de produção*  
**Objetivo:** eliminar contradições entre documentação e banco, garantindo que “avanço” signifique apenas execução/processamento e nunca reinterpretação taxonômica sem controle.

---

## 0) Autoridades (SSOT = fonte única por tipo de dúvida)

- **Taxonomia ideal (framework canônico):** `framework-arquetipos-monetizacao-social-media.md`
- **Catálogo operacional (o que está “de verdade” no banco):** `orbit.clients` (*via colunas `segment`, `benchmark_category`, `is_benchmark`*)
- **Tier e compatibilidade (o que o sistema aceita para estimar/calibrar):** `tiers.ts` + `compute.ts` (SSOT ativo do código)
- **Content Contract (quais KPIs existem e como confiar):** `cobertura_kpis.json` + `cobertura_kpis_limpo.json`

**Regra:** Se um item conflitar, prevalece: **banco (catálogo operacional)** para o que existe em produção; **código (tier/compatibilidade)** para o que é estimável; **framework** para o que é conceitualmente “uma categoria”.

---

## 1) Pipeline (o que este documento garante)

**Pipeline em 3 etapas lógicas:**
1. **Etapa 1 — Profile Scraping:** valida perfis e gera/valida `clients.segment` e `clients.is_benchmark` (e, quando aplicável, `benchmark_category` via mapeamento/backfill).
2. **Etapa 2 — Post Scraping:** valida posts **apenas** se `client_handle` pertence ao conjunto de handles validados na Etapa 1 do mesmo lote.
3. **Thresholds e Content Contract:**
   - Calcula thresholds por célula (setor×tier) em `orbit.ref_thresholds`
   - `fn_classify_metric` usa esses thresholds para alimentar os KPIs do Content Contract

**Condição crítica de qualidade (Etapa 2):** se o scraper não retorna `shares/saves`, o pipeline **não inventa** ER completo — ER completo fica `null` e a métrica parcial é tratada como *parcial*, com alerta no catálogo.

---

## 2) Estado real do catálogo operacional (`orbit.clients`) — verificado

Com base nas queries do seu banco, o estado real (lote consolidado atual) é:

### 2.1 Colunas relevantes
- `segment` (nomenclatura legada/origem do scraper)
- `benchmark_category` (nome longo, eixo operacional)
- `is_benchmark` (boolean: referência/mercado vs cliente real)
- **`tier_porte`: NÃO EXISTE** como coluna persistida em `orbit.clients` (tier é derivado/normalizado por código)

### 2.2 Distribuição de `benchmark_category` (contas em banco)
**Valores e contagens (benchmark_category):**
- `infoprodutor_autoridade_personal` — 30
- `monetizacao_nativa_plataforma` — 18
- `patrocinio_publicidade_marca` — 16
- `servico_consultoria_profissional` — 15
- `comercio_direto_ecommerce_social` — 10  
**Total verificado:** 89 contas com `benchmark_category` preenchido.

### 2.3 Distribuição de `is_benchmark`
- `is_benchmark = true` — 89
- `is_benchmark = false` — 5  
**Total:** 94 contas

### 2.4 Mapeamento real `segment -> benchmark_category` (presente no banco)
- `1_ecommerce_direto` → `comercio_direto_ecommerce_social` (5)
- `2_comissionamento_afiliados` → `comercio_direto_ecommerce_social` (4)
- `3_infoprodutor` → `infoprodutor_autoridade_personal` (9)
- `4_servico_consultoria` → `servico_consultoria_profissional` (15)
- `5_patrocinio_publicidade` → `patrocinio_publicidade_marca` (16)
- `6_membership_comunidade` → `infoprodutor_autoridade_personal` (9)
- `7_monetizacao_nativa` → `monetizacao_nativa_plataforma` (18)
- `8_autoridade_b2b` → `infoprodutor_autoridade_personal` (12)
- `E-commerce` → `comercio_direto_ecommerce_social` (1)
- `segment = NULL` → `benchmark_category = NULL` (5)

**Implicação:** as categorias “canônicas” do framework podem existir como *origens* (`segment`) mesmo quando *não operam* como eixos separados no ciclo atual.

---

## 3) Regra disciplinadora: framework vs operação (onde estava a confusão)

Para evitar “misturar avanço e bugalhos”, esta regra é a correção definitiva:

### 3.1 Categoria canônica ≠ categoria operacional no ciclo
- **Framework** define categorias canônicas (ex.: comissionamento, membership).
- **Operação (ciclo atual)** define as células de benchmark por `benchmark_category` efetivamente preenchido.

### 3.2 Critério operacional (SSOT v1.3)
Uma categoria do framework entra como **eixo operacional de benchmark** neste ciclo **somente se**:
- existir em `orbit.clients.benchmark_category` como valor não-NULL **e**
- ter linhas para estimar/calibrar via `orbit.ref_thresholds` e `fn_classify_metric`.

Se o mapeamento atual absorve `segment` de uma categoria canônica para outra `benchmark_category`, então:
- a categoria canônica fica **“estacionada/absorvida no banco”**,
- e **não** deve ser descrita como “categoria ativa de benchmark” no ciclo.

---

 ## 4) Categorias: status operacional do ciclo atual (derivado do banco)

Com o critério operacional acima, o ciclo atual tem **5 categorias ativas em `benchmark_category`**:

1. `comercio_direto_ecommerce_social`
2. `infoprodutor_autoridade_personal`
3. `monetizacao_nativa_plataforma`
4. `patrocinio_publicidade_marca`
5. `servico_consultoria_profissional`

### 4.1 O que ficou fora como eixo separado (por absorção/no ciclo)
As categorias canônicas relacionadas a:
- `membership_assinatura_comunidade`
- `comissionamento_afiliados`

**não operam como eixo separado no ciclo atual** porque:
- `segment=6_membership_comunidade` mapeia para `infoprodutor_autoridade_personal`
- `segment=2_comissionamento_afiliados` mapeia para `comercio_direto_ecommerce_social`

**Resultado:** tratar como “pendências de threshold” só faz sentido se vocês decidirem explicitamente alterar o mapeamento e/ou reintroduzir essas categorias como `benchmark_category` próprias.

---

 ## 5) Tier (regra operacional e ausência de regressão)

- Tier por seguidores é determinado pelo SSOT do código (fonte única: `tiers.ts`).
- **`tier_porte` não persiste em `orbit.clients`**; portanto não use `tier_porte` como “estado do banco”.
- Qualquer discussão sobre cortes (nano/micro/mid/macro/mega) deve referenciar **o array/cortes do `tiers.ts`** e o comportamento de recusa (`checkTierCompatibility`) em `compute.ts`.

---

## 6) Taxonomia de célula (o que o benchmark realmente usa)

- Células oficiais de benchmark são construídas por **(setor/tipo de categoria operacional × tier)**
- **Nicho não é eixo de célula**; ele pode existir como metadado descritivo, mas não deve ser usado para multiplicar a grade de benchmark.

**Regra:** não “setor×nicho×tier”.

---

## 7) Padrões estatísticos (sem mudanças nesta versão)
- usar **mediana** como estatística central
- outliers por regra IQR
- confiança por tamanho de célula:
  - n < 3: insuficiente
  - 3–7: leve
  - ≥ 8: robusta

---

## 8) Content Contract: integridade das métricas parciais

Se o scraper não retorna shares/saves:
- ER completo permanece `null`
- ER parcial deve ter **campo/flag de data_source** (ou equivalente no modelo) para não ser interpretado como engagement_rate completo.

**Regra:** nenhuma métrica parcial pode entrar no slot de KPI que o produto trata como “engagement completo”.

---

## 9) Estado do lote mais recente (template para preencher)

Use o template abaixo para cada novo lote, evitando “mistura de sessão”:

- **Sessão / lote:** `YYYYMMDD_*`
- **Etapa 1:**
  - processadas: X
  - validadas: Y
  - falhas (por tipo): Z
- **Etapa 2:**
  - posts processados: X2
  - validados: Y2
  - falhas (por tipo): Z2
- **Cobertura por `benchmark_category`:** percentuais e contagens
- **Métricas parciais:** ER parcial? ER completo null? (sim/não)

---

 ## 10) Backfills e decisões (lista curta e operacional)

Decisões que exigem PO/Tech Lead:

1. **Backfill/ajuste de mapeamento**:
   - Se decidirem que `membership_assinatura_comunidade` e/ou `comissionamento_afiliados` devem voltar a ser eixo operacional,
     então é preciso alterar o mapping que hoje absorve `segment` para outras `benchmark_category`.
   - Caso contrário: mantenha a absorção atual e trate essas categorias como “não-eixo neste ciclo”.

2. **Recalcular `benchmark_cells.json`:**
   - necessário quando o conjunto de valores operacionais em `orbit.clients.benchmark_category` mudar
   - ou quando a base pós-scrape/volume mudar significativamente (ex.: novos posts entram).

---

## 11) Checkpoint de coerência (anti-regressão documental)
Antes de publicar v1.x+1:

1. Conferir que `benchmark_category` e `is_benchmark` usados no documento batem com queries reais.
2. Garantir que a narrativa não diz “categoria X está ativa no ciclo” se ela foi absorvida no mapping (pela coluna `benchmark_category`).
3. Garantir que “benchmark recalculado” significa **por mudança de dados/catálogo operacional**, não por reinterpretação de taxonomia.

---

## 12) Resultado: o que este SSOT corrige de forma definitiva

- Remove a ambiguidade “avanço vs regressão” ao separar:
  - **categoria canônica (framework)**
  - **categoria operacional (banco via `benchmark_category`)**
- Explicita por que membership/comissionamento **não são eixos operacionais** no ciclo atual (porque o mapeamento real absorve).
- Define que a reconstrução de células só ocorre por mudança real do catálogo operacional/volume — não por “estado narrativo”.

---

## 13) Assinatura
- **PO:** _________________________  Data: _________
- **Tech Lead:** __________________ Data: _________
- **Analista:** ___________________  Data: _________