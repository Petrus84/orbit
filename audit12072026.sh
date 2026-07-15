echo "=== 1. Configuração do client Supabase (schema ativo) ===" 
cat src/lib/supabase.ts
echo ""
echo "=== 2. Onde .schema(...) é chamado (ou não é) ==="
grep -rn "\.schema(" src/ scripts/
echo ""
echo "=== 3. Repositórios implicados (conteúdo completo) ==="
for f in src/lib/repositories/clientsRepository.ts \
         src/lib/repositories/funnelRepository.ts \
         src/lib/repositories/instagramOverviewRepository.ts \
         src/lib/repositories/instagramRepository.ts \
         src/lib/repositories/metaAdsRepository.ts \
         src/lib/repositories/alertsRepository.ts \
         src/lib/repositories/avatarRepository.ts; do
  echo "--- $f ---"
  cat "$f"
  echo ""
done
echo ""
echo "=== 4. De onde cada tabela/view é lida (.from(...)) ==="
grep -rn "\.from(" src/ scripts/