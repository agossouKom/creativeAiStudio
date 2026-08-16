FROM python:3.11-slim

WORKDIR /app

# Crée le répertoire de persistance du mapping
RUN mkdir -p /data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["python", "app/bot.py"]
