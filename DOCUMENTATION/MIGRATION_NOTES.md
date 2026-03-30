# Migration Notes - Important Updates Required

## ⚠️ Manual Updates Required

These files need manual updates to complete the client-server architecture:

---

## 1. Django Settings - Add Model Server URL

**File:** `ADMINISTRATION_POST/DJANGO_SERVER/FRSYS/settings.py`

**Add after database configuration (around line 100):**

```python
# Model Server Configuration
MODEL_SERVER_URL = os.getenv('MODEL_SERVER_URL', 'http://localhost:5000')
```

**Also ensure dotenv is loaded at the top:**

```python
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
```

---

## 2. Update Django Consumers to Use Model Server

**File:** `ADMINISTRATION_POST/DJANGO_SERVER/server/consumers.py`

**Add import at top of file:**

```python
from .services.model_client import ModelServerClient
from django.conf import settings
```

**In the consumer class `__init__` method, add:**

```python
def __init__(self):
    super().__init__()
    self.model_client = ModelServerClient(settings.MODEL_SERVER_URL)
```

**Replace direct DeepFace calls with model_client calls:**

**Old code (to replace):**
```python
# Wherever you have:
result = DeepFace.find(...)
# or
from deepface import DeepFace
```

**New code:**
```python
# Use instead:
result = self.model_client.recognize_face(frame_image)

# The result will be:
# {
#     "success": bool,
#     "person_id": str,
#     "confidence": float,
#     "message": str
# }
```

---

## 3. Update React API Configuration

**File:** `SURVEILLANCE_POST/REACT_CLIENT/src/services/api.js`

**Update the API base URL to use environment variable:**

```javascript
// At the top of the file
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

// Export for use in components
export { API_BASE_URL, WS_BASE_URL };

// Update all fetch calls to use API_BASE_URL
// Example:
// fetch(`${API_BASE_URL}/api/persons/`)
```

---

## 4. Install Additional Dependencies

**Administration Post:**

```powershell
cd ADMINISTRATION_POST\DJANGO_SERVER
pip install python-dotenv requests
```

**Surveillance Post:**

```powershell
cd SURVEILLANCE_POST\REACT_CLIENT
# Dependencies should be listed in package.json already
npm install
```

---

## 5. Create .env Files from Examples

**Administration Post:**

```powershell
cd ADMINISTRATION_POST\DJANGO_SERVER
cp .env.example .env
# Edit .env with your actual configuration
```

**Surveillance Post:**

```powershell
cd SURVEILLANCE_POST\REACT_CLIENT
cp .env.example .env
# Edit .env with administration PC IP
```

---

## 6. Face Database Path

**Update in:** `ADMINISTRATION_POST/MODEL_SERVER/app.py`

**Line ~24:**

```python
# Change this path to your actual face database
DB_PATH = r"C:\path\to\your\face\database"
# Example: DB_PATH = r"C:\FaceRecognition\Faces"
```

**Create the directory if it doesn't exist:**

```powershell
mkdir C:\FaceRecognition\Faces
```

**Add face images to the database:**
- Save images as: `{person_id}.jpg` (e.g., `PMG001.jpg`, `JOHN_DOE.jpg`)
- Use clear, front-facing photos
- One image per person

---

## 7. Database Migration

If you have existing data in SQLite:

```powershell
# Export data from old system
cd original\FRSYS
python manage.py dumpdata server > data.json

# Import to new PostgreSQL system
cd ..\..\FRv1.0.1_ClientServer\ADMINISTRATION_POST\DJANGO_SERVER
python manage.py loaddata data.json
```

---

## 8. Optional: Update startup scripts with actual paths

**Files to update:**
- `ADMINISTRATION_POST/START_ADMIN_SERVICES.ps1`
- `SURVEILLANCE_POST/START_SURVEILLANCE_CLIENT.ps1`

Update these variables if paths are different:
```powershell
$dbService = "postgresql-x64-XX"  # Your PostgreSQL version
$adminIP = "192.168.1.XXX"  # Your actual admin PC IP
```

---

## Testing Checklist After Updates

- [ ] Model Server starts: `python MODEL_SERVER/app.py`
- [ ] Django connects to Model Server
- [ ] Django connects to PostgreSQL
- [ ] React app connects to Django API
- [ ] Face recognition works end-to-end
- [ ] WebSocket connection established
- [ ] Video streaming works
- [ ] Multiple surveillance posts can connect

---

## Quick Test Commands

**Test Model Server:**
```powershell
cd ADMINISTRATION_POST\MODEL_SERVER
python app.py
# Open browser: http://localhost:5000/health
```

**Test Django:**
```powershell
cd ADMINISTRATION_POST\DJANGO_SERVER
python manage.py runserver
# Open browser: http://localhost:8000/api/status
```

**Test React:**
```powershell
cd SURVEILLANCE_POST\REACT_CLIENT
npm start
# Browser should open automatically
```

---

## Need Help?

Refer to:
- `DOCUMENTATION/DEPLOYMENT_GUIDE.md` - Step-by-step instructions
- `DOCUMENTATION/ARCHITECTURE_GUIDE.md` - Technical details
- `DOCUMENTATION/CONFIGURATION_CHECKLIST.md` - Configuration checklist

---

Last Updated: March 9, 2026
