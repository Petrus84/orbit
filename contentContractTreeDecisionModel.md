# ORBIT — Content Contract: Árvores de Decisão (Blocos A–C)

**Natureza deste documento:** os 29 cenários são hipotéticos — treino de lógica de decisão, não dado de cliente real. Por isso nenhuma célula aqui carrega `confidence_level: L0`; o máximo possível é `L1` (raciocínio bem fundamentado sobre premissa dada), e a maioria correta é `L2` (a resposta certa é "depende do dado que falta"). Isso não é limitação do exercício — é o próprio ponto do exercício: testar se o sistema resiste ao impulso de decidir sem o dado que falta.

**Formato por item:** Causas candidatas → Dado que decide entre elas → Árvore → Ação condicional → Métrica de sucesso → Campos do template de alerta (`probable_cause`/`immediate_action`/`severity`/`confidence_level`).

---

## Bloco A — Métrica, threshold e ambiguidade estatística

### 1 — CTR bio 1.4% (threshold 3%), 45 dias, sem mudança de bio

**Causas candidatas:** (a) bio genuinamente fraca (CTA/proposta de valor ruim); (b) tráfego de baixa intenção chegando na bio (fonte errada de visita); (c) link quebrado ou redirecionamento lento; (d) threshold de 3% é o errado pro setor desse cliente (ver Bloco A geral, achado no item 16).
**Dado que decide antes de agir:** taxa de clique segmentada por origem de visita (post vs. hashtag vs. busca) — se não existe rastreamento de origem, essa é a primeira lacuna a fechar, não a bio.
**Árvore:** link funciona? → não → conserta e reavalia em 7 dias. Link funciona → CTR varia por origem? → sim, baixo só em uma origem → problema é a origem, não a bio → não, baixo em todas → problema é a bio/oferta.
**Ação:** só reescrever a bio depois de eliminar link quebrado e confirmar que o problema é uniforme entre origens — reescrever bio contra a causa errada desperdiça o único teste limpo que a conta tem.
**Métrica de sucesso:** CTR bio > threshold do setor em 14 dias após a correção isolada (uma variável por vez).
**Alert fields:** `probable_cause`: "causa indeterminável sem quebra por origem de tráfego" (L2) · `immediate_action`: "instalar rastreamento de origem antes de qualquer mudança de bio" · `severity`: warning até a causa ser isolada.

### 2 — Alcance −40% em 60d, ER +1.2%→2.8% no mesmo período

**Causas candidatas:** (a) algoritmo reduziu distribuição, mas quem viu se engajou mais (conteúdo ficou melhor, alcance ficou pior — dois fenômenos independentes); (b) alcance caiu porque a conta afastou público de baixa intenção (ex: parou de comprar seguidor/engajamento artificial), e o ER subiu porque a base ficou mais qualificada — nesse caso não é ruptura, é saúde melhorando; (c) sazonalidade.
**Dado que decide:** saldo de seguidores no período (perda ativa vs. estagnação) + composição de formato (mudou de Reels pra Carrossel, por exemplo, o que muda ambas as métricas ao mesmo tempo por razão estrutural, não por saúde de conta).
**Árvore:** saldo de seguidores caiu junto? → sim → provável ruptura de algoritmo com base fiel reagindo melhor ao pouco que resta (mais grave). Não caiu → mistura de formato mudou? → sim → correlação espúria, não causal → não → provável melhora real de qualidade de conteúdo com alcance limitado por escala natural.
**Ação:** nunca tratar "ER subiu" como sinal de que está tudo bem sem checar saldo de seguidores primeiro — é o erro mais comum de leitura otimista.
**Métrica:** estabilização de saldo de seguidores em 30 dias como pré-condição pra classificar isso como "positivo".
**Alert fields:** `severity`: info se saldo estável, warning se saldo caindo · `confidence_level`: L1.

### 3 — Churn 1.8%–3.1%, 4 meses, sem tendência clara

**Causas candidatas:** ruído estatístico normal vs. tendência mascarada por baixo volume de amostra.
**Dado que decide:** volume absoluto de clientes na base — churn % em base pequena (ex: 20 clientes) é ruidoso por natureza; a mesma variação em base de 500 é sinal real.
**Árvore:** base > 100? → sim → calcular desvio padrão histórico do churn; oscilação dentro de 1 desvio = ruído, fora = investigar. Base < 100 → oscilação de 1.8-3.1% é matematicamente esperada por tamanho de amostra, não é decisão de negócio ainda.
**Ação:** não agir sobre churn com N pequeno — definir volume mínimo de clientes antes de tratar variação como tendência.
**Métrica:** revisitar em 90 dias com volume acumulado maior.
**Alert fields:** `severity`: info (não warning) se base pequena · `confidence_level`: L2.

### 4 — VPS calculado com amostra de 340 em perfil de 90k

**Causas candidatas:** amostra não representativa (viés de quem respondeu/foi capturado) vs. amostra estatisticamente suficiente (340 pode ser suficiente dependendo do intervalo de confiança desejado).
**Dado que decide:** margem de erro calculada pra N=340 num universo de 90k (com fórmula de amostragem padrão, ~5.3% de margem a 95% de confiança — matematicamente aceitável) **e** como a amostra foi coletada (aleatória vs. autosselecionada, ex: só quem respondeu enquete).
**Árvore:** amostra é aleatória? → sim → margem de erro aceitável, pode usar com ressalva declarada → não (autosselecionada) → viés de quem se engaja mais, número não é confiável mesmo sendo estatisticamente "suficiente" em tamanho.
**Ação:** o problema real quase nunca é o tamanho da amostra, é o método de coleta — checar isso antes de descartar o dado por "amostra pequena".
**Alert fields:** `probable_cause`: precisa declarar método de coleta, não é omitível · `confidence_level`: L2 até isso ser confirmado.

### 5 — ER 2.1% em conta de 8k vs. ER 2.1% em conta de 800k

**Causas candidatas:** N/A — a pergunta não é causal, é de calibração de referência.
**Por que são leituras diferentes:** engajamento tende a cair proporcionalmente conforme a base cresce (a mesma peça de conteúdo não alcança 100x mais gente com 100x mais intenção — a cauda de seguidores de baixa afinidade cresce mais rápido que o núcleo engajado). 2.1% numa conta de 8k é mediano; 2.1% numa conta de 800k é excelente, provavelmente no topo do setor.
**Árvore:** essa é a mesma lógica de `BENCHMARK_LIMITS` já validada no código real do Orbit para CTR/conversão por setor — precisa da mesma tabela, agora indexada por faixa de tamanho de conta, não só por setor.
**Ação:** nunca comparar ER bruto entre contas de porte diferente sem normalizar por faixa de seguidores.
**Alert fields:** `severity` desse item depende inteiramente de qual tabela de referência por porte é usada — sem ela, o alerta é inválido por definição.

