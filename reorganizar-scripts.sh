#!/usr/bin/env bash
# ORBIT · reorganizar-scripts.sh
# Reorganiza scripts/ em subpastas por função e corrige imports/caminhos.
#
# Uso (da RAIZ do projeto, Git Bash):
#   bash reorganizar-scripts.sh --dry-run   # só mostra o que faria
#   bash reorganizar-scripts.sh             # executa
#
# Usa `git mv` quando o arquivo é versionado (preserva histórico) e `mv` quando não é.
# Para desfazer: git restore --staged . && git checkout -- . (arquivos não versionados: mover de volta à mão).

set -euo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

if [ ! -f package.json ] || [ ! -d scripts ]; then
  echo "❌ Rode da raiz do projeto (onde estão package.json e scripts/)."; exit 1
fi

run() { if [ "$DRY" = 1 ]; then echo "   [dry] $*"; else "$@"; fi; }

mv_safe() { # origem destino
  local src="$1" dst="$2"
  if [ ! -f "$src" ]; then echo "   ⚠️  não encontrado, pulando: $src"; return; fi
  if [ -e "$dst" ]; then echo "   ⚠️  destino já existe, pulando: $dst"; return; fi
  run mkdir -p "$(dirname "$dst")"
  if git ls-files --error-unmatch "$src" >/dev/null 2>&1; then
    run git mv "$src" "$dst"
  else
    run mv "$src" "$dst"
  fi
  echo "   ✔ $src → $dst"
}

echo "── 1. Movendo arquivos"
# ingest/ — tudo que grava dados no banco a partir de arquivos externos
mv_safe scripts/ingest-from-zip.ts            scripts/ingest/ingest-from-zip.ts
mv_safe scripts/ingest-meta-csv.ts            scripts/ingest/ingest-meta-csv.ts
mv_safe scripts/ingest-apify-reel-views.ts    scripts/ingest/ingest-apify-reel-views.ts
mv_safe scripts/lib/ingest-apify-comments.ts  scripts/ingest/ingest-apify-comments.ts   # estava em lib/ por engano (é CLI)

# audit/ — só leem o banco e relatam
mv_safe scripts/audit-5-clients.ts            scripts/audit/audit-5-clients.ts
mv_safe scripts/ogp-audit.ts                  scripts/audit/ogp-audit.ts
mv_safe scripts/check-ingestion.ts            scripts/audit/check-ingestion.ts

# copy/ — auditoria de texto da interface (varre src/, não toca no banco)
mv_safe scripts/copy-audit.mjs                       scripts/copy/copy-audit.mjs
mv_safe scripts/scripts_copy-audit-neuromarketing.mjs scripts/copy/copy-audit-neuromarketing.mjs

# contracts/ — robô KCR
mv_safe scripts/reconcile-kpi-contracts.ts    scripts/contracts/reconcile-kpi-contracts.ts

# db/ — escrevem/apagam no banco fora do fluxo de ingestão
mv_safe scripts/seed-dynamic.ts               scripts/db/seed-dynamic.ts
mv_safe scripts/cleanup-example-seed.mjs      scripts/db/cleanup-example-seed.mjs

# _legacy/ — compilados .js duplicados e módulo sem nenhum importador
mv_safe scripts/ogp-audit.js                  scripts/_legacy/ogp-audit.js
mv_safe scripts/reconcile-kpi-contracts.js    scripts/_legacy/reconcile-kpi-contracts.js
mv_safe scripts/lib/instagram-export-manifest.ts scripts/_legacy/instagram-export-manifest.ts

echo
echo "── 2. Corrigindo imports"
sedi() { # expressão arquivo
  [ -f "$2" ] || return 0
  if [ "$DRY" = 1 ]; then echo "   [dry] sed -i '$1' $2"; else sed -i "$1" "$2"; echo "   ✔ $2"; fi
}
# ingest/*: './lib/x' (estava ao lado de lib/) -> '../lib/x'
for f in scripts/ingest/ingest-from-zip.ts scripts/ingest/ingest-meta-csv.ts scripts/ingest/ingest-apify-reel-views.ts; do
  sedi "s#\(['\"]\)\./lib/#\1../lib/#g" "$f"
