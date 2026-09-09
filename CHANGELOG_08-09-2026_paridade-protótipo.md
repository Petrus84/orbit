# Changelog — Paridade com o protótipo SSOT (08/09/2026)

Pacote com as correções combinadas na conversa, focadas em fidelidade dos
**cards** ao protótipo (`orbit-prototipo-consolidado-neon`), validadas por
`tsc --noEmit` (limpo) e `eslint` (limpo) nos arquivos alterados.

## Arquivos alterados

### 1. `src/components/common/ClientCard.tsx` + `.module.css`
- Adicionado filete de topo colorido por severidade (`accentHealthy/
  Warning/Critical/Unknown`) — paridade com `.cc-cyan/.cc-gold/.cc-red`
  do protótipo. Antes todo card tinha a mesma borda neutra, mesmo em
  status crítico.
- Adicionada prop opcional `topAlertText` — renderiza a linha-resumo
  "⚠ ..." no rodapé do card, paridade com o protótipo. Antes essa
  informação só existia na Central de Alertas, nunca no card da Carteira.

### 2. `src/components/screens/CarteiraScreen.tsx`
- `ClientCard` agora recebe `topAlertText={clientAlerts[0]?.title ?? null}`
  — liga o alerta mais urgente do cliente ao card, sem duplicar lógica de
  busca (reaproveita `clientAlerts`, já calculado no componente).

### 3. `src/components/common/AlertCard.tsx` + `.module.css`
- Badge de severidade ("Crítico"/"Atenção") movido do rodapé (linha de
  botões) para o cabeçalho, ao lado do título — paridade com
  `row-between mb8` (alert-title + badge) do protótipo. A linha de ações
  agora só contém ações de verdade.
- `action.url` só vira link clicável se não for um domínio de exemplo
  (`example.com/.org/.net`, `localhost`). Achado direto da análise de
  dados de 08/09: o único alerta real da base (CTR de `eupetruchio84`)
  tem `action_url = 'https://example.com/alerts/ctr'` — um placeholder
  nunca trocado no dado. Sem essa checagem, o botão mandava o usuário pra
  um domínio de exemplo.

### 4. `src/lib/repositories/instagramOverviewRepository.ts`
- `KPI_METRIC_KEYS` agora inclui `'cliques-no-link'` (faltava — por isso
  o 4º KPICard do Overview nunca aparecia, mesmo o protótipo especificando
  4 KPIs: Seguidores, Saldo, Alcance, Cliques no link).
- KPIs agora são ordenados pela ordem canônica do protótipo
  (`KPI_ORDER`), não pela ordem de chegada do banco (`calculated_at desc`,
  que embaralhava os cards a cada snapshot novo).
- `fetchFormatPerformance` agora seleciona `save_count` (já existia na
  view `v_format_performance`, nunca era lido) e mapeia para o novo campo
  `saves` de `FormatPerformanceRow`.

### 5. `src/types/orbit.ts`
- `FormatPerformanceRow` ganhou o campo `saves: number` — fecha o
  contrato de tipo pro dado que a view já expõe.

### 6. `src/components/content/FormatPerformanceTable.tsx`
- Nova coluna **SAVES** na tabela (Formato/Posts/Shares/**Saves**/Trend),
  paridade com o protótipo. `colSpan` da linha de detalhe expandida
  ajustado de 5 para 6.

## Investigado e **não** alterado (decisão documentada, não bug)

- **Sidebar sem "Meta Ads"/"Google Ads"/"Criativos"/"Relatório"**:
  `Sidebar.tsx` tem uma whitelist deliberada (`NAV_ITEMS`, comentário
  "zero ruído de features fantasmas"), consistente com a análise de dados
  confirmando `ads_meta_campaigns`/`ads_google_campaigns` com **0 linhas**
  na base. Não reintroduzi essas telas — seria fabricar navegação para
  dado que não existe.
- **`ClientCard` mostrando "Sem dado" em vez de "Crítico"/"Saudável"**:
  causa raiz é `orbit.v_client_health` (provavelmente vazia/NULL para os
  2 clientes reais), que por sua vez depende de `follower_churn_pct` —
  documentado como bloqueado de propósito desde a rev. 6 do schema
  (truncamento nos exports da Meta). É decisão de dado/produto, não algo
  corrigível no componente.
- **Score do Avatar Alignment (56,9% no app vs. 58,2% no fallback do
  protótipo)**: `avatarRepository.ts` lê de `v_avatar_alignment` (uma
  view de estado atual, não da tabela de snapshots históricos) — não há
  bug de "pegar o snapshot errado" no código TS. A anomalia de 30/ago
  (`avatar_alignment_snapshot`) documentada na análise de dados é
  provavelmente de ingestão, na camada de banco/view, fora deste pacote.
- **Escala do `v_quality_scores.score_value`** (card mostra "0,05" onde a
  média direta da tabela `ig_posts` sugere ~2,55%): sem acesso ao banco
  para inspecionar a view, não dá pra confirmar bug de unidade
  (fração vs. percentual) — fica como item para checar com uma query,
  não uma alteração de código sem evidência.

## Validação

```
npx tsc --noEmit -p tsconfig.json   → limpo
npx eslint <arquivos alterados>     → limpo
npx next build                      → compila; único erro é fetch de
                                       fontes do Google bloqueado pela
                                       sandbox de rede (sem relação com
                                       as mudanças deste pacote)
```
