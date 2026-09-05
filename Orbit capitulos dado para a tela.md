# ORBIT — Jornada Dado → Tela: Auditoria de Rastreabilidade Full-Stack

**Versão:** 1.2 · **Data:** 03/09/2026 (última atualização de estado: 04/09/2026) · **Metodologia:** Schema/Views → Types/Repositories → UI

---

## Capítulo 1 — Carteira & Alertas: Refatoração Concluída e Comitada (Commit `550093b`)

### 1.1 O que foi aplicado no Banco de Dados (Schema `orbit`)

* `orbit.v_alerts` alterada, **preservando o contrato anterior**, com 14 campos novos expostos em camelCase: `alertType`, `metricName`, `metricValue`, `thresholdValue`, `snapshotId`, `dataSource`, `confidenceLevel`, `natureza`, `probableCause`, `suggestedAction`, `actionUrl`, `resolvedAt`, `snoozedUntil`, `resolvedBy`.
* Validado: o alerta ativo (CTR `1.23` vs threshold `2.00`, cliente `eupetruchio84`) segue visível, com campos de proveniência retornando `null` por ausência no registro original (sem fabricação de dados retroativos).
* Acesso `anon` revogado em `orbit.alerts` e `orbit.v_alerts`. Permissões restritas a `authenticated` e `service_role`.
* Constraint de consistência `is_resolved`/`resolved_at` preservada sem bloqueios retroativos na base legado.

### 1.2 Refatoração de Código e Sincronização Full-Stack (Commit `550093b`)

A refatoração da Carteira e do sistema de Alertas foi **concluída, testada e comitada com sucesso**. As alterações cobrem 12 arquivos no diretório `src/`, eliminando pendências de tipagem e garantindo rastreabilidade do banco à interface:

* **Tipagem & Schema (`src/types/`)**:
* `src/types/database.types.ts`: Adicionada a definição autogerada de tipos do Supabase cobrindo o schema `orbit`.
* `src/types/orbit.ts`: Expandida a interface `Alert` e modelos da carteira de clientes com campos de proveniência e causa.


* **Repositórios & Server Actions (`src/lib/repositories/` & `src/actions/`)**:
* `src/lib/repositories/alertsRepository.ts`: Mapeamento de consultas adaptado para consumir os novos campos da view `orbit.v_alerts`.
* `src/actions/syncClientAlerts.ts`: Refatorado o pipeline Server Side responsável pela verificação e geração dinâmica de alertas.
* `src/lib/repositories/clientsRepository.ts`: Corrigida a exportação dos enums de saúde (`ClientHealthStatus`), alinhando estatísticas de snapshot.
* `src/lib/repositories/onboardingRepository.ts`: Refatoradas as consultas do formulário de onboarding de clientes.


* **Interface & Componentes UI (`src/app/` & `src/components/`)**:
* `src/app/(dashboard)/carteira/page.tsx`: Promovida para v2.0.0, substituindo dados estáticos pela injeção dos hooks `useClients` e `useAlerts`.
* `src/components/screens/CarteiraScreen.tsx`: Layout reestruturado em grade responsiva Tailwind (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) com suporte a fallback (`clientId ?? client_id`).
* `src/components/common/ClientCard.tsx` & `ClientCard.module.css`: Ajustado o container para ocupar largura total (`width: 100%`) dentro da grade.
* `src/components/common/AlertCard.tsx` & `src/components/screens/AlertasScreen.tsx`: Sincronizados handlers de confirmação (`onAcknowledge`) e exibição de métricas de urgência.



### 1.3 Estado de Auditoria e Versionamento

* ✅ **Commit & Push Concluídos**: Alterações integradas e enviadas à branch `master` no GitHub (`73452c7..550093b`).
* ✅ **Higienização de Repositório**: Confirmado que dumps `.sql`, logs antigos (`porcelain.txt`, `resumo_alteracoes_quinzena.txt`) e scripts temporários ficaram totalmente fora da árvore do Git.
* ✅ **Rastreabilidade Integrada**: A camada de apresentação (UI) consome com tipagem estrita os dados vindos diretamente da view `orbit.v_alerts`.

---

