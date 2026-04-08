@echo off
setlocal
cd /d "%~dp0SURVEILLANCE_POST"

if not exist ".env.frontend" (
  echo [INFO] .env.frontend not found. Creating it from template...
  copy ".env.frontend.example" ".env.frontend" >nul
)

echo [INFO] Starting frontend container on PC2 in background...
docker compose --env-file .env.frontend -f docker-compose.frontend.yml up -d --build
if errorlevel 1 (
  echo [ERROR] Failed to start frontend container.
  exit /b 1
)

echo [OK] Frontend started.
echo [INFO] Open: http://192.168.1.104:3000
exit /b 0
