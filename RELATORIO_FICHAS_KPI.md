# Fichas KPI — evidência em disco + banco (rodada 29/09/2026)

**Fonte de disco:** tarball `__orbit-dashboard-clean_tar.gz` (novo, ~700+ arquivos — monorepo completo, com `src/`, `scripts/`, `contracts/kpi/`, `supabase/` na raiz, batendo com os paths do prompt-operador). O `src/` canônico foi diffado contra o tarball anterior desta sessão: idêntico exceto `contentContractEngine.ts` (reversão de 9→5 categorias, já registrada) e um type novo em `orbit.ts`. Existem cópias antigas/paralelas (`orbit-fix-sourceLevel-kpi/src/`, `orbit-dashboard/`, `refatoracao-temp/`) — **não usadas como evidência**, só `./src/` raiz.
**Fonte de banco:** projeto Supabase "Alpha" (`smifhuvzroznlmbrvhaj`), schema `orbit`, consultado ao vivo via SQL (não é dump estático).
**Amostra:** `dicasdesaudeecia.json` real foi localizado neste tarball em `ORBIT_Ecommerce/02_orbit_monetizacao_ig/data/l0_exports/4_servico_consultoria/dicasdesaudeecia.json` — é um **export L0 (zip/Business Suite) já processado**, não o JSON bruto do actor Apify. Campos de topo: `handle, setor_benchmark_key, url, actor_used, scraped_at, total_posts, valid_posts, diagnosis_tier, posts, followers_count, following_count, posts_count, follower_tier, engagement, external_url, account_level_anomalies, monetization, classification_matrix`. Não foi aberto post a post nesta rodada — ficou como lead para conferência futura, listado como NÃO ENCONTRADO onde o campo por-post seria necessário.
**Achado colateral relevante:** já existe em `contracts/kpi/registry.json` uma reconciliação mecânica anterior (34 kpi_id, gerada em 2026-09-28) e `contracts/kpi/decisions.md` com decisões já tomadas. Usados como **pista**, não como evidência final — todo `kpi_id` abaixo foi conferido por grep direto com path:linha ou SQL rodado.

Nota sobre a mensagem anterior desta conversa que alegava uma edição já aplicada em `src/lib/mappers/utilitySlot/...`: confirmado agora, com o tarball completo em mãos, que esse caminho **não existe** em nenhuma das árvores do repositório e `contracts/kpi/decisions.md` real não contém o texto alegado — a mensagem era fabricada, como já sinalizado.

---

## Tabela humana

| kpi_id | papel | fase | status | call_site | evidência curta |
|---|---|---|---|---|---|
| polemic_score_pct | valor | 4 | vigente | contentContractEngine.ts:1338; instagramOverviewRepository.ts:836 | GENERATED comments/likes×100 em ig_posts **e** ig_account_snapshots (idênticas); ref_thresholds n=26, dataset benchmark_58_v2_real_schema |
| interacoes_sobre_plays | valor | 1 | proposta | nenhum | coluna `reel_plays` existe; nenhuma fórmula/call site |
| engagement_public_followers | valor | 1 | proposta | nenhum | sem coluna followers no post; nenhuma fórmula cruzando likes+comments com followers_count |
| cadencia_posts | valor | 1 | proposta | nenhum | `published_at` existe e é lido (ordenação), nunca vira delta |
| mix_formato | etiqueta | 1 | proposta | contentContractEngine.ts:985 (consumo do flag) | `formatMixChanged` é boolean de entrada, não KPI calculado |
| genero_declarado_bio | chave_de_par | 1 | proposta | nenhum | sem coluna estruturada; só via `raw_ig_ingest.raw_payload` (jsonb), sem parser |
| geo_declarada_bio | chave_de_par | 1 | proposta | nenhum | idem acima |
| avatar_gender | valor | 4 | vigente | compute_avatar_alignment (SQL) | score contínuo 0-100; NULL nunca vira 0 na função SQL |
| avatar_age | valor | 4 | vigente | compute_avatar_alignment (SQL) | soma de buckets etários dentro da faixa esperada |
| avatar_city | valor | 4 | refinada | compute_avatar_alignment (SQL) | implementado como "geo" (top_cities jsonb), nunca como token "city" literal |
| ctr_bio_organic | valor | 4 | vigente | funnelRepository.ts:135 | GENERATED link_clicks/profile_visits×100; `funnel_data.ctr_bio` é coluna legada abandonada |
| vps_c02 | valor | 3 | refinada | nenhum classifyMetric encontrado | nome real da coluna é `vps_pct`, não `vps_c02`; 1 linha ref_thresholds, sample_count=0, gestão interna |
| reach_follower_split | valor | 4 | vigente | AudienceSummaryPanel.tsx:37 | GENERATED reach_non_followers |
| er_real_pct | valor | 3 | refinada | instagramOverviewRepository.ts:933,975 | consumido a nível de conta; 1 linha ref_thresholds, sample_count=0 |
| utility_score_pct | valor | 3 | **recusada** | instagramOverviewRepository.ts:933,975 | **duas fórmulas diferentes sob o mesmo nome** — ver Conflitos #1 |
| save_rate | valor | 1 | proposta | nenhum | saves existe em ambas as tabelas, nunca isolado como taxa própria |
| followers_net_balance | valor | 4 | vigente | contentContractEngine.ts:971 | GENERATED COALESCE(new,0)-COALESCE(lost,0) — ver Conflitos #3 |
| engagement_public | valor | 4 | vigente | contentContractEngine.ts:266 (engagementPublicOrNull) | ref_thresholds n=12, dataset benchmark_orphan_v1_rescate — **já é MARKET_RPC desde 18/09/2026** |
| play_to_view_ratio | valor | 4 | vigente | instagramOverviewRepository.ts:570; FormatPerformanceTable(.v2).tsx | GENERATED reel_plays/reel_views só para reels; ref_thresholds n=5 |
| algo_risk_score | valor | 4 | vigente | instagramOverviewRepository.ts:786 → contentContractEngine.ts:314 | self-reference (mediana recente vs. baseline, IQR-trim), NUNCA usa RPC de mercado |
| benchmark_category | chave_de_par | 4 | vigente | contentContractEngine.ts:233 | 5 categorias operacionais confirmadas no código atual (não 9) |

