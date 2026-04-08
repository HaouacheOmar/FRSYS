# Administration Post - Startup Script
# This script starts all backend services on the administration PC

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "   Face Recognition System - Administration Post          " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$adminPath = $PSScriptRoot

# Configuration
$dbService = "postgresql-x64-14"  # Adjust PostgreSQL version if needed
$modelServerPath = Join-Path $adminPath "MODEL_SERVER"
$djangoPath = Join-Path $adminPath "DJANGO_SERVER"

# Get Administration PC IP Address
Write-Host "[INFO] Detecting network configuration..." -ForegroundColor Yellow
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"}).IPAddress

if ($ip) {
    Write-Host "✓ Administration PC IP Address: $ip" -ForegroundColor Green
    Write-Host "  Surveillance posts should connect to: http://$ip:8000" -ForegroundColor Yellow
} else {
    Write-Host "⚠ Warning: Could not detect network IP automatically" -ForegroundColor Yellow
    Write-Host "  Check your network configuration manually" -ForegroundColor Yellow
    $ip = "localhost"
}
Write-Host ""

# Step 1: Start PostgreSQL Database
Write-Host "[1/3] Starting PostgreSQL Database Service..." -ForegroundColor Green
try {
    Start-Service $dbService -ErrorAction Stop
    Write-Host "✓ PostgreSQL started successfully" -ForegroundColor Green
    Start-Sleep -Seconds 3
} catch {
    Write-Host "⚠ Warning: Could not start PostgreSQL service" -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host "  Please start PostgreSQL manually or check installation" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Start Model Server
Write-Host "[2/3] Starting Face Recognition Model Server..." -ForegroundColor Green
Write-Host "  Path: $modelServerPath" -ForegroundColor Gray
Write-Host "  Binding to: localhost:5000 (internal only)" -ForegroundColor Gray

if (Test-Path $modelServerPath) {
    # Start Model Server in new window
    $modelServerCmd = "cd '$modelServerPath'; python app.py"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $modelServerCmd
    Write-Host "✓ Model Server started in new window" -ForegroundColor Green
    Start-Sleep -Seconds 5
} else {
    Write-Host "✗ Error: Model Server path not found: $modelServerPath" -ForegroundColor Red
    Write-Host "  Please check installation" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Start Django Application Server
Write-Host "[3/3] Starting Django Application Server..." -ForegroundColor Green
Write-Host "  Path: $djangoPath" -ForegroundColor Gray
Write-Host "  Binding to: 0.0.0.0:8000 (accessible from network)" -ForegroundColor Gray

if (Test-Path $djangoPath) {
    # Check if virtual environment exists
    $venvPath = Join-Path (Split-Path $adminPath -Parent) "nvenv"
    
    if (Test-Path $venvPath) {
        # Start Django with virtual environment
        $djangoCmd = "cd '$djangoPath'; `$venvPath = '$venvPath'; & `"`$venvPath\Scripts\Activate.ps1`"; daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application"
    } else {
        # Start Django without virtual environment
        Write-Host "  ⚠ Virtual environment not found, using system Python" -ForegroundColor Yellow
        $djangoCmd = "cd '$djangoPath'; daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application"
    }
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $djangoCmd
    Write-Host "✓ Django Server started in new window" -ForegroundColor Green
    Start-Sleep -Seconds 3
} else {
    Write-Host "✗ Error: Django path not found: $djangoPath" -ForegroundColor Red
    Write-Host "  Please check installation" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "   All Services Started!                                  " -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Status:" -ForegroundColor White
Write-Host "  ✓ PostgreSQL Database:  localhost:5432 (internal)" -ForegroundColor Green
Write-Host "  ✓ Model Server:         localhost:5000 (internal)" -ForegroundColor Green
Write-Host "  ✓ Django API Server:    $ip:8000 (network)" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor White
Write-Host "  • API Status:     http://$ip:8000/api/status" -ForegroundColor Cyan
Write-Host "  • Admin Panel:    http://$ip:8000/admin" -ForegroundColor Cyan
Write-Host "  • Video Stream:   http://$ip:8000/video-stream/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Network Configuration:" -ForegroundColor White
Write-Host "  • Administration PC:    $ip" -ForegroundColor Yellow
Write-Host "  • Surveillance Posts:   Configure to connect to http://$ip:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Press any key to close this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
