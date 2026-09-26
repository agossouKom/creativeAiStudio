# Creative AI Studio — Accès & URLs

> Dernière mise à jour : **2026-06-07 19:30**

---

## Application principale

| Service | URL | Notes |
|---|---|---|
| **Frontend (Angular)** | http://localhost:4400 | Interface principale |
| **API Gateway** | http://localhost:8480 | Point d'entrée unique de l'API REST |
| **RAG Service** | http://localhost:8084 | Service de recherche vectorielle |
| **Generation Service** | http://localhost:8088 | Génération vidéo/image + publication sociale (interne, via le gateway) |
| **Swagger generation-service** | http://localhost:8088/swagger-ui.html | JWT requis (`Bearer`) |

### Generation Service (port 8088)

`http://localhost:8480/api/generation/...` via le gateway, ou `http://localhost:8088/...` en direct (bound sur `127.0.0.1`).

| Méthode | Endpoint | Rôle |
|---|---|---|
| `GET` | `/api/generation/social/platforms` | Matrice plateformes : `LIVE` / `PLANNED` + contraintes |
| `POST` | `/api/generation/video` | Crée un job vidéo (202, rendu asynchrone via Kafka) |
| `POST` | `/api/generation/image` | Crée un job image (202) |
| `GET` | `/api/generation/jobs` | Historique des jobs de l'utilisateur |
| `GET` | `/api/generation/jobs/{jobId}` | Détail d'un job + sorties |
| `POST` | `/api/generation/jobs/{jobId}/retry` | Relance (incrémente `executionVersion`) |
| `GET` | `/api/generation/jobs/{jobId}/outputs/{index}/download-url` | URL MinIO signée (endpoint public `minio.public-url`) |
| `POST` | `/api/generation/jobs/{jobId}/outputs/{index}/publish` | Publication sociale (`platform`, `agentId`, `caption`) |
| `GET` | `/api/generation/social/requests` | Historique des publications |
| `POST` | `/api/generation/social/requests/{requestId}/retry` | Relance de publication (3 tentatives max) |
| `GET` | `/api/generation/jobs/{jobId}/social/requests` | Publications d'un job |

Seuls **Facebook** et **Instagram** publient réellement (délégués à `agent-team-service` via
`POST /api/agents/{agentId}/posts`). Les autres plateformes renvoient `409 PLATFORM_NOT_AVAILABLE`,
et un agent sans canal `CONNECTED` renvoie `409` — jamais de succès simulé.

Le job doit être au statut **`DONE`** (et non `COMPLETED`) pour que le bouton « Publier » soit actif.

Une relance (`retry`) est refusée en `409` si la demande est déjà `PUBLISHED`
(`ALREADY_PUBLISHED`), a atteint 3 tentatives (`MAX_ATTEMPTS_REACHED`), ou est restée
`PENDING`/`DISPATCHED` (`DISPATCH_IN_PROGRESS` — l'issue de l'envoi précédent est inconnue,
relancer risquerait de publier deux fois). La sortie relancée est celle de la **version
d'exécution enregistrée sur la demande**, pas celle de la version courante du job.

| Variable | Défaut | Rôle |
|---|---|---|
| `SOCIAL_PUBLISH_ENABLED` | `false` | Passer à `true` pour autoriser la publication |
| `MINIO_PUBLIC_URL` | `http://localhost:9400` (dev) | Doit être **joignable depuis Internet** en production, sinon Instagram ne peut pas récupérer le média |
| `AGENT_TEAM_BASE_URL` | `http://agent-team-service:8087` | Pont de publication |

```bash
# Smoke test local (JWT fabriqué avec le JWT_SECRET ci-dessus)
curl -s -H "Authorization: Bearer <jwt>" http://localhost:8088/api/generation/social/platforms
```

---

### Worker vidéo local

Le worker `video-generation-worker` utilise eSpeak NG et FFmpeg pour le rendu.
Le LLM qui produit le storyboard est configurable avec `VIDEO_GENERATION_LLM_PROVIDER` :
`ollama` (défaut historique), `groq`, `deepseek` ou `openai_compatible`. Groq et
DeepSeek réutilisent respectivement `GROQ_API_KEY` et `DEEPSEEK_API_KEY`. Pour
OpenRouter ou un endpoint compatible personnalisé, renseigner
`VIDEO_GENERATION_LLM_BASE_URL`, `VIDEO_GENERATION_LLM_API_KEY` et
`VIDEO_GENERATION_LLM_MODEL`. Exemple Groq : `VIDEO_GENERATION_LLM_PROVIDER=groq`.
MoneyPrinterTurbo n'est pas requis. L'image vidéo est composée localement à partir
de stock Pexels/Pixabay ; cela ne constitue pas une génération text-to-video native.
Les recherches vidéo locales utilisent Pexels ou Pixabay et nécessitent la clé API correspondante
(`PEXELS_API_KEY` ou `PIXABAY_API_KEY`). La source `coverr` reste acceptée par l'ancien contrat
mais n'a pas encore d'adaptateur dans le pipeline local.

