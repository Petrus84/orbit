# Framework de Arquétipos de Monetização em Social Media
### Relatório de Consultoria em Estratégia de Negócios e Analytics

---

## Resumo Executivo

Este relatório recomenda **8 categorias (arquétipos) de "setor de benchmark"** — com faixa aceitável de 6 a 10 — para mapear perfis de social media conforme seu modelo de monetização, mantendo essa dimensão estritamente independente de "nicho" (tema/vertical) e "proof_mechanism" (mecanismo de credibilidade/conversão). A recomendação baseia-se em critérios de interpretabilidade operacional, distintividade estatística esperada e capacidade de ação estratégica, não em dados proprietários — por isso, toda afirmação quantitativa está marcada como **HIPÓTESE** até validação com dados reais do mercado-alvo.

O relatório entrega: (1) diagnóstico de variáveis e lacunas (Before); (2) separação operacional das três camadas do modelo (Narrowing); (3) metodologia de decisão do número de categorias; (4) definição das 8 categorias propostas com sinais observáveis e modelos de monetização; (5) método prático de classificação (checklist + árvore de decisão/scoring); (6) mecanismo de atualização contínua; (7) plano de validação e benchmarking anti-viés; e (8) uma seção de Q&A para checagem de consistência.

**Premissa central declarada:** na ausência de dataset próprio, este framework é uma proposta estrutural fundamentada em lógica de mercado e práticas de segmentação (marketing analytics, growth, creator economy), não em clustering estatístico já executado. Todo número e limiar aqui apresentado deve ser tratado como ponto de partida testável.

---

## 1. BEFORE — Diagnóstico do Contexto e Lacunas

### 1.1 Variáveis que influenciam monetização em social media

| Variável | Dentro do escopo de "setor de benchmark"? | Natureza |
|---|---|---|
| Forma de oferta (produto, serviço, infoproduto, comissão) | Sim — núcleo da categoria | Estrutural |
| Ticket médio / faixa de preço | Parcial — sinal, não categoria | Indicador |
| Ritmo/cadência de conteúdo | Não diretamente — atributo operacional | Atributo |
| Taxa de conversão | Não — métrica de performance, não categoria | Indicador de qualidade |
| Tipo de audiência (B2B/B2C, tamanho) | Parcial — pode correlacionar, não define | Indicador |
| Distribuição por rede (IG, TikTok, X, FB) | Não — canal ≠ arquétipo | Atributo de distribuição |
| Maturidade do funil (implementado ou não) | **Fora do escopo da categoria** — é atributo de maturidade | Atributo diagnosticável à parte |
| Modelo de receita dominante | Sim — núcleo da categoria | Estrutural |
| Nicho/tema de conteúdo | **Fora do escopo** — dimensão separada | Dimensão própria |
| Proof mechanism (prova social, autoridade, resultado, etc.) | **Fora do escopo** — dimensão separada | Dimensão própria |

**HIPÓTESE 1:** o "setor de benchmark" é a variável com maior poder explicativo sobre *como* o dinheiro entra (mecânica de monetização), enquanto nicho explica *sobre o que se fala* e proof_mechanism explica *por que confiam o suficiente para comprar*. → **Validação:** análise de variância (ANOVA) ou regressão múltipla usando receita/CPM/ticket como variável dependente e as três dimensões como fatores independentes, testando se "setor de benchmark" explica variância incremental além de nicho e proof_mechanism.

### 1.2 Dados necessários para fundamentar o número ideal de categorias

- **Dispersão de performance**: distribuição de métricas de monetização (receita estimada, ticket, conversão) dentro de cada categoria candidata — categorias com alta variância interna sinalizam necessidade de subdivisão.
- **Estabilidade temporal**: se perfis mudam de categoria com frequência ao longo de 6–12 meses (baixa estabilidade = categoria mal definida ou setor em transição).
- **Granularidade operacional**: quantas categorias uma equipe de analistas consegue aplicar de forma consistente sem treinamento excessivo (custo de operação).
- **Interpretabilidade**: se um stakeholder de negócio consegue entender e agir sobre a categoria em poucos segundos.
- **Capacidade de ação (actionability)**: se a categoria muda a recomendação estratégica ou o produto de benchmarking oferecido.

### 1.3 Hipóteses iniciais (marcadas)

