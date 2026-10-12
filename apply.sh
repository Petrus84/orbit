#!/usr/bin/env sh
# Uso (em qualquer pasta do repo):
#   sh apply.sh 0003-appshell-scroll-unico-instagram-mobile.patch [--remove-dead]
set -e
cd "$(git rev-parse --show-toplevel)"
REMOVE=0
for a in "$@"; do
  case "$a" in
    --remove-dead) REMOVE=1 ;;
    *) P="$a"; [ -f "$P" ] || P="$OLDPWD/$a"
       if git apply --check "$P" 2>/dev/null; then OPT=""
       elif git apply --check --ignore-whitespace "$P"; then OPT="--ignore-whitespace"
       else echo "FALHOU: $a" >&2; exit 1; fi
       git apply $OPT "$P" && echo "aplicado: $a" ;;
  esac
done
if [ "$REMOVE" = 1 ]; then
  if git grep -n "IGOverviewScreen" -- src ':!src/components/screens/IGOverviewScreen.tsx' ':!src/components/screens/IGOverviewScreen.module.css' | grep -q .; then
    echo "IGOverviewScreen ainda é referenciado; nada removido:"; git grep -n "IGOverviewScreen" -- src
  else
    git rm -q src/components/screens/IGOverviewScreen.tsx src/components/screens/IGOverviewScreen.module.css && echo "removido: IGOverviewScreen (tsx + css)"
  fi
fi
