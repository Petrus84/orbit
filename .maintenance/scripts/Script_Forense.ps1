# ============================================================================
# 🔍 SCRIPT FORENSE PROFISSIONAL DE CÓDIGO
# React + Node.js + Supabase
# Modo: Professor + Perito Forense
# ============================================================================
# Como usar: 
# powershell -ExecutionPolicy Bypass -File analise-forense.ps1
# ============================================================================

param(
    [string]$CaminhoSrc = "./src",
    [string]$CaminhoServer = "./server",
    [string]$RelatorioSaida = "./relatorio-forense.html",
    [switch]$GerarHTML = $true
)

# ============================================================================
# CONFIGURAÇÃO INICIAL
# ============================================================================
$dataAnalise = Get-Date -Format "dd/MM/yyyy HH:mm:ss"
$relatorioTexto = @()
$relatorioTexto += "╔════════════════════════════════════════════════════════════════════════════════╗"
$relatorioTexto += "║                    RELATÓRIO FORENSE DE CÓDIGO                                ║"
$relatorioTexto += "║            React + Node.js + Supabase - Análise Profunda                      ║"
$relatorioTexto += "╚════════════════════════════════════════════════════════════════════════════════╝"
$relatorioTexto += "`nData: $dataAnalise`n"

$cores = @{
    Critico = 'Red'
    Alto = 'Yellow'
    Medio = 'Cyan'
    Baixo = 'Green'
    Info = 'White'
    Sucesso = 'Green'
    Aviso = 'Yellow'
    Debug = 'DarkGray'
}

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================
function Escrever-Titulo {
    param([string]$Titulo, [int]$Nivel = 1)
    $prefixo = "═" * (80 - $Titulo.Length - 2)
    Write-Host "`n$prefixo $Titulo $prefixo" -ForegroundColor $cores.Info
    $relatorioTexto += "`n$prefixo $Titulo $prefixo"
}

function Escrever-Secao {
    param([string]$Secao, [string]$Icone = "►")
    Write-Host "`n$Icone $Secao" -ForegroundColor $cores.Medio
    $relatorioTexto += "`n$Icone $Secao"
}

function Escrever-Resultado {
    param(
        [string]$Mensagem,
        [string]$Severidade = "Info",
        [string]$Detalhes = ""
    )
    $cor = $cores[$Severidade]
    Write-Host "    $Mensagem" -ForegroundColor $cor
    $relatorioTexto += "    $Mensagem"
    if ($Detalhes) {
        Write-Host "    └─ $Detalhes" -ForegroundColor $cores.Debug
        $relatorioTexto += "`n    └─ $Detalhes"
    }
}

function Adicionar-Achado {
    param(
        [string]$Tipo,
        [string]$Severidade,
        [string]$Arquivo,
        [int]$Linha,
        [string]$Conteudo,
        [string]$Explicacao
    )
    return @{
        Tipo = $Tipo
        Severidade = $Severidade
        Arquivo = $Arquivo
        Linha = $Linha
        Conteudo = $Conteudo
        Explicacao = $Explicacao
        DataHora = Get-Date
    }
}

# ============================================================================
# ANÁLISE 1: PADRÕES DE CÓDIGO GERADO POR IA
# ============================================================================
Escrever-Titulo "🤖 ANÁLISE 1: DETECÇÃO DE CÓDIGO GERADO POR IA"

Escrever-Secao "Procurando por padrões típicos de LLM"

$padrõesIA = @{
    "// TODO:" = 0
    "// FIXME:" = 0
    "// NOTE:" = 0
    "// HACK:" = 0
    "as any" = 0
    "any as" = 0
    "interface.*Props.*\{" = 0
    "export const.*React\.FC" = 0
}