- **HIPÓTESE 2:** entre 6 e 10 categorias captura a maior parte da variância relevante de modelos de monetização em redes sociais no mercado atual (2025-2026), com retorno marginal decrescente acima de 10. → Validar via análise de estabilidade de cluster (ex.: silhouette score, gap statistic) em amostra real.
- **HIPÓTESE 3:** funil implementado/não implementado não deve ser categoria de benchmark, pois é um atributo de maturidade que pode coexistir com qualquer arquétipo. → Validar observando se perfis do "mesmo" arquétimo variam amplamente nessa dimensão sem mudar de arquétipo.
- **HIPÓTESE 4:** proof_mechanism varia de forma parcialmente independente do setor de benchmark (ex.: dois perfis de "afiliados/comissionamento" podem usar provas sociais completamente diferentes). → Validar via tabela de contingência (qui-quadrado) entre setor de benchmark e proof_mechanism em amostra classificada.

---

## 2. NARROWING — Separação das Três Camadas do Modelo

### 2.1 Definições operacionais

**Setor de benchmark (arquétipo de monetização)**
Categoria que descreve **o mecanismo estrutural pelo qual o perfil converte atenção em receita** — a "engenharia de negócio" por trás do conteúdo. Responde: *"Como esse perfil ganha dinheiro, estruturalmente?"*

**Nicho** (fora do escopo deste framework, mas definido para separação clara)
Tema ou vertical de conteúdo (ex.: finanças, moda, fitness, tecnologia, maternidade). Responde: *"Sobre o que o perfil fala?"*

**Proof_mechanism** (fora do escopo deste framework, mas definido para separação clara)
Mecanismo de credibilidade usado para reduzir a percepção de risco do público e converter interesse em compra (ex.: prova social quantitativa, autoridade técnica/credencial, resultado documentado do cliente, bastidor/transparência, escassez/urgência). Responde: *"Por que o público confia o suficiente para comprar?"*

### 2.2 Por que a separação é necessária

Um mesmo arquétipo de monetização (ex.: "infoprodutor/educador pago") pode existir em qualquer nicho (finanças, culinária, produtividade) e pode usar qualquer proof_mechanism (depoimentos, resultados numéricos, autoridade acadêmica). Se essas dimensões forem fundidas em uma única categoria, o número de combinações explode (setor × nicho × proof_mechanism), destruindo a interpretabilidade e a comparabilidade de benchmarks entre perfis de nichos diferentes — o que inviabilizaria comparar, por exemplo, dois "afiliados de e-commerce" em nichos distintos.

### 2.3 Estrutura de armazenamento — matriz multidimensional

| Perfil (ID) | Setor de Benchmark (1 primário + até 1 secundário) | Nicho | Proof Mechanism (dominante) | Maturidade de Funil | Rede(s) | Data da classificação | Versão do framework |
|---|---|---|---|---|---|---|---|
| perfil_001 | Ex.: Comissionamento/Afiliados (primário) | Ex.: Beleza | Ex.: Prova social quantitativa | Implementado | IG, TikTok | 2026-07-20 | v1.0 |

Essa estrutura garante que cada dimensão possa ser atualizada, consultada e cruzada de forma independente, sem recodificar as demais.

---

## 3. Determinação do Número de Categorias

### 3.1 Abordagens avaliadas

1. **Heurística por interpretabilidade (top-down):** parte de modelos de receita conhecidos no mercado de creator economy/social selling e agrupa por mecanismo estrutural. Vantagem: rápida implementação, alta compreensão por stakeholders. Risco: pode não refletir a distribuição real dos dados.

2. **Clustering com validação estatística (bottom-up):** aplicar algoritmos (k-means, clustering hierárquico) sobre variáveis de monetização observáveis (fontes de receita declaradas, estrutura de oferta, ticket, canais de conversão) e escolher k via métricas como silhouette score, índice de Davies-Bouldin ou gap statistic. Vantagem: fundamentado em dados. Risco: exige dataset rotulado ou minerado, que não está disponível nesta etapa — **HIPÓTESE**, requer coleta.

3. **Análise de estabilidade temporal:** testar se categorias se mantêm coerentes ao longo de trimestres; categorias que constantemente absorvem/perdem membros indicam definição fraca ou fronteira mal traçada.

4. **Custo-benefício e risco de sobrefragmentação:** cada categoria adicional aumenta custo de treinamento de analistas, risco de ambiguidade de classificação e dificuldade de comunicação comercial (ex.: em relatórios para clientes de agência). Acima de ~10-12 categorias, o ganho marginal de precisão tende a ser superado pela perda de usabilidade.

