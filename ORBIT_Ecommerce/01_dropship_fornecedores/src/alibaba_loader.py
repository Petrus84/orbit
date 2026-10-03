"""
alibaba_loader.py
=================
Carrega o JSON de produtos pré-filtrados do Alibaba (orbit_L1_filtrado_*.json)
e entrega dois artefatos prontos para o pipeline:

  1. df_fornecedores_por_produto  — dict[str, pd.DataFrame]
     Chave = nome curto do produto (usado como "sku_nome" no pipeline)
     Valor = DataFrame no schema exato esperado por calcular_score()

  2. lista_produtos_aprovados     — list[dict]
     Cada item tem os mesmos campos que produtos_minerados do pipeline
     original, incluindo "ad_copy_amostra" gerado a partir dos dados
     do próprio JSON (sem custo Apify).

Compatibilidade:
  - scoring_engine.py  (calcular_score, gerar_listing)
  - pipeline_dropship_apify_v2.py  (loop Etapa 3)

Uso standalone (substitui Etapas 1+2 quando não há cache Meta/TikTok):
  python alibaba_loader.py

Uso integrado (chamado pelo pipeline):
  from alibaba_loader import carregar_produtos_alibaba
  produtos, df_map = carregar_produtos_alibaba("orbit_L1_filtrado_*.json")
"""

from __future__ import annotations

import glob
import json
import os
import re
from datetime import datetime
from typing import Optional

import pandas as pd

# =====================================================================
# CONSTANTES DE FILTRO — ajuste aqui sem tocar no resto
# =====================================================================
CAMBIO_USD_BRL      = 5.80   # câmbio operacional (atualizar manualmente)
MOQ_MAXIMO          = 10     # dropshipping puro: sem estoque inicial alto
LIQUIDEZ_MINIMA_PCT = 0.0    # 0 = aceita todos aprovados (filtra depois no score)
LIQUIDEZ_CONFIRMADA = 5.0    # produtos acima deste % têm pedidos verificados

# Categorias do JSON Alibaba que batem com a audiência @cpimportstore
# (mulheres 18–34, SP — organização, gadgets, casa inteligente)
CATEGORIAS_PRIORITARIAS = {
    "kitchen organizer": "Casa e Decoração > Organização",
    "home gadgets":      "Casa e Decoração > Gadgets",
    "gadget":            "Eletrônicos > Gadgets",
    "creative toys":     "Brinquedos e Hobbies",
    "smart home":        "Casa Inteligente",
    "car accessories":   "Acessórios Automotivos",
}

# =====================================================================
# UTILITÁRIO: gera ad_copy de amostra a partir dos dados do produto
# (substitui o copy real da Meta quando não há cache disponível)
# =====================================================================
def _gerar_ad_copy_amostra(produto: dict) -> str:
    """
    Monta um ad_copy sintético mas informativo a partir dos metadados
    do produto. Usado como base de descrição no gerar_listing() quando
    não há anúncio Meta disponível para aquele SKU.
    """
    nome   = produto.get("nome", "")
    cat    = CATEGORIAS_PRIORITARIAS.get(produto.get("categoria_original", ""), "")
    liq    = produto.get("liquidez_pct_na_categoria", 0)
    ped    = produto.get("pedidos")
    rating = produto.get("avaliacao", 0)
    pv     = produto.get("pv_brl", 0)
    moq    = produto.get("moq", 1)

    partes = [nome + "."]

    if ped and ped > 0:
        partes.append(f"{ped:,} pedidos confirmados no Alibaba.".replace(",", "."))

    if rating >= 4.7:
        partes.append(f"Avaliação {rating}/5 — fornecedor verificado.")
    elif rating >= 4.5:
        partes.append(f"Avaliação {rating}/5.")

    if liq >= LIQUIDEZ_CONFIRMADA:
        partes.append(f"Liquidez {liq:.0f}% na categoria {cat}.")

    if moq == 1:
        partes.append("Disponível sem estoque mínimo — dropshipping direto.")
    elif moq <= 5:
        partes.append(f"MOQ {moq} unidades — baixo investimento inicial.")

    partes.append(f"Preço sugerido de venda: R$ {pv:.2f}.")

    return " ".join(partes)


