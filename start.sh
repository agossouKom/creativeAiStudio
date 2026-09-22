#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  CreativeAIStudio-v2  —  Script de démarrage complet
#  Usage :
#    ./start.sh              Démarrer tout le projet
#    ./start.sh stop         Arrêter tous les conteneurs
#    ./start.sh restart      Arrêter puis redémarrer
#    ./start.sh status       Afficher l'état des services
#    ./start.sh logs [svc]   Suivre les logs (svc = nom compose)
#    ./start.sh build <svc>  Rebuild + redéployer un service
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Prod (serveur) : .env + docker-compose.prod.yml présents → utiliser l'overlay
# + les secrets. Sans ça, un `up -d` recrée les conteneurs en config dev
# (mauvais mots de passe DB → crash loop). En local → fichier compose seul.
COMPOSE="docker compose -f $ROOT/docker-compose.yml"
if [[ -f "$ROOT/.env" && -f "$ROOT/docker-compose.prod.yml" ]] \
  && grep -q '^POSTGRES_PASSWORD=' "$ROOT/.env"; then
  COMPOSE="docker compose --env-file $ROOT/.env -f $ROOT/docker-compose.yml -f $ROOT/docker-compose.prod.yml"
fi
HEALTH="$ROOT/healthcheck.sh"

# ── Couleurs ────────────────────────────────────────────────────
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_BLUE='\033[0;34m'
C_CYAN='\033[0;36m'
C_RED='\033[0;31m'
C_DIM='\033[2m'

info()    { echo -e "${C_BLUE}▸${C_RESET} $*"; }
success() { echo -e "${C_GREEN}✔${C_RESET} $*"; }
warn()    { echo -e "${C_YELLOW}⚠${C_RESET}  $*"; }
error()   { echo -e "${C_RED}✗${C_RESET} $*" >&2; }
title()   { echo -e "\n${C_BOLD}${C_CYAN}$*${C_RESET}"; }

# ── Serveur de contrôle permanent ──────────────────────────────
ensure_control_server() {
  if ! nc -z localhost 8490 2>/dev/null; then
    echo "Démarrage du serveur de contrôle permanent en arrière-plan (port 8490)..."
    nohup python3 "$ROOT/control_server.py" > "$ROOT/control_server.log" 2>&1 &
    sleep 1
  fi
}

# ── Mapping service compose → nom de conteneur ─────────────────
container_for() {
  case "$1" in
    redpanda)              echo "creativeai-kafka" ;;
    otel-collector)        echo "creativeai-otel" ;;
    auth-service)          echo "creativeai-auth" ;;
    api-gateway)           echo "creativeai-gateway" ;;
    search-service)        echo "creativeai-search" ;;
    docfusion-service)     echo "creativeai-docfusion" ;;
    rag-service)           echo "creativeai-rag" ;;
    audio-worker)          echo "creativeai-audio-ai" ;;
    video-worker)          echo "creativeai-video-ai" ;;
    face-worker)           echo "creativeai-face-ai" ;;
    pdf-worker)            echo "creativeai-pdf-ai" ;;
    ocr-worker)            echo "creativeai-ocr-ai" ;;
    kafka-topics-init)     echo "creativeai-kafka-init" ;;
    agent-team-service)    echo "creativeai-agent-team" ;;
    telegram-mcp-service)  echo "creativeai-telegram-mcp" ;;
    *)                     echo "creativeai-$1" ;;
  esac
}

# ── Ordre de démarrage par groupes ─────────────────────────────
INFRA_SERVICES=(postgres redis redpanda minio otel-collector jaeger prometheus grafana pgadmin)
INIT_SERVICES=(kafka-topics-init)
CORE_SERVICES=(auth-service api-gateway)
APP_SERVICES=(agent-team-service rag-service search-service docfusion-service)
AI_WORKERS=(audio-worker video-worker face-worker pdf-worker ocr-worker)
SUPPORT_SERVICES=(gotenberg onlyoffice rxresume penpot-backend penpot-exporter penpot-frontend penpot-mcp telegram-mcp-service ollama)
FRONT_SERVICES=(frontend)

# ── URLs d'accès connues ──────────────────────────────────────
declare -A SERVICE_URLS=(
  [frontend]="http://localhost:4400"
  [api-gateway]="http://localhost:8480"
  [agent-team-service]="http://localhost:8087"
  [rag-service]="http://localhost:8084"
  [pgadmin]="http://localhost:8085"
  [grafana]="http://localhost:3002"
  [prometheus]="http://localhost:9092"
  [jaeger]="http://localhost:16688"
  [minio]="http://localhost:9401"
  [onlyoffice]="http://localhost:8086"
  [rxresume]="http://localhost:3101"
  [penpot-frontend]="http://localhost:9090"
  [gotenberg]="http://localhost:3200"
  [telegram-mcp-service]="http://localhost:8092"
)

