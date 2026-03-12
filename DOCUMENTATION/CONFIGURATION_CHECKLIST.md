# Configuration Checklist

## ✅ Pre-Deployment Checklist

Use this checklist to ensure proper configuration before deploying.

---

## Administration Post PC

### 1. Database Setup
- [ ] PostgreSQL installed
- [ ] PostgreSQL service running
- [ ] Database `frsys_db` created
- [ ] User `frsys_user` created with password
- [ ] Privileges granted
- [ ] Connection tested

### 2. Django Configuration

**File:** `ADMINISTRATION_POST/DJANGO_SERVER/.env`

- [ ] Copy `.env.example` to `.env`
- [ ] Update `SECRET_KEY` (generate new one)
- [ ] Set `DEBUG=False` for production
- [ ] Update `ALLOWED_HOSTS` with:
  - [ ] Administration PC IP (e.g., 192.168.1.100)
  - [ ] All surveillance post IPs (e.g., 192.168.1.10, .11, .12)
- [ ] Update `DB_PASSWORD` (match PostgreSQL password)
- [ ] Update `CORS_ALLOWED_ORIGINS` with surveillance post URLs
- [ ] Update `CSRF_TRUSTED_ORIGINS` with surveillance post URLs
- [ ] Verify `MODEL_SERVER_URL=http://localhost:5000`
- [ ] Update `FACE_DB_PATH` to your face database location

### 3. Model Server Configuration

**File:** `ADMINISTRATION_POST/MODEL_SERVER/app.py`

- [ ] Update `DB_PATH` variable (line ~24) to your face database path
- [ ] Verify it points to a directory with face images

### 4. Python Dependencies

```powershell
cd ADMINISTRATION_POST\MODEL_SERVER
pip install -r requirements.txt

cd ..\DJANGO_SERVER
pip install psycopg2-binary django-cors-headers channels daphne django-filter djangorestframework
```

- [ ] Model Server dependencies installed
- [ ] Django dependencies installed
- [ ] No installation errors

### 5. Django Setup

```powershell
cd ADMINISTRATION_POST\DJANGO_SERVER
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

- [ ] Migrations created
- [ ] Migrations applied to database
- [ ] Superuser created

### 6. Network Configuration

- [ ] Administration PC has static IP (recommended) or note dynamic IP
- [ ] Firewall rule created for port 8000:
  ```powershell
  New-NetFirewallRule -DisplayName "Django FRSYS" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
  ```
- [ ] Firewall verified with: `Get-NetFirewallRule -DisplayName "Django FRSYS"`

### 7. Test Services

- [ ] PostgreSQL: `Test-NetConnection -ComputerName localhost -Port 5432`
- [ ] Model Server health: Open `http://localhost:5000/health` in browser
- [ ] Django API: Open `http://localhost:8000/api/status` in browser

---

## Surveillance Post PC(s)

### For Each Surveillance Post:

### 1. Software Installation
- [ ] Node.js installed (version 16+)
- [ ] npm working: `npm --version`

### 2. Files Copied
- [ ] `SURVEILLANCE_POST` folder copied to surveillance PC
- [ ] All files intact

### 3. React Configuration

**File:** `SURVEILLANCE_POST/REACT_CLIENT/.env`

- [ ] Copy `.env.example` to `.env`
- [ ] Update `REACT_APP_API_URL` with admin PC IP:
  ```
  REACT_APP_API_URL=http://192.168.1.100:8000
  ```
- [ ] Update `REACT_APP_WS_URL` with admin PC IP:
  ```
  REACT_APP_WS_URL=ws://192.168.1.100:8000
  ```

### 4. Dependencies Installation

```powershell
cd SURVEILLANCE_POST\REACT_CLIENT
npm install
```

- [ ] Dependencies installed successfully
- [ ] No errors in installation

### 5. Network Testing

- [ ] Ping administration PC: `ping 192.168.1.100`
- [ ] Test API port: `Test-NetConnection -ComputerName 192.168.1.100 -Port 8000`
- [ ] Both tests successful

### 6. Camera Setup
- [ ] Camera connected (USB webcam or IP camera)
- [ ] Camera permissions enabled in browser
- [ ] Camera tested in other application (verify it works)

---

## Network Configuration Summary

Record your network configuration:

**Administration Post PC:**
- IP Address: `_________________` (e.g., 192.168.1.100)
- Subnet Mask: `_________________` (e.g., 255.255.255.0)
- Gateway: `_________________`

**Surveillance Post #1:**
- IP Address: `_________________` (e.g., 192.168.1.10)
- Connects to: `http://________:8000`

**Surveillance Post #2:**
- IP Address: `_________________` (e.g., 192.168.1.11)
- Connects to: `http://________:8000`

**Surveillance Post #3:**
- IP Address: `_________________` (e.g., 192.168.1.12)
- Connects to: `http://________:8000`

---

## Final Testing

### Administration Post
- [ ] Run `START_ADMIN_SERVICES.ps1`
- [ ] All 3 services start successfully
- [ ] No error messages
- [ ] Access admin panel: `http://localhost:8000/admin`
- [ ] Login with superuser credentials

### Surveillance Post
- [ ] Run `START_SURVEILLANCE_CLIENT.ps1`
- [ ] Connection test passes
- [ ] React app starts
- [ ] Browser opens automatically
- [ ] Can connect to WebSocket
- [ ] Camera feed displays

### End-to-End Test
- [ ] Video stream from surveillance post shows on admin
- [ ] Face recognition processes frames
- [ ] Recognition results display correctly
- [ ] Data saves to database
- [ ] Multiple surveillance posts can connect simultaneously

---

## Common Issues & Solutions

### ❌ "Cannot connect to Administration PC"
**Solution:** 
1. Verify admin PC IP address
2. Check firewall on admin PC
3. Ensure admin services are running

### ❌ "Database connection failed"
**Solution:**
1. Check PostgreSQL service is running
2. Verify credentials in `.env`
3. Test connection: `psql -U frsys_user -d frsys_db -h localhost`

### ❌ "Model Server not responding"
**Solution:**
1. Check if Model Server is running
2. Verify `DB_PATH` exists and contains images
3. Check Model Server logs

### ❌ "CORS error in browser"
**Solution:**
1. Add surveillance PC IP to `CORS_ALLOWED_ORIGINS` in Django `.env`
2. Restart Django server

### ❌ "No camera detected"
**Solution:**
1. Check camera connection
2. Enable camera permissions in browser
3. Try different browser if issue persists

---

## Post-Deployment

After successful deployment:

- [ ] Document all IP addresses and configurations
- [ ] Create backup of database: `pg_dump -U frsys_user -d frsys_db > backup.sql`
- [ ] Train face recognition with employee photos
- [ ] Test with known and unknown faces
- [ ] Monitor system performance
- [ ] Set up automated database backups
- [ ] Create operational procedures document

---

**Configuration completed on:** __________________  
**Configured by:** __________________  
**Notes:** ________________________________
