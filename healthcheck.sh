#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  CreativeAIStudio-v2  —  Veille & Réparation des services indispensables
#
#  Usage autonome :
#    ./healthcheck.sh              Vérifier + réparer tous les services critiques
#    ./healthcheck.sh --report     Rapport uniquement (sans réparer)
#    ./healthcheck.sh --watch      Mode continu (toutes les 60s)
#
#  Appelé automatiquement par start.sh avant le démarrage du projet.
# ═══════════════════════════════════════════════════════════════════════════════
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
LOG_FILE="$ROOT/healthcheck.log"
REPORT_ONLY="${1:-}"
WATCH_MODE=false
[[ "$REPORT_ONLY" == "--watch" ]] && WATCH_MODE=true

# ── Couleurs ─────────────────────────────────────────────────────────────────
C_RESET='\033[0m'; C_BOLD='\033[1m'; C_DIM='\033[2m'
C_GREEN='\033[0;32m'; C_YELLOW='\033[0;33m'; C_RED='\033[0;31m'
C_CYAN='\033[0;36m'; C_BLUE='\033[0;34m'; C_MAGENTA='\033[0;35m'

ok()      { echo -e "  ${C_GREEN}✔${C_RESET}  $*"; }
fail()    { echo -e "  ${C_RED}✗${C_RESET}  $*"; }
warn()    { echo -e "  ${C_YELLOW}⚠${C_RESET}  $*"; }
repair()  { echo -e "  ${C_MAGENTA}↺${C_RESET}  $*"; }
title()   { echo -e "\n${C_BOLD}${C_CYAN}$*${C_RESET}"; }
log()     { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# ── Tableau de bord ──────────────────────────────────────────────────────────
REPAIRED_COUNT=0
FAILED_COUNT=0
OK_COUNT=0
JSON_SERVICES=""

add_to_json() {
  local svc="$1" status="$2" health="$3" tier="$4"
  svc=$(echo "$svc" | tr -d '\r\n')
  status=$(echo "$status" | tr -d '\r\n')
  health=$(echo "$health" | tr -d '\r\n')
  
  local item="{\"name\":\"$svc\",\"status\":\"$status\",\"health\":\"$health\",\"tier\":$tier}"
  if [[ -z "$JSON_SERVICES" ]]; then
    JSON_SERVICES="$item"
  else
    JSON_SERVICES="$JSON_SERVICES,$item"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
#  DÉFINITION DES SERVICES CRITIQUES
#
#  Format : "compose_name|container_name|wait_type|dependants"
#  wait_type :
#    healthy   → attend le healthcheck Docker
#    started   → attend juste que le process soit "running"
#    port:N    → attend qu'un port réponde (nc)
# ═══════════════════════════════════════════════════════════════════════════════

# Tier 1 — Infrastructure de données (bloquant pour tout le reste)
TIER1=(
  "postgres|creativeai-postgres|healthy|auth,search,docfusion,rag,agent-team,rxresume,penpot-backend"
  "redis|creativeai-redis|started|gateway,auth,search,agent-team,penpot,rxresume"
  "redpanda|creativeai-kafka|healthy|search-service,audio-worker,video-worker,face-worker,pdf-worker,ocr-worker,agent-team,docfusion"
  "minio|creativeai-minio|started|auth,search,docfusion,agent-team,audio-worker,video-worker"
)

# Tier 2 — Services Java cœur (bloquant pour gateway et frontend)
TIER2=(
  "auth-service|creativeai-auth|port:8081|api-gateway,frontend"
  "search-service|creativeai-search|port:8082|api-gateway,frontend"
  "api-gateway|creativeai-gateway|port:8080|frontend"
)

# Tier 3 — Workers IA (non-bloquant, mais essentiels pour la recherche)
TIER3=(
  "audio-worker|creativeai-audio-ai|started|search"
  "video-worker|creativeai-video-ai|started|search"
  "face-worker|creativeai-face-ai|started|search"
  "pdf-worker|creativeai-pdf-ai|started|search"
  "ocr-worker|creativeai-ocr-ai|started|search"
)

# Tier 4 — Services support (optionnels au démarrage)
TIER4=(
  "kafka-topics-init|creativeai-kafka-init|started|search-workers"
)

# ═══════════════════════════════════════════════════════════════════════════════
#  FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════

get_container_status() {
  docker inspect --format='{{.State.Status}}' "$1" 2>/dev/null | tr -d '\r\n' || echo "absent"
}

get_health_status() {
  docker inspect --format='{{.State.Health.Status}}' "$1" 2>/dev/null | tr -d '\r\n' || echo "none"
}

get_exit_code() {
  docker inspect --format='{{.State.ExitCode}}' "$1" 2>/dev/null | tr -d '\r\n' || echo "1"
}

# Attendre qu'un port soit ouvert dans le conteneur
wait_for_port() {
  local container="$1" port="$2" max_wait="${3:-60}"
  local elapsed=0
  while (( elapsed < max_wait )); do
    if docker exec "$container" sh -c "wget -qO- http://localhost:${port}/actuator/health 2>/dev/null || nc -z localhost ${port} 2>/dev/null" &>/dev/null; then
      return 0
    fi
    sleep 3; (( elapsed+=3 ))
  done
  return 1
}

# Attendre le healthcheck Docker
wait_for_healthy() {
  local container="$1" max_wait="${2:-120}"
  local elapsed=0
  while (( elapsed < max_wait )); do
    local status
    status=$(get_health_status "$container")
    [[ "$status" == "healthy" ]] && return 0
    [[ "$status" == "unhealthy" ]] && return 1
    sleep 3; (( elapsed+=3 ))
  done
  return 1
}

# Attendre que le conteneur soit "running"
wait_for_running() {
  local container="$1" max_wait="${2:-30}"
  local elapsed=0
  while (( elapsed < max_wait )); do
    [[ "$(get_container_status "$container")" == "running" ]] && return 0
    sleep 2; (( elapsed+=2 ))
  done
  return 1
}

# ── Réparer un service selon son type d'attente ──────────────────────────────
repair_service() {
  local svc="$1" container="$2" wait_type="$3"
  local status exit_code

  status=$(get_container_status "$container")
  exit_code=$(get_exit_code "$container")

  case "$status" in
    "absent")
      repair "Démarrage de ${C_BOLD}${svc}${C_RESET} (jamais lancé)..."
      log "REPAIR: starting absent service $svc ($container)"
      $COMPOSE up -d "$svc" 2>&1 | grep -v "^$" | grep -v "^\s*$" | head -3 || true
      ;;
    "exited")
      if [[ "$exit_code" == "0" && "$svc" == "kafka-topics-init" ]]; then
        ok "${svc} — terminé normalement (exit 0) ✓"
        (( OK_COUNT++ )) || true; return 0
      fi
      repair "Redémarrage de ${C_BOLD}${svc}${C_RESET} (exited code=$exit_code)..."
      log "REPAIR: restarting exited service $svc ($container) exit=$exit_code"
      docker restart "$container" 2>/dev/null || $COMPOSE up -d "$svc" 2>&1 | head -3 || true
      ;;
    "restarting"|"created")
      warn "${svc} — en cours de démarrage..."
      ;;
    "paused")
      repair "Reprise de ${C_BOLD}${svc}${C_RESET} (paused)..."
      docker unpause "$container" 2>/dev/null || true
      ;;
    "running")
      # Vérifie si réellement healthy/opérationnel
      ;;
    *)
      fail "${svc} — état inconnu: $status"
      (( FAILED_COUNT++ )) || true; return 1
      ;;
  esac

  # Attente selon le type
  local wait_ok=false
  case "$wait_type" in
    healthy)
      echo -ne "  ${C_DIM}  ⏳ healthcheck ${svc}...${C_RESET}"
      if wait_for_healthy "$container" 120; then
        echo -e "\r  ${C_GREEN}✔${C_RESET}  ${svc} — healthy                              "
        wait_ok=true
      else
        echo -e "\r  ${C_YELLOW}⚠${C_RESET}  ${svc} — healthcheck timeout (on continue)     "
      fi
      ;;
    started)
      echo -ne "  ${C_DIM}  ⏳ démarrage ${svc}...${C_RESET}"
      if wait_for_running "$container" 30; then
        echo -e "\r  ${C_GREEN}✔${C_RESET}  ${svc} — running                               "
        wait_ok=true
      else
        echo -e "\r  ${C_YELLOW}⚠${C_RESET}  ${svc} — toujours pas running (on continue)   "
      fi
      ;;
    port:*)
      local port="${wait_type#port:}"
      echo -ne "  ${C_DIM}  ⏳ port:${port} ${svc}...${C_RESET}"
      if wait_for_port "$container" "$port" 90; then
        echo -e "\r  ${C_GREEN}✔${C_RESET}  ${svc} — port ${port} répond                   "
        wait_ok=true
      else
        echo -e "\r  ${C_YELLOW}⚠${C_RESET}  ${svc} — port ${port} timeout (on continue)   "
      fi
      ;;
  esac

  if $wait_ok; then
    (( REPAIRED_COUNT++ )) || true
    log "REPAIRED: $svc ($container) is now operational"
  else
    (( FAILED_COUNT++ )) || true
    log "WARN: $svc ($container) may not be fully operational"
  fi
}

