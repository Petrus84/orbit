# Nota ao PO — por que `decisions.md` muda

Data: 2026-10-03
Autor: operação Orbit (dev solo)
Público: produto
Escopo: contrato de KPI, não a tela

## O que este arquivo é

`contracts/kpi/decisions.md` não é backlog e não é copy. É o livro de vereditos do contrato: cada conflito de nome, unidade ou tela ganha uma linha `fechado` ou `adiado`. O robô do GitHub só aceita o sprint se essas palavras estiverem escritas. Reescrever o arquivo é fechar o portão, não lançar feature.

A ficha que o produto usa continua `contracts/kpi/registry.json` (22 KPIs). Este markdown não altera fórmula.

## Por que mudou mais de uma vez

| Quando | O que entrou | Por que não era a versão final |
|---|---|---|
| 29/09 | Notas soltas: C2 vigente, split de utilidade, tile 0,05% fora do Overview, avatar adiado | Texto de trabalho. Sem `fechado` / `adiado`. O robô não lê intenção. |
| 02/10 | Correção do C5 e linha do C7 | A nota antiga dizia que o tile “volta no RWP-1”. Isso autorizava recolocar o 0,05% sem tradução. |
| 03/10 | Arquivo no formato do gate | Uma frase por veredito, palavras que o teste procura. |

Não houve mudança de regra de negócio entre a segunda e a terceira versão. Houve mudança de forma, para o check deixar de falhar em 3 segundos.

## Vereditos que o produto pode cobrar

- Engajamento público é contagem, não percentual.
- Legenda comercial (`utility_caption`) e taxa saves+shares/reach (`utility_score_pct`) são dois indicadores. O 0,05% do Overview é o segundo, e sai do herói até existir tradução de unidade. Não volta neste sprint.
- Avatar com fallback 0 fica fora. Não corrigir agora.
- Alcance seguidor vs não-seguidor não se calcula nesta quinzena.
- Alerta de CTR abaixo do limiar permanece desligado.

## Perfil pagante: @djcaiodogao

É o único cliente pagante no Alpha. Em 28/09 a categoria de benchmark foi gravada errada por 11 minutos (02:04–02:15): `comercio_direto_ecommerce_social`. A correção, no mesmo dia, foi `infoprodutor_autoridade_personal`.

Base da correção: o segmento de origem é `membership_assinatura_comunidade`. O SSOT v1.3, seção 2.4 / linha 107, mapeia `6_membership_comunidade` para autoridade/infoproduto. A função automática `mapSegmentToCategory` não tem essa regra. Foi decisão manual, registrada, não um chute de tela.

Nenhum dado derivado foi afetado. Não houve recálculo de percentil, alerta ou tile em cima do rótulo errado. O risco que a nota evita é outro: “par do setor” com a categoria de e-commerce mostraria mediana de outra célula para o único pagante.

Categoria preenchida no Alpha: 1/5. Enquanto as outras quatro não tiverem rótulo ou recusa escrita, o produto não deve prometer comparação de setor. Para o pagante, o rótulo já está corrigido. Isso não libera o herói.

## O que não entra neste sprint

Não redesenhar Overview, Avatar ou Funil. Não ligar alerta morto. Não criar coluna nova. Não tratar as 116 contas de pasta como clientes. O chão operacional continua 5 contas, 22 fichas, 1 pagante.

## O que o PO pode verificar

1. No GitHub, Actions, fluxo `Compliance — contrato KCR`, corrida depois do commit dos vereditos: verde.
2. No registry, `utility_score_pct` com `screens` vazio.
3. No cliente pagante, `benchmark_category = infoprodutor_autoridade_personal`, não e-commerce.

Verde no robô não significa tile novo. Significa que o nome do indicador parou de mudar.