$arquivosComIA = @()
$linhasProblematicas = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx" -Recurse | ForEach-Object {
    $conteudo = Get-Content $_.FullName -Raw
    $linhas = Get-Content $_.FullName
    $numeroLinha = 0

    foreach ($linha in $linhas) {
        $numeroLinha++
        
        # Padrão 1: Comentários genéricos (típico de IA)
        if ($linha -match "// TODO:|// FIXME:|// NOTE:|// HACK:") {
            $padrõesIA["// TODO:"]++
            $linhasProblematicas += Adicionar-Achado `
                -Tipo "Comentário Genérico (IA)" `
                -Severidade "Medio" `
                -Arquivo $_.FullName `
                -Linha $numeroLinha `
                -Conteudo $linha.Trim() `
                -Explicacao "IA deixa TODOs/FIXMEs sem implementar"
        }

        # Padrão 2: Múltiplos 'as any' (muito comum em IA)
        if ($linha -match "as any|any as") {
            $padrõesIA["as any"]++
        }

        # Padrão 3: Props interfaces genéricas
        if ($linha -match "interface.*Props.*\{\s*\[key: string\]") {
            $padrõesIA["interface.*Props.*\{"]++
            $linhasProblematicas += Adicionar-Achado `
                -Tipo "Props Genérica" `
                -Severidade "Critico" `
                -Arquivo $_.FullName `
                -Linha $numeroLinha `
                -Conteudo $linha.Trim() `
                -Explicacao "IA cria interfaces muito genéricas para evitar erros"
        }
    }
}

Escrever-Resultado "🚨 Padrões de IA detectados:" "Critico"
$padrõesIA.GetEnumerator() | Where-Object { $_.Value -gt 0 } | ForEach-Object {
    Escrever-Resultado "   • $($_.Key): $($_.Value) ocorrências" "Alto"
}

# ============================================================================
# ANÁLISE 2: ANÁLISE DE TIPAGENS PROFUNDA
# ============================================================================
Escrever-Titulo "🔬 ANÁLISE 2: TIPAGENS - INVESTIGAÇÃO FORENSE"

Escrever-Secao "Nível 1: Usos de 'any' com contexto"

$anyProblemas = @()
$contadorAny = 0

Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx" -Recurse | ForEach-Object {
    $linhas = Get-Content $_.FullName
    $numeroLinha = 0

    foreach ($linha in $linhas) {
        $numeroLinha++
        if ($linha -match ': any|as any|<any>|\(any\)') {
            $contadorAny++
            $anyProblemas += Adicionar-Achado `
                -Tipo "Tipagem Insegura (any)" `
                -Severidade "Critico" `
                -Arquivo $_.FullName `
                -Linha $numeroLinha `
                -Conteudo $linha.Trim() `
                -Explicacao "Elimina segurança de tipos - IA usa para evitar erros"
        }
    }
}

if ($contadorAny -gt 0) {
    Escrever-Resultado "🚨 ENCONTRADOS $contadorAny usos de 'any'" "Critico"
    $anyProblemas | Select-Object -First 5 | ForEach-Object {
        Escrever-Resultado "   • Linha $($_.Linha): $($_.Arquivo)" "Critico" $_.Conteudo
    }
    if ($anyProblemas.Count -gt 5) {
        Escrever-Resultado "   ... e $($anyProblemas.Count - 5) mais" "Critico"
    }
}

Escrever-Secao "Nível 2: Tipos implícitos (sem anotação)"

$tiposImplicitos = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.tsx" -Recurse | ForEach-Object {
    $linhas = Get-Content $_.FullName
    $numeroLinha = 0

    foreach ($linha in $linhas) {
        $numeroLinha++
        # Procura por: const x = ... sem tipo
        if ($linha -match 'const\s+\w+\s*=\s*(?!.*:)' -and $linha -notmatch 'useState|useEffect|useCallback') {
            $tiposImplicitos += Adicionar-Achado `
                -Tipo "Tipo Implícito" `
                -Severidade "Medio" `
                -Arquivo $_.FullName `
                -Linha $numeroLinha `
                -Conteudo $linha.Trim() `
                -Explicacao "TypeScript infere tipo automaticamente - pode causar bugs"
        }
    }
}

