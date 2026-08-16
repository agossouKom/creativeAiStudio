FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour OpenCV + Playwright/Chromium
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    wget \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# Installe Chromium pour Playwright (headless browser) et ses dépendances système
RUN playwright install chromium && playwright install-deps


COPY app/ ./app/
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 8003

CMD ["./start.sh"]
