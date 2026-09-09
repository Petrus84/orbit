# Changelog — correções aplicadas em 09/09/2026 (rodada 2)

Continuação direta do CHANGELOG anterior (8 arquivos + tokens 2.1.0, já aplicados).
Cobre a seção "Pendente / não coberto nesta leva" e mais alguns arquivos que não
tinham entrado no radar ainda.

## Fechado sem bug: QualityScoresPanel.module.css e SectorPositioningPanel.module.css
Auditoria token-a-token (22 e 19 ocorrências de `rgba()` respectivamente): **100% batem
exato** com a paleta oficial (`--neon-cyan`, `--red`, `--neon-gold`, `--acc2`, `--t2`,
`--amber`). O alto número de `rgba()` nesses dois arquivos não era sintoma de bug —
é o padrão correto quando você precisa combinar uma cor de token com alpha (CSS não
deixa fazer `rgba(var(--token), 0.1)` diretamente). Marcar como confirmado, não só
"não teve tempo de olhar".

## CarteiraScreen.module.css
Os estados de skeleton/erro/vazio nunca usavam tokens — eram Tailwind puro
(`zinc-900`, `zinc-800`, `red-900`, `red-500`, `red-400`, `zinc-500`), mesmo padrão de
drift que o `ClientCard.module.css` tinha antes da rodada 1:
- `rgb(24,24,27)`/`rgba(24,24,27,x)` (zinc-900) → `var(--bg2)` / `rgba(24,24,31,x)`
- `rgb(39,39,42)` (zinc-800) → `var(--bg4)` nos elementos de skeleton; `var(--line)`
  na borda do `.emptyState` (mesma cor de origem, mas troquei pro token de borda
  usado no resto do arquivo, não o de background — mais correto semanticamente que
  simplesmente pegar o token com o RGB mais próximo)
- `rgba(255,255,255,0.05)` no divisor do skeleton → `var(--line)`, consistente com os
  outros divisores do mesmo arquivo (`.globalAlertsSection`)
- `rgba(127,29,29,0.1)`, `rgba(239,68,68,x)`, `rgb(248,113,113)` → família oficial
  `rgba(255,68,68,x)` / `var(--red)`
- `rgb(113,113,122)` (zinc-500, texto) → `var(--text-muted)`, não `var(--t2)` — o
  próprio arquivo de tokens documenta que `--t2` falha WCAG AA pra texto e redireciona
  pra `--t1` via `--text-muted`; usar o token "mais próximo em RGB" teria reintroduzido
  esse problema de contraste

## AudienceSummaryPanel.module.css
- `rgba(31,41,55,x)` (Tailwind `slate-800`) → `rgba(31,31,40,x)` (`--bg3` oficial)
- `rgba(100,150,255,x)` → `rgba(74,144,255,x)` (`--blue` oficial) — mesmo tipo de
  drift leve do vermelho, só que na barra "azul" do gráfico de gênero

## Drift do vermelho (`255,65,54` → `255,68,68`) — achado espalhado, não só no AlertCard
A mesma cor errada corrigida no AlertCard na rodada 1 também estava em mais 4 arquivos
que não tinham sido auditados ainda:
- `GlowingNumber.module.css` (glow do número, 2 ocorrências)
- `SemaphoreIndicator.module.css` (estado `.vermelho`)
- `DeltaText.module.css` (glow do texto de variação)
- `InstagramOverviewPage.module.css`
Confirmado por varredura: zero ocorrências restantes em qualquer arquivo do repo.

## `--neon-green` (#00FF00) — resolvido na raiz, no token
O próprio `ssot-design-tokens-CORRIGIDO.css` já vinha com o comentário "não existe no
protótipo — revisar uso". Tinha 2 consumidores reais: `.clientDot` no Sidebar (a
bolinha verde de "cliente ativo") e `.verde` no `SemaphoreIndicator`. Em vez de corrigir
cada consumidor separado, redefini o token: `--neon-green: var(--green);` — um único
ponto de correção, os dois lugares herdam automaticamente. O `rgba(0,255,0,0.15)`
hardcoded dentro do `SemaphoreIndicator` (que não passa pelo token) foi corrigido à
parte pra `rgba(46,204,113,0.15)`.

## Decisões em aberto — não apliquei sozinho, precisa de confirmação sua

1. **Cor rosa (`rgba(255,105,180,...)`) nas barras de gênero do `AudienceSummaryPanel`.**
   Não existe em NENHUM lugar da paleta oficial nem do protótipo (`orbit-prototipo-
   consolidado-neon.html` não define shadow nem essa cor em lugar nenhum). Não é drift
   de uma cor próxima — é uma cor que o design system não contempla. Não troquei por
   nenhum token porque isso muda o que a cor comunica (ex.: se virar `--acc2` roxo,
   deixa de parecer "feminino" por associação visual). Precisa de uma decisão de
   produto, não uma correção técnica.
2. **`--shadow-soft` continua indefinido** — usado em 6 arquivos (`ClientCard`,
   `FunnelResult` ×2, `FunnelSimulator`, `Slider`, `FunnelScreen`), sempre como sombra
   de descanso de card/painel. Já era problema antes da correção de tokens 2.1.0, e
   continua sendo: a rodada 2.1.0 nem tentou resolver (mantido "sem alteração" nos
   shadows). Conferi o protótipo: ele **não usa `box-shadow` em card nenhum** — só em
   3 glows de semáforo. Ou seja, o card "flat" (sem sombra) pode ser o comportamento
   correto por design, e `--shadow-soft` é resíduo de um outro design system nunca
   finalizado. Duas saídas possíveis: (a) remover as 6 referências e ficar sem sombra
   nesses cards, batendo 100% com o protótipo; (b) definir um `--shadow-soft` real, se
   vocês *querem* profundidade nesses cards especificamente (não no resto do app).
   Não decidi por vocês.
3. **`rgba(148,163,184,0.08)` no `FunnelStep.module.css`** e **`rgba(100,100,100,x)`
   no `.boxNeutral:hover` do `QualityScoresPanel`** — ambos muito sutis (alpha ≤0.08),
   ambos sem equivalente exato na paleta, mas defensáveis como "cinza neutro
   intencional" (estado sem classificação, sem cor semântica própria). Deixei como
   estão — trocar às cegas por um token quebraria esse "sem cor = neutro" só pra
   bater com um RGB mais próximo, o que seria pior, não melhor.

## Pendente pra próxima rodada
- Revisão visual real (abrir as telas no navegador) — ainda não foi feita depois de
  nenhuma das duas rodadas de correção. Recomendo antes de considerar isso fechado de
  verdade.