### 6 — Fadiga de criativo 44% (threshold 40%) mas ROAS ainda 3.1× (meta 2.5×)

**Causas candidatas:** o criativo está fadigado mas ainda lucrativo — os dois indicadores medem coisas diferentes em horizontes diferentes (fadiga é leading indicator, ROAS é lagging).
**Dado que decide:** tendência do ROAS nos últimos 7-14 dias — se ainda está caindo do pico, a fadiga já está corroendo o resultado, só ainda não cruzou o threshold de meta.
**Árvore:** ROAS em queda mesmo acima da meta → trocar criativo agora, antes de cruzar o threshold de meta (proativo). ROAS estável/subindo apesar da fadiga → aguardar, o criativo pode estar numa fase de "fadiga declarada mas ainda efetivo", trocar cedo demais desperdiça um ativo que funciona.
**Ação:** fadiga é alerta de atenção, não gatilho automático de troca — o gatilho real é a tendência do indicador de resultado.
**Alert fields:** `severity`: warning, não critical, mesmo com fadiga acima do threshold, enquanto ROAS estiver estável.

### 7 — ROAS 3.2×→2.0× em 14d, CPM +35% no mesmo período

**Causas candidatas:** (a) leilão mais caro (sazonalidade/concorrência) explicando queda via custo, não qualidade; (b) criativo saturado (frequência alta); (c) público saturado/mal segmentado.
**Árvore de eliminação:** CPM subiu no mercado inteiro (benchmark do setor) ou só nessa conta? → mercado inteiro → sazonalidade/leilão, ação é esperar ou ajustar lance, não trocar criativo. Só essa conta → frequência do anúncio subiu junto? → sim → fadiga de criativo é a causa provável → não → público pode estar saturado (mesmo público, criativo novo, ainda cai) → testar público novo antes de qualquer outra ação.
**Ação:** nunca trocar criativo como primeira resposta a queda de ROAS sem isolar se o CPM subiu no mercado geral primeiro — é o erro mais caro do bloco inteiro, porque troca de criativo tem custo de produção e essa árvore pode mostrar que o problema nem é o criativo.
**Alert fields:** `probable_cause` obrigatoriamente cita CPM de mercado como primeira variável a checar.

### 8 — Bounce 61% (threshold <50%) mas tempo na página subiu 12s→48s

**Causas candidatas:** bounce alto tradicionalmente = página ruim; mas tempo subindo junto sugere que quem fica, lê de verdade — pode ser que o tráfego ficou mais qualificado (menos gente clicando por engano, mais gente lendo com intenção) mesmo que a taxa bruta de saída sem ação tenha subido.
**Árvore:** origem do tráfego mudou no mesmo período (novo canal, nova campanha)? → sim → o "bounce alto" pode ser efeito de composição de tráfego, não de qualidade de página → não → página pode estar sendo lida mas não convertendo (falta CTA, não falta conteúdo).
**Ação:** com esses dois sinais juntos, o diagnóstico muda de "página ruim" pra "página informativa sem CTA de conversão eficaz" — ações são opostas (uma é reescrever conteúdo, outra é só adicionar/reforçar CTA).
**Alert fields:** `severity`: warning, `probable_cause` deve citar os dois sinais juntos, nunca bounce isolado.

### 9 — Impression Share 28%, CPC 60% abaixo da média do segmento

**Causas candidatas:** orçamento limitando alcance num leilão onde a conta compra barato — sinal clássico de "verba é o gargalo, não eficiência".
**Cálculo de ROI esperado:** se CPC está 60% abaixo da média e a conta já converte no CPC atual, aumentar verba pra capturar mais do Impression Share disponível (até 100%) tem alta probabilidade de manter eficiência, porque não há sinal de que o leilão está caro pra essa conta — o oposto do item 7.
**Árvore:** conversão se mantém estável em testes de aumento incremental (ex: +20% de verba por 7 dias)? → sim → escalar mais → não (CPC sobe rápido ao aumentar) → 28% já é próximo do teto natural desse público, aumentar verba vai só encarecer, não expandir.
**Ação:** aumento incremental testado, nunca salto direto pra 100% do orçamento potencial.
**Métrica:** CPC se mantém dentro de 15% do atual após aumento de 20% de verba, em 7 dias.

### 10 — Frequência 5.2 (threshold 2.5), CTR estável em 1.8%

**Causas candidatas:** frequência alta tradicionalmente prediz fadiga (CTR caindo), mas aqui o CTR não caiu — ou a audiência é grande o suficiente pra absorver repetição sem saturar, ou a métrica de frequência está sendo calculada sobre uma base menor do que o alcance real sugere.
**Árvore:** tamanho do público-alvo da campanha vs. frequência — público pequeno + frequência alta é o padrão real de saturação; público grande + frequência alta pode ser média enganosa (poucas pessoas veem muitas vezes, a maioria vê pouco).
**Ação:** frequência alta com CTR estável não é motivo pra pausar — é motivo pra checar a distribuição de frequência por indivíduo, não só a média, antes de agir.
**Alert fields:** `severity`: info, não warning, enquanto CTR não cair — mesmo padrão do achado da Quebra 2 do documento forense original (taxa >100% = anomalia a explicar, não erro a corrigir).

---

## Bloco B — Avatar, audiência e psicográfico

### 11 — Avatar declarado M 35-44 classe A vs. avatar real via conversão F 25-34 classe B

**Árvore:** isso não é erro de dado, é dado de conversão dizendo a verdade sobre quem compra, contra um briefing que descreve quem o cliente _imaginava_ que compraria. Prioridade: dado de conversão sempre pesa mais que briefing declarado, porque é comportamento real, não intenção declarada.
**Ação condicional:** produto é vendável pro público real sem mudança? → sim → pivotar avatar de marketing pro público real, manter produto → não (produto foi desenhado especificamente pro perfil declarado) → decisão executiva mais cara: adaptar produto ou aceitar que o mercado real é menor que o imaginado.
**Métrica de sucesso em 30 dias:** CAC do público real deve ser menor que CAC do público declarado (confirma que perseguir o avatar declarado era ineficiência, não só imprecisão).
**Alert fields:** `severity`: critical (é decisão estratégica, não operacional) · `confidence_level`: L0 nos dados de conversão, L2 na recomendação de pivô (decisão de negócio, não fato).