# ── Vérification prérequis ─────────────────────────────────────
check_docker() {
  if ! docker info &>/dev/null; then
    error "Docker n'est pas démarré. Lance Docker Desktop ou : sudo systemctl start docker"
    exit 1
  fi
}

# ── Attendre qu'un conteneur soit healthy ─────────────────────
wait_healthy() {
  local svc="$1"
  local label="${2:-$svc}"
  local container
  container=$(container_for "$svc")
  local retries=30
  echo -ne "  ${C_DIM}En attente de ${label}...${C_RESET}"
  for ((i=0; i<retries; i++)); do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
    if [[ "$status" == "healthy" ]]; then
      echo -e "\r  ${C_GREEN}✔${C_RESET} ${label} prêt                          "
      return 0
    fi
    sleep 2
  done
  echo -e "\r  ${C_YELLOW}⚠${C_RESET}  ${label} pas encore healthy (on continue quand même)"
}

# ── Démarrer un groupe de services ────────────────────────────
start_group() {
  local label="$1"; shift
  local services=("$@")
  title "[ $label ]"
  $COMPOSE up -d --no-recreate "${services[@]}" 2>&1 \
    | grep -vE "^#| Pulling | Pulled |Pull complete|Already exists|^$|Network " || true
}

# ── Commande : start ──────────────────────────────────────────
cmd_start() {
  check_docker

  echo ""
  echo -e "${C_BOLD}${C_BLUE}╔══════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}║   CreativeAIStudio-v2  —  Démarrage complet  ║${C_RESET}"
  echo -e "${C_BOLD}${C_BLUE}╚══════════════════════════════════════════════╝${C_RESET}"

  # ─── PRÉ-FLIGHT : Veille & Réparation ─────────────────────────
  if [[ -x "$HEALTH" ]]; then
    bash "$HEALTH"
  else
    warn "healthcheck.sh introuvable — démarrage sans vérification"
  fi

  # 1. Infrastructure (postgres en premier pour les health checks)
  start_group "Infrastructure" "${INFRA_SERVICES[@]}"
  wait_healthy "postgres" "PostgreSQL"

  # 2. Init Kafka topics (s'exécute et se termine normalement)
  title "[ Init Kafka Topics ]"
  $COMPOSE up -d "${INIT_SERVICES[@]}" 2>&1 | grep -v "^$" || true
  sleep 3

  # 3. Services core
  start_group "Core (Auth + Gateway)" "${CORE_SERVICES[@]}"

  # 4. Services métier
  start_group "Services métier" "${APP_SERVICES[@]}"

  # 5. Workers IA
  start_group "Workers IA" "${AI_WORKERS[@]}"

  # 6. Services support (Penpot, OnlyOffice, RxResume…)
  start_group "Services support" "${SUPPORT_SERVICES[@]}"

  # 7. Frontend (en dernier)
  start_group "Frontend Angular" "${FRONT_SERVICES[@]}"

  # 8. Lancement de la surveillance en tâche de fond (toutes les 30s)
  echo ""
  echo "Lancement du démon de veille en arrière-plan..."
  WATCH_INTERVAL=30 nohup bash "$HEALTH" --watch >/dev/null 2>&1 &
  echo $! > "$ROOT/.healthcheck.pid"

  echo ""
  success "Tous les services sont démarrés."
  echo ""
  cmd_status
}

# ── Commande : heal ───────────────────────────────────────────
cmd_heal() {
  check_docker
  bash "$HEALTH" "${1:-}"
}

# ── Commande : watch ──────────────────────────────────────────
cmd_watch() {
  check_docker
  bash "$HEALTH" --watch
}

# ── Commande : stop ───────────────────────────────────────────
cmd_stop() {
  check_docker
  
  if [[ -f "$ROOT/.healthcheck.pid" ]]; then
    local pid
    pid=$(cat "$ROOT/.healthcheck.pid" 2>/dev/null)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Arrêt du démon de veille (PID: $pid)..."
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$ROOT/.healthcheck.pid"
  fi

  title "Arrêt de tous les services..."
  $COMPOSE stop
  success "Tous les services sont arrêtés."
}

# ── Commande : restart ────────────────────────────────────────
cmd_restart() {
  cmd_stop
  echo ""
  cmd_start
}

