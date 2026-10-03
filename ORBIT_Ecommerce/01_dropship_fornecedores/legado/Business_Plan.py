
import json
from datetime import datetime

# =====================================================================
# DOCUMENTO 1: CONTRATO FINAL (VERSÃO EXECUTIVA)
# =====================================================================

contrato_final = """
# 📋 CONTRATO DE PARCERIA — CPIMPORTSTORE
## VERSÃO EXECUTIVA (ASSINÁVEL)

---

## 🎯 PARTES

**SÓCIO 1 (Investidor):**
- Nome: Adilson Rodolfo Panighel
- CPF: 076.105.448-09
- Email: djcaiodogao@gmail.com
- Endereço: Rua Pernambuco, 67, Gonzaga, Santos - SP, CEP 11065-050

**SÓCIO 2 (Gestor Comercial):**
- Nome: Petrúcio Novae de Barros
- CPF: 048.362.024-69
- Email: petrucionovaes@gmail.com
- Telefone: (11) 97849-5374
- Endereço: Rua Ver. Roberto Gilsomine, Pitangueiras, Guarujá - SP, 11.410-400

---

## 📊 ESTRUTURA

**Empresa:** CPIMPORTSTORE (Pessoa Física Conjunta)
**Participação:** 50% Adilson + 50% Petrúcio
**Modelo:** Dropshipping (sem estoque antecipado)
**Vigência:** Indeterminada, rescindível com 30 dias de aviso
**Data de Início:** 01/08/2026

---

## 💰 INVESTIMENTO INICIAL (T0)

| Item | Valor (R$) | Responsável |
|------|-----------|-------------|
| Shopify (domínio + tema) | R$ 100,00 | Adilson |
| Mercado Livre (crédito) | R$ 250,00 | Adilson |
| Mercado Livre (loja 1 mês) | R$ 99,00 | Adilson |
| CapCut Premium (1 mês) | R$ 69,90 | Adilson |
| Ads iniciais (R$ 25/dia × 30 dias) | R$ 750,00 | Adilson |
| Pro labore Petrúcio (mês 1) | R$ 2.000,00 | Adilson |
| **TOTAL T0** | **R$ 3.268,90** | **Adilson** |

**Rateio:** Adilson desembolsa 100% em T0. Petrúcio recebe como "adiantamento" e compensa com participação nos lucros.

---

## 📈 DESPESAS MENSAIS RECORRENTES

| Item | Valor (R$) | Tipo |
|------|-----------|------|
| Shopify | R$ 99,00 | Fixo |
| Mercado Livre (loja) | R$ 99,00 | Fixo |
| CapCut Premium | R$ 69,90 | Fixo |
| **Subtotal Fixo** | **R$ 267,90** | |
| Ads (Meta + ML) | R$ 750,00/mês | Variável |
| **TOTAL MENSAL** | **R$ 1.017,90** | |

**Rateio:** 50/50 entre Adilson e Petrúcio (ambos desembolsam sua parte).

---

## 💵 REMUNERAÇÃO

### Petrúcio (Gestor Comercial)

**Componente 1: Salário Fixo**
- Valor: R$ 2.000,00/mês
- Frequência: Mensal (até dia 5)
- Forma: PIX ou transferência
- Condição: Independente de vendas (garantido)

**Componente 2: Participação nos Lucros**
- Percentual: 50% do lucro líquido
- Fórmula: Lucro Líquido = Receita - Custo Produto - Despesas Fixas - Despesas Variáveis
- Frequência: Mensal (até dia 5)
- Condição: Após atingir ponto de equilíbrio (26 vendas/mês)

**Exemplo:**
- Vendas: R$ 10.000
- Custo Produto: -R$ 5.000
- Despesas: -R$ 1.500
- Lucro Líquido: R$ 3.500
- Petrúcio recebe: R$ 2.000 (fixo) + R$ 1.750 (50% lucro) = **R$ 3.750**
- Adilson recebe: R$ 1.750 (50% lucro)

### Adilson (Sócio Investidor)

**Componente 1: Reembolso de T0**
- Valor: R$ 3.268,90 (desembolsado em 01/08/2026)
- Reembolso: Antes de dividir lucro (prioridade)

**Componente 2: Participação nos Lucros**
- Percentual: 50% do lucro líquido (após reembolso de T0)
- Frequência: Mensal (até dia 5)

---

## 🎯 META DE VENDAS

**Meta Principal:** R$ 10.000 em vendas (Shopify + Mercado Livre) até 30/09/2026

**Produtos Prioritários:**
1. Kit Robótica WeDo 3.0 (Tier 1 - Launch imediato)
2. Campainha Inteligente Tuya (Tier 1 - Launch imediato)
3. Demais 9 SKUs Tier 2 (conforme performance)

**Ritmo:** R$ 166,67/dia (R$ 10.000 ÷ 60 dias)

**Consequência se não atingir:**
- Se vendas < R$ 10.000 até 30/09: Renegociar contrato ou rescindir com 30 dias de aviso
- Ambas as partes concordam em avaliar performance e decidir continuidade

---

## 👥 RESPONSABILIDADES

### Petrúcio (40h/semana)

- ✅ Seleção e validação de produtos
- ✅ Setup nas plataformas (Shopify, ML, Shopee)
- ✅ Gestão de conteúdo (descrições, fotos, vídeos)
- ✅ Marketing e tráfego pago (Meta Ads, ML Ads)
- ✅ Otimizações contínuas (preços, descrições, anúncios)
- ✅ Análise de dados e relatórios
- ✅ Relatório diário de vendas até 14h (enviado a Adilson)
- ✅ Atendimento básico ao cliente (respostas em até 2h)

### Adilson (5h/semana)

- ✅ Desembolso ao fornecedor (até 17h do mesmo dia)
- ✅ Aprovação/rejeição de Ads (SIM/NÃO)
- ✅ Decisão final em conflitos (voto de minerva)
- ✅ Acompanhamento de caixa (saldo diário)
- ✅ Acerto de contas (mensal, até dia 5)

### Ambos

- ✅ Reunião semanal (segunda-feira, 10h)
- ✅ Decisão sobre novos produtos (consenso preferencial, voto Adilson se impasse)
- ✅ Decisão sobre preços (consenso preferencial, voto Adilson se impasse)
- ✅ Confidencialidade (multa de 100 salários mínimos por quebra)

---

## 📊 FLUXO DE CAIXA

**Dia 1-7: Desembolso**
- Cliente compra na Shopify por R$ 100
- Petrúcio avisa Adilson
- Adilson desembolsa ao fornecedor: R$ 51,36 (custo do produto)
- Fornecedor entrega ao cliente

**Dia 7-14: Recebimento**
- Shopify cai na conta de Adilson: R$ 97,01 (R$ 100 - 2,99% taxa)
- Adilson recebe: R$ 97,01
- Adilson já tinha desembolsado: R$ 51,36
- Saldo de caixa: R$ 97,01 - R$ 51,36 = R$ 45,65

**Dia 15+: Divisão**
- Desse R$ 45,65, saem:
  - Despesas fixas (rateio): R$ 133,95 (50% de R$ 267,90)
  - Despesas variáveis (rateio): R$ 375 (50% de R$ 750)
  - Pro labore Petrúcio: R$ 2.000 (mensal, não diário)
  - Lucro restante: dividido 50/50

**Acerto de Contas: Dia 5 do mês seguinte**
- Petrúcio recebe: R$ 2.000 (fixo) + 50% lucro
- Adilson recebe: 50% lucro (após reembolso de T0)

---

## 🚨 DEVOLUÇÕES E PROBLEMAS

**Devolução de Cliente:**
- Quem absorve: Fornecedor (via Alibaba Trade Assurance)
- Petrus reembolsa cliente via Shopify/ML
- Caixa absorve a perda temporariamente (até reembolso do fornecedor)

**Fornecedor não entrega:**
- Quem absorve: Fornecedor (via Trade Assurance)
- Petrúcio reembolsa cliente
- Caixa absorve a perda temporariamente

**Chargeback (disputa de cartão):**
- Quem absorve: Caixa (50/50 entre Adilson e Petrúcio)
- Petrúcio tenta resolver com cliente
- Se não resolver, ambos absorvem a perda

**Taxa esperada de devoluções:** 2-5% das vendas

---

## 📋 RESCISÃO

**Aviso Prévio:** 30 dias (ambas as partes)

**Acerto de Contas na Saída:**
- Saldo de caixa (se houver) dividido 50/50
- Lucro acumulado até data de saída dividido 50/50
- Dívidas (se houver) rateadas 50/50

**Transição:**
- Adilson recebe acesso a todas as contas (Shopify, ML, Shopee)
- Petrúcio transfere dados e documentação
- Período de transição: 7 dias

---

## 🔐 CONFIDENCIALIDADE

- Ambas as partes se comprometem a manter confidencialidade
- Dados de clientes são propriedade da CPIMPORTSTORE
- Estratégia de marketing é propriedade da CPIMPORTSTORE
- Na saída, Petrúcio pode usar dados em outro negócio (após 30 dias)
- Penalidade por quebra: Multa de 100 salários mínimos

---

## 📅 REVISÃO E ALTERAÇÕES

**Frequência de Revisão:** Trimestral (ou conforme necessário)

**Processo de Alteração:**
- Consenso das duas partes
- Aviso prévio: 7 dias
- Documentação escrita (email ou WhatsApp)

---

## ✍️ ASSINATURA

**Data de Início:** 01/08/2026

**Assinado por:**

Adilson Rodolfo Panighel
_________________________
CPF: 076.105.448-09
Data: ___/___/2026

Petrúcio Novae de Barros
_________________________
CPF: 048.362.024-69
Data: ___/___/2026

---

**OBSERVAÇÕES:**
- Este contrato é válido entre Pessoa Física Conjunta (sem empresa formal)
- Não requer notarização
- Ambas as partes recebem cópia
- Vigência: Indeterminada, rescindível com 30 dias de aviso
- Meta de 30/09: Renegociar ou rescindir conforme performance
"""

