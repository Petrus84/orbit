# Resposta ao prompt INGEST-MAP-MULTI-REDE

O transcript só chegou ao perfilamento (Passo 1 e dados brutos do Passo 2). Passos 3 e 4 nunca foram escritos. O que segue aplica o prompt sobre os fatos que as saídas dos scripts mostram. Cada afirmação sem base nessas saídas está marcada como **LACUNA**.

Para economizar espaço, o veredito do Passo 3 aparece como coluna na tabela do Passo 2, e o Passo 4 só resume o que vem de lá.

## Passo 1: arranjo do zip

| Arquivo | Rede | Formato / raiz | Registros | Contas | Posts | Tempo | Preenchimento |
|---|---|---|---|---|---|---|---|
| X/account_analytics_content_2025-12-01_2026-09-29.csv | x | csv, linha de cabeçalho | 172 | 1 (DogAtivo, pelas URLs) | 172 | Data "Mon, Aug 17, 2026", de 2025-12-01 a 2026-08-17, sem hora | 17 colunas, 0 null. "Cliques de link permanente" é sempre 0. |
| X/account_overview_analytics (2).csv | x | csv | 303 dias | não identificada no arquivo | n/a | 2025-12-01 a 2026-09-29 | 14 colunas, 0 null. "Visualizações de vídeo" e "de mídia" são sempre 0. |
| X/account_overview_analytics (3).csv | x | csv | 303 dias | idem | n/a | idem | Idêntico ao (2) em todas as linhas, exceto 29/09 (impressões 229 vs 267). |
| X/video_overview_analytics (1).csv | x | csv com 2 tabelas | 365 dias + 30 vídeos | sem handle | 30 vídeos | 2025-09-30 a 2026-09-29; vídeos de 2026-01-17 a 2026-08-08 | Tabela diária: 6 colunas, 0 null. Tabela de vídeos: "Data de publicação" e "Postar link" 100% vazias (30/30). |
| Linkedin/AggregateAnalytics_…xlsx (2 arquivos) | linkedin | xlsx com 6 abas | ver abas abaixo | 1, só no nome do arquivo | 1 na lista de topo | dd/mm/aaaa, 03/10/2025 a 02/10/2026 | Conteúdo idêntico célula a célula (0 diferenças); o md5 difere. Todos os valores vêm como string. |
| instagram-caiopanighel…/logged_information/audience_insights.json | instagram | object | 1 | 1, só na pasta | n/a | período "Aug 29 - Nov 26" | 22 campos, todos preenchidos |
| …/content_interactions.json | instagram | object | 1 | idem | n/a | idem | 30 campos, todos preenchidos |
| …/posts.json | instagram | object | 26 | idem | 26 | "Nov 20, 2025 1:46 am", de 2024-12-14 a 2025-11-20 | 8 campos sempre preenchidos; "External link taps" em 6/26; "Business Address Taps" em 1/26 |
| …/media/posts_1.json | instagram | array | 30 (34 mídias) | idem | 30 | epoch, de 2024-12-14 a 2025-11-20 | só uri, timestamp e título (26/30 com título) |
| …/media/reels.json | instagram | object | 185 | idem | 185 reels | epoch, de 2024-11-28 a 2025-11-26 | só uri, timestamp e título (174/185 com título) |
| cpimportstore/ (60 arquivos) | instagram | 58 json + 2 txt | ver abaixo | 1, só na pasta | 3 posts, 12 reels, 14 stories | 2026-05-18 a 2026-06-11 | ver abaixo |

**LinkedIn, abas:**
- Descoberta tem 2 métricas.
- Engajamento tem 365 dias.
- Publicações mais em alta tem 1 post, na lista de impressões; a lista de engajamento está vazia.
- Seguidores tem o total e 365 dias.
- Dados demográficos do público tem 58 linhas.
- Dados demográficos do conteúdo tem 7 linhas.

**cpimportstore, arquivos com métricas:**
- audience_insights, período "Apr 2 - Jun 30", 1 registro.
- content_interactions, 2 registros idênticos (duplicado).
- profiles_reached, 1 registro.
- posts_insights, 1 post (criado em 2026-05-18 23:36).
- posts_media, 3 posts.
- reels.json, 12 reels, sem métricas, só uri, timestamp e título.
- stories.json, 14 stories, sem métricas.
- live_videos, 3 registros, todos "--" ou 0.
- igtv_information, 6 registros.
- eligibility, 2 registros.

