# Surveillance Post - Startup Script
# This script starts the React client application on surveillance PCs

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "   Face Recognition - Surveillance Post Client            " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration - UPDATE THIS WITH YOUR ADMIN PC IP!
$adminIP = "192.168.1.100"  # ⚠ CHANGE THIS to your Administration PC's IP address
$adminPort = 8000
$reactPath = Join-Path $PSScriptRoot "REACT_CLIENT"

Write-Host "[INFO] Configuration:" -ForegroundColor Yellow
Write-Host "  Administration PC: http://$adminIP:$adminPort" -ForegroundColor Gray
Write-Host "  React Client Path: $reactPath" -ForegroundColor Gray
Write-Host ""

# Test connection to Administration Server
Write-Host "[1/3] Testing connection to Administration PC..." -ForegroundColor Green
Write-Host "  Target: $adminIP:$adminPort" -ForegroundColor Gray

$connection = Test-NetConnection -ComputerName $adminIP -Port $adminPort -WarningAction SilentlyContinue -InformationLevel Quiet

if ($connection) {
    Write-Host "✓ Connection successful!" -ForegroundColor Green
} else {
    Write-Host "✗ Cannot connect to Administration PC!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Verify Administration PC IP address: $adminIP" -ForegroundColor White
    Write-Host "  2. Ensure administration services are running" -ForegroundColor White
    Write-Host "  3. Check network connection" -ForegroundColor White
    Write-Host "  4. Verify firewall allows port $adminPort" -ForegroundColor White
    Write-Host ""
    
    # Ping test
    Write-Host "  Attempting to ping $adminIP..." -ForegroundColor Gray
    $ping = Test-Connection -ComputerName $adminIP -Count 2 -Quiet
    if ($ping) {
        Write-Host "  ✓ Ping successful (network connection OK)" -ForegroundColor Green
        Write-Host "  ✗ Port $adminPort is not accessible (check firewall/services)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ Ping failed (network connection issue)" -ForegroundColor Red
    }
    
    Write-Host ""
    $continue = Read-Host "Do you want to continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}
Write-Host ""

# Check if React app exists
Write-Host "[2/3] Checking React application..." -ForegroundColor Green

if (-not (Test-Path $reactPath)) {
    Write-Host "✗ React application not found at: $reactPath" -ForegroundColor Red
    Write-Host "  Please ensure the React app is copied to this location" -ForegroundColor Yellow
    pause
    exit
}

$packageJsonPath = Join-Path $reactPath "package.json"
if (-not (Test-Path $packageJsonPath)) {
    Write-Host "✗ package.json not found in React app" -ForegroundColor Red
    Write-Host "  Path checked: $packageJsonPath" -ForegroundColor Yellow
    pause
    exit
}

Write-Host "✓ React application found" -ForegroundColor Green
Write-Host ""

# Check if dependencies are installed
$nodeModulesPath = Join-Path $reactPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "⚠ Node modules not installed. Installing dependencies..." -ForegroundColor Yellow
    cd $reactPath
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        pause
        exit
    }
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
}

# Start React Application
Write-Host "[3/3] Starting React Client Application..." -ForegroundColor Green
Write-Host "  Mode: Development Server" -ForegroundColor Gray
Write-Host "  URL: http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Starting application...                                 " -ForegroundColor Green
Write-Host "  Browser will open automatically                         " -ForegroundColor Green
Write-Host "  Press Ctrl+C in this window to stop the server          " -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Start React Dev Server
cd $reactPath
npm start

# If npm start exits
Write-Host ""
Write-Host "Application stopped." -ForegroundColor Yellow
pause
