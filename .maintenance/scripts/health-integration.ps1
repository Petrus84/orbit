# ============================================================================
# ORBIT DASHBOARD - SYSTEM HEALTH INTEGRATION
# PowerShell 7.6.6
# Combina: Data Flow Mapping + Integrity Audit + Health Dashboard
# ============================================================================

param(
  [string]$ProjectPath = "C:\Projetos\orbit-dashboard",
  [string]$OutputDir = ".\health-reports",
  [switch]$GenerateHTML = $true,
  [switch]$GenerateJSON = $true,
  [switch]$OpenBrowser = $false,
  [switch]$Verbose = $false
)

# ============================================================================
# INICIALIZAÇÃO
# ============================================================================

$ErrorActionPreference = "Continue"
$WarningPreference = "Continue"

# Criar diretório de saída
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportDate = Get-Date -Format "dd/MM/yyyy HH:mm:ss"

$healthReport = @{
  timestamp = Get-Date -Format "o"
  reportDate = $reportDate
  projectPath = $ProjectPath
  systemHealth = @{
    overall = "UNKNOWN"
    score = 0
    status = "INITIALIZING"
  }
  sections = @{}
  dataFlow = @{}
  audit = @{}
  recommendations = @()
  criticalIssues = @()
}

# ============================================================================
# UTILITÁRIOS
# ============================================================================

