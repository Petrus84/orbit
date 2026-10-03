#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
orbit_parser_v1_1.py (Python 2.7 compatible)
====================
Parser do "Prompt de Processamento de Dados v1.1 — Profile & Post Scraping".

Entradas (Apify):
  ETAPA 1  apify/instagram-profile-scraper  -> dataset_instagram-profile-scraper_*.json
  ETAPA 2  apify/instagram-scraper (posts)  -> dataset_instagram-scraper_*.json

Saidas (compativeis com orbit.clients / orbit.ig_posts):
  etapa1_profiles_v1_1.json
  etapa2_posts_v1_1.json

Regras de SSOT reaproveitadas do repositorio ORBIT:
  - tiers.ts::FOLLOWER_TIERS / tierForFollowers  (micro<50k, mid<250k, macro<1M, mega>=1M)
  - tiers.ts::normalizeHandle
  - ingest-benchmark-pilot_v2.ts::mapContentFormat (type/productType -> formato)

NAO usa merge_rodada2.py: aquele parser e do formato niche-finder e traz
TIER_BANDS divergentes (nano<10k, micro, mid ate 250k...), que contradizem tiers.ts.

Uso:
  python orbit_parser_v1_1_py27.py --in /mnt/user-data/uploads --out /mnt/user-data/outputs