### 12 — Score de alinhamento de gênero 52% (threshold 70%) mas ticket médio 3x maior no gênero "fora do esperado"

**Árvore:** o threshold de alinhamento existe pra proteger contra desperdício de alcance em público que não compra — mas aqui o público "desalinhado" é o que mais compra. O threshold está otimizando pra métrica errada (alinhamento com expectativa) quando devia otimizar pra receita.
**Ação:** priorizar receita sobre alinhamento declarado — mas registrar isso como mudança deliberada de KPI, não como "ignorar o alerta". Atualizar o avatar declarado pra refletir o real, senão esse alerta vai disparar pra sempre por um alvo errado.
**Alert fields:** exatamente o tipo de conflito descrito na Parte B.3 do motor de alertas (severity crítico vs. confidence baixo) — aqui o conflito é entre duas métricas de negócio, não entre severidade e confiança, mas a resolução é a mesma: rebaixar a urgência do alerta de alinhamento até o avatar declarado ser corrigido.

### 13 — Conteúdo pivotou há 60d; compartilhamento +30% sem CTA direto, mas conversão −18%

**Árvore:** dois sinais legítimos e conflitantes — compartilhamento é sinal de alcance/relevância de conteúdo (bom pro topo de funil), conversão caindo é sinal de fundo de funil enfraquecendo. Não são a mesma pergunta.
**Ação:** não é "ou/ou" — é decisão de portfólio: manter o novo formato pro topo de funil (ele está funcionando pra isso) e reintroduzir conteúdo com CTA direto pro meio/fundo, em vez de reverter o pivô inteiro.
**Métrica:** conversão recupera em 30 dias após reintrodução de conteúdo com CTA, sem perder o ganho de compartilhamento do formato novo.

### 14 — Conta de conteúdo adulto parou de publicar alinhado ao avatar por 21 dias — árvore em camadas

**Camada algoritmo:** 21 dias de silêncio/desalinhamento provavelmente já resetou parcialmente o "contrato" de distribuição com a audiência core — métrica de sucesso: alcance orgânico do primeiro post de retorno vs. média histórica pré-pausa.
**Camada público:** parte da audiência que seguia pelo alinhamento específico pode ter migrado — métrica: saldo de seguidores nos primeiros 7 dias pós-retorno (queda maior que a média histórica de churn = sinal de perda por desalinhamento, não churn natural).
**Camada receita:** se a conta monetiza assinatura/produto ligado ao avatar, a pausa provavelmente já custou receita direta — métrica: taxa de reativação de assinantes inativos nos primeiros 14 dias pós-retorno.
**Ação:** tratar como três problemas com prazos e métricas diferentes, não um problema único — resolver a camada algoritmo (retomar cadência) não resolve automaticamente a camada receita (precisa de campanha de reativação específica).

### 15 — ER Real 0.3% vs. ER declarado 2.4% (metodologia: ER Real desconta bots/inativos)

**Árvore:** não há decisão de "qual é a certa" — as duas são corretas, medindo coisas diferentes. A pergunta real é qual reportar pra quem.
**Ação:** reportar ER Real pro cliente internamente para decisão estratégica (é o número que reflete audiência de verdade); ER declarado pode aparecer em material de prospecção externa só se acompanhado de nota metodológica — nunca sem ela, isso vira exatamente o tipo de número "ativamente errado" que classificamos como pior que "sem dado" no Content Contract v1.
**Alert fields:** ambos os campos deveriam coexistir no schema com rótulo explícito, nunca um substituindo o outro silenciosamente.

### 16 — Threshold por arquétipo (Autoridade Técnica 0.8% / Lifestyle 2.5% / Educacional 1.5%); perfil "Educacional" em 1.1%

**Esse item confirma a arquitetura, não testa uma árvore nova.** 1.1% está entre o threshold do próprio arquétipo (1.5%) e o de Autoridade Técnica (0.8%) — abaixo do esperado pro arquétipo declarado, mas isso só é lido corretamente porque existe uma tabela de threshold por categoria, exatamente como `BENCHMARK_LIMITS` já existe pro Funil no código real do Orbit. Usar um threshold genérico (ex: 1.5% fixo pra todo mundo) classificaria isso errado.
**Ação:** é crítico _para o arquétipo declarado_, mas a ação correta é primeiro confirmar que "Educacional" é o arquétipo certo pra essa conta (mesma lógica do item 12) antes de agir sobre o gap.
**Recomendação de arquitetura:** essa tabela de threshold por arquétipo deveria ser formalizada no mesmo padrão de `SetorBenchmark`/`BENCHMARK_LIMITS` — é literalmente a mesma necessidade estrutural identificada no SSOT report (Parte D), agora com evidência de que se repete em métrica diferente (ER, não só CTR/conversão).

### 17 — Fadiga 38% (abaixo do threshold 40%) mas conversão caiu 22% em 2 semanas

**Árvore:** o threshold de fadiga pode estar calibrado errado (alto demais), ou a causa da queda de conversão é outra, não fadiga de criativo — checar CPM de mercado (item 7), qualidade de tráfego, e mudança na LP/oferta antes de assumir que o indicador de fadiga simplesmente "não pegou" o problema.
**Ação:** não recalibrar o threshold de fadiga pra baixo só pra "pegar" esse caso — isso é ajustar a régua pro resultado que você já decidiu, e é exatamente o tipo de viés que o protocolo do motor de alertas foi desenhado pra evitar. Investigar causa alternativa primeiro.
**Alert fields:** `confidence_level`: L2 até a causa alternativa ser eliminada ou confirmada.

### 18 — Escritório de arquitetura: no-show em briefings 8%→27% em 60 dias

**Hidden metrics a definir:** tempo entre agendamento e a reunião (no-show tende a subir com hiato longo); canal de agendamento (agendamento automatizado costuma ter no-show maior que agendamento humano); qualificação do lead antes do agendamento (lead frio agendando por impulso vs. lead já qualificado).
**Árvore:** hiato de agendamento aumentou no mesmo período? → sim → causa provável é logística, não qualidade de lead → não → checar se a fonte de lead mudou (canal novo trazendo lead mais frio).
**Threshold proposto:** no-show > 15% em qualquer canal de origem é o ponto de investigação, calibrado pela taxa histórica de 8% como baseline dessa conta específica — não um número de mercado genérico, porque não temos benchmark de setor pra isso ainda.

