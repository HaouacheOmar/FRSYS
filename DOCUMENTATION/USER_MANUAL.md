# Face Recognition System - User Manual

Version: 1.0.1  
Date: 2026-03-12

## 1. Purpose

This manual explains how to use and operate the Face Recognition System in production.
It covers:

- System architecture
- Admin and guest roles
- Daily usage flows
- Real-time notifications and presence
- Security behavior
- Troubleshooting

## 2. System Architecture

The project is a distributed client-server platform with one central administration post and one or more surveillance posts.

### 2.1 High-Level Components

- Surveillance Post PC(s): React client UI for operators.
- Administration Post PC: Django API server + WebSocket gateway + PostgreSQL + model server.
- Model Server: Face recognition processing service.

### 2.2 Data and Control Flow

1. User logs in from React UI.
2. Django validates credentials and sets JWT cookies (`access_token`, `refresh_token`) as HTTP-only.
3. React calls protected REST endpoints with `credentials: include`.
4. WebSocket connections are authenticated from JWT cookies.
5. Guest presence socket updates online/offline state in backend.
6. Admin notification socket receives live guest connection updates.
7. Video stream consumer processes frames and returns detections to client.
8. Django business logic stores and serves all records from PostgreSQL.

### 2.3 Architecture Diagram (Logical)

```text
SURVEILLANCE POST(S)
  React Client (UI, AuthContext, LangContext)
      | HTTP + WebSocket
      v
ADMINISTRATION POST
  Django + DRF + Channels (port 8000)
      |-- PostgreSQL (records, users, roles, presence)
      |-- Model Server (face recognition service)
```

### 2.4 Key Backend Files

- `ADMINISTRATION_POST/DJANGO_SERVER/server/auth_views.py`: login, refresh, logout, role/grant token, guest management, CSRF endpoint.
- `ADMINISTRATION_POST/DJANGO_SERVER/server/urls.py`: REST route map.
- `ADMINISTRATION_POST/DJANGO_SERVER/server/consumers.py`: video stream, face recognition, guest presence, admin notifications.
- `ADMINISTRATION_POST/DJANGO_SERVER/server/routing.py`: WebSocket route map.
- `ADMINISTRATION_POST/DJANGO_SERVER/FRSYS/settings.py`: JWT cookie auth, throttling, CSRF/CORS, secure headers.

### 2.5 Key Frontend Files

- `SURVEILLANCE_POST/REACT_CLIENT/src/services/api.js`: API client with CSRF injection and cookie credentials.
- `SURVEILLANCE_POST/REACT_CLIENT/src/context/AuthContext.jsx`: session state, login/logout, guest presence socket.
- `SURVEILLANCE_POST/REACT_CLIENT/src/App.jsx`: protected routes by role.
- `SURVEILLANCE_POST/REACT_CLIENT/src/context/LangContext.jsx`: English/Arabic localization strings.

## 3. Roles and Permissions

### 3.1 Admin Role

Admin can:

- Access full dashboard and data management pages.
- Manage companies, persons, cameras, spectacles, check-ins, and returns.
- Generate secure grant tokens for account creation.
- Manage guest accounts (create, edit username/password/active state, delete).
- Receive live guest connection notifications and online status.

### 3.2 Guest Role

Guest can:

- Login and use limited routes.
- Access live video stream and check-in/return views allowed by policy.
- Send guest presence heartbeat over WebSocket.

## 4. Authentication and Security Behavior

### 4.1 Login and Tokens

- JWT tokens are stored in HTTP-only cookies.
- Access tokens are short-lived.
- Refresh tokens rotate and old refresh tokens are blacklisted.

### 4.2 CSRF Protection

- Frontend obtains CSRF cookie from `/api/auth/csrf/`.
- Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) include `X-CSRFToken`.

### 4.3 Login Protection

- Failed login attempts are tracked.
- Temporary lockout is applied after max attempts.
- DRF throttle scopes apply to auth and guest-management endpoints.

### 4.4 Credentials at Rest

- Camera passwords are encrypted at rest in database.

## 5. API and WebSocket Endpoints (Operational)

### 5.1 Authentication APIs