if ($tiposImplicitos.Count -gt 0) {
    Escrever-Resultado "⚠️ ENCONTRADOS $($tiposImplicitos.Count) tipos implícitos" "Alto"
}

# ============================================================================
# ANÁLISE 3: PADRÕES DE ERRO E EXCEÇÕES
# ============================================================================
Escrever-Titulo "⚠️ ANÁLISE 3: TRATAMENTO DE ERROS"

Escrever-Secao "Nível 1: Funções async sem try/catch"

$asyncSemTry = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx" -Recurse | ForEach-Object {
    $conteudo = Get-Content $_.FullName -Raw
    
    # Procura por async functions
    $asyncMatches = [regex]::Matches($conteudo, 'async\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{')
    $tryMatches = [regex]::Matches($conteudo, 'try\s*\{')

    if ($asyncMatches.Count -gt $tryMatches.Count) {
        $asyncSemTry += @{
            Arquivo = $_.FullName
            AsyncCount = $asyncMatches.Count
            TryCount = $tryMatches.Count
            Diferenca = $asyncMatches.Count - $tryMatches.Count
        }
    }
}

if ($asyncSemTry.Count -gt 0) {
    Escrever-Resultado "🚨 ENCONTRADOS $($asyncSemTry.Count) arquivos com async sem try/catch" "Critico"
    $asyncSemTry | ForEach-Object {
        Escrever-Resultado "   • $($_.Arquivo): $($_.Diferenca) funções desprotegidas" "Critico"
    }
}

Escrever-Secao "Nível 2: Catch blocks vazios"

$catchVazios = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx" -Recurse | ForEach-Object {
    $linhas = Get-Content $_.FullName
    $numeroLinha = 0
    $emCatch = $false

    foreach ($linha in $linhas) {
        $numeroLinha++
        if ($linha -match 'catch\s*\(') {
            $emCatch = $true
        }
        if ($emCatch -and $linha -match '\{\s*\}|\{\s*\/\/\s*\}') {
            $catchVazios += Adicionar-Achado `
                -Tipo "Catch Vazio" `
                -Severidade "Critico" `
                -Arquivo $_.FullName `
                -Linha $numeroLinha `
                -Conteudo $linha.Trim() `
                -Explicacao "Erros sendo silenciosamente ignorados"
            $emCatch = $false
        }
    }
}

if ($catchVazios.Count -gt 0) {
    Escrever-Resultado "🚨 ENCONTRADOS $($catchVazios.Count) catch blocks vazios" "Critico"
}

# ============================================================================
# ANÁLISE 4: SEGURANÇA E VAZAMENTO DE DADOS
# ============================================================================
Escrever-Titulo "🔐 ANÁLISE 4: SEGURANÇA"

Escrever-Secao "Nível 1: Dados sensíveis em código"

$dadosSensiveis = @()
$padrõesSensíveis = @(
    'password\s*[:=]',
    'apiKey\s*[:=]',
    'secret\s*[:=]',
    'token\s*[:=]',
    'Bearer\s+[A-Za-z0-9]',
    'Authorization:\s*[A-Za-z0-9]'
)

Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx", "*.js" -Recurse | ForEach-Object {
    $linhas = Get-Content $_.FullName
    $numeroLinha = 0

    foreach ($linha in $linhas) {
        $numeroLinha++
        foreach ($padrao in $padrõesSensíveis) {
            if ($linha -match $padrao -and $linha -notmatch 'process\.env|import\.meta\.env') {
                $dadosSensiveis += Adicionar-Achado `
                    -Tipo "Dado Sensível Exposto" `
                    -Severidade "Critico" `
                    -Arquivo $_.FullName `
                    -Linha $numeroLinha `
                    -Conteudo $linha.Trim() `
                    -Explicacao "Credenciais/tokens podem estar expostos"
            }
        }
    }
}

if ($dadosSensiveis.Count -gt 0) {
    Escrever-Resultado "🚨 ENCONTRADOS $($dadosSensiveis.Count) possíveis dados sensíveis" "Critico"
}

