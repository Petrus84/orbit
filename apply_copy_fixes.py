#!/usr/bin/env python3
"""Aplica as correções de copy do ORBIT por substituição exata de texto.
Independe de CRLF/LF e de número de linha. Uso (na raiz do repo): python apply_copy_fixes.py [--dry]"""
import sys
DRY='--dry' in sys.argv
R='src/'
fails=0; done=0
def e(f,o,n,c=1):
    global fails,done
    p=R+f
    try: t=open(p,encoding='utf-8',newline='').read()
    except FileNotFoundError:
        print('NAO ENCONTRADO',p); fails+=1; return
    k=t.count(o)
    if k!=c:
        print(f'PULADO {f}: esperado {c}, achei {k} :: {o[:70]}'); fails+=1; return
    if not DRY: open(p,'w',encoding='utf-8',newline='').write(t.replace(o,n))
    done+=1
CE='lib/repositories/contentContractEngine.ts'
c=lambda o,n,k=1:e(CE,o,n,k)
c('houve ${formatPtBr(v, 2)} reprodução — ${v >= 1','houve ${formatPtBr(v, 2)} reprodução: ${v >= 1')
c('na mesma faixa do seu histórico — estável.','na mesma faixa do seu histórico: estável.')
c('${eventNoun} — padrão, não falha da conta.','${eventNoun}. É padrão, não falha da conta.')
c('${formatPtBr(value)}% — fora do intervalo esperado','${formatPtBr(value)}%, fora do intervalo esperado')
c('${formatPtBr(value, 2)}% — sem referência para o seu negócio','${formatPtBr(value, 2)}%: sem referência para o seu negócio')
c('${formatPtBr(value, 2)}% — ainda não dá para julgar este número','${formatPtBr(value, 2)}%: ainda não dá para julgar este número')
c('caminho específico — post, busca ou hashtag.','caminho específico: post, busca ou hashtag.')
c('Quem chega na bio não clica — em nenhuma origem de tráfego','Quem chega na bio não clica, em nenhuma origem de tráfego')
c('serve a esse público — não redesenhe a oferta.','serve a esse público. Não redesenhe a oferta.')
c('${ctrText} — mas este número','${ctrText}, mas este número')
c('${input.windowDays} dias — e você está perdendo','${input.windowDays} dias, e você está perdendo')
c('investigue outra causa — não troque só por repetição.','investigue outra causa. Não troque só por repetição.')
c('Retorno em ${roasPlain} — mostrar','Retorno em ${roasPlain}: mostrar')
c('Retorno em ${roasPlain} — só a sua','Retorno em ${roasPlain}: só a sua')
c('Retorno em ${roasPlain} — sua conta','Retorno em ${roasPlain}: sua conta')
c('(Referência: benchmark v1 — recalibração v2 pendente.','(Referência: comparação v1, recalibração v2 pendente.')
c('Engajamento público crítico — só','Engajamento público crítico: só')
c('Engajamento público abaixo do esperado — ${','Engajamento público abaixo do esperado: ${')
c('Não troque o produto — troque o convite.','Não troque o produto. Troque o convite.')
c('(${input.nRecent} posts) — sinal real, mas inconclusivo: publique mais antes','(${input.nRecent} posts): sinal real, mas inconclusivo. Publique mais antes')
c('Queda expressiva de engajamento vs. histórico da conta — mediana recente','Queda expressiva de engajamento em relação ao histórico da conta: mediana recente')
c('abaixo do histórico da conta — queda de','abaixo do histórico da conta: queda de')
c('ou de frequência — ou limitação algorítmica.','ou de frequência, ou limitação algorítmica.')
c('início de queda — confirme com mais posts antes de agir.','início de queda. Confirme com mais posts antes de agir.')
c('viram o post — não é nota de qualidade','viram o post. Não é nota de qualidade')
c('sendo limitada — não comece por aí.','sendo limitada. Não comece por aí.')
c('${typical} — acima do normal','${typical}: acima do normal')
c('${typical} — dentro do normal','${typical}: dentro do normal')
c('${typical} — a comparação','${typical}: a comparação')
c('ou ataque — o número sozinho','ou ataque. O número sozinho')
c('tipo de comentário — não é sinal','tipo de comentário. Não é sinal')
c('(polemicPct))} — acima do normal','(polemicPct))}: acima do normal',2)
c('ou briga — o número sozinho','ou briga. O número sozinho',2)
c('fazem nada com ele — só','fazem nada com ele: só')
c('Engajamento no período — ${','Engajamento no período: ${')
c('"n/a — sem régua de mercado calibrada para ER real/VPS hoje."','"Ainda sem comparação de mercado calibrada para engajamento real e alcance na base."')
c('Engajamento saudável para o seu porte — ${','Engajamento saudável para o seu porte: ${')
c('${ageDays} dias — última coleta','${ageDays} dias, última coleta',2)
c('conta desconectada — o número parado','conta desconectada. O número parado')
c('quem interage vs. quem já pagou','quem interage e quem já pagou')
c('(últimos posts vs. período anterior)','(últimos posts contra o período anterior)')
c('próprio histórico (self-reference). Não é benchmark setorial.','próprio histórico. Não é referência do setor.')
c('Sem posts com polemic_score_pct no período não existe mediana por post.','Sem posts com polêmica calculada no período, não existe mediana por post.')
c('vem de um snapshot agregado da conta.','vem de um registro agregado da conta.')
e('components/common/FunnelChart.tsx','sem dado no período','aguardando dado do período',3)
e('components/kpi/KPICard.tsx','Sem comparação','Comparação ainda indisponível',2)
e('components/panels/PostingProfilePanel.tsx','posts/semana','posts por semana',3)
# segundo chat (com correções)
e('components/screens/OnboardingScreen.tsx',"idade_mínima-idade_máxima","idade mínima-idade máxima")
I='lib/repositories/instagramOverviewRepository.ts'
e(I,'(client_followers_history); pode cobrir','(histórico de seguidores); pode cobrir')
e(I,'Faltam compartilhamentos (interactions_shares) no snapshot.','Faltam dados de compartilhamentos no snapshot.')
e(I,'régua do setor em validação. Não é o agregado do snapshot da v_quality_scores','régua do setor em validação. Não é o número do painel de Qualidade, que vem de outro cálculo')
e(I,'exige interactions_shares; meta','exige dado de compartilhamentos; meta')
e(I,'(p_pos − p_neg) × 100','(% positivo − % negativo) × 100')
e('components/content/FormatPerformanceTable.tsx','utility_score_pct tem o defeito F6 do SSOT: a tendência não mede interações','a tendência usa a nota de utilidade do post, não as interações')


print(f'{done} edicoes aplicadas, {fails} puladas'+(' (dry-run)' if DRY else ''))
