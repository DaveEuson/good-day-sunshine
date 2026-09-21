# Registers two logon tasks: start the server, then open the dashboard in the default browser.
# Run once from an elevated PowerShell:  .\scripts\install-logon.ps1
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$port = 4242

$server = New-ScheduledTaskAction -Execute $node -Argument "server.js" -WorkingDirectory $root
$open   = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c timeout /t 3 >nul && start http://localhost:$port"
$trig   = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$set    = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "GoodDaySunshine Server" -Action $server -Trigger $trig -Settings $set -Force | Out-Null
Register-ScheduledTask -TaskName "GoodDaySunshine Open"   -Action $open   -Trigger $trig -Settings $set -Force | Out-Null
Write-Host "Installed. Next logon: server starts, dashboard opens at http://localhost:$port"
Write-Host "Remove: Unregister-ScheduledTask 'GoodDaySunshine Server','GoodDaySunshine Open' -Confirm:`$false"
