#!/bin/bash

cd "$(dirname "$0")"

echo "════════════════════════════════════════════════════════════════"
echo "✅ VALIDAÇÃO INTELIGENTE DE IMPORTS (v2.0)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Módulos npm que devem ser ignorados
NPM_MODULES=(
  "react" "react-dom" "next" "next/link" "next/image" "next/navigation" 
  "next/font/google" "@supabase/supabase-js" "zod" "clsx" "classnames"
)

echo "📊 PASSO 1: ARQUIVOS"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) > /tmp/all_files.txt
total=$(wc -l < /tmp/all_files.txt)
echo "✅ Total: $total arquivos"
echo ""

echo "🔴 PASSO 2: DUPLICATAS REAIS (Excluindo page.tsx)"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec basename {} \; | sort | uniq -d | grep -v "^page.tsx$" > /tmp/duplicates_real.txt

if [ -s /tmp/duplicates_real.txt ]; then
  echo "❌ ENCONTRADAS:"
  while read -r dup_name; do
    echo "   📄 $dup_name"
    find src -name "$dup_name" | sed 's/^/      └─ /'
  done < /tmp/duplicates_real.txt
else
  echo "✅ Nenhuma duplicata real"
fi
echo ""

echo "🔗 PASSO 3: IMPORTS INVÁLIDOS"
invalid=0
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read -r file; do
  grep -oE "from ['\"]([^'\"]+)['\"]" "$file" 2>/dev/null | cut -d"'" -f2 | cut -d'"' -f2 | while read -r import_path; do
    skip=0
    for npm_module in "${NPM_MODULES[@]}"; do
      if [[ "$import_path" == "$npm_module" ]] || [[ "$import_path" == "$npm_module/"* ]]; then
        skip=1; break
      fi
    done
    [ "$skip" -eq 1 ] && continue
    [[ "$import_path" == *.css ]] && continue
    
    resolved_path=$(echo "$import_path" | sed "s|@/|src/|")
    
    if [ ! -f "$resolved_path.ts" ] && [ ! -f "$resolved_path.tsx" ] && \
       [ ! -f "$resolved_path.js" ] && [ ! -f "$resolved_path/index.ts" ] && \
       [ ! -f "$resolved_path/index.tsx" ] && [ ! -d "$resolved_path" ]; then
      echo "❌ $file → $import_path"
    fi
  done
done
echo ""

echo "📈 PASSO 4: TOP 10 ARQUIVOS COM MAIS IMPORTS"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read -r file; do
  imports=$(grep -c "^import\|^from" "$file" 2>/dev/null || echo 0)
  echo "$imports $file"
done | sort -rn | head -10 | while read -r count file; do
  echo "   $count imports: $file"
done
echo ""

echo "📊 RESUMO FINAL"
echo "════════════════════════════════════════════════════════════════"
total_files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l)
duplicates=$(wc -l < /tmp/duplicates_real.txt 2>/dev/null || echo 0)
echo "✅ Total de arquivos: $total_files"
echo "❌ Duplicatas reais: $duplicates"
echo "════════════════════════════════════════════════════════════════"
