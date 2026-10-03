from __future__ import annotations
import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd
from dotenv import load_dotenv
from apify_client import ApifyClient

# Carrega variáveis de ambiente
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

# =====================================================================
# FUNÇÕES DE CACHE E DATASET INFRA
# =====================================================================
def _dataset_id(run):
    if isinstance(run, dict):
        return run.get("defaultDatasetId")
    return getattr(run, "default_dataset_id", None) or getattr(run, "defaultDatasetId", None)

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

def _rodar_ator_com_cache(nome_ator: str, run_input: dict) -> list:
    chave = _cache_key(nome_ator, run_input)
    cache = _ler_cache(chave)
    if cache is not None:
        print(f" [cache] Reaproveitando resultado de '{nome_ator}' (sem custo Apify).")
        return cache
    if MODO_ECONOMICO:
        if "maxResults" in run_input and run_input["maxResults"] > 30:
            print(f" [economia] Reduzindo maxResults de {run_input['maxResults']} → 30")
            run_input["maxResults"] = 30
        if "maxItems" in run_input and run_input["maxItems"] > 30:
            print(f" [economia] Reduzindo maxItems de {run_input['maxItems']} → 30")
            run_input["maxItems"] = 30
    try:
        print(f" [apify] Consumindo créditos para rodar '{nome_ator}'...")
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
            print(f" [!] ALERTA CRÍTICO: Limite de créditos atingido na Apify!")
            print(f" [!] Entrando em Modo Offline — Nenhuma nova coleta será feita.")
        elif "429" in erro_msg or "too many requests" in erro_msg:
            print(f" [!] ALERTA: Rate limit atingido (429 Too Many Requests)")
        else:
            print(f" [!] Erro inesperado na Apify: {e}")
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
        "keywords": keywords[:5],
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
                
                # ✅ CORREÇÃO: Validar se lista não está vazia ANTES de acessar [0]
                imagens = item.get("images") or []
                videos_item = item.get("videos") or []
                media_url = ""
                
                # ✅ SEGURO: Verificar len() antes de acessar índice
                if imagens and len(imagens) > 0 and isinstance(imagens[0], dict):
                    media_url = imagens[0].get("url", "")
                
                if not media_url and videos_item and len(videos_item) > 0 and isinstance(videos_item[0], dict):
                    media_url = videos_item[0].get("url", "")
                
                keyword_origem_item = next(
                    (item.get(campo) for campo in CAMPOS_KEYWORD_CANDIDATOS if item.get(campo)),
                    None,
                )
                if keyword_origem_item is None:
                    terms = (item.get("matchEvidence") or {}).get("terms") or []
                    keyword_origem_item = terms[0] if len(terms) > 0 else None
                
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
        print(f" [!] Erro ao extrair anúncios da Meta: {erro_execucao}")
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
        print(f" [!] Erro ao extrair TikTok Ads: {erro_execucao}")
    colunas = ["plataforma", "ad_title", "ctr_tier", "ctr_rank", "likes", "video_url", "landing_page", "data_coleta"]
    if not videos:
        return pd.DataFrame(columns=colunas)
    return pd.DataFrame(videos)

# =====================================================================
# ETAPA 1C — GOOGLE ADS (SEARCH)
# =====================================================================
def extrair_google_ads(keywords: list, pais: str = "BR", top_n: int = 20):
    print(f"[*] [Google Ads] Buscando anúncios de busca para: {keywords}...")
    run_input = {
        "queries": keywords[:5],
        "maxResults": top_n,
        "countryCode": pais,
        "proxyConfiguration": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
    }
    anuncios = []
    try:
        itens = _rodar_ator_com_cache("apify/google-search-scraper", run_input)
        for item in itens:
            titulo = item.get("title", "") or ""
            descricao = item.get("description", "") or ""
            url = item.get("url", "") or ""
            
            # ✅ SEGURO: Verificar se lista existe e tem elementos
            extensoes = item.get("sitelinks") or []
            sitelinks_texto = ""
            if extensoes and len(extensoes) > 0:
                sitelinks_texto = " | ".join([str(s.get("title", "")) for s in extensoes if isinstance(s, dict)])
            
            anuncios.append({
                "plataforma": "Google Ads",
                "titulo": titulo,
                "descricao": descricao,
                "url": url,
                "sitelinks": sitelinks_texto,
                "data_coleta": datetime.now().isoformat(),
            })
    except Exception as erro_execucao:
        print(f" [!] Erro ao extrair Google Ads: {erro_execucao}")
    colunas = ["plataforma", "titulo", "descricao", "url", "sitelinks", "data_coleta"]
    if not anuncios:
        return pd.DataFrame(columns=colunas)
    return pd.DataFrame(anuncios)

