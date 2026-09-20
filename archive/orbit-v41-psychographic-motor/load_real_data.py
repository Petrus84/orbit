import json
import glob
from datetime import datetime, timezone
from orbit_v41 import InstagramPost


def fix_mojibake(s):
    """Mesmo bug documentado em metric-key-dictionary.ts (fixMetaMojibake):
    os exports nativos da Meta gravam UTF-8 relido como latin1 em várias
    chaves e valores de texto (ex.: 'ImpressÃµes' em vez de 'Impressões',
    'VocÃª' em vez de 'Você'). Sem essa correção, o léxico psicográfico
    (que busca por palavras acentuadas como 'você', 'não', 'emoção')
    praticamente não encontra match nenhum em texto com mojibake."""
    if not s:
        return s
    try:
        return s.encode('latin1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return s


def base_name(uri):
    return uri.rstrip('/').split('/')[-1] if uri else uri


def find_file(root, filename_endswith, must_have_key=None):
    """Acha o arquivo certo por sufixo de caminho + validação de conteúdo
    (pra não confundir com arquivos homônimos em outras pastas, ex.
    your_instagram_activity/media/posts.json != insights posts.json)."""
    candidates = glob.glob(f"{root}/**/{filename_endswith}", recursive=True)
    for c in candidates:
        if must_have_key:
            try:
                d = json.load(open(c, encoding='utf-8'))
                if isinstance(d, dict) and must_have_key in d:
                    return c
            except Exception:
                continue
        else:
            return c
    return None


def build_insights_index(posts_insights_path):
    index = {}
    if not posts_insights_path:
        return index
    d = json.load(open(posts_insights_path, encoding='utf-8'))
    for item in d.get('organic_insights_posts', []):
        smd_raw = item.get('string_map_data', {})
        # ✅ corrige mojibake em TODAS as chaves antes de procurar (ver fix_mojibake)
        smd = {fix_mojibake(k): v for k, v in smd_raw.items()}

        def num(key_variants):
            for k in key_variants:
                if k in smd and smd[k].get('value') is not None:
                    v = smd[k]['value']
                    cleaned = ''.join(ch for ch in v if ch.isdigit() or ch == '-')
                    return int(cleaned) if cleaned not in ('', '-') else None
            return None

        metrics = {
            'reach': num(['Contas alcançadas', 'Accounts reached']),
            'likes': num(['Curtidas', 'Likes']),
            'comments': num(['Comentários', 'Comments']),
            'shares': num(['Compartilhamentos', 'Shares']),
            'saves': num(['Salvamentos', 'Saves']),
            'impressions': num(['Impressões', 'Impressions']),
        }
        for media in item.get('media_map_data', {}).values():
            uri = media.get('uri')
            if uri:
                index[base_name(uri)] = metrics
    return index


def load_client_posts(root, client_label):
    posts_1_path = find_file(root, 'posts_1.json')
    reels_path = find_file(root, 'reels.json')
    insights_path = find_file(root, 'posts.json', must_have_key='organic_insights_posts')

    insights_index = build_insights_index(insights_path)

    posts = []
    empty_metrics = {'reach': None, 'likes': None, 'comments': None, 'shares': None, 'saves': None, 'impressions': None}

    if posts_1_path:
        raw = json.load(open(posts_1_path, encoding='utf-8'))
        for i, item in enumerate(raw):
            media = item.get('media', [])
            if not media:
                continue
            first = media[0]
            ts = item.get('creation_timestamp') or first.get('creation_timestamp')
            uri = first.get('uri')
            if not ts or not uri:
                continue
            fmt = 'carousel' if len(media) > 1 else ('reel' if uri.lower().endswith(('.mp4', '.mov')) else 'static')
            metrics = insights_index.get(base_name(uri), empty_metrics)
            caption = fix_mojibake(item.get('title', '') or '')
            posts.append(InstagramPost(
                post_id=f"{client_label}_post_{i}",
                caption=caption,
                likes=metrics['likes'] or 0,
                comments=metrics['comments'] or 0,
                shares=metrics['shares'] or 0,
                reach=metrics['reach'] or 0,
                impressions=metrics['impressions'] or 0,
                saves=metrics['saves'] or 0,
                published_at=datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                format_type=fmt,
            ))

    if reels_path:
        raw = json.load(open(reels_path, encoding='utf-8'))
        for i, item in enumerate(raw.get('ig_reels_media', [])):
            media = item.get('media', [])
            if not media:
                continue
            first = media[0]
            ts = first.get('creation_timestamp')
            uri = first.get('uri')
            if not ts or not uri:
                continue
            metrics = insights_index.get(base_name(uri), empty_metrics)
            caption = fix_mojibake(first.get('title', '') or '')
            posts.append(InstagramPost(
                post_id=f"{client_label}_reel_{i}",
                caption=caption,
                likes=metrics['likes'] or 0,
                comments=metrics['comments'] or 0,
                shares=metrics['shares'] or 0,
                reach=metrics['reach'] or 0,
                impressions=metrics['impressions'] or 0,
                saves=metrics['saves'] or 0,
                published_at=datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
                format_type='reel',
            ))

    return posts, {
        'posts_1_path': posts_1_path,
        'reels_path': reels_path,
        'insights_path': insights_path,
        'posts_with_reach': sum(1 for p in posts if p.reach > 0),
    }