# ── Commande : status ─────────────────────────────────────────
cmd_status() {
  check_docker

  echo -e "${C_BOLD}${C_CYAN}═══ État des services ═══════════════════════════════════════${C_RESET}"
  echo ""

  # Groupes : "Label:svc1 svc2 svc3"
  local groups=(
    "Infrastructure:postgres redis redpanda minio otel-collector jaeger prometheus grafana pgadmin"
    "Core:auth-service api-gateway"
    "Métier:agent-team-service rag-service search-service docfusion-service"
    "Workers IA:audio-worker video-worker face-worker pdf-worker ocr-worker"
    "Support:gotenberg onlyoffice rxresume penpot-frontend telegram-mcp-service ollama"
    "Frontend:frontend"
  )

  for group_entry in "${groups[@]}"; do
    local group_name="${group_entry%%:*}"
    local group_svcs="${group_entry##*:}"
    echo -e "  ${C_BOLD}${group_name}${C_RESET}"
    for svc in $group_svcs; do
      local container
      container=$(container_for "$svc")
      local raw_status
      raw_status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "absent")
      local icon url_part=""
      case "$raw_status" in
        running)
          icon="${C_GREEN}●${C_RESET}" ;;
        exited)
          local exit_code
          exit_code=$(docker inspect --format='{{.State.ExitCode}}' "$container" 2>/dev/null || echo "1")
          [[ "$exit_code" == "0" ]] && icon="${C_DIM}✔${C_RESET}" || icon="${C_RED}●${C_RESET}"
          ;;
        absent)
          icon="${C_RED}○${C_RESET}" ;;
        *)
          icon="${C_YELLOW}○${C_RESET}" ;;
      esac
      if [[ -n "${SERVICE_URLS[$svc]+_}" && "$raw_status" == "running" ]]; then
        url_part=" ${C_DIM}→ ${SERVICE_URLS[$svc]}${C_RESET}"
      fi
      printf "    %b  %-32s %b%-10s%b%b\n" \
        "$icon" "$svc" "${C_DIM}" "$raw_status" "${C_RESET}" "$url_part"
    done
    echo ""
  done

  echo -e "${C_BOLD}${C_CYAN}═══ Accès rapides ═══════════════════════════════════════════${C_RESET}"
  echo ""
  printf "  %-28s → %b%s%b\n" "Application principale"  "${C_GREEN}" "http://localhost:4400"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "Diagnostic Services"     "${C_GREEN}" "http://localhost:4400/fofoKpon.html" "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "API Gateway"             "${C_CYAN}"  "http://localhost:8480"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "Agent Team API"          "${C_CYAN}"  "http://localhost:8087"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "RAG Service"             "${C_DIM}"   "http://localhost:8084"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "PgAdmin"                 "${C_DIM}"   "http://localhost:8085"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "Grafana"                 "${C_DIM}"   "http://localhost:3002"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "Jaeger (traces)"         "${C_DIM}"   "http://localhost:16688" "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "MinIO Console"           "${C_DIM}"   "http://localhost:9401"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "Penpot"                  "${C_DIM}"   "http://localhost:9090"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "OnlyOffice"              "${C_DIM}"   "http://localhost:8086"  "${C_RESET}"
  printf "  %-28s → %b%s%b\n" "RxResume"                "${C_DIM}"   "http://localhost:3101"  "${C_RESET}"
  echo ""
}

# ── Commande : logs ───────────────────────────────────────────
cmd_logs() {
  local svc="${1:-}"
  if [[ -n "$svc" ]]; then
    $COMPOSE logs -f --tail=100 "$svc"
  else
    $COMPOSE logs -f --tail=50
  fi
}

# ── Commande : build ──────────────────────────────────────────
cmd_build() {
  local svc="${1:-}"
  if [[ -z "$svc" ]]; then
    error "Précise le service à builder : ./start.sh build <service>"
    echo "  Services Java : agent-team | api-gateway | auth | search | docfusion | rag"
    echo "  Frontend      : frontend"
    exit 1
  fi
  exec "$ROOT/deploy.sh" "$svc"
}

# ── Point d'entrée ────────────────────────────────────────────
CMD="${1:-start}"
shift || true

# S'assurer que le serveur de contrôle est toujours actif
ensure_control_server

case "$CMD" in
  start|up)           cmd_start ;;
  stop|down)          cmd_stop ;;
  restart)            cmd_restart ;;
  status|ps)          cmd_status ;;
  logs)               cmd_logs "${1:-}" ;;
  build|deploy)       cmd_build "${1:-}" ;;
  heal|repair|check)  cmd_heal "${1:-}" ;;
  watch)              cmd_watch ;;
  help|-h|--help)
    echo ""
    echo -e "${C_BOLD}CreativeAIStudio-v2 — Script de démarrage${C_RESET}"
    echo ""
    echo "  ./start.sh                 Démarrer tout le projet (avec veille pré-démarrage)"
    echo "  ./start.sh stop            Arrêter tous les conteneurs"
    echo "  ./start.sh restart         Arrêter puis redémarrer"
    echo "  ./start.sh status          Afficher l'état des services"
    echo "  ./start.sh logs [service]  Suivre les logs"
    echo "  ./start.sh build <service> Rebuild + redéployer un service"
    echo "  ./start.sh heal            Vérifier et réparer les services critiques"
    echo "  ./start.sh heal --report   Rapport de santé sans réparer"
    echo "  ./start.sh watch           Surveillance continue (toutes les 60s)"
    echo ""
    ;;
  *)
    error "Commande inconnue : '$CMD'  →  ./start.sh help"
    exit 1
    ;;
esac