### 19 — Avatar real indica público universitário, ticket médio R$4.500

**Árvore:** incoerência estrutural real — não é conflito de threshold, é conflito de modelo de negócio. Público universitário tem, estatisticamente, renda disponível baixa pra ticket desse porte, salvo segmento muito específico (curso de pós, formação profissionalizante com ROI claro e rápido).
**Ação:** antes de reposicionar qualquer coisa, checar se o "avatar real" (provavelmente por engajamento/alcance) é o mesmo público que efetivamente compra, ou só o que mais interage sem converter — universitário engaja mais e compra menos é um padrão comum, então a incoerência pode ser um erro de definição de "avatar real" (usando dado de engajamento em vez de dado de conversão, o mesmo erro-tipo do item 11).
**Métrica:** cruzar avatar por engajamento vs. avatar por conversão antes de decidir pivotar produto ou avatar.

### 20 — 12k seguidores, alcance 1.500, CTA explícito, 1 comentário (emoji)

**Árvore completa:** alcance de 12.5% da base é baixo mas não alarmante isolado → CTA explícito sem comentário nenhum de texto sugere que o CTA não gerou conversa, só visualização passiva → 1 emoji é abaixo até do mínimo de engajamento passivo esperado pra esse alcance.
**Causa provável:** o post não gerou reação suficiente pra ser redistribuído (sinal fraco = alcance trava cedo) — clássico círculo vicioso de baixo sinal → baixa distribuição → menos sinal ainda.
**Ação em 7 dias:** responder ativamente ao único comentário existente (reciprocidade de engajamento é sinal real pro algoritmo), e testar um CTA de pergunta aberta em vez de CTA de ação direta no próximo post — CTA de ação direta ("compre", "clique") historicamente gera menos comentário que pergunta aberta.
**Métrica de sucesso em 7 dias:** próximo post do mesmo formato atinge pelo menos 3 comentários de texto (não emoji) — sinal mínimo de que o ajuste de CTA funcionou.

---

## Bloco C — Funil, CAC e alocação de investimento

### 21 — Funil Lead→Reunião 40%, Reunião→Proposta 70%, Proposta→Contrato 8%

**Árvore de priorização:** aplicando a mesma lógica de teoria das restrições já validada no Funil real do Orbit — o gargalo não é a etapa com pior taxa isolada, é a etapa cuja correção multiplica mais o resultado final. Proposta→Contrato (8%) é a pior taxa nominal, mas é também a etapa mais próxima do fim — corrigi-la afeta só quem já chegou lá. Lead→Reunião (40%) afeta o volume que entra em todas as etapas seguintes.
**Cálculo:** se Lead→Reunião subir de 40% para 50% (+25% relativo), todas as etapas seguintes recebem 25% mais volume, incluindo mais contratos fechados, mesmo sem mexer na taxa de 8%. Corrigir só Proposta→Contrato sem mexer no topo limita o ganho ao volume atual.
**Ação:** investigar Lead→Reunião primeiro (é o multiplicador), mas não ignorar os 8% — depois de resolver volume, os 8% de Proposta→Contrato se tornam o gargalo real, e aí sim merece atenção dedicada.
**Alert fields:** essa é a distinção `PriorizacaoPorGargalo` formalizada no SSOT report (Parte C.3) — aplicação direta e correta do conceito.

### 22 — Impression Share 41%, Quality Score em queda

**Árvore:** aumentar verba sobre Quality Score em queda tende a aumentar CPC (leilões penalizam Quality Score baixo com custo mais alto por posição), então aumentar verba antes de corrigir QS provavelmente compra menos impressão por real gasto do que parece.
**Ordem correta:** corrigir Quality Score (relevância de anúncio/palavra-chave/LP) primeiro → CPC cai naturalmente → Impression Share sobe com o mesmo orçamento antes de precisar aumentar verba → só então avaliar se ainda vale aumentar orçamento pra capturar o restante do share disponível.
**Ação:** inverter a ordem intuitiva (mais verba primeiro) é o erro mais caro desse item.

### 23 — Bounce 54%, mas 80% do tráfego vem de anúncio com promessa diferente da LP

**Árvore:** isolando a variável — o problema não é a LP em si, é o descompasso de expectativa criado pelo anúncio. Bounce alto aqui é sintoma de mismatch de mensagem, não de qualidade de página.
**Ação:** alinhar a promessa do anúncio com a headline da LP antes de qualquer alteração na própria LP — mudar a LP sem corrigir o anúncio deixa o mesmo mismatch, só que com uma página diferente.
**Métrica:** bounce cai proporcionalmente ao realinhamento de mensagem em 14 dias, sem nenhuma mudança estrutural na LP — isso confirma que o diagnóstico estava certo.

### 24 — CAC +45% em 30d, ROAS estável em 2.6×

**Por que não é contraditório:** ROAS mede retorno sobre gasto de mídia; CAC mede custo total de aquisição, que pode incluir mais canais/etapas que o ROAS de mídia paga não captura (ex: aumento de investimento em conteúdo/equipe de vendas no mesmo período), ou o ticket médio subiu junto com o CAC (compensando a métrica de retorno mesmo com custo maior de aquisição).
**Árvore:** ticket médio subiu no período? → sim → CAC maior é sustentável, ROAS estável confirma isso → não subiu → CAC subindo com ROAS estável sugere que o cálculo de CAC está incluindo custo que o ROAS não captura (checar se são os mesmos canais na mesma janela de atribuição).
**Ação:** nunca aceitar "ROAS estável" como sinal de que CAC subindo não é problema sem confirmar que as duas métricas medem a mesma coisa na mesma janela.

### 25 — Funil via Direct/WhatsApp, tempo médio de primeira resposta 6h

**Threshold proposto (sem benchmark de mercado formal ainda — declarar como estimativa, não fato):** em canais de mensagem direta, a literatura de vendas geral aponta que resposta em minutos converte muito mais que resposta em horas, porque a intenção de compra é mais volátil nesse canal do que em funil de formulário/e-mail. 6h é alto o suficiente pra provavelmente estar perdendo intenção — mas o número exato de threshold "aceitável" não está validado nesta conversa, então isso fica marcado como HIPÓTESE.
**Ação:** medir taxa de conversão por faixa de tempo de resposta (0-15min, 15min-1h, 1-6h, 6h+) antes de fixar um threshold numérico — a própria conta gera o dado que falta.
**Alert fields:** `confidence_level`: L2 explícito no threshold até essa validação interna existir.

