# One-time install on Windows: ensures Node, registers the tray app to start at login, starts it now.
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
# Uninstall:  powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Uninstall
param([switch]$Uninstall)
$root = Split-Path -Parent $PSScriptRoot
$tray = Join-Path $PSScriptRoot "tray.ps1"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCmd = "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$tray`""

if ($Uninstall) {
  Remove-ItemProperty $runKey -Name GoodDaySunshine -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*tray.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Write-Host "Removed from startup and stopped."
  exit
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js not found. Installing via winget..."
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "Install Node.js from https://nodejs.org and rerun."; exit 1 }
}
if (-not (Test-Path (Join-Path $root ".env"))) { Copy-Item (Join-Path $root ".env.example") (Join-Path $root ".env") }

Set-ItemProperty $runKey -Name GoodDaySunshine -Value $runCmd
Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$tray`"" -WindowStyle Hidden
Write-Host "Installed. Sun icon in the tray; starts at login; dashboard at http://localhost:4242"
Write-Host "First run: the page opens the wake-up wizard. Ollama (https://ollama.com) is optional but recommended for the brief and chat."
