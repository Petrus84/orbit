# ============================================================================
# ORBIT DASHBOARD - DATA FLOW AUDIT SCRIPT
# PowerShell 7.6.6
# Auditor de Fluxo de Dados Completo
# ============================================================================

param(
  [string]$ProjectPath = "C:\Projetos\orbit-dashboard",
  [string]$OutputFile = ".\audit-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json",
  [switch]$Verbose = $false,
  [switch]$GenerateHTML = $false
)

# ============================================================================
# CONFIGURAÇÃO INICIAL
# ============================================================================

$ErrorActionPreference = "Continue"
$WarningPreference = "Continue"

$auditResults = @{
  timestamp = Get-Date -Format "o"
  projectPath = $ProjectPath
  sections = @{}
  summary = @{
    totalChecks = 0
    passed = 0
    failed = 0
    warnings = 0
  }
  errors = @()
}

function Write-AuditLog {
  param(
    [string]$Message,
    [ValidateSet("INFO", "SUCCESS", "WARNING", "ERROR", "DEBUG")][string]$Level = "INFO"
  )
  
  $timestamp = Get-Date -Format "HH:mm:ss"
  $color = @{
    "INFO"    = "Cyan"
    "SUCCESS" = "Green"
    "WARNING" = "Yellow"
    "ERROR"   = "Red"
    "DEBUG"   = "Gray"
  }[$Level]
  
  Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
  
  if ($Verbose -and $Level -eq "DEBUG") {
    Write-Host "  └─ $Message" -ForegroundColor DarkGray
  }
}

function Add-AuditCheck {
  param(
    [string]$Section,
    [string]$CheckName,
    [bool]$Result,
    [string]$Details = "",
    [string]$Severity = "ERROR"
  )
  
  $auditResults.summary.totalChecks++
  
  if ($Result) {
    $auditResults.summary.passed++
    $status = "PASS"
    $color = "Green"
  } else {
    if ($Severity -eq "WARNING") {
      $auditResults.summary.warnings++
      $status = "WARN"
      $color = "Yellow"
    } else {
      $auditResults.summary.failed++
      $status = "FAIL"
      $color = "Red"
    }
  }
  
  if (-not $auditResults.sections[$Section]) {
    $auditResults.sections[$Section] = @()
  }
  
  $auditResults.sections[$Section] += @{
    checkName = $CheckName
    status = $status
    result = $Result
    details = $Details
    severity = $Severity
    timestamp = Get-Date -Format "o"
  }
  
  Write-AuditLog "$Section - $CheckName: $status" -Level $status
  if ($Details) {
    Write-AuditLog "  └─ $Details" -Level "DEBUG"
  }
}

# ============================================================================
# 1. VALIDAÇÃO DE ESTRUTURA DE ARQUIVOS
# ============================================================================

function Test-FileStructure {
  Write-AuditLog "=== INICIANDO AUDITORIA DE ESTRUTURA ===" -Level "INFO"
  
  $requiredDirs = @(
    "src/actions",
    "src/app",
    "src/components",
    "src/context",
    "src/hooks",
    "src/lib",
    "src/types",
    "src/styles"
  )
  
  foreach ($dir in $requiredDirs) {
    $fullPath = Join-Path $ProjectPath $dir
    $exists = Test-Path $fullPath -PathType Container
    Add-AuditCheck -Section "FileStructure" -CheckName "Directory: $dir" -Result $exists `
      -Details "Path: $fullPath" -Severity $(if ($exists) { "INFO" } else { "ERROR" })
  }
  
  $requiredFiles = @(
    "package.json",
    "tsconfig.json",
    "next.config.js",
    ".env.local"
  )
  
  foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $ProjectPath $file
    $exists = Test-Path $fullPath -PathType Leaf
    Add-AuditCheck -Section "FileStructure" -CheckName "File: $file" -Result $exists `
      -Details "Path: $fullPath" -Severity $(if ($exists) { "INFO" } else { "ERROR" })
  }
}

