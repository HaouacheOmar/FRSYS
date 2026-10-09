FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# insightface pulls the full opencv-python, which needs these system libraries.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /tmp/requirements.txt
RUN grep -xE 'fastapi|uvicorn|python-multipart|python-dotenv|numpy|opencv-python-headless|onnxruntime|insightface' /tmp/requirements.txt > /tmp/model.txt \
    && pip install --no-cache-dir -r /tmp/model.txt

COPY servers/MODEL_SERVER/ /app/

EXPOSE 5000
# 0.0.0.0 inside the container = reachable on the compose network only (no published port).
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
