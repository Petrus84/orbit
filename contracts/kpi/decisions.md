# Vereditos KCR

## KCR-C1 — fechado

2026-10-02 KCR-C1: engagement_public.output.unit = count. Não é percentual.

## KCR-C2 — fechado

2026-10-02: engagement_public e play_to_view_ratio permanecem vigente, sem tela de Overview.
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
2026-10-02: correção: RWP-1 só confirma a saída. Não recoloca o tile. fora do overview.
2026-10-05: decisão tomada; a remoção do tile é executada no RWP-1.

## KCR-C6 — adiado

2026-09-29 KCR-C6: FALLBACK_PCT=0 no mapper de avatar. Não corrigir nesta quinzena. /avatar fora do sprint.

## KCR-C7 — adiado

2026-10-02 KCR-C7: reach_follower_split — adiado. Não calcular nesta quinzena. Tela AudienceSummaryPanel fora do sprint.

## KCR-C9 — adiado

2026-10-02: followers_net_balance: COALESCE faz NULL virar 0. Contraria algo_risk_score ("nunca 0 por ausência").
Ficha segue vigente. Não corrigir nesta quinzena. Não tratar como bug de tela.

## Fora do gate

ctr_below_threshold_alert: dead_writer. Não ligar neste sprint.
C8 riscado: não é verdade que só algo_risk_score e polemic_score_pct têm call site.
EXCEÇÃO djcaiodogao 2026-09-28: setor_benchmark (onboarding) = membership_assinatura_comunidade; benchmark_category (clients) = infoprodutor_autoridade_personal, definido manualmente. O valor comercio_direto_ecommerce_social (11 min) foi erro de digitação, corrigido.

## OGP-R1 — fechado

2026-10-04: 5/5 com benchmark_category.
Query: clients LEFT JOIN client_onboarding. setor_benchmark não é coluna de clients.
djcaiodogao: override manual já registrado, não é drift.
cpimportstore, dogativo, mauricioartphoto = comercio_direto_ecommerce_social.
eupetruchio84 = servico_consultoria_profissional.

## OGP-A1 — fechado

2026-10-04. Janela 2025-12-31 a 2026-09-26. posts/semana = n / (dias_da_janela/7). Sem ALTER.
cpimportstore: 18 posts, 0,47/sem; reel 83,3, carousel 11,1, static_post 5,6.
djcaiodogao: 0 posts. cadencia_posts e mix_formato = sem_base. Não é 0.
dogativo: 278 posts, 7,23/sem; static_post 50, reel 50.
eupetruchio84: 11 posts, 0,29/sem; static_post 54,5, reel 45,5.
mauricioartphoto: 36 posts, 0,94/sem; carousel 58,3, reel 22,2, static_post 19,4.
Tokens proposta, screens=[]. Não sobem ao Overview.

## OGP-P2 — parcial (superado por "fechado como ausência" e pela atualização no fim do arquivo)

2026-10-05. Janela 2025-12-31 a 2026-09-26.
cpimportstore: 15/15 com play. APPLY erros=0. 8 shortcodes Apify sem post, não inseridos.
djcaiodogao: 0 reels na janela. 35 vídeos Apify sem post. sem_base. Não inserir.
mauricioartphoto: 8 reels sem play. Arquivo com 33 shortcodes, 0 matches. Aberto.
eupetruchio84: 5 reels sem play. Fonte não aplicada. Aberto.
dogativo: 139 reels sem shortcode e sem play. Não é lote Apify. Aberto.

## OGP-P2 — fechado como ausência

2026-10-05. mauricioartphoto: IN dos shortcodes Apify = 0 linhas. Fonte sem post, não erro de ratio.
djcaiodogao: sem_base. dogativo: sem shortcode, fora do Apify. eupetruchio84: play ausente, fonte não aplicada.
cpimportstore: 15/15 com play. NULL não virou 0. Órfãos não inseridos.

## OGP-R2 — fechado, não é conflito

2026-10-05. Nenhum handle das 5 tem três rótulos.
djcaiodogao: comercio_direto_ecommerce_social foi erro de digitação (11 min, 28/09), corrigido.
Categoria vigente: infoprodutor_autoridade_personal. Sem dado derivado afetado.
Não há override de negócio além dessa correção. Cartão não reabre.

## OGP-P2 — atualização após ingest — 2026-10-05

