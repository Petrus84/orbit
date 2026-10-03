ctr_below_threshold_alert — dead_writer; NÃO ligar neste sprint
polemic — vigente no Alpha; Doc1>20% RECUSADO; nome Doc1 ≠ Doc2
utility — Doc2 = Insights sem semáforo 2%; Overview 0,05% = este token; screens=[] no herói
er_real / vps — inclusos no papel; skip no herói (MARKET_RPC + saves 7,6%)
category — 1/5 no Alpha; bloqueia “par do setor”
2026-09-28 | djcaiodogao | setor_benchmark=membership_assinatura_comunidade
→ benchmark_category=infoprodutor_autoridade_personal (decisão manual;
base: SSOT v1.3 seção 2.4 / linha 107, que mapeia segment 6_membership_comunidade;
sem regra em mapSegmentToCategory). Gravado errado como comercio_direto_ecommerce_social
por 11 min (02:04–02:15) e corrigido. Nenhum dado derivado afetado.
utility_caption = derivado de caption/metadata (o texto/estrutura da legenda), não do score agregável.
utility_score_pct = derivado do cálculo percentual do “score”, não do caption.
2026-09-29 KCR-C2: engagement_public + play_to_view_ratio vigentes.
Não restaurar tela de Overview (screens=[]) até RWP-1.
play_to_view_ratio: só FormatPerformanceTable (por post).
2026-09-29 KCR-C3: play_to_view_ratio é cálculo (reel_plays/reel_views), não coluna.
Se instagramOverviewRepository.ts:570 tenta SELECT direto, corrigir para cálculo.
# ADR: Separação de Utilidade (C4–C5)

## Contexto
Antes: `ig_posts.utility_score_pct` misturava:
- Intenção comercial da legenda (keyword count)
- Taxa saves+shares/reach (Insights)

## Decisão
Separar em dois tokens:
1. `utility_caption`: keyword count na legenda (proposta, fase 1, screens=[])
2. `utility_score_pct`: saves+shares/reach (vigente, fase 3, screens=[] até C5)

## Consequência
- Coluna `ig_posts.utility_score_pct` ainda existe (compatibilidade).
- Novo token `utility_caption` não tem call site em produção.
- Overview não renderiza nenhum dos dois até C5.
2026-09-29 KCR-C5: tile Utilidade (0,05%) some do Overview.
Motivo: sem tradução de unidade (snapshot vs post; saves/shares vs caption).
Volta em RWP-1 quando houver tradução.
2026-09-29 KCR-C6: avatar_gender, avatar_age, avatar_city vigentes com BUG FALLBACK_PCT=0.
Não corrigir nesta quinzena (backlog congelado).
EM CURSO: KCR-C1, KCR-C2, KCR-C3, KCR-C4, KCR-C5, KCR-C6, KCR-C7, KCR-C8
BLOQUEADO: OGP-* (espera decisions.md), RWP-*, SSC-*, L3-*
PROIBIDO: ALTER, dead_writer, tile novo, /avatar, restaurar órfãos

DoD KCR: decisions.md com 6 vereditos + commit registry.json