Escrever-Secao "Nível 2: localStorage com dados sensíveis"

$localStorageProblemas = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.tsx" -Recurse | ForEach-Object {
    $linhas = Get-Content $_.FullName
    $numeroLinha = 0

    foreach ($linha in $linhas) {
        $numeroLinha++
        if ($linha -match 'localStorage\.setItem.*(?:password|token|secret|auth)') {
            $localStorageProblemas += Adicionar-Achado `
                -Tipo "localStorage Inseguro" `
                -Severidade "Critico" `
                -Arquivo $_.FullName `
                -Linha $numeroLinha `
                -Conteudo $linha.Trim() `
                -Explicacao "localStorage é acessível via XSS - usar httpOnly cookies"
        }
    }
}

if ($localStorageProblemas.Count -gt 0) {
    Escrever-Resultado "🚨 ENCONTRADOS $($localStorageProblemas.Count) localStorage inseguros" "Critico"
}

# ============================================================================
# ANÁLISE 5: PADRÕES DE ARQUITETURA
# ============================================================================
Escrever-Titulo "🏗️ ANÁLISE 5: ARQUITETURA E PADRÕES"

Escrever-Secao "Nível 1: Lógica de negócio em componentes"

$logicaEmComponentes = @()

Get-ChildItem -Path $CaminhoSrc/components -Include "*.tsx" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $conteudo = Get-Content $_.FullName -Raw
    
    # Procura por queries diretas do Supabase
    if ($conteudo -match 'supabase\.from\(|fetch\(.*api' -and $conteudo -notmatch 'useEffect.*\[.*\]') {
        $logicaEmComponentes += @{
            Arquivo = $_.FullName
            Tipo = "Query Supabase"
        }
    }
}

if ($logicaEmComponentes.Count -gt 0) {
    Escrever-Resultado "⚠️ ENCONTRADOS $($logicaEmComponentes.Count) componentes com lógica de negócio" "Alto"
    Escrever-Resultado "   └─ Lógica deve estar em services/ ou hooks/" "Alto"
}

Escrever-Secao "Nível 2: Falta de separação de responsabilidades"

$arquivosGrandes = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.tsx" -Recurse | ForEach-Object {
    $linhas = @(Get-Content $_.FullName).Count
    if ($linhas -gt 300) {
        $arquivosGrandes += @{
            Arquivo = $_.FullName
            Linhas = $linhas
        }
    }
}

if ($arquivosGrandes.Count -gt 0) {
    Escrever-Resultado "⚠️ ENCONTRADOS $($arquivosGrandes.Count) arquivos muito grandes (>300 linhas)" "Alto"
    $arquivosGrandes | ForEach-Object {
        Escrever-Resultado "   • $($_.Arquivo): $($_.Linhas) linhas" "Alto"
    }
}

# ============================================================================
# ANÁLISE 6: PERFORMANCE
# ============================================================================
Escrever-Titulo "⚡ ANÁLISE 6: PERFORMANCE"

Escrever-Secao "Nível 1: Falta de memoização"

$faltaMemo = @()

Get-ChildItem -Path $CaminhoSrc -Include "*.tsx" -Recurse | ForEach-Object {
    $conteudo = Get-Content $_.FullName -Raw
    
    $temUseCallback = $conteudo -match 'useCallback'
    $temUseMemo = $conteudo -match 'useMemo'
    $temFuncoes = $conteudo -match 'const\s+\w+\s*=\s*\([^)]*\)\s*=>'
    $temReactMemo = $conteudo -match 'React\.memo'

    if ($temFuncoes -and -not $temUseCallback -and -not $temReactMemo) {
        $faltaMemo += $_.FullName
    }
}

if ($faltaMemo.Count -gt 0) {
    Escrever-Resultado "⚠️ ENCONTRADOS $($faltaMemo.Count) componentes sem memoização" "Medio"
}

