# Database Setup Instructions

## PostgreSQL Installation & Configuration

### Step 1: Install PostgreSQL

Download and install PostgreSQL from:
https://www.postgresql.org/download/windows/

### Step 2: Start PostgreSQL Service

```powershell
# Start PostgreSQL service
Start-Service postgresql-x64-14  # Adjust version number

# Verify service is running
Get-Service postgresql-x64-14
```

### Step 3: Create Database and User

```powershell
# Open PostgreSQL command line (run as postgres user)
psql -U postgres

# In PostgreSQL prompt, run these commands:
```

```sql
-- Create database
CREATE DATABASE frsys_db;

-- Create user
CREATE USER frsys_user WITH PASSWORD 'YourSecurePassword123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE frsys_db TO frsys_user;

-- Grant schema privileges (PostgreSQL 15+)
\c frsys_db
GRANT ALL ON SCHEMA public TO frsys_user;

-- Exit
\q
```

### Step 4: Test Connection

```powershell
# Test database connection
psql -U frsys_user -d frsys_db -h localhost

# If successful, you'll see:
# frsys_db=>

# Type \q to exit
```

### Step 5: Configure Django

The database settings are already configured in Django's settings.py:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'frsys_db',
        'USER': 'frsys_user',
        'PASSWORD': 'YourSecurePassword123!',  # Change this!
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### Step 6: Run Django Migrations

```powershell
cd ..\DJANGO_SERVER
python manage.py makemigrations
python manage.py migrate
```

## Alternative: Using Docker

If you prefer using Docker:

```powershell
# Run PostgreSQL in Docker
docker run --name frsys-db `
  -e POSTGRES_DB=frsys_db `
  -e POSTGRES_USER=frsys_user `
  -e POSTGRES_PASSWORD=YourSecurePassword123! `
  -p 127.0.0.1:5432:5432 `
  -d postgres:15

# Verify container is running
docker ps

# Check logs
docker logs frsys-db
```

## Troubleshooting

### Connection Refused

```powershell
# Check if PostgreSQL is running
Get-Service postgresql-x64-14

# Check if port 5432 is listening
Test-NetConnection -ComputerName localhost -Port 5432
```

### Authentication Failed

Edit `pg_hba.conf` file (usually in `C:\Program Files\PostgreSQL\15\data\`):

```
# Add this line:
host    frsys_db    frsys_user    127.0.0.1/32    md5
```

Then restart PostgreSQL:

```powershell
Restart-Service postgresql-x64-14
```

## Backup and Restore

### Create Backup

```powershell
pg_dump -U frsys_user -d frsys_db > backup.sql
```

### Restore Backup

```powershell
psql -U frsys_user -d frsys_db < backup.sql
```

## Security Recommendations

1. **Change default password**: Use a strong password in production
2. **Restrict network access**: PostgreSQL should only listen on localhost
3. **Regular backups**: Set up automated backup schedule
4. **Monitor connections**: Check logs regularly