**Divergência em estrutura.txt (cpimportstore):**
- Lista `posts.json` e `posts_1.json`, que não existem no zip.
- Não lista `posts_insights.json`, `posts_media.json` nem `posts_you're_interested_or_not_interested_in.json`, que existem.
- É de 18/06; os json são de 04/07.
- Os dois .txt (`estrutura.txt`, `preview_json_completo.txt`) são meta-arquivos, sem métrica.

**Não foi enviado nenhum arquivo de TikTok.** TikTok fica `nao_alimentado` por ausência total.

## Passos 2 e 3: campos numéricos e veredito

Convenções:
- A coluna "n" é preenchido/null.
- A coluna "ex." é o exemplo.
- O kpi_id só é nomeado quando o prompt o cita (`ig_posts.likes`, `reach_followers_pct`, `avatar_*`, `link_clicks`, `profile_visits`, `polemic_score_pct`). Os demais usam nome descritivo, porque o runtime não foi fornecido.

### X: content (172 posts, 0 null)

| Campo | Soma / faixa | Unidade | Veredito |
|---|---|---|---|
| Impressões | 480.819; 70–9.956 | count | convergente (impressions, não reach) |
| Curtidas | 5.409; 0–764 | count | convergente (likes) |
| Respostas | 119; 0–7 | count | convergente (comments) |
| Itens salvos | 1.720; 0–327 | count | convergente (saves ~ bookmark) |
| Compartilhamentos | 68; 0–5 | count | convergente, com ressalva: não é repost |
| Reposts | 425; 0–66 | count | raw_only |
| Engajamentos | 16.162; 0–1.616 | count | raw_only (agregado do X) |
| Novos seguidores | 356; 0–140 | count | raw_only (atribuição por post) |
| Visitas ao perfil | 5.009; 0–543 | count | convergente (profile_visits) |
| Cliques de URL | 373; 0–84 | count | convergente (link_clicks) |
| Expansões de detalhes | 2.487; 0–118 | count | raw_only |
| Cliques de hashtag | 272; 0–28 | count | raw_only |
| Cliques de link permanente | 0; sempre 0 | count | ignorar |
| Texto do post | 172 preenchidos; ex. "@AllPop_BR Delícia" | texto | raw_only (47 posts começam com "@", ou seja, replies) |
| ID, Data, Postar link | 172 distintos | id/data/texto | identificadores |

Checagem: `Engajamentos` ≥ curtidas + respostas + reposts em 172/172 posts (diferença de 0 a 782). Não existe quote_count, followers_count total nem hora de publicação.

### X: overview (303 dias, 0 null)

| Campo | Soma | Veredito |
|---|---|---|
| Impressões | 718.746 | convergente |
| Curtidas | 7.296 | convergente |
| Respostas | 147 | convergente |
| Itens salvos | 2.475 | convergente |
| Compartilhamentos | 116 | convergente |
| Visitas ao perfil | 6.601 | convergente |
| Engajamentos | 17.269 | raw_only |
| Novos seguidores | 2.388 | raw_only |
| Deixar de seguir | 312 | raw_only |
| Reposts | 634 | raw_only |
| Criar post | 98 | raw_only |
| Visualizações de vídeo e de mídia | 0 | ignorar (sempre 0) |

### X: vídeo

Tabela diária (365 dias, 0 null):

| Campo | Valor | Veredito |
|---|---|---|
| Visualizações | soma 213.201; 1–10.766 | convergente (plays/views). **Guarda views<50: 21 dias ficam fora de qualquer agregação.** |
| Tempo de exibição | ms; soma 3.027.880.921 | convergente (tempo) |
| Tempo médio de exibição | ms; 2.001–11.025 | convergente (tempo) |
| Taxa de conclusões | pct; 0–50 | raw_only |
| Receita estimada | sempre 0 | ignorar |

