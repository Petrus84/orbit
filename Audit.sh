#!/bin/bash

################################################################################
# 🔧 ORBIT SPRINT 3 - AUDIT POINTS (5 Scripts Unificados)
# Data: 14/06/2026 - 15:50 (São Paulo)
# Status: 🟢 PRONTO PARA EXECUÇÃO
# Versão: 1.0.0
################################################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Contadores
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

################################################################################
# FUNÇÃO: Print Header
################################################################################
print_header() {
  echo ""
  echo -e "${BLUE}================================================================================${NC}"
  echo -e "${CYAN}🔍 $1${NC}"
  echo -e "${BLUE}================================================================================${NC}"
  echo ""
}

################################################################################
# FUNÇÃO: Print Success
################################################################################
print_success() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  ((PASS_COUNT++))
}

################################################################################
# FUNÇÃO: Print Failure
################################################################################
print_failure() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  ((FAIL_COUNT++))
}

################################################################################
# FUNÇÃO: Print Warning
################################################################################
print_warning() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
  ((WARN_COUNT++))
}

################################################################################
# AUDIT POINT 1: Acoplamento Resolvido
################################################################################
audit_point_1() {
  print_header "AUDIT POINT 1: Acoplamento Resolvido (instagram/page.tsx)"
  
  echo "Verificando se instagram/page.tsx usa imports de @/components..."
  echo ""
  
  # Verificar imports diretos (devem ser 0)
  ACOPLADO_LAYOUT=$(grep -c "from '@/components/layout/" src/app/instagram/page.tsx 2>/dev/null || echo 0)
  ACOPLADO_KPI=$(grep -c "from '@/components/kpi/" src/app/instagram/page.tsx 2>/dev/null || echo 0)
  ACOPLADO_CONTENT=$(grep -c "from '@/components/content/" src/app/instagram/page.tsx 2>/dev/null || echo 0)
  ACOPLADO_COMMON=$(grep -c "from '@/components/common/" src/app/instagram/page.tsx 2>/dev/null || echo 0)
  
  TOTAL_ACOPLADO=$((ACOPLADO_LAYOUT + ACOPLADO_KPI + ACOPLADO_CONTENT + ACOPLADO_COMMON))
  
  if [ $TOTAL_ACOPLADO -eq 0 ]; then
    print_success "Sem imports diretos de componentes"
  else
    print_failure "Encontrados $TOTAL_ACOPLADO imports diretos:"
    echo "  - Layout: $ACOPLADO_LAYOUT"
    echo "  - KPI: $ACOPLADO_KPI"
    echo "  - Content: $ACOPLADO_CONTENT"
    echo "  - Common: $ACOPLADO_COMMON"
  fi
  
  # Verificar se usa imports de @/components
  DESACOPLADO=$(grep -c "from '@/components'" src/app/instagram/page.tsx 2>/dev/null || echo 0)
  
  if [ $DESACOPLADO -gt 0 ]; then
    print_success "Usando imports de @/components ($DESACOPLADO)"
  else
    if [ $TOTAL_ACOPLADO -eq 0 ]; then
      print_warning "Nenhum import de @/components encontrado (verifique manualmente)"
    else
      print_failure "Não encontrados imports de @/components"
    fi
  fi
  
  # Verificar se arquivo index.ts existe
  if [ -f "src/components/index.ts" ]; then
    print_success "Arquivo src/components/index.ts existe"
  else
    print_failure "Arquivo src/components/index.ts NÃO existe"
  fi
  
  echo ""
}