### 3.2 Recomendação e justificativa

**Recomendação: 8 categorias, com faixa aceitável de 6 (versão enxuta) a 10 (versão expandida) conforme maturidade do dataset.**

Critérios de suporte:
- **Cobertura de mercado:** 8 categorias permitem cobrir os principais mecanismos de monetização observados no mercado de social media atualmente (venda direta, afiliação, infoproduto, serviço/consultoria, patrocínio/publicidade, membership/assinatura, monetização nativa de plataforma, autoridade/personal branding para B2B) sem deixar zonas cinzentas grandes.
- **Distintividade:** cada categoria tem um mecanismo de receita central diferente, minimizando sobreposição conceitual (embora sobreposição operacional entre perfis seja esperada e tratada via categoria secundária).
- **Capacidade de orientar estratégia:** 8 categorias ainda permitem playbooks de benchmark e recomendação específicos por categoria sem diluir a ação em generalidades.
- **Facilidade de atualização:** um número moderado facilita revisão periódica sem redesenhar toda a arquitetura.

### 3.3 Trade-offs

| Direção | Ganho | Perda |
|---|---|---|
| Menos categorias (ex.: 4-5) | Alta robustez, fácil operação, comparação simples | Perda de nuance, categorias "genéricas demais", menor poder de ação |
| Mais categorias (ex.: 12+) | Alta granularidade, maior precisão descritiva | Sobreposição, dificuldade de classificação, maior custo operacional, menor estabilidade entre avaliadores |

---

## 4. As 8 Categorias Propostas — "Setor de Benchmark"

| # | Categoria | Definição | Modelos de monetização típicos | Depende de nicho? | Depende de proof_mechanism? |
|---|---|---|---|---|---|
| 1 | **Comércio Direto / E-commerce Social** | Perfil vende produto físico ou digital próprio diretamente via social selling | Loja própria, checkout in-app, marketplace | Não | Não |
| 2 | **Comissionamento / Afiliados** | Monetiza indicando produtos/serviços de terceiros por comissão | Links de afiliado, programas de parceria, cupons | Não | Sim (forte) |
| 3 | **Infoprodutor / Educador Pago** | Vende conhecimento estruturado em formato pago | Cursos, ebooks, mentorias, comunidades pagas | Não | Sim (forte) |
| 4 | **Serviço / Consultoria Profissional** | Usa o perfil como vitrine para captar clientes de serviço 1:1 ou B2B | Consultoria, freelance, agência, atendimento sob demanda | Não | Sim (forte) |
| 5 | **Patrocínio / Publicidade de Marca** | Receita via parcerias pagas com marcas terceiras | Publipost, embaixador de marca, product placement | Parcial | Não (foco é audiência, não prova) |
| 6 | **Membership / Assinatura de Comunidade** | Receita recorrente por acesso a conteúdo/comunidade exclusiva | Clube de assinantes, Patreon-like, grupo fechado pago | Não | Parcial |
| 7 | **Monetização Nativa de Plataforma** | Receita paga diretamente pela rede social com base em audiência/engajamento | Bônus de criador, ad revenue share, presentes/gorjetas | Não | Não |
| 8 | **Autoridade / Personal Branding B2B** | Monetização indireta via reputação, usada para gerar oportunidades de negócio, investimento ou emprego, não vendas diretas ao público do perfil | Palestras, conselhos, oportunidades de investimento/carreira, licenciamento de marca pessoal | Parcial | Sim (forte) |

**Nota metodológica:** a coluna "depende de nicho/proof_mechanism" indica correlação estrutural esperada (HIPÓTESE), não determinismo — cada perfil ainda deve ser classificado nas 3 dimensões de forma independente.

**Exemplo genérico de aplicação (Categoria 3 — Infoprodutor):** um perfil que publica conteúdo educativo consistente, direciona tráfego para uma página de vendas de curso, e usa depoimentos de alunos como prova social — seria classificado como Setor 3 (Infoprodutor), Nicho = [tema do curso], Proof_mechanism = "prova social/resultados de alunos", independentemente da rede usada.

---

## 5. Método de Mapeamento

### 5.1 Fluxo de classificação (passo a passo)

