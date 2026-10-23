#!/usr/bin/env python3
"""Segunda rodada: rótulos de enums, onboarding, setor e funil.
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
# ---------- rótulos dos enums (lib/onboarding/enums.ts) ----------
OE='lib/onboarding/enums.ts'
e(OE,"'API do Instagram'","'Conexão oficial com o Instagram'")
e(OE,"'Scrape de perfil (confirmado)'","'Leitura do perfil (confirmada)'")
e(OE,"'Link direto (checkout, WhatsApp)'","'Link direto (compra ou WhatsApp)'")
e(OE,"'Linktree / multilink'","'Página com vários links (Linktree)'")
e(OE,"'DM / comentário'","'Mensagem ou comentário'")
e(OE,"'Nenhum CTA explícito'","'Conteúdo sem pedido de ação'")
e(OE,"'Não implementado'","'Ainda não montado'")
e(OE,"'Funil básico (landing page + email)'","'Caminho de venda básico (página de captura e e-mail)'")
e(OE,"'Implementado (fragmentado)'","'Montado, em partes soltas'")
e(OE,"'Implementado (unificado)'","'Montado e integrado'")
e(OE,"'Comércio Direto / E-commerce Social'","'Comércio direto pelas redes sociais'")
e(OE,"'Comissionamento / Afiliados'","'Comissão por indicação (afiliados)'")
e(OE,"'Infoprodutor / Educador pago'","'Cursos e conteúdo digital pago'")
e(OE,"'Serviço / Consultoria / Profissional'","'Serviços e consultoria'")
e(OE,"'Patrocínio / Publicidade / Marca'","'Publis e parcerias com marcas'")
e(OE,"'Membership / Assinatura / Comunidade'","'Assinatura e comunidade paga'")
e(OE,"'Monetização Nativa / Plataforma'","'Ganhos pela própria plataforma'")
e(OE,"'Autoridade / Personal branding B2B'","'Marca pessoal para vender a empresas'")
e(OE,"'Pré-monetização a validar'","'Ainda sem receita, validando a ideia'")
e(OE,"'SaaS / Ferramenta'","'Software ou ferramenta online'")
e(OE,"'Autoridade / Expertise'","'Autoridade e especialidade'")
e(OE,"'Escassez / Urgência'","'Vagas limitadas e prazo curto'")
e(OE,"'Clientes ativos / Gestão'","'Clientes atendidos hoje'")
e(OE,"'Nenhum observável'","'Nada que prove o resultado'")
e(OE,"'Feedback do cliente'","'Retorno do cliente'")
e(OE,"'Manual (entrevista/formulário)'","'Informado manualmente (entrevista ou formulário)'")
e(OE,"'Bio oficial + ZIP insights'","'Bio oficial e arquivo de dados do Instagram'")
e(OE,"'L0 — Dado direto confirmado'","'L0: dado direto confirmado'")
e(OE,"'L1 — Raciocínio fundamentado'","'L1: raciocínio fundamentado'")
e(OE,"'L2 — Depende de dado ausente'","'L2: depende de dado ausente'")
e(OE,"'Inferência — Tendência 2026'","'Inferência: tendência 2026'")
e(OE,"'Inferência — Mercado 2026'","'Inferência: mercado 2026'")
e(OE,"(funil + automação) têm conversão 3x maior.","(funil de vendas e automação) têm conversão 3x maior.")

# ---------- screens/enums.ts (cópia dos mesmos rótulos) ----------
SE='components/screens/enums.ts'
e(SE,"'Instagram API'","'Conexão oficial com o Instagram'")
e(SE,"'Scrape de perfil confirmado'","'Leitura do perfil confirmada'")
e(SE,"'Linktree / multilink'","'Página com vários links (Linktree)'")
e(SE,"'DM / comentário'","'Mensagem ou comentário'")
e(SE,"'Não implementado'","'Ainda não montado'")
e(SE,"'Implementado (fragmentado)'","'Montado, em partes soltas'")
e(SE,"'Implementado (unificado)'","'Montado e integrado'")
e(SE,"'Funil básico'","'Caminho de venda básico'")
e(SE,"'Comércio direto / e-commerce social'","'Comércio direto pelas redes sociais'")
e(SE,"'Comissionamento de afiliados'","'Comissão por indicação (afiliados)'")
e(SE,"'Infoprodutor / educador pago'","'Cursos e conteúdo digital pago'")
e(SE,"'Serviço / consultoria profissional'","'Serviços e consultoria'")
e(SE,"'Patrocínio / publicidade de marca'","'Publis e parcerias com marcas'")
e(SE,"'Membership / assinatura de comunidade'","'Assinatura e comunidade paga'")
e(SE,"'Monetização nativa de plataforma'","'Ganhos pela própria plataforma'")
e(SE,"'Autoridade / personal branding B2B'","'Marca pessoal para vender a empresas'")
e(SE,"'SaaS / ferramenta'","'Software ou ferramenta online'")
e(SE,"'Pré-monetização (a validar)'","'Ainda sem receita, validando a ideia'")
e(SE,"'Escassez / urgência'","'Vagas limitadas e prazo curto'")
e(SE,"'Clientes ativos em gestão'","'Clientes atendidos hoje'")
e(SE,"'Nenhum observável'","'Nada que prove o resultado'")
e(SE,"'Bio oficial + zip Insights'","'Bio oficial e arquivo de dados do Instagram'")
e(SE,"'L0 — Dado direto confirmado'","'L0: dado direto confirmado'")
e(SE,"'L1 — Raciocínio fundamentado'","'L1: raciocínio fundamentado'")
e(SE,"'L2 — Depende de dado ausente'","'L2: depende de dado ausente'")

# ---------- painel de posicionamento (setor) ----------
SP='components/panels/SectorPositioningPanel.tsx'
e(SP,'"SaaS / ferramenta"','"Software ou ferramenta online"')
e(SP,'"Comércio direto — e-commerce social"','"Comércio direto pelas redes sociais"')
e(SP,'"Comissionamento e afiliados"','"Comissão por indicação (afiliados)"')
e(SP,'"Infoprodutor / educador pago"','"Cursos e conteúdo digital pago"')
e(SP,'"Serviço / consultoria profissional"','"Serviços e consultoria"')
e(SP,'"Patrocínio e publicidade de marca"','"Publis e parcerias com marcas"')
e(SP,'"Membership / assinatura de comunidade"','"Assinatura e comunidade paga"')
e(SP,'"Monetização nativa de plataforma"','"Ganhos pela própria plataforma"')
e(SP,'"Autoridade / personal branding B2B"','"Marca pessoal para vender a empresas"')
e(SP,'"Pré-monetização — a validar"','"Ainda sem receita, validando a ideia"')
e(SP,'"Funil básico"','"Caminho de venda básico"')
e(SP,'"Não implementado"','"Ainda não montado"')
e(SP,'"Implementado, fragmentado"','"Montado, em partes soltas"')
e(SP,'"Implementado, unificado"','"Montado e integrado"')
e(SP,'"Clientes ativos em gestão"','"Clientes atendidos hoje"')
e(SP,'"Escassez / urgência"','"Vagas limitadas e prazo curto"')
e(SP,'"Nenhum mecanismo observável"','"Nada que prove o resultado"')
e(SP,'Funil e prova social','Caminho de venda e prova')
e(SP,'Mecanismo de prova: ','Como prova que funciona: ')

# ---------- tela de onboarding ----------
OS='components/screens/OnboardingScreen.tsx'
e(OS,"label: 'Setor / Benchmark'","label: 'Qual é o seu ramo?'")
e(OS,"'Deve ser um número inteiro maior que 0'","'Informe um número inteiro maior que 0'")
e(OS,"'Dados confirmados (print/scrape) são mais confiáveis que estimativas para benchmarking.'","'Dados confirmados por print ou leitura do perfil são mais confiáveis que estimativas para comparar com o mercado.'")
e(OS,"'Link direto e WhatsApp são os CTAs mais comuns no Brasil para comércio direto.'","'Link direto e WhatsApp são os convites para agir mais comuns no Brasil na venda direta.'")
e(OS,"'Segmentação em % (soma deve ser ~100%)'","'Divisão em % (a soma deve ficar perto de 100%)'")
e(OS,"'Núcleo fiel (compra regularmente) %'","'Clientes fiéis (compram sempre) %'")
e(OS,"'Seu core de clientes leais'","'Seus clientes mais leais'")
e(OS,"'Núcleo fiel é o segmento mais valioso — gera receita recorrente e recomendações.'","'Clientes fiéis são o grupo mais valioso: geram receita recorrente e indicações.'")
e(OS,"'Consumo passivo (vê, não compra) %'","'Pessoas que só veem (não compram) %'")
e(OS,"'Consumo passivo é seu funil de topo — alimenta o núcleo fiel com conteúdo educativo.'","'Quem só vê é a porta de entrada do seu caminho de venda: com conteúdo útil, pode virar cliente fiel.'")
e(OS,"'Curiosidade externa (descobriu recentemente) %'","'Pessoas novas (descobriram há pouco) %'")
e(OS,"'Curiosidade externa é tráfego novo — importante para crescimento, mas com conversão menor.'","'Pessoas novas trazem crescimento, mas costumam comprar menos no começo.'")
e(OS,"'Alta rotatividade (segue/deixa) %'","'Pessoas que somem (seguem e deixam de seguir) %'")
e(OS,"'Alta rotatividade é comum em conteúdo viral — útil para alcance, mas sem valor de cliente.'","'Pessoas que somem são comuns em conteúdo viral: ajudam no alcance, mas não viram clientes.'")
e(OS,"titulo: 'Seu Funil'","titulo: 'Seu caminho de venda'")
e(OS,"label: 'Maturidade do funil'","label: 'Como está o seu caminho de venda?'")
e(OS,"'Funil maduro (automação + sequência) escala sem atendimento manual. Sem funil, limite é ~50 vendas/mês.'","'Um caminho de venda bem montado (automação e sequência de mensagens) cresce sem atendimento manual. Sem ele, o limite é de cerca de 50 vendas por mês.'")
e(OS,"'URLs que você coloca na bio do Instagram'","'Endereços dos links que você coloca na bio do Instagram'")
e(OS,"URLs inválidas:","Links inválidos:")
e(OS,"label: 'Mecanismo de prova social'","label: 'Como você prova que funciona?'")
e(OS,"'Dados confirmados (manual/feedback) são mais confiáveis que inferências para decisões.'","'Dados confirmados por você ou pelo cliente são mais confiáveis que suposições na hora de decidir.'")
e(OS,"A soma dos percentuais deve ficar próxima de 100% (atual:","Ajuste os percentuais para a soma ficar perto de 100% (agora:")
e(OS,"new Error('ID do cliente não fornecido')","new Error('Cliente não identificado. Volte à carteira e abra o onboarding de novo.')")
e(OS,"new Error('Falha ao salvar os dados do onboarding')","new Error('Algo deu errado ao salvar o onboarding. Tente novamente.')")
e(OS,": 'Erro ao salvar')",": 'Algo deu errado ao salvar. Tente novamente.')")
e(OS,"<p>Erro ao carregar: {error}</p>","<p>Algo deu errado ao carregar: {error}</p>")
e(OS,"Nenhum onboarding cadastrado para este cliente.","Este cliente ainda está sem onboarding. Preencha as etapas abaixo para começar.")

# ---------- ajudas do onboarding ----------
OH='lib/onboarding/helpers.ts'
e(OH,"Só marque 'implementado' se existir pelo menos 1 link ativo na bio E cta_type diferente de 'nenhum'.","Só marque como montado se existir pelo menos 1 link ativo na bio e algum convite claro para agir.")
e(OH,"funciona como sinal de alcance vs. conversão.","funciona como sinal de alcance ou de venda.")
e(OH,"· Núcleo fiel = engajamento genuíno e recorrente","· Clientes fiéis = engajam de verdade e voltam sempre")
e(OH,"· Consumo passivo = curte mas não salva","· Pessoas que só veem = curtem, mas não salvam")
e(OH,"· Curiosidade externa = alcance de não seguidores","· Pessoas novas = alcançadas, mas ainda não seguem")
e(OH,"· Alta rotatividade = entra uma vez e sai","· Pessoas que somem = entram uma vez e saem")
e(OH,"cta_type: 'CTA'","cta_type: 'convite para agir'")
e(OH,"funnel_maturity: 'maturidade do funil'","funnel_maturity: 'caminho de venda'")
e(OH,"audience_nucleo_fiel_pct: 'núcleo fiel'","audience_nucleo_fiel_pct: 'clientes fiéis'")
e(OH,"audience_consumo_passivo_pct: 'consumo passivo'","audience_consumo_passivo_pct: 'pessoas que só veem'")
e(OH,"audience_curiosidade_externa_pct: 'curiosidade externa'","audience_curiosidade_externa_pct: 'pessoas novas'")
e(OH,"audience_alta_rotatividade_pct: 'alta rotatividade'","audience_alta_rotatividade_pct: 'pessoas que somem'")
e(OH,"setor_benchmark: 'setor/benchmark'","setor_benchmark: 'ramo'")
e(OH,"proof_mechanism: 'mecanismo de prova'","proof_mechanism: 'como prova que funciona'")

# ---------- funil ----------
FR='components/common/FunnelResult.tsx'
e(FR,"Cenário similar ao atual — sem mudanças significativas","Cenário similar ao atual, sem mudanças significativas")
e(FR,"cliques para fechar 1 venda — aumente o alcance","cliques para fechar 1 venda. Aumente o alcance")
e(FR,"Potencial alto — vale aumentar","Potencial alto: vale aumentar")
e(FR,"Cenário positivo — pequenos ajustes","Cenário positivo: pequenos ajustes")
e(FR,"Cenário desfavorável — revise","Cenário desfavorável: revise")
e(FR,'"Sem vendas informadas no período"','"Vendas do período ainda não informadas"')
e(FR,"Salvar meta de funil","Salvar meta de vendas")
e(FR,"Ex: Meta de 150 vendas/mês","Ex.: meta de 150 vendas por mês")
e(FR,"Erro ao salvar. Tente novamente.","Algo deu errado ao salvar. Tente novamente.")
e(FR,'"Revise o CTA ou a visibilidade do link"','"Revise o convite para agir ou a visibilidade do link"')
FS='components/common/FunnelSimulator.tsx'
e(FS,"Orbit — Cenário simulado do funil","Orbit: cenário simulado do funil de vendas")
e(FS,"acima da bolha histórica — CTR e conversão","acima da bolha histórica: CTR e conversão")
e(FS,"histórico real — por isso o resultado","histórico real, por isso o resultado")
e(FS,"Quantas pessoas a publicação ou campanha deve alcançar.","Quantas pessoas você quer alcançar com a publicação ou campanha.")
e(FS,"{formatPtBr(ctrEfetivo, 2)}% — nesta","{formatPtBr(ctrEfetivo, 2)}%: nesta")
e(FS,"{formatPtBr(convEfetivo, 2)}% — mesmo","{formatPtBr(convEfetivo, 2)}%: mesmo")
e(FS,"majoritariamente frio — por isso","majoritariamente frio, por isso")
FN='components/screens/FunnelScreen.tsx'
e(FN,"Funil real","Funil de vendas real",2)
e(FN,"Dados reais vs. cenário simulado","Dados reais e cenário simulado")
e(FN,'"Falha na requisição"','"Algo deu errado ao buscar os dados"')
SB='components/layout/Sidebar.tsx'
e(SB,'"Funil + Simulador"','"Funil de vendas + simulador"')
e(SB,'"Visão geral IG"','"Visão geral do Instagram"',2)
e('app/layout.tsx',"Sistema de Gestão de Funil e Performance de Contas","Sistema de gestão do funil de vendas e do desempenho das contas")

print(f'{done} edicoes aplicadas, {fails} puladas'+(' (dry-run)' if DRY else ''))
