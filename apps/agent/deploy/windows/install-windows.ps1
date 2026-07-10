<#
Installs the Brio agent as an auto-starting background task on Windows,
using Task Scheduler (built into Windows, no extra dependencies).

Usage (in PowerShell, ideally as Administrator so the Defender exclusion
step below can succeed automatically):
  .\install-windows.ps1 -BinaryPath "C:\path\to\brio-agent-windows-amd64.exe"

What it does:
  1. Tries to add a Windows Defender exclusion for the binary (needs
     admin — skipped with instructions if not elevated)
  2. Copies the binary to %LOCALAPPDATA%\BrioAgent\
  3. Registers a Scheduled Task that runs at logon and restarts on crash
  4. Starts it immediately

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

# Try to exclude the binary from Defender scanning before it's ever run,
# so it doesn't get quarantined out from under the Scheduled Task later.
# This needs admin rights — if the script wasn't run elevated, this just
# gets skipped with a clear message instead of failing the whole install.
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($IsAdmin) {
    try {
        Add-MpPreference -ExclusionPath $BinaryPath -ErrorAction Stop
        Write-Host "Added Windows Defender exclusion automatically."
    } catch {
        Write-Host "Couldn't add Defender exclusion automatically: $_"
    }
} else {
    Write-Host "Not running as Administrator — skipping automatic Defender exclusion."
    Write-Host "Re-run this script as Administrator to do it automatically, or add it"
    Write-Host "manually if Defender ends up quarantining the file (see bottom of output)."
}

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
Write-Host "IMPORTANT: Windows Defender may still flag this binary on first run —"
Write-Host "screen capture + keyboard/mouse control + remote shell behaviorally"
Write-Host "looks like a RAT, so this is expected, not a sign anything's wrong."
Write-Host ""
Write-Host "  - SmartScreen warning on first run: click 'More info' -> 'Run anyway'."
Write-Host "  - If Defender quarantines/deletes the file anyway: add an exclusion"
Write-Host "    manually — Windows Security > Virus & threat protection >"
Write-Host "    Manage settings > Add or remove exclusions > Add an exclusion > File"
Write-Host "  - For regular client deployments, a code-signing certificate is the"
Write-Host "    real fix (what AnyDesk/TeamViewer use) — costs money, separate step."
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  Unregister-ScheduledTask -TaskName 'BrioAgent' -Confirm:`$false"
Write-Host "  Remove-Item -Recurse -Force '$InstallDir'"
