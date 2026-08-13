#!/bin/bash
# ==========================================================================
# ORBIT DASHBOARD — Varredura de Tipagem e Imports
# Autor: Petruchio
# Data: $(date +%Y-%m-%d)
# ==========================================================================

OUTPUT_FILE="./type-scan-report.txt"

echo "Iniciando varredura de tipos e imports..." > "$OUTPUT_FILE"
echo "Branch atual: $(git rev-parse --abbrev-ref HEAD)" >> "$OUTPUT_FILE"
echo "Diretório: $(pwd)" >> "$OUTPUT_FILE"
echo "---------------------------------------------" >> "$OUTPUT_FILE"

# 1️⃣ Procurar imports incorretos
echo "🔍 Imports incorretos (import type usado para const):" >> "$OUTPUT_FILE"
grep -R "import type { TREND_TO_GLOW" src/ >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 2️⃣ Procurar redefinições de tipos
echo "🔍 Tipos duplicados ou redefinidos:" >> "$OUTPUT_FILE"
grep -R "export type" src/ | sort | uniq -d >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 3️⃣ Procurar interfaces de props sem correspondência com tipos globais
echo "🔍 Interfaces de Props sem correspondência com tipos globais:" >> "$OUTPUT_FILE"
grep -R "interface .*Props" src/ >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 4️⃣ Resumo final
echo "✅ Varredura concluída. Relatório salvo em $OUTPUT_FILE"