Tabela de vídeos (30):
- Visualizações vão de 847 a 12.645, soma 79.393.
- Nenhum vídeo tem views<50.
- Duração está em m:ss.
- "Monetizado" é "Não" nos 30.

### LinkedIn

| Campo | Fatos | Veredito |
|---|---|---|
| Impressões (aba Descoberta) | 289 no período | convergente (impressions) |
| Impressões diárias (aba Engajamento) | 365 dias; soma 289 (bate com Descoberta); máx 129; 28 dias diferentes de zero | convergente |
| Usuários alcançados | 59 (total do período) | estimativa de reach agregado, L2. Não é reach de não-seguidor. |
| Engajamentos diários | 365 dias; 1 valor diferente de zero: **−28 em 21/09/2026** (impressões 129) | raw_only. Valor negativo é anomalia, ver lacunas. |
| Total de seguidores | 2.571 em 02/10/2026 | direto candidato (followers) |
| Novos seguidores diários | 365 dias; soma 8; 8 dias diferentes de zero | convergente |
| Publicações mais em alta | 1 post (23/09/2026, 21 impressões); lista de engajamento vazia; só URL, sem texto | raw_only |
| Demografia público | 58 linhas (Empresa 10, Localidade 10, Cargo 10, Setor 10, Tamanho 9, Nível 9); percentuais em texto, incluindo "menos de 1%" | raw_only (sem par no runtime) |
| Demografia conteúdo | 7 linhas | raw_only |

LinkedIn não tem curtidas, comentários, compartilhamentos, cliques, nem texto do post.

### Instagram (caio)

**posts.json (26 posts, 0 null nos 8 campos base):**

| Campo | Soma / faixa | Veredito |
|---|---|---|
| Impressões | 21.611; 336–1.726 | direto |
| Contas alcançadas | 20.473; 326–1.615 | direto (reach) |
| Curtidas | 742; 3–71 | direto (`ig_posts.likes`, citada no prompt) |
| Comentários | 111; 0–35 | direto |
| Salvamentos | 24; 0–4 | direto |
| Compartilhamentos | 40; 0–14 | direto |
| Visitas ao perfil | 212; 0–39 | direto (profile_visits) |
| Seguidores (ganhos por post) | 3; 0–1 | raw_only |
| External link taps | 6 posts preenchidos, 20 ausentes; valor 1 em todos | direto (link_clicks), parcial. Ausente não vira 0 (null→0 está recusado). |
| Business Address Taps | 1 de 26 | raw_only |
| Data de publicação | texto "Nov 20, 2025 1:46 am"; casa com `posts_1` por minuto em 26/26 | tempo |

**posts_1.json:**
- Só tem uri, timestamp e título.
- Nenhuma métrica.
- Título é raw_only.

**reels.json:**
- 185 reels com uri, timestamp e título.
- Nenhuma métrica por reel.
- Plays e views por reel são `nao_alimentado`.

**audience_insights.json (1 registro):**

| Campo | Valor |
|---|---|
| Total de seguidores | 13.275 (direto, followers) |
| Seguiu / Deixou de seguir / Saldo geral | 246 / 317 / −71 (raw_only) |
| Variação de seguidores | "-0,6% vs May 31 - Aug 28" (texto) |
| Cidade, país, idade, idade por gênero, % por gênero | texto composto, vírgula decimal |
| Atividade por dia da semana | 7 campos de ~6.000 |

Os campos de cidade, idade e gênero são o export oficial. O rótulo `avatar_*` exige esse tipo de fonte, mas o mapa campo→kpi não foi fornecido. Os cortes de cidade<70% e avatar<70 estão em `recusada_nao_reativar` e não foram aplicados.

**content_interactions.json (1 registro):**
- Total de interações: 1.006.
- Interações com posts: 49.
- Interações com stories: 212.
- Respostas a stories: 186.
- Interações com Reels: 745.
- Curtidas em Reels: 613.
- Comentários em Reels: 40.
- Compartilhamentos em Reels: 34.
- Salvamentos em Reels: 24.
- Contas engajadas: 342.
- Distribuição seguidores/não-seguidores: "Followers: 74.7%, Non-followers: 25.2%".
- Todos são agregados do período, sem granularidade por post (raw_only ou convergente de agregado).