# Salvar contrato
with open("/home/user/CONTRATO_FINAL.md", "w", encoding="utf-8") as f:
    f.write(contrato_final)

print("✅ Contrato Final salvo: CONTRATO_FINAL.md")
print()

# =====================================================================
# DOCUMENTO 2: BUSINESS PLAN FINAL (VERSÃO EXECUTIVA)
# =====================================================================

bp_final = """
# 📊 BUSINESS PLAN — CPIMPORTSTORE
## VERSÃO EXECUTIVA (DROPSHIPPING TECH)

---

## 🎯 RESUMO EXECUTIVO

**Empresa:** CPIMPORTSTORE
**Modelo:** Dropshipping (sem estoque antecipado)
**Mercado:** E-commerce de tecnologia (casa inteligente, automotivo, kids STEM)
**Período:** 01/08/2026 a 30/09/2026 (60 dias)
**Meta:** R$ 10.000 em vendas
**Investimento:** R$ 3.268,90
**Margem Esperada:** 20-46% (por SKU)

---

## 📈 PREMISSAS MACRO

### 1. Plataformas de Venda

| Plataforma | Taxa | Custo Fixo | Status |
|-----------|------|-----------|--------|
| Shopify | 2,99% (cartão) / 0% (PIX) | R$ 99/mês | ✅ Ativa |
| Mercado Livre | 17% | R$ 99/mês | ✅ Ativa |
| Shopee | 14% + taxa fixa | TBD | ⏳ Futuro |

**Premissa:** 50% cartão (2,99%) + 50% PIX (0%) = 1,495% taxa média Shopify

### 2. Despesas Mensais

| Item | Valor | Tipo |
|------|-------|------|
| Shopify | R$ 99 | Fixo |
| Mercado Livre | R$ 99 | Fixo |
| CapCut Premium | R$ 69,90 | Fixo |
| **Total Fixo** | **R$ 267,90** | |
| Ads (Meta + ML) | R$ 750 | Variável |
| **Total Mensal** | **R$ 1.017,90** | |

### 3. Margem Mínima

- **Piso:** 20% (confirmado)
- **Todos os 11 SKUs:** Acima de 20% ✅
- **Critério de Exclusão:** MOQ >= 5 (31 SKUs removidos)

### 4. Ponto de Equilíbrio

```
Despesas Fixas/Mês: R$ 267,90
Margem Média por Venda: R$ 86,42
Ponto de Equilíbrio: 267,90 ÷ 86,42 = 3,1 vendas/mês

Mas com Pro labore Petrus (R$ 2.000):
Total Despesas/Mês: R$ 2.267,90
Ponto de Equilíbrio: 2.267,90 ÷ 86,42 = 26,2 vendas/mês

SIGNIFICA: Precisa vender pelo menos 26 produtos/mês para cobrir despesas.
```

---

## 🛍️ CATÁLOGO DE PRODUTOS

### TIER 1 — LAUNCH IMEDIATO (2 SKUs)

| # | Produto | Categoria | Preço | Custo | Margem | MOQ | Status |
|---|---------|-----------|-------|-------|--------|-----|--------|
| 1 | Kit Robótica WeDo 3.0 | Kids STEM | R$ 100,90 | R$ 51,36 | 45,6% | 1 | ✅ |
| 2 | Campainha Tuya WiFi | Casa Inteligente | R$ 274,90 | R$ 139,37 | 46,1% | 1 | ✅ |

**Estratégia:** Lançar com foco em Meta Ads (R$ 25/dia) + ML Ads (R$ 10/dia)

### TIER 2 — FASE 2 (9 SKUs)

| # | Produto | Categoria | Preço | Custo | Margem | MOQ | Status |
|---|---------|-----------|-------|-------|--------|-----|--------|
| 3 | CarlinKit CarPlay | Automotivo | R$ 199,90 | R$ 101,55 | 46,0% | 1 | ⏳ |
| 4 | K1A CarPlay | Automotivo | R$ 253,90 | R$ 128,73 | 46,1% | 1 | ⏳ |
| 5 | Termostato WiFi | Casa Inteligente | R$ 214,90 | R$ 108,95 | 46,1% | 1 | ⏳ |
| 6 | Interruptor Touch | Casa Inteligente | R$ 157,90 | R$ 79,90 | 46,1% | 1 | ⏳ |
| 7 | Painel Controle | Casa Inteligente | R$ 573,90 | R$ 291,54 | 46,1% | 1 | ⏳ |
| 8 | Fechadura Inteligente | Gadgets | R$ 397,90 | R$ 202,13 | 46,1% | 1 | ⏳ |
| 9 | Termostato 2026 | Casa Inteligente | R$ 250,90 | R$ 127,21 | 46,1% | 1 | ⏳ |
| 10 | Porta-Ovos 1 | Organização | R$ 64,90 | R$ 32,90 | 45,5% | 1 | ⏳ |
| 11 | Porta-Ovos 2 | Organização | R$ 64,90 | R$ 32,90 | 45,5% | 1 | ⏳ |

**Estratégia:** Ativar conforme Tier 1 gera tração (meta: 5 vendas/SKU/mês)

---

## 📊 SIMULAÇÃO FINANCEIRA

### Cenário Realista (200 vendas/mês)

**Vendas:**
- Tier 1 (2 SKUs): 50 vendas × R$ 187,90 (preço médio) = R$ 9.395
- Tier 2 (9 SKUs): 150 vendas × R$ 250 (preço médio) = R$ 37.500
- **Total Vendas:** R$ 46.895

**Custo Produto:**
- Tier 1: 50 × R$ 95,37 (custo médio) = R$ 4.768,50
- Tier 2: 150 × R$ 128 (custo médio) = R$ 19.200
- **Total Custo:** R$ 23.968,50

**Lucro Bruto:** R$ 46.895 - R$ 23.968,50 = R$ 22.926,50

**Despesas:**
- Shopify (taxa + rateio): -R$ 1.500
- Mercado Livre (comissão + rateio): -R$ 8.000
- CapCut Premium: -R$ 69,90
- Ads: -R$ 1.500
- **Total Despesas:** -R$ 11.069,90

**Lucro Líquido:** R$ 22.926,50 - R$ 11.069,90 = R$ 11.856,60

**Distribuição:**
- Petrúcio: R$ 2.000 (fixo) + R$ 5.928,30 (50% lucro) = **R$ 7.928,30**
- Adilson: R$ 5.928,30 (50% lucro)

### Cenário Pessimista (50 vendas/mês)

**Vendas:** 50 × R$ 187,90 = R$ 9.395

**Custo Produto:** 50 × R$ 95,37 = R$ 4.768,50

**Lucro Bruto:** R$ 4.626,50

**Despesas:** -R$ 2.267,90 (fixas + pro labore)

**Lucro Líquido:** R$ 2.358,60

**Distribuição:**
- Petrúcio: R$ 2.000 (fixo) + R$ 1.179,30 (50% lucro) = **R$ 3.179,30**
- Adilson: R$ 1.179,30 (50% lucro)

### Cenário Otimista (500 vendas/mês)

**Vendas:** 500 × R$ 187,90 = R$ 93.950

**Custo Produto:** 500 × R$ 95,37 = R$ 47.685

**Lucro Bruto:** R$ 46.265

**Despesas:** -R$ 5.000 (fixas + pro labore + ads extras)

**Lucro Líquido:** R$ 41.265

**Distribuição:**
- Petrúcio: R$ 2.000 (fixo) + R$ 20.632,50 (50% lucro) = **R$ 22.632,50**
- Adilson: R$ 20.632,50 (50% lucro)

---

## 🎯 META DE 30/09

**Objetivo:** R$ 10.000 em vendas (60 dias)

**Ritmo:** R$ 166,67/dia

**Produtos Prioritários:**
1. Kit Robótica (50 vendas × R$ 100,90 = R$ 5.045)
2. Campainha (18 vendas × R$ 274,90 = R$ 4.948)
3. **Total:** R$ 9.993 ≈ R$ 10.000

**Lucro Esperado:**
- Lucro bruto: (R$ 100,90 - R$ 51,36) × 50 + (R$ 274,90 - R$ 139,37) × 18 = R$ 4.912,74
- Menos despesas (60 dias): -R$ 1.500
- Lucro líquido: R$ 3.412,74
- Petrúcio: R$ 2.000 (fixo) + R$ 1.706,37 (50% lucro) = **R$ 3.706,37**
- Adilson: R$ 1.706,37 (50% lucro)

**Consequência se não atingir:**
- Renegociar contrato ou rescindir com 30 dias de aviso

---

## 🚀 ROADMAP

### Semana 1 (01-07/08)
- [ ] Setup Shopify (domínio, tema, apps)
- [ ] Setup Mercado Livre (loja, anúncios)
- [ ] Criar 11 listings (descrições, fotos, preços)
- [ ] Lançar Meta Ads (R$ 25/dia)
- [ ] Lançar ML Ads (R$ 10/dia)

### Semana 2-4 (08-31/08)
- [ ] Monitorar performance (CTR, conversão, ROI)
- [ ] Otimizar anúncios (A/B testing)
- [ ] Ativar Tier 2 conforme performance
- [ ] Preparar relatórios semanais

### Semana 5-8 (01-30/09)
- [ ] Escalar Ads (se ROAS > 2)
- [ ] Testar Shopee (se time permitir)
- [ ] Preparar análise final de performance
- [ ] Decidir continuidade (renegociar ou rescindir)

---

## 📋 CHECKLIST

- [ ] 11 SKUs validados (margem >= 20%, MOQ <= 2)
- [ ] Contrato assinado (T0 = R$ 3.268,90)
- [ ] Shopify ativo (domínio + tema)
- [ ] Mercado Livre ativo (loja + crédito)
- [ ] Meta Ads ativo (R$ 25/dia)
- [ ] ML Ads ativo (R$ 10/dia)
- [ ] 11 listings criados
- [ ] Ponto de equilíbrio calculado (26 vendas/mês)
- [ ] Dashboard de acompanhamento (vendas vs meta)
- [ ] Reunião semanal agendada (seg 10h)

---

**Versão:** 1.0
**Data:** 02/08/2026
**Próxima Revisão:** 30/09/2026
"""

