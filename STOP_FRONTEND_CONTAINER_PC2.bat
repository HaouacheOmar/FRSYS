@echo off
setlocal
cd /d "%~dp0SURVEILLANCE_POST"

echo [INFO] Stopping frontend container...
docker compose --env-file .env.frontend -f docker-compose.frontend.yml down
if errorlevel 1 (
  echo [ERROR] Failed to stop frontend container.
  exit /b 1
)

echo [OK] Frontend container stopped.
exit /b 0