### 26 — MQL→SQL caiu de 35% para 12%, volume de leads brutos +200%

**Árvore:** volume subindo 200% enquanto qualificação despenca é o padrão clássico de canal/campanha nova trazendo lead de menor intenção — provavelmente a causa não é piora do processo de qualificação, é mudança na composição da fonte de lead.
**Ação:** segmentar taxa de MQL→SQL por fonte de lead antes de qualquer coisa — se a fonte antiga manteve taxa de 35% e só a fonte nova está arrastando a média pra baixo, a decisão é sobre a fonte nova (cortar, otimizar segmentação, ou aceitar como topo de funil mais barato mas menos qualificado), não sobre o processo de qualificação em si.
**Métrica:** taxa de MQL→SQL por fonte, segmentada, define a ação — não a taxa agregada.

### 27 — Ticket médio Instagram orgânico R$2.200 vs. tráfego pago R$890

**Árvore:** antes de realocar investimento, checar volume absoluto de cada canal — orgânico pode ter ticket maior por vir de audiência mais aquecida/fiel, mas se o volume orgânico é pequeno, ele não escala da mesma forma que pago.
**Cálculo de decisão:** realocar verba de pago pra "mais orgânico" não funciona linearmente — orgânico não se compra com dinheiro direto, então a decisão real não é "mover budget", é "investir em estratégia de conteúdo pra crescer o canal que já converte melhor", que é uma decisão de recurso (tempo, equipe), não só de mídia.
**Ação:** não tratar isso como realocação simples de budget entre dois canais comparáveis — são mecanismos de crescimento diferentes.

### 28 — Threshold de setor ROAS infoproduto ticket alto: 1.8×. Cliente em 2.1× e insatisfeito.

**Esta é puramente uma questão de discurso, não de dado — não existe árvore técnica aqui, existe plano de comunicação.** O cliente está acima do benchmark do setor e ainda assim insatisfeito — isso é expectativa mal calibrada, não performance ruim.
**Plano de comunicação:** (1) mostrar o benchmark de setor com fonte, não como desculpa mas como contexto; (2) perguntar explicitamente qual número o cliente esperava e por quê — pode revelar que a meta original foi definida sem base em dado real; (3) nunca usar "você está acima da média" como resposta única — isso soa defensivo; combinar com um plano concreto de melhoria incremental, mesmo que pequeno, pra mostrar movimento, não só justificativa.
**Isso é exatamente a separação Motor/Discurso do SSOT report (Parte C.1)** — o dado (2.1× > 1.8×) é motor, a insatisfação é discurso/percepção, e a resposta certa trabalha nas duas camadas separadamente, nunca só uma.

### 29 — 500 leads/mês, zero contratos em 90 dias

**Árvore de diagnóstico completo, testando cada etapa isolada:**

1. Leads são reais (não bot/duplicado/mal qualificado na origem)? → testar antes de qualquer outra etapa, porque zero contrato em 90 dias com 1.500 leads acumulados é estatisticamente extremo o suficiente pra suspeitar de problema na entrada, não no meio do funil.
2. Se leads são reais: alguém está respondendo dentro de um tempo razoável (ver item 25)? → não → gargalo é operacional, não de funil.
3. Se está respondendo: está chegando até proposta? → não → gargalo é qualificação/discovery.
4. Se chega até proposta: proposta está sendo enviada mas nunca fechada → gargalo é oferta/preço/objeção não tratada.
   **Ação:** zero conversão em volume alto quase nunca tem causa única — a árvore precisa ser percorrida etapa por etapa com dado real de cada uma, porque "zero" é extremo demais pra qualquer hipótese única explicar sozinha sem confirmação.
   **Alert fields:** `severity`: critical · `confidence_level`: L2 até a árvore ser percorrida com dado real — este é o item onde adivinhar a causa sem dado é mais perigoso do inventário inteiro, porque zero conversão pode estar destruindo o negócio silenciosamente há 90 dias.

---

## Achado transversal — o que isso muda no Content Contract

**A arquitetura de threshold-por-categoria precisa se generalizar.** O item 16 prova que a mesma necessidade já identificada pro Funil (`BENCHMARK_LIMITS` por `SetorBenchmark`) se repete em ER por arquétipo de conteúdo, e o item 5 mostra que precisa também de uma dimensão de porte de conta (seguidores). Recomendo formalizar isso como uma única tabela multidimensional — `setor × arquétipo × porte` — em vez de continuar resolvendo cada métrica isoladamente conforme aparece.

**A distinção Motor/Discurso (item 28) precisa de um "modo" explícito no schema.** Alguns itens deste bloco são puramente técnicos (resolvíveis com dado), outros são puramente de comunicação (resolvíveis com plano de conversa). Misturar os dois no mesmo template de alerta gera confusão — vale um campo `natureza: 'tecnica' | 'comunicacao'` no `Alert`.

**A regra "não decidir sem o dado que falta" (itens 1, 4, 15, 25, 29) é o padrão mais repetido do bloco inteiro** — mais que qualquer fórmula específica. Isso confirma que o protocolo de 5 fases (auditar premissa antes de agir) é o núcleo real do produto, não decoração metodológica.

-- ============================================================================
-- ORBIT · Bloco A — sondagem de DISPONIBILIDADE DE DADOS (somente leitura)
-- Seguro: transação READ ONLY + rollback; sem ids fixos; só SELECT.
-- Rodar no SQL editor do Supabase (ideal: staging/cópia, ou role read-only).
-- Leitura do resultado: n > 0 => dado existe (cenário simulável);
-- n = 0 => LACUNA (esperada na simulação, registrar).
-- Referência de data: 18/10/2026

-- ============================================================================
begin read only;

