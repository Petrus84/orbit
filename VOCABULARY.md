# Vocabulário do Onboarding Orbit

Referência para quem preenche ou revisa a tela `/onboarding`. O texto curto de
cada item também aparece como tooltip (ícone **ⓘ**) ao lado do campo, em
`src/components/screens/OnboardingScreen.tsx` (constante `VOCAB`). Este
arquivo é a versão longa, com exemplos.

---

## Seção 01 — Seguidores

### Total de seguidores
**O que é:** contagem de contas que seguem o perfil no momento da análise.
**Uso:** baseline para taxa de engajamento (ex.: 100 comentários ÷ 1.000
seguidores = 10%).

### Fonte
**Opções:**
- `manual_print_confirmado` — print do Instagram Insights, confirmado
  manualmente por alguém do time.
- `scrape_perfil_confirmado` — robô leu o perfil e confirmou.

---

## Seção 02 — Bio, CTA e Funil

### Links da bio
**O que é:** URLs cadastradas na bio do Instagram. O perfil permite só 1 link
nativo — por isso é comum usar um agregador (Linktree, Beacons etc.) quando
há vários destinos.

### Tipo de CTA
| Valor | Exemplo | Quando usar |
|---|---|---|
| `link_direto` | bio aponta para `https://loja.com.br` | quer que cliquem direto no site |
| `linktree_multilink` | bio aponta para `https://linktr.ee/usuario` | 5+ destinos diferentes |
| `dm_comentario` | bio diz "comente LINK no DM" | quer capturar contato antes de enviar o link |
| `nenhum` / `link_bio` | — | ver `enums.ts` para os valores exatos aceitos pelo banco |

### Maturidade do funil
| Valor | Descrição |
|---|---|
| `funil_basico` | só sabe que houve clique (ex.: Insights mostra "14 cliques"), não sabe o que aconteceu depois |
| `implementado_fragmentado` | rastreamento em múltiplas ferramentas que não conversam entre si |
| `implementado_unificado` | um pixel/rastreamento único do clique até a compra — ROI exato |

---

## Seção 03 — Notas de Diagnóstico

### Q1 — Período de engajamento
**Deve conter:** janela de tempo analisada (ex.: "90 dias, mai–jul/26"),
cadência de posts (ex.: "1 post a cada 4 dias") e taxa de engajamento por
formato (estático, Reels, Stories).

### Q2 — Proxy de conteúdo
**Deve conter:** qual formato performa melhor, por que isso acontece, e um
alerta se o resultado (ex.: shares) não converte em ação (ex.: cliques de
bio).

### Q3 — Desalinhamento
**Deve conter:** o gap entre quem é a audiência (perfil, gênero, interesse)
e o que está sendo vendido, com a consequência prática desse descompasso.

---

## Seção 04 — Segmentação de Audiência (4 quadrantes)

A soma dos 4 campos abaixo deve ficar próxima de 100% — é o que a constraint
`audience_split_sum` do banco valida.

| Quadrante | Quem são | Risco se fora da faixa esperada |
|---|---|---|
| **Núcleo fiel (%)** | comentam, salvam, compartilham, voltam várias vezes por semana | 0% = sem comunidade; >40% = pode ser bolha |
| **Consumo passivo (%)** | curtem e veem stories, mas não interagem além disso | >60% = conteúdo gera consumo, não ação |
| **Curiosidade externa (%)** | chegaram pelo algoritmo, engajamento zero, não voltam | >30% = tráfego de passagem, não retenção |
| **Alta rotatividade (%)** | clicam e saem, comentários negativos, deixam de seguir | >10% = conteúdo gerando rejeição |

---

## Seção 05 — Contexto de Negócio

### Clusters de conteúdo observados
Principais temas/formatos que aparecem nos posts do período (texto livre).

### Setor / benchmark
Categoria de negócio usada para comparar métricas com concorrentes do mesmo
tipo — o que é um bom engajamento para um e-commerce é diferente do que é
bom para um criador de conteúdo. Ver `ENUM_SETOR` em `enums.ts` para os
valores aceitos.

### Nicho
Descrição específica do que a conta vende ou produz — mais granular que o
setor (ex.: setor "e-commerce", nicho "itens importados").

### Mecanismo de prova
Como a conta demonstra que é legítima: associação com marca, clientes
ativos, prova social em números, autoridade/expertise, urgência/escassez, ou
nenhuma prova visível. Ver `ENUM_PROOF` em `enums.ts`.

---

## Seção 06 — Metadados

### Fonte (values/affect)
De onde vieram os dados deste onboarding: preenchido manualmente aqui,
extraído do Instagram Insights, ou vindo de relatório externo.

### Confiança
- `L0` — medido direto (ex.: Insights).
- `L1` — hipótese bem fundamentada (padrão observado em vários posts).
- `L2` — estimativa / chute educado.

---

## Nota sobre campos de avatar (`avatar_expected_gender*`)

A tabela `orbit.client_onboarding` tem duas colunas — `avatar_expected_gender`
e `avatar_expected_gender_pct` — que **não aparecem preenchidas em nenhum dos
registros atuais** (confirmado no export CSV: 0 de 5 linhas com valor) e
**não têm campo correspondente nesta tela**. Isso é intencional, não um bug:
essas colunas pertencem ao domínio de Avatar Alignment (ver
`src/lib/mappers/avatarAlignment/`), não ao onboarding. O schema de
validação da linha crua (`src/lib/mappers/clientOnboarding.schema.ts`) já
documenta isso explicitamente e as omite do contrato (`ClientOnboarding`)
consumido por esta tela — não havia nada para remover em
`orbit.ts`, `enums.ts`, `helpers.ts` ou `OnboardingScreen.tsx`, que já não
referenciam esses campos.
