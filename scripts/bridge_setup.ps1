<#
.SYNOPSIS
    Скрипт настройки моста данных на админском ПК (Windows 11).
    
.DESCRIPTION
    Создаёт необходимые папки, настраивает Task Scheduler для автозапуска
    bridge_agent.ps1 при входе в систему.

    Запускать ОТ ИМЕНИ АДМИНИСТРАТОРА.

.EXAMPLE
    .\bridge_setup.ps1
    .\bridge_setup.ps1 -AgentPath "D:\scripts\bridge_agent.ps1"
    .\bridge_setup.ps1 -TaskName "DanceStudioBridge" -Force
#>

[CmdletBinding()]
param(
    [string]$AgentPath = "$env:USERPROFILE\DanceStudioSync\bridge_agent.ps1",
    [string]$TaskName = "DanceStudioBridge",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# ============================================
# ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА
# ============================================

function Test-Administrator {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator) -and -not $Force) {
    Write-Host "ERROR: Этот скрипт нужно запустить от имени администратора." -ForegroundColor Red
    Write-Host "Правый клик на PowerShell → 'Запуск от имени администратора'" -ForegroundColor Yellow
    Write-Host "Или используйте параметр -Force (не рекомендуется)" -ForegroundColor Yellow
    exit 1
}

# ============================================
# ОПРЕДЕЛЕНИЕ ПУТЕЙ
# ============================================

$SyncRoot = Join-Path $env:USERPROFILE "DanceStudioSync"
$QueueFolder = Join-Path $SyncRoot "queue"
$LogsFolder = Join-Path $SyncRoot "logs"
$ConfigFile = Join-Path $SyncRoot "bridge_config.json"
$AgentDir = Split-Path $AgentPath -Parent

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DanceStudio Bridge — Настройка" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# СОЗДАНИЕ ПАПКИ
# ============================================

Write-Host "[1/4] Создание папок..." -ForegroundColor Yellow

$folders = @($SyncRoot, $QueueFolder, $LogsFolder, $AgentDir)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "  ✓ Создана: $folder" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Уже существует: $folder" -ForegroundColor Gray
    }
}

# ============================================
# КОПИРОВАНИЕ ФАЙЛОВ
# ============================================

Write-Host ""
Write-Host "[2/4] Копирование файлов моста..." -ForegroundColor Yellow

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$filesToCopy = @("bridge_agent.ps1", "bridge_config.json")

foreach ($file in $filesToCopy) {
    $src = Join-Path $sourceDir $file
    $dst = Join-Path $AgentDir $file
    
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  ✓ Скопирован: $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Не найден: $file (в $src)" -ForegroundColor Yellow
    }
}

# ============================================
# НАСТРОЙКА CONFIG
# ============================================

Write-Host ""
Write-Host "[3/4] Настройка конфигурации..." -ForegroundColor Yellow

$config = @{
    queue_folder       = $QueueFolder
    data_folder        = "C:\DanceStudio\Data"
    interval_seconds   = 60
    api_endpoint       = "http://localhost:3000/api/bridge/receive"
}

$config | ConvertTo-Json -Depth 3 | Set-Content $ConfigFile -Encoding UTF8
Write-Host "  ✓ Конфигурация: $ConfigFile" -ForegroundColor Green
Write-Host ""
Write-Host "  Отредактируйте файл:" -ForegroundColor Gray
Write-Host "    - data_folder — путь к XML-файлам DanceStudio" -ForegroundColor Gray
Write-Host "    - api_endpoint — URL API вашего сайта" -ForegroundColor Gray
Write-Host ""

# ============================================
# РЕГИСТРАЦИЯ В TASK SCHEDULER
# ============================================

Write-Host "[4/4] Регистрация в Task Scheduler..." -ForegroundColor Yellow

# Проверяем, существует ли уже задача
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask -and -not $Force) {
    Write-Host "  ⚠ Задача '$TaskName' уже существует." -ForegroundColor Yellow
    Write-Host "  Используйте -Force для перезаписи." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Для удаления задачи: Remove-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
    exit 0
}

# Создаём задачу
try {
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -WindowStyle Hidden -File `"$AgentPath`"" `
        -WorkingDirectory $AgentDir
    
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1)
    
    $principal = New-ScheduledTaskPrincipal `
        -UserId $env:USERNAME `
        -LogonType Token `
        -RunLevel Limited
    
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Мост данных DanceStudio: синхронизация XML → API сайта" `
        -Force:$Force
    
    Write-Host "  ✓ Задача '$TaskName' создана" -ForegroundColor Green
    Write-Host "  ✓ Автозапуск: При входе в систему" -ForegroundColor Green
    Write-Host "  ✓ Запуск: powershell.exe -WindowStyle Hidden" -ForegroundColor Green
    
} catch {
    Write-Host "  ✗ Ошибка регистрации задачи: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Попробуйте зарегистрировать вручную:" -ForegroundColor Gray
    Write-Host "    \$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument """`
    Write-Host "      -NoProfile -WindowStyle Hidden -File `"$AgentPath`"""" -ForegroundColor Gray
    Write-Host "    Register-ScheduledTask -TaskName '$TaskName' -Action `\$action `
      -Trigger (New-ScheduledTaskTrigger -AtLogOn) -Force" -ForegroundColor Gray
    exit 1
}

# ============================================
# ФИНАЛЬНЫЙ РЕЗУЛЬТАТ
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Настройка завершена!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Yellow
Write-Host "  1. Отредактируйте $ConfigFile" -ForegroundColor White
Write-Host "     - data_folder: путь к XML DanceStudio" -ForegroundColor White
Write-Host "     - api_endpoint: URL API вашего сайта" -ForegroundColor White
Write-Host ""
Write-Host "  2. Проверьте задачу в Task Scheduler:" -ForegroundColor White
Write-Host "     mscvrexec.msc → Task Scheduler Library" -ForegroundColor White
Write-Host ""
Write-Host "  3. Запустите вручную для теста:" -ForegroundColor White
Write-Host "     .\$AgentPath -Manual" -ForegroundColor White
Write-Host ""
Write-Host "  4. Проверьте логи: $LogsFolder\" -ForegroundColor White
Write-Host ""