Le pipeline produit un storyboard JSON, une narration, des sous-titres optionnels, un montage
FFmpeg et vérifie le MP4 avec ffprobe avant de le stocker dans MinIO. Une musique de fond peut
être activée en définissant `VIDEO_GENERATION_MUSIC_DIR` sur un dossier de pistes accessible dans
le conteneur. Les voix utilisent les noms de voix eSpeak NG ; sans voix explicite, le code de
langue (ou `en`) est sélectionné. Vérifier les licences et obligations d'attribution des médias,
voix et musiques avant tout usage commercial.

Pour l'ancien service, régler `VIDEO_GENERATION_PROVIDER=moneyprinter` et renseigner
`MONEYPRINTER_API_URL` / `MONEYPRINTER_API_KEY`. Le mode local est le défaut.

## Monitoring & Observabilité

| Service | URL | Login | Mot de passe |
|---|---|---|---|
| **Grafana** | http://localhost:3002 | `admin` | `admin` |
| **Prometheus** | http://localhost:9092 | — | — |
| **Jaeger** (traces) | http://localhost:16688 | — | — |

---

## Administration BDD

| Service | URL / Host | Login | Mot de passe |
|---|---|---|---|
| **pgAdmin** | http://localhost:8085 | `admin@mediacore.com` | `admin` |
| **PostgreSQL** | `localhost:5436` | `creativeai` | `creativeai123` |
| **Redis** | `localhost:6383` | — | — |
| **Kafka (Redpanda)** | `localhost:19095` | — | — |

---

## Stockage

| Service | URL | Login | Mot de passe |
|---|---|---|---|
| **MinIO Console** | http://localhost:9401 | `creativeai` | `creativeai123` |
| **MinIO API** | http://localhost:9400 | `creativeai` | `creativeai123` |

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
| `JWT_SECRET` | `creativeai-super-secret-key-that-is-long-enough-for-hs256` |
| `AUTH_SECRET` (RxResume) | `rxresume-auth-secret-key-2026-creativeai` |

---

## État des containers (2026-06-07 19:30)

| Container | Statut |
|---|---|
| creativeai-agent-team | ✅ Up |
| creativeai-audio-ai | ✅ Up |
| creativeai-auth | ✅ Up |
| creativeai-docfusion | ✅ Up |
| creativeai-face-ai | ✅ Up |
| creativeai-frontend | ✅ Up |
| creativeai-gateway | ✅ Up |
| creativeai-gotenberg | ✅ Up |
| creativeai-grafana | ✅ Up |
| creativeai-jaeger | ✅ Up |
| creativeai-kafka | ✅ Up (healthy) |
| creativeai-minio | ✅ Up |
| creativeai-ocr-ai | ✅ Up |
| creativeai-onlyoffice | ✅ Up |
| creativeai-otel | ✅ Up |
| creativeai-pdf-ai | ✅ Up |
| creativeai-penpot-backend | ✅ Up |
| creativeai-penpot-exporter | ✅ Up |
| creativeai-penpot-frontend | ⚠️ Restarting (bug connu, non bloquant) |
| creativeai-pgadmin | ✅ Up |
| creativeai-postgres | ✅ Up (healthy) |
| creativeai-prometheus | ✅ Up |
| creativeai-rag | ✅ Up |
| creativeai-redis | ✅ Up |
| creativeai-rxresume | ✅ Up (healthy) |
| creativeai-search | ✅ Up |
| creativeai-video-ai | ✅ Up |

27 containers — 26 ✅ Up / 1 ⚠️ Restarting (penpot-frontend)

---

## Commandes utiles

```bash
# Démarrer tout
docker compose up -d

# Arrêter tout
docker compose down

# Rebuild + démarrer un service
docker compose up -d --force-recreate --build <service>

# Voir les logs d'un service
docker compose logs -f creativeai-auth

# Statut de tous les containers
docker compose ps

# Accéder à PostgreSQL (psql)
psql -h localhost -p 5436 -U creativeai -d creativeai
```
