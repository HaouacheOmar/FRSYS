FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# ffmpeg: fallback camera probe (OpenCV ships its own FFmpeg for the stream itself)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# One requirements.txt serves both servers; Django doesn't need the model stack.
COPY requirements.txt /tmp/requirements.txt
RUN grep -vxE 'fastapi|uvicorn|python-multipart|onnxruntime|insightface' /tmp/requirements.txt > /tmp/django.txt \
    && pip install --no-cache-dir -r /tmp/django.txt

COPY servers/DJANGO_SERVER/ /app/

EXPOSE 8000
# Migrations are git-ignored (generated per environment); the migrations folder is a volume
# so they survive rebuilds. ponytail: commit migrations to drop the makemigrations step.
CMD ["sh", "-c", "python manage.py makemigrations server && python manage.py migrate && daphne -b 0.0.0.0 -p 8000 FRSYS.asgi:application"]