with nb as (
select c.id, c.handle, c.threshold_ctr_bio_min as ctr_min
from orbit.clients c
where coalesce(c.is_benchmark, false) = false
),
snap as (
select s._, nb.handle, nb.ctr_min,
lag(s.reach_total) over w as reach_prev,
lag(s.er_real_pct) over w as er_prev
from orbit.ig_account_snapshots s
join nb on nb.id = s.client_id
window w as (partition by s.client_id order by s.period_end)
),
ob as (
select o.client_id, o.total_followers,
case
when o.total_followers is null or o.total_followers < 0 then null
when o.total_followers < 10000 then 'nano'
when o.total_followers < 50000 then 'micro'
when o.total_followers < 250000 then 'mid'
when o.total_followers < 1000000 then 'macro'
else 'mega'
end as tier
from orbit.client_onboarding o
)
select item, probe, n,
case when n > 0 then 'DADO_PRESENTE' else 'LACUNA' end as verdict
from (
-- A1 -----------------------------------------------------------------------
select 'A1' item, 'snapshots com link_ctr_pct < limite do cliente e janela >= 45d' probe,
count(_)::int n
from snap
where link_ctr_pct is not null and ctr_min is not null
and link_ctr_pct < ctr_min and period_days >= 45
union all
select 'A1', 'linhas com origem de visita (ga4.source_medium)',
count(*)::int from orbit.ads_ga4_landing_pages where source_medium is not null

-- A2 -----------------------------------------------------------------------
union all
select 'A2', 'pares consecutivos com alcance <= -40%',
count(_)::int from snap
where reach_prev > 0 and reach_total is not null
and (reach_total::numeric / reach_prev) - 1 <= -0.40
union all
select 'A2', 'pares com alcance <= -40% E ER maior que no snapshot anterior',
count(_)::int from snap
where reach_prev > 0 and reach_total is not null
and (reach_total::numeric / reach_prev) - 1 <= -0.40
and er_real_pct is not null and er_prev is not null and er_real_pct > er_prev
union all
select 'A2', 'snapshots com followers_net (para o desempate do saldo)',
count(*)::int from snap where followers_net is not null

-- A3 -----------------------------------------------------------------------
union all
select 'A3', 'snapshots com follower_churn_pct preenchido',
count(_)::int from snap where follower_churn_pct is not null
union all
select 'A3', 'snapshots com churn entre 1,8 e 3,1',
count(_)::int from snap where follower_churn_pct between 1.8 and 3.1
union all
select 'A3', 'historico de seguidores (client_followers_history)',
count(*)::int from orbit.client_followers_history

-- A4 -----------------------------------------------------------------------
union all
select 'A4', 'snapshots aptos a VPS (reach_followers_pct + total_followers>0)',
count(_)::int
from snap s join ob on ob.client_id = s.client_id
where s.reach_followers_pct is not null and s.reach_total is not null
and ob.total_followers > 0
union all
select 'A4', 'snapshots com vps_pct materializado',
count(_)::int from snap where vps_pct is not null

-- A5 -----------------------------------------------------------------------
union all
select 'A5', 'clientes com ER 1,8–2,4 e tier conhecido (ver detalhe abaixo)',
count(distinct s.client_id)::int
from snap s join ob on ob.client_id = s.client_id
where s.er_real_pct between 1.8 and 2.4 and ob.tier is not null
union all
select 'A5', 'regras er_real_pct em ref_thresholds (dataset v2)',
count(*)::int from orbit.ref_thresholds
where metric_name = 'er_real_pct' and dataset_id like 'benchmark_58_v2%'

-- A6 / A7 / A10 (Meta Ads) --------------------------------------------------
union all
select 'A6', 'criativos com fatigue_score_pct',
count(_)::int from orbit.ads_meta_creatives where fatigue_score_pct is not null
union all
select 'A6', 'snapshots Meta com roas',
count(_)::int from orbit.ads_meta_snapshots where roas is not null
union all
select 'A7', 'snapshots Meta com roas e cpm',
count(_)::int from orbit.ads_meta_snapshots where roas is not null and cpm is not null
union all
select 'A7', 'clientes com gross_margin_pct (necessário p/ ROAS mínimo viável)',
count(_)::int from orbit.clients
where coalesce(is_benchmark,false)=false and gross_margin_pct is not null
union all
select 'A10', 'snapshots Meta com frequency e ctr',
count(*)::int from orbit.ads_meta_snapshots where frequency is not null and ctr_pct is not null

-- A8 (GA4) / A9 (Google Ads) -----------------------------------------------
union all
select 'A8', 'landing pages com bounce_rate_pct e avg_session_sec',
count(_)::int from orbit.ads_ga4_landing_pages
where bounce_rate_pct is not null and avg_session_sec is not null
union all
select 'A9', 'snapshots Google com impression_share e avg_cpc',
count(_)::int from orbit.ads_google_snapshots
where impression_share is not null and avg_cpc is not null

-- Transversais -------------------------------------------------------------
union all
select 'X1', 'clientes com ultimo snapshot > 14 dias',
count(_)::int from (
select client_id, max(period_end) as pe from orbit.ig_account_snapshots
group by client_id
) l join nb on nb.id = l.client_id
where current_date - l.pe > 14
union all
select 'X1', 'clientes com ultimo snapshot > 30 dias',
count(_)::int from (
select client_id, max(period_end) as pe from orbit.ig_account_snapshots
group by client_id
) l join nb on nb.id = l.client_id
where current_date - l.pe > 30
union all
select 'X2', 'enum alert_type contem data_outdated (1 = sim)',
count(_)::int from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'alert_type' and e.enumlabel = 'data_outdated'
union all
select 'X2', 'alertas persistidos do tipo data_outdated',
count(_)::int from orbit.alerts where alert_type = 'data_outdated'
) q
order by item, probe;

-- Detalhe A5: quem tem ER ~2,1 e em que porte (para montar o par 8k vs 800k)
select nb.handle, ob.total_followers, ob.tier, s.er_real_pct, s.period_end
from orbit.ig_account_snapshots s
join orbit.clients nb on nb.id = s.client_id and coalesce(nb.is_benchmark,false)=false
join (
select o.client_id, o.total_followers,
case when o.total_followers < 10000 then 'nano'
when o.total_followers < 50000 then 'micro'
when o.total_followers < 250000 then 'mid'
when o.total_followers < 1000000 then 'macro' else 'mega' end tier
from orbit.client_onboarding o where o.total_followers is not null
) ob on ob.client_id = s.client_id
where s.er_real_pct between 1.8 and 2.4
order by s.er_real_pct;

-- Detalhe X1/X2: alertas existentes por tipo (compare com o que o engine gera)
select alert_type, severity, is_resolved, count(*) n
from orbit.alerts group by 1,2,3 order by 1,2,3;

rollback;

