# ADR — avatar_composite_score roda metodologia recusada, não os KPIs vigentes

## Status
Proposta (gerada pelo robô KCR — Etapa 1 — nesta sessão). Precisa de decisão humana.

## Contexto
`orbit.compute_avatar_alignment()` (schema dump, função) calcula `gender_score`,
`age_score` e `geo_score` e combina em `composite = gender*0.4 + age*0.4 + geo*0.2`,
gravado como `ig_audience_snapshots.avatar_composite_score` (coluna GENERATED).
Esse composite é consumido diretamente pelas views de saúde de cliente/carteira
(`health_status`), com cortes fixos: `>=85 healthy`, `>=70 warning`, `<70 critical`
— exatamente o `COMMENT ON COLUMN` da tabela e o `threshold_avatar_alignment_min`
default 70.0 em `orbit.clients`.

O Contrato v2 (`contract-v2.json`) **não define** um `avatar_composite_score` como
kpi_id. Em vez disso, refinou avatar em **três KPIs independentes**:
- `avatar_gender`: desvio em pontos percentuais (`abs(esperado-real)`), verde ≤15pp,
  âmbar 15–30pp, vermelho >30pp **somente se `isRealFromConversionData`** — senão
  vira aviso L2 ("quem curte não é quem compra").
- `avatar_age`: soma da faixa declarada vs. faixa real, mesmos cortes 15/30pp.
- `avatar_city`: verde se a cidade-alvo está no top 5 real OU soma das cidades
  declaradas ≥25%; âmbar 10–25%; vermelho <10%.

`compute_avatar_alignment()` implementa a fórmula **antiga** (`100 - abs(diff)`)
para gênero e geo, sem nenhum guard equivalente a `isRealFromConversionData`, e
mede geo como uma única cidade contra um alvo (não top-5/soma declarada). A
função `resolveAvatarAlert` (`src/lib/repositories/contentContractEngine.ts:875`)
já implementa o guard correto — mas não é chamada em nenhum outro arquivo do
repo enviado nesta sessão (RWP pendente).

## Decisão a tomar (uma das três)
1. **Aposentar** `avatar_composite_score` / `compute_avatar_alignment()` e migrar
   as views de saúde de carteira para consumir os 3 KPIs refinados diretamente
   (provavelmente uma nova função de agregação, se um "resumo de 1 número" ainda
   for necessário para o card de carteira).
2. **Redefinir formalmente** `avatar_composite_score` como um KPI C5 derivado —
   documentando explicitamente que ele é um resumo de conveniência para a lista
   de carteira e que os cortes 70/85 são uma escolha de produto separada dos
   3 KPIs C1 refinados (não um substituto deles).
3. **Reescrever** `compute_avatar_alignment()` para implementar de fato os
   desvios em pp com os guards do Doc2, e então decidir se o composite 0.4/0.4/0.2
   continua fazendo sentido sobre os novos scores.

## Consequências se nada for decidido
O card de saúde de carteira (o que o cliente/gestor vê primeiro) continua
refletindo a metodologia que o próprio time já rejeitou por escrito no Doc2 —
inclusive o exemplo que o Doc2 cita (CP em SP com 8.9% "invalidaria uma conta
nacional" pela regra antiga de cidade).

## Evidência
- `20260925dump_orbit.sql`, função `compute_avatar_alignment`, linhas ~273–344
- `20260925dump_orbit.sql`, coluna `ig_audience_snapshots.avatar_composite_score`, linhas ~1419–1440
- `20260925dump_orbit.sql`, views de health_status, linhas ~1720–1790
- `src/lib/repositories/contentContractEngine.ts:875` (`resolveAvatarAlert`, não chamada em nenhum outro arquivo)
