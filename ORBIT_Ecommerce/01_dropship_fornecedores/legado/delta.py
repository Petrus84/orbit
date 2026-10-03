import os
import json
from datetime import datetime, timedelta
import pandas as pd
from dotenv import load_dotenv
from apify_client import ApifyClient

# =====================================================================
# 1. CONFIGURAÇÃO E AUTENTICAÇÃO SEGURA (.env)
# =====================================================================
load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")

if not APIFY_TOKEN:
    raise ValueError("Erro: Variável APIFY_TOKEN não encontrada no arquivo .env!")

client = ApifyClient(APIFY_TOKEN)


def _dataset_id(run):
    """
    Extrai o defaultDatasetId de forma segura, seja `run` um dicionário
    (versões antigas do apify-client) ou um objeto (versões novas, onde
    os campos vêm como atributos em vez de chaves de dicionário).
    Evita o erro: 'Run' object is not subscriptable.
    """
    if isinstance(run, dict):
        return run.get("defaultDatasetId")
    return getattr(run, "default_dataset_id", None) or getattr(run, "defaultDatasetId", None)


# =====================================================================
# ETAPA 1A — VALIDAÇÃO DE DEMANDA (META AD LIBRARY - jy-labs)
# =====================================================================
def extrair_meta_ads(keywords: list, pais: str = "BR", dias_corte: int = 14, proxy_group: str = "RESIDENTIAL"):
    """
    Usa o ator jy-labs/meta-ad-library-multi-search-scraper.

    IMPORTANTE: o schema real desse ator NÃO tem activeStatus, startDateMax
    nem mediaType. Ele aceita apenas: country (string única), keywords (lista),
    maxResults, debugMode, includeUnverifiedMetaSearchResults e proxy.
    Por isso o corte de "+dias_corte dias rodando" continua sendo feito
    no Python, depois que os dados chegam (não existe filtro de data na entrada).
    """
    print(f"[*] [Meta Ads] Buscando criativos para: {keywords} (país={pais})...")

    anuncios_validos = []

    run_input = {
        "country": pais,
        "debugMode": False,
        "includeUnverifiedMetaSearchResults": False,
        "keywords": keywords[:5],  # o ator aceita várias keywords em uma única chamada
        "maxResults": 30,
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": [proxy_group]
        }
    }

    try:
        run = client.actor("jy-labs/meta-ad-library-multi-search-scraper").call(run_input=run_input)

        dataset_id = _dataset_id(run)
        if not dataset_id:
            print("  [!] Não foi possível obter o dataset_id da Meta. Abortando etapa.")
            return pd.DataFrame(columns=[
                "plataforma", "ad_id", "page_name", "start_date",
                "days_running", "ad_copy", "target_url", "media_url"
            ])

        for item in client.dataset(dataset_id).iterate_items():
            # ATENÇÃO: os nomes de campo abaixo (startDate, adArchiveID, bodyText...)
            # são os mais comuns nesse tipo de ator, mas não foram confirmados
            # no schema de OUTPUT (só validamos o de INPUT). Se vier vazio,
            # confira o exemplo de output na aba "API" ou "Output" do ator na Apify Store.
            data_raw = item.get("startDate") or item.get("start_date") or item.get("startDate_timestamp")
            dias_rodando = 0

            if data_raw:
                try:
                    if isinstance(data_raw, (int, float)):
                        data_inicio = datetime.fromtimestamp(data_raw)
                    else:
                        data_inicio = datetime.strptime(str(data_raw)[:10], "%Y-%m-%d")
                    dias_rodando = (datetime.now() - data_inicio).days
                except Exception:
                    dias_rodando = 0

            if dias_rodando >= dias_corte:
                anuncios_validos.append({
                    "plataforma": "Meta",
                    "ad_id": str(item.get("adArchiveID", "")),
                    "page_name": item.get("pageName", ""),
                    "start_date": str(data_raw),
                    "days_running": dias_rodando,
                    "ad_copy": item.get("bodyText", ""),
                    "target_url": item.get("targetUrl", ""),
                    "media_url": item.get("imageUrl", "") or item.get("videoUrl", "")
                })

    except Exception as erro_execucao:
        print(f"  [!] Erro ao extrair anúncios da Meta: {erro_execucao}")

    if not anuncios_validos:
        print("[-] Nenhum anúncio atingiu o critério de corte de tempo.")
        return pd.DataFrame(columns=[
            "plataforma", "ad_id", "page_name", "start_date",
            "days_running", "ad_copy", "target_url", "media_url"
        ])

    return pd.DataFrame(anuncios_validos)


