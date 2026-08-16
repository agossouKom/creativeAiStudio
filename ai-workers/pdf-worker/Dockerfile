FROM python:3.11-slim

WORKDIR /app

# Dépendances système légères (sans LibreOffice pour accélérer le build)
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 8004

CMD ["./start.sh"]
