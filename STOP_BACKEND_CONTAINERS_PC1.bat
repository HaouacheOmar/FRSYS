@echo off
setlocal
cd /d "%~dp0ADMINISTRATION_POST"

echo [INFO] Stopping backend containers...
docker compose --env-file .env.backend -f docker-compose.backend.yml down
if errorlevel 1 (
  echo [ERROR] Failed to stop backend containers.
  exit /b 1
)

echo [OK] Backend containers stopped.
exit /b 0
