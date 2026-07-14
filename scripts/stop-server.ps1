$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -gt 0 }

if (-not $connections) {
  Write-Host "No process is using port 3000."
  exit 0
}

$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $pids) {
  Write-Host "Stopping PID $procId"
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

Write-Host "Port 3000 is free."