# ============================================================================
# 2. VALIDAÇÃO DE DEPENDÊNCIAS
# ============================================================================

function Test-Dependencies {
  Write-AuditLog "=== AUDITANDO DEPENDÊNCIAS ===" -Level "INFO"
  
  $packageJsonPath = Join-Path $ProjectPath "package.json"
  
  if (Test-Path $packageJsonPath) {
    $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
    
    $criticalDeps = @(
      "next",
      "react",
      "react-dom",
      "@supabase/supabase-js",
      "zod",
      "typescript"
    )
    
    foreach ($dep in $criticalDeps) {
      $depExists = $packageJson.dependencies.PSObject.Properties.Name -contains $dep
      $version = if ($depExists) { $packageJson.dependencies.$dep } else { "N/A" }
      
      Add-AuditCheck -Section "Dependencies" -CheckName "Dependency: $dep" -Result $depExists `
        -Details "Version: $version" -Severity $(if ($depExists) { "INFO" } else { "ERROR" })
    }
    
    # Verificar scripts
    $scripts = @("dev", "build", "lint", "check:db")
    foreach ($script in $scripts) {
      $scriptExists = $packageJson.scripts.PSObject.Properties.Name -contains $script
      Add-AuditCheck -Section "Dependencies" -CheckName "Script: $script" -Result $scriptExists `
        -Details "Command: $($packageJson.scripts.$script)" -Severity "WARNING"
    }
  }
}

# ============================================================================
# 3. VALIDAÇÃO DE CONFIGURAÇÃO TYPESCRIPT
# ============================================================================

function Test-TypeScriptConfig {
  Write-AuditLog "=== VALIDANDO CONFIGURAÇÃO TYPESCRIPT ===" -Level "INFO"
  
  $tsconfigPath = Join-Path $ProjectPath "tsconfig.json"
  
  if (Test-Path $tsconfigPath) {
    $tsconfig = Get-Content $tsconfigPath | ConvertFrom-Json
    
    $requiredCompilerOptions = @(
      "strict",
      "esModuleInterop",
      "skipLibCheck",
      "forceConsistentCasingInFileNames"
    )
    
    foreach ($option in $requiredCompilerOptions) {
      $optionExists = $tsconfig.compilerOptions.PSObject.Properties.Name -contains $option
      Add-AuditCheck -Section "TypeScript" -CheckName "CompilerOption: $option" -Result $optionExists `
        -Details "Value: $($tsconfig.compilerOptions.$option)" -Severity "WARNING"
    }
  }
}

# ============================================================================
# 4. VALIDAÇÃO DE TIPOS DE BANCO DE DADOS
# ============================================================================

function Test-DatabaseTypes {
  Write-AuditLog "=== AUDITANDO TIPOS DE BANCO DE DADOS ===" -Level "INFO"
  
  $dbTypesPath = Join-Path $ProjectPath "src/types/database.types.ts"
  
  if (Test-Path $dbTypesPath) {
    $dbTypesContent = Get-Content $dbTypesPath -Raw
    
    $requiredTables = @(
      "clients",
      "alerts",
      "ig_posts",
      "ig_account_snapshots",
      "ig_audience_snapshots",
      "ads_meta_campaigns",
      "ads_google_campaigns",
      "funnel_data"
    )
    
    foreach ($table in $requiredTables) {
      $tableExists = $dbTypesContent -match "Tables:\s*\{[^}]*$table"
      Add-AuditCheck -Section "DatabaseTypes" -CheckName "Table: $table" -Result $tableExists `
        -Details "Defined in database.types.ts" -Severity "ERROR"
    }
    
    $requiredViews = @(
      "v_avatar_alignment",
      "v_client_metrics",
      "v_creative_fatigue",
      "v_quality_scores"
    )
    
    foreach ($view in $requiredViews) {
      $viewExists = $dbTypesContent -match "Views:\s*\{[^}]*$view"
      Add-AuditCheck -Section "DatabaseTypes" -CheckName "View: $view" -Result $viewExists `
        -Details "Defined in database.types.ts" -Severity "WARNING"
    }
  }
}

# ============================================================================
# 5. VALIDAÇÃO DE MAPPERS E SCHEMAS
# ============================================================================

function Test-MappersAndSchemas {
  Write-AuditLog "=== VALIDANDO MAPPERS E SCHEMAS ===" -Level "INFO"
  
  $mapperDirs = @(
    "src/lib/mappers/avatarAlignment",
    "src/lib/mappers/clientOnboarding",
    "src/lib/mappers/orbitAlert",
    "src/lib/mappers/refThreshold"
  )
  
  foreach ($mapperDir in $mapperDirs) {
    $fullPath = Join-Path $ProjectPath $mapperDir
    $exists = Test-Path $fullPath -PathType Container
    
    if ($exists) {
      $mapperFile = Join-Path $fullPath "*.mapper.ts"
      $schemaFile = Join-Path $fullPath "*.schema.ts"
      $indexFile = Join-Path $fullPath "index.ts"
      
      $hasMapper = (Get-Item $mapperFile -ErrorAction SilentlyContinue).Count -gt 0
      $hasSchema = (Get-Item $schemaFile -ErrorAction SilentlyContinue).Count -gt 0
      $hasIndex = Test-Path $indexFile
      
      Add-AuditCheck -Section "Mappers" -CheckName "Mapper: $(Split-Path $mapperDir -Leaf)" `
        -Result ($hasMapper -and $hasSchema -and $hasIndex) `
        -Details "Mapper: $hasMapper, Schema: $hasSchema, Index: $hasIndex" -Severity "ERROR"
    } else {
      Add-AuditCheck -Section "Mappers" -CheckName "Directory: $(Split-Path $mapperDir -Leaf)" `
        -Result $false -Details "Directory not found" -Severity "ERROR"
    }
  }
}

