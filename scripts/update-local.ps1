# Update the installed copy from this checkout: build the exe, stop the tray and server, copy the program files, start again.
# Your profiles, data and keys (config\users, data\, .env) are never touched.
#   npm run update:local                       build + update %LOCALAPPDATA%\GoodDaySunshine
#   powershell -File scripts\update-local.ps1 -NoBuild      reuse the last build in dist\
#   powershell -File scripts\update-local.ps1 -Dest D:\Apps\GoodDaySunshine
param([string]$Dest = (Join-Path $env:LOCALAPPDATA "GoodDaySunshine"), [switch]$NoBuild)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Dest "GoodDaySunshine.exe"))) { throw "Nothing installed at $Dest. Unzip a build there and run scripts\install.ps1 first." }

if (-not $NoBuild) {
  Write-Host "building..."
  Push-Location $root
  try { npm run build:exe; if ($LASTEXITCODE) { throw "build failed" } } finally { Pop-Location }
}
$new = Join-Path $root "dist\GoodDaySunshine"
if (-not (Test-Path (Join-Path $new "GoodDaySunshine.exe"))) { throw "No build in $new. Run without -NoBuild." }

Write-Host "stopping the installed copy..."
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$Dest*tray.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-Process GoodDaySunshine -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$Dest*" } | ForEach-Object { Stop-Process -Id $_.Id -Force }
Start-Sleep -Seconds 2

Write-Host "copying program files..."
Copy-Item (Join-Path $new "GoodDaySunshine.exe") $Dest -Force
foreach ($d in "public", "scripts", "extension") {
  $target = Join-Path $Dest $d
  if (Test-Path $target) { [System.IO.Directory]::Delete($target, $true) }   # program folders only; data lives elsewhere
  Copy-Item (Join-Path $new $d) $target -Recurse -Force
}
Copy-Item (Join-Path $new "README.md"), (Join-Path $new "LICENSE"), (Join-Path $new ".env.example") $Dest -Force
Copy-Item (Join-Path $new "config\users\_template.json") (Join-Path $Dest "config\users") -Force

Write-Host "starting..."
Start-Process powershell -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $Dest 'scripts\tray.ps1')`"" -WindowStyle Hidden
$ok = $false   # up to ~1 minute
for ($i = 0; $i -lt 60 -and -not $ok; $i++) { Start-Sleep -Milliseconds 500; try { Invoke-WebRequest "http://127.0.0.1:4242/api/users" -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok = $true } catch {} }
if (-not $ok) { Write-Warning "Updated. The server has not answered yet (it normally takes a few seconds); give it a moment, then open http://localhost:4242."; exit 0 }
$mb = [math]::Round((Get-Item (Join-Path $Dest "GoodDaySunshine.exe")).Length / 1MB, 1)
Write-Host "updated $Dest ($mb MB). Running at http://localhost:4242. Your data was left alone."