mauricioartphoto: 7 de 10 reels com play via --match=date; shortcode não gravado; 26 órfãos não inseridos. Substitui o "0 matches" das seções acima.
djcaiodogao: 126 de 185 reels com play e shortcode (soma 171.140 plays). Posts de 2024-11-28 a 2025-11-26, fora da janela: nenhum card muda; segue sem_base na janela.
2026-10-05 Dívida: published_at diverge por cliente (mauricio UTC exato; cpimportstore ~+4h; djcaiodogao -8h truncado ao minuto). Bloqueia comparação por data no SSC.
cpimportstore 15/15. Linha antiga "djcaiodogao 0 reels, 35 sem post" estava errada.

## Gaps de tela e código — 2026-10-05

gap de tela: tile play_to_view_ratio aparece no Overview, mas a ficha C2 diz sem tela de Overview. Não corrigir no RWP-1; decidir se vira RWP-1b.
gap de código: instagramOverviewRepository.ts:975 checa utility_score_pct nulo junto com er_real_pct e polemic_score_pct. Com o tile fora, a utilidade não deveria bloquear os outros dois. Não corrigir no RWP-1.

## 2026-10-13 SSC-1

polemic_score_pct do Overview e do alerta = mediana por post
de (comments/likes × 100) no header, likes > 0, n ≥ 5.
NULL se n < 5 ou sem likes. Snapshot e soma ponderada
não são o oráculo. 20% recusado.

## 2026-10-13 SSC-2

cadencia_posts vigente = postsPerWeek sobre janela efetiva
(header ∩ coleta), n ≥ 3.
postsPerWeekActive = informativo, não é o oráculo.

## VAL-1 — fechado

2026-10-14: promessa principal = previsão (simulação de alcance) com benchmark horizontal como régua. Insights compara a conta com ela mesma; o ORBIT compara com o segmento.
reach_simulation é autorreferente (ref_thresholds metric='reach', category='self_reference', n 14-17, conf 0,30). Não existe benchmark de alcance por setor. Não escrever "benchmark do setor" para alcance.

## VAL-2 — fechado

2026-10-14: cobertura de benchmark verificada em ref_thresholds. polêmica v2 nos 5 segmentos (conf 0,74-0,88); engajamento público e play/view são v1 legado e saem rotulados "referência v1". ER Real e VPS sem benchmark de mercado (n=0): não vão a público.
Régua de afirmação (benchmark_cell_resolution): n>=100 e conf>=0,70 = "comparado ao segmento"; 30<=n<100 = "referência preliminar"; abaixo disso, não comparar.

## VAL-3 — fechado

2026-10-14: polêmica = mediana por post de comments/likes*100; n<5 retorna null; sem fallback para snapshot; 20% fixo recusado. A ficha polemic_score_pct já guarda "mediana_conta, não média_post"; o registry legado (34 fichas) ainda diz "substituir_20pct_por_RPC" e fica superado.
Número de polêmica de cliente real não vai a público (A.C.: snapshot 25% sobre 4 curtidas contra 5 comentários em 144 curtidas nos 11 posts).

## VAL-4 — aberto

2026-10-14: infoprodutor_autoridade_personal tem 1 célula de polêmica (n=37) e n=35-38 em engajamento e play/view; o benchmark forte está em infoprodutor_educador_pago e autoridade_personal_branding_b2b. Decidir o mapa entre as categorias antes de prometer benchmark de infoprodutor.

## VAL-5 — aberto

2026-10-14: conversion_rate_pct existe em células de 4 dos 5 segmentos (não em monetizacao_nativa_plataforma), mas a origem não está documentada nos contracts. Sem fonte, a ficha conversion_rate_ref não passa a vigente e o número não é publicado.

## VAL-6 — aberto

2026-10-14: o motor do 160 projetado (faixa 84-263) do teste CP não está no repo nem no banco. Registrar de onde vem ou reconstruir a partir dos 16 reels.
Contas de prova hoje: cpimportstore 18 posts (0,47/sem, 15/15 reels com play); eupetruchio84 11 posts (0,29/sem). Abaixo de 14 posts com reach não há simulação (self_reference n_min=14). A cadência do fundador é pré-requisito do plano de vendas.

## Nota de higiene

2026-10-14: contracts/kpi/registry.json do zip (34 fichas, formato legado status_doc2) não é o registry vigente; o vigente é o runtime-alpha.json (22 fichas, formato KpiContract). registry.proposed.json = 22 vigentes + 5 propostas de valor.
