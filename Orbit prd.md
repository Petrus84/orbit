# ORBIT — Documento de Requisitos de Produto (PRD)

**Versão:** 1.2 · **Data:** 03/09/2026 (última atualização de estado: 04/09/2026) · **Status:** Vivo — Sincronizado pós-commit `550093b`

---

## 1. Visão — sistema de gestão em camadas, não dashboard único

* **Mapa de 5 Camadas**: Visão arquitetural estruturada em cinco níveis operacionais:
1. *Negócio & Carteira de Clientes*

2. *Conteúdo Orgânico (Instagram)*

3. *Meta Ads*

4. *Google Ads & Analytics*

5. *Decisão Criativa & Inteligência Executiva*



* **Diferencial Competitivo**: Cada camada responde a uma pergunta de decisão específica. O Orbit evita o erro do mercado de empilhar métricas isoladas em tela única sem contexto, sem link direto e sem indicação clara de ação.


* **Escopo Construído até Aqui**:
* **Camada 1 (Carteira & Alertas Críticos)**: Implementada, testada e comitada no repositório (`550093b`).


* **Camada 2 (Conteúdo Orgânico — Instagram)**: Telas de Overview, Por Post e Audiência totalmente especificadas e em produção.


* **Camadas 3, 4 e 5**: Definidas no vocabulário do mapa de visão, sem componentes de interface nesta versão.





---

## 2. Requisitos por Tela, com Decisões de Produto Tomadas

### 2.1 Carteira & Alertas Críticos (`/carteira` e `/alertas`)

* **Gestão de Saúde da Carteira**: Injeção em tempo real dos hooks `useClients` e `useAlerts`, substituindo estruturas estáticas de mock.


* **Grade Responsiva**: Layout ajustado em grid Tailwind (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) para exibição contínua dos `ClientCard` e `AlertCard` em largura total (`width: 100%`).


* **Motor de Alertas Dinâmicos**: Exibição dos 14 campos expostos pela view `orbit.v_alerts`, detalhando métrica afetada, valor atual vs. limiar, causa provável, ação sugerida, nível de confiança e urgência semafórica.



### 2.2 Overview (`/overview`)

* **KPIs Globais**: Saldo de 90 dias, total de seguidores e alcance acumulado via `ig_account_snapshots`.


* **Quality Scores**: Mapeamento de ER Real, VPS, Score Utilidade e Score Polêmica.


* **Regra de Transparência de Thresholds**: Segmentos ou métricas sem régua calibrada exibem explicitamente "Sem threshold definido", proibindo a fabricação de valores fakes em tela.


* **Calibração de Répteis & Tiers**: Homologação do script `calibrate_thresholds_v2.py` corrigindo as métricas reais do schema (`utility_score_pct`, `polemic_score_pct`, `er_real_pct`, `vps_pct`) com direção `higher_is_better` para VPS. Payload de 35 regras (`ref_thresholds_ready_final.json`) validado para inserção na base.



### 2.3 Por Post (Aprofundamento de Tabela)

* **Padrão de UX (Proposta C)**: Aprofundamento inline através da expansão de linhas da tabela de formatos do Overview, sem criar novas abas ou duplicar a navegação.


* **Fidelidade de Cobertura**: Exibição focada nas métricas com alta densidade de captura (Likes e Comentários cobrem 90–100% da base). O Score Polêmica é o principal indicador de engajamento por post.


* **Restrição de Scraping Público**: Confirmado estruturalmente que `reach`, `shares` e `saves` têm cobertura nula em scraping de dados públicos (Apify). Essas métricas não são prometidas individualmente por post fora de contas com API nativa autorizada.



### 2.4 Audiência (`/audiencia`)

* **Estrutura de 3 Blocos Verticais**:
1. *Demográfico*: Distribuição por gênero, principais cidades e alcance por seguidor via `ig_audience_snapshots`.


2. *Posicionamento de Setor*: Comparativo de mercado usando `fn_classify_metric` e `mapSegmentToCategory()`.


3. *Leitura Qualitativa*: Exibição de notas do onboarding manual (`q1/q2/q3_notes`, `observed_content_clusters`).




* **Status do Bloco Psicográfico (Panksepp/Schwartz)**: Construção da tela mantida como adiada por decisão de produto. A régua de calibração por amostragem avançou com o motor `orbit_v41.py`, garantindo $n \ge 10$ contas para todas as 7 categorias de `setor_benchmark`. A infraestrutura de benchmark de mercado está pronta, aguardando validação contra posts dos clientes ativos.



### 2.5 Funil e Avatar Alignment

* **Fronteira de Escopo**: Telas mantidas isoladas. A tela de Audiência não duplica os indicadores cobertos nestes dois módulos.



---

## 3. Rastreabilidade: KPIs que Geram Requisito de Tela

| Métrica / KPI | Fonte de Dados Real | Tela de Destino | Status de Implementação |
| --- | --- | --- | --- |
| **Saúde do Cliente & Alertas Críticos** | `orbit.v_alerts`, `orbit.clients` | Carteira, Alertas Críticos | ✅ Real, sincronizado no commit `550093b`<br> |
| **Saldo de Seguidores (90d)** | `orbit.ig_account_snapshots` | Overview | ✅ Real em produção

 |
| **ER Real / VPS** | `ig_account_snapshots` + `client_onboarding` | Overview, Audiência | ⚠️ Real; exibe "Sem threshold" quando fora de e-commerce

 |
| **Score Polêmica** | `ig_posts` (`comments`/`likes`) | Overview, Por Post | ✅ Real, alta cobertura na base de scraping

 |
| **Score Utilidade** | `ig_posts` (`saves`/`reach`) | Overview, Por Post | ⚠️ Limitado pela ausência de `reach`/`saves` em scraping público

 |
| **Shares / Saves por Formato** | `ig_posts.shares`, `ig_posts.saves` | Overview (agregado) | ❌ Cobertura nula em scraping público; restrito a dados nativos

 |
| **Alcance por Seguidor & Demografia** | `ig_audience_snapshots` | Audiência (Bloco 1) | ✅ Real em produção

 |
| **Setor, Nicho e Funil** | `orbit.client_onboarding` | Audiência (Bloco 2) | ✅ Real, alimentado via pipeline manual

 |
| **Notas Qualitativas** | `client_onboarding.q1/q2/q3_notes` | Audiência (Bloco 3) | ✅ Mapeado, pendente de integração gráfica

 |

---

## 4. Decisões de Produto Consolidadas

* **Transparência de Dados**: Fica proibida a exibição de estimativas ou métricas fabricadas em tela quando não houver cobertura real da fonte de dados.


* **Navegação Eficiente**: Aprofundamentos de dados operacionais ocorrem inline na própria visão agregada (Proposta C), evitando dispersão do usuário em múltiplas abas.


* **Honestidade de Benchmarking**: Categorias de mercado sem calibração específica em `orbit.ref_thresholds` recaem estritamente sobre a régua `global` identificada explicitamente.


* **Priorização do Bloco Psicográfico**: A exibição de métricas psicográficas de audiência permanece suspensa até a conclusão da análise comparativa contra o histórico do conteúdo dos clientes.