### Instagram (cpimportstore)

| Arquivo | Fatos | Veredito |
|---|---|---|
| posts_insights | 1 post: impressões 237, alcance 212, curtidas 2, comentários 0, salvamentos 1, compartilhamentos 8, visitas ao perfil 3, seguidores 0 | direto (mesmos campos do caio) |
| profiles_reached | alcance 1.639; seguidores 4,4%, não-seguidores 95,6%; impressões "3,119" (vírgula de milhar como texto); visitas ao perfil 75; toques em links externos 4; toques no endereço comercial 1 | direto: `reach_followers_pct` (4,4%), `profile_visits`, `link_clicks` (agregado). Impressões exigem conversão de texto. |
| audience_insights | seguidores 14; deixaram de seguir 73; rótulo "Total de seguidores" = −59; cidade, país, idade, gênero em texto (ponto decimal) | direto para cidade, idade e gênero. **O rótulo "Total de seguidores" contém o saldo líquido (14−73), não o total. Não preenche followers.** |
| content_interactions | 225 total; posts 41; reels 180; stories 4; contas engajadas 33; "Followers: 29.4%, Non-followers: 70.6%" | convergente de agregado; 2 registros idênticos |
| posts_media | 3 posts com rótulos (ex. "Marcado como gerado por IA") | raw_only |
| reels (12) e stories (14) | sem métrica | raw_only |
| live_videos | 3 registros, todos "--" ou 0 | ignorar |
| eligibility | 2 registros (ex. BRANDED CONTENT / Eligible) | raw_only |

Os valores de texto do cp vêm em mojibake ("SÃ£o Paulo"). Os do caio vêm corretos.

### Demais arquivos do cpimportstore

Cerca de 45 arquivos são dados de conta e consumo, por exemplo: login, localização, checkout, anúncios vistos, seguindo, pesquisas, mensagens.
- Foram contados, mas não perfilados campo a campo.
- Veredito: **ignorar**. A classificação vem do nome do arquivo e da contagem de folhas, não de leitura do conteúdo.
- `last_known_location`, `checkout_payment_information`, `login_activity` e `personal_information` contêm dados pessoais e não foram inspecionados.

## Passo 4: JSON por arquivo (resumo)

