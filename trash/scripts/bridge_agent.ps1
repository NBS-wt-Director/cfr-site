<#
.SYNOPSIS
    Мост данных: сканирование XML-файлов DanceStudio и отправка пакетов на API сайта.
    
.DESCRIPTION
    PowerShell-скрипт для автоматической синхронизации данных из донорской БД
    (XML-файлы DanceStudio) в PostgreSQL сайта через REST API.
    
    Работает на админском ПК (Win11). Не требует дополнительного ПО.
    Не блокируется антивирусом (простой скрипт, без динамической генерации кода).

.PARAMETER Manual
    Запустить однократное сканирование и отправку (без бесконечного цикла).

.PARAMETER Config
    Путь к файлу конфигурации (по умолчанию: bridge_config.json в той же папке).

.EXAMPLE
    .\bridge_agent.ps1
    .\bridge_agent.ps1 -Manual
    .\bridge_agent.ps1 -Manual -Config "C:\path\to\config.json"

.NOTES
    Автозапуск через Windows Task Scheduler:
    1. Запустить bridge_setup.ps1 от имени администратора
    2. Или создать задачу вручную:
       - Триггер: При входе в систему
       - Действие: powershell.exe -File "C:\path\to\bridge_agent.ps1"
#>

[CmdletBinding()]
param(
    [switch]$Manual,
    [string]$Config
)

# ============================================
# ИНИЦИАЛИЗАЦИЯ
# ============================================

$ErrorActionPreference = "Stop"

# Определение пути к конфигу
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $Config) {
    $Config = Join-Path $ScriptDir "bridge_config.json"
}

# ============================================
# ЧТЕНИЕ КОНФИГУРАЦИИ
# ============================================

function Read-Config {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Log "ERROR" "Файл конфигурации не найден: $Path"
        Write-Host "ERROR: Файл конфигурации не найден: $Path" -ForegroundColor Red
        exit 1
    }
    
    try {
        $raw = Get-Content $Path -Raw -Encoding UTF8
        return $raw | ConvertFrom-Json
    } catch {
        Write-Log "ERROR" "Ошибка чтения конфигурации: $_"
        Write-Host "ERROR: Ошибка чтения конфигурации: $_" -ForegroundColor Red
        exit 1
    }
}

# ============================================
# ЛОГИРОВАНИЕ
# ============================================

