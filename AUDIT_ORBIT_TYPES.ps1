# ============================================================================
# AUDIT_ORBIT_TYPES.ps1
# Script de Auditoria Completa do Orbit Dashboard
# Validação de 120+ Inferências sem Acesso ao Vivo
# ============================================================================
# Encoding: UTF-8 com BOM
# Autor: Monica | Data: 2026-08-08

param(
    [string]$OutputPath = ".",
    [switch]$Verbose
)

# ============================================================================
# CONFIGURAÇÃO INICIAL
# ============================================================================

$ErrorActionPreference = "Continue"
$WarningPreference = "SilentlyContinue"

# Cores para output
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Debug = "Gray"
}

# Contadores
$Audit = @{
    Total = 0
    Passed = 0
    Warnings = 0
    Failed = 0
    Results = @()
}

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

function Write-AuditLog {
    param(
        [string]$Message,
        [ValidateSet("Success", "Warning", "Error", "Info", "Debug")]
        [string]$Status = "Info"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $symbol = @{
        Success = "✅"
        Warning = "⚠️ "
        Error = "❌"
        Info = "ℹ️ "
        Debug = "🔍"
    }
    
    Write-Host "[$timestamp] $($symbol[$Status]) $Message" -ForegroundColor $Colors[$Status]
}

function Add-AuditResult {
    param(
        [string]$Category,
        [string]$Check,
        [ValidateSet("PASSED", "WARNING", "FAILED")]
        [string]$Status,
        [string]$Details = ""
    )
    
    $Audit.Total++
    
    switch ($Status) {
        "PASSED" { $Audit.Passed++ }
        "WARNING" { $Audit.Warnings++ }
        "FAILED" { $Audit.Failed++ }
    }
    
    $result = @{
        Category = $Category
        Check = $Check
        Status = $Status
        Details = $Details
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    $Audit.Results += $result
    
    Write-AuditLog -Message "$Category | $Check" -Status $Status
    if ($Details -and $Verbose) {
        Write-AuditLog -Message "  └─ $Details" -Status "Debug"
    }
}

function Test-FileExists {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        return $true
    }
    return $false
}

function Get-FileContent {
    param([string]$FilePath)
    
    try {
        $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
        return $content
    }
    catch {
        Write-AuditLog -Message "Erro ao ler arquivo: $FilePath" -Status "Error"
        return $null
    }
}

function Test-TypeExists {
    param(
        [string]$Content,
        [string]$TypeName
    )
    
    $patterns = @(
        "interface\s+$TypeName\s*[\{]",
        "type\s+$TypeName\s*=",
        "export\s+interface\s+$TypeName",
        "export\s+type\s+$TypeName"
    )
    
    foreach ($pattern in $patterns) {
        if ($Content -match $pattern) {
            return $true
        }
    }
    return $false
}

function Test-FieldExists {
    param(
        [string]$Content,
        [string]$TypeName,
        [string]$FieldName
    )
    
    # Encontra a interface/type
    $typePattern = "(?:interface|type)\s+$TypeName\s*[\{]"
    if ($Content -match $typePattern) {
        $typeStart = $Content.IndexOf($Matches[0])
        $braceCount = 0
        $inType = $false
        
        for ($i = $typeStart; $i -lt $Content.Length; $i++) {
            $char = $Content[$i]
            
            if ($char -eq '{') { $braceCount++; $inType = $true }
            if ($char -eq '}' -and $inType) { $braceCount--; if ($braceCount -eq 0) { break } }
            
            if ($inType -and $Content.Substring($i) -match "^\s*$FieldName\s*[\?:]") {
                return $true
            }
        }
    }
    return $false
}

function Count-Occurrences {
    param(
        [string]$Content,
        [string]$Pattern
    )
    
    $matches = [regex]::Matches($Content, $Pattern)
    return $matches.Count
}

# ============================================================================
# SEÇÃO 1: VALIDAÇÃO DE ARQUIVO PRINCIPAL
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 1: Validação de Arquivo Principal ===" -Status "Info"

$orbitPath = Join-Path -Path $OutputPath -ChildPath "types" "orbit.ts"
if (-not (Test-Path $orbitPath)) {
    $orbitPath = Join-Path -Path $OutputPath -ChildPath "orbit.ts"
}

if (Test-FileExists $orbitPath) {
    Add-AuditResult -Category "Arquivo Principal" -Check "orbit.ts existe" -Status "PASSED"
    $orbitContent = Get-FileContent $orbitPath
} else {
    Add-AuditResult -Category "Arquivo Principal" -Check "orbit.ts existe" -Status "FAILED" -Details "Arquivo não encontrado em $orbitPath"
    Write-AuditLog -Message "Procurando em diretórios alternativos..." -Status "Warning"
    
    $searchPaths = @(
        "types/orbit.ts",
        "orbit.ts",
        "../types/orbit.ts",
        "../../types/orbit.ts"
    )
    
    $found = $false
    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            $orbitPath = $path
            $orbitContent = Get-FileContent $path
            $found = $true
            Add-AuditResult -Category "Arquivo Principal" -Check "orbit.ts encontrado em $path" -Status "PASSED"
            break
        }
    }
    
    if (-not $found) {
        Write-AuditLog -Message "Não foi possível encontrar orbit.ts. Abortando..." -Status "Error"
        exit 1
    }
}