# =====================================================================
# ETAPA 1D — YOUTUBE ADS
# =====================================================================
def extrair_youtube_ads(keywords: list, pais: str = "BR", top_n: int = 20):
    print(f"[*] [YouTube Ads] Buscando vídeos para: {keywords}...")
    run_input = {
        "searchQueries": keywords[:5],
        "maxResults": top_n,
        "proxyConfiguration": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
    }
    videos = []
    try:
        itens = _rodar_ator_com_cache("apify/youtube-scraper", run_input)
        for item in itens:
            titulo = item.get("title", "") or ""
            views = item.get("viewCount", 0) or 0
            likes = item.get("likeCount", 0) or 0
            url = item.get("url", "") or ""
            canal = item.get("channelName", "") or ""
            
            # ✅ SEGURO: Verificar tags antes de acessar
            tags = item.get("tags") or []
            tags_str = ", ".join([str(t) for t in tags if t]) if tags and len(tags) > 0 else ""
            
            videos.append({
                "plataforma": "YouTube",
                "titulo": titulo,
                "canal": canal,
                "views": views,
                "likes": likes,
                "tags": tags_str,
                "url": url,
                "data_coleta": datetime.now().isoformat(),
            })
    except Exception as erro_execucao:
        print(f" [!] Erro ao extrair YouTube Ads: {erro_execucao}")
    colunas = ["plataforma", "titulo", "canal", "views", "likes", "tags", "url", "data_coleta"]
    if not videos:
        return pd.DataFrame(columns=colunas)
    return pd.DataFrame(videos)

# =====================================================================
# CONSOLIDAÇÃO DE RESULTADOS
# =====================================================================
def consolidar_resultados(df_meta, df_tiktok, df_google, df_youtube):
    """Consolida todos os DataFrames em um único, tratando colunas diferentes"""
    print("[*] Consolidando resultados de todas as plataformas...")
    
    dfs_validos = []
    
    if not df_meta.empty:
        dfs_validos.append(df_meta)
    if not df_tiktok.empty:
        dfs_validos.append(df_tiktok)
    if not df_google.empty:
        dfs_validos.append(df_google)
    if not df_youtube.empty:
        dfs_validos.append(df_youtube)
    
    if not dfs_validos:
        print("[-] Nenhum dado foi coletado de nenhuma plataforma.")
        return pd.DataFrame()
    
    # Concatena com preenchimento de NaN para colunas faltantes
    df_consolidado = pd.concat(dfs_validos, ignore_index=True, sort=False)
    
    print(f"[+] Total de registros consolidados: {len(df_consolidado)}")
    return df_consolidado

# =====================================================================
# EXPORTAÇÃO PARA BD
# =====================================================================
def exportar_para_bd(df_consolidado):
    """Exporta dados em JSON e CSV para integração com BD"""
    print("[*] Exportando dados para outputs/...")
    os.makedirs("outputs", exist_ok=True)
    
    # Exportar JSON
    caminho_json = "outputs/dados_minerados_completos.json"
    with open(caminho_json, "w", encoding="utf-8") as f:
        json.dump(df_consolidado.to_dict(orient="records"), f, ensure_ascii=False, indent=2, default=str)
    print(f"[+] JSON exportado: {caminho_json}")
    
    # Exportar CSV
    caminho_csv = "outputs/dados_minerados_completos.csv"
    df_consolidado.to_csv(caminho_csv, index=False, encoding="utf-8")
    print(f"[+] CSV exportado: {caminho_csv}")
    
    # Gerar estatísticas
    stats = {
        "total_registros": len(df_consolidado),
        "plataformas": df_consolidado["plataforma"].value_counts().to_dict() if "plataforma" in df_consolidado.columns else {},
        "data_coleta": datetime.now().isoformat(),
        "timestamp": datetime.now().isoformat(),
    }
    
    caminho_stats = "outputs/stats_mineracao.json"
    with open(caminho_stats, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"[+] Estatísticas: {caminho_stats}")
    
    print(f"\n[✅] Pipeline concluído com sucesso!")
    print(f"    Total de registros: {stats['total_registros']}")
    print(f"    Distribuição por plataforma: {stats['plataformas']}")

# =====================================================================
# SCRIPT PRINCIPAL
# =====================================================================
if __name__ == "__main__":
    KEYWORDS_DESCOBERTA = [
        "organizador", "magnético", "portátil", "automotivo",
        "suporte", "ferramenta", "led", "sem fio"
    ]
    
    print("[+] Etapa 1: Minerando demanda ampla em múltiplas plataformas...")
    print()
    
    # Coleta de todas as plataformas
    df_meta = extrair_meta_ads(keywords=KEYWORDS_DESCOBERTA, pais="BR", dias_corte=5)
    print()
    
    df_tiktok = extrair_tiktok_top_ads(termo_nicho="", pais="BR", top_n=20)
    print()
    
    df_google = extrair_google_ads(keywords=KEYWORDS_DESCOBERTA, pais="BR", top_n=20)
    print()
    
    df_youtube = extrair_youtube_ads(keywords=KEYWORDS_DESCOBERTA, pais="BR", top_n=20)
    print()
    
    # Consolidação
    print("[+] Etapa 2: Consolidando dados...")
    df_consolidado = consolidar_resultados(df_meta, df_tiktok, df_google, df_youtube)
    print()
    
    # Exportação
    if not df_consolidado.empty:
        print("[+] Etapa 3: Exportando para BD...")
        exportar_para_bd(df_consolidado)
    else:
        print("[-] Nenhum dado para exportar.")
    
    print()
    print("[✅] Minerador amplo finalizado. Pronto para triagem e BD!")