function Write-HealthLog {
  param(
    [string]$Message,
    [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR", "DEBUG", "CRITICAL")][string]$Level = "INFO"
  )
  
  $timestamp = Get-Date -Format "HH:mm:ss"
  $colors = @{
    "INFO"     = "Cyan"
    "SUCCESS"  = "Green"
    "WARNING"  = "Yellow"
    "ERROR"    = "Red"
    "DEBUG"    = "Gray"
    "CRITICAL" = "Magenta"
  }
  
  $icon = @{
    "INFO"     = "ℹ️"
    "SUCCESS"  = "✅"
    "WARNING"  = "⚠️"
    "ERROR"    = "❌"
    "DEBUG"    = "🔍"
    "CRITICAL" = "🚨"
  }
  
  Write-Host "[$timestamp] $($icon[$Level]) $Message" -ForegroundColor $colors[$Level]
}

function Calculate-HealthScore {
  param(
    [int]$Passed,
    [int]$Total,
    [int]$CriticalFails = 0
  )
  
  if ($Total -eq 0) { return 0 }
  
  $baseScore = ($Passed / $Total) * 100
  $criticalPenalty = $CriticalFails * 10
  $finalScore = [math]::Max(0, $baseScore - $criticalPenalty)
  
  return [math]::Round($finalScore, 2)
}

function Get-HealthStatus {
  param([double]$Score)
  
  if ($Score -ge 95) { return @{ status = "EXCELLENT"; color = "Green"; icon = "🟢" } }
  elseif ($Score -ge 85) { return @{ status = "HEALTHY"; color = "Green"; icon = "🟢" } }
  elseif ($Score -ge 70) { return @{ status = "WARNING"; color = "Yellow"; icon = "🟡" } }
  elseif ($Score -ge 50) { return @{ status = "CRITICAL"; color = "Red"; icon = "🔴" } }
  else { return @{ status = "FAILING"; color = "Red"; icon = "🔴" } }
}

# ============================================================================
# SEÇÃO 1: DATA FLOW MAPPING
# ============================================================================

function Map-DataFlow {
  Write-HealthLog "=== MAPEANDO FLUXO DE DADOS ===" -Level "INFO"
  
  $dataFlowMap = @{
    routes = @()
    components = @()
    dataLayers = @()
    connections = @()
  }
  
  # Definir rotas conhecidas
  $routes = @(
    @{
      path = "/"
      file = "src/app/page.tsx"
      name = "RootPage"
      layer = "L4-Screens"
      dataSource = "supabase.auth"
      nextRoute = "/instagram"
    },
    @{
      path = "/instagram"
      file = "src/app/instagram/page.tsx"
      name = "InstagramOverviewPage"
      layer = "L4-Screens"
      dataSource = "useOrbitDashboard()"
      components = @("InstagramOverviewLayout", "Sidebar", "Header", "KPICard")
    },
    @{
      path = "/avatar"
      file = "src/app/avatar/page.tsx"
      name = "AvatarPage"
      layer = "L4-Screens"
      dataSource = "useAvatar()"
      components = @("AvatarScreen", "AvatarComparison", "AvatarCard")
    },
    @{
      path = "/alertas"
      file = "src/app/alertas/page.tsx"
      name = "AlertasPage"
      layer = "L4-Screens"
      dataSource = "useOrbitDashboard()"
      components = @("AlertasScreen", "CriticalAlert")
    },
    @{
      path = "/carteira"
      file = "src/app/carteira/page.tsx"
      name = "CarteiraPage"
      layer = "L4-Screens"
      dataSource = "useOrbitDashboard()"
      components = @("CarteiraScreen", "ClientCard")
    },
    @{
      path = "/funil"
      file = "src/app/funil/page.tsx"
      name = "FunilPage"
      layer = "L4-Screens"
      dataSource = "useFunnel()"
      components = @("FunnelScreen", "FunnelChart")
    }
  )
  
  # Verificar rotas
  foreach ($route in $routes) {
    $filePath = Join-Path $ProjectPath $route.file
    $exists = Test-Path $filePath -PathType Leaf
    
    $routeInfo = @{
      path = $route.path
      file = $route.file
      name = $route.name
      layer = $route.layer
      dataSource = $route.dataSource
      exists = $exists
      status = if ($exists) { "MAPPED" } else { "MISSING" }
      components = $route.components
    }
    
    $dataFlowMap.routes += $routeInfo
    Write-HealthLog "Rota: $($route.path) → $($routeInfo.status)" -Level $(if ($exists) { "SUCCESS" } else { "ERROR" })
  }
  
  # Mapear camadas de dados (L0-L5)
  $dataLayers = @(
    @{
      layer = "L0-DATA"
      description = "Banco de Dados (Supabase)"
      components = @("clients", "alerts", "ig_posts", "ig_account_snapshots")
      status = "ACTIVE"
    },
    @{
      layer = "L1-INFORMATION"
      description = "Repositórios"
      components = @("instagramOverviewRepository", "avatarRepository", "alertsRepository")
      status = "ACTIVE"
    },
    @{
      layer = "L2-KNOWLEDGE"
      description = "Custom Hooks"
      components = @("useOrbitDashboard", "useAvatar", "useAlerts", "useFunnel")
      status = "ACTIVE"
    },
    @{
      layer = "L3-WISDOM"
      description = "Context & State"
      components = @("OrbitDashboardContext", "useOrbitDashboard")
      status = "ACTIVE"
    },
    @{
      layer = "L4-SCREENS"
      description = "Páginas (Next.js)"
      components = @("InstagramOverviewPage", "AvatarPage", "AlertasPage")
      status = "ACTIVE"
    },
    @{
      layer = "L5-UI"
      description = "Componentes React"
      components = @("KPICard", "QualityScoresPanel", "AvatarCard", "CriticalAlert")
      status = "ACTIVE"
    }
  )
  
  $dataFlowMap.dataLayers = $dataLayers
  
  # Mapear conexões de dados
  $connections = @(
    @{
      from = "L0-DATA (clients table)"
      to = "L1-INFORMATION (clientsRepository)"
      type = "SQL Query"
      status = "CONNECTED"
    },
    @{
      from = "L1-INFORMATION (instagramOverviewRepository)"
      to = "L2-KNOWLEDGE (useOrbitDashboard hook)"
      type = "Function Call"
      status = "CONNECTED"
    },
    @{
      from = "L2-KNOWLEDGE (useOrbitDashboard)"
      to = "L3-WISDOM (OrbitDashboardContext)"
      type = "Context Provider"
      status = "CONNECTED"
    },
    @{
      from = "L3-WISDOM (OrbitDashboardContext)"
      to = "L4-SCREENS (InstagramOverviewPage)"
      type = "useContext Hook"
      status = "CONNECTED"
    },
    @{
      from = "L4-SCREENS (InstagramOverviewPage)"
      to = "L5-UI (KPICard, QualityScoresPanel)"
      type = "Component Props"
      status = "CONNECTED"
    }
  )
  
  $dataFlowMap.connections = $connections
  
  $healthReport.dataFlow = $dataFlowMap
  return $dataFlowMap
}

# ============================================================================
# SEÇÃO 2: AUDIT COMPLETO
# ============================================================================

function Run-ComprehensiveAudit {
  Write-HealthLog "=== EXECUTANDO AUDITORIA COMPLETA ===" -Level "INFO"
  
  $auditResults = @{
    fileStructure = @{ passed = 0; failed = 0; checks = @() }
    dependencies = @{ passed = 0; failed = 0; checks = @() }
    typeSystem = @{ passed = 0; failed = 0; checks = @() }
    dataIntegrity = @{ passed = 0; failed = 0; checks = @() }
    codeQuality = @{ passed = 0; failed = 0; checks = @() }
    security = @{ passed = 0; failed = 0; checks = @() }
  }
  
  # 1. ESTRUTURA DE ARQUIVOS
  Write-HealthLog "Auditando estrutura de arquivos..." -Level "DEBUG"
  $requiredDirs = @("src/actions", "src/app", "src/components", "src/hooks", "src/lib", "src/types")
  
  foreach ($dir in $requiredDirs) {
    $fullPath = Join-Path $ProjectPath $dir
    $exists = Test-Path $fullPath -PathType Container
    
    $auditResults.fileStructure.checks += @{
      name = "Directory: $dir"
      result = $exists
      severity = "ERROR"
    }
    
    if ($exists) {
      $auditResults.fileStructure.passed++
    } else {
      $auditResults.fileStructure.failed++
    }
  }
  
  # 2. DEPENDÊNCIAS
  Write-HealthLog "Auditando dependências..." -Level "DEBUG"
  $packageJsonPath = Join-Path $ProjectPath "package.json"
  
  if (Test-Path $packageJsonPath) {
    $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
    $criticalDeps = @("next", "react", "react-dom", "@supabase/supabase-js", "zod")
    
    foreach ($dep in $criticalDeps) {
      $exists = $packageJson.dependencies.PSObject.Properties.Name -contains $dep
      
      $auditResults.dependencies.checks += @{
        name = "Dependency: $dep"
        result = $exists
        version = if ($exists) { $packageJson.dependencies.$dep } else { "MISSING" }
        severity = "ERROR"
      }
      
      if ($exists) {
        $auditResults.dependencies.passed++
      } else {
        $auditResults.dependencies.failed++
      }
    }
  }
  
  # 3. SISTEMA DE TIPOS
  Write-HealthLog "Auditando sistema de tipos..." -Level "DEBUG"
  $typeFiles = @("src/types/database.types.ts", "src/types/orbit.ts", "src/types/alert.ts")
  
  foreach ($typeFile in $typeFiles) {
    $fullPath = Join-Path $ProjectPath $typeFile
    $exists = Test-Path $fullPath -PathType Leaf
    
    $auditResults.typeSystem.checks += @{
      name = "Type File: $(Split-Path $typeFile -Leaf)"
      result = $exists
      severity = "ERROR"
    }
    
    if ($exists) {
      $auditResults.typeSystem.passed++
    } else {
      $auditResults.typeSystem.failed++
    }
  }
  
  # 4. INTEGRIDADE DE DADOS
  Write-HealthLog "Auditando integridade de dados..." -Level "DEBUG"
  $repoDir = Join-Path $ProjectPath "src/lib/repositories"
  $repos = @("alertsRepository.ts", "avatarRepository.ts", "clientsRepository.ts")
  
  foreach ($repo in $repos) {
    $fullPath = Join-Path $repoDir $repo
    $exists = Test-Path $fullPath -PathType Leaf
    
    if ($exists) {
      $content = Get-Content $fullPath -Raw
      $hasExports = $content -match "export\s+(class|function|const)"
      
      $auditResults.dataIntegrity.checks += @{
        name = "Repository: $repo"
        result = $hasExports
        severity = "ERROR"
      }
      
      if ($hasExports) {
        $auditResults.dataIntegrity.passed++
      } else {
        $auditResults.dataIntegrity.failed++
      }
    }
  }
  
  # 5. QUALIDADE DE CÓDIGO
  Write-HealthLog "Auditando qualidade de código..." -Level "DEBUG"
  $hooksDir = Join-Path $ProjectPath "src/hooks"
  $hooks = @("useAlerts.ts", "useAvatar.ts", "useClients.ts", "useFunnel.ts")
  
  foreach ($hook in $hooks) {
    $fullPath = Join-Path $hooksDir $hook
    $exists = Test-Path $fullPath -PathType Leaf
    
    $auditResults.codeQuality.checks += @{
      name = "Hook: $hook"
      result = $exists
      severity = "WARNING"
    }
    
    if ($exists) {
      $auditResults.codeQuality.passed++
    } else {
      $auditResults.codeQuality.failed++
    }
  }
  
  # 6. SEGURANÇA
  Write-HealthLog "Auditando segurança..." -Level "DEBUG"
  $envPath = Join-Path $ProjectPath ".env.local"
  $authPath = Join-Path $ProjectPath "src/lib/auth/admin-guard.ts"
  
  $envExists = Test-Path $envPath -PathType Leaf
  $authExists = Test-Path $authPath -PathType Leaf
  
  $auditResults.security.checks += @{
    name = ".env.local exists"
    result = $envExists
    severity = "ERROR"
  }
  
  $auditResults.security.checks += @{
    name = "Admin Guard exists"
    result = $authExists
    severity = "ERROR"
  }
  
  $auditResults.security.passed = if ($envExists -and $authExists) { 2 } else { 0 }
  $auditResults.security.failed = 2 - $auditResults.security.passed
  
  $healthReport.audit = $auditResults
  return $auditResults
}

# ============================================================================
# SEÇÃO 3: ANÁLISE DE SAÚDE
# ============================================================================

function Analyze-SystemHealth {
  param(
    [hashtable]$DataFlow,
    [hashtable]$Audit
  )
  
  Write-HealthLog "=== ANALISANDO SAÚDE DO SISTEMA ===" -Level "INFO"
  
  $totalChecks = 0
  $totalPassed = 0
  $totalFailed = 0
  $criticalIssues = @()
  
  # Contar resultados
  foreach ($section in $Audit.Values) {
    if ($section -is [hashtable] -and $section.ContainsKey("passed")) {
      $totalChecks += $section.passed + $section.failed
      $totalPassed += $section.passed
      $totalFailed += $section.failed
    }
  }
  
  # Calcular score
  $healthScore = Calculate-HealthScore -Passed $totalPassed -Total $totalChecks -CriticalFails $Audit.security.failed
  $healthStatus = Get-HealthStatus -Score $healthScore
  
  # Identificar problemas críticos
  if ($Audit.security.failed -gt 0) {
    $criticalIssues += "🔐 Segurança: Variáveis de ambiente ou autenticação faltando"
  }
  
  if ($Audit.dependencies.failed -gt 0) {
    $criticalIssues += "📦 Dependências: Pacotes críticos faltando"
  }
  
  if ($Audit.fileStructure.failed -gt 0) {
    $criticalIssues += "📁 Estrutura: Diretórios essenciais faltando"
  }
  
  # Gerar recomendações
  $recommendations = @()
  
  if ($healthScore -lt 85) {
    $recommendations += @{
      priority = "HIGH"
      action = "Resolver problemas de integridade identificados"
      details = "Múltiplas verificações falharam. Execute auditoria detalhada."
    }
  }
  
  if ($Audit.codeQuality.failed -gt 0) {
    $recommendations += @{
      priority = "MEDIUM"
      action = "Revisar qualidade de código"
      details = "Alguns hooks ou componentes podem estar faltando"
    }
  }
  
  if ($DataFlow.routes.Count -lt 6) {
    $recommendations += @{
      priority = "MEDIUM"
      action = "Verificar rotas mapeadas"
      details = "Nem todas as rotas foram encontradas"
    }
  }
  
  $healthReport.systemHealth = @{
    overall = $healthStatus.status
    score = $healthScore
    icon = $healthStatus.icon
    color = $healthStatus.color
    totalChecks = $totalChecks
    passed = $totalPassed
    failed = $totalFailed
    passRate = [math]::Round(($totalPassed / $totalChecks) * 100, 2)
  }
  
  $healthReport.criticalIssues = $criticalIssues
  $healthReport.recommendations = $recommendations
  
  return $healthReport.systemHealth
}

# ============================================================================
# SEÇÃO 4: GERAR RELATÓRIO HTML
# ============================================================================

function Generate-HealthHTML {
  param([string]$OutputPath)
  
  Write-HealthLog "Gerando relatório HTML..." -Level "DEBUG"
  
  $dataFlowRoutes = $healthReport.dataFlow.routes | ConvertTo-Json
  $auditSummary = $healthReport.audit
  $systemHealth = $healthReport.systemHealth
  
  $html = @"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orbit Dashboard - System Health Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: #007bff;
      --success: #28a745;
      --warning: #ffc107;
      --danger: #dc3545;
      --dark: #343a40;
      --light: #f8f9fa;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 36px;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .content {
      padding: 40px;
    }
    
    .health-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    
    .health-card.excellent {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }
    
    .health-card.healthy {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }
    
    .health-card.warning {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    .health-card.critical {
      background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
    }
    
    .health-score {
      font-size: 64px;
      font-weight: bold;
      margin: 20px 0;
    }
    
    .health-label {
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: var(--light);
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid var(--primary);
      text-align: center;
    }
    
    .stat-card.success {
      border-left-color: var(--success);
    }
    
    .stat-card.danger {
      border-left-color: var(--danger);
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: var(--dark);
      margin: 10px 0;
    }
    
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .section-title {
      font-size: 24px;
      color: var(--dark);
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid var(--primary);
    }
    
    .audit-section {
      background: var(--light);
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .audit-section h3 {
      color: var(--dark);
      margin-bottom: 15px;
      font-size: 16px;
    }
    
    .check-item {
      display: flex;
      align-items: center;
      padding: 10px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      border-left: 4px solid var(--success);
    }
    
    .check-item.fail {
      border-left-color: var(--danger);
    }
    
    .check-item.warn {
      border-left-color: var(--warning);
    }
    
    .check-icon {
      font-size: 20px;
      margin-right: 15px;
      min-width: 30px;
    }
    
    .check-name {
      flex: 1;
      font-weight: 600;
      color: var(--dark);
    }
    
    .flow-diagram {
      background: var(--light);
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
    }
    
    .flow-item {
      margin: 10px 0;
      padding: 10px;
      background: white;
      border-left: 3px solid var(--primary);
      border-radius: 4px;
    }
    
    .critical-issues {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .critical-issues h3 {
      color: #856404;
      margin-bottom: 15px;
    }
    
    .issue-item {
      color: #856404;
      margin: 10px 0;
      padding-left: 20px;
    }
    
    .recommendations {
      background: #d1ecf1;
      border: 1px solid #bee5eb;
      border-radius: 8px;
      padding: 20px;
    }
    
    .recommendations h3 {
      color: #0c5460;
      margin-bottom: 15px;
    }
    
    .recommendation-item {
      background: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
      border-left: 4px solid #17a2b8;
    }
    
    .recommendation-priority {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      margin-right: 10px;
    }
    
    .priority-high {
      background: var(--danger);
      color: white;
    }
    
    .priority-medium {
      background: var(--warning);
      color: white;
    }
    
    .footer {
      background: var(--light);
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #ddd;
    }
    
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin: 15px 0;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #11998e 0%, #38ef7d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
    }
    
    .data-flow-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    .data-flow-table th,
    .data-flow-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    
    .data-flow-table th {
      background: var(--primary);
      color: white;
      font-weight: bold;
    }
    
    .data-flow-table tr:hover {
      background: var(--light);
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
    }
    
    .status-mapped {
      background: #d4edda;
      color: #155724;
    }
    
    .status-missing {
      background: #f8d7da;
      color: #721c24;
    }
    
    .status-connected {
      background: #d1ecf1;
      color: #0c5460;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 Orbit Dashboard - System Health Report</h1>
      <p>Relatório Integrado de Saúde do Sistema</p>
      <p>Gerado em: $reportDate</p>
    </div>
    
    <div class="content">
      <!-- HEALTH SCORE -->
      <div class="health-card $($systemHealth.overall.ToLower())">
        <div class="health-label">$($systemHealth.icon) $($systemHealth.overall)</div>
        <div class="health-score">$($systemHealth.score)%</div>
        <div>Taxa de Sucesso: $($systemHealth.passRate)%</div>
      </div>
      
      <!-- STATS GRID -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total de Verificações</div>
          <div class="stat-value">$($systemHealth.totalChecks)</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Passou</div>
          <div class="stat-value">$($systemHealth.passed)</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Falhou</div>
          <div class="stat-value">$($systemHealth.failed)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Taxa de Sucesso</div>
          <div class="stat-value">$($systemHealth.passRate)%</div>
        </div>
      </div>
      
      <div class="progress-bar">
        <div class="progress-fill" style="width: $($systemHealth.passRate)%;">
          $($systemHealth.passRate)%
        </div>
      </div>
      
      <!-- CRITICAL ISSUES -->
      $( if ($healthReport.criticalIssues.Count -gt 0) {
        @"
      <div class="critical-issues">
        <h3>🚨 Problemas Críticos Detectados</h3>
        $( $healthReport.criticalIssues | ForEach-Object { "<div class='issue-item'>• $_</div>" } )
      </div>
"@
      })
      
      <!-- DATA FLOW SECTION -->
      <div class="section">
        <h2 class="section-title">📊 Mapeamento de Fluxo de Dados</h2>
        
        <div class="audit-section">
          <h3>Rotas Mapeadas</h3>
          <table class="data-flow-table">
            <thead>
              <tr>
                <th>Rota</th>
                <th>Arquivo</th>
                <th>Camada</th>
                <th>Fonte de Dados</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              $( $healthReport.dataFlow.routes | ForEach-Object {
                $statusClass = if ($_.exists) { "status-mapped" } else { "status-missing" }
                $statusText = if ($_.exists) { "MAPEADA" } else { "FALTANDO" }
                @"
              <tr>
                <td>$($_.path)</td>
                <td>$($_.file)</td>
                <td>$($_.layer)</td>
                <td>$($_.dataSource)</td>
                <td><span class="status-badge $statusClass">$statusText</span></td>
              </tr>
"@
              })
            </tbody>
          </table>
        </div>
        
        <div class="audit-section">
          <h3>Camadas de Dados (L0-L5)</h3>
          $( $healthReport.dataFlow.dataLayers | ForEach-Object {
            @"
          <div class="flow-item">
            <strong>$($_.layer)</strong> - $($_.description)<br>
            <small>Componentes: $($_.components -join ', ')</small>
          </div>
"@
          })
        </div>
        
        <div class="audit-section">
          <h3>Conexões de Dados</h3>
          <table class="data-flow-table">
            <thead>
              <tr>
                <th>De</th>
                <th>Para</th>
                <th>Tipo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              $( $healthReport.dataFlow.connections | ForEach-Object {
                @"
              <tr>
                <td>$($_.from)</td>
                <td>$($_.to)</td>
                <td>$($_.type)</td>
                <td><span class="status-badge status-connected">$($_.status)</span></td>
              </tr>
"@
              })
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- AUDIT SECTION -->
      <div class="section">
        <h2 class="section-title">✅ Auditoria de Integridade</h2>
        
        $( @("fileStructure", "dependencies", "typeSystem", "dataIntegrity", "codeQuality", "security") | ForEach-Object {
          $section = $_
          $data = $auditSummary[$section]
          $passRate = if (($data.passed + $data.failed) -gt 0) {
            [math]::Round(($data.passed / ($data.passed + $data.failed)) * 100, 2)
          } else { 0 }
          
          @"
        <div class="audit-section">
          <h3>$($section -replace '([A-Z])', ' $1' | Get-Culture | ForEach-Object { $_.TextInfo.ToTitleCase($_) })</h3>
          <div class="progress-bar">
            <div class="progress-fill" style="width: $passRate%;">$passRate%</div>
          </div>
          $( $data.checks | ForEach-Object {
            $statusClass = if ($_.result) { "" } else { "fail" }
            $icon = if ($_.result) { "✓" } else { "✗" }
            @"
          <div class="check-item $statusClass">
            <div class="check-icon">$icon</div>
            <div class="check-name">$($_.name)</div>
          </div>
"@
          })
        </div>
"@
        })
      </div>
      
      <!-- RECOMMENDATIONS -->
      $( if ($healthReport.recommendations.Count -gt 0) {
        @"
      <div class="section">
        <h2 class="section-title">💡 Recomendações</h2>
        <div class="recommendations">
          <h3>Ações Sugeridas</h3>
          $( $healthReport.recommendations | ForEach-Object {
            $priorityClass = "priority-$($_.priority.ToLower())"
            @"
          <div class="recommendation-item">
            <span class="recommendation-priority $priorityClass">$($_.priority)</span>
            <strong>$($_.action)</strong><br>
            <small>$($_.details)</small>
          </div>
"@
          })
        </div>
      </div>
"@
      })
      
    </div>
    
    <div class="footer">
      <p>Orbit Dashboard System Health Report | Gerado em $reportDate</p>
      <p>Projeto: $ProjectPath</p>
    </div>
  </div>
</body>
</html>
"@
  
  $html | Out-File $OutputPath -Encoding UTF8
}

# ============================================================================
# SEÇÃO 5: GERAR RELATÓRIO JSON
# ============================================================================

function Generate-HealthJSON {
  param([string]$OutputPath)
  
  Write-HealthLog "Gerando relatório JSON..." -Level "DEBUG"
  $healthReport | ConvertTo-Json -Depth 10 | Out-File $OutputPath -Encoding UTF8
}

# ============================================================================
# EXECUÇÃO PRINCIPAL
# ============================================================================

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  ORBIT DASHBOARD - SYSTEM HEALTH INTEGRATION              ║" -ForegroundColor Magenta
Write-Host "║  Data Flow Mapping + Integrity Audit + Health Dashboard   ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

Write-HealthLog "Iniciando integração de saúde do sistema..." -Level "INFO"
Write-HealthLog "Projeto: $ProjectPath" -Level "INFO"

# Executar análises
$dataFlow = Map-DataFlow
$audit = Run-ComprehensiveAudit
$health = Analyze-SystemHealth -DataFlow $dataFlow -Audit $audit

# Gerar relatórios
if ($GenerateHTML) {
  $htmlPath = Join-Path $OutputDir "health-report-$timestamp.html"
  Generate-HealthHTML -OutputPath $htmlPath
  Write-HealthLog "✅ Relatório HTML: $htmlPath" -Level "SUCCESS"
}

if ($GenerateJSON) {
  $jsonPath = Join-Path $OutputDir "health-report-$timestamp.json"
  Generate-HealthJSON -OutputPath $jsonPath
  Write-HealthLog "✅ Relatório JSON: $jsonPath" -Level "SUCCESS"
}

# Exibir resumo
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  RESUMO DA SAÚDE DO SISTEMA                               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "$($health.icon) Status Geral: " -NoNewline -ForegroundColor White
Write-Host "$($health.overall)" -ForegroundColor $health.color

Write-Host "📊 Score de Saúde: " -NoNewline -ForegroundColor White
Write-Host "$($health.score)%" -ForegroundColor $health.color

Write-Host "✅ Verificações Passou: " -NoNewline -ForegroundColor White
Write-Host "$($health.passed)/$($health.totalChecks)" -ForegroundColor Green

Write-Host "❌ Verificações Falhou: " -NoNewline -ForegroundColor White
Write-Host "$($health.failed)" -ForegroundColor $(if ($health.failed -gt 0) { "Red" } else { "Green" })

Write-Host "📈 Taxa de Sucesso: " -NoNewline -ForegroundColor White
Write-Host "$($health.passRate)%" -ForegroundColor $health.color

if ($healthReport.criticalIssues.Count -gt 0) {
  Write-Host "`n🚨 PROBLEMAS CRÍTICOS:" -ForegroundColor Red
  $healthReport.criticalIssues | ForEach-Object { Write-Host "  • $_" -ForegroundColor Red }
}

if ($healthReport.recommendations.Count -gt 0) {
  Write-Host "`n💡 RECOMENDAÇÕES:" -ForegroundColor Yellow
  $healthReport.recommendations | ForEach-Object {
    Write-Host "  [$($_.priority)] $($_.action)" -ForegroundColor Yellow
  }
}

Write-Host "`n✅ Integração de saúde concluída com sucesso!`n" -ForegroundColor Green

if ($OpenBrowser -and $GenerateHTML) {
  $htmlPath = Join-Path $OutputDir "health-report-$timestamp.html"
  Start-Process $htmlPath
}