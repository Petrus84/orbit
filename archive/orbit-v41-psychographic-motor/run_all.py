import sys, json
sys.path.insert(0, '.')
from load_real_data import load_client_posts
from orbit_v41 import (
    OrbitV41Engine, ClientAvatar, SchwatzValue, PsychographicAnalyzer,
    SECTOR_BENCHMARKS, InstagramPost
)
import numpy as np

ROOTS = {
    "CPImportstore": "/home/claude/export_clients/Export_clients/CPImportstore/2141d077-0d82-4fda-83df-558377f105ff/extracted_25",
    "DjCaioDogao": "/home/claude/export_clients/Export_clients/DjCaioDogao",
    "Dogativo": "/home/claude/export_clients/Export_clients/Dogativo",
    "Eupetruchio84": "/home/claude/export_clients/Export_clients/Eupetruchio84",
    "Mauriciogomes.artphoto": "/home/claude/export_clients/Export_clients/Mauriciogomes.artphoto",
}

engine = OrbitV41Engine()
analyzer = PsychographicAnalyzer()

# ── Avatares ────────────────────────────────────────────────────────────
# CONFIRMADO: exatamente o avatar definido no script orbit_v41.py compartilhado (main()).
avatar_cp = ClientAvatar(
    name="CP Import Store", sector="ecommerce",
    target_age_min=25, target_age_max=45, target_gender="MF",
    target_interests=["moda", "importados", "tendência"],
    target_values=[SchwatzValue.HEDONISM, SchwatzValue.ACHIEVEMENT, SchwatzValue.SELF_DIRECTION],
    expected_tone="descontraído"
)

# INFERIDO a partir do conteúdo real (portfólio fotográfico) — não confirmado pelo cliente.
# Usa os próprios expected_values do benchmark "agencia" do script, sem inventar tom.
avatar_mauricio = ClientAvatar(
    name="Mauricio Gomes ArtPhoto", sector="agencia",
    target_age_min=25, target_age_max=55, target_gender="MF",
    target_interests=["fotografia", "arte", "portfólio"],
    target_values=[SchwatzValue.ACHIEVEMENT, SchwatzValue.POWER, SchwatzValue.SELF_DIRECTION],
    expected_tone="profissional"  # não aciona nenhuma penalidade de tom no motor (só "inspirador"/"descontraído" acionam)
)

results = {}

def run_with_avatar(label, root, avatar, sector_label):
    posts, meta = load_client_posts(root, label)
    posts_with_data = [p for p in posts if p.reach > 0]
    posts_with_caption = [p for p in posts if p.caption.strip()]

    result, scores = engine.run_analysis(posts_with_data, avatar) if len(posts_with_data) >= 2 else (None, None)

    # Perfil psicográfico objetivo (não depende de avatar) sobre TODOS os posts com legenda
    all_scores = [analyzer.analyze_post(p, avatar) for p in posts_with_caption]
    dominant_counts = {}
    for s in all_scores:
        dominant_counts[s.dominant_system] = dominant_counts.get(s.dominant_system, 0) + 1

    benchmark = SECTOR_BENCHMARKS.get(avatar.sector)
    avg_er_real = float(np.mean([p.engagement_rate for p in posts_with_data])) if posts_with_data else None
    avg_vps_real = float(np.mean([p.virality_potential_score for p in posts_with_data])) if posts_with_data else None

    return {
        "label": label, "sector_label": sector_label,
        "total_posts": len(posts), "posts_com_legenda": len(posts_with_caption),
        "posts_com_reach_real": len(posts_with_data),
        "dominant_system_counts": dominant_counts,
        "avg_er_real": avg_er_real, "avg_vps_real": avg_vps_real,
        "benchmark": benchmark,
        "result": result,
        "n_insuficiente_para_correlacao": len(posts_with_data) < 2,
    }


def run_objective_only(label, root, note):
    posts, meta = load_client_posts(root, label)
    posts_with_data = [p for p in posts if p.reach > 0]
    posts_with_caption = [p for p in posts if p.caption.strip()]

    # avatar "neutro" só pra reaproveitar analyze_post (target_values=[] -> value_alignment sempre 0,
    # não usamos alignment_score aqui de propósito)
    neutral_avatar = ClientAvatar(
        name=label, sector="", target_age_min=0, target_age_max=0, target_gender="",
        target_interests=[], target_values=[], expected_tone=""
    )
    all_scores = [analyzer.analyze_post(p, neutral_avatar) for p in posts_with_caption]
    dominant_counts = {}
    for s in all_scores:
        dominant_counts[s.dominant_system] = dominant_counts.get(s.dominant_system, 0) + 1

    avg_er_real = float(np.mean([p.engagement_rate for p in posts_with_data])) if posts_with_data else None
    avg_vps_real = float(np.mean([p.virality_potential_score for p in posts_with_data])) if posts_with_data else None

    # ER médio por sistema dominante (só entre os que têm reach real)
    scores_with_data = [analyzer.analyze_post(p, neutral_avatar) for p in posts_with_data]
    sys_er = {}
    for s, p in zip(scores_with_data, posts_with_data):
        sys_er.setdefault(s.dominant_system, []).append(p.engagement_rate)
    sys_er_avg = {k: float(np.mean(v)) for k, v in sys_er.items()}

    return {
        "label": label, "note": note,
        "total_posts": len(posts), "posts_com_legenda": len(posts_with_caption),
        "posts_com_reach_real": len(posts_with_data),
        "dominant_system_counts": dominant_counts,
        "avg_er_real": avg_er_real, "avg_vps_real": avg_vps_real,
        "system_avg_er": sys_er_avg,
    }


results["CPImportstore"] = run_with_avatar("CPImportstore", ROOTS["CPImportstore"], avatar_cp, "ecommerce (CONFIRMADO)")
results["Mauriciogomes.artphoto"] = run_with_avatar("Mauriciogomes.artphoto", ROOTS["Mauriciogomes.artphoto"], avatar_mauricio, "agencia (INFERIDO do conteúdo real, não confirmado)")
results["DjCaioDogao"] = run_objective_only("DjCaioDogao", ROOTS["DjCaioDogao"], "Conteúdo pessoal (opinião política/novela) — não corresponde a nenhum setor do benchmark.")
results["Eupetruchio84"] = run_objective_only("Eupetruchio84", ROOTS["Eupetruchio84"], "Conta pessoal, maioria dos posts sem legenda própria (repost) — sem setor de negócio identificável.")
results["Dogativo"] = run_objective_only("Dogativo", ROOTS["Dogativo"], "Conteúdo adulto/fetiche por assinatura — não corresponde a nenhum setor do benchmark; fonte (X) nunca fornece alcance por post, então ER/VPS não são calculáveis (0 posts com reach real).")

# ── Print legível ──────────────────────────────────────────────────────
for label, r in results.items():
    print("="*70)
    print(label)
    print("="*70)
    print(json.dumps({k: v for k, v in r.items() if k != 'result'}, ensure_ascii=False, indent=2, default=str))
    if r.get('result'):
        res = r['result']
        print("\n--- AnalysisResult (engine) ---")
        print("avg_alignment_score:", res.avg_alignment_score)
        print("correlation_alignment_vs_er:", res.correlation_alignment_vs_er)
        print("correlation_alignment_vs_vps:", res.correlation_alignment_vs_vps)
        print("top_performing_systems:", res.top_performing_systems)
        print("recommendations:")
        for rec in res.recommendations:
            print("  -", rec)
    print()
