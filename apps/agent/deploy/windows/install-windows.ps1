<#
Installs the Brio agent as an auto-starting background task on Windows,
using Task Scheduler (built into Windows, no extra dependencies).

Usage (in PowerShell):
  .\install-windows.ps1 -BinaryPath "C:\path\to\brio-agent-windows-amd64.exe"

What it does:
  1. Copies the binary to %LOCALAPPDATA%\BrioAgent\
  2. Registers a Scheduled Task that runs at logon and restarts on crash
  3. Starts it immediately

To uninstall:
  Unregister-ScheduledTask -TaskName "BrioAgent" -Confirm:$false
  Remove-Item -Recurse -Force "$env:LOCALAPPDATA\BrioAgent"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$BinaryPath
)

$ErrorActionPreference = "Stop"

$InstallDir = "$env:LOCALAPPDATA\BrioAgent"
$TaskName = "BrioAgent"

Write-Host "Installing Brio agent..."

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$Dest = Join-Path $InstallDir "brio-agent.exe"
Copy-Item -Path $BinaryPath -Destination $Dest -Force

# Remove any existing registration so re-running this script is safe.
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute $Dest
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName `
    -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal `
    -Description "Brio Remote agent (by Wira Mode Pohon)" | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host "Installed and started."
Write-Host ""
Write-Host "IMPORTANT: Windows Defender may flag this binary — screen capture +"
Write-Host "keyboard/mouse control + remote shell behaviorally looks like a RAT,"
Write-Host "so this is expected, not a sign anything's wrong."
Write-Host ""
Write-Host "  - SmartScreen warning on first run: click 'More info' -> 'Run anyway'."
Write-Host "  - If Defender quarantines/deletes the file instead: add an exclusion"
Write-Host "    BEFORE running this installer:"
Write-Host "    Windows Security > Virus & threat protection > Manage settings >"
Write-Host "    Add or remove exclusions > Add an exclusion > File -> select the .exe"
Write-Host "  - For regular client deployments, a code-signing certificate is the"
Write-Host "    real fix (what AnyDesk/TeamViewer use) — costs money, separate step."
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  Unregister-ScheduledTask -TaskName 'BrioAgent' -Confirm:`$false"
Write-Host "  Remove-Item -Recurse -Force '$InstallDir'"