## Capítulo 2 — Audiência: já entregue nesta sessão, resumo de rastreabilidade

| Bloco | Fonte real | Status |
| --- | --- | --- |
| Demográfico (gênero, cidades, alcance) | `ig_audience_snapshots`, `ig_account_snapshots` | ✅ Componente entregue (`AudienceSummaryPanel`) |
| Posicionamento de setor (benchmarking) | `client_onboarding` + `fn_classify_metric(metric, value, category, tier)` | ✅ Componente entregue (`SectorPositioningPanel`), com `mapSegmentToCategory()` honesto |
| Leitura qualitativa (notas de onboarding) | `client_onboarding.q1/q2/q3_notes`, `observed_content_clusters` | ✅ Fetch entregue, componente de exibição pendente |
| Psicográfico (Panksepp/Schwartz) | `client_onboarding.expected/real_panksepp_system` | 🟡 Dado do **cliente** pronto; dado de **régua/benchmark** era o gap — ver Capítulo 3 |

---

## Capítulo 3 — Novo: benchmark psicográfico (payload `orbit_v41.py`)

### 3.1 O que resolve

Fecha o gap que você identificou no onboarding: hoje o sistema registra o Panksepp/Schwartz **esperado vs. real de cada cliente**, mas não tinha uma **régua de comparação por categoria/tier** — exatamente o mesmo problema que já resolvemos pra `er_real_pct`/`vps_pct`/`polemic_score_pct` via `ref_thresholds`. Esse payload é a matéria-prima pra fazer o mesmo pro eixo psicográfico.

### 3.2 Ressalva estatística — RESOLVIDA por enriquecimento de amostra (atualização 04/09/2026)

Situação original: `1_ecommerce_direto` (única categoria calibrada) tinha `n=1`; as categorias com volume real (`monetização nativa` n=14, `patrocínio` n=12, `serviço/consultoria` n=11) não tinham régua nenhuma.

Rodei duas coletas adicionais (actors Apify `instagram-niche-finder` para descoberta de perfil + `instagram-scraper` para posts) miradas especificamente nos gaps abaixo de `n=10` (corte de confiança adotado: `confidence_score>=0.70`, mesmo padrão já usado em `ref_thresholds`). Resultado, `n` de contas por categoria antes → depois:

| Categoria (`setor_benchmark`) | n antes | n depois |
| --- | --- | --- |
| `comercio_direto_ecommerce_social` (ecommerce) | 1 | 21 |
| `infoprodutor_educador_pago` | 5 | 20 |
| `membership_assinatura_comunidade` | 6 | 11 |
| `autoridade_personal_branding_b2b` | 9 | 17 |
| `servico_consultoria_profissional` | 11 | 21 |
| `patrocinio_publicidade_marca` | 12 | 12 (já suficiente, sem coleta adicional) |
| `monetizacao_nativa_plataforma` | 14 | 14 (já suficiente, sem coleta adicional) |

**Todas as 7 categorias homologadas em `client_onboarding.setor_benchmark` agora têm `n>=10` contas.** Tier `nano` (0–9.999 seguidores), que não existia na amostra original, também passou a ter representação.

**Ressalva que continua de pé, não resolvida por esta rodada:** essa amostra é **benchmark de mercado geral** (contas descobertas por nicho, públicas), não os posts reais dos 2 clientes pagantes (`cpimportstore`/`eupetruchio84`). O item 1 do "próximo passo técnico" original (seção 3.4) segue em aberto — enriquecer a régua de mercado não substitui rodar o pipeline contra o cliente real.

**Pendência nova, não decidida por mim:** a coleta trouxe também 48 contas "órfãs" — posts retornados pelo `instagram-scraper` sem perfil correspondente em nenhum dos 5 runs do `niche-finder` (sem `followerCount`, sem categoria confirmada). Ficaram isoladas com `category: "unclassified"` e **fora de qualquer categoria/tier real** — não há evidência de qual caminho de descoberta as trouxe. Arquivo: `orphans_rodada2.json`. Decisão de classificá-las (manual, ou heurística por palavra-chave de bio/caption) ainda não foi tomada.

### 3.3-bis Correções aplicadas no motor `orbit_v41.py` (atualização 04/09/2026)