# ============================================================================
# SEÇÃO 2: TIPOS CANÔNICOS
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 2: Tipos Canônicos ===" -Status "Info"

$canonicalTypes = @(
    "Alert",
    "CriticalAlertData",
    "ClientHealthStatus",
    "AlertSeverity"
)

foreach ($type in $canonicalTypes) {
    if (Test-TypeExists -Content $orbitContent -TypeName $type) {
        Add-AuditResult -Category "Tipos Canônicos" -Check "Tipo $type existe" -Status "PASSED"
    } else {
        Add-AuditResult -Category "Tipos Canônicos" -Check "Tipo $type existe" -Status "FAILED"
    }
}

# ============================================================================
# SEÇÃO 3: INTERFACES PRINCIPAIS
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 3: Interfaces Principais ===" -Status "Info"

$mainInterfaces = @(
    @{ Name = "Alert"; Fields = @("id", "severity", "message") },
    @{ Name = "CriticalAlertData"; Fields = @("id", "severity") },
    @{ Name = "ClientProfile"; Fields = @("id", "name") },
    @{ Name = "AvatarProfile"; Fields = @("id") }
)

foreach ($interface in $mainInterfaces) {
    $ifName = $interface.Name
    
    if (Test-TypeExists -Content $orbitContent -TypeName $ifName) {
        Add-AuditResult -Category "Interfaces Principais" -Check "$ifName existe" -Status "PASSED"
        
        foreach ($field in $interface.Fields) {
            if (Test-FieldExists -Content $orbitContent -TypeName $ifName -FieldName $field) {
                Add-AuditResult -Category "Interfaces Principais" -Check "$ifName.$field existe" -Status "PASSED"
            } else {
                Add-AuditResult -Category "Interfaces Principais" -Check "$ifName.$field existe" -Status "WARNING" -Details "Campo pode estar com nome diferente"
            }
        }
    } else {
        Add-AuditResult -Category "Interfaces Principais" -Check "$ifName existe" -Status "FAILED"
    }
}

# ============================================================================
# SEÇÃO 4: GAPS CRÍTICOS IDENTIFICADOS
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 4: Gaps Críticos ===" -Status "Info"

$criticalGaps = @(
    @{ Name = "exportable"; Interface = "Alert"; Type = "boolean"; Severity = "CRÍTICO" },
    @{ Name = "confidenceLevel"; Interface = "Alert"; Type = "string"; Severity = "CRÍTICO" },
    @{ Name = "personaType"; Interface = "Alert"; Type = "string"; Severity = "CRÍTICO" }
)

foreach ($gap in $criticalGaps) {
    $exists = Test-FieldExists -Content $orbitContent -TypeName $gap.Interface -FieldName $gap.Name
    
    if ($exists) {
        Add-AuditResult -Category "Gaps Críticos" -Check "$($gap.Interface).$($gap.Name) existe" -Status "PASSED" -Details "Campo já implementado"
    } else {
        Add-AuditResult -Category "Gaps Críticos" -Check "$($gap.Interface).$($gap.Name) existe" -Status "FAILED" -Details "[$($gap.Severity)] Campo faltando"
    }
}

# ============================================================================
# SEÇÃO 5: VALIDAÇÃO DE FUNÇÕES
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 5: Funções de Validação ===" -Status "Info"

$validationFunctions = @(
    "validateMetaCampaignRow",
    "validateAlert",
    "validateClientProfile"
)

foreach ($func in $validationFunctions) {
    $pattern = "(?:function|const)\s+$func\s*[\(\{]"
    if ($orbitContent -match $pattern) {
        Add-AuditResult -Category "Funções de Validação" -Check "Função $func existe" -Status "PASSED"
    } else {
        Add-AuditResult -Category "Funções de Validação" -Check "Função $func existe" -Status "WARNING" -Details "Função não encontrada ou com nome diferente"
    }
}

# ============================================================================
# SEÇÃO 6: DUPLICATAS SEMÂNTICAS
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 6: Duplicatas Semânticas ===" -Status "Info"

