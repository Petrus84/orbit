import json, pathlib, re, sys

reg_path, dec_path = sys.argv[1:]
raw = json.loads(pathlib.Path(reg_path).read_text(encoding="utf-8"))
kpis = raw["kpis"] if isinstance(raw, dict) else raw

sem_id = [i for i, k in enumerate(kpis) if not isinstance(k, dict) or "kpi_id" not in k]
if sem_id:
    sys.exit(f"fichas sem kpi_id nas posicoes {sem_id}")
by = {k["kpi_id"]: k for k in kpis}
if len(by) != len(kpis):
    sys.exit("kpi_id duplicado")
if len(by) < 22:
    sys.exit(f"n_fichas={len(by)} < 22")
for kid in ("engagement_public", "play_to_view_ratio", "utility_caption", "utility_score_pct"):
    if kid not in by:
        sys.exit(f"ficha ausente: {kid}")

def campo(kid, *path):
    v = by[kid]
    for p in path:
        v = v.get(p) if isinstance(v, dict) else None
    return v

def screens(kid):
    return by[kid].get("screens") or []

def banned(path):
    p = str(path).lower()
    return "overview" in p or "qualityscores" in p or "sectorpositioning" in p

if campo("engagement_public", "output", "unit") != "count":
    sys.exit(f"C1: engagement_public.output.unit = {campo('engagement_public', 'output', 'unit')!r}, esperado 'count'")
if screens("engagement_public"):
    sys.exit("C2: engagement_public.screens deveria ser []")
if any(banned(s) for s in screens("play_to_view_ratio")):
    sys.exit("C2: play_to_view_ratio nao pode ter tela de Overview")
if screens("utility_caption") or screens("utility_score_pct"):
    sys.exit("C4/C5: utilidade nao pode ter screens")
esperado = {
    "utility_caption": "proposta",
    "utility_score_pct": "vigente",
    "engagement_public": "vigente",
    "play_to_view_ratio": "vigente",
}
for kid, st in esperado.items():
    if by[kid].get("status") != st:
        sys.exit(f"{kid}.status = {by[kid].get('status')!r}, esperado {st!r}")

for k in kpis:
    adr = k.get("adr")
    if adr and not pathlib.Path(adr).exists():
        sys.exit(f"{k['kpi_id']}: ADR inexistente: {adr}")

print(f"registry_ok n_fichas={len(by)}")

text = pathlib.Path(dec_path).read_text(encoding="utf-8")
need = {
    "KCR-C1": "fechado", "KCR-C2": "fechado", "KCR-C3": "fechado",
    "KCR-C4": "fechado", "KCR-C5": "fechado",
    "KCR-C6": "adiado", "KCR-C7": "adiado",
}
for mark, kind in need.items():
    if not re.search(rf"{mark}\b.*{kind}", text):
        sys.exit(f"veredito ausente ou sem estado: {mark} ({kind})")
if "Não recoloca" not in text:
    sys.exit("C5: falta a correcao - RWP-1 nao recoloca o tile")

print("decisions_ok")