# =====================================================================
# UTILITÁRIO: gera nome curto de SKU a partir do nome completo
# =====================================================================
_STOPWORDS = {
    "para", "com", "sem", "de", "da", "do", "em", "e", "a", "o",
    "kit", "set", "pack", "oem", "diy", "modelo", "tipo", "versão",
    "fabricação", "personalizado", "personalizada", "universal",
}

def _nome_para_sku(nome: str, max_tokens: int = 4) -> str:
    """
    Reduz o nome longo para um SKU de 2–4 tokens significativos.
    Exemplo: "TYSH Interruptor Touch Zigbee em Vidro Temperado - 1 a 4 Botões"
             → "interruptor touch zigbee"
    """
    # Remove tudo após o primeiro " - " ou " | "
    nome_limpo = re.split(r"\s[-|]\s", nome)[0]
    # Remove marcas (tokens iniciando com maiúscula isolada como "TYSH", "ICsee")
    tokens = nome_limpo.split()
    tokens_filtrados = [
        t.lower() for t in tokens
        if t.lower() not in _STOPWORDS
        and not re.match(r"^[A-Z]{2,}[0-9]*$", t)   # siglas tipo TYSH, CL607
        and not re.match(r"^\d", t)                    # números iniciais
    ]
    sku = " ".join(tokens_filtrados[:max_tokens])
    return sku if sku else nome_limpo[:40].lower()


# =====================================================================
# CONVERSÃO: produto Alibaba → linha do df_fornecedores
# =====================================================================
def _produto_para_fornecedor(produto: dict) -> dict:
    """
    Mapeia um item do JSON Alibaba para o schema exato esperado por
    score_aliexpress() no scoring_engine.py.

    Campos com gap real (não disponíveis no Alibaba B2B):
      - dispatch_days  → None  (Alibaba não expõe prazo de despacho por unidade)
      - delivery_days  → None  (idem)
      - shipping_cost_usd → None (frete B2B não é por unidade)

    O scoring engine já trata None como "dado ausente" (não penaliza
    além do campo_provisorio=True). A penalidade de -10 do campo
    provisório é preferível a inventar um valor.

    Preço:
      - unit_cost_usd  = preco_usd  (preço mínimo de atacado)
      - suggested_sell_price_usd = pv_brl / CAMBIO_USD_BRL
        (pv_brl já foi calculado pelo pipeline anterior com margem ~49%)
    """
    preco_usd = produto.get("preco_usd") or 0
    pv_brl    = produto.get("pv_brl") or 0

    # Converte pv_brl de volta para USD para manter consistência com
    # o scoring_engine (que opera em USD e converte no gerar_listing)
    suggested_usd = round(pv_brl / CAMBIO_USD_BRL, 2) if pv_brl else None

    # total_cost_usd: sem frete confirmado, usa só custo do produto
    total_cost_usd = round(preco_usd, 2) if preco_usd else None

    return {
        "product_title":             produto.get("nome", ""),
        "product_url":               produto.get("url", ""),
        "supplier_rating":           produto.get("avaliacao"),
        "total_orders":              produto.get("pedidos"),       # None se ausente
        "unit_cost_usd":             preco_usd if preco_usd else None,
        "shipping_cost_usd":         None,    # gap real — Alibaba B2B não expõe
        "total_cost_usd":            total_cost_usd,
        "suggested_sell_price_usd":  suggested_usd,
        "delivery_days":             None,    # gap real
        "dispatch_days":             None,    # gap real
        "selo_confiavel":            bool(produto.get("avaliacao", 0) >= 4.7),
        "envio_com_rastreio":        False,   # Alibaba B2B: a ser confirmado
        "campo_dispatch_confirmado": False,   # gap declarado explicitamente
        "campo_selo_confirmado":     False,   # heurístico, não confirmado
        # campos extras do Alibaba — preservados para auditoria
        "_moq":                      produto.get("moq"),
        "_liquidez_pct":             produto.get("liquidez_pct_na_categoria", 0),
        "_margem_pct_original":      produto.get("margem_pct"),
        "_categoria_original":       produto.get("categoria_original", ""),
        "_categoria_br":             CATEGORIAS_PRIORITARIAS.get(
                                         produto.get("categoria_original", ""), "Outros"
                                     ),
        "_pv_brl_original":          pv_brl,
        "_fornecedor_nome":          produto.get("fornecedor", ""),
        "_n_avaliacoes":             produto.get("n_avaliacoes"),
        "_preco_ou_moq_atipico":     produto.get("preco_ou_moq_atipico", False),
        "_flags_seguranca":          produto.get("flags_seguranca", []),
        "data_coleta":               datetime.now().isoformat(),
    }


