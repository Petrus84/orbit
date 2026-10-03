from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime
from typing import Optional

import pandas as pd

# CORREÇÃO (garimpador paralelo 2026-07-31): estabilidade_temporal() lê e
# persistir_historico() escreve o mesmo outputs/historico_scores.json. Com
# o pipeline rodando candidatos em ThreadPoolExecutor, múltiplas threads
# faziam leitura/escrita concorrente no mesmo arquivo — uma thread podia
# ler o JSON no meio da escrita de outra e explodir com JSONDecodeError
# ("Expecting value"). Lock global serializa o acesso a esse arquivo
# específico; não afeta paralelismo das chamadas Apify (que são o gargalo
# real de tempo), só serializa a parte de I/O em disco, que é rápida.
_HISTORICO_LOCK = threading.Lock()

# =====================================================================
# ÂNCORAS DO PITCH DECK (gates confirmados na seção 2/3 do pitch)
# =====================================================================
META_MIN_LOJAS_FORTE = 5          # pitch: ">= 5 lojas distintas"
META_MIN_DIAS = 14                # pitch: ">= 14 dias rodando"
TIKTOK_MIN_VIDEOS_FORTE = 3       # pitch: ">= 3 vídeos de alta conversão"
ALI_MAX_DISPATCH_DAYS = 2         # pitch: "despacho em <= 2 dias"
ALI_MAX_DELIVERY_DAYS = 20        # pitch: "entrega no Brasil em <= 20 dias"
ALI_MIN_RATING = 4.5              # pitch: "nota de vendedor >= 4.5"
MARGEM_MINIMA = 2.5               # pitch: "corte automático se margem < 2.5x"
BANDA_PRECO_PCT = 0.30            # pitch: "tolerância de +-30% do preço médio"

# Thresholds finais de decisão (mantidos do diagnóstico anterior, batem com o pitch)
THRESHOLD_APROVAR = 70   # Tier 1
THRESHOLD_REVISAR = 50   # Tier 2


# =====================================================================
# UTILITÁRIOS NULL-SAFE (resolve riscos 4, 5 e 6 do diagnóstico)
# =====================================================================
def sinal_valido(valor) -> bool:
    """
    Um sinal só é 'válido' se existir e não for um placeholder óbvio de
    ausência de dado. Isso evita que default otimista (ex.: dispatch_days=2
    quando o campo não veio do ator) seja contado como sinal real.
    """
    if valor is None:
        return False
    if isinstance(valor, float) and pd.isna(valor):
        return False
    if isinstance(valor, str) and valor.strip() == "":
        return False
    return True


def extrair_preco_de_texto(texto: str) -> Optional[float]:
    """
    Extrai o primeiro valor monetário 'cheio' de um ad_copy, ignorando
    valores que pareçam parcela/frete (ex.: '12x de R$29,90').
    Retorna None se nada for encontrado (nunca 0.0 por default).
    """
    if not sinal_valido(texto):
        return None

    # ignora trechos de parcelamento antes de procurar o preço
    texto_limpo = re.sub(r"\d{1,2}\s*x\s*de", "", texto, flags=re.IGNORECASE)

    match = re.search(r"(?:R\$|\$)\s*([\d.,]+)", texto_limpo)
    if not match:
        return None

    valor_str = match.group(1).replace(".", "").replace(",", ".")
    try:
        valor = float(valor_str)
        return valor if valor > 0 else None
    except ValueError:
        return None


# =====================================================================
# SUB-SCORE 1: META (0-40) — âncora: pitch >=5 lojas / >=14 dias
# =====================================================================
def score_meta(df_meta: pd.DataFrame) -> dict:
    if df_meta is None or df_meta.empty:
        return {"pontos": 0, "lojas_unicas": 0, "detalhe": "sem dados válidos"}

    # Risco 2 do diagnóstico: dedupe por page_name, não por ad_id
    df_validas = df_meta[df_meta["days_running"] >= META_MIN_DIAS]
    lojas_unicas = df_validas["page_name"].nunique()

    if lojas_unicas >= META_MIN_LOJAS_FORTE:
        pontos = 40
    elif lojas_unicas >= 3:
        pontos = 25
    elif lojas_unicas >= 1:
        pontos = 10
    else:
        pontos = 0

    # Anti-ruído: descarta páginas com copy vazio/genérico ao contar confiança
    copies_genericos = df_validas["ad_copy"].apply(
        lambda t: not sinal_valido(t) or len(str(t).strip()) < 10
    ).sum()

    return {
        "pontos": pontos,
        "lojas_unicas": int(lojas_unicas),
        "paginas_copy_generico": int(copies_genericos),
        "detalhe": f"{lojas_unicas} lojas únicas com >= {META_MIN_DIAS} dias",
    }


