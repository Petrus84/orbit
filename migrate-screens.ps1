#Requires -Version 7.0
<#
.SYNOPSIS
    ORBIT Dashboard — Migração + Correção Cirúrgica de Imports (bck/ → orbit-dashboard/)

.DESCRIPTION
    1. Valida estrutura de src/components/common/
    2. Copia *Screen.tsx de bck/ para src/components/screens/ (com backup)
    3. Corrige imports default → named, e ajusta path relativo (./common → ../common)
    4. Sinaliza parâmetros 'any' implícito óbvios (heurística — não adivinha tipo)
    5. Roda tsc --noEmit e reporta TS2307 / TS7006 remanescentes
    6. Gera relatório em orbit-migration-report.txt

.USAGE
    cd C:\Users\DELL\Downloads\Alpha\orbit-dashboard
    .\migrate-screens.ps1

    # Dry-run (mostra o que faria, não escreve nada):
    .\migrate-screens.ps1 -DryRun
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\Users\DELL\Downloads\Alpha\orbit-dashboard",
    [string]$BackupSourceRoot = "C:\Users\DELL\Downloads\Alpha\bck",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ReportLines = New-Object System.Collections.Generic.List[string]

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
    $ReportLines.Add($Message)
}

function Write-Section {
    param([string]$Title)
    $line = "`n" + ("=" * 78)
    Write-Log $line "DarkCyan"
    Write-Log "  $Title" "Cyan"
    Write-Log ("=" * 78) "DarkCyan"
}

Write-Section "ORBIT Dashboard — Migração de Screens — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