# ── Inspecter et décider si réparation nécessaire ────────────────────────────
check_service() {
  local entry="$1"
  local report_only="${2:-false}"
  local tier="${3:-4}"
 
  IFS='|' read -r svc container wait_type dependants <<< "$entry"
 
  local status health exit_code
  status=$(get_container_status "$container")
  health=$(get_health_status "$container")
  exit_code=$(get_exit_code "$container")

  add_to_json "$svc" "$status" "$health" "$tier"

  local needs_repair=false
  local reason=""

  case "$status" in
    "running")
      # Vérifie s'il a un healthcheck qui échoue
      if [[ "$health" == "unhealthy" ]]; then
        needs_repair=true; reason="unhealthy"
      elif [[ "$health" == "healthy" || "$health" == "none" ]]; then
        ok "${svc} — ${C_DIM}running${health:+ ($health)}${C_RESET}"
        (( OK_COUNT++ )) || true; return 0
      else
        # starting/...
        warn "${svc} — health: $health (en cours)"
        (( OK_COUNT++ )) || true; return 0
      fi
      ;;
    "exited")
      if [[ "$exit_code" == "0" && "$svc" == "kafka-topics-init" ]]; then
        ok "${svc} — ${C_DIM}terminé normalement ✓${C_RESET}"
        (( OK_COUNT++ )) || true; return 0
      fi
      needs_repair=true; reason="exited(${exit_code})"
      ;;
    "absent")
      needs_repair=true; reason="jamais démarré"
      ;;
    "restarting")
      warn "${svc} — en redémarrage automatique..."
      (( OK_COUNT++ )) || true; return 0
      ;;
    *)
      needs_repair=true; reason="état: $status"
      ;;
  esac

  if $needs_repair; then
    if [[ "$report_only" == "true" ]]; then
      fail "${svc} — ${C_RED}${reason}${C_RESET} ${C_DIM}(dépendants: ${dependants})${C_RESET}"
      (( FAILED_COUNT++ )) || true
    else
      fail "${svc} — ${C_RED}${reason}${C_RESET} → réparation..."
      log "CHECK_FAIL: $svc status=$status reason=$reason"
      repair_service "$svc" "$container" "$wait_type"
    fi
  fi
}