# =====================================================================
# SUB-SCORE 2: TIKTOK (0-30) — âncora: pitch >=3 vídeos de alta conversão
# =====================================================================
def score_tiktok(df_tiktok: pd.DataFrame) -> dict:
    if df_tiktok is None or df_tiktok.empty:
        return {"pontos": 0, "videos_validos": 0, "detalhe": "sem dados válidos"}

    # CORREÇÃO (schema real confirmado): o ator não retorna "ctr" numérico
    # contínuo — retorna "ctr_tier", categórico (top_10%, top_25%, top_50%,
    # below_50%). O pipeline já converte isso em "ctr_rank" (1-4, maior =
    # melhor). Mediana não faz sentido pra 4 categorias, então o critério
    # vira "quantos vídeos estão no tier top_10% ou top_25%".
    df_validos = df_tiktok[
        df_tiktok["ctr_rank"].apply(sinal_valido) & df_tiktok["likes"].apply(sinal_valido)
    ]

    if df_validos.empty:
        return {"pontos": 0, "videos_validos": 0, "detalhe": "nenhum vídeo com dado válido"}

    videos_top_tier = int((df_validos["ctr_rank"] >= 3).sum())  # top_25% ou top_10%

    if videos_top_tier >= TIKTOK_MIN_VIDEOS_FORTE:
        pontos = 30
    elif videos_top_tier >= 1:
        pontos = 12
    else:
        pontos = 0

    return {
        "pontos": pontos,
        "videos_validos": int(len(df_validos)),
        "videos_top_tier": videos_top_tier,
        "detalhe": f"{videos_top_tier} vídeos em tier top_25%+ de CTR (de {len(df_validos)} com dado válido)",
    }


# =====================================================================
# SUB-SCORE 3: ALIEXPRESS (0-30) — âncora: pitch dispatch<=2 / delivery<=15 / nota>=4.7
# =====================================================================
def score_aliexpress(df_fornecedores: pd.DataFrame) -> dict:
    if df_fornecedores is None or df_fornecedores.empty:
        return {"pontos": 0, "fornecedor_aprovado": None, "detalhe": "sem fornecedor válido"}

    candidatos = []
    for _, row in df_fornecedores.iterrows():
        criterios_ok = 0
        criterios_avaliaveis = 0

        # cada critério só conta se o dado for válido (risco 5/6 do diagnóstico)
        if sinal_valido(row.get("dispatch_days")):
            criterios_avaliaveis += 1
            if row["dispatch_days"] <= ALI_MAX_DISPATCH_DAYS:
                criterios_ok += 1

        if sinal_valido(row.get("delivery_days")):
            criterios_avaliaveis += 1
            if row["delivery_days"] <= ALI_MAX_DELIVERY_DAYS:
                criterios_ok += 1

        if sinal_valido(row.get("supplier_rating")):
            criterios_avaliaveis += 1
            if row["supplier_rating"] >= ALI_MIN_RATING:
                criterios_ok += 1

        if criterios_avaliaveis == 0:
            continue

        candidatos.append({
            "row": row,
            "criterios_ok": criterios_ok,
            "criterios_avaliaveis": criterios_avaliaveis,
            "campo_provisorio": bool(row.get("selo_confiavel") or row.get("envio_com_rastreio")),
        })

    if not candidatos:
        return {"pontos": 0, "fornecedor_aprovado": None, "detalhe": "nenhum fornecedor com dados suficientes"}

    melhor = max(candidatos, key=lambda c: c["criterios_ok"] / c["criterios_avaliaveis"])
    proporcao = melhor["criterios_ok"] / melhor["criterios_avaliaveis"]

    if proporcao == 1.0 and melhor["criterios_avaliaveis"] == 3:
        pontos = 30
    elif proporcao >= 0.66:
        pontos = 18
    elif proporcao > 0:
        pontos = 8
    else:
        pontos = 0

    return {
        "pontos": pontos,
        "fornecedor_aprovado": melhor["row"].get("product_title"),
        "criterios_ok": melhor["criterios_ok"],
        "criterios_avaliaveis": melhor["criterios_avaliaveis"],
        "depende_campo_provisorio": melhor["campo_provisorio"],
        "unit_cost_usd": melhor["row"].get("unit_cost_usd"),
        "shipping_cost_usd": melhor["row"].get("shipping_cost_usd"),
        "suggested_sell_price_usd": melhor["row"].get("suggested_sell_price_usd"),
        "detalhe": f"{melhor['criterios_ok']}/{melhor['criterios_avaliaveis']} critérios logísticos atendidos",
    }


