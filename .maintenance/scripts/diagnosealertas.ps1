# ============================================================================
# DIAGNÓSTICO GIT PARA ALERTAS - ORBIT DASHBOARD
# Nome: diagnose-alertas.ps1
# Uso: .\diagnose-alertas.ps1
# ============================================================================

Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              DIAGNÓSTICO GIT: SISTEMA DE ALERTAS                             ║" -ForegroundColor Cyan
Write-Host "║                    (Petrus - Orbit Dashboard)                                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n[1/10] Verificando status do repositório..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
git status
Write-Host ""

Write-Host "[2/10] Verificando branch atual..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
git branch -v
Write-Host ""

Write-Host "[3/10] Listando todas as branches..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
git branch -a
Write-Host ""

Write-Host "[4/10] Procurando arquivos de alertas no repositório..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$alertFiles = git ls-files | Select-String -Pattern "alert" -AllMatches
if ($alertFiles) {
    Write-Host "✓ Arquivos encontrados:" -ForegroundColor Green
    $alertFiles | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "✗ NENHUM arquivo de alertas encontrado!" -ForegroundColor Red
}
Write-Host ""

Write-Host "[5/10] Verificando histórico de commits para alertas..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$history = git log --oneline --all -- "src/app/alertas/" 2>$null | Select-Object -First 5
if ($history) {
    Write-Host "✓ Histórico encontrado:" -ForegroundColor Green
    $history | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "✗ Nenhum histórico encontrado para src/app/alertas/" -ForegroundColor Red
}
Write-Host ""

Write-Host "[6/10] Verificando conteúdo atual do arquivo alertas/page.tsx..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$content = git show HEAD:src/app/alertas/page.tsx 2>$null
if ($content) {
    Write-Host "✓ Arquivo encontrado no HEAD. Primeiras 30 linhas:" -ForegroundColor Green
    $content | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "✗ Arquivo não encontrado em HEAD:src/app/alertas/page.tsx" -ForegroundColor Red
}
Write-Host ""

Write-Host "[7/10] Verificando diferenças não commitadas..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$diff = git diff --stat
if ($diff) {
    Write-Host "✓ Mudanças encontradas:" -ForegroundColor Green
    $diff | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "✓ Nenhuma mudança não commitada" -ForegroundColor Green
}
Write-Host ""

Write-Host "[8/10] Verificando staging area..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$staged = git diff --cached --stat
if ($staged) {
    Write-Host "✓ Mudanças staged encontradas:" -ForegroundColor Green
    $staged | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "✓ Nada staged" -ForegroundColor Green
}
Write-Host ""

Write-Host "[9/10] Verificando se alertas está sendo ignorado por .gitignore..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$ignored = git check-ignore -v "src/app/alertas/page.tsx" 2>$null
if ($ignored) {
    Write-Host "✗ ARQUIVO ESTÁ SENDO IGNORADO!" -ForegroundColor Red
    Write-Host "  Regra: $ignored" -ForegroundColor Red
} else {
    Write-Host "✓ Arquivo NÃO está sendo ignorado" -ForegroundColor Green
}
Write-Host ""

Write-Host "[10/10] Verificando conflitos não resolvidos..." -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Gray
$conflicts = git diff --name-only --diff-filter=U
if ($conflicts) {
    Write-Host "✗ CONFLITOS ENCONTRADOS:" -ForegroundColor Red
    $conflicts | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
} else {
    Write-Host "✓ Nenhum conflito" -ForegroundColor Green
}
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "RESUMO DO DIAGNÓSTICO" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host "`nPróximos passos:" -ForegroundColor Yellow
Write-Host "1. Se arquivos de alertas estão FALTANDO → execute:" -ForegroundColor White
Write-Host "   git add src/app/alertas/" -ForegroundColor Gray
Write-Host "   git add src/hooks/useAlerts.ts" -ForegroundColor Gray
Write-Host "   git add src/components/screens/AlertasScreen.tsx" -ForegroundColor Gray
Write-Host "   git add src/lib/repositories/alertsRepository.ts" -ForegroundColor Gray
Write-Host "   git add src/types/alert.ts" -ForegroundColor Gray
Write-Host "   git commit -m 'feat: adicionar sistema de alertas'" -ForegroundColor Gray
Write-Host "   git push origin main" -ForegroundColor Gray

Write-Host "`n2. Se arquivo está VAZIO → execute:" -ForegroundColor White
Write-Host "   git log -p -- src/app/alertas/page.tsx | head -100" -ForegroundColor Gray

Write-Host "`n3. Se está em BRANCH DIFERENTE → execute:" -ForegroundColor White
Write-Host "   git branch -a" -ForegroundColor Gray
Write-Host "   git checkout main" -ForegroundColor Gray
Write-Host "   git merge feature/alertas" -ForegroundColor Gray

Write-Host "`n4. Se está sendo IGNORADO → execute:" -ForegroundColor White
Write-Host "   git rm --cached src/app/alertas/page.tsx" -ForegroundColor Gray
Write-Host "   git add src/app/alertas/page.tsx" -ForegroundColor Gray
Write-Host "   git commit -m 'fix: parar de ignorar alertas'" -ForegroundColor Gray

Write-Host "`n════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Diagnóstico concluído! Compartilhe os resultados acima com Monica para análise." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