```json
[
 {"arquivo":"X/account_analytics_content_….csv","rede":"x","arranjo":"csv 1 tabela, 172 linhas","contas":1,"posts":172,
  "metricas_persistidas":[{"campo":"17 colunas (ver Passo 2)","n":172,"unidade":"count/texto/data"}],
  "alimenta_direto":[],
  "convergente":[{"kpi_id":"impressions","campo_rede":"Impressões","analogo_de":"impressions","ressalva":"não é reach"},
                 {"kpi_id":"likes","campo_rede":"Curtidas","analogo_de":"ig_posts.likes","ressalva":"mapa X→Orbit não declarado"},
                 {"kpi_id":"comments","campo_rede":"Respostas","analogo_de":"comments","ressalva":"reply ≠ comentário"},
                 {"kpi_id":"saves","campo_rede":"Itens salvos","analogo_de":"saves","ressalva":"bookmark"},
                 {"kpi_id":"shares","campo_rede":"Compartilhamentos","analogo_de":"shares","ressalva":"≠ repost"},
                 {"kpi_id":"profile_visits","campo_rede":"Visitas ao perfil","analogo_de":"profile_visits","ressalva":"por post"},
                 {"kpi_id":"link_clicks","campo_rede":"Cliques de URL","analogo_de":"link_clicks","ressalva":"por post"}],
  "estimativa":[{"kpi_id":"er_parcial_x","formula_estimada":"(Curtidas+Respostas)/Impressões","falta":"reach, shares como ação","confidence":"L2"},
                {"kpi_id":"polemic_x","formula_estimada":"Respostas/Curtidas","falta":"análogo, não é polemic_score_pct","confidence":"L2"}],
  "nao_alimenta":[{"kpi_id":"followers","falta":"sem total de seguidores"},{"kpi_id":"reach","falta":"só impressões"},{"kpi_id":"audience_*","falta":"sem demografia"}],
  "raw_only":["Reposts","Engajamentos","Novos seguidores","Expansões de detalhes","Cliques de hashtag","Texto do post"],
  "proibido":["polêmica>20% (recusada_nao_reativar)"]},

 {"arquivo":"X/account_overview_analytics (2).csv e (3).csv","rede":"x","arranjo":"csv diário 303 linhas; (3) duplica (2) com 1 célula diferente","contas":null,"posts":null,
  "convergente":["impressions","likes","comments","saves","shares","profile_visits"],
  "nao_alimenta":["reach","followers (só novos/perdidos)","link_clicks"],
  "raw_only":["Engajamentos","Reposts","Novos seguidores","Deixar de seguir","Criar post"],
  "proibido":["Visualizações de vídeo/mídia sempre 0: ignorar"]},

 {"arquivo":"X/video_overview_analytics (1).csv","rede":"x","arranjo":"csv 2 tabelas: 365 dias + 30 vídeos","contas":null,"posts":30,
  "convergente":[{"kpi_id":"views","campo_rede":"Visualizações","analogo_de":"plays","ressalva":"guarda views<50: 21 dias excluídos"}],
  "raw_only":["Tempo de exibição","Tempo médio","Taxa de conclusões"],
  "proibido":["Receita estimada sempre 0: ignorar"]},

 {"arquivo":"Linkedin/AggregateAnalytics_…xlsx (2 cópias idênticas)","rede":"linkedin","arranjo":"xlsx 6 abas","contas":1,"posts":1,
  "alimenta_direto":[{"kpi_id":"followers","campo":"Total de seguidores 2571","coluna_orbit":"não fornecida","confidence":"L0|L1"}],
  "convergente":[{"kpi_id":"impressions","campo_rede":"Impressões","analogo_de":"impressions","ressalva":"total e diário"}],
  "estimativa":[{"kpi_id":"reach_agregado","formula_estimada":"Usuários alcançados 59","falta":"split seguidor/não-seguidor","confidence":"L2"}],
  "nao_alimenta":["likes","comments","shares","link_clicks","profile_visits","texto do post"],
  "raw_only":["Engajamentos (inclui −28)","demografia público","demografia conteúdo","Publicações mais em alta"]},

 {"arquivo":"instagram-caiopanighel…/logged_information/posts.json","rede":"instagram","arranjo":"object, 26 posts","contas":1,"posts":26,
  "alimenta_direto":["Curtidas→ig_posts.likes","Comentários","Salvamentos","Compartilhamentos","Impressões","Contas alcançadas","Visitas ao perfil","External link taps (6/26)"],
  "nao_alimenta":["plays/views por post"],
  "raw_only":["Seguidores por post","Business Address Taps"]},

 {"arquivo":"instagram-caiopanighel…/audience_insights.json e content_interactions.json","rede":"instagram","arranjo":"1 registro cada, agregados de 90 dias","contas":1,
  "alimenta_direto":["Total de seguidores 13.275","audiência cidade/idade/gênero (oficial)"],
  "raw_only":["Seguiu, Deixou de seguir, Saldo geral","Atividade por dia","interações agregadas"],
  "proibido":["cidade<70%, avatar<70 (recusada_nao_reativar, sem corte aplicado)"]},

 {"arquivo":"instagram-caiopanighel…/posts_1.json e reels.json","rede":"instagram","arranjo":"uri+timestamp+título","posts":"30 e 185",
  "raw_only":["título/legenda"],"nao_alimenta":["métricas por reel"]},

 {"arquivo":"cpimportstore/{posts_insights, profiles_reached, audience_insights, content_interactions, posts_media, reels, stories, live_videos, eligibility}","rede":"instagram","contas":1,"posts":"1 insights, 3 posts, 12 reels, 14 stories",
  "alimenta_direto":["posts_insights (8 campos)","profiles_reached: reach_followers_pct 4,4%, profile_visits, link_clicks"],
  "raw_only":["rótulos de posts_media","reels/stories sem métrica"],
  "proibido":["live_videos ignorar"]},

 {"arquivo":"cpimportstore/ (~45 arquivos de conta/consumo)","rede":"instagram","arranjo":"não perfilados campo a campo","raw_only":[],"proibido":["ignorar"]}
]
```

