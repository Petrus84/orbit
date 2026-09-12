# ORBIT — Documento Técnico v8.1  
### Addendum revisado (prints + código + Contract + JSON de KPIs)

A v8 acertou **cinco** achados de tela. Errou o **sexto** no remédio. Fechar só v7 **não** limpa o “as will be”. Fechar N5 inserindo `vps_pct` / `er_real_pct` no `ref_thresholds` **piora** o produto.

---

## O que a v8 acertou (manter)

### N1 — `expected_geo` vira a string `"null"`
Confirmado. `String(null) === "null"` (truthy) fura o fallback “Não especificado”.  
Mesma classe do `real_geo` (v6/v7), campo diferente.

**Patch:** `expected_geo: obj.expected_geo != null ? String(obj.expected_geo) : null` e tipo `string | null`.

### N2 — card “COM ALERTA” só conta `critical`
Confirmado. Única linha em `orbit.alerts` é `warning` (seed CTR). Rótulo sem “crítico” + filtro `useAlerts('critical')` = undercount.

**Patch:** `useAlerts()` no card “Com alerta”; `useAlerts('critical')` só no card de críticos.  
Depois do P0 (apagar seed), os dois cards podem ir a zero — isso é correto.

### N3 — delta `"↑ 0% 0%"`
Confirmado. `deltaLabel` replica o número; `DeltaText` já desenha a seta + %.

**Patch:** `deltaLabel: 'vs período anterior'` (ou omitir). Não inventar Δ% sem dois snapshots.

### N4 — scores sem unidade
Confirmado o sintoma. **Corrigir a premissa de escala:**

| Card (CP no banco) | Valor | Unidade real | Não é |
|--------------------|------:|--------------|--------|
| Utilidade | 0,0504 | **% do alcance** `(saves+shares)/reach×100` | ratio 0–1 |
| Polêmica | 7,6923 | **%** comments/likes×100 | “escala própria opaca” |
| VPS | 111,2045 | **% errada** `reach/followers` | C-02 |
| ER Real | 0,1008 | **% do alcance** `(saves+shares+comments)/reach×100` | ratio 0–1 |

`(1+0)/1985×100 = 0,0504`. Se a view guardasse 0–1, seria `0,000504`.

**Patch:** `unit` no card = `%` para os quatro **depois** de corrigir VPS. Não ler `ref_thresholds.unit` de `engagement_public` e colar em ER. Hover: fórmula em português (voz v1.5.1). Utilidade: “de cada 100 que viram”, nunca “% dos posts”.

### N6 — Central é global; chrome diz “Cliente ativo”
Confirmado: `orbitBaseQuery()` sem `client_id`. Não quebrou — nunca existiu.

**Decisão de produto (recomendação):** **(a) + filtro opcional.**  
Carteira e “2 alertas” são portfólio. Overview/Avatar/Funil são parcela.  
- Título da Central: “Todos os clientes”.  
- Filtro `clientId` = cliente ativo como *opção*, default = todos.  
- Não esconder o handle no card (`@eupetruchio84` já salva).

(b) puro (só cliente ativo) esvazia a Central quando o ativo é a CP e o seed é o Petruchio — parece “zero alertas” com o problema no vizinho.

---

## O que a v8 errou — N5

> “Não tem fix de código: calibrar e inserir thresholds de VPS/ER no mesmo padrão de `engagement_public`.”

Isso viola a Família A/B do JSON revisado.

- `engagement_public` = likes+comments (scrap). **Outra variável.**
- `er_real_pct` / `vps_pct` (C-02) precisam de **reach + saves/shares + reach_followers**. As 58 / JSON v2 **não têm** isso.
- Copiar percentil de like para ER/VPS é o tarifário que o cliente recusou (“não sou e-commerce”) com outra roupagem.
- VPS 111% não é “falta de threshold”: é **fórmula errada**. Com C-02 a CP ≈ **7,2%**. Pintar 111% com qualquer P75 é classificar lixo.

**Remédio N5 (substitui o parágrafo da v8):**

1. Corrigir `v_kpi_snapshots` / view de VPS para C-02 quando `reach_followers_pct` existir; senão **não classificar**.  
2. `v_quality_scores`: não join em `er_real_pct`/`vps_pct` inexistentes; texto “sem tarifário setorial — número da parcela”.  
3. RPC `classifyMetric('er_real_pct'|'vps_pct')` pode continuar; o engine **já** trata “indisponível”. Não inserir linha fantasma.  
4. Semáforo dessas duas = Família B (série da conta), quando houver ≥2 períodos L0.

N5 sai da fila “inserir threshold” e entra na fila **view + copy**.

---

## Ordem revisada (v5–v8.1 + plano Contract)

```text
1. RLS Resolver (v7) + guard example.com + apagar/corrigir seed CTR     P0
2. N1 expected_geo + real_geo (mesmo arquivo avatar)                   P0
3. N2 Com Alerta + N3 deltaLabel                                       P0
4. AlertCard: chips natureza/L*/data_source; query snooze              P0
5. N6 rótulo portfólio (+ filtro opcional)                             P0 produto
6. N4 unidades corretas (%); hover fórmula                             P1 UI
7. Funil: 0 de divisão ≠ taxa L0 (v5 + audit queries)                  P1
8. Writer: createAlertsBatch com 4 colunas; CASO G + CTR bio se dado   P1
9. Trigger churn: auto-resolve + reopen limpo + janela <14d            P1
10. N5 = corrigir VPS C-02 + texto sem tarifário — NÃO INSERT           P2
11. v_quality_scores hierarquia 'all' vs NULL                           P2
12. v_format_performance: não exigir shares > 0                         P2
13. Regenerar database.types.ts (v_carteira_clients)                    dívida
14. Snooze write / CSS / “erro de layout”                               depois
```

Itens 8–9 da v8 (“decidir N5+resolvers+snooze juntos”) misturam produto com **não inventar régua**. Resolvers: ligar só com fonte (audit: `createAlertsBatch` já é o gancho). Snooze write depois do filtro na query.

---

## Checklist de aceite contra os prints

| Print | Aceite |
|-------|--------|
| Avatar geo | não mostra a palavra `null` |
| Carteira “Com alerta” | conta o warning (até o seed morrer) |
| Overview KPI | um `0%`, rótulo “vs período anterior” |
| Quality scores | `%` + fórmula; VPS não 111 sem caveat; ER/utilidade sem “sem threshold” se a frase for *falta régua de loja* — trocar por “sem recorte setorial” |
| Central | “Todos os clientes” ou filtro; zero `example.com` |
| Funil | visita/clique do snapshot; venda só `funnel_data` |

A v8 é addendum de **tela**. A v8.1 amarra tela no Contract: unidade certa, Central honesta, **VPS/ER sem tarifário inventado**.