| item | probe                                                            | n   | verdict       |
| ---- | ---------------------------------------------------------------- | --- | ------------- |
| A1   | linhas com origem de visita (ga4.source_medium)                  | 0   | LACUNA        |
| A1   | snapshots com link_ctr_pct < limite do cliente e janela >= 45d   | 2   | DADO_PRESENTE |
| A10  | snapshots Meta com frequency e ctr                               | 0   | LACUNA        |
| A2   | pares com alcance <= -40% E ER maior que no snapshot anterior    | 0   | LACUNA        |
| A2   | pares consecutivos com alcance <= -40%                           | 3   | DADO_PRESENTE |
| A2   | snapshots com followers_net (para o desempate do saldo)          | 20  | DADO_PRESENTE |
| A3   | historico de seguidores (client_followers_history)               | 10  | DADO_PRESENTE |
| A3   | snapshots com churn entre 1,8 e 3,1                              | 0   | LACUNA        |
| A3   | snapshots com follower_churn_pct preenchido                      | 0   | LACUNA        |
| A4   | snapshots aptos a VPS (reach_followers_pct + total_followers>0)  | 5   | DADO_PRESENTE |
| A4   | snapshots com vps_pct materializado                              | 0   | LACUNA        |
| A5   | clientes com ER 1,8–2,4 e tier conhecido (ver detalhe abaixo)    | 1   | DADO_PRESENTE |
| A5   | regras er_real_pct em ref_thresholds (dataset v2)                | 0   | LACUNA        |
| A6   | criativos com fatigue_score_pct                                  | 0   | LACUNA        |
| A6   | snapshots Meta com roas                                          | 0   | LACUNA        |
| A7   | clientes com gross_margin_pct (necessário p/ ROAS mínimo viável) | 0   | LACUNA        |
| A7   | snapshots Meta com roas e cpm                                    | 0   | LACUNA        |
| A8   | landing pages com bounce_rate_pct e avg_session_sec              | 0   | LACUNA        |
| A9   | snapshots Google com impression_share e avg_cpc                  | 0   | LACUNA        |
| X1   | clientes com ultimo snapshot > 14 dias                           | 4   | DADO_PRESENTE |
| X1   | clientes com ultimo snapshot > 30 dias                           | 4   | DADO_PRESENTE |
| X2   | alertas persistidos do tipo data_outdated                        | 4   | DADO_PRESENTE |
| X2   | enum alert_type contem data_outdated (1 = sim)                   | 1   | DADO_PRESENTE |

| handle           | total_followers | tier | er_real_pct | period_end |
| ---------------- | --------------- | ---- | ----------- | ---------- |
| mauricioartphoto | 740             | nano | 1.8367      | 2026-05-25 |

| alert_type          | severity | is_resolved | n   |
| ------------------- | -------- | ----------- | --- |
| ctr_below_threshold | warning  | true        | 1   |
| engagement_collapse | warning  | false       | 1   |
| polemic_score_high  | warning  | false       | 1   |
| data_outdated       | warning  | false       | 4   |

DELL@Neuro-Petrus MINGW64 /c/Projetos/orbit-dashboard (master)
$ npx vitest run e2e/blocoA.e2e.test.ts

RUN v3.2.7 C:/Projetos/orbit-dashboard

stdout | e2e/blocoA.e2e.test.ts
┌─────────┬───────┬───────────┬──────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ item │ status │ what │ detail │
├─────────┼───────┼───────────┼──────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ 0 │ 'A1' │ 'PASS' │ 'link quebrado => critical' │ '' │
│ 1 │ 'A1' │ 'PASS' │ 'link quebrado menciona 7 dias' │ '' │
│ 2 │ 'A1' │ 'PASS' │ 'sem origem => L2' │ '' │
│ 3 │ 'A1' │ 'PASS' │ 'sem origem => manda instalar rastreio' │ '' │
│ 4 │ 'A1' │ 'PASS' │ 'sem origem => severity warning' │ 'severity=warning' │
│ 5 │ 'A1' │ 'PASS' │ 'propaga thresholdValue=3' │ '' │
│ 6 │ 'A1' │ 'PASS' │ "1 origem fraca => 'não mexa na bio'" │ '' │
│ 7 │ 'A1' │ 'PASS' │ 'todas fracas => 1 elemento por vez' │ '' │
│ 8 │ 'A1' │ 'GAP' │ 'origem de visita e linkIsWorking não existem no banco' │ 'ver probe SQL A1' │
│ 9 │ 'A1' │ 'GAP' │ 'resolver existe mas não está ligado a syncClientAlerts' │ 'só testável em isolamento' │
│ 10 │ 'A2' │ 'DIVERGE' │ 'saldo<0 => warning (doc)' │ 'engine=critical' │
│ 11 │ 'A2' │ 'PASS' │ 'mix mudou => não é crise (≠ critical)' │ '' │
│ 12 │ 'A2' │ 'PASS' │ 'saldo estável => info' │ 'engine=info' │
│ 13 │ 'A2' │ 'PASS' │ 'sem saldo => L2' │ '' │
│ 14 │ 'A2' │ 'GAP' │ 'input só tem engagementChangePct (queda); cenário A2 é alcance↓+ER↑' │ 'limitação estrutural' │
│ 15 │ 'A3' │ 'GAP' │ 'nenhum export de churn no engine (follower_churn_high só no DB/check_churn_alert)' │ '' │
│ 16 │ 'A3' │ 'GAP' │ "regra 'base<100 => info' não implementada no engine" │ '' │
│ 17 │ 'A4' │ 'GAP' │ 'sem campo/função de tamanho de amostra ou método de coleta' │ '' │
│ 18 │ 'A5' │ 'PASS' │ 'mapFollowersToTier correto nas bordas' │ '' │
│ 19 │ 'A5' │ 'GAP' │ 'ER 2,1 tem veredito idêntico em 8k e 800k (sem régua por porte)' │ 'nano=neutro macro=neutro' │
│ 20 │ 'A6' │ 'PASS' │ 'estável => nunca critical' │ '' │
│ 21 │ 'A6' │ 'DIVERGE' │ 'estável => warning (doc)' │ 'engine=info' │
│ 22 │ 'A6' │ 'PASS' │ "estável => 'Não troque ainda'" │ '' │
│ 23 │ 'A6' │ 'PASS' │ 'propaga thresholdValue=40' │ '' │
│ 24 │ 'A6' │ 'PASS' │ 'caindo => warning' │ '' │
│ 25 │ 'A6' │ 'PASS' │ 'caindo => troque criativo' │ '' │
│ 26 │ 'A6' │ 'PASS' │ 'sem tendência => L2' │ '' │
│ 27 │ 'A6' │ 'GAP' │ 'ads_meta_* vazias; resolver não ligado ao orquestrador' │ '' │
│ 28 │ 'A7' │ 'PASS' │ "mercado todo => 'não troque o anúncio'" │ '' │
│ 29 │ 'A7' │ 'PASS' │ 'freq↑ => troque criativo' │ '' │
│ 30 │ 'A7' │ 'PASS' │ 'freq estável => público novo' │ '' │
│ 31 │ 'A7' │ 'PASS' │ 'sem benchmark => L2' │ '' │
│ 32 │ 'A7' │ 'PASS' │ 'texto cita custo de mercado' │ '' │
│ 33 │ 'A7' │ 'GAP' │ 'gross_margin_pct nulo => roasMinViable incalculável; sem fonte deCPM de mercado' │ '' │
│ 34 │ 'A8' │ 'GAP' │ 'sem resolver nem AlertType; ads_ga4_landing_pages vazia' │ '' │
│ 35 │ 'A9' │ 'GAP' │ 'sem resolver nem AlertType; ads_google_snapshots vazia' │ '' │
│ 36 │ 'A10' │ 'GAP' │ 'sem resolver de frequência (fadiga usa fatiguePct); sem distribuição por indivíduo' │ '' │
│ 37 │ 'X1' │ 'PASS' │ '15d => warning' │ '' │
│ 38 │ 'X1' │ 'PASS' │ '31d => critical' │ '' │
│ 39 │ 'X2' │ 'DIVERGE' │ "isAlertType('data_outdated') (senão o writer pula e nunca fecha)" │ 'enum do DB tem data_outdated; ALERT_TYPES/AlertType no código precisa ter também' │
│ 40 │ 'X3' │ 'DIVERGE' │ 'AlertType inclui data_outdated' │ '' │
└─────────┴───────┴───────────┴──────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────┘

