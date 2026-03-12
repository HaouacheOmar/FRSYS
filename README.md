# Face Recognition System v1.0.1 - Client-Server Architecture

## 📋 Overview

This is a **distributed client-server face recognition system** designed for deployment across multiple PCs:

- **Surveillance Post PCs**: Run React client applications with camera feeds
- **Administration Post PC**: Hosts all backend services (Django API, Database, Model Server)

## 📁 Project Structure

```
FRv1.0.1_ClientServer/
│
├── ADMINISTRATION_POST/          # Deploy to Administration PC
│   ├── DJANGO_SERVER/             # Django application server
│   │   ├── manage.py
│   │   ├── FRSYS/                 # Django project settings
│   │   ├── server/                # Face recognition app
│   │   │   ├── models.py          # Database models
│   │   │   ├── views.py           # API endpoints
│   │   │   ├── consumers.py       # WebSocket handlers
│   │   │   └── services/
│   │   │       ├── model_client.py    # NEW: Client for Model Server
│   │   │       ├── recongnition.py    # Face recognition logic
│   │   │       └── Stream.py          # Video streaming
│   │   └── .env.example           # Configuration template
│   │
│   ├── MODEL_SERVER/              # NEW: Separate face recognition service
│   │   ├── app.py                 # FastAPI server
│   │   ├── services/
│   │   │   └── face_recognition.py  # DeepFace wrapper
│   │   └── requirements.txt
│   │
│   ├── DATABASE_SETUP/            # PostgreSQL setup instructions
│   │   └── README_DATABASE_SETUP.md
│   │
│   └── START_ADMIN_SERVICES.ps1   # 🚀 One-click startup script
│
├── SURVEILLANCE_POST/            # Deploy to each Surveillance PC
│   ├── REACT_CLIENT/              # React frontend application
│   │   ├── src/
│   │   │   ├── components/        # UI components
│   │   │   └── services/
│   │   │       └── api.js         # API client
│   │   ├── package.json
│   │   └── .env.example           # API endpoint configuration
│   │
│   └── START_SURVEILLANCE_CLIENT.ps1  # 🚀 One-click startup script
│
└── DOCUMENTATION/                # Comprehensive guides
    ├── ARCHITECTURE_GUIDE.md      # Technical architecture details
    └── DEPLOYMENT_GUIDE.md        # Step-by-step deployment instructions
```

## 🚀 Quick Start

### For Administration Post PC

1. **Navigate to the folder:**
   ```powershell
   cd C:\Users\youne\OneDrive\Desktop\FRv1.0.1_ClientServer\ADMINISTRATION_POST
   ```

2. **First-time setup:**
   ```powershell
   # Set up database (follow DATABASE_SETUP/README_DATABASE_SETUP.md)
   # Install Python dependencies
   cd DJANGO_SERVER
   pip install -r ..\MODEL_SERVER\requirements.txt
   pip install psycopg2-binary django-cors-headers channels daphne
   
   # Configure environment
   cp .env.example .env
   # Edit .env and update settings (especially IP addresses and passwords)
   
   # Run database migrations
   python manage.py migrate
   python manage.py createsuperuser
   ```

3. **Start all services:**
   ```powershell
   # Simply double-click or run:
   .\START_ADMIN_SERVICES.ps1
   ```

   This starts:
   - PostgreSQL Database (port 5432)
   - Model Server (port 5000)
   - Django API Server (port 8000)

### For Surveillance Post PC

1. **Copy the SURVEILLANCE_POST folder** to each surveillance PC

2. **Configure the connection:**
   ```powershell
   cd REACT_CLIENT
   cp .env.example .env
   # Edit .env and set REACT_APP_API_URL to your Admin PC IP
   # Example: REACT_APP_API_URL=http://192.168.1.100:8000
   ```

3. **Start the client:**
   ```powershell
   # Simply double-click or run:
   ..\START_SURVEILLANCE_CLIENT.ps1
   ```

## 🔧 Configuration

### Administration Post

**File:** `ADMINISTRATION_POST/DJANGO_SERVER/.env`

Key settings to update:
- `ALLOWED_HOSTS`: Add all surveillance post IPs
- `DB_PASSWORD`: Change from default
- `CORS_ALLOWED_ORIGINS`: Add all surveillance post IPs
- `FACE_DB_PATH`: Path to face images database

### Surveillance Post

**File:** `SURVEILLANCE_POST/REACT_CLIENT/.env`

