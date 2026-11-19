<#
.SYNOPSIS
  自动将 GitHub (ywanght/QX-config) 最新的 clash-verge-script.js 同步到本机 Clash Verge Rev 全局扩展脚本。
.USAGE
  1. 手动同步一次:
     powershell -ExecutionPolicy Bypass -File .\sync-windows.ps1
  2. 注册 Windows 开机/每6小时静默自动同步计划任务:
     powershell -ExecutionPolicy Bypass -File .\sync-windows.ps1 -InstallTask
#>
param(
    [switch]$InstallTask
)

$ErrorActionPreference = "Stop"
$ScriptUrl = "https://raw.githubusercontent.com/ywanght/QX-config/main/clash/clash-verge-script.js"
$TargetDir = Join-Path $env:APPDATA "io.github.clash-verge-rev.clash-verge-rev\profiles"
$TargetFile = Join-Path $TargetDir "Script.js"

if ($InstallTask) {
    $ScriptPath = $MyInvocation.MyCommand.Path
    $TaskName = "SyncClashVergeGlobalScript"
    $Cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""
    # 优先尝试注册每 6 小时计划任务；若非管理员权限则自动回退到当前用户开机启动项 (HKCU Run)
    try {
        $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""
        $TriggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $TriggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 6)
        $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerLogon, $TriggerRepeat) -Settings $Settings -Force -ErrorAction Stop | Out-Null
        Write-Host "[OK] 已注册 Windows 定时任务 '$TaskName'（登录时 & 每 6 小时自动同步 Script.js）" -ForegroundColor Green
    } catch {
        $RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
        Set-ItemProperty -Path $RunKey -Name $TaskName -Value $Cmd
        Write-Host "[OK] 已写入当前用户开机自启项 '$TaskName'（无需管理员权限，每次登录自动同步 Script.js）" -ForegroundColor Green
    }
}

if (-not (Test-Path $TargetDir)) {
    throw "未找到 Clash Verge Rev 配置目录: $TargetDir"
}

$TempFile = Join-Path $env:TEMP "clash-verge-script.tmp.js"
try {
    Invoke-WebRequest -Uri $ScriptUrl -OutFile $TempFile -UseBasicParsing -TimeoutSec 20
} catch {
    # 若系统代理异常，尝试直连
    Invoke-WebRequest -Uri $ScriptUrl -OutFile $TempFile -UseBasicParsing -TimeoutSec 20 -NoProxy
}

$NewHash = (Get-FileHash -Path $TempFile -Algorithm SHA256).Hash
$OldHash = if (Test-Path $TargetFile) { (Get-FileHash -Path $TargetFile -Algorithm SHA256).Hash } else { "" }

if ($NewHash -ne $OldHash) {
    Copy-Item -Path $TempFile -Destination $TargetFile -Force
    Write-Host "[UPDATED] 已更新全局扩展脚本: $TargetFile" -ForegroundColor Cyan
} else {
    Write-Host "[UP-TO-DATE] 全局扩展脚本已是最新，无需更新。" -ForegroundColor Gray
}
Remove-Item -Path $TempFile -Force -ErrorAction SilentlyContinue