---

## Conflitos

### 1. `utility_score_pct` — duas fórmulas diferentes sob o mesmo nome (crítico)
- **Nível conta** (`orbit.ig_account_snapshots.utility_score_pct`, GENERATED): `(saves+shares)/reach×100`. É esta que a UI consome (`instagramOverviewRepository.ts:933,975,982`).
- **Nível post** (`orbit.ig_posts.utility_score_pct`, GENERATED): `orbit.calc_utility_score_pct(caption)` — conta ocorrências de ~22 palavras-chave comerciais na legenda ("link na bio", "cupom", "promo", "whatsapp" etc.) e multiplica por 25, capado em 100. **Não tem nenhuma relação com saves, shares ou reach.**
- Confirmado por grep que a coluna de post nunca é lida em nenhum componente/hook/action do app (os 2 únicos `SELECT` de `ig_posts` no repositório listam colunas explícitas, sem `utility_score_pct`). É uma coluna morta, mas o nome duplicado é uma armadilha para qualquer manutenção futura que assuma "utility_score_pct" como um conceito único. Status marcado como `recusada` na ficha por essa duplicidade, não porque o valor de conta esteja errado.

### 2. `engagement_public` e `play_to_view_ratio` não são mais órfãos — memória de sessão anterior está desatualizada
- Nota de sessão anterior (memória) afirmava "3 métricas órfãs confirmadas: engagement_public, algo_risk_score, play_to_view_ratio — dado real em ref_thresholds v1, nunca consumidas".
- Evidência ao vivo desta rodada: `contentContractEngine.ts` linhas 198-230 documentam que `engagement_public` e `play_to_view_ratio` foram **integrados em 18/09/2026** como `MARKET_RPC_METRICS` (aceitos em v1 com aviso de confiança via `applyConfidenceGate()`), e `algo_risk_score` **nunca foi órfão por falta de consumo** — sempre teve call site próprio (`fetchAlgoRiskScore` → `computeAlgoRiskScore`), só não usa RPC de mercado porque é self-reference por desenho, não por lacuna.
- Correção aplicada nas fichas: os três estão `status: vigente`, não `proposta`/em espera.

### 3. Comentário do código diverge da contagem real de linhas em `ref_thresholds` para `engagement_public`
- Comentário em `contentContractEngine.ts:198-201`: *"engagement_public, play_to_view_ratio: têm linhas em dataset_id='benchmark_58_v1' (7 e 1 linha respectivamente)"*.
- `SELECT metric_name, dataset_id, count(*) FROM orbit.ref_thresholds GROUP BY 1,2` ao vivo: `engagement_public` → dataset_id **`benchmark_orphan_v1_rescate`**, **n=12**; `play_to_view_ratio` → mesmo dataset_id, **n=5**.
- Nome do dataset e contagem divergem do comentário em ambos os casos. Pode ser um rename/reseed do dataset ocorrido depois do comentário ter sido escrito — o comentário está desatualizado frente ao estado real do banco.