# =====================================================================
# FILTRO DE ELEGIBILIDADE PARA DROPSHIPPING
# =====================================================================
def _elegivel_para_dropshipping(produto: dict) -> tuple[bool, str]:
    """
    Retorna (elegível, motivo_rejeição).
    Motivo vazio se elegível.
    """
    if not produto.get("aprovado", False):
        return False, "aprovado=False no pipeline anterior"

    if produto.get("preco_ou_moq_atipico", False):
        return False, f"moq_atipico=True (MOQ={produto.get('moq')})"

    moq = produto.get("moq", 999)
    if moq > MOQ_MAXIMO:
        return False, f"MOQ={moq} > limite {MOQ_MAXIMO}"

    if not produto.get("preco_usd"):
        return False, "preco_usd ausente"

    if not produto.get("nome"):
        return False, "nome ausente"

    flags = produto.get("flags_seguranca", [])
    if flags:
        return False, f"flags_seguranca={flags}"

    return True, ""


# =====================================================================
# FUNÇÃO PRINCIPAL: carregar_produtos_alibaba
# =====================================================================
def carregar_produtos_alibaba(
    caminho_json: str,
    dias_corte_liquidez: float = LIQUIDEZ_MINIMA_PCT,
    verbose: bool = True,
) -> tuple[list[dict], dict[str, pd.DataFrame]]:
    """
    Carrega o JSON Alibaba e retorna dois objetos prontos para o pipeline.

    Parâmetros:
        caminho_json          — caminho para o arquivo JSON (aceita glob)
        dias_corte_liquidez   — liquidez mínima para incluir produto
                                (0.0 = todos aprovados; 30.0 = só com liquidez)
        verbose               — imprime logs de progresso

    Retorna:
        produtos_minerados    — list[dict] compatível com o loop Etapa 3
                                do pipeline_dropship_apify_v2.py
        df_fornecedores_map   — dict[sku_nome → pd.DataFrame] com 1 linha
                                por produto (fornecedor único do Alibaba)
    """
    # Resolve glob se necessário
    arquivos = glob.glob(caminho_json)
    if not arquivos:
        raise FileNotFoundError(f"Nenhum arquivo encontrado em: {caminho_json}")
    arquivo = sorted(arquivos)[-1]  # usa o mais recente se houver vários

    if verbose:
        print(f"[alibaba_loader] Carregando: {arquivo}")

    with open(arquivo, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if verbose:
        print(f"[alibaba_loader] {len(raw)} produtos no JSON bruto.")

    # --- Filtro de elegibilidade ---
    rejeitados = []
    elegiveis  = []
    for p in raw:
        ok, motivo = _elegivel_para_dropshipping(p)
        if ok:
            liq = p.get("liquidez_pct_na_categoria", 0)
            if liq >= dias_corte_liquidez:
                elegiveis.append(p)
            else:
                rejeitados.append((p["nome"][:50], f"liquidez={liq}% < mínimo={dias_corte_liquidez}%"))
        else:
            rejeitados.append((p.get("nome", "?")[:50], motivo))

    if verbose:
        print(f"[alibaba_loader] Elegíveis: {len(elegiveis)} | Rejeitados: {len(rejeitados)}")

    if not elegiveis:
        return [], {}

    # --- Deduplicação por SKU ---
    # Produtos com nome muito similar viram o mesmo SKU — mantém o de maior liquidez
    sku_map: dict[str, dict] = {}
    for p in elegiveis:
        sku = _nome_para_sku(p["nome"])
        if sku not in sku_map:
            sku_map[sku] = p
        else:
            # mantém o de maior liquidez
            if p.get("liquidez_pct_na_categoria", 0) > sku_map[sku].get("liquidez_pct_na_categoria", 0):
                sku_map[sku] = p

    if verbose:
        print(f"[alibaba_loader] SKUs únicos após deduplicação: {len(sku_map)}")

    # --- Monta artefatos de saída ---
    colunas_df = [
        "product_title", "product_url", "supplier_rating", "total_orders",
        "unit_cost_usd", "shipping_cost_usd", "total_cost_usd",
        "suggested_sell_price_usd", "delivery_days", "dispatch_days",
        "selo_confiavel", "envio_com_rastreio", "campo_dispatch_confirmado",
        "campo_selo_confirmado", "_moq", "_liquidez_pct", "_margem_pct_original",
        "_categoria_original", "_categoria_br", "_pv_brl_original",
        "_fornecedor_nome", "_n_avaliacoes", "_preco_ou_moq_atipico",
        "_flags_seguranca", "data_coleta",
    ]

    produtos_minerados: list[dict] = []
    df_fornecedores_map: dict[str, pd.DataFrame] = {}

    # Ordena por liquidez desc para processar os melhores primeiro
    itens_ordenados = sorted(
        sku_map.items(),
        key=lambda kv: (
            -kv[1].get("liquidez_pct_na_categoria", 0),
            -(kv[1].get("pedidos") or 0),
        )
    )

    for sku_nome, produto in itens_ordenados:
        fornecedor_row = _produto_para_fornecedor(produto)
        df = pd.DataFrame([fornecedor_row])

        # Garante que todas as colunas esperadas existem
        for col in colunas_df:
            if col not in df.columns:
                df[col] = None

        ad_copy = _gerar_ad_copy_amostra(produto)

        produtos_minerados.append({
            "sku_nome":        sku_nome,
            "keyword_origem":  produto.get("categoria_original", "alibaba"),
            "df_meta_fatiado": pd.DataFrame(),   # vazio — sem dados Meta para esse SKU
            "ad_copy_amostra": ad_copy,
            # campos extras para rastreabilidade
            "_produto_alibaba": produto,
            "_liquidez_pct":    produto.get("liquidez_pct_na_categoria", 0),
            "_pv_brl":          produto.get("pv_brl"),
            "_moq":             produto.get("moq"),
        })
        df_fornecedores_map[sku_nome] = df

    if verbose:
        print(f"[alibaba_loader] Pronto. {len(produtos_minerados)} produtos carregados.\n")
        print(f"{'SKU':<40} {'Liquidez':>8} {'MOQ':>4} {'R$':>7} {'Pedidos':>8}")
        print("-" * 72)
        for item in produtos_minerados[:15]:
            print(
                f"{item['sku_nome']:<40} "
                f"{item['_liquidez_pct']:>7.1f}% "
                f"{item['_moq']:>4} "
                f"R${item['_pv_brl']:>6.1f} "
                f"{item['_produto_alibaba'].get('pedidos') or 'N/A':>8}"
            )
        if len(produtos_minerados) > 15:
            print(f"  ... e mais {len(produtos_minerados) - 15} produtos.")

    return produtos_minerados, df_fornecedores_map


# =====================================================================
# INTEGRAÇÃO COM O PIPELINE — substitui Etapas 1 + 2 quando não há
# cache Meta/TikTok ou quando se quer rodar só com dados do Alibaba
# =====================================================================
def pipeline_alibaba_standalone(
    caminho_json: str,
    df_tiktok: "pd.DataFrame | None" = None,
    max_produtos: int = 10,
    historico_path: str = "outputs/historico_scores.json",
) -> list[dict]:
    """
    Roda o pipeline completo usando apenas o JSON Alibaba como fonte
    de fornecedores. Retorna lista de resultados com score + listing.

    df_tiktok pode ser passado se houver cache disponível — senão usa
    DataFrame vazio (score TikTok = 0, mas pipeline não quebra).
    """
    from scoring_engine import calcular_score, gerar_listing

    if df_tiktok is None:
        df_tiktok = pd.DataFrame(
            columns=["plataforma", "ad_title", "ctr_tier", "ctr_rank",
                     "likes", "video_url", "landing_page", "data_coleta"]
        )

    produtos_minerados, df_fornecedores_map = carregar_produtos_alibaba(
        caminho_json, verbose=True
    )

    os.makedirs("outputs", exist_ok=True)
    resultados = []

    print(f"\n[+] Scoring e geração de listings ({min(max_produtos, len(produtos_minerados))} produtos)...\n")

    for item in produtos_minerados[:max_produtos]:
        sku          = item["sku_nome"]
        df_meta_sku  = item["df_meta_fatiado"]   # DataFrame vazio — sem Meta
        ad_copy_base = item["ad_copy_amostra"]
        df_fornec    = df_fornecedores_map[sku]

        print(f"--- [{sku}] ---")

        resultado = calcular_score(
            df_meta=df_meta_sku,
            df_tiktok=df_tiktok,
            df_fornecedores=df_fornec,
            produto=sku,
            historico_path=historico_path,
        )

        print(f"  Score: {resultado['score_total']} | {resultado['tier']}")
        print(f"  Decisão: {resultado['decisao']} | Canal: {resultado['canal_recomendado']}")

        if resultado["decisao"] != "Reprovar" and not df_fornec.empty:
            fornecedor_top = df_fornec.iloc[0].to_dict()
            listing = gerar_listing(
                resultado=resultado,
                fornecedor=fornecedor_top,
                ad_copy_amostra=ad_copy_base,
            )

            nome_arquivo = f"outputs/listing_{sku.replace(' ', '_')}.json"
            with open(nome_arquivo, "w", encoding="utf-8") as f:
                json.dump(listing, f, ensure_ascii=False, indent=2)

            print(f"  ✅ Listing salvo: {nome_arquivo}")
            print(f"     Shopify: R$ {listing['shopify']['preco_brl']} | "
                  f"ML: R$ {listing['mercado_livre']['preco_brl']} | "
                  f"Margem est.: R$ {listing['fornecedor']['margem_estimada_brl']}")

            resultado["_listing"] = listing
        elif resultado["decisao"] == "Reprovar":
            print("  ❌ Reprovado — não gera listing.")
        else:
            print("  ⚠️  Aprovado mas sem fornecedor — listing não gerado.")

        resultados.append(resultado)
        print()

    # Salva resumo consolidado de todos os resultados
    resumo = []
    for r in resultados:
        listing = r.get("_listing", {})
        resumo.append({
            "produto":        r["produto"],
            "score":          r["score_total"],
            "tier":           r["tier"],
            "decisao":        r["decisao"],
            "canal":          r["canal_recomendado"],
            "shopify_preco":  listing.get("shopify", {}).get("preco_brl"),
            "ml_preco":       listing.get("mercado_livre", {}).get("preco_brl"),
            "margem_brl":     listing.get("fornecedor", {}).get("margem_estimada_brl"),
            "fornecedor_url": listing.get("fornecedor", {}).get("url"),
        })

    resumo_path = "outputs/resumo_alibaba.json"
    with open(resumo_path, "w", encoding="utf-8") as f:
        json.dump(resumo, f, ensure_ascii=False, indent=2)
    print(f"[✅] Resumo consolidado salvo: {resumo_path}")

    return resultados


# =====================================================================
# EXECUÇÃO STANDALONE
# =====================================================================
if __name__ == "__main__":
    import sys

    # Aceita caminho como argumento ou usa padrão
    padrao = sys.argv[1] if len(sys.argv) > 1 else "orbit_L1_filtrado_*.json"

    print("=" * 60)
    print("  ALIBABA LOADER — Pipeline Standalone")
    print("=" * 60)
    print()

    resultados = pipeline_alibaba_standalone(
        caminho_json=padrao,
        df_tiktok=None,    # sem TikTok — score TikTok = 0 (honesto)
        max_produtos=10,   # processa top 10 por liquidez
    )

    aprovados  = [r for r in resultados if r["decisao"] != "Reprovar"]
    reprovados = [r for r in resultados if r["decisao"] == "Reprovar"]

    print("=" * 60)
    print(f"  RESULTADO FINAL")
    print(f"  Aprovados (Tier 1 + Tier 2): {len(aprovados)}")
    print(f"  Reprovados:                  {len(reprovados)}")
    print(f"  Listings gerados em:         outputs/listing_*.json")
    print(f"  Resumo em:                   outputs/resumo_alibaba.json")
    print("=" * 60)