# =====================================================================
# ETAPA 4: CRUZAMENTO DE PREÇO — âncora: pitch banda de +-30%
# (zero custo Apify: cruza apenas com anúncios fatiados do produto avaliado)
# PATCH 1: Filtro de ruído extremo (> USD 500.0) de conversões incorretas no regex
# =====================================================================
def cruzamento_preco(df_meta: pd.DataFrame, score_ali: dict) -> dict:
    preco_sugerido = score_ali.get("suggested_sell_price_usd")
    if not sinal_valido(preco_sugerido) or df_meta is None or df_meta.empty:
        return {"penalizacao": 0, "detalhe": "dado insuficiente para cruzar preço"}

    precos_observados = [
        p for p in df_meta["ad_copy"].apply(extrair_preco_de_texto) if sinal_valido(p)
    ]
    
    # PATCH 1: Filtra ruídos extremos (> USD 500.0) de conversões incorretas no regex
    precos_observados = [p for p in precos_observados if 1.0 <= p <= 500.0]

    if not precos_observados:
        return {"penalizacao": 0, "detalhe": "nenhum preço extraído dos anúncios"}

    preco_medio_mercado = sum(precos_observados) / len(precos_observados)
    banda_min = preco_medio_mercado * (1 - BANDA_PRECO_PCT)
    banda_max = preco_medio_mercado * (1 + BANDA_PRECO_PCT)

    dentro_da_banda = banda_min <= preco_sugerido <= banda_max
    return {
        "penalizacao": 0 if dentro_da_banda else -15,
        "preco_medio_mercado_usd": round(preco_medio_mercado, 2),
        "preco_sugerido_usd": preco_sugerido,
        "dentro_da_banda_30pct": dentro_da_banda,
        "detalhe": "dentro da banda de competitividade" if dentro_da_banda else "fora da banda +-30% — revisar margem",
    }


# =====================================================================
# ETAPA 5: ESTABILIDADE TEMPORAL — âncora: risco 8 do diagnóstico
# (zero custo Apify: compara com histórico já persistido em disco)
# =====================================================================
def estabilidade_temporal(produto: str, score_atual: int, historico_path: str) -> dict:
    with _HISTORICO_LOCK:
        if not os.path.exists(historico_path):
            return {"penalizacao": -10, "detalhe": "sem histórico — 1ª coleta, marcado como dado insuficiente"}

        try:
            with open(historico_path, "r", encoding="utf-8") as f:
                historico = json.load(f)
        except json.JSONDecodeError:
            # Arquivo vazio/corrompido (ex.: processo anterior interrompido
            # no meio da escrita) — trata como sem histórico em vez de
            # quebrar o pipeline inteiro.
            return {"penalizacao": -10, "detalhe": "histórico ilegível — tratado como 1ª coleta"}

    registros_produto = [r for r in historico if r.get("produto") == produto]
    if not registros_produto:
        return {"penalizacao": -10, "detalhe": "sem histórico — 1ª coleta, marcado como dado insuficiente"}

    ultimo_score = registros_produto[-1]["score_total"]
    variacao = score_atual - ultimo_score

    if variacao < -20:
        return {"penalizacao": -10, "variacao": variacao, "detalhe": "queda abrupta — possível pico sazonal, revisar"}

    return {"penalizacao": 0, "variacao": variacao, "detalhe": "score estável ou crescente em relação à última coleta"}


