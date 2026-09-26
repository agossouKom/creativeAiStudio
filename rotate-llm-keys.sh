#!/usr/bin/env bash
# Rotation des cles API LLM (Groq / DeepSeek) sans toucher aux agents.
#
# Principe : les clés vivent dans le .env du deploiement, pas en base. Les
# lignes llm_providers sont mises a NULL, donc LlmGateway.decryptKey() lit la
# variable d'environnement. Une rotation = editer le .env + recreer le
# conteneur. Aucun appel API, aucune re-saisie dans l'UI, par agent.
#
# Pourquoi cait le siege : les providers DeepSeek de la prod etaient type
# OPENAI (base_url api.deepseek.com). decryptKey() ne portait que sur le type,
# donc ces lignes ne pouvaient pas beneficier du repli env et echouaient en
# 409 "Decryption error" sur chaque appel LLM. Le script les retype DEEPSEEK.
#
# Usage :
#   ./rotate-llm-keys.sh --check              # etat des cles, aucune ecriture
#   ./rotate-llm-keys.sh --env-only            # purge les cles en base (defaut)
#   ./rotate-llm-keys.sh --revert             # restaure depuis la sauvegarde
#   ./rotate-llm-keys.sh --env-only --prod    # sur la prod (SSH)
#
# Apres avoir edite le .env :
#   ./start.sh build agent-team   (local)
#   ssh prod 'cd /opt/creativeaistudio && docker compose -f docker-compose.yml \
#     -f docker-compose.prod.yml up -d --force-recreate agent-team-service'
set -euo pipefail

MODE="--env-only"
TARGET="local"
PROD_HOST="${PROD_HOST:-root@157.173.114.181}"
PROD_DIR="${PROD_DIR:-/opt/creativeaistudio}"
DB_NAME="${DB_NAME:-creativeai_agents}"
DB_USER="${DB_USER:-creativeai}"
BACKUP_DIR="${BACKUP_DIR:-backups/llm-keys}"
RETYPE_DEEPSEEK="1"

for arg in "$@"; do
  case "$arg" in
    --check)           MODE="--check" ;;
    --env-only)        MODE="--env-only" ;;
    --revert)          MODE="--revert" ;;
    --keep-deepseek-type) RETYPE_DEEPSEEK="0" ;;
    --prod)            TARGET="prod" ;;
    --help|-h)         sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Option inconnue: $arg (--help)" >&2; exit 2 ;;
  esac
done

# Les lignes dont le modele est un modele DeepSeek mais le type OPENAI sont
# des providers DeepSeek : le type determine la variable d'environnement
# lue par decryptKey(). On cible le couple (model_id, base_url) pour ne pas
# toucher a un vrai provider OpenAI qui utiliserait deepseek comme alias.
DEEPSEEK_RETYPE="update llm_providers set type='DEEPSEEK'
  where type='OPENAI'
    and (lower(model_id) like 'deepseek%'
         or lower(coalesce(base_url,'')) like '%api.deepseek.com%')
    and deleted = false;"

PURGE="update llm_providers set encrypted_api_key = null, updated_at = now()
  where encrypted_api_key is not null and deleted = false;"

REPORT="select
    type,
    count(*) as providers,
    count(encrypted_api_key) as avec_cle_en_base,
    count(*) filter (where is_primary) as primaires
  from llm_providers where deleted = false group by type order by type;"

DUMP_SQL="select id, agent_id, type, model_id, coalesce(base_url,''), is_primary, encrypted_api_key from llm_providers;"

STALE_SQL="select count(*) as lignes_illisibles
  from llm_providers
  where deleted = false and encrypted_api_key is not null
    and type not in ('GROQ','DEEPSEEK');"

if [ "$TARGET" = "prod" ]; then
  # Le SQL transite par stdin : aucun quoting a travers SSH, les requetes
  # multi-lignes ne sont pas reinterpretes par le shell distant.
  psql_stdin() { ssh -o BatchMode=yes "$PROD_HOST" "docker exec -i creativeai-postgres psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 $*"; }
  remote()    { ssh -o BatchMode=yes "$PROD_HOST" "$@"; }
else
  psql_stdin() { docker exec -i creativeai-postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }
  remote()    { "$@"; }
fi

psql_db() { printf '%s\n' "$1" | psql_stdin; }

save_backup() {
  local out
  if [ "$TARGET" = "prod" ]; then
    remote "mkdir -p $PROD_DIR/$BACKUP_DIR" >/dev/null
    out="$BACKUP_DIR/llm_providers-$(date +%Y%m%d%H%M%S).tsv"
    psql_db "$DUMP_SQL" | remote "cat > $PROD_DIR/$out"
  else
    mkdir -p "$BACKUP_DIR"
    out="$BACKUP_DIR/llm_providers-$(date +%Y%m%d%H%M%S).tsv"
    psql_db "$DUMP_SQL" > "$out"
  fi
  printf '%s' "$out"
}

case "$MODE" in
  --check)
    echo "Cles LLM : source de verite = variables d'environnement du .env"
    psql_db "$REPORT"
    psql_db "$STALE_SQL" | sed 's/^/  /'
    ;;

  --env-only)
    BACKUP=$(save_backup)
    echo "Sauvegarde: $BACKUP"
    [ "$RETYPE_DEEPSEEK" = "1" ] && psql_db "$DEEPSEEK_RETYPE"
    psql_db "$PURGE"
    echo "Cles purgees de la base : les providers lisent desormais le .env."
    echo "Appliquer la nouvelle valeur :"
    [ "$TARGET" = "prod" ] && echo "  ssh $PROD_HOST 'cd $PROD_DIR && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate agent-team-service'"
    ;;

  --revert)
    if [ "$TARGET" = "prod" ]; then
      LAST=$(remote "ls -t $PROD_DIR/$BACKUP_DIR/*.tsv | head -1" | tr -d '\r')
      echo "Restauration depuis $LAST"
      remote "docker exec -i creativeai-postgres psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c \"\\copy llm_providers (id, agent_id, type, model_id, base_url, is_primary, encrypted_api_key) from stdin\"" < "$PROD_DIR/$LAST" 2>/dev/null \
        || ssh -o BatchMode=yes "$PROD_HOST" "docker exec -i creativeai-postgres psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c \"\\copy llm_providers (id, agent_id, type, model_id, base_url, is_primary, encrypted_api_key) from stdin\" < $LAST"
    else
      LAST=$(ls -t "$BACKUP_DIR"/*.tsv | head -1)
      echo "Restauration depuis $LAST"
      docker exec -i creativeai-postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
        -c "\copy llm_providers (id, agent_id, type, model_id, base_url, is_primary, encrypted_api_key) from stdin" < "$LAST"
    fi
    echo "Redemarrer agent-team pour vider le cache de providers."
    ;;
esac
