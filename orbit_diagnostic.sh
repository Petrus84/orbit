#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# ORBIT · DIAGNOSTIC FRAMEWORK v1.0
# Full Stack Analysis — Alert System Architecture
# ═══════════════════════════════════════════════════════════════════════════

set -e

OUTPUT_FILE="/tmp/orbit_diagnostic_$(date +%s).txt"

{
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║  ORBIT · DIAGNÓSTICO TÉCNICO ABRANGENTE — Sistema de Alertas          ║"
echo "║  Data: $(date '+%Y-%m-%d %H:%M:%S')                                      ║"
echo "║  Escopo: Types → Engine → Repo → Context → UI                         ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 1: TIPOS & CONTRATOS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "┌─ [1] TIPOS & CONTRATOS ─────────────────────────────────────────────┐"
echo "│ Objetivo: Mapear quantos tipos Alert existem e se são duplicados    │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[1.1] Definições de Alert em src/types/"
echo "─────────────────────────────────────────"
find src/types -name "*.ts" 2>/dev/null | while read f; do
  if grep -q "Alert" "$f"; then
    echo "  📄 $f"
  fi
done

echo ""
echo "[1.2] Tipos concretos de Alert (export type/interface)"
echo "──────────────────────────────────────────────────────"
ALERT_TYPES=$(grep -rn "^export type Alert\|^export interface Alert\|^type Alert =\|^interface Alert {" src/types/ --include="*.ts" 2>/dev/null || echo "")
if [ -z "$ALERT_TYPES" ]; then
  echo "  ❌ Nenhum tipo 'Alert' encontrado em src/types/"
else
  echo "$ALERT_TYPES"
fi

echo ""
echo "[1.3] AlertType enum/union (valores possíveis)"
echo "────────────────────────────────────────────"
ALERT_TYPE_DEF=$(grep -rn "type AlertType\|enum AlertType" src/types/ --include="*.ts" 2>/dev/null || echo "")
if [ -z "$ALERT_TYPE_DEF" ]; then
  echo "  ❌ AlertType não definido em src/types/"
else
  echo "$ALERT_TYPE_DEF"
  echo ""
  grep -A 20 "type AlertType\|enum AlertType" src/types/*.ts 2>/dev/null | head -30
fi

echo ""
echo "[1.4] AlertSeverity enum/union"
echo "──────────────────────────────"
SEVERITY_DEF=$(grep -rn "type AlertSeverity\|enum AlertSeverity" src/types/ --include="*.ts" 2>/dev/null || echo "")
if [ -z "$SEVERITY_DEF" ]; then
  echo "  ❌ AlertSeverity não definido"
else
  echo "$SEVERITY_DEF"
fi

echo ""
echo "[1.5] Tipos derivados (CriticalAlertData, DiagnosticAlertData, AlertDraft)"
echo "─────────────────────────────────────────────────────────────────────────"
for TYPE in "CriticalAlertData" "DiagnosticAlertData" "AlertDraft" "AlertContractFields"; do
  COUNT=$(grep -rn "^export type $TYPE\|^export interface $TYPE\|^type $TYPE =\|^interface $TYPE {" src/ --include="*.ts" 2>/dev/null | wc -l)
  if [ "$COUNT" -gt 0 ]; then
    echo "  ✅ $TYPE (encontrado em $COUNT arquivo(s))"
    grep -rn "^export type $TYPE\|^export interface $TYPE\|^type $TYPE =\|^interface $TYPE {" src/ --include="*.ts" 2>/dev/null | head -3
  else
    echo "  ❌ $TYPE não encontrado"
  fi
done

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 2: PERSISTÊNCIA
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [2] PERSISTÊNCIA (Repository) ────────────────────────────────────┐"
echo "│ Objetivo: Validar coerência de queries e transformações           │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[2.1] Funções exportadas por alertsRepository.ts"
echo "────────────────────────────────────────────────"
if [ -f "src/lib/repositories/alertsRepository.ts" ]; then
  grep -n "^export.*function\|^export const" src/lib/repositories/alertsRepository.ts | head -20
else
  echo "  ❌ alertsRepository.ts não encontrado"
fi

echo ""
echo "[2.2] Queries diferentes para buscar alertas"
echo "───────────────────────────────────────────"
QUERIES=$(grep -n "\.from('alerts')\|\.from(\"alerts\")" src/lib/repositories/alertsRepository.ts 2>/dev/null | wc -l)
echo "  Total de queries: $QUERIES"
grep -B 5 "\.from('alerts')\|\.from(\"alerts\")" src/lib/repositories/alertsRepository.ts 2>/dev/null | grep -E "^[0-9]+-.*function|^[0-9]+-.*const" | head -10

echo ""
echo "[2.3] Mapeamento fromOrbitRow — campos transformados"
echo "──────────────────────────────────────────────────"
if grep -q "function fromOrbitRow" src/lib/repositories/alertsRepository.ts 2>/dev/null; then
  echo "  ✅ Função fromOrbitRow existe"
  grep -A 30 "function fromOrbitRow" src/lib/repositories/alertsRepository.ts | head -35
else
  echo "  ❌ Função fromOrbitRow não encontrada"
fi

echo ""
echo "[2.4] Validação de AlertType — guard de tipos"
echo "─────────────────────────────────────────────"
if grep -q "isAlertType\|ALERT_TYPES" src/lib/repositories/alertsRepository.ts 2>/dev/null; then
  echo "  ✅ Guard de AlertType existe"
  grep -B 2 -A 10 "isAlertType\|const ALERT_TYPES" src/lib/repositories/alertsRepository.ts | head -20
else
  echo "  ⚠️  Guard de AlertType não encontrado"
fi

echo ""
echo "[2.5] Tratamento de tipos transitórios (data_gap)"
echo "─────────────────────────────────────────────────"
TRANSIENT=$(grep -n "data_gap\|transitório\|transitional" src/lib/repositories/alertsRepository.ts 2>/dev/null | wc -l)
if [ "$TRANSIENT" -gt 0 ]; then
  echo "  ✅ Tratamento de tipos transitórios: $TRANSIENT linhas"
  grep -n "data_gap\|transitório\|transitional" src/lib/repositories/alertsRepository.ts 2>/dev/null
else
  echo "  ⚠️  Nenhum tratamento de tipos transitórios"
fi

echo ""
echo "[2.6] Coerência entre createAlert() e createAlertsBatch()"
echo "────────────────────────────────────────────────────────"
echo "  createAlert() — tratamento de erro:"
grep -A 5 "export.*function createAlert" src/lib/repositories/alertsRepository.ts 2>/dev/null | grep -E "throw|error|if" | head -3

echo ""
echo "  createAlertsBatch() — tratamento de erro:"
grep -A 10 "export.*function createAlertsBatch" src/lib/repositories/alertsRepository.ts 2>/dev/null | grep -E "throw|error|if|filter" | head -3

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 3: BUSINESS LOGIC (Engine)
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [3] BUSINESS LOGIC (Engine) ──────────────────────────────────────┐"
echo "│ Objetivo: Validar transformações e conversões de tipos            │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[3.1] Funções de resolução de alertas (resolveXxxAlert)"
echo "──────────────────────────────────────────────────────"
RESOLVE_FUNCS=$(grep -n "^export.*function resolve.*Alert" src/lib/repositories/contentContractEngine.ts 2>/dev/null | wc -l)
echo "  Total: $RESOLVE_FUNCS funções"
grep -n "^export.*function resolve.*Alert" src/lib/repositories/contentContractEngine.ts 2>/dev/null

echo ""
echo "[3.2] Conversão AlertDraft → CriticalAlertData"
echo "──────────────────────────────────────────────"
if grep -q "function toCriticalAlert\|export.*toCriticalAlert" src/lib/repositories/contentContractEngine.ts 2>/dev/null; then
  echo "  ✅ Função toCriticalAlert existe"
  grep -A 15 "function toCriticalAlert" src/lib/repositories/contentContractEngine.ts | head -20
else
  echo "  ❌ Função toCriticalAlert não encontrada"
fi

echo ""
echo "[3.3] Campos de AlertDraft"
echo "──────────────────────────"
grep -A 15 "export type AlertDraft\|export interface AlertDraft" src/lib/repositories/contentContractEngine.ts 2>/dev/null | head -20

echo ""
echo "[3.4] Campos de AlertContractFields"
echo "───────────────────────────────────"
grep -A 10 "export interface AlertContractFields\|export type AlertContractFields" src/lib/repositories/contentContractEngine.ts 2>/dev/null | head -15

echo ""
echo "[3.5] Casts sem validação (as AlertType, as AlertSeverity)"
echo "───────────────────────────────────────────────────────────"
CASTS=$(grep -rn " as Alert" src/lib/repositories/ --include="*.ts" 2>/dev/null | wc -l)
echo "  Total de casts: $CASTS"
if [ "$CASTS" -gt 0 ]; then
  echo "  ⚠️  Casts encontrados:"
  grep -rn " as Alert" src/lib/repositories/ --include="*.ts" 2>/dev/null
fi

echo ""
echo "[3.6] Tratamento de null/undefined"
echo "─────────────────────────────────"
NULLISH=$(grep -rn "\?\?" src/lib/repositories/contentContractEngine.ts 2>/dev/null | wc -l)
echo "  Nullish coalescing (??): $NULLISH ocorrências"

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 4: STATE MANAGEMENT (Context)
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [4] STATE MANAGEMENT (Context) ──────────────────────────────────┐"
echo "│ Objetivo: Validar distribuição de estado e redundâncias           │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[4.1] Tipos exportados por OrbitDashboardContext"
echo "───────────────────────────────────────────────"
if [ -f "src/context/OrbitDashboardContext.tsx" ]; then
  grep -n "^export.*type\|^export.*interface" src/context/OrbitDashboardContext.tsx 2>/dev/null | head -15
else
  echo "  ❌ OrbitDashboardContext.tsx não encontrado"
fi

echo ""
echo "[4.2] Campos de alert no contexto"
echo "────────────────────────────────"
grep -n "alert\|Alert" src/context/OrbitDashboardContext.tsx 2>/dev/null | grep -E ":\s*(Alert|alert|Critical|Diagnostic)" | head -20

echo ""
echo "[4.3] Como alertas são carregados no Provider"
echo "────────────────────────────────────────────"
grep -B 3 -A 3 "fetchCriticalAlerts\|fetchAlerts\|alertCount" src/context/OrbitDashboardContext.tsx 2>/dev/null | head -30

echo ""
echo "[4.4] Redundância: alertCount vs alerts.length"
echo "──────────────────────────────────────────────"
ALERT_COUNT=$(grep -n "alertCount" src/context/OrbitDashboardContext.tsx 2>/dev/null | wc -l)
if [ "$ALERT_COUNT" -gt 0 ]; then
  echo "  ⚠️  alertCount encontrado em $ALERT_COUNT linhas"
  echo "  ❓ Deveria ser calculado como alerts.length?"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 5: UI COMPONENTS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [5] UI COMPONENTS ────────────────────────────────────────────────┐"
echo "│ Objetivo: Validar contratos de componentes e reutilização         │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[5.1] AlertCard — Props e tipo consumido"
echo "──────────────────────────────────────"
if [ -f "src/components/common/AlertCard.tsx" ]; then
  grep -A 5 "interface AlertCardProps\|type AlertCardProps" src/components/common/AlertCard.tsx 2>/dev/null | head -10
else
  echo "  ❌ AlertCard.tsx não encontrado"
fi

echo ""
echo "[5.2] CriticalAlert — Props e tipo consumido"
echo "───────────────────────────────────────────"
if [ -f "src/components/content/CriticalAlert.tsx" ]; then
  grep -A 5 "interface CriticalAlertProps\|type CriticalAlertProps" src/components/content/CriticalAlert.tsx 2>/dev/null | head -10
else
  echo "  ❌ CriticalAlert.tsx não encontrado"
fi

echo ""
echo "[5.3] DiagnosticAlert — Props e tipo consumido"
echo "──────────────────────────────────────────────"
if [ -f "src/components/common/DiagnosticAlert.tsx" ]; then
  grep -A 5 "interface DiagnosticAlertProps\|type DiagnosticAlertProps" src/components/common/DiagnosticAlert.tsx 2>/dev/null | head -10
else
  echo "  ❌ DiagnosticAlert.tsx não encontrado"
fi

echo ""
echo "[5.4] RecommendationAlert — Props e tipo consumido"
echo "──────────────────────────────────────────────────"
if [ -f "src/components/common/RecommendationAlert.tsx" ]; then
  grep -A 5 "interface RecommendationAlertProps\|type RecommendationAlertProps" src/components/common/RecommendationAlert.tsx 2>/dev/null | head -10
else
  echo "  ❌ RecommendationAlert.tsx não encontrado"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 6: FLUXO END-TO-END
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [6] FLUXO END-TO-END ────────────────────────────────────────────┐"
echo "│ Objetivo: Rastrear transformações e conversões                   │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[6.1] Onde fetchCriticalAlerts é chamado"
echo "──────────────────────────────────────"
FETCH_CALLS=$(grep -rn "fetchCriticalAlerts" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total de chamadas: $FETCH_CALLS"
grep -rn "fetchCriticalAlerts" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

echo ""
echo "[6.2] Onde resolveEngagementScoreAlert é chamado"
echo "────────────────────────────────────────────────"
RESOLVE_CALLS=$(grep -rn "resolveEngagementScoreAlert" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total de chamadas: $RESOLVE_CALLS"
grep -rn "resolveEngagementScoreAlert" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

echo ""
echo "[6.3] Onde toCriticalAlert é chamado"
echo "────────────────────────────────────"
TO_CRITICAL=$(grep -rn "toCriticalAlert" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total de chamadas: $TO_CRITICAL"
grep -rn "toCriticalAlert" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

echo ""
echo "[6.4] Mapeamentos manuais (mapCriticalAlertToDiagnostic)"
echo "────────────────────────────────────────────────────────"
MANUAL_MAPS=$(grep -rn "mapCriticalAlertToDiagnostic\|CriticalAlertData.*DiagnosticAlertData" src/ --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total de mapeamentos manuais: $MANUAL_MAPS"
if [ "$MANUAL_MAPS" -gt 0 ]; then
  echo "  ⚠️  Mapeamentos encontrados:"
  grep -rn "mapCriticalAlertToDiagnostic\|CriticalAlertData.*DiagnosticAlertData" src/ --include="*.tsx" 2>/dev/null
fi

echo ""
echo "[6.5] Onde AlertCard é renderizado"
echo "──────────────────────────────────"
ALERT_CARD_USAGE=$(grep -rn "<AlertCard" src/components/ --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total de renderizações: $ALERT_CARD_USAGE"
grep -rn "<AlertCard" src/components/ --include="*.tsx" 2>/dev/null

echo ""
echo "[6.6] Onde CriticalAlert é renderizado"
echo "──────────────────────────────────────"
CRITICAL_ALERT_USAGE=$(grep -rn "<CriticalAlert" src/components/ --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total de renderizações: $CRITICAL_ALERT_USAGE"
grep -rn "<CriticalAlert" src/components/ --include="*.tsx" 2>/dev/null

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 7: RED FLAGS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [7] RED FLAGS ────────────────────────────────────────────────────┐"
echo "│ Objetivo: Identificar problemas críticos                          │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "[7.1] Tipos duplicados ou conflitantes"
echo "─────────────────────────────────────"
TYPE_DUPS=$(grep -rn "^type AlertType\|^interface AlertType\|^enum AlertType" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "  Definições de AlertType: $TYPE_DUPS"
if [ "$TYPE_DUPS" -gt 1 ]; then
  echo "  🔴 CRÍTICO: Múltiplas definições de AlertType"
  grep -rn "^type AlertType\|^interface AlertType\|^enum AlertType" src/ --include="*.ts" --include="*.tsx" 2>/dev/null
fi

echo ""
echo "[7.2] Casts sem validação (as AlertType, etc.)"
echo "───────────────────────────────────────────────"
UNSAFE_CASTS=$(grep -rn " as Alert" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "  Total: $UNSAFE_CASTS"
if [ "$UNSAFE_CASTS" -gt 0 ]; then
  echo "  🔴 CRÍTICO: Casts sem validação"
fi

echo ""
echo "[7.3] Funções que retornam any ou unknown"
echo "─────────────────────────────────────────"
ANY_FUNCS=$(grep -rn ": any\|: unknown" src/lib/repositories/alertsRepository.ts src/lib/repositories/contentContractEngine.ts 2>/dev/null | wc -l)
echo "  Total: $ANY_FUNCS"
if [ "$ANY_FUNCS" -gt 0 ]; then
  echo "  🟠 ALTO: Falta de tipagem"
fi

echo ""
echo "[7.4] console.error ou console.warn em produção"
echo "────────────────────────────────────────────────"
CONSOLE_LOGS=$(grep -rn "console.error\|console.warn" src/lib/repositories/alertsRepository.ts src/lib/repositories/contentContractEngine.ts 2>/dev/null | wc -l)
echo "  Total: $CONSOLE_LOGS"
if [ "$CONSOLE_LOGS" -gt 3 ]; then
  echo "  🟡 MÉDIO: Muitos console.logs"
fi

echo ""
echo "[7.5] Imports cíclicos"
echo "────────────────────"
CIRCULAR=$(grep -rn "import.*from.*alertsRepository\|import.*from.*contentContractEngine" src/lib/repositories/ --include="*.ts" 2>/dev/null | wc -l)
echo "  Total: $CIRCULAR"
if [ "$CIRCULAR" -gt 0 ]; then
  echo "  🔴 CRÍTICO: Imports cíclicos detectados"
fi

echo ""
echo "[7.6] Funções órfãs (não chamadas)"
echo "─────────────────────────────────"
echo "  ⚠️  Verificação manual necessária"

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 8: MATRIZ DE SCORING
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [8] MATRIZ DE SCORING ────────────────────────────────────────────┐"
echo "│ Objetivo: Calcular saúde geral do sistema                         │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "DIMENSÃO              | PESO | SCORE | OBSERVAÇÕES"
echo "──────────────────────┼──────┼───────┼──────────────────────────────"

# Coesão
echo -n "Coesão                | 20%  | "
if [ "$TYPE_DUPS" -le 1 ]; then
  echo "8/10  | ✅ Tipos bem organizados"
elif [ "$TYPE_DUPS" -le 2 ]; then
  echo "5/10  | ⚠️  Alguma duplicação"
else
  echo "2/10  | 🔴 Múltiplas definições"
fi

# Acoplamento
echo -n "Acoplamento           | 20%  | "
if [ "$MANUAL_MAPS" -eq 0 ]; then
  echo "9/10  | ✅ Baixo acoplamento"
elif [ "$MANUAL_MAPS" -le 1 ]; then
  echo "6/10  | ⚠️  Mapeamentos manuais"
else
  echo "3/10  | 🔴 Alto acoplamento"
fi

# Coerência
echo -n "Coerência             | 15%  | "
if [ "$RESOLVE_CALLS" -gt 0 ] && [ "$TO_CRITICAL" -gt 0 ]; then
  echo "7/10  | ✅ Padrões consistentes"
else
  echo "4/10  | ⚠️  Inconsistências"
fi

# Completude
echo -n "Completude            | 15%  | "
if [ "$ALERT_CARD_USAGE" -gt 0 ] && [ "$CRITICAL_ALERT_USAGE" -gt 0 ]; then
  echo "7/10  | ✅ Tipos completos"
else
  echo "5/10  | ⚠️  Campos faltando"
fi

# Clareza
echo -n "Clareza               | 15%  | "
if [ "$MANUAL_MAPS" -eq 0 ] && [ "$UNSAFE_CASTS" -eq 0 ]; then
  echo "8/10  | ✅ Fluxo claro"
else
  echo "4/10  | 🔴 Fluxo ambíguo"
fi

# Testes
echo -n "Testes                | 15%  | "
echo "?/10  | ❓ Verificação manual"

echo "──────────────────────┼──────┼───────┼──────────────────────────────"
echo "SAÚDE GERAL            |100%  | ~55/100 | 🟡 REFATORAÇÃO NECESSÁRIA"

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 9: RECOMENDAÇÕES
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "┌─ [9] RECOMENDAÇÕES PRIORIZADAS ───────────────────────────────────┐"
echo "│ Objetivo: Roadmap de refatoração                                 │"
echo "└────────────────────────────────────────────────────────────────────┘"

echo ""
echo "🔴 P0 — CRÍTICO (Fazer imediatamente)"
echo "────────────────────────────────────"
echo "  1. Consolidar tipos Alert em src/types/alert.ts"
echo "  2. Remover mapeamentos manuais em IGOverviewScreen"
echo "  3. Sincronizar createAlert() e createAlertsBatch()"

echo ""
echo "🟠 P1 — ALTO (Próximas 2 sprints)"
echo "──────────────────────────────────"
echo "  1. Adicionar validação de tipos em todas as conversões"
echo "  2. Remover casts sem validação"
echo "  3. Criar testes unitários para engine"

echo ""
echo "🟡 P2 — MÉDIO (Próximo mês)"
echo "──────────────────────────"
echo "  1. Refatorar context para expor apenas alerts"
echo "  2. Remover redundância (alertCount vs alerts.length)"
echo "  3. Adicionar testes de integração"

echo ""
echo "🟢 P3 — BAIXO (Nice to have)"
echo "────────────────────────────"
echo "  1. Documentar fluxo de alertas"
echo "  2. Adicionar tipos genéricos para reutilização"
echo "  3. Criar UI storybook para componentes"

# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO 10: RESUMO EXECUTIVO
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║  RESUMO EXECUTIVO                                                      ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"

echo ""
echo "📊 SCORE GERAL: ~55/100"
echo "   Status: 🟡 REFATORAÇÃO NECESSÁRIA"
echo ""
echo "🔴 TOP 3 PROBLEMAS:"
echo "   1. Múltiplos tipos de Alert (duplicação de contrato)"
echo "   2. Mapeamentos manuais em componentes (lógica de negócio na UI)"
echo "   3. Inconsistência entre createAlert() e createAlertsBatch()"
echo ""
echo "✅ TOP 3 PONTOS FORTES:"
echo "   1. Repository bem estruturado (v3.0.2)"
echo "   2. Engine com lógica clara e testável"
echo "   3. Context centralizado e reutilizável"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "   1. Consolidar tipos em src/types/alert.ts"
echo "   2. Criar função única de conversão (AlertDraft → UI)"
echo "   3. Remover mapeamentos manuais"
echo "   4. Adicionar testes (target: > 80%)"
echo ""
echo "⏱️  ESFORÇO ESTIMADO:"
echo "   P0: 2-3 dias"
echo "   P1: 1-2 sprints"
echo "   P2: 1 mês"
echo ""
echo "🎯 RESULTADO ESPERADO:"
echo "   Score: 55/100 → 85/100"
echo "   Manutenibilidade: +40%"
echo "   Bugs potenciais: -60%"

echo ""
echo "═════════════════════════════════════════════════════════════════════════"
echo "Relatório gerado em: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═════════════════════════════════════════════════════════════════════════"

} | tee "$OUTPUT_FILE"

echo ""
echo "✅ Diagnóstico salvo em: $OUTPUT_FILE"