# ── Veille kafka-topics-init (rerun si kafka vient d'être réparé) ────────────
ensure_kafka_topics() {
  local kafka_status
  kafka_status=$(get_container_status "creativeai-kafka")
  if [[ "$kafka_status" == "running" ]]; then
    local init_status
    init_status=$(get_container_status "creativeai-kafka-init")
    if [[ "$init_status" != "running" ]]; then
      repair "Re-création des topics Kafka DLQ..."
      $COMPOSE up -d kafka-topics-init 2>&1 | head -3 || true
      sleep 3
      log "REPAIR: kafka-topics-init re-run"
    fi
  fi
}

run_healthcheck() {
  local report_only=false
  [[ "${1:-}" == "--report" ]] && report_only=true

  JSON_SERVICES=""
  REPAIRED_COUNT=0; FAILED_COUNT=0; OK_COUNT=0
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
 
  echo ""
  echo -e "${C_BOLD}${C_CYAN}╔══════════════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_BOLD}${C_CYAN}║   CreativeAIStudio — Veille & Diagnostic des Services    ║${C_RESET}"
  echo -e "${C_BOLD}${C_CYAN}║   ${C_DIM}${ts}${C_CYAN}                          ║${C_RESET}"
  echo -e "${C_BOLD}${C_CYAN}╚══════════════════════════════════════════════════════════╝${C_RESET}"
  log "=== HEALTHCHECK START ==="
 
  # ── TIER 1 : Infrastructure de données ────────────────────────────────────
  title "▸ Tier 1 — Infrastructure (postgres · redis · kafka · minio)"
  for entry in "${TIER1[@]}"; do
    check_service "$entry" "$report_only" 1
  done
 
  # ── Kafka topics (dépend de redpanda) ─────────────────────────────────────
  if [[ "$report_only" == "false" ]]; then
    ensure_kafka_topics
  fi
 
  # ── TIER 2 : Services Java core ───────────────────────────────────────────
  title "▸ Tier 2 — Services Core (auth · search · gateway)"
  for entry in "${TIER2[@]}"; do
    check_service "$entry" "$report_only" 2
  done
 
  # ── TIER 3 : Workers IA ───────────────────────────────────────────────────
  title "▸ Tier 3 — Workers IA (audio · video · face · pdf · ocr)"
  for entry in "${TIER3[@]}"; do
    check_service "$entry" "$report_only" 3
  done

  # ── RÉSUMÉ ─────────────────────────────────────────────────────────────────
  echo ""
  echo -e "${C_BOLD}${C_CYAN}── Résumé de la veille ──────────────────────────────────────${C_RESET}"
  echo ""
  printf "  ${C_GREEN}%-4s${C_RESET} services opérationnels\n"  "$OK_COUNT"
  printf "  ${C_MAGENTA}%-4s${C_RESET} services réparés\n"       "$REPAIRED_COUNT"
  printf "  ${C_RED}%-4s${C_RESET} services en échec\n"         "$FAILED_COUNT"
  echo ""

  log "=== HEALTHCHECK END: ok=$OK_COUNT repaired=$REPAIRED_COUNT failed=$FAILED_COUNT ==="

  # ── ÉCRITURE DU JSON EXPORT ────────────────────────────────────────────────
  local json_file="$ROOT/frontend/dist/frontend/browser/status.json"
  mkdir -p "$(dirname "$json_file")"
  cat <<EOF > "$json_file"
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "ok_count": $OK_COUNT,
  "repaired_count": $REPAIRED_COUNT,
  "failed_count": $FAILED_COUNT,
  "services": [$JSON_SERVICES]
}
EOF

  return 0
}

# ── Mode watch continu ────────────────────────────────────────────────────────
if $WATCH_MODE; then
  INTERVAL="${WATCH_INTERVAL:-60}"
  echo -e "${C_BOLD}${C_CYAN}Mode surveillance continue (intervalle: ${INTERVAL}s) — Ctrl+C pour quitter${C_RESET}"
  while true; do
    run_healthcheck
    echo -e "  ${C_DIM}Prochaine vérification dans ${INTERVAL}s...${C_RESET}"
    sleep "$INTERVAL"
  done
else
  run_healthcheck "${1:-}"
fi
