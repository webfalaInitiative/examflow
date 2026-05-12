$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Exam-Flow processes on ports 3000 and 5000..." -ForegroundColor Yellow

$ports = @(3000, 5000)
foreach ($port in $ports) {
  $lines = netstat -ano -p tcp | Select-String ":$port"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
    if ($parts.Length -ge 5 -and $parts[3] -eq "LISTENING") {
      $pid = $parts[4]
      if ($pid -match "^\d+$") {
        taskkill /PID $pid /F | Out-Null
        Write-Host "Stopped PID $pid on port $port" -ForegroundColor Green
      }
    }
  }
}

Write-Host "Done." -ForegroundColor Cyan