# ============================================================================
# 6. VALIDAÇÃO DE REPOSITÓRIOS
# ============================================================================

function Test-Repositories {
  Write-AuditLog "=== AUDITANDO REPOSITÓRIOS ===" -Level "INFO"
  
  $repoDir = Join-Path $ProjectPath "src/lib/repositories"
  $requiredRepos = @(
    "alertsRepository.ts",
    "avatarRepository.ts",
    "clientsRepository.ts",
    "funnelRepository.ts",
    "instagramOverviewRepository.ts",
    "onboardingRepository.ts"
  )
  
  foreach ($repo in $requiredRepos) {
    $fullPath = Join-Path $repoDir $repo
    $exists = Test-Path $fullPath -PathType Leaf
    
    if ($exists) {
      $content = Get-Content $fullPath -Raw
      $hasExports = $content -match "export\s+(class|function|const)"
      Add-AuditCheck -Section "Repositories" -CheckName "Repository: $repo" -Result $hasExports `
        -Details "Exports found: $hasExports" -Severity "ERROR"
    } else {
      Add-AuditCheck -Section "Repositories" -CheckName "Repository: $repo" -Result $false `
        -Details "File not found" -Severity "ERROR"
    }
  }
}

# ============================================================================
# 7. VALIDAÇÃO DE HOOKS
# ============================================================================

function Test-Hooks {
  Write-AuditLog "=== VALIDANDO CUSTOM HOOKS ===" -Level "INFO"
  
  $hooksDir = Join-Path $ProjectPath "src/hooks"
  $requiredHooks = @(
    "useAlerts.ts",
    "useAvatar.ts",
    "useClientNow.ts",
    "useClients.ts",
    "useFunnel.ts",
    "useInstagramOverview.ts",
    "useOnboarding.ts"
  )
  
  foreach ($hook in $requiredHooks) {
    $fullPath = Join-Path $hooksDir $hook
    $exists = Test-Path $fullPath -PathType Leaf
    
    if ($exists) {
      $content = Get-Content $fullPath -Raw
      $isValidHook = $content -match "export\s+function\s+use[A-Z]"
      Add-AuditCheck -Section "Hooks" -CheckName "Hook: $hook" -Result $isValidHook `
        -Details "Valid hook pattern: $isValidHook" -Severity "ERROR"
    } else {
      Add-AuditCheck -Section "Hooks" -CheckName "Hook: $hook" -Result $false `
        -Details "File not found" -Severity "ERROR"
    }
  }
}

