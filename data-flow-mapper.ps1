# Nome: data-flow-mapper.ps1
# Uso no PowerShell: .\data-flow-mapper.ps1
# Resultado: Mapeamento nativo do fluxo de dados para Windows

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "         ORBIT DASHBOARD - DATA FLOW MAP            " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

Write-Host "`nROTA: /" -ForegroundColor Yellow
Write-Host " - Arquivo: src/app/page.tsx (RootPage)"
Write-Host " - Dados: supabase.auth.getSession()"
Write-Host " - Próxima Rota: /instagram (após login)"

Write-Host "`nROTA: /instagram" -ForegroundColor Yellow
Write-Host " - Arquivo: src/app/instagram/page.tsx"
Write-Host " - Componente: InstagramOverviewLayout"
Write-Host " - Hook de Consumo: useOrbitDashboard()"
Write-Host " - Views Solicitadas: v_kpi_snapshots, v_quality_scores, v_format_performance" -ForegroundColor DarkYellow

Write-Host "`nROTA: /avatar" -ForegroundColor Yellow
Write-Host " - Arquivo: src/app/avatar/page.tsx"
Write-Host " - Hook de Consumo: useAvatar()"
Write-Host " - Views Solicitadas: ig_audience_snapshots" -ForegroundColor DarkYellow

Write-Host "`nMIGRAÇÃO CRÍTICA DO BANCO (L0 -> L1):" -ForegroundColor Magenta
Write-Host " - 100% dos dados de ingest atuais estão travados em nível 'L0'." -ForegroundColor Red
Write-Host " - As Views precisam ignorar a trava antiga que exigia 'L1/L2' para os dados fluírem."

Write-Host "`n====================================================" -ForegroundColor Cyan
