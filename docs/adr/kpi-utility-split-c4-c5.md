# ADR — Utilidade: caption × saves+shares/reach (KCR-C4 e C5)

Status: aceito em 2026-10-03.

## Contexto
Dois cálculos diferentes circulavam como "Utilidade":
- keyword count na legenda, escala 0–100, via orbit.calc_utility_score_pct(caption);
- (saves + shares) / reach_total × 100, dos Insights da conta (ig_account_snapshots).
O Overview exibia 0,05% sob o rótulo "Utilidade", sem tradução nem régua.

## Decisão
1. Dois kpi_id: `utility_caption` (proposta, L2) e `utility_score_pct` (vigente, L2).
2. `utility_score_pct` lê só ig_account_snapshots. Não lê ig_posts.utility_score_pct.
3. Nenhum dos dois tem tela por enquanto (`screens: []`). Não rotular de "Utilidade" na UI.
4. C5: o RWP-1 remove o tile do Overview. Não recoloca o tile.

## Alternativas recusadas
- Um único id "utilidade": mistura dois cálculos com unidades diferentes.
- Recalibrar a v2 de utilidade nesta quinzena: está no backlog congelado.

## Consequências
- O tile só volta com uma nova ficha que tenha tradução e régua, e uma nova decisão.
- Qualquer tela que exiba utilidade precisa citar qual dos dois kpi_id usa.