# ============================================================================
# ANÁLISE 7: QUALIDADE DE CÓDIGO
# ============================================================================
Escrever-Titulo "📊 ANÁLISE 7: QUALIDADE DE CÓDIGO"

Escrever-Secao "Métricas gerais"

$totalArquivos = @(Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx" -Recurse).Count
$totalLinhas = 0
$mediaLinhasPorArquivo = 0

Get-ChildItem -Path $CaminhoSrc -Include "*.ts", "*.tsx" -Recurse | ForEach-Object {
    $totalLinhas += @(Get-Content $_.FullName).Count
}

if ($totalArquivos -gt 0) {
    $mediaLinhasPorArquivo = [math]::Round($totalLinhas / $totalArquivos, 2)
}

Escrever-Resultado "📊 Total de arquivos: $totalArquivos" "Info"
Escrever-Resultado "📊 Total de linhas: $totalLinhas" "Info"
Escrever-Resultado "📊 Média de linhas por arquivo: $mediaLinhasPorArquivo" "Info"

# ============================================================================
# ANÁLISE 8: SCORE FORENSE FINAL
# ============================================================================
Escrever-Titulo "🎯 SCORE FORENSE FINAL"

$scoreCriticos = $anyProblemas.Count + $catchVazios.Count + $dadosSensiveis.Count + $localStorageProblemas.Count
$scoreAltos = $asyncSemTry.Count + $logicaEmComponentes.Count + $arquivosGrandes.Count
$scoreMedios = $tiposImplicitos.Count + $faltaMemo.Count

$scoreTotal = (100 - ($scoreCriticos * 10) - ($scoreAltos * 5) - ($scoreMedios * 2))
$scoreTotal = [math]::Max(0, $scoreTotal)

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $cores.Info
Write-Host "║              SCORE FORENSE DE QUALIDADE                       ║" -ForegroundColor $cores.Info
Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor $cores.Info
Write-Host "║  Problemas CRÍTICOS: $scoreCriticos" -ForegroundColor $cores.Critico
Write-Host "║  Problemas ALTOS: $scoreAltos" -ForegroundColor $cores.Alto
Write-Host "║  Problemas MÉDIOS: $scoreMedios" -ForegroundColor $cores.Medio
Write-Host "║" -ForegroundColor $cores.Info
Write-Host "║  SCORE FINAL: $scoreTotal/100" -ForegroundColor $(if ($scoreTotal -lt 50) { $cores.Critico } else { $cores.Sucesso })
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $cores.Info

# ============================================================================
# RECOMENDAÇÕES FINAIS
# ============================================================================
Escrever-Titulo "📋 RECOMENDAÇÕES DO PERITO"

Write-Host "`n1. IMEDIATO (Próximas 24 horas):" -ForegroundColor $cores.Critico
Write-Host "   • Remover todos os 'any' e substituir por tipos específicos" -ForegroundColor $cores.Critico
Write-Host "   • Implementar try/catch em todas as funções async" -ForegroundColor $cores.Critico
Write-Host "   • Revisar dados sensíveis expostos" -ForegroundColor $cores.Critico

Write-Host "`n2. CURTO PRAZO (Esta semana):" -ForegroundColor $cores.Alto
Write-Host "   • Separar lógica de negócio dos componentes" -ForegroundColor $cores.Alto
Write-Host "   • Refatorar arquivos com >300 linhas" -ForegroundColor $cores.Alto
Write-Host "   • Implementar memoização onde necessário" -ForegroundColor $cores.Alto

Write-Host "`n3. MÉDIO PRAZO (Este mês):" -ForegroundColor $cores.Medio
Write-Host "   • Adicionar testes unitários" -ForegroundColor $cores.Medio
Write-Host "   • Implementar linting com ESLint" -ForegroundColor $cores.Medio
Write-Host "   • Documentar padrões de arquitetura" -ForegroundColor $cores.Medio

Write-Host "`n✅ ANÁLISE FORENSE CONCLUÍDA!" -ForegroundColor $cores.Sucesso
Write-Host "`n"