# =====================================================================
# ETAPA 1B — VALIDAÇÃO DE TENDÊNCIA (TIKTOK CREATIVE CENTER - khadinakbar)
# =====================================================================
def extrair_tiktok_top_ads(termo_nicho: str = "", pais: str = "BR", top_n: int = 20):
    """
    Usa o ator khadinakbar/tiktok-ads-scraper.

    TROCA DE ATOR: o codebyte/tiktok-creative-center-top-ads exige ALUGUEL
    mensal (deu erro "You must rent a paid Actor..."). Trocamos para
    khadinakbar/tiktok-ads-scraper, que usa cobrança "pay-per-event"
    (ex.: 50 ads ≈ $0.15) — sem precisar alugar nada antes de rodar.

    ⚠️ ATENÇÃO: o schema real (confirmado por você no Console da Apify) NÃO
    tem campo "keyword". Ele filtra por adFormat, country, industry, objective,
    orderBy, period — não por termo de busca livre. Ou seja: o filtro por
    `termo_nicho` continua tendo que ser feito aqui no Python, comparando
    contra o título/copy de cada anúncio retornado (igual já estava).

    O campo "orderBy" aceita valores tipo "For You" (visto no seu print);
    ainda não sei se ele tem uma opção equivalente a "CTR" — se tiver, dá
    pra trocar aqui embaixo. Por enquanto ordeno por CTR no Python mesmo,
    depois que os dados chegam.
    """
    print(f"[*] [TikTok Ads] Buscando top ads (filtro local por nicho: '{termo_nicho or 'nenhum'}')...")

    run_input = {
        "adFormat": "All Formats",
        "country": pais,  # destino fixado em BR por padrão
        "industry": "All Industries",
        "maxResults": top_n,
        "objective": "All Objectives",
        "orderBy": "For You",
        "period": "30",
        "proxyConfiguration": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"]
        },
        "responseFormat": "concise"
    }

    videos = []

    try:
        run = client.actor("khadinakbar/tiktok-ads-scraper").call(run_input=run_input)

        dataset_id = _dataset_id(run)
        if dataset_id:
            for item in client.dataset(dataset_id).iterate_items():
                titulo = item.get("title", "") or item.get("adTitle", "")
                pais_item = item.get("country", "") or item.get("countryCode", "")

                # Filtro local por nicho (se termo_nicho foi passado e o ator não filtrar sozinho)
                if termo_nicho and termo_nicho.lower() not in titulo.lower():
                    continue
                # Filtro local por país (só aplica se o item tiver essa info)
                if pais and pais_item and pais_item.upper() != pais.upper():
                    continue

                videos.append({
                    "plataforma": "TikTok",
                    "ad_title": titulo,
                    "ctr": item.get("ctr", 0),
                    "likes": item.get("likes", 0),
                    "video_url": item.get("videoUrl", ""),
                    "landing_page": item.get("landingPageUrl", "")
                })
        else:
            print("  [!] Não foi possível obter o dataset_id do TikTok.")

    except Exception as erro_execucao:
        print(f"  [!] Erro ao extrair TikTok Ads: {erro_execucao}")

    if not videos:
        return pd.DataFrame(columns=[
            "plataforma", "ad_title", "ctr", "likes", "video_url", "landing_page"
        ])

    df_videos = pd.DataFrame(videos)
    df_videos = df_videos.sort_values(by="ctr", ascending=False).head(top_n).reset_index(drop=True)
    return df_videos


