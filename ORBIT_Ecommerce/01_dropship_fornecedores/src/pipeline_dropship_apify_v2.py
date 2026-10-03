from __future__ import annotations

from alibaba_loader import carregar_produtos_alibaba
import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd
from dotenv import load_dotenv
from apify_client import ApifyClient

from scoring_engine import calcular_score, gerar_listing

load_dotenv()
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
if not APIFY_TOKEN:
    raise ValueError("Erro: Variável APIFY_TOKEN não encontrada no arquivo .env!")

client = ApifyClient(APIFY_TOKEN)

# =====================================================================
# PATCH 1: TTL DINÂMICO (Modo Econômico para Testes)
# =====================================================================
MODO_ECONOMICO = os.getenv("MODO_ECONOMICO", "True").lower() == "true"
CACHE_DIR = "cache_apify"
CACHE_TTL_HORAS = 240 if MODO_ECONOMICO else 48

if MODO_ECONOMICO:
    print("[*] MODO ECONÔMICO ATIVADO: Cache TTL = 240 horas (10 dias)")
else:
    print("[*] MODO PRODUÇÃO ATIVADO: Cache TTL = 48 horas (2 dias)")


def _dataset_id(run):
    if isinstance(run, dict):
        return run.get("defaultDatasetId")
    return getattr(run, "default_dataset_id", None) or getattr(run, "defaultDatasetId", None)


# =====================================================================
# CACHE LOCAL
# =====================================================================
CACHE_SCHEMA_VERSION = "v2"


def _cache_key(nome_ator: str, run_input: dict) -> str:
    payload = json.dumps(
        {"ator": nome_ator, "input": run_input, "schema_version": CACHE_SCHEMA_VERSION},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _ler_cache(chave: str):
    caminho = os.path.join(CACHE_DIR, f"{chave}.json")
    if not os.path.exists(caminho):
        return None

    idade = datetime.now() - datetime.fromtimestamp(os.path.getmtime(caminho))
    if idade > timedelta(hours=CACHE_TTL_HORAS):
        return None

    with open(caminho, "r", encoding="utf-8") as f:
        return json.load(f)


def _gravar_cache(chave: str, itens: list) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, f"{chave}.json"), "w", encoding="utf-8") as f:
        json.dump(itens, f, ensure_ascii=False)


# =====================================================================
# GATEKEEPER DE CRÉDITOS
# =====================================================================
def _rodar_ator_com_cache(nome_ator: str, run_input: dict) -> list:
    chave = _cache_key(nome_ator, run_input)
    cache = _ler_cache(chave)
    if cache is not None:
        print(f"  [cache] Reaproveitando resultado de '{nome_ator}' (sem custo Apify).")
        return cache

    if MODO_ECONOMICO:
        if "maxResults" in run_input and run_input["maxResults"] > 30:
            print(f"  [economia] Reduzindo maxResults de {run_input['maxResults']} → 30")
            run_input["maxResults"] = 30
        if "maxItems" in run_input and run_input["maxItems"] > 30:
            print(f"  [economia] Reduzindo maxItems de {run_input['maxItems']} → 30")
            run_input["maxItems"] = 30

    try:
        print(f"  [apify] Consumindo créditos para rodar '{nome_ator}'...")
        run = client.actor(nome_ator).call(run_input=run_input)
        dataset_id = _dataset_id(run)
        if not dataset_id:
            return []

        itens = list(client.dataset(dataset_id).iterate_items())
        _gravar_cache(chave, itens)
        return itens

    except Exception as e:
        erro_msg = str(e).lower()
        
        if any(palavra in erro_msg for palavra in ["limit", "credit", "402", "exceeded", "payment"]):
            print(f"  [!] ⚠️  ALERTA CRÍTICO: Limite de créditos atingido na Apify!")
            print(f"  [!] ⚠️  Entrando em Modo Offline — Nenhuma nova coleta será feita.")
            return []
        
        elif "429" in erro_msg or "too many requests" in erro_msg:
            print(f"  [!] ⚠️  ALERTA: Rate limit atingido (429 Too Many Requests)")
            return []
        
        else:
            print(f"  [!] ⚠️  Erro inesperado na Apify: {e}")
            try:
                os.makedirs("outputs", exist_ok=True)
                with open("outputs/apify_errors.log", "a", encoding="utf-8") as f:
                    f.write(json.dumps({
                        "timestamp": datetime.now().isoformat(),
                        "ator": nome_ator,
                        "erro": str(e),
                    }, ensure_ascii=False, default=str) + "\n")
            except Exception:
                pass
            return []