1. Coletar evidências públicas do perfil (bio, links, CTAs, posts fixados, últimos 20-30 posts, stories destacados).
2. Aplicar o checklist diagnóstico (5.2) para identificar sinais de monetização.
3. Pontuar cada categoria candidata via regra de scoring (5.3).
4. Selecionar categoria primária (maior score) e, se aplicável, categoria secundária (segundo maior score, se ≥ 60% do score primário).
5. Classificar separadamente nicho, proof_mechanism e maturidade de funil.
6. Registrar evidências e data da classificação para auditoria futura.
7. Reclassificar em ciclo definido (ver Seção 6).

### 5.2 Checklist de diagnóstico (exemplos de perguntas)

- O perfil vende um produto/serviço próprio identificável no link da bio ou CTA?
- Há menção a comissão, código de cupom ou "compre pelo meu link"?
- Há oferta de curso, mentoria, e-book ou comunidade paga?
- Há evidência de captação de clientes para serviço individual (ex.: "agende uma consultoria")?
- Há posts identificados como publicidade/parceria paga (#publi, #ad, marca marcada)?
- Há menção a grupo fechado, assinatura ou conteúdo exclusivo pago?
- O perfil menciona monetização nativa da plataforma (bônus de criador, gorjetas)?
- O perfil é usado majoritariamente para construir reputação/autoridade sem oferta direta visível?
- Existe funil de conversão visível (link para página, formulário, WhatsApp comercial)? (**atributo de maturidade, não categoria**)

### 5.3 Regra de decisão (scoring simplificado)

Para cada categoria, atribuir pontos por sinal encontrado (ex.: 0–3 por sinal, ponderado por força de evidência: menção implícita = 1, CTA explícito = 2, transação observável/link ativo = 3). Somar por categoria. Categoria com maior soma = primária. Empates ou segunda categoria com ≥60% do score da primeira = classificação dupla, com registro de ambas.

### 5.4 Casos ambíguos e multi-categoria

- Perfis híbridos (ex.: infoprodutor que também recebe patrocínio) devem ter categoria primária (a de maior receita/ênfase estrutural, quando estimável) e secundária.
- Quando não há dados suficientes para estimar receita, usar proxy de ênfase de conteúdo (frequência de CTAs por categoria).
- Perfis em estágio inicial sem monetização evidente: classificar como "Setor a validar / pré-monetização", não forçar em categoria existente — evita viés de confirmação por encaixe forçado.

### 5.5 Tratamento de maturidade de funil

Registrar como atributo binário/ordinal (não implementado / parcial / implementado e otimizado), associado ao perfil mas **não usado para definir a categoria de setor de benchmark**. Isso evita confundir "o que a pessoa faz para ganhar dinheiro" com "quão bem ela faz isso".

### 5.6 Adaptação à evolução das redes

O checklist e a lista de sinais devem ser tratados como componente "plugável": novos formatos de monetização nativa (ex.: novas features de comércio dentro do app) são adicionados como novos *sinais* dentro da Categoria 7 (Monetização Nativa), sem necessariamente criar nova categoria — só se criam categorias novas quando o mecanismo estrutural de receita for genuinamente distinto dos 8 existentes.

---

## 6. AFTER — Manutenção da Atualidade

### 6.1 Cadência de revisão
- **Revisão leve (checklist de sinais):** trimestral.
- **Revisão estrutural (categorias em si):** semestral ou anual, salvo gatilho abaixo.

### 6.2 Gatilhos de reclassificação/atualização fora do ciclo
- Mudança relevante em algoritmo de distribuição de conteúdo das redes monitoradas.
- Lançamento de nova funcionalidade nativa de monetização (ex.: novo checkout in-app, nova forma de assinatura).
- Mudança regulatória relevante (ex.: regras de publicidade/influenciador, tributação de criadores).
- Surgimento de formato dominante novo (ex.: novo tipo de conteúdo que gera novo mecanismo de receita).

### 6.3 Processo de versionamento
- Toda alteração de definição de categoria gera nova versão (v1.0 → v1.1 para ajustes menores; v2.0 para mudança estrutural no número/definição de categorias).
- Cada perfil classificado deve manter histórico de versão + data, permitindo análise de série temporal sem perda de comparabilidade retroativa.

### 6.4 Métricas de qualidade do mapeamento

| Métrica | O que mede | Como calcular |
|---|---|---|
| Consistência intra-avaliador | Se o mesmo analista classifica o mesmo perfil igual em momentos diferentes | Reclassificar amostra às cegas após intervalo; % de concordância |
| Acurácia inter-avaliadores | Se analistas diferentes concordam | Índice Kappa de Cohen/Fleiss sobre amostra comum |
| Correlação categoria–performance monetizável | Se a categoria de fato se associa a diferenças de receita/ticket/conversão | Regressão ou ANOVA: métrica de monetização ~ categoria |
| Taxa de ambiguidade | % de perfis que exigem classificação dupla ou "a validar" | Nº de casos ambíguos / total classificado |

---

## 7. BRIDGE — Plano de Validação e Benchmarking

### 7.1 Amostragem
- Tamanho mínimo sugerido: **≥150-200 perfis** para primeira validação estatística robusta (regra prática para permitir ~15-25 perfis por categoria, mínimo para testes de variância).
- Diversidade exigida: distribuição entre redes (IG, TikTok, X, Facebook), entre nichos variados, entre estágios de maturidade de funil, e entre portes de audiência (micro/médio/grande).

### 7.2 Critérios de sucesso e rejeição
- **Sucesso:** Kappa inter-avaliadores ≥ 0.7; correlação estatisticamente significativa entre categoria e ao menos uma métrica de monetização; taxa de ambiguidade ≤ 15%.
- **Rejeição/revisão:** Kappa < 0.5; categorias sem diferenciação estatística de performance entre si; taxa de ambiguidade > 30% (sinal de fronteiras mal definidas).

### 7.3 Coleta de dados — fontes e campos
- **Fontes:** conteúdo público do perfil (bio, posts, stories destacados, links), dados de terceiros quando disponíveis (relatórios de ferramentas de social listening/analytics), entrevistas/questionário direto ao proprietário do perfil quando possível (fonte primária mais confiável para confirmar modelo de receita real).
- **Campos a registrar:** categoria(s) atribuída(s), evidências textuais/links que sustentam a decisão, nicho, proof_mechanism, maturidade de funil, rede(s), data, avaliador responsável.

### 7.4 Como evitar viés de confirmação
- **Validação com dados fora da amostra de desenvolvimento** (hold-out set): categorias definidas com uma amostra, testadas em outra.
- **Revisão cega:** avaliador que testa a classificação não vê a classificação original nem a hipótese de categoria esperada.
- **Auditoria de decisões:** amostra aleatória de classificações revisada periodicamente por um segundo avaliador sênior, com log de discordâncias.
- **Registro explícito de incerteza:** perfis sem evidência suficiente são marcados "indeterminado", nunca forçados em categoria por conveniência.

### 7.5 Referências e evidências
Este framework foi construído com base em lógica de segmentação de mercado e observação geral (não proprietária) do ecossistema de creator economy e monetização em redes sociais — deve ser tratado como **evidência indireta**. Para elevar o rigor, recomenda-se buscar e citar formalmente, quando disponíveis: relatórios anuais de creator economy (ex.: relatórios de plataformas, associações do setor), estudos de mercado de influenciadores/social commerce, e dados internos já existentes de ORBIT Dashboard sobre os clientes monitorados (CP Import Store, Eupetruchio84), que podem servir como primeiro teste empírico em pequena escala antes de expandir a amostra.

---

## 8. Q&A de Consistência

**P1: "Setor de benchmark" pode mudar sem o nicho mudar?**
R: Sim. Um perfil pode migrar de "Comissionamento/Afiliados" para "Infoprodutor" mantendo o mesmo nicho — a mudança de categoria reflete mudança no mecanismo de receita, não no tema.

**P2: Um perfil sem monetização visível recebe categoria?**
R: Não deve ser forçado em nenhuma das 8. Deve ser marcado como "pré-monetização/a validar", evitando viés de encaixe forçado.

**P3: Maturidade de funil é uma 9ª categoria?**
R: Não. É atributo transversal registrado separadamente, aplicável a qualquer uma das 8 categorias.

**P4: Proof_mechanism pode determinar sozinho o setor de benchmark?**
R: Não deve. Ainda que haja correlação esperada (ex.: Infoprodutor tende a usar prova social forte), a classificação de setor deve se basear no mecanismo estrutural de receita, não no mecanismo de persuasão.

**P5: Como tratar um perfil que monetiza por múltiplas categorias simultaneamente?**
R: Atribuir categoria primária (maior peso/evidência) e secundária conforme regra de scoring (Seção 5.3), sem criar categorias híbridas permanentes que fragmentariam o framework.

**P6: O número 8 é definitivo?**
R: Não. É a recomendação inicial baseada em critérios estruturais; deve ser testada estatisticamente (clustering + estabilidade) assim que houver amostra real, podendo se ajustar entre 6 e 10.

**P7: Como o framework lida com uma nova forma de monetização que surgir?**
R: Primeiro se avalia se ela é uma variação de sinal dentro de uma categoria existente (ex.: nova ferramenta de checkout dentro de "Comércio Direto"). Só se cria nova categoria se o mecanismo estrutural for genuinamente distinto dos 8 existentes, respeitando o processo de versionamento (Seção 6.3).

---

## 9. Consolidação Final

| Item | Definição consolidada |
|---|---|
| **Nº de categorias recomendado** | 8 (faixa aceitável: 6–10, sujeita a validação estatística) |
| **Categorias** | 1) Comércio Direto/E-commerce Social · 2) Comissionamento/Afiliados · 3) Infoprodutor/Educador Pago · 4) Serviço/Consultoria Profissional · 5) Patrocínio/Publicidade de Marca · 6) Membership/Assinatura · 7) Monetização Nativa de Plataforma · 8) Autoridade/Personal Branding B2B |
| **Método de mapeamento** | Checklist de sinais → scoring ponderado → categoria primária (+ secundária se aplicável) → registro de evidências e versão |
| **Separação de camadas** | Setor de benchmark, Nicho e Proof_mechanism classificados de forma independente numa matriz multidimensional; maturidade de funil registrada como atributo transversal |
| **Plano de validação** | Amostra ≥150-200 perfis, Kappa inter-avaliador ≥0.7, hold-out set, revisão cega, auditoria periódica |
| **Atualização** | Revisão leve trimestral, revisão estrutural semestral/anual + gatilhos por mudança de plataforma/regulação, versionamento formal (v1.0, v1.1, v2.0...) |