### Bloco final de convergência (sem percentil, sem recomendação de tela)

**Campos presentes nas redes com arquivo (TikTok ausente):**
- **Tempo:** IG, X e LinkedIn. IG tem hora; X e LinkedIn só dia.
- **Curtidas:** IG e X.
- **Respostas e comentários:** IG e X.
- **Compartilhamentos:** IG e X.
- **Texto:** IG (legenda/título) e X. LinkedIn só traz a URL.
- **Impressões:** IG, X e LinkedIn.

**Campos exclusivos de uma rede:**
- **X:** reposts, expansões de detalhes, cliques de hashtag, tempo de exibição de vídeo, taxa de conclusões.
- **LinkedIn:** demografia por empresa, cargo e setor.
- **IG:** reach por post, alcance por tipo de seguidor, demografia de cidade, idade e gênero, atividade por dia da semana, toques em link externo e endereço comercial.

**KPI preenchível hoje:**
- **IG (caio e cp):** impressões, reach, curtidas, comentários, salvamentos, compartilhamentos, visitas ao perfil.
  - `link_clicks` só em 6/26 posts no caio.
  - `reach_followers_pct` só no agregado do cp (4,4%).
- **X:** impressions, likes, comments (replies), saves, shares, profile_visits, link_clicks, todos convergentes, por post ou por dia.
- **X (estimativas L2):** ER parcial e `polemic_x`.
- **LinkedIn:** impressions e total de seguidores.

**KPI impossível sem export oficial adicional:**
- **X:** reach, followers (total), demografia.
- **LinkedIn:** likes, comments, shares, link_clicks, profile_visits.
- **IG:** plays e views por reel, `reach_followers_pct` por post.
- **TikTok:** tudo.

## Lacunas

1. **Runtime e registry não foram enviados.**
   - `kpi_id`, `coluna_orbit` e a definição de L0/L1 não existem no material.
   - Só os nomes citados no prompt foram usados.
   - Os campos de "alimenta_direto" têm confidence "L0|L1" sem escala definida.
2. **TikTok:** nenhum arquivo foi enviado.
3. **Granularidade do Passo 4:** são 71 arquivos, e o JSON foi agrupado por arquivo ou família, não um por arquivo. Cerca de 45 arquivos do cp não foram perfilados campo a campo, apenas contados.
4. **Arquivos pessoais do cp** (checkout, login, localização, `personal_information`) não foram lidos. Por isso "n contas" do cp e do caio vem só do nome da pasta.
5. **Contas:** o X overview e o vídeo não têm handle. O LinkedIn só traz o titular no nome do arquivo.
6. **Anomalias não explicadas pelos dados:**
   - LinkedIn tem engajamento negativo (−28 em 21/09/2026).
   - X overview "Criar post" soma 98 contra 172 posts no content. Os períodos diferem (content termina em 17/08), então não dá para reconciliar.
   - X overview mostra "Visualizações de vídeo" = 0 em todos os dias, mas o arquivo de vídeo soma 213.201 visualizações. As duas fontes se contradizem.
   - X vídeo diário soma 213.201 views contra 79.393 na tabela de 30 vídeos. O escopo difere e não foi reconciliado.
   - O content do X não tem posts após 17/08/2026, mas o overview tem impressões diárias até 29/09.
   - Em `content_interactions` do IG, a soma dos componentes não fecha o total: Reels 613+40+34+24=711 contra 745 (caio); Reels 127 contra 180 e posts 33 contra 41 (cp). A diferença não foi investigada.
   - O X overview (3) tem 29/09 = 267 e o (2) tem 229. O mais recente é provavelmente dia parcial; isso é inferência, não confirmado.
7. **Fuso horário:** o casamento de `posts_1` com `posts.json` usou UTC e fechou 26/26. O fuso de origem não é declarado nos arquivos.
8. **Formatos numéricos heterogêneos** (vírgula decimal no caio, ponto no cp, "3,119" como milhar, "menos de 1%", strings no xlsx): documentados, mas não normalizados, porque o prompt proíbe script.
9. **`estrutura.txt` e os json do cp não coincidem** (listados no Passo 1). A causa não é determinável pelos dados.