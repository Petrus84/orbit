#!/bin/bash

echo "═══════════════════════════════════════════════════════"
echo "🔍 AUDITORIA FORENSE: CHAMADAS DIRETAS AO SUPABASE (UI)"
echo "═══════════════════════════════════════════════════════"

echo -e "\n1. 📱 Identificando arquivos que instanciam ou importam o cliente:"
git grep -n "from.*\/lib\/supabase" src/

echo -e "\n2. 📊 Mapeando queries diretas para tabelas consolidadas (.from):"
git grep -n "\.from('" src/

echo -e "\n3. 🚨 Caçando chamadas para as Views de Scores de Qualidade:"
git grep -n -i "v_quality_scores" src/

echo -e "\n4. 📉 Localizando referências à tabela histórica temporal (metric_history):"
git grep -n -i "metric_history" src/

echo -e "\n5. 🧩 Caçando o uso de propriedades legadas (metric_key ou value):"
git grep -n -i "metric_key" src/

echo "═══════════════════════════════════════════════════════"
echo "✅ Varredura concluída com sucesso!"
echo "═══════════════════════════════════════════════════════"
