@echo off
setlocal
cd /d "%~dp0ADMINISTRATION_POST"

if not exist ".env.backend" (
  echo [INFO] .env.backend not found. Creating it from template...
  copy ".env.backend.example" ".env.backend" >nul
)

echo [INFO] Starting backend containers on PC1 in background...
docker compose --env-file .env.backend -f docker-compose.backend.yml up -d --build
if errorlevel 1 (
  echo [ERROR] Failed to start backend containers.
  exit /b 1
)

echo [OK] Backend started.
echo [INFO] Django: http://192.168.1.105:8000
echo [INFO] Model:  http://192.168.1.105:5000
exit /b 0