def persistir_historico(produto: str, score_total: int, decisao: str, historico_path: str) -> None:
    with _HISTORICO_LOCK:
        historico = []
        if os.path.exists(historico_path):
            try:
                with open(historico_path, "r", encoding="utf-8") as f:
                    historico = json.load(f)
            except json.JSONDecodeError:
                historico = []  # arquivo corrompido — reconstrói em vez de quebrar

        historico.append({
            "produto": produto,
            "score_total": score_total,
            "decisao": decisao,
            "data_coleta": datetime.now().isoformat(),
        })

    os.makedirs(os.path.dirname(historico_path), exist_ok=True)
    with open(historico_path, "w", encoding="utf-8") as f:
        json.dump(historico, f, ensure_ascii=False, indent=2)


# =====================================================================
# ROTEAMENTO DE CANAL — integra o score ao modelo Tier 1 / Tier 2 do pitch
# =====================================================================
def rotear_canal(score_total: int) -> dict:
    if score_total >= THRESHOLD_APROVAR:
        return {
            "tier": "Tier 1 — Produto Campeão",
            "decisao": "Aprovar",
            "canal_recomendado": "Shopify (hero funnel / LP única) + Instagram Ads + Mercado Ads (topo)",
            "acao": "Tráfego pago pesado; redesenho de LP single-product; vídeos CapCut de alta retenção.",
        }
    elif score_total >= THRESHOLD_REVISAR:
        return {
            "tier": "Tier 2 — Catálogo de Estabilidade",
            "decisao": "Revisar / Aprovar condicional",
            "canal_recomendado": "Mercado Livre (orgânico / cauda longa) + Order Bump/Upsell no Shopify",
            "acao": "Cadastro no Mercado Livre sem CAC; usar como order bump do produto Tier 1, não como vitrine própria.",
        }
    else:
        return {
            "tier": "Reprovado",
            "decisao": "Reprovar",
            "canal_recomendado": None,
            "acao": "Não avançar para nenhum canal; arquivar dados para reavaliação futura se contexto mudar.",
        }


# =====================================================================
# FUNÇÃO CENTRAL: CALCULAR_SCORE
# =====================================================================
def calcular_score(
    df_meta: pd.DataFrame,
    df_tiktok: pd.DataFrame,
    df_fornecedores: pd.DataFrame,
    produto: str,
    historico_path: str = "outputs/historico_scores.json",
) -> dict:
    meta = score_meta(df_meta)
    tiktok = score_tiktok(df_tiktok)
    ali = score_aliexpress(df_fornecedores)
    preco = cruzamento_preco(df_meta, ali)

    subtotal = meta["pontos"] + tiktok["pontos"] + ali["pontos"]

    penalizacoes = []
    penalizacoes.append(preco["penalizacao"])
    if ali.get("depende_campo_provisorio"):
        penalizacoes.append(-10)
    if meta.get("paginas_copy_generico", 0) > 0:
        penalizacoes.append(-5 * min(meta["paginas_copy_generico"], 3))  # cap para não zerar sozinho

    estabilidade = estabilidade_temporal(produto, subtotal, historico_path)
    penalizacoes.append(estabilidade["penalizacao"])

    score_total = max(0, min(100, subtotal + sum(penalizacoes)))

    roteamento = rotear_canal(score_total)

    resultado = {
        "produto": produto,
        "data_coleta": datetime.now().isoformat(),
        "score_total": score_total,
        "sub_scores": {"meta": meta, "tiktok": tiktok, "aliexpress": ali},
        "cruzamento_preco": preco,
        "estabilidade_temporal": estabilidade,
        "penalizacoes_aplicadas": penalizacoes,
        **roteamento,
    }

    persistir_historico(produto, score_total, resultado["decisao"], historico_path)
    return resultado