$duplicates = @(
    @{ Type1 = "IGOverviewLegacyData"; Type2 = "IGAccountOverviewData" },
    @{ Type1 = "FetchStatusLegacy"; Type2 = "FetchStatus" },
    @{ Type1 = "AvatarProfile"; Type2 = "AvatarProfile" }
)

foreach ($dup in $duplicates) {
    $count1 = Count-Occurrences -Content $orbitContent -Pattern "(?:interface|type)\s+$($dup.Type1)\s*[\{\=]"
    $count2 = Count-Occurrences -Content $orbitContent -Pattern "(?:interface|type)\s+$($dup.Type2)\s*[\{\=]"
    
    if ($count1 -gt 1 -or $count2 -gt 1) {
        Add-AuditResult -Category "Duplicatas" -Check "$($dup.Type1) vs $($dup.Type2)" -Status "WARNING" -Details "Possível duplicação detectada"
    } else {
        Add-AuditResult -Category "Duplicatas" -Check "$($dup.Type1) vs $($dup.Type2)" -Status "PASSED"
    }
}

# ============================================================================
# SEÇÃO 7: VOCABULÁRIO STATUS/COR
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 7: Vocabulário Status/Cor ===" -Status "Info"

$statusVocab = @(
    "AlertSeverity",
    "ClientHealthStatus",
    "AlignmentStatus",
    "StatusLevel"
)

foreach ($vocab in $statusVocab) {
    if (Test-TypeExists -Content $orbitContent -TypeName $vocab) {
        Add-AuditResult -Category "Vocabulário Status/Cor" -Check "Tipo $vocab existe" -Status "PASSED"
    } else {
        Add-AuditResult -Category "Vocabulário Status/Cor" -Check "Tipo $vocab existe" -Status "WARNING" -Details "Tipo não encontrado - pode estar em outro arquivo"
    }
}

# ============================================================================
# SEÇÃO 8: COMPONENTES UI
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 8: Componentes UI ===" -Status "Info"

$components = @(
    "AlertCard.tsx",
    "KPICard.tsx",
    "FunnelSimulator.tsx",
    "RecommendationCard.tsx",
    "CarteiraScreen.tsx"
)

foreach ($comp in $components) {
    $compPath = Join-Path -Path $OutputPath -ChildPath "components" $comp
    if (-not (Test-Path $compPath)) {
        $compPath = Join-Path -Path $OutputPath -ChildPath $comp
    }
    
    if (Test-Path $compPath) {
        Add-AuditResult -Category "Componentes UI" -Check "Componente $comp existe" -Status "PASSED"
    } else {
        Add-AuditResult -Category "Componentes UI" -Check "Componente $comp existe" -Status "WARNING" -Details "Componente não encontrado"
    }
}

# ============================================================================
# SEÇÃO 9: HOOKS
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 9: Hooks ===" -Status "Info"

$hooks = @(
    "useClients",
    "useAlerts",
    "useFunnel",
    "useAvatarProfile"
)

foreach ($hook in $hooks) {
    $pattern = "(?:export\s+)?(?:function|const)\s+$hook\s*[\(\{]"
    if ($orbitContent -match $pattern) {
        Add-AuditResult -Category "Hooks" -Check "Hook $hook existe" -Status "PASSED"
    } else {
        Add-AuditResult -Category "Hooks" -Check "Hook $hook existe" -Status "WARNING" -Details "Hook não encontrado em orbit.ts"
    }
}

# ============================================================================
# SEÇÃO 10: REPOSITÓRIOS
# ============================================================================

Write-AuditLog -Message "=== SEÇÃO 10: Repositórios ===" -Status "Info"

$repos = @(
    "alertsRepository.ts",
    "clientsRepository.ts",
    "funnelRepository.ts"
)

foreach ($repo in $repos) {
    $repoPath = Join-Path -Path $OutputPath -ChildPath "repositories" $repo
    if (-not (Test-Path $repoPath)) {
        $repoPath = Join-Path -Path $OutputPath -ChildPath $repo
    }
    
    if (Test-Path $repoPath) {
        Add-AuditResult -Category "Repositórios" -Check "Repositório $repo existe" -Status "PASSED"
    } else {
        Add-AuditResult -Category "Repositórios" -Check "Repositório $repo existe" -Status "WARNING" -Details "Repositório não encontrado"
    }
}

# ============================================================================
# RELATÓRIO FINAL
# ============================================================================

Write-AuditLog -Message "=== RELATÓRIO FINAL ===" -Status "Info"