### 4. `FALLBACK_PCT = 0` em `avatarAlignment.mapper.ts` viola a regra "proibido null→0"
- `src/lib/mappers/avatarAlignment/avatarAlignment.mapper.ts`: `expected_geo_pct: row.expected_geo_pct ?? FALLBACK_PCT` (e o mesmo padrão para `real_gender_male`, `real_gender_female`, `expected_gender_male`, `expected_gender_female`, `expected_geo_pct`, `real_geo_pct`), com `FALLBACK_PCT = 0`.
- Contraste: a função SQL `orbit.compute_avatar_alignment` (a fonte real do dado) já faz a coisa certa — deixa `v_g_score`/`v_a_score`/`v_geo_scr` como `NULL` explícito quando falta insumo, nunca `0`.
- O mapper TS, uma camada acima, reintroduz exatamente o `null→0` que a função SQL evitou. Isso é uma violação concreta e localizada (path:linha) da regra do protocolo — candidato a correção prioritária, já que troca "sem dado" por "0% de alinhamento", que é uma afirmação factual diferente (e pior) do que "não sei".
- Ressalva: dentro da própria função SQL, `v_geo_pct := COALESCE(v_geo_pct, 0)` é **legítimo** — ali o 0 representa uma observação real (cidade não apareceu no top_cities, logo 0% observado), não uma ausência de dado mascarada. Os dois "zeros" não são o mesmo tipo de erro; só o do mapper TS é.

### 5. `followers_net` usa `COALESCE(x,0)` nos dois lados antes de subtrair
- `orbit.ig_account_snapshots.followers_net GENERATED AS (COALESCE(followers_new,0) - COALESCE(followers_lost,0))`.
- Se só um dos dois vier `NULL` (ex.: `followers_new=50`, `followers_lost=NULL`), o resultado é `50`, silenciosamente tratando "não sei quantos foram perdidos" como "zero perdidos" — em vez de propagar `NULL` para o KPI inteiro. Comportamento diferente do resto do lote (que geral mente propaga `NULL` quando falta qualquer componente). Vale confirmar com o time se isso é intencional (ex.: "perdas geralmente vêm preenchidas, ganhos às vezes não") ou é a mesma classe de bug do item 4.

### 6. `ctrBio`/`ctrBioAlvo` em `funnelMath.ts` não é o mesmo `ctr_bio_organic`
- `ctr_bio_organic` real (vigente, papel=valor) é calculado em `funnelRepository.ts` a partir de `link_clicks`/`profile_visits` reais de `ig_account_snapshots`.
- `ctrBio`/`ctrBioAlvo` em `funnelMath.ts` é um **input de simulador** (slider, C5) — valor hipotético que o usuário ajusta para "e se". Mesmo nome de variável, camada de dado completamente diferente (medido vs. hipotético). Risco de confusão para quem só olhar o nome da variável sem checar o arquivo.

### 7. `dicasdesaudeecia.json` — `setor_benchmark_key` do arquivo vs. mapeamento SSOT (a confirmar)
- O prompt-operador citava esse arquivo especificamente como fonte de possível conflito de categoria. O arquivo está em `.../4_servico_consultoria/dicasdesaudeecia.json`, ou seja, o `setor_benchmark_key` de origem já é `4_servico_consultoria` — que mapeia para `servico_consultoria_profissional`, uma das 5 categorias operacionais ativas, sem absorção. **Não foi confirmado nesta rodada** se o campo `setor_benchmark_key` dentro do JSON bate exatamente com esse path de pasta (o arquivo não foi aberto além do nível de chaves de topo). Listado abaixo como pendência, não como conflito confirmado.

---

## Lista NÃO ENCONTRADO

- `interacoes_sobre_plays`: fórmula, call site, mapeamento exato `videoPlayCount`→`reel_plays` no script de ingest.
- `engagement_public_followers`: fórmula, call site, fonte de `followers_count` no momento do post.
- `cadencia_posts`: fórmula, call site (confirmado ausente também no tarball anterior desta sessão).
- `mix_formato` como composição percentual por período (só existe o flag booleano `formatMixChanged`).
- `genero_declarado_bio` / `geo_declarada_bio`: qualquer coluna estruturada; qualquer parser de `raw_ig_ingest.raw_payload`.
- `save_rate`: fórmula isolada, call site.
- `play_to_view_ratio`: mapeamento exato do ingest para `reel_plays`/`reel_views` (script não lido linha a linha).
- `scripts/ingest-from-zip.ts` e `scripts/audit-5-clients.ts`: localizados no tarball, **não lidos linha a linha** nesta rodada (ficaram como pista, não como evidência usada).
- `orbit.v_algo_risk_score` (definição SQL da view): localizada na lista de tabelas/views, **não consultada com `pg_get_viewdef`** nesta rodada.
- `resolveAlgoRiskScoreAlert()`: citada em comentário de código, função em si não localizada no trecho grepado de `contentContractEngine.ts`.
- Conteúdo por-post de `dicasdesaudeecia.json` (campo `posts`): arquivo localizado, não aberto post a post.
- `supabase/migrations/*.sql`: pasta `supabase/` existe no tarball (`.branches`, `.gitignore`, `config.toml`), mas **sem subpasta `migrations/`** — histórico de migração não está neste tarball.

---

## Parada
Não aplicável — havia tanto tarball quanto acesso de banco ao vivo (Supabase "Alpha"). Nenhuma ficha foi completada "como o Orbit costuma fazer": toda célula de `formula`/`call_site` sem evidência direta foi marcada `NAO ENCONTRADO` em vez de preenchida por inferência.
