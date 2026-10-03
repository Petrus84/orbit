Você não está atrasado em cinco frameworks. Está **no meio do 1**, com pedaços do 2 já vistos, e a tela atual é um **RWP precoce** (tiles ligados sem ficha). O gap 0,05% puxa para o 4–5. Não vá.

A sequência **não muda**. O que muda é o **único cartão da semana**.

---

## Onde você está agora (estado, não opinião)

| # | Nome | Estado | Prova |
|---|---|---|---|
| 1 | **KCR** | **Aberto** — núcleo existe, fichas não | 34 ids no registry antigo; 23 `nao_verificado`; modelo forense não emitiu `KpiContract[]` |
| 2 | **OGP** | **Parcial** — origem mapeada, lote não auditado por ficha | Protocolo E1/E2 27/09; JSON tem likes/comments/plays/ts; shares/saves/reach **não nesta fonte** |
| 3 | **RWP** | **Cedo demais** — Overview já pinta 4 scores | Utilidade 0,05% + “só o dado”; ER/VPS com meta provisória e **Ação** |
| 4 | **SSC** | **Não começou** | Tela ≠ oracle do mesmo token |
| 5 | **3 camadas** | **Infra existe, gate não** | Zod mappers ok; não validam o Overview atual |

Regra anti-salto: **gap na tela = nota no KCR, não ticket de UI.**

---

## Workflow acionável (um cartão por vez)

### Cartão 0 — semanal (15 min)

Quadro com 5 colunas: `KCR | OGP | RWP | SSC | L3`.  
Só **uma** linha `EM CURSO`. O resto `BLOQUEADO` ou `FEITO`.

DoD mensurável do quadro: `n_fichas_vigentes`, `n_tokens_fase2`, `n_clientes_com_category`, `n_tiles_overview_sem_traducao` (meta → 0).

---

### 1. KCR — fecha isto antes de tocar no Overview

**Objetivo:** cada token da tela **e** da Pista B tem uma ficha `KpiContract`.

| ID | Tarefa | DoD | Métrica |
|---|---|---|---|
| KCR-1 | Array JSON das fichas mínimas (polêmica, utility_caption, utility_insights, er_real, vps, cadencia, mix, interacoes_plays, genero_declarado_bio, benchmark_category, engagement_public, link_ctr, followers_net) | 1 arquivo `contracts/kpi/registry.json` | `n_fichas >= 12` |
| KCR-2 | Split obrigatório: `utility_caption` ≠ `utility_insights` | ADR de 20 linhas | 2 `kpi_id` |
| KCR-3 | Papel de cada um: valor / chave_de_par / alerta / etiqueta | campo `papel` preenchido | 0 `desconhecido` nos 12 |
| KCR-4 | Status: vigente / proposta / skip / refinada — **sem “completo” de grep** | tabela kpi_id × status | polêmica = refinada; cadência/mix/plays = proposta; er/vps/avatar Insights = skip *nesta fonte* |
| KCR-5 | Utilidade 0,05% no Overview: decisão na ficha (`screens: []` até traduzir) | `screens` do token atual **não** inclui `/instagram` overview | tile some do herói *depois* do KCR, no RWP |

**Bloqueia OGP** se KCR-1 e KCR-2 não existirem.

Não é KCR: `ALTER posts_per_day`, redesenhar card, Playwright.

---

### 2. OGP — origem do que a ficha pediu

Só tokens com ficha.

| ID | Tarefa | DoD | Métrica |
|---|---|---|---|
| OGP-1 | Por ficha: etapa E1 / E2 / oficial / não_nesta_fonte | coluna `coleta` preenchida | 12/12 |
| OGP-2 | Gate por tela futura: `A_SCHEMA` / `B_EMPTY` / `C_HOLD` / `RWP_ok` | JSON ogp | Overview scores Insights = `C_HOLD` neste scrape |
| OGP-3 | Rótulo de célula: `UPDATE clients.benchmark_category` nas 116 | `COUNT(*) WHERE category IS NOT NULL` = 116 (ou lista de conflito tipo dicasdesaudeecia) | **bloqueia percentil** |
| OGP-4 | Insert Pista B: likes, comments, ts, format, plays→`reel_plays`, shares/saves/reach = NULL | pós-count = n do lote; 100% null nos três | script + relatório |
| OGP-5 | Amostragem: mediana_conta → P50 da célula | 1 query por token F2 | n_celula ≥ 3 ou `sem_base` |