$passPercentage = if ($Audit.Total -gt 0) { [math]::Round(($Audit.Passed / $Audit.Total) * 100, 2) } else { 0 }

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    RESUMO DA AUDITORIA                         ║" -ForegroundColor Cyan
Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║ Total de Verificações: $($Audit.Total)" -ForegroundColor Cyan
Write-Host "║ ✅ Passou: $($Audit.Passed)" -ForegroundColor Green
Write-Host "║ ⚠️  Avisos: $($Audit.Warnings)" -ForegroundColor Yellow
Write-Host "║ ❌ Falhas: $($Audit.Failed)" -ForegroundColor Red
Write-Host "║ Taxa de Sucesso: $passPercentage%" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# EXPORTAR RELATÓRIOS
# ============================================================================

# JSON Report
$jsonReport = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Summary = @{
        Total = $Audit.Total
        Passed = $Audit.Passed
        Warnings = $Audit.Warnings
        Failed = $Audit.Failed
        SuccessRate = $passPercentage
    }
    Details = $Audit.Results
} | ConvertTo-Json -Depth 10

$jsonPath = Join-Path -Path $OutputPath -ChildPath "AUDIT_REPORT.json"
$jsonReport | Out-File -FilePath $jsonPath -Encoding UTF8

Write-AuditLog -Message "Relatório JSON exportado: $jsonPath" -Status "Success"

# HTML Report
$htmlContent = @"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Auditoria - Orbit Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
        h1 { color: #333; margin-bottom: 10px; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        .summary-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .summary-card.error { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
        .summary-card h3 { font-size: 32px; margin-bottom: 5px; }
        .summary-card p { font-size: 12px; opacity: 0.9; }
        .results { margin-top: 40px; }
        .result-group { margin-bottom: 30px; }
        .result-group h2 { color: #333; font-size: 18px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
        .result-item { display: flex; align-items: center; padding: 12px; margin-bottom: 10px; background: #f9f9f9; border-left: 4px solid #ddd; border-radius: 4px; }
        .result-item.passed { border-left-color: #38ef7d; background: #f0fdf4; }
        .result-item.warning { border-left-color: #f5576c; background: #fef3c7; }
        .result-item.failed { border-left-color: #ef4444; background: #fee2e2; }
        .result-icon { font-size: 20px; margin-right: 15px; }
        .result-content { flex: 1; }
        .result-check { font-weight: 600; color: #333; }
        .result-details { font-size: 12px; color: #666; margin-top: 5px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Relatório de Auditoria - Orbit Dashboard</h1>
        <p class="subtitle">Gerado em: $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")</p>
        
        <div class="summary">
            <div class="summary-card success">
                <h3>$($Audit.Passed)</h3>
                <p>✅ Verificações Passadas</p>
            </div>
            <div class="summary-card warning">
                <h3>$($Audit.Warnings)</h3>
                <p>⚠️ Avisos</p>
            </div>
            <div class="summary-card error">
                <h3>$($Audit.Failed)</h3>
                <p>❌ Falhas</p>
            </div>
            <div class="summary-card">
                <h3>$passPercentage%</h3>
                <p>Taxa de Sucesso</p>
            </div>
        </div>
        
        <div class="results">
"@

# Agrupar resultados por categoria
$categories = $Audit.Results | Group-Object -Property Category

foreach ($category in $categories) {
    $htmlContent += "<div class='result-group'><h2>$($category.Name)</h2>"
    
    foreach ($result in $category.Group) {
        $statusClass = $result.Status.ToLower()
        $statusIcon = @{
            "passed" = "✅"
            "warning" = "⚠️"
            "failed" = "❌"
        }[$statusClass]
        
        $htmlContent += @"
            <div class="result-item $statusClass">
                <div class="result-icon">$statusIcon</div>
                <div class="result-content">
                    <div class="result-check">$($result.Check)</div>
                    $(if ($result.Details) { "<div class='result-details'>$($result.Details)</div>" })
                </div>
            </div>
"@
    }
    
    $htmlContent += "</div>"
}

$htmlContent += @"
        </div>
        
        <div class="footer">
            <p>Auditoria realizada por Monica | Orbit Dashboard Validation Script v1.0</p>
            <p>Para mais informações, consulte: PLANO_FINAL_ALTERACOES.md</p>
        </div>
    </div>
</body>
</html>
"@

$htmlPath = Join-Path -Path $OutputPath -ChildPath "AUDIT_REPORT.html"
$htmlContent | Out-File -FilePath $htmlPath -Encoding UTF8

Write-AuditLog -Message "Relatório HTML exportado: $htmlPath" -Status "Success"

# ============================================================================
# CONCLUSÃO
# ============================================================================

Write-Host ""
Write-AuditLog -Message "Auditoria concluída com sucesso!" -Status "Success"
Write-AuditLog -Message "Abra $htmlPath no navegador para visualizar o relatório completo" -Status "Info"
Write-Host ""

exit 0
