$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

Write-Host "Starting Exam-Flow..." -ForegroundColor Cyan

if (!(Test-Path $backendDir) -or !(Test-Path $frontendDir)) {
  throw "Could not find backend/frontend folders from: $root"
}

# Free common ports if stale node processes are still attached.
$ports = @(3000, 5000)
foreach ($port in $ports) {
  $lines = netstat -ano -p tcp | Select-String ":$port"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
    if ($parts.Length -ge 5 -and $parts[3] -eq "LISTENING") {
      $pid = $parts[4]
      if ($pid -match "^\d+$") {
        Write-Host "Stopping process on port $port (PID $pid)..." -ForegroundColor Yellow
        taskkill /PID $pid /F | Out-Null
      }
    }
  }
}

Write-Host "Starting backend in a new terminal..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$backendDir'; npm run dev"
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend in a new terminal..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$frontendDir'; npm run dev"
)

Write-Host ""
Write-Host "Done. Open http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend API should be at http://localhost:5000" -ForegroundColor Cyan
