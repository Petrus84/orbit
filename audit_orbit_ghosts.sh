#!/usr/bin/env bash
# ============================================================================
# audit_orbit_ghosts.sh
# Confirma (1) o breaking change AlignmentBar.status -> .color
# e (2) a lista de arquivos suspeitos de serem órfãos/fantasmas no repo Orbit.
# Rodar a partir da raiz do repo (onde fica src/ e tsconfig.json).
# ============================================================================
set -uo pipefail

echo "=============================================================="
echo "1) BREAKING CHANGE — AlignmentBar.status vs .color"
echo "=============================================================="
echo "-- Quem ainda lê '.status' em algo que pode ser um AlignmentBar:"
grep -rn "\.status" src --include="*.tsx" --include="*.ts" \
  | grep -i "bar\|alignment"

echo
echo "-- Todos os arquivos que importam AlignmentBar (candidatos a checar manualmente):"
grep -rln "AlignmentBar" src --include="*.tsx" --include="*.ts"

echo
echo "-- Definição canônica atual em orbit.ts (confirma se é 'color' ou 'status'):"
grep -n -A 6 "interface AlignmentBar" src/types/orbit.ts

echo
echo "=============================================================="
echo "2) LISTA DE FANTASMAS — checando import real de cada um"
echo "=============================================================="

check_ghost () {
  local label="$1"
  local pattern="$2"
  echo
  echo "---- $label ----"
  echo "Quem importa (fora do próprio arquivo):"
  grep -rln "$pattern" src --include="*.tsx" --include="*.ts" \
    | grep -v "$(echo "$pattern" | sed 's/.*\///')" \
    || echo "  (nenhum import encontrado — CONFIRMADO ÓRFÃO)"
  echo "Existe rota apontando pra ele em src/app?"
  grep -rln "$pattern" src/app --include="*.tsx" 2>/dev/null \
    || echo "  (nenhuma rota em src/app usa isso)"
}

check_ghost "useClients.ts"            "useClients"
check_ghost "clientsRepository.ts"     "clientsRepository"
check_ghost "CarteiraScreen.tsx"       "CarteiraScreen"
check_ghost "FunnelScreenWrapper.tsx"  "FunnelScreenWrapper"
check_ghost "MetaAdsScreen.tsx"        "MetaAdsScreen"
check_ghost "metaAdsRepository.ts"     "metaAdsRepository"
check_ghost "instagramRepository.ts"   "from.*['\"].*instagramRepository['\"]"
check_ghost "compare.ts"               "from.*['\"].*types/compare['\"]"
check_ghost "check-schema-drift.ts"    "check-schema-drift"
check_ghost "contentContractEngine.ts" "contentContractEngine"

echo
echo "=============================================================="
echo "3) CONFIRMAÇÃO CRUZADA — rota /carteira importa useClients?"
echo "   (o diff que já revisamos mostrava import direto em page.tsx —"
echo "    se o grep acima disser 'órfão', o repo está DESATUALIZADO"
echo "    em relação ao patch que analisamos, não é fantasma real)"
echo "=============================================================="
if [ -f src/app/carteira/page.tsx ]; then
  grep -n "useClients\|CarteiraScreen" src/app/carteira/page.tsx
else
  echo "  src/app/carteira/page.tsx não encontrado neste checkout."
fi

echo
echo "=============================================================="
echo "4) ERROS REAIS DE COMPILAÇÃO (confirma os '19 erros' do wrapper)"
echo "=============================================================="
if command -v npx >/dev/null 2>&1; then
  echo "Rodando tsc --noEmit (pode demorar)..."
  npx tsc --noEmit --strict 2>&1 | tee /tmp/tsc_output.txt | tail -40
  echo
  echo "Erros especificamente em FunnelScreenWrapper.tsx:"
  grep "FunnelScreenWrapper" /tmp/tsc_output.txt || echo "  (nenhum erro citando o arquivo — ou ele nem é compilado por não ser importado)"
else
  echo "  npx não encontrado — rode manualmente: npx tsc --noEmit --strict"
fi

echo
echo "=============================================================="
echo "5) DETECÇÃO SISTEMÁTICA DE ÓRFÃOS (dependency-cruiser nativo)"
echo "   Isso é o que a auditoria anterior deveria ter rodado desde o"
echo "   início — regra 'no-orphans' varre o grafo inteiro de uma vez,"
echo "   em vez de precisar caçar arquivo por arquivo."
echo "=============================================================="
if command -v npx >/dev/null 2>&1; then
  npx depcruise src \
    --include-only "^src" \
    --output-type err \
    --validate <(cat <<'EOF'
{
  "forbidden": [
    {
      "name": "no-orphans",
      "severity": "warn",
      "comment": "Módulo sem nenhum import de entrada (exceto pontos de entrada conhecidos: app/, pages/, *.config.*, *.d.ts)",
      "from": {
        "orphan": true,
        "pathNot": [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          "\\.d\\.ts$",
          "^src/app/",
          "\\.(test|spec)\\.(js|mjs|cjs|ts)$"
        ]
      },
      "to": {}
    }
  ],
  "options": {}
}
EOF
) || echo "  (depcruise não rodou — confira se dependency-cruiser está instalado: npm ls dependency-cruiser)"
else
  echo "  npx não encontrado."
fi

echo
echo "=============================================================="
echo "6) GIT BLAME/LOG — quando cada fantasma nasceu e se alguém já"
echo "   tentou conectá-lo (útil pra saber se é dívida antiga ou algo"
echo "   recém-criado por um patch automatizado)"
echo "=============================================================="
for f in \
  "src/hooks/useClients.ts" \
  "src/lib/repositories/clientsRepository.ts" \
  "src/components/screens/CarteiraScreen.tsx" \
  "src/components/screens/FunnelScreenWrapper.tsx" \
  "src/components/screens/MetaAdsScreen.tsx" \
  "src/lib/repositories/metaAdsRepository.ts" \
  "src/lib/repositories/instagramRepository.ts" \
  "src/types/compare.ts" \
  "src/types/check-schema-drift.ts" \
  "src/types/contentContractEngine.ts"
do
  if [ -f "$f" ]; then
    echo
    echo "---- $f ----"
    git log --follow --diff-filter=A --format="criado em %ad por %an" --date=short -- "$f" | head -1
    echo "commits totais: $(git log --follow --oneline -- "$f" | wc -l)"
  fi
done

echo
echo "Fim da auditoria."