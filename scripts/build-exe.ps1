# Build GoodDaySunshine.exe: a single Node executable (Node SEA) plus the folders it reads next to itself.
#   npm run build:exe        → dist\GoodDaySunshine\  (exe, public\, config\, scripts\, README, LICENSE, .env.example)
#                            → dist\GoodDaySunshine-win-x64.zip
# Needs Node >= 22 and `npm install` (esbuild + postject are dev dependencies). No Node needed on the target machine.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$out = Join-Path $root "dist\GoodDaySunshine"

Write-Host "1/4 bundling server → dist\server.cjs"
npm run -s bundle
if ($LASTEXITCODE) { throw "esbuild failed" }

Write-Host "2/4 generating SEA blob"
node --experimental-sea-config sea-config.json
if ($LASTEXITCODE) { throw "sea blob failed" }

Write-Host "3/4 injecting into a copy of node.exe"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $out | Out-Null
$exe = Join-Path $out "GoodDaySunshine.exe"
Copy-Item (Get-Command node).Source $exe
npx --yes postject $exe NODE_SEA_BLOB dist\sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE) { throw "postject failed" }

Write-Host "4/4 assembling folder + zip"
Copy-Item -Recurse public (Join-Path $out "public")
New-Item -ItemType Directory -Force (Join-Path $out "config\users") | Out-Null
Copy-Item config\users\_template.json (Join-Path $out "config\users\_template.json")
New-Item -ItemType Directory -Force (Join-Path $out "scripts") | Out-Null
Copy-Item scripts\tray.ps1, scripts\install.ps1, scripts\kiosk.sh, scripts\kiosk.service, scripts\epaper.py (Join-Path $out "scripts")
Copy-Item README.md, LICENSE, .env.example $out
Copy-Item -Recurse extension (Join-Path $out "extension")
$zip = Join-Path $root "dist\GoodDaySunshine-win-x64.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path "$out\*" -DestinationPath $zip
$mb = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host "done: $exe ($mb MB)  →  $zip"
Write-Host "run:  cd dist\GoodDaySunshine; .\GoodDaySunshine.exe   (or scripts\install.ps1 for the tray)"