# =====================================================================
# ETAPA 1A — META ADS
# =====================================================================
def extrair_meta_ads(keywords: list, pais: str = "BR", dias_corte: int = 5, proxy_group: str = "RESIDENTIAL"):
    print(f"[*] [Meta Ads] Buscando criativos para: {keywords} (país={pais})...")

    run_input = {
        "country": pais,
        "debugMode": False,
        "includeUnverifiedMetaSearchResults": False,
        "keywords": keywords[:5],  # LIMITE RÍGIDO DO ATOR
        "maxResults": 30,
        "proxy": {"useApifyProxy": True, "apifyProxyGroups": [proxy_group]},
    }

    anuncios_por_pagina = {}

    CAMPOS_KEYWORD_CANDIDATOS = ["searchKeyword", "keyword", "matchedKeyword", "sourceKeyword", "query", "searchTerm"]

    try:
        itens = _rodar_ator_com_cache("jy-labs/meta-ad-library-multi-search-scraper", run_input)

        if itens:
            os.makedirs("outputs", exist_ok=True)
            with open("outputs/debug_meta_raw_sample.json", "w", encoding="utf-8") as f:
                json.dump(itens[:3], f, ensure_ascii=False, indent=2, default=str)

        for item in itens:
            data_raw = item.get("startDate") or item.get("start_date") or item.get("startDate_timestamp")
            dias_rodando = None

            if data_raw:
                try:
                    if isinstance(data_raw, (int, float)):
                        data_inicio = datetime.fromtimestamp(data_raw)
                    else:
                        data_inicio = datetime.strptime(str(data_raw)[:10], "%Y-%m-%d")
                    dias_rodando = (datetime.now() - data_inicio).days
                except Exception:
                    dias_rodando = None

            if dias_rodando is None or dias_rodando < dias_corte:
                continue

            page_name = item.get("brand", "")
            ad_copy = item.get("body", "")

            imagens = item.get("images") or []
            videos_item = item.get("videos") or []
            media_url = ""
            if imagens and isinstance(imagens[0], dict):
                media_url = imagens[0].get("url", "")
            if not media_url and videos_item and isinstance(videos_item[0], dict):
                media_url = videos_item[0].get("url", "")

            keyword_origem_item = next(
                (item.get(campo) for campo in CAMPOS_KEYWORD_CANDIDATOS if item.get(campo)),
                None,
            )
            if keyword_origem_item is None:
                terms = (item.get("matchEvidence") or {}).get("terms") or []
                keyword_origem_item = terms[0] if terms else None

            if page_name not in anuncios_por_pagina or dias_rodando > anuncios_por_pagina[page_name]["days_running"]:
                variacoes_anteriores = anuncios_por_pagina.get(page_name, {}).get("variacoes_criativo", 0)
                anuncios_por_pagina[page_name] = {
                    "plataforma": "Meta",
                    "ad_id": str(item.get("libraryID", "")),
                    "page_name": page_name,
                    "start_date": str(data_raw),
                    "days_running": dias_rodando,
                    "ad_copy": ad_copy,
                    "keyword_origem": keyword_origem_item,
                    "target_url": item.get("ctaLink", ""),
                    "media_url": media_url,
                    "variacoes_criativo": variacoes_anteriores + 1,
                    "data_coleta": datetime.now().isoformat(),
                }
            elif page_name in anuncios_por_pagina:
                anuncios_por_pagina[page_name]["variacoes_criativo"] += 1

    except Exception as erro_execucao:
        print(f"  [!] Erro ao extrair anúncios da Meta: {erro_execucao}")

    colunas = ["plataforma", "ad_id", "page_name", "start_date", "days_running",
               "ad_copy", "keyword_origem", "target_url", "media_url", "variacoes_criativo", "data_coleta"]

    if not anuncios_por_pagina:
        print("[-] Nenhum anúncio atingiu o critério de corte de tempo.")
        return pd.DataFrame(columns=colunas)

    return pd.DataFrame(list(anuncios_por_pagina.values()))


# =====================================================================
# ETAPA 1B — TIKTOK ADS
# =====================================================================
def extrair_tiktok_top_ads(termo_nicho: str = "", pais: str = "BR", top_n: int = 20):
    print(f"[*] [TikTok Ads] Buscando top ads (filtro local por nicho: '{termo_nicho or 'nenhum'}')...")

    run_input = {
        "adFormat": "All Formats",
        "country": pais,
        "industry": "All Industries",
        "maxResults": top_n,
        "objective": "All Objectives",
        "orderBy": "For You",
        "period": "30",
        "proxyConfiguration": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        "responseFormat": "concise",
    }

    videos = []

    CTR_TIER_RANK = {
        "top_10%": 4,
        "top_25%": 3,
        "top_50%": 2,
        "below_50%": 1,
    }

    try:
        itens = _rodar_ator_com_cache("khadinakbar/tiktok-ads-scraper", run_input)

        for item in itens:
            titulo = item.get("ad_title", "") or ""
            paises_item = item.get("countries") or []
            ctr_tier_raw = item.get("ctr_tier")

            if termo_nicho and termo_nicho.lower() not in titulo.lower():
                continue
            if pais and paises_item and pais.upper() not in [p.upper() for p in paises_item]:
                continue

            videos.append({
                "plataforma": "TikTok",
                "ad_title": titulo,
                "ctr_tier": ctr_tier_raw,
                "ctr_rank": CTR_TIER_RANK.get(ctr_tier_raw) if ctr_tier_raw else None,
                "likes": item.get("likes"),
                "video_url": item.get("video_url", ""),
                "landing_page": None,
                "data_coleta": datetime.now().isoformat(),
            })

    except Exception as erro_execucao:
        print(f"  [!] Erro ao extrair TikTok Ads: {erro_execucao}")

    colunas = ["plataforma", "ad_title", "ctr_tier", "ctr_rank", "likes", "video_url", "landing_page", "data_coleta"]
    if not videos:
        return pd.DataFrame(columns=colunas)

    return pd.DataFrame(videos)


