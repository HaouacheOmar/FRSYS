@echo off
echo ==========================================
echo Starting Face Recognition System (FRSYS)
echo ==========================================

:: Aller dans le dossier backend
cd DOCKER\back
echo Starting Backend Services (DB, Django, Model)...
docker compose up --build -d

:: Aller dans le dossier frontend
cd ..\front
echo Starting Frontend Service (React)...
docker compose up --build -d

:: Revenir a la racine
cd ..\..

echo ==========================================
echo Waiting for services and database migrations...
timeout /t 15 /nobreak > nul

echo Opening Face Recognition App in browser...
start http://localhost:3000

echo Done! System is running in background.
pause