done
# ingest-apify-comments.ts estava DENTRO de lib/ ('./x') -> '../lib/x'
sedi "s#'\./resolveClientId'#'../lib/resolveClientId'#; s#'\./apify-comments'#'../lib/apify-comments'#" scripts/ingest/ingest-apify-comments.ts
# ogp-audit.ts resolve o .env.local relativo ao arquivo: agora está um nível mais fundo
sedi "s#path\.resolve(__dirname, '\.\./\.env\.local')#path.resolve(__dirname, '../../.env.local')#" scripts/audit/ogp-audit.ts

echo
echo "── 3. Atualizando caminhos citados em cabeçalhos (Uso: ...) e no package.json"
retarget() { # nome-antigo nome-novo(com pasta)
  local files
  files=$(grep -rl "scripts/$1" scripts package.json 2>/dev/null || true)
  for f in $files; do
    if [ "$DRY" = 1 ]; then echo "   [dry] $f: scripts/$1 -> scripts/$2"; else sed -i "s#scripts/$1#scripts/$2#g" "$f"; echo "   ✔ $f"; fi
  done
}
retarget ingest-from-zip.ts          ingest/ingest-from-zip.ts
retarget ingest-meta-csv.ts          ingest/ingest-meta-csv.ts
retarget ingest-apify-reel-views.ts  ingest/ingest-apify-reel-views.ts
retarget ingest-apify-comments.ts    ingest/ingest-apify-comments.ts
retarget check-ingestion.ts          audit/check-ingestion.ts
retarget audit-5-clients.ts          audit/audit-5-clients.ts
retarget ogp-audit.ts                audit/ogp-audit.ts
retarget copy-audit.mjs              copy/copy-audit.mjs
retarget copy-audit-neuromarketing.mjs copy/copy-audit-neuromarketing.mjs
retarget reconcile-kpi-contracts.ts  contracts/reconcile-kpi-contracts.ts
retarget seed-dynamic.ts             db/seed-dynamic.ts
retarget cleanup-example-seed.mjs    db/cleanup-example-seed.mjs

echo
echo "── 4. Conferência: imports relativos que não resolvem"
BAD=0
while IFS= read -r f; do
  dir=$(dirname "$f")
  while IFS= read -r spec; do
    base="$dir/$spec"
    ok=0
    for cand in "$base" "$base.ts" "$base.js" "$base.mjs" "$base/index.ts"; do
      [ -f "$cand" ] && ok=1 && break
    done
    if [ "$ok" = 0 ]; then echo "   ❌ $f importa '$spec' (não existe)"; BAD=1; fi
  done < <(grep -oE "from ['\"]\.{1,2}/[^'\"]+['\"]" "$f" | sed -E "s/from ['\"](.*)['\"]/\1/")
done < <(find scripts -type f \( -name '*.ts' -o -name '*.mjs' \) -not -path 'scripts/_legacy/*')
[ "$BAD" = 0 ] && echo "   ✔ todos os imports relativos resolvem"

echo
echo "── 5. Revise à mão: quem fora de scripts/ ainda cita os caminhos antigos"
grep -rnE "scripts/(ingest-|audit-5|check-ingestion|ogp-audit|copy-audit|reconcile-kpi|seed-dynamic|cleanup-example|lib/(ingest-apify|instagram-export))" \
  src e2e tests docs .husky .github tsconfig*.json *.md *.json *.mjs *.sh 2>/dev/null \
  | grep -v node_modules | grep -v 'repomix' | grep -v '^reorganizar-scripts.sh' | head -40 || true
echo "   (se aparecer algo acima, ajuste; tsconfig.scripts.json em especial — veja o campo \"include\")"
echo
[ "$DRY" = 1 ] && echo "🟡 DRY-RUN concluído — nada foi alterado." || echo "🟢 Pronto."