**Não** popular `ig_audience_snapshots` com bio.

---

### 3. RWP — ligar tela só no que passou 1+2

| ID | Tarefa | DoD | Métrica |
|---|---|---|---|
| RWP-1 | Overview herói: tirar tile sem tradução **e** sem régua | Utilidade some do herói; ER/VPS **sem** botão “revise 12 posts” se `semaphore.source` for gestão sample 0 | `n_tiles_sem_traducao = 0` |
| RWP-2 | Subir cadência + mix + chip `genero_declarado_bio` (proposta, L1/L2 explícito) | 3 blocos no card, `source: none` no semáforo | 1 página |
| RWP-3 | Polêmica fica: valor + mediana de setor **depois** OGP-3 | frase “par do setor” só se category preenchida | 1 tile com par |
| RWP-4 | Shares na tabela de formato: ou coluna `interações` ou dado zip real | label = campo | 0 “share” mentido |

Salto proibido: redesenhar Avatar / Funil antes de RWP-1.

---

### 4. SSC — tela = banco no mesmo token

| ID | Tarefa | DoD |
|---|---|---|
| SSC-1 | 1 teste: polêmica do card = `comments/likes` do post/agregado no período do header | Playwright + SQL oracle |
| SSC-2 | Header de período = janela dos cards (acabar 90D vs 9 meses) | um `data-period` |
| SSC-3 | Badge Medido/Estimado = `confidence` da ficha | L1 scrape ≠ Medido Insights |

Sem SSC em token `skip`.

---

### 5. Validação em 3 camadas

| Camada | O quê | DoD |
|---|---|---|
| L1 Zod | mapper do **token da ficha**, não da view velha de 4 nomes | parse falha se utility_insights vier de caption |
| L2 componente | tile recusa `%` solto sem `traducao` ou `par` | teste do panel |
| L3 E2E | SSC-1 no cliente `@cpimportstore` | 1 spec verde |

Zod que já existe **não** conta como etapa 5 cumprida enquanto o Overview ainda serve o tile 0,05%.

---

## Quadro desta semana (copie)

```text
EM CURSO: KCR-1 + KCR-2
BLOQUEADO: OGP-3 (espera fichas), RWP-1 (espera KCR-5), SSC, L3
PROIBIDO: ALTER cadência, novo tile, recalibrar v2, Playwright no Overview
NOTA (não é tarefa): 0,05% + “exibindo só o dado” → vai para screens:[] no KCR-5
```

Critério de semana boa: **arquivo de fichas no repo**, não tela bonita.

---

## Como não pular etapa de novo

Quando aparecer um gap visual:

1. Anota o `kpi_id` (ou `desconhecido`).  
2. Abre a ficha. Se não há ficha → **KCR**, para.  
3. Se há ficha e `coleta=nao_nesta_fonte` → **não é RWP**. É skip.  
4. Se há ficha, input no JSON, sem coluna → **OGP/cálculo**, não `ALTER` no dia.  
5. Só então RWP.

A frase da semana, mensurável:

> Cliente não paga ausência. Também não pago UI em token sem ficha.

Um número para olhar sexta: `n_fichas` (alvo 12) e `n_tiles_overview_sem_traducao` (alvo 0 **depois** de RWP-1, não antes do KCR).
O banco Alpha agora é o chão: **5 clientes reais, 3.040 posts, 47 linhas de tarifário, `benchmark_category` em 1/5**. As fichas que o modelo emitiu **são o KCR-1**. Governance é impedir que conflito 1–6 e o tile 0,05% virem cinco frentes.

Um dono: você. Um cartão `EM CURSO`. Nada sobe de etapa sem o gate.

---

## Governança (vale para as 5 etapas)

| Artefato | Onde | Quem mexe |
|---|---|---|
| `contracts/kpi/registry.json` | as 22 fichas (colar o array vivo) | só KCR |
| `contracts/kpi/decisions.md` | conflitos 1–6 + veredito | você, 1 linha cada |
| `contracts/ops/board.md` | `EM CURSO` / `BLOQUEADO` / `FEITO` | sexta, 15 min |
| Proibido sem ficha | `ALTER`, tile novo, Playwright no Overview, ligar dead_writer | — |

Gate global: **token sem ficha no registry = não existe para o time.**  
Métricas de controle (sexta):

