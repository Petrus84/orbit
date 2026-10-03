#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
orbit_parser_v1_1.py
====================
Parser do "Prompt de Processamento de Dados v1.1 — Profile & Post Scraping".

Entradas (Apify):
  ETAPA 1  apify/instagram-profile-scraper  -> dataset_instagram-profile-scraper_*.json
  ETAPA 2  apify/instagram-scraper (posts)  -> dataset_instagram-scraper_*.json

Saídas (compatíveis com orbit.clients / orbit.ig_posts):
  etapa1_profiles_v1_1.json
  etapa2_posts_v1_1.json

Regras de SSOT reaproveitadas do repositório ORBIT:
  - tiers.ts::FOLLOWER_TIERS / tierForFollowers  (micro<50k, mid<250k, macro<1M, mega>=1M)
  - tiers.ts::normalizeHandle
  - ingest-benchmark-pilot_v2.ts::mapContentFormat (type/productType -> formato)

NÃO usa merge_rodada2.py: aquele parser é do formato niche-finder e traz
TIER_BANDS divergentes (nano<10k, micro, mid até 250k...), que contradizem tiers.ts.

Uso:
  python3 orbit_parser_v1_1.py --in /mnt/user-data/uploads --out /mnt/user-data/outputs
"""
import argparse
import glob
import json
import os
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from urllib.parse import urlparse

FRAMEWORK = "v1.1"
BENCHMARK_CATEGORY = "comercio_direto_ecommerce_social"  # validado pelo cliente para todo o lote
EXCLUDED_HANDLES = {"humansofny", "meusachadinhosvirais"}  # removidos do lote por decisão do cliente (fora da amostra)

# ----------------------------------------------------------------------------
# SSOT: tiers.ts
# ----------------------------------------------------------------------------
FOLLOWER_TIERS = [  # faixas ATUAIS informadas pelo cliente (substituem as do tiers.ts antigo)
    ("micro", 0, 50_000),
    ("mid", 50_000, 250_000),
    ("macro", 250_000, 1_000_000),
    ("mega", 1_000_000, float("inf")),
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
    return unicodedata.normalize("NFKD", (s or "").lower()).encode("ascii", "ignore").decode()


def iso_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ts_from_filename(path):
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})", os.path.basename(path))
    if not m:
        return None
    y, mo, d, h, mi, s = m.groups()
    return f"{y}-{mo}-{d}T{h}:{mi}:{s}Z"


def is_iso8601(s):
    try:
        datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return True
    except Exception:
        return False


# ----------------------------------------------------------------------------
# ETAPA 1 — links, proof mechanism, funil, nicho
# ----------------------------------------------------------------------------
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
    # domínio próprio: host contém o handle "limpo" (ex.: lp.achadosdaray.com.br p/ achadosdaray.br)
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
RX_CTA_BIO = re.compile(r"(link|clique|clik|clica|acesse|grupo|entre|👇|⬇|👆|⤵|↓|cupons? abaixo|whatsapp|"
                        r"siga|veja os stor|stories|economize agora|garanta)", re.I)
CHECKOUT_TYPES = {"kiwify", "hotmart", "stripe"}

# nicho: vocabulário controlado do prompt
NICHE_RX = {
    "casa_decoracao": r"\b(casa|decorac\w*|cozinha|organizac\w*|quarto|sala|banheiro|lavanderia|utensilio\w*|panela\w*)\b",
    "moda": r"\b(moda|look\w*|vestido\w*|blusa\w*|calca\w*|camisa\w*|roupa\w*|sapato\w*|tenis|bolsa\w*|saia\w*|jaqueta\w*|"
            r"conjunto\w*|biquini\w*|sandalia\w*|provador\w*|estilo)\b",
    "beleza": r"\b(beleza|skincare|maquiagem|batom|cabelo\w*|creme\w*|perfume\w*|hidratante\w*|esmalte\w*|unha\w*|shampoo\w*|serum)\b",
    "tecnologia": r"\b(celular\w*|fone\w*|gadget\w*|smartwatch|tecnologia|carregador\w*|projetor\w*|notebook\w*|bluetooth)\b",
    "fitness": r"\b(treino\w*|academia\w*|suplemento\w*|whey|creatina|termogenico\w*)\b",
    "gastronomia": r"\b(receita\w*|airfryer|air fryer|comida\w*)\b",
    "maternidade_paternidade": r"\b(bebe\w*|mamae\w*|gestante\w*|infantil)\b",
}
NICHE_BIO_SAUDE = re.compile(r"\b(saude|nutricao|nutricionista|medic[oa])\b")
NICHE_BIO_CORROBORATION = 0.35  # bio cita 1 tema: precisa de >=35% das captions confirmando
NICHE_CAPTION_SHARE = 0.65  # nicho específico só domina se >=65% das captions do handle baterem


def nicho_from_bio(bio_norm):
    hits = {k: bool(re.search(v, bio_norm)) for k, v in NICHE_RX.items()}
    if NICHE_BIO_SAUDE.search(bio_norm):
        hits["saude_bem_estar"] = True
    return [k for k, v in hits.items() if v]


def detect_nicho(p, captions_norm):
    """Retorna (nicho, evidência). Regra do prompt: bio primeiro; captions só desempatam."""
    text = strip_accents((p.get("fullName") or "") + " " + (p.get("biography") or ""))
    bio_hits = nicho_from_bio(text)
    if bio_hits == ["saude_bem_estar"]:
        return "saude_bem_estar", "bio menciona nutrição/saúde (regra literal do prompt); baixa confiança — bio parece de estudante + cupons de suplemento"
    n = len(captions_norm)
    if len(bio_hits) == 1:
        k = bio_hits[0]
        if n < 5:
            return k, f"bio/nome cita apenas '{k}' (sem corroboração: só {n} captions)"
        share = sum(1 for c in captions_norm if re.search(NICHE_RX[k], c)) / n
        if share >= NICHE_BIO_CORROBORATION:
            return k, f"bio/nome cita '{k}' e {share:.0%} das {n} captions confirmam"
        # bio cita 1 tema, captions não confirmam -> cai para a análise de captions abaixo
    # captions
    if n >= 5:
        shares = {k: sum(1 for c in captions_norm if re.search(v, c)) / n for k, v in NICHE_RX.items()}
        k, s = max(shares.items(), key=lambda kv: kv[1])
        if s >= NICHE_CAPTION_SHARE:
            return k, f"{s:.0%} das {n} captions coletadas citam '{k}' (limiar {NICHE_CAPTION_SHARE:.0%})"
        top = ", ".join(f"{a}={b:.0%}" for a, b in sorted(shares.items(), key=lambda kv: -kv[1])[:3] if b > 0)
        return "lifestyle_geral", f"tema disperso (captions: {top or 'sem tema dominante'}; bio: {bio_hits or 'genérica de ofertas'})"
    return "lifestyle_geral", f"amostra de captions insuficiente (n={n}); bio genérica de achadinhos/ofertas"


def detect_proof(bio, links, followers):
    bio_n = bio or ""
    types = {l["tipo_link"] for l in links}
    if RX_CRED.search(bio_n):
        return "autoridade_tecnica_credencial", f"credencial na bio: '{RX_CRED.search(bio_n).group(0)}'"
    if RX_RESULT.search(bio_n):
        return "resultado_documentado_cliente", f"bio cita '{RX_RESULT.search(bio_n).group(0)}'"
    if types & CHECKOUT_TYPES:
        return "escassez_urgencia", f"link de checkout direto na bio ({', '.join(sorted(types & CHECKOUT_TYPES))})"
    if RX_URGENCIA.search(bio_n):
        return "escassez_urgencia", f"bio com gatilho de urgência: '{RX_URGENCIA.search(bio_n).group(0)}'"
    if RX_BASTIDOR.search(bio_n):
        return "bastidor_transparencia", f"bio cita '{RX_BASTIDOR.search(bio_n).group(0)}'"
    weak = " (fallback: nenhum sinal de credencial/resultado/checkout/urgência/bastidor; seguidores abaixo de 20k = prova social fraca)" if followers is not None and followers < 20000 else " (fallback: nenhum sinal de credencial/resultado/checkout/urgência/bastidor)"
    return "prova_social_quantitativa", f"{followers:,} seguidores".replace(",", ".") + weak


def funnel_maturity(bio, links):
    has_cta = bool(RX_CTA_BIO.search(bio or ""))
    n = len(links)
    tipos = {l["tipo_link"] for l in links}
    if n == 0 and not has_cta:
        return "nao_implementado"
    if n >= 3 and has_cta and len(tipos) >= 2:
        return "implementado_otimizado"
    return "parcial"


def process_profile(p, in_scope, now, tipo_lote):
    handle = normalize_handle(p.get("username") or p.get("inputUrl") or "")
    url = f"https://instagram.com/{handle}"
    rec = {
        "handle": handle, "url": url, "benchmark_category": BENCHMARK_CATEGORY, "status_monetizacao": "ativa",
        "nicho": None, "cluster_de_busca": None, "proof_mechanism_dominante": None, "maturidade_funil": None,
        "tier_porte": None, "followers_total": p.get("followersCount"), "following_count": p.get("followsCount"),
        "media_count": p.get("postsCount"), "is_verified": p.get("verified"),
        "is_business": p.get("isBusinessAccount"), "is_private": p.get("private"),
        "bio_texto": p.get("biography"), "links_externos": [], "links_summary": None, "evidencias": None,
        "data_classificacao": now, "versao_framework": FRAMEWORK, "validacao_status": "OK", "erro_validacao": None,
    }
    errs = []
    if not handle or not HANDLE_RX.match(handle):
        errs.append("handle vazio/inválido")
    src_host = urlparse(p.get("url") or p.get("inputUrl") or "").netloc.lower()
    if "instagram.com" not in src_host:
        errs.append("url de origem não aponta para instagram.com")
    for f, label in (("followersCount", "followers"), ("followsCount", "following"), ("postsCount", "media_count")):
        v = p.get(f)
        if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0:
            errs.append(f"{label} ausente/inválido (campo {f}={v!r})")
    for f, label in (("verified", "is_verified"), ("isBusinessAccount", "is_business"), ("private", "is_private")):
        if not isinstance(p.get(f), bool):
            errs.append(f"{label} ausente/não-booleano (campo {f}={p.get(f)!r})")
    bio = p.get("biography")
    if bio is not None and len(bio) > 150:
        errs.append(f"bio com {len(bio)} caracteres (>150)")
    if p.get("error"):
        errs.append(f"actor retornou erro: '{p.get('error')}'" + (f" — {p.get('restrictionReason')}" if p.get("restrictionReason") else ""))
    if not in_scope:
        errs.append("conta fora do escopo do lote (não é perfil de achadinhos/afiliados; provável handle errado no input)")
    if errs:
        rec["validacao_status"] = "FALHA"
        rec["erro_validacao"] = "; ".join(errs)
        rec["links_summary"] = None
        return rec

    # links
    links = []
    raw = p.get("externalUrls") or ([{"url": p.get("externalUrl")}] if p.get("externalUrl") else [])
    pos = 0
    hints = []
    for l in raw:
        u = (l.get("url") or "").strip()
        if not u:
            continue
        pos += 1
        t = classify_link(u, handle)
        h = marketplace_hint(u)
        if h:
            hints.append(h)
        links.append({"url_destino": u, "tipo_link": t, "posicao_na_bio": pos, "texto_ancora": l.get("title") or None})
    rec["links_externos"] = links
    summ = {t: 0 for t in LINK_TYPES}
    for l in links:
        summ[l["tipo_link"]] += 1
    summ["total"] = len(links)
    rec["links_summary"] = summ

    rec["tier_porte"] = tier_for_followers(p["followersCount"])
    caps = [strip_accents(c) for c in p.get("_captions", [])]
    nicho, nev = detect_nicho(p, caps)
    rec["nicho"] = nicho
    proof, pev = detect_proof(bio, links, p["followersCount"])
    rec["proof_mechanism_dominante"] = proof
    rec["maturidade_funil"] = funnel_maturity(bio, links)

    ev = [f"nicho: {nev}", f"proof: {pev}",
          f"funil: {len(links)} link(s) [{', '.join(sorted({l['tipo_link'] for l in links})) or 'nenhum'}]; CTA na bio={'sim' if RX_CTA_BIO.search(bio or '') else 'não'}"]
    if hints:
        ev.append("destinos identificados: " + ", ".join(sorted(set(hints))) + " (catálogo de tipo_link não tem marketplace -> 'outro')")
    if p.get("businessCategoryName"):
        ev.append(f"businessCategoryName={p['businessCategoryName']}")
    if len(raw) != len(links):
        ev.append(f"{len(raw) - len(links)} link(s) vazio(s) descartado(s) da lista externalUrls")
    ev.append("tier: micro<50k, mid 50k-249.999, macro 250k-999.999, mega>=1M")
    rec["evidencias"] = " | ".join(ev)
    return rec


# ----------------------------------------------------------------------------
# ETAPA 2 — posts
# ----------------------------------------------------------------------------
URL_RX = re.compile(r"https?://[^\s)>\]]+", re.I)

RX_PROMO = re.compile(r"(compre|compra\b|comprar|adquira|oferta|promo|desconto|cupom|cupon|\blinks?\b|clique|clica|"
                      r"shopee|mercado livre|amazon|magalu|r\$\s?\d|frete|garanta|checkout|#publi|#ad\b)", re.I)
RX_EDU = re.compile(r"\b(aprenda|dicas?|tutorial|como|passo a passo|truque|ensina)\b|#dica|#tutorial", re.I)
RX_ENT = re.compile(r"(risos|meme|funny|humor|kkk+|engra[cç]ad|piada|#meme|#humor)", re.I)
RX_PERS = re.compile(r"\b(rotina|meu dia|bastidor|vlog|lifestyle|fam[ií]lia|gratid[aã]o|obrigad[oa]|anivers[aá]rio|viagem)\b", re.I)

RX_CTA = [
    ("clique_no_link", re.compile(r"(link (na|da|no) (bio|perfil)|clique aqui|clica aqui|clique no link|clica no link|clica na sacolinha|"
                                  r"saiba mais|acesse (o )?link|acesse a bio|toque no link|link nos stories|visite (a nossa|nossa) vitrine)", re.I)),
    ("compre_agora", re.compile(r"(compre|adquira|oferta limitada|garanta (o seu|a sua|j[aá])|compre na)", re.I)),
    ("compartilhe", re.compile(r"(compartilh|marque (um|uma|o|a|seu|sua)\b|marca (um|uma|o|a|seu|sua)\b|manda pra|envia pra)", re.I)),
    ("comente", re.compile(r"(coment[ae]|deixe (seu|sua) coment)", re.I)),
    ("siga", re.compile(r"(\bsiga\b|\bsegue\b|me acompanhe|seguir a p[aá]gina)", re.I)),
]

RX_DESINFO = re.compile(r"(cura milagros|cura (do|da|de) (c[aâ]ncer|diabetes)|milagre|100% garantid|resultado garantido|"
                        r"emagre[cç]a \d+\s?kg|sem efeito colateral)", re.I)
RX_SENSIVEL = re.compile(r"\b(estupro|suic[ií]dio|abuso sexual|porn[oô]|nude|sexo expl[ií]cito|assassinato)\b", re.I)
RX_ODIO = re.compile(r"\b(nazista|odeio (gays|negros|judeus|mulheres)|lixo humano)\b", re.I)


def norm_caption(c):
    return re.sub(r"\s+", " ", strip_accents(c)).strip()


def detect_tipo(caption, hashtags):
    if not caption or not caption.strip():
        return None
    blob = caption + " " + " ".join("#" + h for h in hashtags)
    n = {"educational": len(RX_EDU.findall(blob)), "promotional": len(RX_PROMO.findall(blob)),
         "entertainment": len(RX_ENT.findall(blob)), "personal": len(RX_PERS.findall(blob))}
    best = max(n.values())
    if best == 0:
        return "personal"  # residual definido no prompt (lifestyle/rotina); caption sem gatilho lexical
    for k in ("educational", "promotional", "entertainment", "personal"):  # empate: ordem do prompt
        if n[k] == best:
            return k


def detect_cta(caption):
    if not caption:
        return "nenhum"
    for name, rx in RX_CTA:
        if rx.search(caption):
            return name
    return "nenhum"


def detect_risco(caption, hashtags, dup_count):
    c = caption or ""
    if RX_ODIO.search(c):
        return "discurso_odio"
    if RX_SENSIVEL.search(c):
        return "conteudo_sensivel"
    if RX_DESINFO.search(c):
        return "desinformacao"
    if len(hashtags) > 25 or len(URL_RX.findall(c)) > 3:
        return "spam"
    return "limpo"


def map_media(item):
    t, pt = item.get("type"), item.get("productType")
    if pt == "clips":
        return "reel"
    return {"Image": "image", "Sidecar": "carousel", "Video": "video"}.get(t)


def safe_div(a, b):
    if a is None or b is None or b == 0:
        return None
    return a / b


def process_post(item, valid_handles, now_dt, now_iso, dup_map):
    input_handle = normalize_handle(item.get("inputUrl") or "")
    owner = normalize_handle(item.get("ownerUsername") or "")
    handle = owner or input_handle
    caption = item.get("caption")
    hashtags = ["#" + h.lstrip("#") for h in (item.get("hashtags") or [])]
    mentions = ["@" + m.lstrip("@") for m in (item.get("mentions") or [])]
    mtype = map_media(item)
    views = item.get("videoPlayCount")
    if views is None:
        views = item.get("videoViewCount")
    likes, comments = item.get("likesCount"), item.get("commentsCount")
    dur = item.get("videoDuration")
    links_in_cap = URL_RX.findall(caption or "")
    mc = len(item.get("childPosts") or []) if mtype == "carousel" else None

    rec = {
        "post_id": str(item.get("id")) if item.get("id") is not None else None,
        "client_handle": handle, "caption": caption, "timestamp_publicacao": item.get("timestamp"),
        "likes": likes, "comments": comments, "shares": None, "views": views, "saves": None,
        "media_type": mtype, "media_count": mc, "video_duration_seconds": dur,
        "hashtags": hashtags, "mencoes": mentions, "link_na_caption": links_in_cap[0] if links_in_cap else None,
        "tipo_conteudo": None, "cta_detectado": None, "risco_detectado": None,
        "engagement_rate": None, "save_rate": None, "comment_rate": None, "share_rate": None, "engagement_score": None,
        "data_processamento": now_iso, "versao_framework": FRAMEWORK, "validacao_status": "OK", "erro_validacao": None,
        "_extras": {"shortcode": item.get("shortCode"), "url": item.get("url"), "input_url_handle": input_handle,
                    "views_fonte": "videoPlayCount" if item.get("videoPlayCount") is not None else ("videoViewCount" if views is not None else None),
                    "videoViewCount_raw": item.get("videoViewCount"), "er_parcial_sem_shares_saves": None},
    }
    errs = []
    if item.get("error"):
        errs.append(f"registro de erro do actor: '{item.get('error')}'" + (f" ({item.get('restrictionReason')})" if item.get("restrictionReason") else "") + " — sem dados de post")
        rec["validacao_status"], rec["erro_validacao"] = "FALHA", "; ".join(errs)
        return rec
    if not item.get("shortCode"):
        errs.append("shortCode ausente")
    if handle not in valid_handles:
        errs.append(f"handle '{handle}' não pertence às contas validadas da Etapa 1"
                    + (f" (post de terceiro/tagged/colab capturado via inputUrl=@{input_handle})" if input_handle and input_handle != handle else ""))
    ts = item.get("timestamp")
    if not ts or not is_iso8601(ts):
        errs.append("timestamp_publicacao ausente/não ISO 8601")
    elif datetime.fromisoformat(ts.replace("Z", "+00:00")) > now_dt:
        errs.append("timestamp_publicacao no futuro")
    for f, v in (("likes", likes), ("comments", comments), ("views", views)):
        if v is not None and (not isinstance(v, (int, float)) or v < 0):
            errs.append(f"{f}={v} inválido (<0; likesCount=-1 = likes ocultos pela conta)" if f == "likes" else f"{f}={v} inválido")
    if mtype is None:
        errs.append(f"media_type não mapeável (type={item.get('type')!r}, productType={item.get('productType')!r})")
    if caption is not None and len(caption) > 2200:
        errs.append(f"caption com {len(caption)} caracteres (>2200)")
    if errs:
        rec["validacao_status"], rec["erro_validacao"] = "FALHA", "; ".join(errs)
        return rec

    rec["tipo_conteudo"] = detect_tipo(caption, [h.lstrip("#") for h in hashtags])
    rec["cta_detectado"] = detect_cta(caption)
    rec["risco_detectado"] = detect_risco(caption, hashtags, dup_map.get((handle, norm_caption(caption)), 0) if caption else 0)

    # métricas: fórmulas do prompt; shares/saves NÃO existem no dump do Apify => null (sem alucinar)
    rec["comment_rate"] = safe_div(comments, views)
    rec["share_rate"] = safe_div(rec["shares"], views)
    rec["save_rate"] = safe_div(rec["saves"], views)
    if None not in (likes, comments, rec["shares"]):
        rec["engagement_rate"] = safe_div(likes + comments + rec["shares"], views)
    if None not in (likes, comments, rec["shares"], rec["saves"]):
        rec["engagement_score"] = safe_div(likes + comments * 2 + rec["shares"] * 3 + rec["saves"] * 1.5, views)
    if None not in (likes, comments):
        rec["_extras"]["er_parcial_sem_shares_saves"] = safe_div(likes + comments, views)
    return rec


def rnd(x, n=6):
    return None if x is None else round(x, n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default="/mnt/user-data/uploads")
    ap.add_argument("--out", default="/mnt/user-data/outputs")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    now_dt = datetime.now(timezone.utc)
    now = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    pfiles = sorted(glob.glob(os.path.join(a.inp, "dataset_instagram-profile-scraper_*.json")))
    sfiles = sorted(glob.glob(os.path.join(a.inp, "dataset_instagram-scraper_*.json")))
    profiles, posts = [], []
    for f in pfiles:
        profiles += json.load(open(f, encoding="utf-8"))
    for f in sfiles:
        posts += json.load(open(f, encoding="utf-8"))

    profiles = [p for p in profiles if normalize_handle(p.get("username") or "") not in EXCLUDED_HANDLES]
    n_posts_excl = sum(1 for it in posts if normalize_handle(it.get("ownerUsername") or "") in EXCLUDED_HANDLES)
    posts = [it for it in posts if normalize_handle(it.get("ownerUsername") or "") not in EXCLUDED_HANDLES]

    # captions por handle (para nicho) — só posts do próprio dono
    caps_by = defaultdict(list)
    for it in posts:
        o = normalize_handle(it.get("ownerUsername") or "")
        if o and it.get("caption"):
            caps_by[o].append(it["caption"])

    AFF_KW = re.compile(r"(achad|oferta|promo|cupom|cupon|shopee|vitrine|tiktok ?shop)", re.I)

    def scope(p):
        blob = " ".join([p.get("username") or "", p.get("fullName") or "", p.get("biography") or ""])
        return bool(AFF_KW.search(blob))

    # ---------------- ETAPA 1
    contas, alertas1 = [], []
    seen = set()
    for p in profiles:
        h = normalize_handle(p.get("username") or "")
        p["_captions"] = caps_by.get(h, [])
        if h in seen:
            alertas1.append(f"Handle duplicado no lote: {h} (segunda ocorrência ignorada)")
            continue
        seen.add(h)
        contas.append(process_profile(p, True, now, "achadinhos"))

    ok1 = [c for c in contas if c["validacao_status"] == "OK"]
    valid_handles = {c["handle"] for c in ok1}
    for c in contas:
        if c["validacao_status"] == "FALHA":
            alertas1.append(f"{c['handle']}: validacao_status = FALHA — {c['erro_validacao']}")
    for c in ok1:
        if c["links_summary"]["total"] == 0:
            alertas1.append(f"{c['handle']} não tem links externos — maturidade_funil = {c['maturidade_funil']}")
    u16 = [f"{c['handle']}({len((c['bio_texto'] or '').encode('utf-16-le'))//2})" for c in ok1 if len((c['bio_texto'] or '').encode('utf-16-le'))//2 > 150]
    if u16:
        alertas1.append("Bio <=150 em code points, mas >150 em unidades UTF-16 (caracteres astrais/𝗺𝗮𝘁𝗲𝗺á𝘁𝗶𝗰𝗼𝘀) — atenção se o destino validar length em JS: " + ", ".join(u16))
    fb = [c["handle"] for c in ok1 if "fallback" in (c["evidencias"] or "")]
    if fb:
        alertas1.append(f"{len(fb)} conta(s) com proof_mechanism por fallback (prova_social_quantitativa sem sinal explícito) — revisar: " + ", ".join(fb))
    outros = [c["handle"] for c in ok1 if any(l["tipo_link"] == "outro" for l in c["links_externos"])]
    if outros:
        alertas1.append("Links tipo 'outro' (Shopee/collshp/ML/bit.ly/plataformas de grupo — catálogo do prompt não cobre marketplaces): " + ", ".join(outros))
    n_empty = sum(1 for p in profiles for l in (p.get("externalUrls") or []) if not (l.get("url") or "").strip())
    if n_empty:
        alertas1.append(f"{n_empty} entrada(s) vazia(s) em externalUrls descartada(s) (mixprime_achados, vitrinedeouro_ofertas)")

    etapa1 = {
        "etapa": "PROFILE_SCRAPING",
        "scraping_session_id": "20260923_profile_batch_001",
        "timestamp_coleta": max(filter(None, (ts_from_filename(f) for f in pfiles))) if pfiles else None,
        "arquivos_fonte": [os.path.basename(f) for f in pfiles],
        "timestamp_processamento": now,
        "contas_processadas": len(contas), "contas_validadas": len(ok1),
        "contas_com_falha": len(contas) - len(ok1),
        "contas": contas,
        "resumo_por_tier": dict(Counter(c["tier_porte"] for c in ok1)),
        "resumo_por_nicho": dict(Counter(c["nicho"] for c in ok1)),
        "resumo_por_proof_mechanism": dict(Counter(c["proof_mechanism_dominante"] for c in ok1)),
        "resumo_por_maturidade_funil": dict(Counter(c["maturidade_funil"] for c in ok1)),
        "alertas": alertas1,
    }

    # ---------------- ETAPA 2
    dup_map = Counter()
    for it in posts:
        if it.get("caption") and it.get("ownerUsername"):
            dup_map[(normalize_handle(it["ownerUsername"]), norm_caption(it["caption"]))] += 1
    out_posts = [process_post(it, valid_handles, now_dt, now, dup_map) for it in posts]
    ids = Counter(p["post_id"] for p in out_posts)
    for p in out_posts:
        if ids[p["post_id"]] > 1 and p["validacao_status"] == "OK":
            p["validacao_status"], p["erro_validacao"] = "FALHA", "post_id duplicado no lote"
    okp = [p for p in out_posts if p["validacao_status"] == "OK"]
    bad = [p for p in out_posts if p["validacao_status"] == "FALHA"]

    er_p = [p["_extras"]["er_parcial_sem_shares_saves"] for p in okp if p["_extras"]["er_parcial_sem_shares_saves"] is not None]
    cr = [p["comment_rate"] for p in okp if p["comment_rate"] is not None]
    for p in okp:  # arredondamento estável
        for k in ("comment_rate",):
            p[k] = rnd(p[k])
        p["_extras"]["er_parcial_sem_shares_saves"] = rnd(p["_extras"]["er_parcial_sem_shares_saves"])

    alertas2 = []
    fail_reason = Counter()
    for p in bad:
        key = re.sub(r"'[^']*'", "'X'", p["erro_validacao"].split(" (")[0])
        fail_reason[key] += 1
    third = defaultdict(int)
    for p in bad:
        if "não pertence às contas validadas" in (p["erro_validacao"] or ""):
            third[p["client_handle"]] += 1
    for h, n in sorted(third.items(), key=lambda kv: -kv[1]):
        alertas2.append(f"Handle desconhecido na Etapa 1: @{h} ({n} post(s)) — FALHA; " + ("scrapear o profile se for conta-alvo" if n >= 10 else "provável post tagged/colab de terceiro"))
    for p in bad:
        if "registro de erro do actor" in (p["erro_validacao"] or ""):
            alertas2.append(f"@{p['client_handle']}: registro de erro do actor (perfil restrito) — sem posts")
    for p in bad:
        if "likes=" in (p["erro_validacao"] or ""):
            alertas2.append(f"Post {p['_extras']['shortcode']} (@{p['client_handle']}): likes=-1 (ocultos) — FALHA conforme regra 'likes >= 0'")
    n_noviews = sum(1 for p in okp if p["views"] is None)
    alertas2.append(f"{n_noviews} post(s) OK sem views (image/carousel/reel sem contagem) — engagement_rate não calculável (views ausente)")
    alertas2.append(f"shares e saves NÃO existem no dump do Apify (instagram-scraper) — null em {len(okp)}/{len(okp)} posts; engagement_rate, save_rate, share_rate e engagement_score = null. Ver _extras.er_parcial_sem_shares_saves")
    n_nocap = sum(1 for p in okp if not (p["caption"] or "").strip())
    if n_nocap:
        alertas2.append(f"{n_nocap} post(s) com caption vazia — tipo_conteudo = null")
    per = Counter(p["client_handle"] for p in okp)
    low = [f"{h}({n})" for h, n in sorted(per.items(), key=lambda kv: kv[1]) if n < 10]
    if low:
        alertas2.append("Contas com <10 posts válidos (abaixo do mínimo de diagnóstico completo do protocolo ORBIT): " + ", ".join(low))
    miss = sorted(valid_handles - set(per))
    if miss:
        alertas2.append("Contas validadas na Etapa 1 sem nenhum post válido na Etapa 2: " + ", ".join(miss))
    etapa2 = {
        "etapa": "POST_SCRAPING",
        "scraping_session_id": "20260923_posts_batch_001",
        "timestamp_coleta": max(filter(None, (ts_from_filename(f) for f in sfiles))) if sfiles else None,
        "arquivos_fonte": [os.path.basename(f) for f in sfiles],
        "timestamp_processamento": now,
        "posts_processados": len(out_posts), "posts_validados": len(okp), "posts_com_falha": len(bad),
        "posts": out_posts,
        "resumo_por_tipo_conteudo": dict(Counter(p["tipo_conteudo"] or "sem_caption" for p in okp)),
        "resumo_por_cta": dict(Counter(p["cta_detectado"] for p in okp)),
        "resumo_por_risco": dict(Counter(p["risco_detectado"] for p in okp)),
        "resumo_por_media_type": dict(Counter(p["media_type"] for p in okp)),
        "resumo_por_falha": dict(fail_reason),
        "metricas_agregadas": {
            "er_media": None, "er_mediana": None, "save_rate_media": None, "engagement_score_media": None,
            "posts_com_link": sum(1 for p in okp if p["link_na_caption"]),
            "posts_com_cta_forte": sum(1 for p in okp if p["cta_detectado"] in ("clique_no_link", "compre_agora")),
            "_extras": {
                "nota": "er/save/score = null porque shares e saves não vêm do scraper; abaixo, métricas parciais (n = posts com views)",
                "n_posts_com_views": len(er_p),
                "er_parcial_sem_shares_saves_media": rnd(statistics.mean(er_p)) if er_p else None,
                "er_parcial_sem_shares_saves_mediana": rnd(statistics.median(er_p)) if er_p else None,
                "comment_rate_media": rnd(statistics.mean(cr)) if cr else None,
            },
        },
        "alertas": alertas2,
    }

    # validação dupla (prompt): todo handle OK da Etapa 2 existe na Etapa 1
    assert all(p["client_handle"] in valid_handles for p in okp), "post OK com handle fora da Etapa 1"

    json.dump(etapa1, open(os.path.join(a.out, "etapa1_profiles_v1_1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(etapa2, open(os.path.join(a.out, "etapa2_posts_v1_1.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Etapa 1: {etapa1['contas_processadas']} processadas | {etapa1['contas_validadas']} OK | {etapa1['contas_com_falha']} FALHA")
    print(f"Etapa 2: {etapa2['posts_processados']} processados | {etapa2['posts_validados']} OK | {etapa2['posts_com_falha']} FALHA")


if __name__ == "__main__":
    main()