function Write-Log {
    param(
        [ValidateSet("INFO", "WARN", "ERROR", "DEBUG", "SEND", "SYNC")]
        [string]$Level,
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Вывод в консоль с цветовой кодировкой
    switch ($Level) {
        "INFO"    { Write-Host $logEntry -ForegroundColor White }
        "WARN"    { Write-Host $logEntry -ForegroundColor Yellow }
        "ERROR"   { Write-Host $logEntry -ForegroundColor Red }
        "DEBUG"   { Write-Host $logEntry -ForegroundColor DarkGray }
        "SEND"    { Write-Host $logEntry -ForegroundColor Green }
        "SYNC"    { Write-Host $logEntry -ForegroundColor Cyan }
    }
    
    # Запись в лог-файл
    $logFile = Join-Path $ScriptDir "bridge_agent.log"
    try {
        Add-Content -Path $logFile -Value $logEntry -Encoding UTF8
    } catch {
        # Игнорируем ошибки записи лога
    }
}

# ============================================
# СКАНИРОВАНИЕ ДАННЫХ И ФОРМИРОВАНИЕ ПАКЕТОВ
# ============================================

function Get-XMLFiles {
    param(
        [string]$DataFolder,
        [string[]]$ExcludedDirs = @("Files", "LastSave", "Options")
    )
    
    $files = @()
    
    # Получаем все XML-файлы, исключая определённые директории
    $xmlFiles = Get-ChildItem -Path $DataFolder -Filter "*.xml" -File -ErrorAction SilentlyContinue
    
    foreach ($file in $xmlFiles) {
        $relativePath = $file.FullName.Replace($DataFolder, "").TrimStart("\").TrimStart("/")
        $parentDir = (Split-Path $relativePath -Parent)
        
        # Пропускаем исключённые директории
        $skip = $false
        foreach ($excl in $ExcludedDirs) {
            if ($parentDir -eq $excl) {
                $skip = $true
                break
            }
        }
        
        if (-not $skip) {
            $files += @{
                Name = $file.Name
                Path = $file.FullName
                Size = $file.Length
                LastModified = $file.LastWriteTime
            }
        }
    }
    
    return $files
}

function Compute-FileHash {
    param([string]$FilePath)
    
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $hash = $sha256.ComputeHash([System.IO.File]::ReadAllBytes($FilePath))
        $sha256.Dispose()
        return [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()
    } catch {
        return ""
    }
}

function Build-Packets {
    param(
        [string]$DataFolder,
        [string]$QueueFolder
    )
    
    $files = Get-XMLFiles -DataFolder $DataFolder
    $newPackets = @()
    
    foreach ($file in $files) {
        $fileName = $file.Name
        $filePath = $file.Path
        $fileHash = Compute-FileHash -FilePath $filePath
        $fileSize = $file.Size
        $lastModified = $file.LastModified.ToString("o")
        
        # Проверяем, был ли этот файл уже отправлен
        $processedFile = Join-Path $QueueFolder "processed_hashes.json"
        $sentPackets = @{}
        
        if (Test-Path $processedFile) {
            try {
                $sentPackets = Get-Content $processedFile -Raw | ConvertFrom-Json
            } catch {
                $sentPackets = @{}
            }
        }
        
        # Если хеш изменился или файл не был отправлен — формируем пакет
        $prevHash = $null
        if ($sentPackets.PSObject.Properties.Name -contains $fileName) {
            $prevHash = $sentPackets.$fileName
        }
        
        if ($prevHash -ne $fileHash) {
            # Формируем пакет
            $packet = @{
                file_name    = $fileName
                file_path    = $filePath
                file_hash    = $fileHash
                file_size    = $fileSize
                last_modified = $lastModified
                content      = $null  # Содержимое заполняется при отправке
            }
            
            # Читаем содержимое XML
            try {
                $packet.content = Get-Content $filePath -Raw -Encoding UTF8
                $newPackets += $packet
            } catch {
                Write-Log "WARN" "Не удалось прочитать файл: $fileName — $_"
            }
        }
    }
    
    # Обновляем хеши
    $allPackets = @{}
    if (Test-Path $processedFile) {
        try {
            $allPackets = Get-Content $processedFile -Raw | ConvertFrom-Json
        } catch {
            $allPackets = @{}
        }
    }
    
    foreach ($packet in $newPackets) {
        $allPackets[$packet.file_name] = $packet.file_hash
    }
    
    $allPackets | ConvertTo-Json -Depth 3 | Set-Content $processedFile -Encoding UTF8
    
    return $newPackets
}

# ============================================
# ОЧЕРЕДЬ ОТПРАВЛЕННЫХ ПАКЕТОВ
# ============================================

function Save-ToQueue {
    param(
        [string]$QueueFolder,
        [object]$Packet,
        [int]$PacketNumber
    )
    
    # Создаём папку очереди, если не существует
    if (-not (Test-Path $QueueFolder)) {
        New-Item -ItemType Directory -Path $QueueFolder -Force | Out-Null
    }
    
    $packetJson = $Packet | ConvertTo-Json -Depth 10 -Compress
    $queueFile = Join-Path $QueueFolder "packet_{0:D6}.json" -f $PacketNumber
    
    try {
        $packetJson | Set-Content $queueFile -Encoding UTF8
        return $queueFile
    } catch {
        Write-Log "ERROR" "Не удалось сохранить пакет в очередь: $_"
        return $null
    }
}

function Get-QueuedPackets {
    param([string]$QueueFolder)
    
    if (-not (Test-Path $QueueFolder)) {
        return @()
    }
    
    return Get-ChildItem -Path $QueueFolder -Filter "packet_*.json" -File | Sort-Object Name
}

function Remove-FromQueue {
    param(
        [string]$QueueFolder,
        [string]$FileName
    )
    
    $queueFile = Join-Path $QueueFolder $FileName
    
    if (Test-Path $queueFile) {
        Remove-Item $queueFile -Force
        return $true
    }
    return $false
}

# ============================================
# ОТПРАВКА ПАКЕТОВ НА API
# ============================================

function Send-PacketToApi {
    param(
        [string]$ApiEndpoint,
        [object]$Packet,
        [int]$RetryCount = 3,
        [int]$RetryDelay = 5
    )
    
    $packetJson = $Packet | ConvertTo-Json -Depth 10
    
    for ($i = 1; $i -le $RetryCount; $i++) {
        try {
            $response = Invoke-RestMethod -Uri $ApiEndpoint -Method Post `
                -ContentType "application/json; charset=utf-8" `
                -Body $packetJson `
                -TimeoutSec 30
            
            return @{
                success = $true
                response = $response
                attempt = $i
            }
        } catch {
            $errorMsg = $_.Exception.Message
            Write-Log "WARN" "Попытка $i/$RetryCount не удалась: $errorMsg"
            
            if ($i -lt $RetryCount) {
                Start-Sleep -Seconds $RetryDelay
            }
        }
    }
    
    return @{
        success = $false
        error = $errorMsg
        attempt = $RetryCount
    }
}

function Send-QueuedPackets {
    param(
        [string]$QueueFolder,
        [string]$ApiEndpoint
    )
    
    $queued = Get-QueuedPackets -QueueFolder $QueueFolder
    $sentCount = 0
    $failedCount = 0
    
    foreach ($queueFile in $queued) {
        try {
            $packetData = Get-Content $queueFile.FullName -Raw | ConvertFrom-Json
            
            $result = Send-PacketToApi -ApiEndpoint $ApiEndpoint -Packet $packetData
            
            if ($result.success) {
                Write-Log "SEND" "Пакет $($queueFile.Name) отправлен успешно (попытка $($result.attempt))"
                Remove-FromQueue -QueueFolder $QueueFolder -FileName $queueFile.Name
                $sentCount++
            } else {
                Write-Log "ERROR" "Не удалось отправить пакет $($queueFile.Name): $($result.error)"
                $failedCount++
            }
        } catch {
            Write-Log "ERROR" "Ошибка обработки пакета $($queueFile.Name): $_"
            $failedCount++
        }
    }
    
    return @{
        sent    = $sentCount
        failed  = $failedCount
        total   = $sentCount + $failedCount
    }
}

# ============================================
# СТАТУС СИНХРОНИЗАЦИИ
# ============================================

function Get-SyncStatus {
    param(
        [string]$QueueFolder,
        [string]$ProcessedFile
    )
    
    $queuedPackets = @()
    if (Test-Path $QueueFolder) {
        $queuedPackets = Get-ChildItem -Path $QueueFolder -Filter "packet_*.json" -File
    }
    
    $sentPackets = @{}
    if (Test-Path $ProcessedFile) {
        try {
            $sentPackets = Get-Content $ProcessedFile -Raw | ConvertFrom-Json
        } catch {
            $sentPackets = @{}
        }
    }
    
    $xmlFiles = Get-XMLFiles -DataFolder (Read-Config -Path $Config).data_folder
    $totalFiles = $xmlFiles.Count
    $changedFiles = 0
    foreach ($file in $xmlFiles) {
        $hash = Compute-FileHash -FilePath $file.Path
        $prevHash = $null
        if ($sentPackets.PSObject.Properties.Name -contains $file.Name) {
            $prevHash = $sentPackets.$($file.Name)
        }
        if ($prevHash -ne $hash) {
            $changedFiles++
        }
    }
    
    return @{
        total_xml_files = $totalFiles
        changed_files   = $changedFiles
        queued_packets  = $queuedPackets.Count
        last_sync       = $null
        status          = "ready"
    }
}

# ============================================
# ОСНОВНОЙ ЦИКЛ
# ============================================

function Main {
    Write-Log "INFO" "=== Мост данных запущен ==="
    Write-Log "INFO" "Режим: $(if ($Manual) { 'Однократный (manual)' } else { 'Автоматический' })"
    
    # Читаем конфигурацию
    $config = Read-Config -Path $Config
    
    $queueFolder   = $config.queue_folder
    $dataFolder    = $config.data_folder
    $intervalSec   = $config.interval_seconds
    $apiEndpoint   = $config.api_url
    
    Write-Log "INFO" "Папка данных: $dataFolder"
    Write-Log "INFO" "Папка очереди: $queueFolder"
    Write-Log "INFO" "Интервал: ${intervalSec} сек"
    Write-Log "INFO" "API endpoint: $apiEndpoint"
    
    # Проверяем существование папки данных
    if (-not (Test-Path $dataFolder)) {
        Write-Log "ERROR" "Папка данных не найдена: $dataFolder"
        Write-Host "ERROR: Папка данных не найдена: $dataFolder" -ForegroundColor Red
        exit 1
    }
    
    $processedFile = Join-Path $queueFolder "processed_hashes.json"
    
    # ============================================
    # ОДНОКРАТНЫЙ РЕЖИМ
    # ============================================
    if ($Manual) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  Ручная синхронизация" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Показываем статус перед сканированием
        $status = Get-SyncStatus -QueueFolder $queueFolder -ProcessedFile $processedFile
        Write-Host "📊 Статус:" -ForegroundColor White
        Write-Host "   XML-файлов:         $($status.total_xml_files)" -ForegroundColor Gray
        Write-Host "   Изменённых файлов:  $($status.changed_files)" -ForegroundColor Gray
        Write-Host "   В очереди:          $($status.queued_packets)" -ForegroundColor Gray
        Write-Host ""
        
        if ($status.changed_files -eq 0 -and $status.queued_packets -eq 0) {
            Write-Host "✅ Изменений нет. Синхронизация не нужна." -ForegroundColor Green
            Write-Host ""
            Write-Log "INFO" "Изменений нет, синхронизация пропущена"
            return
        }
        
        # Подтверждение
        if ($status.changed_files -gt 0) {
            Write-Host "⚠ Найдено изменённых файлов: $($status.changed_files)" -ForegroundColor Yellow
            $confirm = Read-Host "Отправить изменения? (y/n)"
            if ($confirm -ne 'y' -and $confirm -ne 'Y') {
                Write-Host "❌ Синхронизация отменена пользователем." -ForegroundColor Red
                return
            }
        }
        
        Write-Host ""
        Write-Host "🔍 Сканирование папки данных..." -ForegroundColor Cyan
        
        # Формируем пакеты из изменённых файлов
        $newPackets = Build-Packets -DataFolder $dataFolder -QueueFolder $queueFolder
        Write-Log "INFO" "Найдено изменённых файлов: $($newPackets.Count)"
        
        if ($newPackets.Count -gt 0) {
            Write-Host "📦 Формируем пакеты: $($newPackets.Count) файл(ов)" -ForegroundColor Cyan
            
            $packetNum = 1
            foreach ($packet in $newPackets) {
                $queueFile = Save-ToQueue -QueueFolder $queueFolder -Packet $packet -PacketNumber $packetNum
                if ($queueFile) {
                    Write-Host "   ✓ $(Split-Path $queueFile -Leaf)" -ForegroundColor Green
                    $packetNum++
                }
            }
            Write-Host ""
        }
        
        # Отправляем пакеты из очереди на API
        if ($newPackets.Count -gt 0) {
            Write-Host "📤 Отправка пакетов на сервер..." -ForegroundColor Cyan
            
            $result = Send-QueuedPackets -QueueFolder $queueFolder -ApiEndpoint $apiEndpoint
            Write-Log "SYNC" "Отправлено: $($result.sent), Ошибок: $($result.failed)"
            
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            if ($result.failed -eq 0) {
                Write-Host "  ✅ Отправлено: $($result.sent) пакет(ов)" -ForegroundColor Green
                Write-Host "  ❌ Ошибок: 0" -ForegroundColor Green
            } else {
                Write-Host "  ✅ Отправлено: $($result.sent) пакет(ов)" -ForegroundColor Green
                Write-Host "  ❌ Ошибок: $($result.failed)" -ForegroundColor Red
            }
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            
            if ($result.failed -gt 0) {
                Write-Host "⚠ Часть пакетов не отправлена. Проверьте логи." -ForegroundColor Yellow
            }
        } else {
            Write-Host "✅ Пакетов для отправки нет." -ForegroundColor Green
        }
        
        # Финальный статус
        $finalStatus = Get-SyncStatus -QueueFolder $queueFolder -ProcessedFile $processedFile
        Write-Host "📊 Итоговый статус:" -ForegroundColor White
        Write-Host "   Изменённых файлов:  $($finalStatus.changed_files)" -ForegroundColor Gray
        Write-Host "   В очереди:          $($finalStatus.queued_packets)" -ForegroundColor Gray
        Write-Host ""
        
        Write-Log "INFO" "=== Однократный скан завершён ==="
        return
    }
    
    # ============================================
    # АВТОМАТИЧЕСКИЙ РЕЖИМ (бесконечный цикл)
    # ============================================
    Write-Log "INFO" "Автоматический режим. Ожидание интервала ${intervalSec} сек..."
    
    while ($true) {
        try {
            Write-Log "INFO" "Сканирование папки данных..."
            
            # Формируем пакеты из изменённых файлов
            $newPackets = Build-Packets -DataFolder $dataFolder -QueueFolder $queueFolder
            Write-Log "INFO" "Найдено изменённых файлов: $($newPackets.Count)"
            
            # Отправляем новые пакеты
            if ($newPackets.Count -gt 0) {
                $packetNum = 1
                foreach ($packet in $newPackets) {
                    $queueFile = Save-ToQueue -QueueFolder $queueFolder -Packet $packet -PacketNumber $packetNum
                    if ($queueFile) {
                        Write-Log "INFO" "Пакет сохранён в очередь: $(Split-Path $queueFile -Leaf)"
                        $packetNum++
                    }
                }
            }
            
            # Отправляем пакеты из очереди на API
            $result = Send-QueuedPackets -QueueFolder $queueFolder -ApiEndpoint $apiEndpoint
            Write-Log "SYNC" "Отправлено: $($result.sent), Ошибок: $($result.failed)"
            
        } catch {
            Write-Log "ERROR" "Ошибка в основном цикле: $_"
        }
        
        # Пауза до следующего сканирования
        Write-Log "DEBUG" "Следующее сканирование через ${intervalSec} сек..."
        Start-Sleep -Seconds $intervalSec
    }
}

# Запуск
Main