# ============================================================================
# 8. VALIDAÇÃO DE COMPONENTES
# ============================================================================

function Test-Components {
  Write-AuditLog "=== AUDITANDO COMPONENTES ===" -Level "INFO"
  
  $componentDirs = @(
    "src/components/common",
    "src/components/content",
    "src/components/kpi",
    "src/components/layout",
    "src/components/screens"
  )
  
  foreach ($compDir in $componentDirs) {
    $fullPath = Join-Path $ProjectPath $compDir
    $exists = Test-Path $fullPath -PathType Container
    
    if ($exists) {
      $tsxFiles = @(Get-ChildItem $fullPath -Filter "*.tsx" -ErrorAction SilentlyContinue).Count
      $cssModules = @(Get-ChildItem $fullPath -Filter "*.module.css" -ErrorAction SilentlyContinue).Count
      
      Add-AuditCheck -Section "Components" -CheckName "Directory: $(Split-Path $compDir -Leaf)" `
        -Result ($tsxFiles -gt 0) -Details "TSX files: $tsxFiles, CSS Modules: $cssModules" -Severity "WARNING"
    }
  }
}

# ============================================================================
# 9. VALIDAÇÃO DE PÁGINAS E ROTAS
# ============================================================================

function Test-PagesAndRoutes {
  Write-AuditLog "=== VALIDANDO PÁGINAS E ROTAS ===" -Level "INFO"
  
  $appDir = Join-Path $ProjectPath "src/app"
  $requiredPages = @(
    "(dashboard)/alertas/page.tsx",
    "(dashboard)/avatar/page.tsx",
    "(dashboard)/carteira/page.tsx",
    "(dashboard)/funil/page.tsx",
    "(dashboard)/onboarding/page.tsx",
    "instagram/page.tsx",
    "api/admin/clients/route.ts"
  )
  
  foreach ($page in $requiredPages) {
    $fullPath = Join-Path $appDir $page
    $exists = Test-Path $fullPath -PathType Leaf
    Add-AuditCheck -Section "Routes" -CheckName "Page: $page" -Result $exists `
      -Details "Path: $fullPath" -Severity "ERROR"
  }
}

# ============================================================================
# 10. VALIDAÇÃO DE CONTEXTO E STATE MANAGEMENT
# ============================================================================

function Test-ContextAndState {
  Write-AuditLog "=== VALIDANDO CONTEXTO E STATE ===" -Level "INFO"
  
  $contextPath = Join-Path $ProjectPath "src/context/OrbitDashboardContext.tsx"
  $contextExists = Test-Path $contextPath -PathType Leaf
  
  if ($contextExists) {
    $content = Get-Content $contextPath -Raw
    $hasProvider = $content -match "createContext"
    $hasHook = $content -match "useContext"
    
    Add-AuditCheck -Section "Context" -CheckName "OrbitDashboardContext" -Result ($hasProvider -and $hasHook) `
      -Details "Has Provider: $hasProvider, Has Hook: $hasHook" -Severity "ERROR"
  } else {
    Add-AuditCheck -Section "Context" -CheckName "OrbitDashboardContext" -Result $false `
      -Details "File not found" -Severity "ERROR"
  }
}

# ============================================================================
# 11. VALIDAÇÃO DE AUTENTICAÇÃO
# ============================================================================

function Test-Authentication {
  Write-AuditLog "=== AUDITANDO AUTENTICAÇÃO ===" -Level "INFO"
  
  $authPath = Join-Path $ProjectPath "src/lib/auth/admin-guard.ts"
  $authExists = Test-Path $authPath -PathType Leaf
  
  $supabaseServerPath = Join-Path $ProjectPath "src/lib/supabase/server.ts"
  $supabaseServerExists = Test-Path $supabaseServerPath -PathType Leaf
  
  $supabasePath = Join-Path $ProjectPath "src/lib/supabase.ts"
  $supabaseExists = Test-Path $supabasePath -PathType Leaf
  
  Add-AuditCheck -Section "Auth" -CheckName "Admin Guard" -Result $authExists `
    -Details "Path: $authPath" -Severity "ERROR"
  
  Add-AuditCheck -Section "Auth" -CheckName "Supabase Server" -Result $supabaseServerExists `
    -Details "Path: $supabaseServerPath" -Severity "ERROR"
  
  Add-AuditCheck -Section "Auth" -CheckName "Supabase Client" -Result $supabaseExists `
    -Details "Path: $supabasePath" -Severity "ERROR"
}

# ============================================================================
# 12. VALIDAÇÃO DE CONSTANTES E CONFIGURAÇÕES
# ============================================================================

function Test-Constants {
  Write-AuditLog "=== VALIDANDO CONSTANTES ===" -Level "INFO"
  
  $constantsPath = Join-Path $ProjectPath "src/lib/constants.ts"
  $tokensPath = Join-Path $ProjectPath "src/lib/tokens.ts"
  $designTokensPath = Join-Path $ProjectPath "src/styles/ssot-design-tokens.css"
  
  $constantsExists = Test-Path $constantsPath -PathType Leaf
  $tokensExists = Test-Path $tokensPath -PathType Leaf
  $designTokensExists = Test-Path $designTokensPath -PathType Leaf
  
  Add-AuditCheck -Section "Config" -CheckName "Constants" -Result $constantsExists `
    -Details "Path: $constantsPath" -Severity "WARNING"
  
  Add-AuditCheck -Section "Config" -CheckName "Tokens" -Result $tokensExists `
    -Details "Path: $tokensPath" -Severity "WARNING"
  
  Add-AuditCheck -Section "Config" -CheckName "Design Tokens CSS" -Result $designTokensExists `
    -Details "Path: $designTokensPath" -Severity "WARNING"
}

# ============================================================================
# 13. VALIDAÇÃO DE ENUMS E TIPOS
# ============================================================================

function Test-EnumsAndTypes {
  Write-AuditLog "=== VALIDANDO ENUMS E TIPOS ===" -Level "INFO"
  
  $typesDir = Join-Path $ProjectPath "src/types"
  $requiredTypes = @(
    "alert.ts",
    "avatar.ts",
    "client.ts",
    "funnel.ts",
    "instagram.ts",
    "orbit.ts",
    "supabase.ts"
  )
  
  foreach ($type in $requiredTypes) {
    $fullPath = Join-Path $typesDir $type
    $exists = Test-Path $fullPath -PathType Leaf
    Add-AuditCheck -Section "Types" -CheckName "Type: $type" -Result $exists `
      -Details "Path: $fullPath" -Severity "ERROR"
  }
}

# ============================================================================
# 14. VALIDAÇÃO DE ACTIONS (SERVER ACTIONS)
# ============================================================================

function Test-ServerActions {
  Write-AuditLog "=== VALIDANDO SERVER ACTIONS ===" -Level "INFO"
  
  $actionsDir = Join-Path $ProjectPath "src/actions"
  $actionsExists = Test-Path $actionsDir -PathType Container
  
  if ($actionsExists) {
    $actionFiles = @(Get-ChildItem $actionsDir -Filter "*.ts" -ErrorAction SilentlyContinue)
    $hasActions = $actionFiles.Count -gt 0
    
    foreach ($action in $actionFiles) {
      $content = Get-Content $action.FullName -Raw
      $isServerAction = $content -match "'use server'"
      Add-AuditCheck -Section "ServerActions" -CheckName "Action: $($action.Name)" -Result $isServerAction `
        -Details "Is server action: $isServerAction" -Severity "WARNING"
    }
  } else {
    Add-AuditCheck -Section "ServerActions" -CheckName "Actions Directory" -Result $false `
      -Details "Directory not found" -Severity "WARNING"
  }
}

# ============================================================================
# 15. VALIDAÇÃO DE FLUXO DE DADOS
# ============================================================================

function Test-DataFlow {
  Write-AuditLog "=== AUDITANDO FLUXO DE DADOS ===" -Level "INFO"
  
  # Verificar ligação entre componentes e hooks
  $screenDir = Join-Path $ProjectPath "src/components/screens"
  $screenFiles = @(Get-ChildItem $screenDir -Filter "*.tsx" -ErrorAction SilentlyContinue)
  
  foreach ($screen in $screenFiles) {
    $content = Get-Content $screen.FullName -Raw
    $usesHooks = $content -match "use[A-Z]\w+\(\)"
    Add-AuditCheck -Section "DataFlow" -CheckName "Screen: $($screen.BaseName) uses hooks" -Result $usesHooks `
      -Details "File: $($screen.Name)" -Severity "WARNING"
  }
  
  # Verificar ligação entre repositórios e banco de dados
  $repoDir = Join-Path $ProjectPath "src/lib/repositories"
  $repoFiles = @(Get-ChildItem $repoDir -Filter "*.ts" -ErrorAction SilentlyContinue)
  
  foreach ($repo in $repoFiles) {
    $content = Get-Content $repo.FullName -Raw
    $usesSupabase = $content -match "supabase|createClient"
    Add-AuditCheck -Section "DataFlow" -CheckName "Repository: $($repo.BaseName) uses DB" -Result $usesSupabase `
      -Details "File: $($repo.Name)" -Severity "WARNING"
  }
}

# ============================================================================
# 16. VALIDAÇÃO DE ESTILOS
# ============================================================================

function Test-Styles {
  Write-AuditLog "=== VALIDANDO ESTILOS ===" -Level "INFO"
  
  $stylesDir = Join-Path $ProjectPath "src/styles"
  $requiredStyles = @(
    "ssot-design-tokens.css",
    "ssot-globals.css"
  )
  
  foreach ($style in $requiredStyles) {
    $fullPath = Join-Path $stylesDir $style
    $exists = Test-Path $fullPath -PathType Leaf
    Add-AuditCheck -Section "Styles" -CheckName "Style: $style" -Result $exists `
      -Details "Path: $fullPath" -Severity "WARNING"
  }
  
  # Verificar CSS Modules
  $componentDirs = @(Get-ChildItem (Join-Path $ProjectPath "src/components") -Directory)
  foreach ($compDir in $componentDirs) {
    $cssModules = @(Get-ChildItem $compDir.FullName -Filter "*.module.css" -Recurse)
    $hasModules = $cssModules.Count -gt 0
    Add-AuditCheck -Section "Styles" -CheckName "CSS Modules: $($compDir.Name)" -Result $hasModules `
      -Details "Found: $($cssModules.Count) modules" -Severity "WARNING"
  }
}

# ============================================================================
# 17. VALIDAÇÃO DE CONFIGURAÇÃO DO NEXT.JS
# ============================================================================

function Test-NextConfig {
  Write-AuditLog "=== VALIDANDO CONFIGURAÇÃO NEXT.JS ===" -Level "INFO"
  
  $nextConfigPath = Join-Path $ProjectPath "next.config.js"
  
  if (Test-Path $nextConfigPath) {
    $content = Get-Content $nextConfigPath -Raw
    
    $hasExports = $content -match "module\.exports|export\s+default"
    $hasReact = $content -match "react"
    
    Add-AuditCheck -Section "NextConfig" -CheckName "Has exports" -Result $hasExports `
      -Details "Configuration found" -Severity "WARNING"
    
    Add-AuditCheck -Section "NextConfig" -CheckName "React config" -Result $hasReact `
      -Details "React configuration present" -Severity "WARNING"
  }
}

# ============================================================================
# 18. VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
# ============================================================================

function Test-Environment {
  Write-AuditLog "=== VALIDANDO VARIÁVEIS DE AMBIENTE ===" -Level "INFO"
  
  $envPath = Join-Path $ProjectPath ".env.local"
  $envExamplePath = Join-Path $ProjectPath ".env.example"
  
  $envExists = Test-Path $envPath -PathType Leaf
  $envExampleExists = Test-Path $envExamplePath -PathType Leaf
  
  Add-AuditCheck -Section "Environment" -CheckName ".env.local exists" -Result $envExists `
    -Details "Path: $envPath" -Severity "ERROR"
  
  if ($envExists) {
    $envContent = Get-Content $envPath -Raw
    $requiredVars = @(
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    )
    
    foreach ($var in $requiredVars) {
      $hasVar = $envContent -match "$var\s*="
      Add-AuditCheck -Section "Environment" -CheckName "Variable: $var" -Result $hasVar `
        -Details "Required for Supabase" -Severity "ERROR"
    }
  }
  
  Add-AuditCheck -Section "Environment" -CheckName ".env.example exists" -Result $envExampleExists `
    -Details "Path: $envExamplePath" -Severity "WARNING"
}

# ============================================================================
# 19. VALIDAÇÃO DE INTEGRIDADE DE REFERÊNCIAS
# ============================================================================

function Test-ReferentialIntegrity {
  Write-AuditLog "=== VALIDANDO INTEGRIDADE DE REFERÊNCIAS ===" -Level "INFO"
  
  $srcDir = Join-Path $ProjectPath "src"
  $tsFiles = @(Get-ChildItem $srcDir -Filter "*.ts" -Recurse) + @(Get-ChildItem $srcDir -Filter "*.tsx" -Recurse)
  
  $importErrors = @()
  
  foreach ($file in $tsFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Verificar imports não resolvidos
    $imports = [regex]::Matches($content, "from\s+['\"]([^'\"]+)['\"]")
    
    foreach ($import in $imports) {
      $importPath = $import.Groups[1].Value
      
      # Pular imports de node_modules e externos
      if ($importPath -match "^[@\.]") {
        $resolvedPath = $importPath -replace "^@/", "$srcDir\"
        $resolvedPath = $resolvedPath -replace "^\.\/", "$($file.Directory)\"
        
        # Verificar se arquivo existe
        $fileExists = Test-Path "$resolvedPath.ts" -PathType Leaf
        $fileExists = $fileExists -or (Test-Path "$resolvedPath.tsx" -PathType Leaf)
        $fileExists = $fileExists -or (Test-Path "$resolvedPath/index.ts" -PathType Leaf)
        
        if (-not $fileExists -and -not ($importPath -match "^[a-z]")) {
          $importErrors += @{
            file = $file.Name
            import = $importPath
            resolved = $resolvedPath
          }
        }
      }
    }
  }
  
  $hasErrors = $importErrors.Count -gt 0
  Add-AuditCheck -Section "Integrity" -CheckName "Import resolution" -Result (-not $hasErrors) `
    -Details "Unresolved imports: $($importErrors.Count)" -Severity $(if ($hasErrors) { "WARNING" } else { "INFO" })
}

# ============================================================================
# 20. RELATÓRIO FINAL
# ============================================================================

function Generate-Report {
  Write-AuditLog "`n=== RELATÓRIO FINAL ===" -Level "INFO"
  
  $totalChecks = $auditResults.summary.totalChecks
  $passed = $auditResults.summary.passed
  $failed = $auditResults.summary.failed
  $warnings = $auditResults.summary.warnings
  
  $passRate = if ($totalChecks -gt 0) { [math]::Round(($passed / $totalChecks) * 100, 2) } else { 0 }
  
  Write-AuditLog "Total de Verificações: $totalChecks" -Level "INFO"
  Write-AuditLog "Passou: $passed ✓" -Level "SUCCESS"
  Write-AuditLog "Falhou: $failed ✗" -Level $(if ($failed -gt 0) { "ERROR" } else { "INFO" })
  Write-AuditLog "Avisos: $warnings ⚠" -Level $(if ($warnings -gt 0) { "WARNING" } else { "INFO" })
  Write-AuditLog "Taxa de Sucesso: $passRate%" -Level $(if ($passRate -ge 80) { "SUCCESS" } else { "WARNING" })
  
  # Salvar JSON
  $auditResults | ConvertTo-Json -Depth 10 | Out-File $OutputFile -Encoding UTF8
  Write-AuditLog "Relatório salvo em: $OutputFile" -Level "SUCCESS"
  
  # Gerar HTML se solicitado
  if ($GenerateHTML) {
    Generate-HTMLReport
  }
}

function Generate-HTMLReport {
  $htmlFile = $OutputFile -replace "\.json$", ".html"
  
  $html = @"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orbit Dashboard - Audit Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
    h1 { color: #333; margin-bottom: 30px; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .summary-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .summary-card h3 { font-size: 14px; opacity: 0.9; margin-bottom: 10px; }
    .summary-card .value { font-size: 32px; font-weight: bold; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #333; font-size: 20px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; }
    .check { display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: #f9f9f9; border-left: 4px solid #ddd; border-radius: 4px; }
    .check.pass { border-left-color: #28a745; background: #f0f8f5; }
    .check.fail { border-left-color: #dc3545; background: #fdf5f5; }
    .check.warn { border-left-color: #ffc107; background: #fffbf0; }
    .check-icon { font-size: 20px; margin-right: 15px; min-width: 30px; }
    .check-content { flex: 1; }
    .check-name { font-weight: 600; color: #333; }
    .check-details { font-size: 12px; color: #666; margin-top: 4px; }
    .timestamp { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Orbit Dashboard - Data Flow Audit Report</h1>
    <p style="color: #666; margin-bottom: 20px;">Gerado em: $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")</p>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total de Verificações</h3>
        <div class="value">$($auditResults.summary.totalChecks)</div>
      </div>
      <div class="summary-card success">
        <h3>Passou</h3>
        <div class="value">$($auditResults.summary.passed)</div>
      </div>
      <div class="summary-card warning">
        <h3>Falhou</h3>
        <div class="value">$($auditResults.summary.failed)</div>
      </div>
      <div class="summary-card warning">
        <h3>Avisos</h3>
        <div class="value">$($auditResults.summary.warnings)</div>
      </div>
    </div>
"@
  
  foreach ($section in $auditResults.sections.GetEnumerator()) {
    $html += "<div class='section'><h2>$($section.Name)</h2>"
    
    foreach ($check in $section.Value) {
      $statusClass = $check.status.ToLower()
      $icon = @{ "pass" = "✓"; "fail" = "✗"; "warn" = "⚠" }[$statusClass]
      
      $html += @"
      <div class="check $statusClass">
        <div class="check-icon">$icon</div>
        <div class="check-content">
          <div class="check-name">$($check.checkName)</div>
          <div class="check-details">$($check.details)</div>
          <div class="timestamp">$($check.timestamp)</div>
        </div>
      </div>
"@
    }
    
    $html += "</div>"
  }
  
  $html += "</div></body></html>"
  
  $html | Out-File $htmlFile -Encoding UTF8
  Write-AuditLog "Relatório HTML salvo em: $htmlFile" -Level "SUCCESS"
}

# ============================================================================
# EXECUÇÃO PRINCIPAL
# ============================================================================

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ORBIT DASHBOARD - DATA FLOW AUDIT                        ║" -ForegroundColor Cyan
Write-Host "║  PowerShell 7.6.6                                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-AuditLog "Iniciando auditoria em: $ProjectPath" -Level "INFO"

# Executar todas as validações
Test-FileStructure
Test-Dependencies
Test-TypeScriptConfig
Test-DatabaseTypes
Test-MappersAndSchemas
Test-Repositories
Test-Hooks
Test-Components
Test-PagesAndRoutes
Test-ContextAndState
Test-Authentication
Test-Constants
Test-EnumsAndTypes
Test-ServerActions
Test-DataFlow
Test-Styles
Test-NextConfig
Test-Environment
Test-ReferentialIntegrity

# Gerar relatório
Generate-Report

Write-Host "`n✓ Auditoria concluída com sucesso!`n" -ForegroundColor Green