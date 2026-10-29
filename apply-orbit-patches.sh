#!/usr/bin/env bash
# Aplica os 3 patches ORBIT, na ordem, de forma IDEMPOTENTE: cada arquivo de cada patch é
# classificado como  já-aplicado | aplicável | divergente. Rode na RAIZ do repo (onde está src/).
#   bash apply-orbit-patches.sh --dry-run    só mostra o estado; não altera nada
#   bash apply-orbit-patches.sh              aplica o que falta (backup de src/ antes)
#   bash apply-orbit-patches.sh --verify     idem + tsc + testes dos módulos novos
#   bash apply-orbit-patches.sh --reject     aplica o que der; hunks divergentes viram *.rej
# Um comando por vez (não cole os comentários).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES=(
  "01-criterio-sucesso-voz-gestor.patch"
  "02-resolvidos-central-alertas.patch"
  "03-resolvidos-complemento.patch"
)
FLAGS=(--ignore-whitespace)   # o repo mistura CRLF e LF

MODE="apply"; VERIFY=0; REJECT=0
for a in "$@"; do
  case "$a" in
    --dry-run) MODE="dry" ;;
    --verify)  VERIFY=1 ;;
    --reject)  REJECT=1 ;;
    *) echo "opção desconhecida: $a" >&2; exit 2 ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
[ -d src ] || { echo "src/ não encontrado em $ROOT" >&2; exit 2; }
for p in "${PATCHES[@]}"; do [ -f "$DIR/$p" ] || { echo "faltando: $DIR/$p" >&2; exit 2; }; done

files_of() { grep '^diff --git ' "$1" | sed -E 's#^diff --git a/(.+) b/.+$#\1#'; }

# index() em vez de regex: caminhos com ( ) [ ] não quebram o match.
is_new_file() {
  awk -v f="$2" '
    index($0, "diff --git a/" f " b/")==1 { h=1; next }
    h && /^new file mode/ { print "y"; exit }
    h && /^(---|@@)/ { exit }
  ' "$1" | grep -q y
}

# classify <dir> <patch> <file> -> applied | todo | diverged
classify() {
  local d="$1" p="$2" f="$3"
  if (cd "$d" && git apply "${FLAGS[@]}" --reverse --check --include="$f" "$DIR/$p" >/dev/null 2>&1); then
    echo applied
  elif (cd "$d" && git apply "${FLAGS[@]}" --check --include="$f" "$DIR/$p" >/dev/null 2>&1); then
    echo todo
  else
    echo diverged
  fi
}

# run_chain <dir> <do_apply 0|1> <with_reject 0|1>  — imprime tabela; devolve 1 se houver divergência
run_chain() {
  local d="$1" doit="$2" rej="$3" bad=0 p f st
  for p in "${PATCHES[@]}"; do
    echo "── $p"
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      st="$(classify "$d" "$p" "$f")"
      case "$st" in
        applied)  echo "   ✓ já aplicado   $f" ;;
        todo)
          echo "   + a aplicar     $f"
          [ "$doit" = 1 ] && (cd "$d" && git apply "${FLAGS[@]}" --include="$f" "$DIR/$p") ;;
        diverged)
          echo "   ✗ DIVERGENTE    $f"; bad=1
          if is_new_file "$DIR/$p" "$f" && [ -e "$d/$f" ]; then
            echo "       o arquivo já existe e difere do patch. Diferença (seu < patch >):"
            local t; t="$(mktemp -d)"
            (cd "$t" && git apply "${FLAGS[@]}" --include="$f" "$DIR/$p" >/dev/null 2>&1) || true
            diff --strip-trailing-cr -u "$d/$f" "$t/$f" 2>/dev/null | sed -n '1,40p' | sed 's/^/       /' || true
            rm -rf "$t"
          else
            local t2; t2="$(mktemp -d)"; mkdir -p "$t2/$(dirname "$f")"; cp "$d/$f" "$t2/$f" 2>/dev/null || true
            (cd "$t2" && git apply "${FLAGS[@]}" --reject --include="$f" "$DIR/$p" >/dev/null 2>&1) || true
            [ -f "$t2/$f.rej" ] && sed -n '1,24p' "$t2/$f.rej" | sed 's/^/       /'
            rm -rf "$t2"
          fi
          if [ "$doit" = 1 ] && [ "$rej" = 1 ] && [ -e "$d/$f" ]; then
            (cd "$d" && git apply "${FLAGS[@]}" --reject --include="$f" "$DIR/$p" >/dev/null 2>&1) || true
          fi ;;
      esac
    done < <(files_of "$DIR/$p")
  done
  return $bad
}

if [ -n "$(git status --porcelain -- src)" ]; then
  echo "• src/ tem mudanças não commitadas: o estado abaixo é o do seu working tree."
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp -R src "$TMP/src"
echo "=== simulação (cópia do working tree)"
if run_chain "$TMP" 1 0; then BAD=0; else BAD=1; fi

if [ "$BAD" = 1 ] && [ "$REJECT" = 0 ]; then
  echo; echo "Há arquivos divergentes: nada foi alterado. Mande esta saída completa para ajuste do patch,"
  echo "ou use --reject para aplicar o resto e resolver os *.rej à mão."; exit 1
fi
[ "$MODE" = "dry" ] && { echo; echo "dry-run: nada foi alterado."; exit 0; }

BK="$(dirname "$ROOT")/.orbit-backup-$(basename "$ROOT")-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK" && cp -R src "$BK/src" && echo && echo "• backup de src/ em: $BK"
echo "=== aplicando"
run_chain "$ROOT" 1 "$REJECT" >/dev/null || true
echo "Pronto (sem commit). Para desfazer: restaure $BK/src"
[ "$REJECT" = 1 ] && echo "Procure por: find src -name '*.rej'"
if [ "$VERIFY" = 1 ]; then
  echo "→ tsc --noEmit"; npx tsc --noEmit
  echo "→ vitest (módulos novos)"; npx vitest run src/lib/alertSuccess.test.ts src/lib/alertResolvedCopy.test.ts
fi