```text
n_fichas                 = 22          (já)
n_conflitos_abertos      = 6 → alvo 0 ou "adiado"
n_clientes_com_category  = 1/5 → 5/5
n_tiles_sem_traducao     = 1 (utilidade 0,05%) → 0  SÓ depois de RWP-1
n_dead_writer_ligados    = 0           (não ligar nesta quinzena)
```

---

## ETAPA 1 — KCR  
**Gate de entrada:** array das 22 no `registry.json` (feito pelo modelo; você só versiona).  
**Gate de saída:** conflitos 1–6 com veredito escrito. Sem isso, OGP não classifica célula.

| ID | Subtarefa | Controle | DoD |
|---|---|---|---|
| KCR-G1 | Commit do JSON das 22 fichas em `contracts/kpi/registry.json` | arquivo no git | 22 objetos, `evidencia.banco` intacta |
| KCR-G2 | ADR vazio → criar `docs/adr/` só para decisão, não para wish | 1 ADR por conflito que mudar regra | path preenchido na ficha |
| KCR-C1 | `engagement_public`: unidade = **contagem** (bate com `green_min` 25–2345) | riscar o comentário :1156 | ficha `output.unit=count` |
| KCR-C2 | Órfãos v1 (`engagement_public`, `play_to_view_ratio`): **não restaurar** nesta quinzena | `status=refinada`, `screens=[]`, `call_site` permanece dead | decisão no `decisions.md` |
| KCR-C3 | `play_to_view_ratio`: código mente, coluna **não existe** | ficha já diz; não criar coluna agora | — |
| KCR-C4 | Split utilidade: `utility_caption` ≠ `utility_score_pct` | ADR 20 linhas | dois `kpi_id` |
| KCR-C5 | Overview 0,05% = `utility_score_pct` de **snapshot** (saves+shares)/reach, não caption | `screens` desse id **sem** Overview até traduzir | KCR-5 |
| KCR-C6 | `avatar_*`: composite 70/85 + FALLBACK_PCT=0 = recusado ainda vivo | **não** corrigir mapper agora; `status=refinada`, tela `/avatar` fora do sprint | nota no ADR existente |
| KCR-C7 | `reach_follower_split`: papel desconhecido | **não calcular** | 1 pergunta no `decisions.md` ou `adiado` |
| KCR-C8 | `algo_risk_score` e `polemic_score_pct` = únicos `vigente`+call site | não mexer na fórmula | — |

**Sexta KCR:** `n_conflitos_abertos = 0 ou adiado`. Só então OGP.

---

## ETAPA 2 — OGP  
**Gate de entrada:** KCR-G1 + C1 + C4 + C5 escritos.  
**Gate de saída:** 5/5 com `benchmark_category` **ou** lista explícita de recusa; posts da Pista B com null policy da ficha.

| ID | Subtarefa | Controle (SQL) | DoD |
|---|---|---|---|
| OGP-R1 | Sincronizar rótulo: `setor_benchmark` → `clients.benchmark_category` via `mapSegmentToCategory` | `SELECT handle, benchmark_category FROM clients WHERE is_benchmark=false` | **5/5 NOT NULL** ou 4 linhas no `decisions.md` “não mapear porque X” |
| OGP-R2 | Conflito de chave (tipo dicasdesaudeecia: 4_servico vs afiliado) | 1 override manual por handle | sem 3 rótulos no mesmo cliente |
| OGP-P1 | Conferir Pista B nos 3.040: likes/comments/ts/format | `count(*)` vs `count(likes)` | relatório 1 página |
| OGP-P2 | `reel_plays`: 1540/1783 ok; 243 reels sem play = **falha de coleta**, não skip de métrica | lista de 243 shortcodes | re-run actor só nesses, ou marcar lote |
| OGP-P3 | saves 231/3040 (7,6%) → confirma `er_real` / `utility_score_pct` / `save_rate` = **não Overview** | bate com fichas skip | — |
| OGP-P4 | Não inserir audience/bio como snapshot | 0 INSERT em `ig_audience_snapshots` neste sprint | — |
| OGP-A1 | Cadência + mix: query sob demanda (sem ALTER) nos 5 handles | 1 SELECT por cliente | números no `output/ogp-fase2.json` |

**Sexta OGP:** `n_clientes_com_category=5` (ou exceções documentadas) + `ogp-fase2.json` com cadência/mix dos 5.

---

