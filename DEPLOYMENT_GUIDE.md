# Deployment Guide: Surveillance & Administration Post Setup

## Quick Overview

**Your Setup:**
- **Surveillance Post PCs**: Run React client app, connected to cameras
- **Administration Post PC**: Runs ALL backend services (Django, Database, Model Server)

## Step-by-Step Deployment

---

## PART 1: Administration Post PC Setup

This PC will host all backend services and needs to be more powerful (especially for face recognition).

### Prerequisites

```powershell
# Check Python version (should be 3.9+)
python --version

# Check PostgreSQL installation
psql --version

# If not installed, download from:
# https://www.postgresql.org/download/windows/
```

### Step 1: Configure Database

```powershell
# Start PostgreSQL service
Start-Service postgresql-x64-14

# Create database and user
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE frsys_db;
CREATE USER frsys_user WITH PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE frsys_db TO frsys_user;
\q
```

### Step 2: Set Up Model Server

```powershell
# Create Model Server directory
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1
mkdir MODEL_SERVER
cd MODEL_SERVER

# Create directory structure
mkdir services
mkdir models

# Copy the code from ARCHITECTURE_GUIDE.md or create files:
# - app.py
# - services/face_recognition.py
# - requirements.txt

# Install dependencies
pip install -r requirements.txt
```

**MODEL_SERVER/app.py** - Copy from ARCHITECTURE_GUIDE.md

**MODEL_SERVER/requirements.txt:**
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
deepface==0.0.99
opencv-python==4.8.1.78
pillow==10.1.0
numpy==1.24.3
```

### Step 3: Configure Django Settings

Edit `FRSYS/FRSYS/settings.py`:

```python
# Import os and load_dotenv at the top
import os
from dotenv import load_dotenv
load_dotenv()

# Database Configuration - Local PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'frsys_db',
        'USER': 'frsys_user',
        'PASSWORD': 'YourSecurePassword123!',
        'HOST': 'localhost',  # Same machine
        'PORT': '5432',
    }
}

# Model Server - Local
MODEL_SERVER_URL = 'http://localhost:5000'

# Network Settings - IMPORTANT!
# Replace 192.168.1.100 with YOUR administration PC's actual IP
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.1.100', '*']

# CORS - Allow surveillance posts to connect
# Add your surveillance post IPs
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://192.168.1.10:3000",  # Surveillance Post #1
    "http://192.168.1.11:3000",  # Surveillance Post #2
    "http://192.168.1.12:3000",  # Surveillance Post #3
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://192.168.1.10:3000",
    "http://192.168.1.11:3000",
    "http://192.168.1.12:3000",
]
```

### Step 4: Install Django Dependencies

```powershell
cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS

# Activate virtual environment
..\nvenv\Scripts\Activate.ps1

# Install PostgreSQL adapter
pip install psycopg2-binary

# Install other dependencies if needed
pip install python-dotenv
```

### Step 5: Run Database Migrations

```powershell
# Still in FRSYS directory with venv activated
python manage.py makemigrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser
```

### Step 6: Configure Windows Firewall

```powershell
# Allow Django server port through firewall
New-NetFirewallRule -DisplayName "Django FRSYS Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow

# Verify firewall rule
Get-NetFirewallRule -DisplayName "Django FRSYS Server"
```

### Step 7: Get Administration PC IP Address

```powershell
# Find your network IP
ipconfig | Select-String -Pattern "IPv4"

# Look for something like: 192.168.1.100
# WRITE THIS DOWN - you'll need it for surveillance posts
```

### Step 8: Create Startup Scripts

**C:\Users\youne\OneDrive\Desktop\FRv1.0.1\start_admin_services.ps1:**

```powershell
# Administration Post - All Services Startup Script

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Face Recognition System - Administration PC   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Get IP Address
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*"}).IPAddress
Write-Host "Administration PC IP: $ip" -ForegroundColor Green
Write-Host "Surveillance posts should connect to: http://$ip:8000" -ForegroundColor Yellow
Write-Host ""

# Start PostgreSQL
Write-Host "[1/3] Starting PostgreSQL Database..." -ForegroundColor Green
Start-Service postgresql-x64-14 -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start Model Server
Write-Host "[2/3] Starting Model Server (localhost:5000)..." -ForegroundColor Green
$modelServerPath = "C:\Users\youne\OneDrive\Desktop\FRv1.0.1\MODEL_SERVER"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $modelServerPath; python app.py"
Start-Sleep -Seconds 5

# Start Django Server
Write-Host "[3/3] Starting Django Application Server (0.0.0.0:8000)..." -ForegroundColor Green
$djangoPath = "C:\Users\youne\OneDrive\Desktop\FRv1.0.1\FRSYS"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $djangoPath; ..\nvenv\Scripts\Activate.ps1; daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "All services started!" -ForegroundColor Green
Write-Host "Django API: http://$ip:8000" -ForegroundColor Yellow
Write-Host "Admin Panel: http://$ip:8000/admin" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
```

---

## PART 2: Surveillance Post PC Setup

Do this for EACH surveillance post PC.

### Prerequisites

```powershell
# Install Node.js (if not already installed)
# Download from: https://nodejs.org/

# Check installation
node --version
npm --version
```

### Step 1: Copy React Application

```powershell
# Copy the entire FRSYS_FRONT folder to each surveillance PC
# You can use USB drive, network share, or any file transfer method

