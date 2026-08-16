#!/usr/bin/env bash
# Regénère ACCES.md avec l'état courant des containers
set -euo pipefail

ACCES=/home/damien/Documents/Damien/MediaTheque/CreativeAIStudio/ACCES.md
COMPOSE_DIR=/home/damien/Documents/Damien/MediaTheque/CreativeAIStudio
NOW=$(date "+%Y-%m-%d %H:%M")

# Récupère le statut de chaque container
STATUS_TABLE=""
while IFS= read -r line; do
  name=$(echo "$line" | awk '{print $1}')
  status=$(echo "$line" | awk '{print $2}')
  health=$(echo "$line" | awk '{print $3}')

  icon="✅"
  if echo "$status" | grep -qi "restarting"; then icon="⚠️"
  elif echo "$status" | grep -qi "exit\|stop\|dead"; then icon="❌"
  fi

  extra=""
  if echo "$health" | grep -qi "healthy"; then extra=" (healthy)"
  elif echo "$health" | grep -qi "starting"; then extra=" (health: starting)"
  fi

  STATUS_TABLE="${STATUS_TABLE}| ${name} | ${icon} ${status}${extra} |\n"
done < <(cd "$COMPOSE_DIR" && docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}" 2>/dev/null | grep -v "^NAME" | grep -v "^time")

cat > "$ACCES" << MARKDOWN
# Creative AI Studio — Accès & URLs

> Dernière mise à jour : **${NOW}**

---

## Application principale

| Service | URL | Notes |
|---|---|---|
| **Frontend (Angular)** | http://localhost:4400 | Interface principale |
| **API Gateway** | http://localhost:8480 | Point d'entrée unique de l'API REST |
| **RAG Service** | http://localhost:8084 | Service de recherche vectorielle |

---

## Monitoring & Observabilité

| Service | URL | Login | Mot de passe |
|---|---|---|---|
| **Grafana** | http://localhost:3002 | \`admin\` | \`admin\` |
| **Prometheus** | http://localhost:9092 | — | — |
| **Jaeger** (traces) | http://localhost:16688 | — | — |

---

## Administration BDD

| Service | URL / Host | Login | Mot de passe |
|---|---|---|---|
| **pgAdmin** | http://localhost:8085 | \`admin@mediacore.com\` | \`admin\` |
| **PostgreSQL** | \`localhost:5436\` | \`creativeai\` | \`creativeai123\` |
| **Redis** | \`localhost:6382\` | — | — |
| **Kafka (Redpanda)** | \`localhost:19095\` | — | — |

---

## Stockage

| Service | URL | Login | Mot de passe |
|---|---|---|---|
| **MinIO Console** | http://localhost:9401 | \`creativeai\` | \`creativeai123\` |
| **MinIO API** | http://localhost:9400 | \`creativeai\` | \`creativeai123\` |

---

## Outils intégrés

| Service | URL | Notes |
|---|---|---|
| **OnlyOffice** | http://localhost:8086 | Édition de documents |
| **Penpot** (design) | http://localhost:9090 | Registration ouverte — créer un compte |
| **RxResume** (CV) | http://localhost:3101 | Registration ouverte — créer un compte |
| **Gotenberg** | http://localhost:3200 | Conversion PDF (API) |

---

## Secrets techniques (JWT / Auth)

| Variable | Valeur |
|---|---|
| \`JWT_SECRET\` | \`creativeai-super-secret-key-that-is-long-enough-for-hs256\` |
| \`AUTH_SECRET\` (RxResume) | \`rxresume-auth-secret-key-2026-creativeai\` |

---

## État des containers (dernière vérification : ${NOW})

| Container | Statut |
|---|---|
$(echo -e "$STATUS_TABLE")

---

## Commandes utiles

\`\`\`bash
# Démarrer tout
docker compose up -d

# Arrêter tout
docker compose down

# Rebuild + démarrer
docker compose up -d --build

# Voir les logs d'un service
docker compose logs -f creativeai-auth

# Statut de tous les containers
docker compose ps

# Accéder à PostgreSQL (psql)
psql -h localhost -p 5436 -U creativeai -d creativeai
\`\`\`
MARKDOWN

echo "ACCES.md mis à jour (${NOW})"