Key settings to update:
- `REACT_APP_API_URL`: Administration PC IP address (e.g., http://192.168.1.100:8000)
- `REACT_APP_WS_URL`: Administration PC WebSocket URL (e.g., ws://192.168.1.100:8000)

## 🌐 Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Surveillance Post PCs                      │
│  (192.168.1.10, .11, .12, etc.)                        │
│                                                          │
│  📷 Camera + React Client                               │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTP/WebSocket (Port 8000)
                   │
┌──────────────────▼──────────────────────────────────────┐
│         Administration Post PC (192.168.1.100)          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🌐 Django API (0.0.0.0:8000) ← Network Accessible     │
│       │                    │                            │
│       │ localhost          │ localhost                  │
│       ▼                    ▼                            │
│  💾 PostgreSQL         🤖 Model Server                  │
│     (localhost:5432)      (localhost:5000)              │
│     ↑ Internal Only       ↑ Internal Only               │
└─────────────────────────────────────────────────────────┘
```

## 📚 Documentation

Detailed guides are available in the `DOCUMENTATION/` folder:

- **[ARCHITECTURE_GUIDE.md](DOCUMENTATION/ARCHITECTURE_GUIDE.md)**: Complete technical architecture, API specifications, and advanced configuration
- **[DEPLOYMENT_GUIDE.md](DOCUMENTATION/DEPLOYMENT_GUIDE.md)**: Step-by-step deployment instructions with troubleshooting

## 🔐 Security Features

✅ Database and Model Server bind to `localhost` only (not exposed to network)  
✅ Only Django API port 8000 is accessible from surveillance posts  
✅ CORS configured to allow only specific surveillance post IPs  
✅ Environment variables for sensitive configuration  
✅ PostgreSQL authentication required  

## ⚙️ Key Changes from Original Version

### What's New:

1. **Separated Model Server**: Face recognition runs as independent FastAPI service
2. **Client-Server Architecture**: Clear separation between surveillance and administration
3. **Network Configuration**: Optimized for multi-PC deployment
4. **One-Click Startup**: PowerShell scripts for easy service management
5. **External Database**: PostgreSQL instead of SQLite for better performance
6. **Security Hardening**: Services properly isolated and configured

### Migration from Original:

The original monolithic application has been restructured:
- `FRSYS/` → `ADMINISTRATION_POST/DJANGO_SERVER/` (updated with model client)
- `FRSYS_FRONT/` → `SURVEILLANCE_POST/REACT_CLIENT/` (configured for remote API)
- Face recognition logic → `ADMINISTRATION_POST/MODEL_SERVER/` (new standalone service)

## 🛠️ Troubleshooting

### Administration Post Issues

**Services won't start:**
```powershell
# Check PostgreSQL
Get-Service postgresql-x64-14

# Test Model Server
Test-NetConnection -ComputerName localhost -Port 5000

# Test Django
Test-NetConnection -ComputerName localhost -Port 8000
```

**Database connection error:**
- Verify PostgreSQL is running
- Check credentials in `.env`
- Follow `DATABASE_SETUP/README_DATABASE_SETUP.md`

### Surveillance Post Issues

**Cannot connect to Administration PC:**
```powershell
# Verify network connectivity
ping 192.168.1.100

# Test API port
Test-NetConnection -ComputerName 192.168.1.100 -Port 8000
```

**Fix:**
- Verify Admin PC IP in `.env`
- Ensure Admin services are running
- Check firewall on Admin PC (port 8000 must be open)

## 📞 Support

For detailed setup and troubleshooting:
1. Check `DOCUMENTATION/DEPLOYMENT_GUIDE.md` for step-by-step instructions
2. Review `DOCUMENTATION/ARCHITECTURE_GUIDE.md` for technical details
3. Check service-specific README files in each folder

## 📋 System Requirements

### Administration Post PC
- Windows 10/11
- Python 3.9+
- PostgreSQL 12+
- 8GB+ RAM (16GB recommended for face recognition)
- Network connection

### Surveillance Post PC
- Windows 10/11
- Node.js 16+
- Webcam/IP Camera
- 4GB+ RAM
- Network connection to Administration PC

## 🎯 Next Steps

1. ✅ Set up Administration Post PC (database, Python dependencies)
2. ✅ Configure network settings and IP addresses
3. ✅ Start administration services
4. ✅ Set up each Surveillance Post PC
5. ✅ Test connectivity between systems
6. ✅ Configure cameras and face database
7. ✅ Train the system with face images
8. ✅ Begin monitoring!

---

**Version:** 1.0.1  
**Architecture:** Client-Server (Distributed)  
**Last Updated:** March 9, 2026