# Example path on surveillance PC:
# C:\FaceRecognition\FRSYS_FRONT
```

### Step 2: Configure API Endpoint

Edit `FRSYS_FRONT/my-react-app/.env`:

```env
# Replace 192.168.1.100 with your ACTUAL administration PC IP
REACT_APP_API_URL=http://192.168.1.100:8000
REACT_APP_WS_URL=ws://192.168.1.100:8000
```

If `.env` doesn't exist, create it in the `my-react-app` folder.

### Step 3: Update API Configuration in Code

Edit `FRSYS_FRONT/my-react-app/src/services/api.js` (or wherever API URLs are defined):

```javascript
// Replace with your administration PC IP
const API_BASE_URL = 'http://192.168.1.100:8000';
const WS_BASE_URL = 'ws://192.168.1.100:8000';

export { API_BASE_URL, WS_BASE_URL };
```

### Step 4: Build React Application

```powershell
cd C:\FaceRecognition\FRSYS_FRONT\my-react-app

# Install dependencies (first time only)
npm install

# Build for production
npm run build
```

### Step 5: Create Surveillance Post Startup Script

**C:\FaceRecognition\start_surveillance.ps1:**

```powershell
# Surveillance Post - Client Startup Script

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Face Recognition - Surveillance Post          " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$adminIP = "192.168.1.100"  # CHANGE THIS to your admin PC IP
$reactPath = "C:\FaceRecognition\FRSYS_FRONT\my-react-app"

# Test connection to administration server
Write-Host "Testing connection to Administration PC ($adminIP)..." -ForegroundColor Yellow
$connection = Test-NetConnection -ComputerName $adminIP -Port 8000 -WarningAction SilentlyContinue

if ($connection.TcpTestSucceeded) {
    Write-Host "✓ Connection successful!" -ForegroundColor Green
} else {
    Write-Host "✗ Cannot connect to Administration PC!" -ForegroundColor Red
    Write-Host "  Make sure the administration services are running." -ForegroundColor Yellow
    Write-Host "  Check IP address: $adminIP" -ForegroundColor Yellow
    pause
    exit
}

Write-Host ""
Write-Host "Starting React Client Application..." -ForegroundColor Green

# Option A: Development mode
cd $reactPath
npm start

# Option B: Serve built version (uncomment if you prefer)
# cd "$reactPath\build"
# npx serve -s . -l 3000
```

---

## PART 3: Testing the Setup

### On Administration PC

1. **Run the startup script:**
   ```powershell
   cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1
   .\start_admin_services.ps1
   ```

2. **Verify services are running:**
   - PostgreSQL: `Test-NetConnection -ComputerName localhost -Port 5432`
   - Model Server: Open browser to `http://localhost:5000/health`
   - Django API: Open browser to `http://localhost:8000/api/status`

3. **Note your IP address** from the script output

### On Each Surveillance PC

1. **Run the startup script:**
   ```powershell
   cd C:\FaceRecognition
   .\start_surveillance.ps1
   ```

2. **Browser should auto-open** to `http://localhost:3000`

3. **Test the connection:**
   - Click "Connect" or start video stream
   - Video should stream and be processed

---

## Troubleshooting

### Problem: Surveillance PC can't connect to Administration PC

**Solutions:**
```powershell
# On Administration PC - Check firewall
Get-NetFirewallRule -DisplayName "Django FRSYS Server"

# On Surveillance PC - Test connectivity
Test-NetConnection -ComputerName 192.168.1.100 -Port 8000

# Ping test
ping 192.168.1.100
```

### Problem: CORS errors in browser console

**Solution:** Update Django `settings.py` CORS_ALLOWED_ORIGINS with the surveillance PC IP

### Problem: Model Server not responding

**Solution:**
```powershell
# Check if running
Get-Process -Name python | Where-Object {$_.Path -like "*MODEL_SERVER*"}

# Check port
Test-NetConnection -ComputerName localhost -Port 5000
```

### Problem: Database connection error

**Solution:**
```powershell
# Restart PostgreSQL
Restart-Service postgresql-x64-14

# Test connection
psql -U frsys_user -d frsys_db -h localhost
```

---

## Network Requirements

- **Same LAN**: All PCs must be on the same local network
- **Static IP Recommended**: Set static IP for administration PC
- **Firewall**: Port 8000 must be open on administration PC
- **No Internet Required**: System works entirely on local network

---

## Security Recommendations

1. **Change default passwords** in PostgreSQL and Django
2. **Use static IP** for administration PC to avoid reconfiguration
3. **Firewall rules**: Only allow port 8000, block 5432 and 5000 from network
4. **Backup database** regularly
5. **Restrict physical access** to administration PC

---

## Daily Operations

### Starting the System

1. **Turn on Administration PC first**
2. **Run `start_admin_services.ps1`** on administration PC
3. **Wait ~30 seconds** for all services to start
4. **Turn on Surveillance PCs**
5. **Run `start_surveillance.ps1`** on each surveillance PC

### Shutting Down

1. **Close surveillance applications** on all surveillance PCs
2. **Stop Django server** (Ctrl+C in terminal)
3. **Stop Model Server** (Ctrl+C in terminal)
4. **Stop PostgreSQL** (optional): `Stop-Service postgresql-x64-14`

---

## Next Steps

1. Follow Part 1 to set up Administration PC
2. Follow Part 2 to set up each Surveillance PC
3. Test connectivity between systems
4. Configure cameras on surveillance posts
5. Train face recognition models
6. Add users and configure permissions

Need help with any specific step? Refer to the detailed ARCHITECTURE_GUIDE.md
