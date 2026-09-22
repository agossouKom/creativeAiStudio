# DEPLOY.md — Déploiement production « Creative AI Studio »

Production : `https://ai.labibpro.com` → **VPS** `157.173.114.181` (Debian 13,
7.8 Go RAM + swap 4 Go), nginx hôte en reverse proxy + Let's Encrypt.

## Principes (déontologie / sécurité)

- **Aucun secret dans le dépôt** : le `.env` de prod vit UNIQUEMENT sur le
  serveur (`/opt/creativeaistudio/.env`, `chmod 600`, gitignoré).
- **Fail-fast** : `docker-compose.prod.yml` exige chaque variable via
  `${VAR:?}` — en cas d'oubli, compose refuse de démarrer (pas de valeur à blanc).
- **SSH** : clé uniquement (`PasswordAuthentication no`,
  `PermitRootLogin prohibit-password`). Aucun firewall global : tout le traffic
  applicatif est confiné au VPS (`127.0.0.1`) + le vhost nginx.
- **IP/ports** : tous les ports du compose bindent `127.0.0.1` ; seuls 80/443
  (nginx hôte) et 22 sont exposés.

## Arborescence serveur

| Chemin | Rôle |
|---|---|
| `/opt/creativeaistudio.git` | dépôt git bare (source + hooks) |
| `/opt/creativeaistudio` | worktree = code de production (`git push prod main`) |
| `/opt/creativeaistudio/.env` | secrets prod (600, NON committé) |
| `/opt/creativeaistudio/backend-java/*/target/*.jar` | JARs `mvn package` (dans le répertoire de travail, gitignorés) |
| `/opt/creativeaistudio/frontend/dist` | build Angular (gitignoré) |

## One-time (déjà fait)

```bash
# Dépôt git + hook (checkout automatique à chaque push)
git init --bare /opt/creativeaistudio.git
cat > /opt/creativeaistudio.git/hooks/post-receive <<'EOF'
#!/bin/bash
set -e
cd /opt/creativeaistudio
export GIT_DIR=/opt/creativeaistudio.git GIT_WORK_TREE=/opt/creativeaistudio
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo main)
git checkout -f "$BRANCH" 2>/dev/null || git checkout -f main
echo "DEPLOY_OK: $(git rev-parse --short HEAD)"
EOF
chmod +x /opt/creativeaistudio.git/hooks/post-receive
```

Le hook ne touche PAS aux fichiers gitignorés (`.env`, `target/`, `dist/`,
`node_modules/`) → ils survivent aux pushs.

Retour au dépôt local (machine de dev) :

```bash
git remote add prod root@157.173.114.181:/opt/creativeaistudio.git
```

## ⚠️ Pièges critiques rencontrés

1. **Toujours** les 3 flags sur le serveur :
   `--env-file .env -f docker-compose.yml -f docker-compose.prod.yml`.
   Un `docker compose build|up -d <svc>` *sans* flags recrée le graphe de
   dépendances (postgres, auth, search, rag, gateway) en config **développement**
   → les services java passent au mot de passe `creativeai123` alors que le rôle
   réel de la base (volume persisté) est `POSTGRES_PASSWORD` du `.env` →
   crash loop `password authentication failed`. Correctif : relancer la même
   commande **avec** les flags (recrée juste les conteneurs à la bonne config,
   le volume postgres n'est pas touché).
2. **CORS gateway** : tout nouveau domaine d'origine doit être ajouté à
   `allowedOrigins` de `api-gateway/application.yml`. Les navigateurs envoient
   l'en-tête `Origin` sur tout POST *même same-origin* ; origine non listée →
   **403 vide** et l'UI affiche « Erreur d'analyse » alors que le curl sans
   `Origin` passe (piege de test).
3. `scp` peut échouer (`subsystem request failed on channel 0`) sur ce serveur :
   reconstruire les JARs sur le serveur (`mvn -pl <mod> package -DskipTests`)
   plutôt que de transférer les binaires.

## Premier déploiement (builds, à refaire à chaque changement de code Java/FS)

Les images Java ne compilent **pas** dans Docker (elles copient les JARs de
`target/`) ; le frontend monte `frontend/dist`. Il faut donc build sur le serveur.

```bash
ssh root@157.173.114.181
cd /opt/creativeaistudio

# 1. Code à jour
git pull                        # ou : git push prod main depuis la machine locale

# 2. Secrets (une seule fois)
cp env.production.example .env && chmod 600 .env
#   -> remplir les valeurs ; mot de passe avec '$' → écrire $$ (ex: mdp$$xyz)
openssl rand -hex 24            # aide à générer les secrets

# 3. Builds
cd backend-java && mvn -q package -DskipTests && cd ..
cd frontend && npm ci --no-audit --no-fund && npm run build && cd ..

# 4. Images Docker (uniquement quand les sources build changent)
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  build api-gateway auth-service search-service docfusion-service rag-service \
  agent-team-service telegram-mcp-service audio-worker video-worker face-worker pdf-worker ocr-worker

# 5. Démarrage (cœur applicatif — pas d'ollama/penpot/onlyoffice/monitoring)
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  up -d postgres redis redpanda minio kafka-topics-init \
  auth-service search-service docfusion-service rag-service agent-team-service \
  telegram-mcp-service api-gateway audio-worker video-worker face-worker pdf-worker ocr-worker frontend
```

## Re-déploiement rapide (code seul, sans rebuild d'images)

```bash
# Machine locale
git push prod main                      # le hook fait le checkout à jour
# ── puis sur le serveur ──
cd /opt/creativeaistudio
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  up -d <service-modifié>               # recrée si le compose a changé
```

## Vérifications

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
docker logs -f creativeai-auth          # OTP visible en log (REGISTRATION/etc.)
curl -s https://ai.labibpro.com/api/auth/health          # "Auth Service is running"
curl -s -X POST "https://ai.labibpro.com/api/auth/otp/send?email=vous@labibpro.com"
```

## Nginx hôte (déjà configuré)

Vhost `/etc/nginx/sites-available/ai-labibpro` (certificat via
`certbot --nginx -d ai.labibpro.com --redirect`) :

- `/` → `127.0.0.1:4400` (frontend Angular, qui proxifie `/api` et `/ws` vers l'api-gateway)
- `/minio/` → `127.0.0.1:9400` (contenus publics MinIO)
- Rate-limit sur `/api/auth/otp/send` (5 r/s) ; WebSocket `Upgrade`/`Connection` gérés.

Renew cert : `certbot renew` (cron installé par certbot).

## Mises en garde / limites connues

- `docker-compose.yml` de base reste un fichier « dev » (creds par défaut,
  ports 127.0.0.1) ; c'est **`docker-compose.prod.yml`** qui injecte les secrets
  de prod en l'écrasant.
- Les services excluent volontairement de la prod : ollama, onlyoffice, penpot,
  gotenberg, rxresume, pgadmin, otel/prometheus/jaeger/grafana.
- Les anciens mots de passe SMTP restent dans l'historique git (avant le passage
  aux variables d'environnement) : penser à rotater le mot de passe LWS si le
  dépôt est exposé, ou réécrire l'historique (garde-fou : force-push).
- RAM : ~8 Go partagés avec la stack shopy ; surveiller avec `free -h` et
  `docker stats`. Swap 4 Go en place.