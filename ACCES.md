# Creative AI Studio — Accès & URLs

> Dernière mise à jour : **2026-06-07 19:30**

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