with open("/home/user/BUSINESS_PLAN_FINAL.md", "w", encoding="utf-8") as f:
    f.write(bp_final)

print("✅ Business Plan Final salvo: BUSINESS_PLAN_FINAL.md")
print()

# =====================================================================
# DOCUMENTO 3: CHECKLIST DE IMPLEMENTAÇÃO
# =====================================================================

checklist = """
# ✅ CHECKLIST DE IMPLEMENTAÇÃO — CPIMPORTSTORE

---

## 🎯 HOJE (Urgente)

### Contrato
- [ ] Ler contrato final (CONTRATO_FINAL.md)
- [ ] Confirmar com Caio: T0 = R$ 3.268,90?
- [ ] Confirmar com Caio: Remuneração = R$ 2.000 fixo + 50% lucro?
- [ ] Assinar contrato (ambas as partes)
- [ ] Guardar cópia (Petrus + Caio)

### Business Plan
- [ ] Ler business plan final (BUSINESS_PLAN_FINAL.md)
- [ ] Confirmar meta: R$ 10.000 até 30/09?
- [ ] Confirmar ponto de equilíbrio: 26 vendas/mês?
- [ ] Confirmar 11 SKUs (2 Tier 1 + 9 Tier 2)?

### Código
- [ ] Substituir scoring_engine.py pelo FINAL
- [ ] Substituir pipeline.py pelo FINAL
- [ ] Testar pipeline.py (sem erros?)
- [ ] Gerar 11 listings (outputs/listing_*.json)

---

## 📅 SEMANA 1 (01-07/08)

### Setup Shopify
- [ ] Comprar domínio cpimportstore.com.br (já feito?)
- [ ] Instalar tema (já feito?)
- [ ] Instalar apps (Inventory, Shipping, etc)
- [ ] Configurar pagamento (Mercado Pago + PIX)
- [ ] Testar checkout (compra de teste)

### Setup Mercado Livre
- [ ] Criar loja Premium (já feito?)
- [ ] Usar crédito de R$ 250 (já feito?)
- [ ] Configurar frete (quem paga?)
- [ ] Testar anúncio (publicar 1 produto)

### Criar Listings
- [ ] Kit Robótica (descrição + fotos + preço)
- [ ] Campainha Inteligente (descrição + fotos + preço)
- [ ] Validar preços contra planilha
- [ ] Publicar em Shopify + ML

### Lançar Ads
- [ ] Meta Ads: R$ 25/dia (Kit Robótica + Campainha)
- [ ] ML Ads: R$ 10/dia (Kit Robótica + Campainha)
- [ ] Monitorar CTR (clique-through rate)
- [ ] Monitorar conversão (vendas)

### Relatório Semanal
- [ ] Vendas totais (Shopify + ML)
- [ ] Custo de aquisição (CAC)
- [ ] Retorno sobre investimento (ROI)
- [ ] Próximos passos

---

## 📅 SEMANA 2-4 (08-31/08)

### Monitorar Performance
- [ ] CTR > 1%? (se não, otimizar anúncio)
- [ ] Conversão > 1%? (se não, otimizar landing page)
- [ ] ROI > 2? (se não, reduzir Ads)
- [ ] Vendas > 26/mês? (se não, aumentar Ads)

### Otimizar Anúncios
- [ ] A/B testing (2 versões de anúncio)
- [ ] Testar diferentes públicos
- [ ] Testar diferentes horários
- [ ] Testar diferentes dispositivos

### Ativar Tier 2
- [ ] Se Kit Robótica > 5 vendas/semana: ativar CarPlay
- [ ] Se Campainha > 5 vendas/semana: ativar Termostato
- [ ] Criar listings para Tier 2
- [ ] Lançar Ads para Tier 2

### Relatórios Semanais
- [ ] Vendas acumuladas vs meta (R$ 10.000)
- [ ] Número de vendas vs ponto de equilíbrio (26)
- [ ] Lucro esperado vs realizado
- [ ] Remuneração de Petrus (R$ 2.000 + 50% lucro)

---

## 📅 SEMANA 5-8 (01-30/09)

### Escalar Ads
- [ ] Se ROAS > 2: aumentar orçamento para R$ 50/dia
- [ ] Se ROAS > 3: aumentar orçamento para R$ 100/dia
- [ ] Se ROAS < 1: reduzir orçamento para R$ 10/dia

### Testar Shopee
- [ ] Se time permitir: criar loja Shopee
- [ ] Publicar 2-3 SKUs (Tier 1)
- [ ] Monitorar performance

### Preparar Análise Final
- [ ] Vendas finais (Shopify + ML + Shopee?)
- [ ] Lucro final vs simulado
- [ ] Remuneração final (Petrus + Caio)
- [ ] Decisão: renegociar ou rescindir?

### Reunião de Decisão (25/09)
- [ ] Atingiu meta de R$ 10.000?
- [ ] Lucro foi positivo?
- [ ] Ambos querem continuar?
- [ ] Próximos passos (mês 2+)

---

## 🔧 CÓDIGO — ATUALIZAÇÕES NECESSÁRIAS

### scoring_engine.py
- [ ] Atualizar ALI_MIN_RATING de 4.5 para 4.7
- [ ] Adicionar validação de MOQ (máximo 2)
- [ ] Adicionar validação de margem (mínimo 20%)
- [ ] Adicionar cálculo de remuneração (Petrus + Caio)
- [ ] Adicionar validação de preço (banda ±30%)

### pipeline.py
- [ ] Atualizar bloco __main__ com 11 SKUs
- [ ] Adicionar cálculo de ponto de equilíbrio (26 vendas)
- [ ] Adicionar validação de meta (R$ 10.000)
- [ ] Adicionar geração de relatório final (outputs/relatorio_final.json)
- [ ] Adicionar logging de erros (outputs/apify_errors.log)

### Testes
- [ ] Testar com 11 SKUs (sem erros?)
- [ ] Gerar 11 listings (todos válidos?)
- [ ] Validar preços contra planilha (100% match?)
- [ ] Validar margens (todas >= 20%?)

---

## 📊 DASHBOARD DE ACOMPANHAMENTO

### Diário
- [ ] Vendas do dia (Shopify + ML)
- [ ] Custo de Ads do dia
- [ ] Lucro do dia
- [ ] Relatório para Caio (até 14h)

### Semanal
- [ ] Vendas acumuladas (vs meta)
- [ ] Número de vendas (vs ponto de equilíbrio)
- [ ] Lucro acumulado
- [ ] Remuneração de Petrus (provisória)
- [ ] Próximos passos

### Mensal
- [ ] Vendas totais
- [ ] Lucro total
- [ ] Remuneração final (Petrus + Caio)
- [ ] Acerto de contas
- [ ] Decisão de continuidade

---

## 🚨 RISCOS E CONTINGÊNCIAS

### Risco 1: Vendas < 26/mês (abaixo do ponto de equilíbrio)
- Contingência: Aumentar orçamento de Ads (se caixa permitir)
- Contingência: Otimizar anúncios (melhorar conversão)
- Contingência: Ativar Tier 2 mais rápido (diversificar)

### Risco 2: Fornecedor não entrega
- Contingência: Usar Trade Assurance (Alibaba)
- Contingência: Reembolsar cliente via Shopify/ML
- Contingência: Trocar fornecedor

### Risco 3: Chargeback (disputa de cartão)
- Contingência: Tentar resolver com cliente
- Contingência: Absorver perda (50/50)

### Risco 4: Caio sem dinheiro para desembolsar
- Contingência: Usar "conta corrente" (Caio empresta para si mesmo)
- Contingência: Reduzir Ads (menos vendas = menos desembolso)

### Risco 5: Não atingir meta de R$ 10.000 até 30/09
- Contingência: Renegociar contrato (estender prazo?)
- Contingência: Rescindir com 30 dias de aviso

---

## ✅ FINAL CHECKLIST

- [ ] Contrato assinado (ambas as partes)
- [ ] T0 = R$ 3.268,90 (Caio desembolsou)
- [ ] Shopify ativo (domínio + tema + apps)
- [ ] Mercado Livre ativo (loja + crédito)
- [ ] 11 SKUs validados (margem >= 20%, MOQ <= 2)
- [ ] 11 listings criados (Shopify + ML)
- [ ] Meta Ads ativo (R$ 25/dia)
- [ ] ML Ads ativo (R$ 10/dia)
- [ ] Ponto de equilíbrio calculado (26 vendas/mês)
- [ ] Dashboard de acompanhamento (diário/semanal/mensal)
- [ ] Reunião semanal agendada (seg 10h)
- [ ] Código testado (sem erros)
- [ ] Relatórios automáticos (outputs/relatorio_final.json)

---

**Versão:** 1.0
**Data:** 02/08/2026
**Próxima Revisão:** 09/08/2026 (fim de semana 1)
"""