## ETAPA 3 — RWP  
**Gate de entrada:** OGP-R1 feito.  
**Gate de saída:** Overview sem tile sem tradução; polêmica só fala “setor” se category existe.

| ID | Subtarefa | Controle | DoD |
|---|---|---|---|
| RWP-1 | Remover tile Utilidade do **Overview** (fica em laboratório / por post se quiser) | screenshot before/after | `n_tiles_sem_traducao=0` |
| RWP-2 | ER Real e VPS: tirar **Ação** “revise 12 posts / trate como vermelho” (source=gestao, sample=0, engine devolve neutro) | copy review | sem CTA falso |
| RWP-3 | Ligar cadência + mix nos 5 (cálculo no repo, não coluna nova) | 2 blocos visíveis | proposta, badge L1 |
| RWP-4 | Polêmica: “mediana do setor” **só** se `benchmark_category` do cliente NOT NULL; senão “sem célula” | `@eupetruchio84` não mente par | 1 if |
| RWP-5 | Tabela formato: coluna Shares → **Interações** ou some se for share nulo | label = campo | — |
| RWP-6 | Header período = janela dos cards (90D vs 31/12–26/09) | um `period` | — |

**Proibido no RWP desta quinzena:** ligar `resolveCtrBioAlert`, `resolveEngagementPublicAlert`, criar `play_to_view_ratio`, tela Avatar, Funil.

---

## ETAPA 4 — SSC  
**Gate de entrada:** RWP-1 e RWP-4.  
**Só tokens `vigente` ou `proposta` com `screens` preenchido.**

| ID | Subtarefa | Oracle | DoD |
|---|---|---|---|
| SSC-1 | Polêmica do card `@cpimportstore` = mediana `ig_posts.polemic_score_pct` no **mesmo** period do header | SQL = `data-value` | 1 spec |
| SSC-2 | Cadência tela = fórmula da ficha nos posts do período | SQL | 1 spec |
| SSC-3 | Mix tela = count por `content_format` | SQL | 1 spec |
| SSC-4 | Badge Medido ≠ Estimado = `confidence` da ficha (L1 scrape ≠ Insights) | visual + campo | — |

---

## ETAPA 5 — 3 camadas  
**Gate de entrada:** SSC-1 verde.

| ID | Camada | Subtarefa | DoD |
|---|---|---|---|
| L3-1 | Zod | mapper recusa servir `utility_score_pct` de snapshot no slot de caption (e o contrário) | teste unit |
| L3-2 | Componente | tile sem `traducao` **e** sem `par` não monta no Overview | teste |
| L3-3 | E2E | SSC-1 no Alpha `@cpimportstore` | CI ou script local |

O Zod que já existe **não** fecha a etapa 5.

---

## Quadro desta quinzena (cole em `board.md`)

```text
SEMANA A
EM CURSO: KCR-G1, KCR-C1, KCR-C4, KCR-C5, KCR-C2
BLOQUEADO: OGP-*, RWP-*, SSC-*, L3-*
PROIBIDO: ALTER, dead_writer, tile novo, /avatar, órfãos v1

SEMANA B  (só se Semana A FEITO)
EM CURSO: OGP-R1, OGP-A1, OGP-P2
BLOQUEADO: RWP até 5/5 category ou exceções

SEMANA C
EM CURSO: RWP-1, RWP-2, RWP-4
DEPOIS: RWP-3, SSC-1
```

---

## O que *não* entra no workflow agora (backlog congelado)

- Corrigir FALLBACK_PCT=0  
- Wire de fatigue / CTR bio / engagement_public  
- DROP `threshold_*` em `clients`  
- Recalibrar v2 de utilidade  
- 116 contas de pasta — o Alpha operacional é **5**; as 116 são outro universo até existirem em `clients`

As 116 continuam no protocolo de coleta. Governance do dashboard = **estes 5 + estas 22 fichas**.

---

## Ritual de 15 min (sexta)

1. Abrir `board.md`.  
2. Anotar os 4 `n_*`.  
3. Se `EM CURSO` não tem DoD → não abre cartão novo.  
4. Gap de tela (0,05%, −43%, shares) → uma linha em `decisions.md`, **não** branch.

Isso é o framework com dono. KCR governa o nome. OGP governa o fato. RWP governa o herói. SSC governa a igualdade. L3 governa o regresso. Fora dessa ordem vira recorte de chat de novo.