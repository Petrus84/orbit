# Vereditos KCR

## KCR-C1 — fechado
2026-10-02 KCR-C1: engagement_public.output.unit = count. Não é percentual.


## KCR-C2 — fechado
engagement_public e play_to_view_ratio permanecem vigente, sem tela de Overview.
O plano antigo pedia refinada. A decisão versionada é a do registry: vigente, screens sem Overview.
play_to_view_ratio só em FormatPerformanceTable, por post.


## KCR-C3 — fechado
2026-09-29 KCR-C3: play_to_view_ratio é cálculo (reel_plays / reel_views), não coluna.
Não criar reel_views.

## KCR-C4 — fechado
2026-09-29 KCR-C4: utility_caption ≠ utility_score_pct.
utility_caption = keyword count da legenda (proposta, screens=[]).
utility_score_pct = (saves + shares) / reach_total (vigente, screens=[]).

## KCR-C5 — fechado
2026-09-29 KCR-C5: tile Utilidade (0,05%) fora do Overview.
2026-10-02 correção: RWP-1 só confirma a saída. Não recoloca o tile.

## KCR-C6 — adiado
2026-09-29 KCR-C6: FALLBACK_PCT=0 no mapper de avatar. Não corrigir nesta quinzena. /avatar fora do sprint.

## KCR-C7 — adiado
2026-10-02 KCR-C7: reach_follower_split — adiado. Não calcular nesta quinzena. Tela AudienceSummaryPanel fora do sprint.


## KCR-C9 — adiado
followers_net_balance: COALESCE faz NULL virar 0. Contraria algo_risk_score ("nunca 0 por ausência").
Ficha segue vigente. Não corrigir nesta quinzena. Não tratar como bug de tela.

## Fora do gate
ctr_below_threshold_alert: dead_writer. Não ligar neste sprint.
C8 riscado: não é verdade que só algo_risk_score e polemic_score_pct têm call site.
djcaiodogao 2026-09-28: membership_assinatura_comunidade → infoprodutor_autoridade_personal.