- `GET /api/auth/csrf/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `POST /api/auth/grant-token/` (admin)
- `POST /api/auth/register-with-token/`
- `POST /api/auth/grant-role/` (admin)
- `GET/POST /api/auth/guests/` (admin)
- `PATCH/DELETE /api/auth/guests/{user_id}/` (admin)

### 5.2 Main APIs

- `/api/compagnies/`
- `/api/persons/`
- `/api/cameras/`
- `/api/spectacles/`
- `/api/rentrees/`
- `/api/status/`

### 5.3 WebSocket Endpoints

- `/ws/video/stream/`
- `/ws/face/recognize/`
- `/ws/presence/guest/`
- `/ws/admin/notifications/`

## 6. Frontend Route Map

### 6.1 Public Routes

- `/login`
- `/register-with-token`

### 6.2 Admin Routes

- `/home`
- `/compagnies/`
- `/persons/`
- `/cameras/`
- `/spectacles/`
- `/access-control/`
- plus shared operational routes below

### 6.3 Shared Admin/Guest Routes

- `/video-stream/`
- `/check-ins/`
- `/rentrees/`

## 7. Daily Usage Guide

### 7.1 Admin First Login

1. Open client URL in browser.
2. Login with admin credentials.
3. Go to `Access Control`.
4. Create grant token or create guest directly.

### 7.2 Provision a Guest with Secure Token

1. Admin creates grant token with expiration and max uses.
2. Share raw token securely with operator.
3. Operator opens `Register With Token` and submits username/password/token.
4. System creates account with configured role.

### 7.3 Manage Guest Accounts

1. Admin opens `Access Control`.
2. View all guests and current online status.
3. Update username/password/active flag as needed.
4. Delete guest account when no longer needed.

### 7.4 Monitor Presence and Notifications

1. Guest login triggers presence socket (`/ws/presence/guest/`).
2. Admin dashboard socket (`/ws/admin/notifications/`) receives status updates.
3. Online users are shown live in Home dashboard.

## 8. Startup and Operations

### 8.1 Administration Post

Use:

- `ADMINISTRATION_POST/START_ADMIN_SERVICES.ps1`

This starts:

- PostgreSQL service
- Model server (`localhost:5000`)
- Django ASGI server (`0.0.0.0:8000`)

### 8.2 Surveillance Post

Use:

- `SURVEILLANCE_POST/START_SURVEILLANCE_CLIENT.ps1`

This validates connectivity and starts React client.

## 9. Configuration Notes

### 9.1 Backend

Configure in:

- `ADMINISTRATION_POST/DJANGO_SERVER/.env`

Important values:

- `SECRET_KEY`, `DEBUG`
- `ALLOWED_HOSTS`
- `DB_*`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `AUTH_COOKIE_*`
- `AUTH_LOGIN_MAX_ATTEMPTS`, `AUTH_LOGIN_LOCK_MINUTES`
- throttle values (`THROTTLE_*`)

### 9.2 Frontend

Current `api.js` default uses `http://localhost:8000/api`.
For distributed deployment, update API/WebSocket base URLs to administration server IP.

## 10. Troubleshooting

### 10.1 Login Fails Repeatedly

- Confirm credentials.
- If lockout triggered, wait lock duration or reset cache.

### 10.2 Guest Not Showing Online

- Confirm guest is logged in.
- Check `/ws/presence/guest/` connection in browser network tools.
- Verify Django Channels server is running.

### 10.3 Admin Not Receiving Notifications

- Check `/ws/admin/notifications/` connection.
- Confirm admin role on account.

### 10.4 React Cannot Reach API

- Verify admin PC IP and firewall port 8000.
- Ensure CORS and CSRF trusted origins include client URL.

## 11. Arabic and English UI

- Language toggle is managed by `LangContext`.
- Main interface strings are available in English and Arabic.
- Route behavior and permissions are language-independent.

## 12. Recommended Operator Procedure

1. Start backend services on administration post.
2. Start each surveillance client.
3. Login with correct role.
4. Validate camera streams and connectivity.
5. Keep dashboard open for live status monitoring.
6. Use logout before closing station.