################################################################################
# AUDIT POINT 2: Tokens CSS Completos
################################################################################
audit_point_2() {
  print_header "AUDIT POINT 2: Tokens CSS Completos (41 tokens esperados)"
  
  echo "Verificando tokens em src/styles/orbit-design-tokens.css..."
  echo ""
  
  # Array de tokens esperados
  TOKENS_ESPERADOS=(
    "bg-base" "bg-primary" "bg-card" "bg-hover" "bg-active"
    "border-default" "border-glow-cyan" "border-glow-red" "border-glow-gold"
    "text-primary" "text-secondary" "text-muted" "text-dim"
    "neon-cyan" "neon-red" "neon-gold" "neon-green"
    "font-size-xs" "font-size-sm" "font-size-base" "font-size-lg" "font-size-xl" "font-size-2xl" "font-size-3xl" "font-size-4xl"
    "space-1" "space-2" "space-3" "space-4" "space-5" "space-6" "space-8" "space-10" "space-12"
    "shadow-inner-cyan" "shadow-inner-red" "shadow-inner-gold"
    "shadow-outer-sm" "shadow-outer-md" "shadow-outer-lg"
    "transition-fast" "transition-base" "transition-slow"
  )
  
  ENCONTRADOS=0
  NENHUM=0
  
  for TOKEN in "${TOKENS_ESPERADOS[@]}"; do
    if grep -q "\-\-$TOKEN" src/styles/orbit-design-tokens.css 2>/dev/null; then
      ((ENCONTRADOS++))
    else
      if [ $NENHUM -lt 5 ]; then
        echo "  ❌ Token não encontrado: --$TOKEN"
      fi
      ((NENHUM++))
    fi
  done
  
  TOTAL=${#TOKENS_ESPERADOS[@]}
  PERCENTUAL=$((ENCONTRADOS * 100 / TOTAL))
  
  echo ""
  echo "Resultado: $ENCONTRADOS/$TOTAL tokens encontrados ($PERCENTUAL%)"
  
  if [ $ENCONTRADOS -eq $TOTAL ]; then
    print_success "Todos os tokens definidos"
  elif [ $ENCONTRADOS -ge 35 ]; then
    print_warning "Faltam $(($TOTAL - $ENCONTRADOS)) tokens"
  else
    print_failure "Faltam $(($TOTAL - $ENCONTRADOS)) tokens"
  fi
  
  echo ""
}

################################################################################
# AUDIT POINT 3: Memoização Implementada
################################################################################
audit_point_3() {
  print_header "AUDIT POINT 3: Memoização Implementada (4 componentes)"
  
  echo "Verificando React.memo em componentes críticos..."
  echo ""
  
  COMPONENTES=(
    "src/components/content/FormatPerformanceTable.tsx"
    "src/components/content/QualityScoresPanel.tsx"
    "src/components/layout/Header.tsx"
    "src/components/layout/Sidebar.tsx"
  )
  
  MEMOIZADOS=0
  
  for COMPONENTE in "${COMPONENTES[@]}"; do
    if [ -f "$COMPONENTE" ]; then
      if grep -q "React.memo" "$COMPONENTE"; then
        print_success "$COMPONENTE: Memoizado"
        ((MEMOIZADOS++))
      else
        print_failure "$COMPONENTE: NÃO memoizado"
      fi
    else
      print_failure "$COMPONENTE: Arquivo não encontrado"
    fi
  done
  
  echo ""
  echo "Resultado: $MEMOIZADOS/4 componentes memoizados"
  
  if [ $MEMOIZADOS -eq 4 ]; then
    print_success "Todos os componentes memoizados"
  else
    print_warning "Faltam $((4 - $MEMOIZADOS)) componentes"
  fi
  
  echo ""
}

################################################################################
# AUDIT POINT 4: Glow Effects Implementados
################################################################################
audit_point_4() {
  print_header "AUDIT POINT 4: Glow Effects Implementados"
  
  echo "Verificando glow effects em CSS..."
  echo ""
  
  # Procurar por text-shadow com glow
  TEXT_SHADOW=$(grep -r "text-shadow.*0 0 10px" src/components/ 2>/dev/null | wc -l)
  
  # Procurar por box-shadow com inset
  BOX_SHADOW=$(grep -r "box-shadow.*inset 0 0" src/components/ 2>/dev/null | wc -l)
  
  # Procurar por neon glow genérico
  NEON_GLOW=$(grep -r "0 0 10px\|0 0 20px" src/components/ 2>/dev/null | wc -l)
  
  echo "Text-shadow com glow: $TEXT_SHADOW"
  echo "Box-shadow com inset: $BOX_SHADOW"
  echo "Neon glow genérico: $NEON_GLOW"
  echo ""
  
  if [ $TEXT_SHADOW -gt 0 ] && [ $BOX_SHADOW -gt 0 ]; then
    print_success "Glow effects implementados"
  elif [ $NEON_GLOW -gt 0 ]; then
    print_warning "Alguns glow effects encontrados ($NEON_GLOW)"
  else
    print_failure "Nenhum glow effect encontrado"
  fi
  
  echo ""
}

################################################################################
# AUDIT POINT 5: Testes Implementados
################################################################################
audit_point_5() {
  print_header "AUDIT POINT 5: Testes Implementados (80%+ cobertura)"
  
  echo "Verificando arquivos de teste..."
  echo ""
  
  TESTES_ESPERADOS=(
    "src/components/kpi/KPICard.test.tsx"
    "src/components/common/GlassCard.test.tsx"
    "src/hooks/useInstagramOverview.test.ts"
    "src/repositories/instagramOverviewRepository.test.ts"
  )
  
  TESTES_ENCONTRADOS=0
  
  for TESTE in "${TESTES_ESPERADOS[@]}"; do
    if [ -f "$TESTE" ]; then
      print_success "$TESTE: Existe"
      ((TESTES_ENCONTRADOS++))
    else
      print_failure "$TESTE: NÃO existe"
    fi
  done
  
  echo ""
  echo "Resultado: $TESTES_ENCONTRADOS/4 testes encontrados"
  
  # Verificar se Vitest está instalado
  if grep -q "vitest" package.json 2>/dev/null; then
    print_success "Vitest instalado"
  else
    print_warning "Vitest NÃO instalado (execute: npm install -D vitest)"
  fi
  
  # Tentar rodar testes
  echo ""
  echo "Tentando executar testes..."
  if npm run test:coverage 2>/dev/null | grep -q "%"; then
    COBERTURA=$(npm run test:coverage 2>&1 | grep -oP '\d+(?=%)' | head -1)
    echo "Cobertura de testes: $COBERTURA%"
    
    if [ "$COBERTURA" -ge 80 ]; then
      print_success "Cobertura $COBERTURA% (≥80%)"
    else
      print_warning "Cobertura $COBERTURA% (<80%)"
    fi
  else
    print_warning "Não foi possível executar testes (Vitest não configurado)"
  fi
  
  echo ""
}

################################################################################
# RESUMO FINAL
################################################################################
print_summary() {
  print_header "RESUMO FINAL"
  
  TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
  
  echo -e "Total de verificações: $TOTAL"
  echo -e "${GREEN}✅ PASS: $PASS_COUNT${NC}"
  echo -e "${RED}❌ FAIL: $FAIL_COUNT${NC}"
  echo -e "${YELLOW}⚠️  WARN: $WARN_COUNT${NC}"
  echo ""
  
  if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 AUDITORIA COMPLETA - SEM FALHAS!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Revisar warnings (se houver)"
    echo "2. Executar: npm run build"
    echo "3. Executar: npm run dev"
    echo "4. Validar visualmente no navegador"
    return 0
  else
    echo -e "${RED}⚠️  AUDITORIA COM FALHAS - Revisar acima${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Corrigir falhas identificadas"
    echo "2. Re-executar: ./audit.sh"
    return 1
  fi
}

################################################################################
# MAIN: Executar todos os audit points
################################################################################
main() {
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║         🔧 ORBIT SPRINT 3 - AUDIT POINTS (5 Scripts Unificados)           ║${NC}"
  echo -e "${CYAN}║                    Data: 14/06/2026 - 15:50 (São Paulo)                   ║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  # Verificar se estamos no diretório correto
  if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ ERRO: package.json não encontrado${NC}"
    echo "Execute este script na raiz do projeto:"
    echo "  cd ~/Downloads/Alpha/orbit-dashboard"
    echo "  ./audit.sh"
    exit 1
  fi
  
  # Executar todos os audit points
  audit_point_1
  audit_point_2
  audit_point_3
  audit_point_4
  audit_point_5
  
  # Imprimir resumo
  print_summary
  
  exit $?
}