### Premissas declaradas e como validar
- Todas as marcações **HIPÓTESE** neste documento (Seções 1.3, 3, 4) carecem de teste estatístico com dados reais — nenhuma foi tratada como fato consolidado.
- A recomendação de 8 categorias é estrutural/heurística, não derivada de clustering já executado — deve ser confirmada ou ajustada via Seção 7.

### Como o viés de confirmação foi mitigado
- Uso de hold-out set, revisão cega e auditoria de decisões (Seção 7.4).
- Distinção explícita, ao longo de todo o documento, entre "categoria proposta", "hipótese a validar" e "evidência indireta" (nunca apresentadas como equivalentes).

### Categoria vs. Atributo — checagem final
- **Categorias** (setor de benchmark): as 8 listadas acima — mutuamente distintas por mecanismo de receita.
- **Atributos** (não-categorias): nicho, proof_mechanism, maturidade de funil, rede de distribuição, porte de audiência — todos registrados separadamente, nunca fundidos à categoria de setor.
### X. VARIÁVEL DEPENDENTE — Métrica de Monetização Primária

**Definição operacional:**
Para validar as hipóteses (HIPÓTESE 1–4), será usada como variável dependente:

**[OPÇÃO A] Receita Anual Estimada (em BRL)**
- Fonte: autodeclaração do proprietário do perfil + triangulação com ferramentas de estimativa
- Normalização: log(receita) para corrigir distribuição assimétrica
- Tratamento de outliers: winsorização em 1% e 99%

**[OPÇÃO B] Ticket Médio (em BRL)**
- Definição: valor médio por transação/cliente convertido
- Fonte: autodeclaração + análise de página de vendas quando visível
- Vantagem: comparável entre nichos de receita total diferente

**[OPÇÃO C] Taxa de Conversão (%)** 
- Definição: (clientes convertidos / audiência engajada) × 100
- Fonte: pixel de rastreamento, formulário, API de plataforma
- Limitação: nem todos os perfis têm tracking implementado

**Escolha recomendada: [OPÇÃO B — Ticket Médio]**
Justificativa: 
- Menos afetado por tamanho de audiência (permite comparação entre micro e macro influenciadores)
- Mais estável temporalmente (receita anual flutua muito)
- Mais coletável (proprietários sabem seu ticket médio)
- Reflete melhor o "mecanismo estrutural" (setor de benchmark) vs. performance operacional

**Variáveis dependentes secundárias (para análise de robustez):**
- Receita anual (log)
- Taxa de conversão (quando disponível)
- Margem de lucro (quando declarada)