# =====================================================================
# EXECUÇÃO INTEGRADA — mineração + query builder + scoring + listing
# =====================================================================
if __name__ == "__main__":
    KEYWORDS_DESCOBERTA = [
        "organizador", "magnético", "portátil", "automotivo", 
        "suporte", "ferramenta", "led", "sem fio"
    ]

    print("[+] Etapa 1: Minerando demanda ampla na Meta e TikTok...")
    df_meta = extrair_meta_ads(keywords=KEYWORDS_DESCOBERTA, pais="BR", dias_corte=5)
    df_tiktok = extrair_tiktok_top_ads(termo_nicho="", pais="BR")

    if df_meta.empty:
        print("[-] Nenhum anúncio Meta atingiu o critério de corte de tempo.")
        exit(0)

    print("[+] Etapa 2: Extraindo produtos viáveis + query builder...")
    produtos_minerados = []
    usa_campo_real = "keyword_origem" in df_meta.columns and df_meta["keyword_origem"].notna().any()
    if not usa_campo_real:
        print("  [aviso] Ator não expôs campo de keyword — usando heurístico de substring.")

    for kw in KEYWORDS_DESCOBERTA:
        if usa_campo_real:
            df_kw = df_meta[df_meta["keyword_origem"].astype(str).str.lower() == kw.lower()]
        else:
            df_kw = df_meta[df_meta['ad_copy'].str.contains(kw, case=False, na=False)]

        if len(df_kw) == 0:
            print(f"  [mineração] '{kw}': nenhum anúncio sobrevivente. Pulando.")
            continue

        amostra_ad_copy = str(df_kw['ad_copy'].iloc[0])
        query_sku = montar_query_sku(kw, amostra_ad_copy)
        if query_sku is None:
            print(f"  [query_builder] '{kw}' sem qualificador mapeado — pulando.")
            continue

        produtos_minerados.append({
            "sku_nome": query_sku,
            "keyword_origem": kw,
            "df_meta_fatiado": df_kw,
            "ad_copy_amostra": amostra_ad_copy,
        })

    print(f"\n[+] Etapa 3: Validando fornecedores, pontuando e gerando listings ({len(produtos_minerados)} produtos)...\n")

    os.makedirs("outputs", exist_ok=True)

    for item in list(produtos_minerados)[:5]:
        sku = item["sku_nome"]
        df_meta_sku = item["df_meta_fatiado"]
        ad_copy_base = item["ad_copy_amostra"]

        print(f"--- [SKU: '{sku}' | origem: '{item['keyword_origem']}'] ---")

        df_fornecedores = validar_fornecedor_aliexpress(nome_produto_validado=sku)

        resultado = calcular_score(
            df_meta=df_meta_sku,
            df_tiktok=df_tiktok,
            df_fornecedores=df_fornecedores,
            produto=sku,
            historico_path="outputs/historico_scores.json",
        )

        print(f"  > Score: {resultado['score_total']} | Tier: {resultado['tier']}")
        print(f"  > Decisão: {resultado['decisao']} | Canal: {resultado['canal_recomendado']}")

        # Gera listing apenas para produtos aprovados
        if resultado["decisao"] != "Reprovar" and not df_fornecedores.empty:
            fornecedor_top = df_fornecedores.iloc[0].to_dict()
            listing = gerar_listing(
                resultado=resultado,
                fornecedor=fornecedor_top,
                ad_copy_amostra=ad_copy_base,
            )

            nome_arquivo = f"outputs/listing_{sku.replace(' ', '_')}.json"
            with open(nome_arquivo, "w", encoding="utf-8") as f:
                json.dump(listing, f, ensure_ascii=False, indent=2)

            print(f"  > ✅ Listing salvo: {nome_arquivo}")
            print(f"     Shopify: R$ {listing['shopify']['preco_brl']} | "
                  f"ML: R$ {listing['mercado_livre']['preco_brl']} | "
                  f"Margem est.: R$ {listing['fornecedor']['margem_estimada_brl']}")
        elif resultado["decisao"] == "Reprovar":
            print(f"  > ❌ Reprovado — não gera listing.")
        else:
            print(f"  > ⚠️  Aprovado mas sem fornecedor — listing não gerado.")

        print()

    print("[✅] Pipeline concluído com sucesso!")