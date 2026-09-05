# ORBIT — Arquitetura Atual & Runbook de Onboarding

**Versão:** 1.2 · **Data:** 03/09/2026 (última atualização de estado: 04/09/2026) · **Status:** Vivo / Sincronizado com Commit `550093b`

---

## 1. Runbook — como um cliente novo entra no sistema (pipeline manual, fora do app)

Este passo não roda dentro do Orbit — é um pré-requisito manual, feito antes de qualquer tela do app existir para aquele cliente.

* **Criação manual da linha em `orbit.clients**`: Realizada diretamente no Supabase (Table Editor ou SQL Editor), gerando o `uuid` do cliente que serve de chave primária para todo o ecossistema.


* **Preenchimento do onboarding via ferramenta standalone (`onboarding_avatar_alignment.html`)**: Formulário HTML/JS sem conexão direta com o banco, rodando 100% client-side. Captura setor, nicho, funil, avatar esperado (Panksepp/Schwartz), notas qualitativas, links de bio e split declarado de audiência.


* **Exportação manual de dados**: A ferramenta gera o payload em JSON ou instrução SQL `UPSERT` pronta (botões "Copiar"/"Baixar arquivo"), utilizando o `uuid` criado no primeiro passo e informado no campo `clientIdInput`.


* **Execução no Supabase**: A instrução SQL é executada manualmente no SQL Editor do Supabase. A partir desse momento, a linha passa a existir em `orbit.client_onboarding`, permitindo que as consultas da aplicação (`fetchSectorPositioning`, `fetchLatestEngagementScoreSnapshot`, etc.) encontrem dados reais.


* **Ingestão paralela**: Mapeamentos de posts/insights (`ingest-from-zip.ts`) e dados demográficos são executados posteriormente contra o mesmo `client_id`.



**Implicação de Arquitetura**: O Orbit atua estritamente como camada de leitura e inteligência sobre o pipeline de onboarding manual. Falhas de "dado ausente" em tela exigem a verificação prévia da execução deste fluxo manual antes de abertura de chamados na aplicação.

---

## 2. Estado Real do Código (Sincronizado pós-commit `550093b`)

A refatoração da Carteira e do motor de Alertas foi **efetivada e comitada no repositório (`550093b`)**, resolvendo o alinhamento da camada de dados com a interface gráfica.

**Itens Concluídos e Validados no Código Live (`src/`)**

* **Injeção de Dados da Carteira (`src/app/(dashboard)/carteira/page.tsx` & `CarteiraScreen.tsx`)**: Substituída a estrutura estática pela injeção ativa dos hooks `useClients` e `useAlerts`, com renderização em grade responsiva e tratamento de fallback (`clientId ?? client_id`).


* **Estrutura de Alertas Críticos (`src/lib/repositories/alertsRepository.ts` & `syncClientAlerts.ts`)**: Mapeamento completo dos 14 campos da view `orbit.v_alerts` (incluindo proveniência e causabilidade em camelCase) e refatoração da Server Action de sincronização.


* **Contrato de Tipos TypeScript (`src/types/database.types.ts` & `orbit.ts`)**: Adicionadas as definições oficiais geradas do Supabase e expandidas as interfaces de `Alert` e estatísticas de saúde da carteira.


* **Componentes e Apresentação (`AlertCard.tsx`, `ClientCard.tsx`, `AlertasScreen.tsx`)**: Ajustados para ocupação completa da largura em grid (`width: 100%`) e handlers diretos de confirmação de alertas (`onAcknowledge`).


* **Repositório de Onboarding (`src/lib/repositories/onboardingRepository.ts`)**: Atualizado no commit `550093b` para adequação de chamadas e tipagens de entrada de dados de clientes.



**Estado dos Fallbacks de Resiliência (`instagramOverviewRepository.ts`)**

* O repositório `instagramOverviewRepository.ts` preserva blocos de fallback direcionados a `supabaseLegacy` dentro de `fetchKPIs`, `fetchQualityScores` e `fetchFormatPerformance`.