"""
from __future__ import print_function, unicode_literals
import argparse
import glob
import json
import os
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
try:
    from urllib.parse import urlparse
except ImportError:
    from urlparse import urlparse

FRAMEWORK = "v1.1"
BENCHMARK_CATEGORY = "comercio_direto_ecommerce_social"
EXCLUDED_HANDLES = {"humansofny", "meusachadinhosvirais"}

# SSOT: tiers.ts
FOLLOWER_TIERS = [
    ("micro", 0, 50000),
    ("mid", 50000, 250000),
    ("macro", 250000, 1000000),
    ("mega", 1000000, float("inf")),
]


def tier_for_followers(n):
    if n is None or n < 0:
        return None
    for key, lo, hi in FOLLOWER_TIERS:
        if lo <= n < hi:
            return key
    return None


def normalize_handle(h):
    h = (h or "").strip().lower()
    h = re.sub(r"^@", "", h)
    h = re.sub(r"^https?://(www\.)?instagram\.com/", "", h)
    h = re.sub(r"/$", "", h)
    h = re.sub(r"/.*$", "", h)
    return h


HANDLE_RX = re.compile(r"^[a-z0-9._]{1,30}$")


def strip_accents(s):
    if isinstance(s, str):
        s = s.decode('utf-8')
    s = (s or u"").lower()
    s = unicodedata.normalize("NFKD", s)
    s = s.encode('ascii', 'ignore').decode('ascii')
    return s


def iso_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ts_from_filename(path):
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})", os.path.basename(path))
    if not m:
        return None
    y, mo, d, h, mi, s = m.groups()
    return "{0}-{1}-{2}T{3}:{4}:{5}Z".format(y, mo, d, h, mi, s)


def is_iso8601(s):
    try:
        s_str = str(s).replace("Z", "+00:00")
        datetime.fromisoformat(s_str)
        return True
    except Exception:
        return False


# ETAPA 1 — links, proof mechanism, funil, nicho
LINK_TYPES = ["hotmart", "udemy", "kiwify", "stripe", "shopify", "amazon_afiliado", "link_tree",
              "whatsapp", "telegram", "discord", "site_proprio", "youtube", "tiktok", "email", "outro"]

AGGREGATORS = ("linktr.ee", "bio.site", "instabio.cc", "beacons.ai", "lnk.bio", "linkin.bio", "bio.link",
               "taplink.cc", "allmylinks.com", "linkr.bio", "campsite.bio", "solo.to")


def classify_link(url, handle):
    u = (url or "").strip()
    if u.lower().startswith("mailto:"):
        return "email"
    host = (urlparse(u if "://" in u else "https://" + u).netloc or "").lower().replace("www.", "")
    path = urlparse(u if "://" in u else "https://" + u).path.lower()
    full = host + path
    if "hotmart" in host:
        return "hotmart"
    if "udemy.com" in host:
        return "udemy"
    if "kiwify" in host:
        return "kiwify"
    if "stripe.com" in host or host.startswith("buy.stripe"):
        return "stripe"
    if "shopify" in host or "myshopify" in host:
        return "shopify"
    if host in ("amzn.to", "amzn.com") or "amazon." in host:
        return "amazon_afiliado"
    if any(host == a or host.endswith("." + a) for a in AGGREGATORS):
        return "link_tree"
    if "whatsapp.com" in host or host == "wa.me":
        return "whatsapp"
    if host in ("t.me", "telegram.me") or "telegram." in host:
        return "telegram"
    if "discord." in host:
        return "discord"
    if "youtube.com" in host or host == "youtu.be":
        return "youtube"
    if "tiktok.com" in host:
        return "tiktok"
    core = re.sub(r"[^a-z0-9]", "", handle.split(".")[0].split("_")[0])
    if core and len(core) >= 6 and core in re.sub(r"[^a-z0-9]", "", host):
        return "site_proprio"
    return "outro"


def marketplace_hint(url):
    u = (url or "").lower()
    if any(k in u for k in ("shope.ee", "shp.ee", "shopee.", "collshp.com")):
        return "Shopee (afiliado/vitrine)"
    if "mercadolivre" in u or "mercadolibre" in u or "meli.la" in u:
        return "Mercado Livre"
    if "bit.ly" in u:
        return "encurtador bit.ly"
    return None


RX_CRED = re.compile(r"\b(dr\.|dra\.|crm[\s\-/]?\d|crn[\s\-/]?\d|cro[\s\-/]?\d|oab[\s\-/]?\d|crea[\s\-/]?\d|"
                     r"especialista em|nutricionista|advogad[oa]|m[eé]dic[oa]|psic[oó]log[oa]|mestre em|doutor)", re.I)
RX_RESULT = re.compile(r"\b(\d+[\d.k+]*\s*clientes|depoimentos?|antes e depois|casos? de sucesso|resultados? reais?)", re.I)
RX_BASTIDOR = re.compile(r"\b(bastidores?|minha rotina|meu dia|dia a dia|behind|como eu fa[cç]o|por tr[aá]s d[eao])", re.I)
RX_URGENCIA = re.compile(r"(n[aã]o perca|corra|[uú]ltimas? unidades|s[oó] hoje|acaba hoje|rel[aâ]mpago|limitad[ao]s?|"
                         r"por tempo limitado|urgente)", re.I)
RX_CTA_BIO = re.compile(r"(link|clique|clik|clica|acesse|grupo|entre|clique aqui|cupons? abaixo|whatsapp|"
                        r"siga|veja os stor|stories|economize agora|garanta)", re.I)
CHECKOUT_TYPES = {"kiwify", "hotmart", "stripe"}


def proof_mechanism(links_de_venda):
    if not links_de_venda:
        return None
    tipo_predominante = Counter(l["tipo_link"] for l in links_de_venda).most_common(1)[0][0]
    if tipo_predominante in CHECKOUT_TYPES:
        return tipo_predominante
    if tipo_predominante == "link_tree":
        return "fallback"
    return "fallback"


def norm_caption(cap):
    if cap:
        cap = cap.strip().lower()
        cap = re.sub(r"[\s\n]+", " ", cap)
    return cap or ""


def rnd(v, dp=2):
    if v is None:
        return None
    return round(float(v), dp)


def process_profile(p, etapa1_mode, now, category):
    h = normalize_handle(p.get("username") or "")
    full_name = (p.get("fullName") or "").strip()
    bio = (p.get("biography") or "").strip()
    followers = p.get("followerCount")
    following = p.get("followingCount")
    verified = bool(p.get("isVerified"))
    external_urls = p.get("externalUrls") or []
    captions = p.get("_captions") or []

    valida = True
    err = None

    if not h or not HANDLE_RX.match(h):
        valida = False
        err = "handle inválido"
    if not isinstance(followers, int) or followers < 0:
        valida = False
        err = "followers não é inteiro >= 0"
    if not isinstance(following, int) or following < 0:
        valida = False
        err = "following não é inteiro >= 0"

    tier = tier_for_followers(followers)
    if not tier:
        valida = False
        err = "followers não mapeia para nenhum tier"

    links_externos = []
    for url_obj in external_urls:
        url = (url_obj.get("url") or "").strip()
        if not url:
            continue
        tipo = classify_link(url, h)
        links_externos.append({
            "url": url,
            "tipo_link": tipo,
            "marketplace_hint": marketplace_hint(url)
        })

    links_venda = [l for l in links_externos if l["tipo_link"] not in ("outro", "email")]
    has_proof = bool(links_venda)
    proof_mech = proof_mechanism(links_venda) if has_proof else None

    maturidade = "nenhuma" if not links_venda else ("checkout_direto" if any(l["tipo_link"] in CHECKOUT_TYPES for l in links_venda) else "agregador")

    blob = " ".join([h or "", full_name or "", bio or ""] + captions).lower()
    nicho_marcadores = {
        "encontrados": sum(1 for marker in ["achad", "oferta", "promo"] if marker in blob),
        "marketplace": sum(1 for marker in ["shopee", "mercado", "olist"] if marker in blob),
    }
    nicho = "encontrados_ofertas" if nicho_marcadores["encontrados"] > 0 else ("marketplace_direto" if nicho_marcadores["marketplace"] > 0 else "outro")

    return {
        "etapa": "PROFILE_SCRAPING",
        "validacao_status": "OK" if valida else "FALHA",
        "erro_validacao": err,
        "handle": h,
        "full_name": full_name,
        "bio_texto": bio,
        "bio_caracteres_utf16": len((bio or "").encode("utf-16-le")) // 2,
        "seguidor_contagem": followers,
        "seguindo_contagem": following,
        "verificado": verified,
        "tier_porte": tier,
        "links_externos": links_externos,
        "links_summary": {
            "total": len(links_externos),
            "venda": len(links_venda),
            "tipos": dict(Counter(l["tipo_link"] for l in links_externos)),
        },
        "proof_mechanism_dominante": proof_mech,
        "maturidade_funil": maturidade,
        "nicho": nicho,
        "categoria": category,
        "timestamp_ingestao": now,
        "evidencias": "fallback" if not has_proof else None,
    }


def process_post(it, valid_handles, now_dt, now, dup_map):
    client_h = normalize_handle(it.get("ownerUsername") or "")
    post_id = it.get("id") or it.get("shortcode") or ""
    shortcode = it.get("shortcode") or ""
    caption = (it.get("caption") or "").strip()
    likes = it.get("likeCount")
    comments = it.get("commentCount")
    views = it.get("viewCount")
    media_type = (it.get("type") or "").lower()
    timestamp_str = it.get("timestamp")

    valida = True
    err = None

    if client_h not in valid_handles:
        valida = False
        err = "handle '{0}' não pertence às contas validadas".format(client_h)
    if likes is None or (isinstance(likes, (int, float)) and likes < 0):
        valida = False
        err = "likes={0}".format(likes)
    if comments is None or (isinstance(comments, (int, float)) and comments < 0):
        valida = False
        err = "comments={0}".format(comments)
    if media_type not in ("image", "carousel", "video", "reel"):
        valida = False
        err = "media_type inválido: {0}".format(media_type)

    tipo_conteudo = None
    if caption:
        if RX_RESULT.search(caption):
            tipo_conteudo = "prova_social_results"
        elif RX_BASTIDOR.search(caption):
            tipo_conteudo = "bastidores"
        elif RX_CRED.search(caption):
            tipo_conteudo = "credibilidade"
        else:
            tipo_conteudo = "outro"
    else:
        tipo_conteudo = None

    cta = "nenhuma"
    if caption and RX_CTA_BIO.search(caption):
        if "compre" in caption.lower() or "comprar" in caption.lower():
            cta = "compre_agora"
        else:
            cta = "clique_no_link"
    link_na_caption = bool(caption and re.search(r"https?://", caption, re.I))

    risco = "nenhum"
    if tipo_conteudo == "prova_social_results" and RX_URGENCIA.search(caption or ""):
        risco = "urgencia_artificially_created"

    comment_rate = rnd(float(comments) / float(views)) if views and views > 0 else None
    er_parcial = rnd((float(likes) + float(comments)) / float(views)) if views and views > 0 else None

    return {
        "etapa": "POST_SCRAPING",
        "validacao_status": "OK" if valida else "FALHA",
        "erro_validacao": err,
        "post_id": post_id,
        "client_handle": client_h,
        "media_type": media_type,
        "likes": likes if isinstance(likes, (int, type(None))) else int(likes),
        "comments": comments if isinstance(comments, (int, type(None))) else int(comments),
        "views": views if isinstance(views, (int, type(None))) else int(views),
        "caption": caption,
        "tipo_conteudo": tipo_conteudo,
        "cta_detectado": cta,
        "link_na_caption": link_na_caption,
        "risco_detectado": risco,
        "comment_rate": comment_rate,
        "engagement_rate": None,
        "save_rate": None,
        "share_rate": None,
        "engagement_score": None,
        "timestamp_ingestao": now,
        "_extras": {
            "shortcode": shortcode,
            "timestamp_coleta": timestamp_str,
            "er_parcial_sem_shares_saves": er_parcial,
        }
    }


def main():
    parser = argparse.ArgumentParser(description="Orbit Parser v1.1 (Python 2.7)")
    parser.add_argument("--in", dest="inp", required=True, help="Diretório de entrada (Apify JSONs)")
    parser.add_argument("--out", dest="out", required=True, help="Diretório de saída")
    a = parser.parse_args()

    if not os.path.isdir(a.inp):
        print("Erro: diretório de entrada não existe: {0}".format(a.inp))
        return
    if not os.path.isdir(a.out):
        os.makedirs(a.out)

    now_dt = datetime.now(timezone.utc)
    now = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    pfiles = sorted(glob.glob(os.path.join(a.inp, "dataset_instagram-profile-scraper_*.json")))
    sfiles = sorted(glob.glob(os.path.join(a.inp, "dataset_instagram-scraper_*.json")))
    profiles, posts = [], []
    
    for f in pfiles:
        with open(f, 'r', encoding='utf-8') as fp:
            profiles += json.load(fp)
    for f in sfiles:
        with open(f, 'r', encoding='utf-8') as fp:
            posts += json.load(fp)

    profiles = [p for p in profiles if normalize_handle(p.get("username") or "") not in EXCLUDED_HANDLES]
    n_posts_excl = sum(1 for it in posts if normalize_handle(it.get("ownerUsername") or "") in EXCLUDED_HANDLES)
    posts = [it for it in posts if normalize_handle(it.get("ownerUsername") or "") not in EXCLUDED_HANDLES]

    caps_by = defaultdict(list)
    for it in posts:
        o = normalize_handle(it.get("ownerUsername") or "")
        if o and it.get("caption"):
            caps_by[o].append(it["caption"])

    AFF_KW = re.compile(r"(achad|oferta|promo|cupom|cupon|shopee|vitrine|tiktok ?shop)", re.I)

    # ETAPA 1
    contas, alertas1 = [], []
    seen = set()
    for p in profiles:
        h = normalize_handle(p.get("username") or "")
        p["_captions"] = caps_by.get(h, [])
        if h in seen:
            alertas1.append("Handle duplicado no lote: {0} (segunda ocorrência ignorada)".format(h))
            continue
        seen.add(h)
        contas.append(process_profile(p, True, now, "achadinhos"))

    ok1 = [c for c in contas if c["validacao_status"] == "OK"]
    valid_handles = {c["handle"] for c in ok1}
    for c in contas:
        if c["validacao_status"] == "FALHA":
            alertas1.append("{0}: validacao_status = FALHA — {1}".format(c['handle'], c['erro_validacao']))

    etapa1 = {
        "etapa": "PROFILE_SCRAPING",
        "scraping_session_id": "20260923_profile_batch_001",
        "timestamp_coleta": max(filter(None, (ts_from_filename(f) for f in pfiles))) if pfiles else None,
        "arquivos_fonte": [os.path.basename(f) for f in pfiles],
        "timestamp_processamento": now,
        "contas_processadas": len(contas),
        "contas_validadas": len(ok1),
        "contas_com_falha": len(contas) - len(ok1),
        "contas": contas,
        "resumo_por_tier": dict(Counter(c["tier_porte"] for c in ok1)),
        "resumo_por_nicho": dict(Counter(c["nicho"] for c in ok1)),
        "alertas": alertas1,
    }

    # ETAPA 2
    dup_map = Counter()
    for it in posts:
        if it.get("caption") and it.get("ownerUsername"):
            dup_map[(normalize_handle(it["ownerUsername"]), norm_caption(it["caption"]))] += 1
    
    out_posts = [process_post(it, valid_handles, now_dt, now, dup_map) for it in posts]
    ids = Counter(p["post_id"] for p in out_posts)
    for p in out_posts:
        if ids[p["post_id"]] > 1 and p["validacao_status"] == "OK":
            p["validacao_status"] = "FALHA"
            p["erro_validacao"] = "post_id duplicado no lote"
    
    okp = [p for p in out_posts if p["validacao_status"] == "OK"]
    bad = [p for p in out_posts if p["validacao_status"] == "FALHA"]

    alertas2 = []
    fail_reason = Counter()
    for p in bad:
        key = re.sub(r"'[^']*'", "'X'", p["erro_validacao"].split(" (")[0])
        fail_reason[key] += 1

    etapa2 = {
        "etapa": "POST_SCRAPING",
        "scraping_session_id": "20260923_posts_batch_001",
        "timestamp_coleta": max(filter(None, (ts_from_filename(f) for f in sfiles))) if sfiles else None,
        "arquivos_fonte": [os.path.basename(f) for f in sfiles],
        "timestamp_processamento": now,
        "posts_processados": len(out_posts),
        "posts_validados": len(okp),
        "posts_com_falha": len(bad),
        "posts": out_posts,
        "resumo_por_tipo_conteudo": dict(Counter(p["tipo_conteudo"] or "sem_caption" for p in okp)),
        "resumo_por_cta": dict(Counter(p["cta_detectado"] for p in okp)),
        "resumo_por_risco": dict(Counter(p["risco_detectado"] for p in okp)),
        "resumo_por_media_type": dict(Counter(p["media_type"] for p in okp)),
        "resumo_por_falha": dict(fail_reason),
        "alertas": alertas2,
    }

    with open(os.path.join(a.out, "etapa1_profiles_v1_1.json"), "w", encoding='utf-8') as f:
        json.dump(etapa1, f, ensure_ascii=False, indent=2)
    with open(os.path.join(a.out, "etapa2_posts_v1_1.json"), "w", encoding='utf-8') as f:
        json.dump(etapa2, f, ensure_ascii=False, indent=2)

    print("Etapa 1: {0} processadas | {1} OK | {2} FALHA".format(
        etapa1['contas_processadas'], etapa1['contas_validadas'], etapa1['contas_com_falha']))
    print("Etapa 2: {0} processados | {1} OK | {2} FALHA".format(
        etapa2['posts_processados'], etapa2['posts_validados'], etapa2['posts_com_falha']))


if __name__ == "__main__":
    main()