# =====================================================================
# GERAÇÃO DE LISTING — transforma score em campos prontos para loja
# Shopify (margem cheia) e Mercado Livre (desconto de ~15% de tarifa)
# =====================================================================

# Câmbio e markup configuráveis aqui — ajuste conforme sua operação
CAMBIO_USD_BRL = 5.80       # câmbio USD → BRL (atualize manualmente)
MARKUP_DROPSHIPPING = 3.2   # multiplicador sobre custo do produto


def _inferir_categoria_ml(titulo: str) -> str:
    """
    Infere a categoria do Mercado Livre a partir de palavras-chave no título.
    Adicione novos blocos conforme expandir o catálogo.
    """
    titulo_lower = titulo.lower()
    if any(p in titulo_lower for p in ["organizador", "cesto", "gaveta", "prateleira", "suporte"]):
        return "Casa e Decoração > Organização"
    if any(p in titulo_lower for p in ["anel", "brinco", "colar", "argola", "pulseira", "joia", "bijuteria"]):
        return "Moda e Acessórios > Joias e Bijuterias"
    if any(p in titulo_lower for p in ["perfume", "colônia", "fragrância", "eau de"]):
        return "Beleza e Cuidado > Perfumes"
    if any(p in titulo_lower for p in ["whey", "proteína", "suplemento", "creatina"]):
        return "Esportes e Fitness > Suplementos"
    if any(p in titulo_lower for p in ["fone", "bluetooth", "earbuds", "headphone", "caixa de som"]):
        return "Eletrônicos > Áudio"
    if any(p in titulo_lower for p in ["led", "luminária", "luz", "lâmpada"]):
        return "Casa e Decoração > Iluminação"
    return "Outros"


def _construir_descricao_shopify(resultado: dict, titulo_base: str) -> str:
    """
    Monta uma descrição de produto para Shopify baseada nos sinais coletados.
    Usa ad_copy real dos anúncios Meta quando disponível — é copy já testado.
    """
    lojas = resultado.get("sub_scores", {}).get("meta", {}).get("lojas_unicas", 0)
    tier = resultado.get("tier", "")

    # Tenta recuperar a ad_copy real do DataFrame fatiado (quando disponível
    # no resultado). Se não vier, usa copy genérico baseado nos metadados.
    ad_copy_real = resultado.get("_ad_copy_amostra")  # injetado opcionalmente

    if ad_copy_real and sinal_valido(ad_copy_real):
        intro = ad_copy_real[:300].strip()
        if not intro.endswith("."):
            intro += "."
    else:
        intro = f"Produto com alta demanda comprovada — {lojas} lojas anunciando ativamente."

    sufixo_tier = ""
    if "Tier 1" in tier:
        sufixo_tier = "\n\n⚡ Produto campeão — entrega rápida e qualidade verificada."
    elif "Tier 2" in tier:
        sufixo_tier = "\n\n✅ Produto de catálogo estável — boa margem e entrega confiável."

    return f"{intro}{sufixo_tier}"