O payload citado acima já reflete uma versão corrigida do motor (v4.0 → v4.1), não a original. Bugs identificados e corrigidos nesta sessão:

* Matching por substring (`keyword in text`) trocado por regra de palavra inteira (`\bkeyword\b`) — eliminava falsos positivos (ex.: "bom" batendo dentro de "bomba").
* Componente de sentimento usava `TextBlob`, que não tem léxico PT-BR real — ficava sempre neutro em captions em português (maioria da base). Substituído por léxico PT-BR leve embutido (~150 termos positivos/negativos, curado manualmente, não validado academicamente).
* Sinal de emoji (ausente na v4.0) somado ao score — relevante para captions/comentários de Instagram BR.
* Peso de palavras-chave genéricas (`legal`, `bom`, `novo`, presentes em quase todas as 7 categorias Panksepp/Schwartz simultaneamente) descontado pela "promiscuidade lexical" da palavra, para não inflar todas as dimensões ao mesmo tempo.
* Comentários (`latest_comments`) passaram a entrar na análise (peso 2x sobre a caption) — antes só a caption era usada; comentário é reação espontânea do público, mais confiável que a copy do criador.
* Normalização de score trocada de fator fixo (`score*5`) para calibração por percentil observado na própria base.

### 3.3 Sobre longitudinalidade (o ponto que você fez: "ninguém pensou nisso")

Concordo com o diagnóstico, e ele é maior que este payload específico: **nenhuma tabela do schema hoje versiona snapshot histórico de Panksepp/Schwartz por cliente ao longo do tempo** — `client_onboarding` guarda um valor único (`real_panksepp_system`), não uma série temporal. Pra correlacionar "perda de seguidores" com "mudança de padrão psicográfico do conteúdo" (sua hipótese, alternativa a "é o algoritmo"), precisaria de uma tabela nova tipo `orbit.client_psychographic_snapshots` (client_id, period, dominant_panksepp, scores completos) — hoje isso não existe em lugar nenhum do schema que auditei. Isso é achado novo, não decidido, registro como pendência de arquitetura, não escrevo migration sem sua confirmação.

### 3.4 Próximo passo técnico — estado atualizado (04/09/2026)

1. ~~Rodar `orbit_v41.py` contra os posts reais dos 2 clientes pagantes~~ — **ainda não feito**. A base cresceu (58 → 164 contas), mas continua sendo 100% benchmark de mercado; nenhum post de `cpimportstore`/`eupetruchio84` entrou nesse recálculo. Continua item aberto.
2. ~~Decidir o corte de `n` mínimo por categoria~~ — **decidido e aplicado**: `n>=10` contas por categoria (mesmo padrão de `confidence_score>=0.70` já usado no resto do sistema). Todas as 7 categorias já atendem o corte (ver 3.2). Categorias/grupos abaixo do corte continuam caindo em `global`, via a mesma hierarquia de `fn_classify_metric`.
3. Desenhar a tabela de snapshot longitudinal (`orbit.client_psychographic_snapshots`) — **continua não estimado, não iniciado**.
4. **Novo, não decidido:** gravar `ref_thresholds_ready_final.json` (35 linhas, cobrindo `polemic_score_pct` global + 7 categorias + 5 tiers + combinações categoria×tier) de fato em `orbit.ref_thresholds` — hoje é só arquivo pronto pra `INSERT`, não foi aplicado no banco nesta sessão.
5. **Novo, não decidido:** revisar/classificar as 48 contas órfãs (`orphans_rodada2.json`) antes de considerá-las para qualquer régua.

---

## Próxima ação real, em ordem (atualizada 04/09/2026)

1. Rodar (ou confirmar que já rodou) `orbit_v41.py` contra os posts reais dos 2 clientes pagantes — não feito ainda.
2. Aplicar `ref_thresholds_ready_final.json` no banco via Supabase, ou revisar antes de aplicar.
3. Decidir o que fazer com as 48 contas órfãs: classificar manualmente, tentar heurística por bio/caption, ou descartar da amostra.
4. Desenhar a tabela de snapshot longitudinal — segue sem estimativa.