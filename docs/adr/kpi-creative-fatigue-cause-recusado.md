# ADR — fatigue_cause / creative_health (schema) implementam a árvore recusada

## Status
Proposta (gerada pelo robô KCR — Etapa 1 — nesta sessão). Precisa de decisão humana.

## Contexto
`orbit.ads_meta_creatives.fatigue_cause` e `.creative_health` são colunas
GENERATED STORED calculadas só a partir de `ctr_pct_week1`, `ctr_pct_current` e
`frequency_current` (schema dump, linhas ~951–972):

```
fadiga% > 40 E frequency > 2.5  → creative_saturation
fadiga% > 40 E frequency <= 2.5 → segmentation_issue
fadiga% > 20                    → offer_issue
```

Isso é, token por token, a `regra_calculo_antiga` que o Contrato v2 registra
para `creative_fatigue_cause` — sem nenhuma referência a ROAS.

O Contrato v2 substitui essa árvore por `resolveCreativeFatigueAlert`
(`src/lib/repositories/contentContractEngine.ts:1038`), cuja decisão depende de
`roasTrend` ('falling' vs. estável/subindo) — "40% e 2.5 são gestão, não
percentil das 58", ou seja, deixam de ser suficientes sozinhos para criticidade.

## O que o KCR encontrou
- `fatigue_cause` / `creative_health` só aparecem, no repositório, dentro de
  `src/types/database.types*.ts` (arquivos de tipo gerados). Nenhum componente,
  hook, repository ou action lê essas duas colunas — são GENERATED mas mortas.
- `resolveCreativeFatigueAlert` (a versão refinada) também não é chamada em
  nenhum outro arquivo do repositório enviado nesta sessão.

Ou seja: **nem a regra antiga nem a regra refinada estão de fato em produção**
hoje — a antiga existe fisicamente no schema (e pode ser lida por engano por
uma query futura, um dashboard novo, ou um agente de IA que inspecione o banco
diretamente), a refinada existe em código mas não está ligada a nada.

## Decisão a tomar
1. Dropar (ou marcar deprecated via COMMENT bem explícito) `fatigue_cause` e
   `creative_health` do schema, já que uma coluna GENERATED não pode receber a
   lógica de ROAS sem reescrever a expressão inteira (e ROAS vive em outra
   tabela — `ads_meta_snapshots` — então nem dá para fazer isso como GENERATED
   simples sem uma trigger).
2. Ligar `resolveCreativeFatigueAlert` de fato ao pipeline de `syncClientAlerts`
   (RWP — fora do escopo desta etapa KCR, mas é pré-requisito antes de chamar
   este KPI de "vigente em produção").

## Evidência
- `20260925dump_orbit.sql`, linhas ~951–972 (`fatigue_cause`, `creative_health`)
- `src/lib/repositories/contentContractEngine.ts:1038` (`resolveCreativeFatigueAlert`)
- grep `fatigue_cause|creative_health` em `src/` e `scripts/`: só em arquivos de tipo
- grep `resolveCreativeFatigueAlert(` em `src/` e `scripts/`: nenhuma chamada fora da definição
