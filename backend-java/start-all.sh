#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/../.env"
LOG_DIR="/tmp/creativeai-logs"
mkdir -p "$LOG_DIR"

# ── Charger le .env ──────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
    set +a
fi

# Variables supplémentaires non présentes dans .env
export REDIS_PORT="${REDIS_PORT:-6382}"
export JWT_SECRET="${JWT_SECRET:-creativeai-super-secret-key-that-is-long-enough-for-hs256}"
export AGENT_TEAM_BASE_URL="${AGENT_TEAM_BASE_URL:-http://localhost:8087}"

# ── Définition des services ──────────────────────────────────────────────────
declare -A JARS=(
    [api-gateway]="api-gateway/target/api-gateway-1.0.0-SNAPSHOT.jar"
    [auth-service]="auth-service/target/auth-service-1.0.0-SNAPSHOT.jar"
    [search-service]="search-service/target/search-service-1.0.0-SNAPSHOT.jar"
    [docfusion-service]="docfusion-service/target/docfusion-service-1.0.0-SNAPSHOT.jar"
    [rag-service]="rag-service/target/rag-service-1.0.0-SNAPSHOT.jar"
    [agent-team-service]="agent-team-service/target/agent-team-service-1.0.0-SNAPSHOT.jar"
    [telegram-mcp-service]="telegram-mcp-service/target/telegram-mcp-service-1.0.0-SNAPSHOT.jar"
)

declare -A PORTS=(
    [api-gateway]=8080
    [auth-service]=8081
    [search-service]=8082
    [docfusion-service]=8083
    [rag-service]=8084
    [agent-team-service]=8087
    [telegram-mcp-service]=8092
)

ORDER=(api-gateway auth-service search-service docfusion-service rag-service agent-team-service telegram-mcp-service)

# ── Démarrage ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║     CreativeAI Studio — Démarrage des services   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

for svc in "${ORDER[@]}"; do
    PORT="${PORTS[$svc]}"
    JAR="$ROOT/${JARS[$svc]}"
    LOG="$LOG_DIR/$svc.log"

    # Vérifier si déjà actif sur ce port
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        echo "  ✅ $svc (port $PORT) — déjà en cours"
        continue
    fi

    if [[ ! -f "$JAR" ]]; then
        echo "  ⚠️  $svc — JAR introuvable : $JAR"
        continue
    fi

    nohup java -jar "$JAR" > "$LOG" 2>&1 &
    echo "  🚀 $svc (port $PORT) — démarré (PID $!, log: $LOG)"
done

echo ""
echo "Attente du démarrage (15s)..."
sleep 15

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║                    État final                    ║"
echo "╚══════════════════════════════════════════════════╝"
for svc in "${ORDER[@]}"; do
    PORT="${PORTS[$svc]}"
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        echo "  ✅ $svc → http://localhost:$PORT"
    else
        echo "  ❌ $svc (port $PORT) — pas encore actif"
    fi
done

echo ""
echo "Logs dans $LOG_DIR/"
echo "Telegram bot : tail -f $LOG_DIR/telegram-mcp-service.log"
echo ""