if ($DryRun) {
    Write-Log "  MODO DRY-RUN ATIVO — nenhum arquivo será escrito" "Yellow"
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 0 — Validação de ambiente
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[0/6] Validando ambiente"

$CommonDir  = Join-Path $ProjectRoot "src\components\common"
$ScreensDir = Join-Path $ProjectRoot "src\components\screens"

if (-not (Test-Path $ProjectRoot)) {
    Write-Log "  ❌ Projeto não encontrado: $ProjectRoot" "Red"
    exit 1
}
Write-Log "  ✅ Projeto encontrado: $ProjectRoot" "Green"

if (-not (Test-Path $BackupSourceRoot)) {
    Write-Log "  ❌ Pasta bck/ não encontrada: $BackupSourceRoot" "Red"
    exit 1
}
Write-Log "  ✅ Pasta bck/ encontrada: $BackupSourceRoot" "Green"

if (-not (Test-Path $CommonDir)) {
    Write-Log "  ❌ src/components/common/ não encontrada: $CommonDir" "Red"
    exit 1
}
Write-Log "  ✅ src/components/common/ encontrada" "Green"

if (-not (Test-Path $ScreensDir)) {
    Write-Log "  ⚠️  src/components/screens/ não existe — criando" "Yellow"
    if (-not $DryRun) { New-Item -ItemType Directory -Path $ScreensDir -Force | Out-Null }
} else {
    Write-Log "  ✅ src/components/screens/ encontrada" "Green"
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 1 — Inventariar componentes disponíveis em common/
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[1/6] Inventariando src/components/common/"

$CommonFiles = Get-ChildItem -Path $CommonDir -Filter "*.tsx" -File
$CommonNames = $CommonFiles | ForEach-Object { $_.BaseName }

Write-Log "  📦 $($CommonNames.Count) componentes encontrados em common/:"
foreach ($name in $CommonNames | Sort-Object) {
    Write-Log "     - $name"
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 2 — Lista de arquivos a processar
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[2/6] Arquivos a processar"

$FilesToProcess = @(
    "FunnelScreen.tsx",
    "CarteiraScreen (1).tsx",
    "AlertasScreen.tsx",
    "IGOverviewScreen.tsx",
    "MetaAdsScreen.tsx",
    "AvatarScreen.tsx"
)

function Get-CleanScreenName {
    param([string]$FileName)
    return ($FileName -replace '\s*\(\d+\)', '')
}

$ProcessPlan = @()
foreach ($file in $FilesToProcess) {
    $srcPath = Join-Path $BackupSourceRoot $file
    $cleanName = Get-CleanScreenName $file
    $dstPath = Join-Path $ScreensDir $cleanName
    $exists = Test-Path $srcPath

    $ProcessPlan += [PSCustomObject]@{
        SourceFile = $file
        SourcePath = $srcPath
        DestName   = $cleanName
        DestPath   = $dstPath
        Found      = $exists
    }

    if ($exists) {
        Write-Log "  ✅ Encontrado: $file → $cleanName" "Green"
    } else {
        Write-Log "  ⚠️  Não encontrado em bck/: $file" "Yellow"
    }
}

$ValidPlan = $ProcessPlan | Where-Object { $_.Found }
if ($ValidPlan.Count -eq 0) {
    Write-Log "`n  ❌ Nenhum arquivo válido encontrado. Abortando." "Red"
    $ReportLines | Out-File -FilePath (Join-Path $ProjectRoot "orbit-migration-report.txt") -Encoding utf8
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 3 — Backup de segurança (arquivos que já existem em screens/)
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[3/6] Backup de segurança"

$BackupDir = Join-Path $ProjectRoot (".orbit-backup-{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

if (-not $DryRun) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}
Write-Log "  📁 Backup dir: $BackupDir"

foreach ($item in $ValidPlan) {
    if (Test-Path $item.DestPath) {
        $backupTarget = Join-Path $BackupDir $item.DestName
        Write-Log "  💾 Backup de existente: $($item.DestName)"
        if (-not $DryRun) {
            Copy-Item -Path $item.DestPath -Destination $backupTarget -Force
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 4 — Copiar e corrigir imports
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[4/6] Copiando e corrigindo imports"

$FixSummary = @()

foreach ($item in $ValidPlan) {
    Write-Log "`n  ── Processando: $($item.SourceFile)" "Cyan"

    $content = Get-Content -Path $item.SourcePath -Raw -Encoding UTF8
    $originalContent = $content
    $fixesApplied = @()

    # ── FIX 1: import type { X } from './common/Y' → '../common/Y' ──────
    $patternTypeImport = "import\s+type\s+\{([^}]+)\}\s+from\s+'\.\/common\/([^']+)'"
    if ($content -match $patternTypeImport) {
        $content = [regex]::Replace(
            $content, $patternTypeImport, 'import type {$1} from ''../common/$2'''
        )
        $fixesApplied += "import type path: ./common -> ../common"
    }

    # ── FIX 2: import X from './common/Y' (default) -> { X } named ──────
    $patternDefaultImport = "import\s+(\w+)\s+from\s+'\.\/common\/([^']+)'"
    $matches2 = [regex]::Matches($content, $patternDefaultImport)
    foreach ($m in $matches2) {
        $importedName = $m.Groups[1].Value
        $moduleName   = $m.Groups[2].Value
        $replacement  = "import { $importedName } from '../common/$moduleName'"
        $content = $content.Replace($m.Value, $replacement)
        $fixesApplied += "default->named: $importedName from ./common/$moduleName"
    }

    # ── FIX 3: import { X, Y } from './common/Z' (named, path errado) ────
    $patternNamedImport = "import\s+\{([^}]+)\}\s+from\s+'\.\/common\/([^']+)'"
    if ($content -match $patternNamedImport) {
        $content = [regex]::Replace(
            $content, $patternNamedImport, 'import {$1} from ''../common/$2'''
        )
        $fixesApplied += "named import path: ./common -> ../common"
    }

    # ── FIX 4: qualquer sobra de './common/' não capturada acima ─────────
    if ($content -match "'\.\/common\/") {
        $content = $content -replace "'\.\/common\/", "'../common/"
        $fixesApplied += "path residual: ./common -> ../common (catch-all)"
    }

    # ── FIX 5: heurística de TS7006 — só sinaliza, não adivinha tipo ─────
    $implicitAnyPattern = "\.(map|filter|forEach|reduce|find|some|every)\(\s*\(([a-zA-Z_]\w*)\)\s*=>"
    $anyMatches = [regex]::Matches($content, $implicitAnyPattern)
    $anyWarnings = @()
    foreach ($am in $anyMatches) {
        $paramName = $am.Groups[2].Value
        if ($am.Value -notmatch ":\s*\w+\)") {
            $anyWarnings += "  - Possivel TS7006: parametro '$paramName' em .$($am.Groups[1].Value)(...) sem tipo explicito"
        }
    }

    if (-not $DryRun) {
        Set-Content -Path $item.DestPath -Value $content -Encoding UTF8 -NoNewline
    }

    if ($fixesApplied.Count -gt 0) {
        Write-Log "     🔧 Correções aplicadas:"
        foreach ($f in $fixesApplied) { Write-Log "        - $f" }
    } else {
        Write-Log "     ℹ️  Nenhum import './common/...' encontrado para corrigir"
    }

    if ($anyWarnings.Count -gt 0) {
        Write-Log "     ⚠️  Possíveis TS7006 (revisar manualmente — tipo não adivinhado por segurança):"
        foreach ($w in $anyWarnings) { Write-Log "        $w" }
    }

    $changed = ($content -ne $originalContent)
    $statusMsg = if ($changed) { "✅ Copiado com correções" } else { "✅ Copiado sem alterações necessárias" }
    Write-Log "     $statusMsg → $($item.DestPath)" "Green"

    $FixSummary += [PSCustomObject]@{
        File         = $item.DestName
        FixesApplied = $fixesApplied.Count
        AnyWarnings  = $anyWarnings.Count
        Changed      = $changed
    }
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 5 — Validar imports referenciam componentes que de fato existem
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[5/6] Validando referências contra common/ real"

foreach ($item in $ValidPlan) {
    if (-not (Test-Path $item.DestPath)) { continue }
    $content = Get-Content -Path $item.DestPath -Raw -Encoding UTF8

    $refPattern = "from\s+'\.\.\/common\/([^']+)'"
    $refs = [regex]::Matches($content, $refPattern) |
            ForEach-Object { $_.Groups[1].Value } |
            Select-Object -Unique

    foreach ($ref in $refs) {
        if ($CommonNames -contains $ref) {
            Write-Log "  ✅ $($item.DestName) -> '../common/$ref' existe" "Green"
        } else {
            Write-Log "  ❌ $($item.DestName) -> '../common/$ref' NAO EXISTE em common/ — verificar manualmente!" "Red"
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────
# PASSO 6 — Rodar tsc --noEmit e capturar TS2307 / TS7006
# ─────────────────────────────────────────────────────────────────────────
Write-Section "[6/6] Validação TypeScript (tsc --noEmit)"

if ($DryRun) {
    Write-Log "  ⏭️  Pulado em modo DryRun" "Yellow"
} else {
    Push-Location $ProjectRoot
    try {
        Write-Log "  🔍 Rodando: npx tsc --noEmit ..." "Cyan"
        $tscOutput = & npx tsc --noEmit 2>&1 | Out-String
        $tscExitCode = $LASTEXITCODE

        if ($tscExitCode -eq 0) {
            Write-Log "  ✅ tsc --noEmit passou sem erros!" "Green"
        } else {
            Write-Log "  ⚠️  tsc reportou erros:" "Yellow"
            $relevantLines = $tscOutput -split "`n" | Where-Object { $_ -match "TS2307|TS7006|error TS" }

            if ($relevantLines.Count -gt 0) {
                Write-Log "`n  📋 Erros TS2307 (modulo nao encontrado) / TS7006 (any implicito):"
                foreach ($line in $relevantLines) { Write-Log "     $line" "Red" }
            } else {
                Write-Log "  (Nenhum TS2307/TS7006 — outros erros podem existir, ver saida completa abaixo)"
            }
            Write-Log "`n  --- Saída completa do tsc ---"
            Write-Log $tscOutput
        }
    } catch {
        Write-Log "  ❌ Falha ao rodar tsc: $_" "Red"
    } finally {
        Pop-Location
    }
}

# ─────────────────────────────────────────────────────────────────────────
# RELATÓRIO FINAL
# ─────────────────────────────────────────────────────────────────────────
Write-Section "📋 Resumo da Migração"

Write-Log "`n  Arquivos processados: $($ValidPlan.Count) / $($FilesToProcess.Count)"
foreach ($s in $FixSummary) {
    $status = if ($s.AnyWarnings -gt 0) { "⚠️ " } else { "✅" }
    Write-Log "  $status $($s.File) — $($s.FixesApplied) correcao(oes) de import, $($s.AnyWarnings) aviso(s) de tipo"
}

$NotFound = $ProcessPlan | Where-Object { -not $_.Found }
if ($NotFound.Count -gt 0) {
    Write-Log "`n  ⚠️  Arquivos não encontrados em bck/:"
    foreach ($nf in $NotFound) { Write-Log "     - $($nf.SourceFile)" }
}

$ReportPath = Join-Path $ProjectRoot "orbit-migration-report.txt"
$ReportLines | Out-File -FilePath $ReportPath -Encoding utf8

Write-Log "`n  📄 Relatório completo salvo em: $ReportPath" "Cyan"
Write-Log "  💾 Backup de arquivos sobrescritos em: $BackupDir" "Cyan"

if ($DryRun) {
    Write-Log "`n  ℹ️  Este foi um DRY-RUN. Rode sem -DryRun para aplicar de fato." "Yellow"
}

Write-Log "`n  🏁 Concluído.`n" "Green"