def gerar_listing(resultado: dict, fornecedor: dict, ad_copy_amostra: str = "") -> dict:
    """
    Transforma o output de calcular_score + dados do fornecedor em campos
    prontos para colar no Shopify e cadastrar no Mercado Livre.

    Parâmetros:
        resultado       — dict retornado por calcular_score()
        fornecedor      — dict de uma linha do df_fornecedores (iloc[0].to_dict())
        ad_copy_amostra — (opcional) ad_copy real de um anúncio Meta para usar
                          como base de descrição; se vazio usa copy genérico

    Retorna dict com seções "shopify", "mercado_livre" e "fornecedor".
    """
    titulo_base = fornecedor.get("product_title") or resultado.get("produto", "Produto")
    custo_usd = fornecedor.get("unit_cost_usd")
    frete_usd = fornecedor.get("shipping_cost_usd")  # pode ser None — não inventar

    # Custo total em USD (produto + frete se disponível)
    custo_total_usd = None
    if sinal_valido(custo_usd):
        custo_total_usd = custo_usd + (frete_usd or 0)

    # Preço de venda sugerido — usa suggested_sell_price_usd do Ali se veio,
    # senão calcula markup sobre custo (markup * câmbio já em BRL)
    suggested_usd = fornecedor.get("suggested_sell_price_usd")
    if sinal_valido(suggested_usd):
        preco_shopify_brl = round(suggested_usd * CAMBIO_USD_BRL, 2)
    elif sinal_valido(custo_total_usd):
        preco_shopify_brl = round(custo_total_usd * CAMBIO_USD_BRL * MARKUP_DROPSHIPPING, 2)
    else:
        preco_shopify_brl = None  # sem custo confirmado — não inventar preço

    # ML recebe preço reduzido para absorver a tarifa de ~15%
    preco_ml_brl = round(preco_shopify_brl * 0.85, 2) if sinal_valido(preco_shopify_brl) else None

    # Margem estimada (em BRL, sem frete de envio ao cliente final)
    margem_brl = None
    if sinal_valido(preco_shopify_brl) and sinal_valido(custo_total_usd):
        margem_brl = round(preco_shopify_brl - (custo_total_usd * CAMBIO_USD_BRL), 2)

    # Injeta ad_copy na resultado para a função de descrição acessar
    resultado["_ad_copy_amostra"] = ad_copy_amostra

    descricao = _construir_descricao_shopify(resultado, titulo_base)

    # Remove chave temporária para não poluir o resultado original
    resultado.pop("_ad_copy_amostra", None)

    return {
        # ── Shopify ───────────────────────────────────────────────────────
        "shopify": {
            "titulo": titulo_base.title(),
            "preco_brl": preco_shopify_brl,
            "descricao": descricao,
            "tag_tier": resultado.get("tier", ""),
            "tag_nicho": _inferir_categoria_ml(titulo_base),
            "score": resultado.get("score_total"),
            "decisao": resultado.get("decisao"),
        },

        # ── Mercado Livre ─────────────────────────────────────────────────
        "mercado_livre": {
            "titulo": f"{titulo_base.title()} | Pronta Entrega",
            "preco_brl": preco_ml_brl,
            "categoria_sugerida": _inferir_categoria_ml(titulo_base),
            "nota_preco": (
                "⚠️ Custo sem dado confirmado — precificar manualmente"
                if not sinal_valido(preco_ml_brl)
                else "OK — preço calculado com tarifa ML (~15%) absorvida"
            ),
        },

        # ── Fornecedor ────────────────────────────────────────────────────
        "fornecedor": {
            "url": fornecedor.get("product_url", ""),
            "custo_unitario_usd": custo_usd,
            "frete_usd": frete_usd,
            "custo_total_usd": custo_total_usd,
            "margem_estimada_brl": margem_brl,
            "rating": fornecedor.get("supplier_rating"),
            "pedidos_totais": fornecedor.get("total_orders"),
            "aviso_frete": (
                "⚠️ Frete não confirmado pelo ator AliExpress — incluir manualmente"
                if not sinal_valido(frete_usd)
                else None
            ),
        },

        # ── Meta ──────────────────────────────────────────────────────────
        "meta_dados": {
            "produto": resultado.get("produto"),
            "data_coleta": resultado.get("data_coleta"),
            "score_total": resultado.get("score_total"),
            "canal_recomendado": resultado.get("canal_recomendado"),
        },
    }


# =====================================================================
# EXEMPLO DE USO / EXECUÇÃO MOCK
# PATCH 2: Bloco __main__ simplificado (sem referências hardcoded)
# =====================================================================
if __name__ == "__main__":
    print("Módulo 'scoring_engine.py' importado com sucesso.")
    print("Funções disponíveis: calcular_score, gerar_listing")
    print("Os gates (Meta >=5 lojas, Ali dispatch <=2 dias, nota >=4.7) estão ativados.")
    print("Use: from scoring_engine import calcular_score, gerar_listing")
    print("Exemplo:")
    print("  resultado = calcular_score(df_meta, df_tiktok, df_fornecedores, produto='organizador gaveta')")
    print("  listing   = gerar_listing(resultado, df_fornecedores.iloc[0].to_dict(), ad_copy_amostra=df_meta['ad_copy'].iloc[0])")