Resumo: PASS=25 DIVERGE=4 GAP=12

❯ e2e/blocoA.e2e.test.ts (30 tests | 1 failed) 34ms
✓ A1 CTR bio > link quebrado → crítico, reavaliar em 7 dias 1ms
✓ A1 CTR bio > sem rastreio de origem → instalar rastreio (L2, warning) 0ms
✓ A1 CTR bio > baixo só em 1 origem vs. baixo em todas 0ms
✓ A1 CTR bio > dados: sem tabela de origem populada / flag de link 0ms
✓ A1 CTR bio > nenhum orquestrador chama resolveCtrBioAlert 0ms
✓ A2 alcance↓ ER↑ > saldo de seguidores caindo 0ms
✓ A2 alcance↓ ER↑ > saldo estável + mix mudou → correlação espúria 0ms
✓ A2 alcance↓ ER↑ > saldo estável + mix igual → info 0ms
✓ A2 alcance↓ ER↑ > saldo ausente → L2 + pede o dado 0ms
✓ A2 alcance↓ ER↑ > modelo do input não representa 'ER subiu' 0ms
✓ A3/A4 sem lógica > A3 churn: sem resolver / sem regra de base pequena 0ms
✓ A3/A4 sem lógica > A4 VPS: método de coleta / margem de erro não modelados 0ms
✓ A5 normalização por porte > faixas de tier 0ms
✓ A5 normalização por porte > ER 2,1 recebe o mesmo veredito em nano e macro? 0ms
✓ A6 fadiga + ROAS ok > ROAS estável → não troca; doc pede warning 0ms
✓ A6 fadiga + ROAS ok > ROAS caindo → trocar agora 0ms
✓ A6 fadiga + ROAS ok > tendência ausente → L2 0ms
✓ A6 fadiga + ROAS ok > dados de Ads ausentes 0ms
✓ A7 ROAS ↓ + CPM ↑ > CPM subiu no mercado todo → não troca criativo 0ms
✓ A7 ROAS ↓ + CPM ↑ > só a conta + frequência↑ → criativo 0ms
✓ A7 ROAS ↓ + CPM ↑ > só a conta + freq estável → público novo 0ms
✓ A7 ROAS ↓ + CPM ↑ > sem CPM de mercado → cita CPM de mercado primeiro 0ms
✓ A7 ROAS ↓ + CPM ↑ > dados: margem e CPM de mercado ausentes 0ms
✓ A8/A9/A10 sem resolver > A8 bounce×tempo (GA4) 0ms
✓ A8/A9/A10 sem resolver > A9 Impression Share × CPC (Google) 0ms
✓ A8/A9/A10 sem resolver > A10 frequência alta × CTR estável 0ms
✓ X — persistência e staleness (pure) > staleness: limiares 14/30 dias 2ms
✓ X — persistência e staleness (pure) > data_outdated passa no guard de persistência? 0ms
✓ X — persistência e staleness (pure) > AlertType em types/orbit.ts contém data_outdated? 1ms
× gate > sem DIVERGE (use E2E_ALLOW_DIVERGENCE=1 para só reportar) 17ms
→ expected [ Array(4) ] to deeply equal []

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

FAIL e2e/blocoA.e2e.test.ts > gate > sem DIVERGE (use E2E_ALLOW_DIVERGENCE=1 para só reportar)
AssertionError: expected [ Array(4) ] to deeply equal []

- Expected

* Received

- []

* [
* "A2: saldo<0 => warning (doc)",
* "A6: estável => warning (doc)",
* "X2: isAlertType('data_outdated') (senão o writer pula e nunca fecha)",
* "X3: AlertType inclui data_outdated",
* ]

❯ e2e/blocoA.e2e.test.ts:322:54
320| const div = rows.filter((r) => r.status === "DIVERGE");
321| if (process.env.E2E_ALLOW_DIVERGENCE !== "1") {
322| expect(div.map((r) => `${r.item}: ${r.what}`)).toEqual([]);
| ^
323| }
324| });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

Test Files 1 failed (1)
Tests 1 failed | 29 passed (30)
Start at 21:57:42
Duration 1.01s (transform 220ms, setup 0ms, collect 237ms, tests 34ms, environment 0ms, prepare 192ms)

DELL@Neuro-Petrus MINGW64 /c/Projetos/orbit-dashboard (master)
$
