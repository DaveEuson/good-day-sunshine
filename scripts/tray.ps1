# Good Day Sunshine tray app (Windows). Starts the server hidden, sits in the tray.
# Run:  powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File scripts\tray.ps1
# scripts\install.ps1 registers this to start at login.
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$port = 4242
$url  = "http://localhost:$port/"
$prefFile = Join-Path $root "data\tray.json"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCmd = "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""

function Load-Prefs { if (Test-Path $prefFile) { Get-Content $prefFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{ openAtStart = $true } } }
function Save-Prefs($p) { New-Item -ItemType Directory -Force (Split-Path $prefFile) | Out-Null; $p | ConvertTo-Json | Set-Content $prefFile }
$prefs = Load-Prefs

# server: the packaged exe if it sits next to us, otherwise node + server.js
$exe = Join-Path $root "GoodDaySunshine.exe"
if (Test-Path $exe) {
  $server = Start-Process $exe -WorkingDirectory $root -WindowStyle Hidden -PassThru
} else {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { [System.Windows.Forms.MessageBox]::Show("Node.js is not installed. Run scripts\install.ps1 first.", "Good Day Sunshine") | Out-Null; exit 1 }
  $server = Start-Process $node -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru
}

# sun icon drawn in code, no file
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "AntiAlias"
$sun = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 190, 60))
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 190, 60)), 3
for ($k = 0; $k -lt 8; $k++) { $t = $k * [math]::PI / 4; $g.DrawLine($pen, 16 + 11 * [math]::Cos($t), 16 + 11 * [math]::Sin($t), 16 + 15 * [math]::Cos($t), 16 + 15 * [math]::Sin($t)) }
$g.FillEllipse($sun, 8, 8, 16, 16)
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icon
$tray.Text = "Good Day Sunshine"
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$open = $menu.Items.Add("Open dashboard");          $open.add_Click({ Start-Process $url })
$opts = $menu.Items.Add("Options");                 $opts.add_Click({ Start-Process "$url?open=options" })
$tv   = $menu.Items.Add("TV mode");                 $tv.add_Click({ Start-Process "$url?mode=tv" })
$menu.Items.Add("-") | Out-Null
$auto = $menu.Items.Add("Start at login");          $auto.CheckOnClick = $true
$auto.Checked = [bool](Get-ItemProperty $runKey -Name GoodDaySunshine -ErrorAction SilentlyContinue)
$auto.add_Click({ if ($auto.Checked) { Set-ItemProperty $runKey -Name GoodDaySunshine -Value $runCmd } else { Remove-ItemProperty $runKey -Name GoodDaySunshine -ErrorAction SilentlyContinue } })
$oas  = $menu.Items.Add("Open page when I start");  $oas.CheckOnClick = $true; $oas.Checked = [bool]$prefs.openAtStart
$oas.add_Click({ $prefs.openAtStart = $oas.Checked; Save-Prefs $prefs })
$menu.Items.Add("-") | Out-Null
$quit = $menu.Items.Add("Quit");                    $quit.add_Click({ $tray.Visible = $false; Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue; [System.Windows.Forms.Application]::Exit() })

$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Start-Process $url })
$tray.Visible = $true

# good-morning moment: open the page once the server answers
if ($prefs.openAtStart) {
  for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 300; try { Invoke-WebRequest "$url`api/users" -UseBasicParsing -TimeoutSec 1 | Out-Null; break } catch {} }
  Start-Process $url
}
$tray.ShowBalloonTip(2000, "Good Day Sunshine", "Running in the tray. Double-click to open.", "None")
[System.Windows.Forms.Application]::Run()
