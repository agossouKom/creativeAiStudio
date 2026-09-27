#!/usr/bin/env bash
# Deploy a backend service: build JAR then rebuild Docker image.
# Usage: ./deploy.sh <service>
#   service: agent-team | generation | api-gateway | auth | search | rag | docfusion
#            | file-security | frontend
set -euo pipefail

SERVICE=${1:-agent-team}
ROOT="$(cd "$(dirname "$0")" && pwd)"

case "$SERVICE" in
  agent-team)
    MODULE="backend-java/agent-team-service"
    CONTAINER="agent-team-service"
    ;;
  generation)
    MODULE="backend-java/generation-service"
    CONTAINER="generation-service"
    ;;
  api-gateway|gateway)
    MODULE="backend-java/api-gateway"
    CONTAINER="api-gateway"
    ;;
  auth)
    MODULE="backend-java/auth-service"
    CONTAINER="auth-service"
    ;;
  search)
    MODULE="backend-java/search-service"
    CONTAINER="search-service"
    ;;
  docfusion)
    MODULE="backend-java/docfusion-service"
    CONTAINER="docfusion-service"
    ;;
  # Worker Python : pas de JAR, on reconstruit directement l'image.
  file-security)
    echo "==> Building file-security-service image..."
    cd "$ROOT"
    docker compose up -d --build --force-recreate --no-deps file-security-service
    echo "✅ file-security-service deployed"
    exit 0
    ;;
  frontend)
    echo "==> Building Angular frontend..."
    cd "$ROOT/frontend"
    npm run build -- --configuration=production
    echo "==> Redeploying frontend container..."
    cd "$ROOT"
    docker compose up -d --build --force-recreate --no-deps frontend
    echo "✅ frontend deployed"
    exit 0
    ;;
  *)
    echo "Unknown service: $SERVICE"
    echo "Usage: $0 agent-team|generation|api-gateway|auth|search|docfusion|file-security|frontend"
    exit 1
    ;;
esac

echo "==> Building JAR for $MODULE..."
cd "$ROOT/$MODULE"
mvn package -DskipTests -q
echo "==> JAR built: $(ls target/*.jar | grep -v original | head -1)"

echo "==> Rebuilding & redeploying Docker container: $CONTAINER..."
cd "$ROOT"
docker compose up -d --build --no-deps "$CONTAINER"
echo "✅ $SERVICE deployed"
