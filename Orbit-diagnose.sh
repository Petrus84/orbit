#!/usr/bin/env bash
# =============================================================================
# ORBIT · Diagnóstico Cirúrgico — 5 Erros de Compilação
# Rodar em: C:/Users/DELL/Downloads/Alpha/orbit-dashboard
# Uso: bash orbit-diagnose.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
BLU='\033[0;34m'
CYN='\033[0;36m'
NC='\033[0m'

REPORT="orbit-diagnose-report.txt"
> "$REPORT"

log()  { echo -e "$1" | tee -a "$REPORT"; }
sep()  { log "\n${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
ok()   { log "  ${GRN}✅ $1${NC}"; }
warn() { log "  ${YLW}⚠️  $1${NC}"; }
fail() { log "  ${RED}❌ $1${NC}"; }
info() { log "  ${CYN}ℹ️  $1${NC}"; }

log "\n${CYN}🩺 ORBIT · Diagnóstico Cirúrgico$(date '+  %Y-%m-%d %H:%M')${NC}"
sep

# ─── Verifica se estamos na raiz do projeto ──────────────────────────────────
if [ ! -f "package.json" ]; then
  fail "Rode este script na raiz do projeto (onde está o package.json)"
  exit 1
fi
ok "Raiz do projeto confirmada: $(pwd)"

# =============================================================================
# EXAME 1 — ERRO DE PERÍODO (periodStart / periodEnd como string)
# =============================================================================
sep
log "\n${YLW}[EXAME 1] periodStart/periodEnd — string vs Date${NC}"

PAGE="src/app/instagram/page.tsx"
if [ -f "$PAGE" ]; then
  if grep -qP 'periodStart\s*=\s*"' "$PAGE"; then
    fail "String literal encontrada em periodStart — confirma Erro 1"
    grep -n 'periodStart\|periodEnd' "$PAGE" | tee -a "$REPORT"
  else
    ok "periodStart já usa Date — Erro 1 pode estar corrigido"
  fi

  # Checa se eupetruchio está incluso
  if grep -q "24140477" "$PAGE"; then
    ok "eupetruchio84 já está no page.tsx"
  else
    warn "eupetruchio84 NÃO está no page.tsx — precisa ser adicionado"
  fi
else
  fail "$PAGE não encontrado"
fi

# Exame do tipo no hook
HOOK="src/hooks/useInstagramOverview.ts"
if [ -f "$HOOK" ]; then
  log "\n  Tipo de periodStart no hook:"
  grep -n 'periodStart\|periodEnd\|Date\|string' "$HOOK" | head -10 | tee -a "$REPORT"
fi

# =============================================================================
# EXAME 2 — CONFLITO DE StatusVariant (instagram.ts vs orbit.ts)
# =============================================================================
sep
log "\n${YLW}[EXAME 2] StatusVariant — tipos duplicados em conflito${NC}"

TYPE_IG="src/types/instagram.ts"
TYPE_ORBIT="src/types/orbit.ts"

if [ -f "$TYPE_IG" ]; then
  log "\n  StatusVariant em instagram.ts:"
  grep -n 'StatusVariant' "$TYPE_IG" | tee -a "$REPORT"
else
  warn "$TYPE_IG não encontrado"
fi

if [ -f "$TYPE_ORBIT" ]; then
  log "\n  StatusVariant em orbit.ts:"
  grep -n 'StatusVariant\|statusVariant' "$TYPE_ORBIT" | tee -a "$REPORT"
else
  warn "$TYPE_ORBIT não encontrado"
fi

# Checa o que QualityScoresPanel espera
PANEL="src/components/content/QualityScoresPanel.tsx"
if [ -f "$PANEL" ]; then
  log "\n  Import de tipos em QualityScoresPanel:"
  grep -n 'import\|statusVariant\|StatusVariant' "$PANEL" | head -8 | tee -a "$REPORT"
fi

# =============================================================================
# EXAME 3 — criticalAlerts: string[] vs CriticalAlertData[]
# =============================================================================
sep
log "\n${YLW}[EXAME 3] criticalAlerts — shape do array${NC}"

REPO="src/lib/repositories/instagramRepository.ts"
if [ -f "$REPO" ]; then
  log "\n  deriveCriticalAlerts() no repositório:"
  grep -n -A5 'deriveCriticalAlerts\|criticalAlerts' "$REPO" | head -20 | tee -a "$REPORT"
fi

ALERT_COMP="src/components/content/CriticalAlert.tsx"
if [ -f "$ALERT_COMP" ]; then
  log "\n  Props de CriticalAlert.tsx:"
  grep -n 'interface\|Props\|alert\|id\|message' "$ALERT_COMP" | head -10 | tee -a "$REPORT"
fi

if [ -f "$TYPE_ORBIT" ]; then
  log "\n  CriticalAlertData em orbit.ts:"
  grep -n -A5 'CriticalAlertData\|CriticalAlert' "$TYPE_ORBIT" | head -12 | tee -a "$REPORT"
fi

# =============================================================================
# EXAME 4 — Tipo do contexto (IGOverviewData)
# =============================================================================
sep
log "\n${YLW}[EXAME 4] OrbitDashboardContext — shape exposto${NC}"

CTX="src/context/OrbitDashboardContext.tsx"
if [ -f "$CTX" ]; then
  log "\n  criticalAlerts no contexto:"
  grep -n 'criticalAlerts\|IGOverview\|data:' "$CTX" | head -10 | tee -a "$REPORT"
  log "\n  Imports de tipos no contexto:"
  grep -n '^import' "$CTX" | head -8 | tee -a "$REPORT"
fi

# =============================================================================
# EXAME 5 — Dados reais: clientes e data mínima 1970-01-01
# =============================================================================
sep
log "\n${YLW}[EXAME 5] Dados — date min 1970-01-01 detectada${NC}"
warn "kpi_snapshots tem period_start = 1970-01-01 (dados corrompidos de ingestão L0)"
info "Origem provável: ingest-l0-v2.ts linha 'period_start: today' mas posted_at era epoch 0"
info "Ação: filtrar period_start >= '2025-01-01' nas queries do repositório"

# =============================================================================
# MAPA DE IMPACTO
# =============================================================================
sep
log "\n${CYN}📋 MAPA DE IMPACTO — Ripple Effect Analysis${NC}\n"

log "  Correção 1 (periodStart como Date):"
log "    → Arquivo: $PAGE"
log "    → Sem ripple: mudança local, nenhum tipo exportado alterado"

log "\n  Correção 2 (StatusVariant unificado):"
log "    → Arquivo destino: $TYPE_ORBIT ou $TYPE_IG"
log "    → Ripple ALTO: instagramRepository.ts, QualityScoresPanel, orbit.ts"
log "    → Estratégia segura: adicionar alias em instagram.ts"
log "      export type StatusVariant = import('./orbit').StatusVariant"

log "\n  Correção 3 (criticalAlerts shape):"
log "    → Arquivo: $REPO"
log "    → Ripple MÉDIO: contexto + page.tsx consomem"
log "    → Estratégia: mudar deriveCriticalAlerts() para retornar CriticalAlertData[]"

log "\n  Correção 4 (1970-01-01 no Supabase):"
log "    → Arquivo: $REPO (adicionar .gte('period_start', '2025-01-01'))"
log "    → Sem ripple nos tipos — apenas filtro de query"
log "    → Rodar script SQL de limpeza no Supabase (ver abaixo)"

sep
log "\n${GRN}📄 Relatório salvo em: $REPORT${NC}"
log "\n${CYN}Próximo passo: compartilhe o relatório para aplicar as correções cirúrgicas${NC}\n"

# =============================================================================
# SQL DE LIMPEZA — exibir na tela para rodar manualmente no Supabase
# =============================================================================
sep
log "\n${YLW}📋 SQL para rodar no Supabase SQL Editor:${NC}\n"

cat << 'SQLEOF'
-- 1. Ver registros com data corrompida
SELECT id, client_id, metric, period_start, period_end, value
FROM kpi_snapshots
WHERE period_start < '2024-01-01'
ORDER BY period_start;

-- 2. Deletar registros com epoch zero (1970-01-01)
DELETE FROM kpi_snapshots
WHERE period_start = '1970-01-01';

-- 3. Confirmar dados restantes por cliente
SELECT
  c.name,
  COUNT(k.id) AS snapshots,
  MIN(k.period_start) AS mais_antigo,
  MAX(k.period_end)   AS mais_recente
FROM kpi_snapshots k
JOIN clients c ON c.id = k.client_id
GROUP BY c.name;
SQLEOF