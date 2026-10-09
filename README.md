# FRSYS — Face Recognition Outing Control

FRSYS tracks people who leave a site on an authorised outing and recognises them by face, through an IP camera, when they come back. It records whether they came back on time or late, and shows guards at the entrance posts who they are looking at, live.

The interface is available in French/English and Arabic (right-to-left).

## How it works

1. An admin registers **companies** and **persons** (each person has a matricule and a face photo).
2. An admin records an **outing** for a person: departure time and return deadline. Outings can be imported from an Excel file.
3. At an entrance post, a guard opens the **Returns** page. The camera stream switches to *return* mode.
4. When a person on an outing walks in front of the camera, they are recognised. Their **return** is recorded automatically and marked **late** if the deadline has passed.
5. Other pages show the live stream with detections (**Video stream**), who is currently out (**Check-ins**), and the history of returns.

## Architecture

```
 Entrance posts (browsers)                 Administration PC
┌──────────────────────────┐   HTTP/WS   ┌───────────────────────────────┐
│ React client (port 3000) │ ──────────► │ Django API + WebSockets (8000) │
└──────────────────────────┘             │   │                  │         │
                                         │   ▼                  ▼         │
                    IP camera (RTSP) ───►│ PostgreSQL     Model server   │
                                         │                (FastAPI 5000) │
                                         └───────────────────────────────┘
```

- **Django server** (`servers/DJANGO_SERVER`): REST API, authentication, and the live camera stream over WebSockets. It reads the RTSP camera and sends frames to the model server for recognition. Then it matches each recognised person against their outings and records returns.
- **Model server** (`servers/MODEL_SERVER`): a small FastAPI service that owns the InsightFace (`buffalo_l`) model and the face embeddings. It exposes `POST /api/detect`, which returns every face in a frame with its position and best match. Only Django calls it.
- **Client** (`client/REACT_CLIENT`): React 19 + Vite single-page app used by admins and by guards at the posts. Its look, components, motion and accessibility rules are documented in [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md). It has light and dark themes and supports Arabic RTL.

### Roles

| Role | Can do |
|---|---|
| **Admin** | Everything: companies, persons, cameras, outings (incl. Excel import), access control (invite guards, manage accounts), live notifications of which guards are online. |
| **Guest** (guard at a post) | Video stream, Check-ins and Returns pages. Recording returns from the camera is part of their job. |

Admins invite guards with one-time registration tokens (*Access control* page → `/register-with-token`).

## Project structure

```
servers/
  DJANGO_SERVER/      Django project (FRSYS/) and app (server/)
    server/services/  camera stream, recognition client, outing logic
  MODEL_SERVER/       FastAPI face-recognition service
client/
  REACT_CLIENT/       React + Vite frontend
docker/               Dockerfiles, docker-compose.yml, nginx config, photos/ folder
requirements.txt      Python dependencies for both servers (one virtualenv)
```

## Run with Docker (recommended)

Everything runs on the administration PC: PostgreSQL, the model server, Django, and the client served by nginx. Only one port is published. nginx forwards `/api`, `/ws` and `/admin` to Django, so the posts just open `http://<admin PC IP>` in a browser.

```bash
cd docker
cp .env.example .env          # set SITE_ORIGINS, ALLOWED_HOSTS and generate the secrets (commands inside)
docker compose up -d --build
docker compose exec django python manage.py createsuperuser   # first admin account
```

- **Face photos:** put them in `docker/photos/<matricule>/main.jpg`, or upload a zip from the *Access control* page. Then restart the model server (`docker compose restart model`), which loads photos at startup. The folder's contents are git-ignored.
- **First start:** the model server downloads the InsightFace model (~300 MB, internet needed). It is kept in a volume.
- **Data:** the database, the model cache and the generated migrations live in Docker volumes (`db_data`, `model_cache`, `django_migrations`).
- **Logs:** `docker compose logs -f django` (or `model`, `client`, `db`).

| File | Purpose |
|---|---|
| `docker/docker-compose.yml` | The four services, volumes and the single published port |
| `docker/django.Dockerfile` | Django API + WebSockets (Daphne) |
| `docker/model.Dockerfile` | Face-recognition model server |
| `docker/client.Dockerfile` | Builds the React app and serves it with nginx |
| `docker/nginx.conf` | Static files + proxy to Django |
| `docker/.env.example` | Settings and secrets for the stack |

## Run without Docker

### Requirements

- Python 3.12, Node.js 20+, PostgreSQL 14+
- An RTSP IP camera reachable from the administration PC
- Face photos laid out as `<FACE_DB_PATH>/<matricule>/main.jpg`

### 1. Python environment

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
```

### 2. Configuration

Each service reads a `.env` file, which is git-ignored. Copy the example and fill it in:

```bash
cp servers/DJANGO_SERVER/.env.example servers/DJANGO_SERVER/.env
cp servers/MODEL_SERVER/.env.example  servers/MODEL_SERVER/.env
cp client/REACT_CLIENT/.env.example   client/REACT_CLIENT/.env
```

Settings that matter most:

| Variable | Where | Purpose |
|---|---|---|
| `SECRET_KEY` | Django | Signs login tokens. Django refuses a placeholder unless `DEBUG=1`. |
| `CORS_ALLOWED_ORIGINS` | Django | **Every address the client is opened from** (e.g. `http://192.168.1.10:3000`). Also used for CSRF and WebSocket checks: a post missing here can't log in or stream. |
| `ALLOWED_HOSTS` | Django | The administration PC's address. |
| `DB_*` | Django | PostgreSQL connection. |
| `FACE_DB_PATH` | Django + model server | Face photos folder (same value in both). |
| `MODEL_SERVER_TOKEN` | Django + model server | Shared secret between the two servers. |
| `CAMERA_CREDENTIALS_KEY` | Django | Encrypts camera passwords in the database. |
| `VITE_API_BASE_URL`, `VITE_WS_URL` | Client | Where the Django server is. |

The `.env.example` files list every variable, with comments and the commands to generate keys.

### 3. Database

```bash
cd servers/DJANGO_SERVER
python manage.py makemigrations server   # migrations are generated per environment
python manage.py migrate
python manage.py createsuperuser         # first admin account
```

### 4. Run

Start each service in its own terminal:

```bash
# Model server (loads the model and the face photos at startup)
cd servers/MODEL_SERVER
python app.py

# Django API + WebSockets
cd servers/DJANGO_SERVER
daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application

# Client
cd client/REACT_CLIENT
npm install
npm run dev                              # http://localhost:3000
```

Then log in as the admin, add a camera on the **Cameras** page and activate it. Only one camera is active at a time.

> The model server loads face photos when it starts. Restart it after adding or changing photos.

## Tests

```bash
# Django (in-memory SQLite, no Postgres or .env needed)
cd servers/DJANGO_SERVER
python manage.py test server --settings=FRSYS.test_settings

# Model server (fake model, nothing downloaded)
cd servers/MODEL_SERVER
python test_detect.py

# Client
cd client/REACT_CLIENT
npm run lint
npm run build
```

## Security notes

- Logins use HttpOnly JWT cookies. The access token lasts 15 minutes and is refreshed automatically. Writes require a CSRF token.
- WebSockets only accept connections from the origins in `CORS_ALLOWED_ORIGINS`.
- Camera passwords are encrypted in the database and never returned by the API.
- Keep PostgreSQL and the model server off the network. With Docker only the client port is published. Without Docker, only port 8000 (Django) needs to be reachable from the posts.