# =====================================================================
# ETAPA 2 — VALIDAÇÃO DE LOGÍSTICA (ALIEXPRESS - skystone_labs)
# =====================================================================
def validar_fornecedor_aliexpress(nome_produto_validado: str, pais_destino: str = "BR"):
    """
    Usa o ator skystone_labs/aliexpress-product-scraper.

    IMPORTANTE: o schema real desse ator NÃO tem o campo shipsFrom.
    Removido do input. Se precisar garantir fornecedor da China, esse
    filtro precisa ser feito no Python, checando o campo correspondente
    no item retornado (ex.: item.get("shipsFrom")), se existir.

    ⚠️ FILTROS DE LOGÍSTICA "DROPSHIPPING PURO" (Choice/Verified, método de
    envio, tempo de despacho) — os nomes de campo abaixo (isChoice,
    sellerBadge, shippingMethod, dispatchDays...) são um PALPITE baseado
    em convenções comuns desse tipo de scraper, e NÃO foram confirmados
    contra um output real desse ator. Rode um teste manual (ex.: pelo
    botão "Start" no Console da Apify, como na sua print) e me mande um
    item de exemplo do dataset — aí eu troco esses nomes pelos corretos.
    """
    print(f"[*] [AliExpress] Buscando fornecedor qualificado para: '{nome_produto_validado}'...")

    # NOTA: maxPages=1 é proposital. No seu teste anterior, maxPages=3 disparou
    # um CAPTCHA de slider na 3ª página (proteção anti-bot do próprio AliExpress)
    # e a run terminou com 0 produtos. Com maxPages=1 você já validou 2
    # fornecedores com sucesso. Se precisar de mais itens, prefira rodar
    # a função de novo com queries diferentes a aumentar maxPages numa única run.
    run_input = {
        "currency": "USD",
        "deduplicateProducts": True,
        "includeDescription": False,
        "includeQuestions": False,
        "includeReviews": False,
        "includeShippingDetails": True,
        "includeVariants": True,
        "language": "pt_BR",
        "maxItems": 15,
        "maxPages": 1,
        "minOrderCount": 300,
        "minRating": 4.7,
        "queries": [nome_produto_validado],
        "shipTo": pais_destino,
        "sortBy": "orders"
    }

    fornecedores = []

    for tentativa in range(1, 3):  # até 2 tentativas, pois CAPTCHA/bloqueio pode ser temporário
        try:
            run = client.actor("skystone_labs/aliexpress-product-scraper").call(run_input=run_input)

            dataset_id = _dataset_id(run)
            if not dataset_id:
                print("  [!] Não foi possível obter o dataset_id do AliExpress.")
                break

            itens = list(client.dataset(dataset_id).iterate_items())

            if not itens and tentativa == 1:
                print("  [!] 0 produtos retornados (possível CAPTCHA/bloqueio). Tentando novamente...")
                continue

            for item in itens:
                # Filtro opcional de origem, só aplica se o campo existir no item
                origem = item.get("shipsFrom") or item.get("shipFrom")
                if origem and origem.upper() != "CN":
                    continue

                frete_info = item.get("shippingDetails", {}) or {}
                tempo_entrega = frete_info.get("deliveryDays", 99)
                custo_frete = frete_info.get("shippingCostUSD", 0.0)
                preco_unitario = item.get("minPriceUSD", 0.0)

                # --- PROVISÓRIO (a confirmar com output real) ---
                # Selo Choice/Verified: nome de campo ainda não confirmado
                selo_confiavel = item.get("isChoice") or item.get("badge") in ("Choice", "Verified")
                # Método de envio com rastreio local (ePacket, YunExpress, Correios...)
                metodo_envio = (frete_info.get("shippingMethod") or "").lower()
                envio_com_rastreio = any(m in metodo_envio for m in ["epacket", "yunexpress", "correios", "standard", "direct"])
                # Tempo de despacho do vendedor (dispatch time)
                tempo_despacho = frete_info.get("dispatchDays", 2)  # default otimista se o campo não existir
                # --------------------------------------------------

                if tempo_entrega <= 15 and tempo_despacho <= 2:
                    fornecedores.append({
                        "product_title": item.get("title", ""),
                        "product_url": item.get("productUrl", ""),
                        "supplier_rating": item.get("rating", 0),
                        "total_orders": item.get("orders", 0),
                        "unit_cost_usd": preco_unitario,
                        "shipping_cost_usd": custo_frete,
                        "total_cost_usd": round(preco_unitario + custo_frete, 2),
                        "suggested_sell_price_usd": round((preco_unitario + custo_frete) * 3.5, 2),
                        "delivery_days": tempo_entrega,
                        "dispatch_days": tempo_despacho,
                        "selo_confiavel": bool(selo_confiavel),
                        "envio_com_rastreio": envio_com_rastreio
                    })

            break  # itens obtidos (mesmo que a lista final de fornecedores esteja vazia) — não precisa retentar

        except Exception as erro_execucao:
            print(f"  [!] Erro ao buscar fornecedores no AliExpress (tentativa {tentativa}): {erro_execucao}")
            continue

    if not fornecedores:
        return pd.DataFrame(columns=[
            "product_title", "product_url", "supplier_rating", "total_orders",
            "unit_cost_usd", "shipping_cost_usd", "total_cost_usd",
            "suggested_sell_price_usd", "delivery_days", "dispatch_days",
            "selo_confiavel", "envio_com_rastreio"
        ])

    return pd.DataFrame(fornecedores)


# =====================================================================
# EXECUÇÃO DO PIPELINE INTEGRADO
# =====================================================================
# ⚠️ ATENÇÃO: os valores abaixo são só um EXEMPLO de teste, não uma decisão
# fixa do pipeline. Troque livremente por qualquer nicho/produto que você
# queira validar — a lógica das 3 etapas é genérica e serve pra qualquer
# categoria (postural, gadgets, casa, pet, etc.).
if __name__ == "__main__":
    NICHO_OU_KEYWORDS_PARA_TESTAR = ["correção de postura", "colete postural", "posture corrector"]
    PRODUTO_PARA_VALIDAR_NO_ALIEXPRESS = "magnetic posture corrector"

    df_meta = extrair_meta_ads(keywords=NICHO_OU_KEYWORDS_PARA_TESTAR, pais="BR", dias_corte=14)
    df_tiktok = extrair_tiktok_top_ads(termo_nicho=NICHO_OU_KEYWORDS_PARA_TESTAR[-1], pais="BR")

    print(f"\n[+] Demanda Validada! Meta: {len(df_meta)} anúncios (+14d) | TikTok: {len(df_tiktok)} top vídeos.")

    df_fornecedores = validar_fornecedor_aliexpress(nome_produto_validado=PRODUTO_PARA_VALIDAR_NO_ALIEXPRESS)

    print("\n--- FORNECEDORES APROVADOS (Frete <= 15 dias + Nota >= 4.7) ---")
    if not df_fornecedores.empty:
        print(df_fornecedores[[
            "supplier_rating", "total_orders", "total_cost_usd",
            "suggested_sell_price_usd", "delivery_days"
        ]].to_string(index=False))
    else:
        print("[-] Nenhum fornecedor passou no filtro rigoroso de logística e qualidade!")