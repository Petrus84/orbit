#!/usr/bin/env bash
# =============================================================================
# ORBIT · Cirurgias 2 e 3 — Versão sem Python (sed puro)
# Use este script SE orbit-fix.sh parou em "python3: command not found"
# Rodar em: C:/Users/DELL/Downloads/Alpha/orbit-dashboard
# Uso: bash orbit-fix-2.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; CYN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "$1"; }
sep()  { log "\n${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
ok()   { log "  ${GRN}✅ $1${NC}"; }
warn() { log "  ${YLW}⚠️  $1${NC}"; }
fail() { log "  ${RED}❌ $1${NC}"; }

if [ ! -f "package.json" ]; then
  fail "Rode na raiz do projeto (onde está o package.json)"
  exit 1
fi

TYPE_IG="src/types/instagram.ts"
REPO="src/lib/repositories/instagramRepository.ts"

# Backup (caso ainda não tenha sido feito pela cirurgia 1)
BACKUP_DIR=".orbit-backup-$(date '+%Y%m%d-%H%M%S')"
mkdir -p "$BACKUP_DIR"
for f in "$TYPE_IG" "$REPO"; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/$(basename $f).bak"
done
ok "Backup salvo em $BACKUP_DIR/"

# =============================================================================
# CIRURGIA 2 — instagram.ts — StatusVariant alias (via sed)
# =============================================================================
sep
log "\n${YLW}[CIRURGIA 2/3] instagram.ts — StatusVariant unificado${NC}"

if [ ! -f "$TYPE_IG" ]; then
  warn "$TYPE_IG não encontrado — pulando"
else
  if grep -q "export type { StatusVariant } from './orbit'" "$TYPE_IG"; then
    ok "Já aplicado anteriormente — nada a fazer"
  else
    # sed: substitui a linha inteira do export type StatusVariant = ...
    sed -i \
      's|^export type StatusVariant = .*$|// ⚠️  StatusVariant unificado com orbit.ts (orbit-fix-2.sh)\nexport type { StatusVariant } from "./orbit";|' \
      "$TYPE_IG"

    if grep -q "export type { StatusVariant } from \"./orbit\"" "$TYPE_IG"; then
      ok "StatusVariant em instagram.ts → alias para orbit.ts"
    else
      fail "sed não encontrou o padrão esperado — verifique manualmente:"
      grep -n "StatusVariant" "$TYPE_IG"
    fi
  fi
fi

# =============================================================================
# CIRURGIA 3 — instagramRepository.ts — deriveCriticalAlerts shape (via awk)
# =============================================================================
sep
log "\n${YLW}[CIRURGIA 3/3] instagramRepository.ts — deriveCriticalAlerts${NC}"

if [ ! -f "$REPO" ]; then
  warn "$REPO não encontrado — pulando"
else
  if grep -q "function deriveCriticalAlerts(kpis: KPICardData\[\]): CriticalAlertData\[\]" "$REPO"; then
    ok "Já aplicado anteriormente — nada a fazer"
  else
    # Usa awk para substituir o bloco da função inteira (multi-linha)
    awk '
      BEGIN { in_func = 0; brace_depth = 0 }
      /^function deriveCriticalAlerts\(kpis: KPICardData\[\]\): string\[\] \{/ {
        in_func = 1
        brace_depth = 1
        print "function deriveCriticalAlerts(kpis: KPICardData[]): CriticalAlertData[] {"
        print "  return kpis"
        print "    .filter((k) => k.semaphore === \"vermelho\")"
        print "    .map((k) => ({"
        print "      id:       `alert-${k.id}`,"
        print "      title:    k.label,"
        print "      body:     `${k.delta > 0 ? \"+\" : \"\"}${k.delta}% vs período anterior — intervenção necessária.`,"
        print "      severity: \"critical\" as const,"
        print "    }));"
        print "}"
        next
      }
      in_func == 1 {
        # conta chaves para saber quando o bloco original termina
        n_open  = gsub(/\{/, "{")
        n_close = gsub(/\}/, "}")
        brace_depth += n_open - n_close
        if (brace_depth <= 0) { in_func = 0 }
        next
      }
      { print }
    ' "$REPO" > "$REPO.tmp"

    if grep -q "CriticalAlertData\[\]" "$REPO.tmp"; then
      mv "$REPO.tmp" "$REPO"
      ok "deriveCriticalAlerts() → retorna CriticalAlertData[]"
    else
      rm -f "$REPO.tmp"
      fail "awk não encontrou o padrão esperado — aplicar manualmente (ver instruções abaixo)"
    fi
  fi
fi

# =============================================================================
# IMPORT — garantir que CriticalAlertData está importado no repositório
# =============================================================================
sep
log "\n${YLW}[CHECK] Import de CriticalAlertData em instagramRepository.ts${NC}"

if [ -f "$REPO" ]; then
  if grep -q "CriticalAlertData" "$REPO" && ! grep -q "import.*CriticalAlertData" "$REPO"; then
    warn "CriticalAlertData usado mas não importado — adicionando ao import existente"
    # Adiciona CriticalAlertData ao bloco de import de '../../types/instagram'
    sed -i '/^import {/,/} from "\.\.\/\.\.\/types\/instagram";/ {
      /^import {/ a\
  CriticalAlertData,
    }' "$REPO"
    ok "Import ajustado"
  else
    ok "Import já presente ou não necessário"
  fi
fi

# =============================================================================
# VERIFICAÇÃO FINAL
# =============================================================================
sep
log "\n${CYN}🔍 Verificação Final${NC}\n"

if grep -q "export type { StatusVariant } from \"./orbit\"" "$TYPE_IG" 2>/dev/null; then
  ok "StatusVariant ✓ unificado"
else
  fail "StatusVariant — aplicar manualmente (ver abaixo)"
fi

if grep -q "CriticalAlertData\[\]" "$REPO" 2>/dev/null; then
  ok "deriveCriticalAlerts ✓ retorna CriticalAlertData[]"
else
  fail "deriveCriticalAlerts — aplicar manualmente (ver abaixo)"
fi

sep
log "\n${GRN}🏁 Próximos passos:${NC}"
log "  ${CYN}npx tsc --noEmit${NC}   ← valida sem subir servidor"
log "  ${CYN}npm run dev${NC}        ← se passar"
log "\n  Backup em: ${YLW}./$BACKUP_DIR/${NC}\n"

log "\n${YLW}📋 SE ALGUMA CIRURGIA FALHOU — aplicar manualmente:${NC}\n"

cat << 'MANUAL'
─── instagram.ts — trocar a linha ───────────────────────────────────────────
DE:
  export type StatusVariant = "success" | "warning" | "danger" | "neutral";
PARA:
  export type { StatusVariant } from "./orbit";

─── instagramRepository.ts — trocar a função inteira ────────────────────────
DE:
  function deriveCriticalAlerts(kpis: KPICardData[]): string[] {
    return kpis
      .filter((k) => k.semaphore === "vermelho")
      .map(
        (k) =>
          `${k.label}: ${k.delta > 0 ? "+" : ""}${k.delta}% — intervenção necessária.`
      );
  }
PARA:
  function deriveCriticalAlerts(kpis: KPICardData[]): CriticalAlertData[] {
    return kpis
      .filter((k) => k.semaphore === "vermelho")
      .map((k) => ({
        id:       `alert-${k.id}`,
        title:    k.label,
        body:     `${k.delta > 0 ? "+" : ""}${k.delta}% vs período anterior — intervenção necessária.`,
        severity: "critical" as const,
      }));
  }

E garantir o import no topo do arquivo:
  import { ..., CriticalAlertData } from "../../types/instagram";
MANUAL