with open("/home/user/CHECKLIST_IMPLEMENTACAO.md", "w", encoding="utf-8") as f:
    f.write(checklist)

print("✅ Checklist de Implementação salvo: CHECKLIST_IMPLEMENTACAO.md")
print()

# =====================================================================
# RESUMO FINAL
# =====================================================================

print("=" * 120)
print("📋 RESUMO: 3 DOCUMENTOS GERADOS")
print("=" * 120)
print()

print("1️⃣  CONTRATO_FINAL.md")
print("   └─ Contrato assinável entre Petrus e Caio")
print("   └─ T0 = R$ 3.268,90")
print("   └─ Remuneração: R$ 2.000 fixo + 50% lucro")
print("   └─ Meta: R$ 10.000 até 30/09")
print("   └─ Rescisão: 30 dias de aviso")
print()

print("2️⃣  BUSINESS_PLAN_FINAL.md")
print("   └─ 11 SKUs validados (2 Tier 1 + 9 Tier 2)")
print("   └─ Ponto de equilíbrio: 26 vendas/mês")
print("   └─ Simulações: pessimista, realista, otimista")
print("   └─ Roadmap: semana 1-8")
print()

print("3️⃣  CHECKLIST_IMPLEMENTACAO.md")
print("   └─ Checklist dia a dia (hoje, semana 1-4, semana 5-8)")
print("   └─ Código: atualizações necessárias")
print("   └─ Riscos: contingências")
print()

print("=" * 120)
print("🎯 PRÓXIMOS PASSOS (HOJE)")
print("=" * 120)
print()

print("1. Ler os 3 documentos")
print("2. Confirmar com Caio: T0 = R$ 3.268,90?")
print("3. Confirmar com Caio: Remuneração = R$ 2.000 fixo + 50% lucro?")
print("4. Assinar contrato (ambas as partes)")
print("5. Começar checklist (semana 1)")
print()

print("=" * 120)