* **Diretriz**: Esses fallbacks funcionam como camada de proteção enquanto as novas views `orbit.*` são homologadas em carga total. A remoção definitiva será realizada assim que a estabilidade das views principais for mantida sem oscilações.



---

## 3. Ledger de Dívida Técnica Consolidado (ORB-DEBT)

| ID | Item | Status | Resolução / Próximo Passo |
| --- | --- | --- | --- |
| **ORB-DEBT-019/030** | Fallback `supabaseLegacy` em `instagramOverviewRepository.ts` | 🟡 Em Transição | Mantido temporariamente como fallback de resiliência. Remoção agendada pós-estabilização das views `orbit.*`.

 |
| **ORB-DEBT-021** | `seed-dynamic.ts` sem `.schema('orbit')` e tabela `agencies` ausente | 🚨 Aberto | Corrigir declaração de schema no client e definir criação ou remoção da tabela `agencies`.

 |
| **ORB-DEBT-040** | Ajustes de RLS / Client em `onboardingRepository.ts` | 🟢 Integrado | Código refatorado no commit `550093b`. Pendente apenas homologação em staging.

 |
| **ORB-DEBT-042** | Métricas `vps_pct`/`er_real_pct` sem benchmark fora de e-commerce | 🟡 Aberto | Definição de regra de negócio/produto. Não se trata de erro de software.

 |
| **ORB-DEBT-043** | Ausência de `shares/saves` em scraping público | 🟡 Aberto | Limitação do canal de scraping público (Apify). Exige transição para API Graph nativa quando necessário.

 |
| **ORB-DEBT-046/047** | Tradução de formatos e marcas de tendência hardcoded | 🟡 Aberto | Refatoração combinada agendada para padronização de enums de formato de conteúdo.

 |
| **data_gap** | Tratamento de guarda de dados ausentes em UI | 🟢 Concluído | Comportamento intencional implementado via `withMissingDataGuard`.

 |
| **ORB-DEBT-050** | Calibração de métricas em `calibrate_thresholds_stratified.py` (v1) | ✅ Corrigido | Substituído por `calibrate_thresholds_v2.py` utilizando os campos oficiais do schema (`utility_score_pct`, `polemic_score_pct`, etc.).

 |
| **ORB-DEBT-051** | Inversão de polaridade na métrica `vps_pct` | ✅ Corrigido | Regra de semáforo ajustada para `higher_is_better` na versão v2 do script.

 |
| **ORB-DEBT-052** | Carga de `ref_thresholds_ready_final.json` (35 registros) no banco | 🚨 Aberto | Payload validado com 7 categorias e 5 tiers. Aguarda execução do script de `INSERT` em `orbit.ref_thresholds`.

 |
| **ORB-DEBT-053** | Conciliação e alinhamento de escopo do commit `550093b` | ✅ Concluído | Mapeados e validados todos os 12 arquivos alterados no diretório `src/`.

 |

---

## 4. Próximas Ações Recomendadas

1. **Executar Carga do Payload de Benchmark (`ORB-DEBT-052`)**: Inserir os 35 registros do arquivo `ref_thresholds_ready_final.json` na tabela `orbit.ref_thresholds` via Supabase SQL Editor.


2. **Homologar Onboarding via Repositório**: Realizar teste de ponta a ponta no formulário de onboarding para validar os ajustes aplicados em `onboardingRepository.ts` (`550093b`).


3. **Depurar e Limpar Script Obsoleto**: Marcar `calibrate_thresholds_stratified.py` (v1) como deprecado ou removê-lo para evitar execuções acidentais com nomes de métricas legados.


4. **Remover Fallbacks Legados pós-Homologação**: Agendar a remoção das rotas de contingência `supabaseLegacy` em `instagramOverviewRepository.ts` assim que as views `orbit.*` completarem o ciclo sem falhas.


5. **Corrigir Script de Seed (`ORB-DEBT-021`)**: Atualizar o arquivo `seed-dynamic.ts` para explicitar o namespace `.schema('orbit')`.