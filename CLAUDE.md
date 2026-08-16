# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Creative AI Studio is a multi-media recognition SaaS: search/identify songs, videos, and people from image/audio/video input, plus adjacent tools (document fusion/OCR, RAG chat, CV builder, design editor). The real, running system is a ~30-container Docker Compose stack of Java microservices, Python AI workers, and an Angular frontend — see `ACCES.md` for all local URLs/ports/credentials and `start.sh status` for live container state.

**`/backend` (root-level FastAPI) is a stale prototype, not the live backend.** It has no Dockerfile and isn't wired into `docker-compose.yml`. Its `/search/audio` and `/search/video` endpoints return hardcoded mock data; only `/search/person` does real work (via `face_recognition`). The README's "Installation" section describes this dead prototype — don't trust it for how to run the real system. The actual backend is `backend-java/` + `ai-workers/`.

## Architecture

**Request flow**: Angular frontend → `api-gateway` (Spring Cloud Gateway, JWT filter, port 8480) → routes to `auth-service`, `search-service`, `docfusion-service`, `rag-service`, `agent-team-service`, `telegram-mcp-service` (all internal-only, no host ports). AI processing work is dispatched over Kafka (Redpanda) to Python workers, not via direct HTTP: topics like `creativeai.audio`, `.video`, `.face`, `.pdf`, `.ocr` feed each worker, results land on `creativeai.results`, and each topic has a paired `.dlq` dead-letter topic (7-day retention, created by the one-shot `kafka-topics-init` container).

**`backend-java/`** — 7 Spring Boot services under one Maven reactor (parent POM: `com.creativeai:creativeai-backend`, packaging `pom`, Spring Boot 3.2.5, Java 21, Spring Cloud 2023.0.1, Spring AI 1.0.0 BOM). Build from `backend-java/`: `mvn clean install` (all modules), or scope to one with `-pl <module> -am`. No test directories currently exist in any module.
- `api-gateway` — reactive gateway + JWT filter, the single entry point.
- `auth-service` — Spring Security/JWT/JPA over Postgres; also has a Gmail-OAuth email agent (`service/agent`, `dto/gmail`).
- `search-service` / `docfusion-service` — JPA + Kafka + WebSocket + Redis + Flyway + MinIO; note `DocFusion/` at repo root is a *separate*, older standalone precursor project (its own docker-compose, own OCR/convert/gateway services) — not the same code as `backend-java/docfusion-service`, don't conflate them.
- `rag-service` — Spring AI + pgvector, chat model routed through Groq's OpenAI-compatible endpoint.
- `agent-team-service` — multi-agent orchestration (`orchestrator`, `tool/impl`, `llm` packages), uses Ollama + Groq.
- `telegram-mcp-service` — Telegram bot exposed as an MCP server, backed by DeepSeek.
- gRPC messages are defined in `proto/mediasearch.proto` and code-generated via the parent POM's protobuf-maven-plugin.

**`ai-workers/`** — 6 Python services, each with dual entry points: a FastAPI `app/main.py` (synchronous REST) and an `app/kafka_worker.py` that re-imports the same functions to consume its Kafka topic asynchronously. Each has its own `Dockerfile`/`requirements.txt`/`start.sh`.
- `audio-worker` — Shazam (`shazamio`) + AcoustID fingerprinting; also has a `grpc_server.py`.
- `video-worker` — OpenCV metadata + Shazam (audio track) + TMDB lookup.
- `face-worker` — OpenCV Haar-cascade detection + reverse-image lookup (SerpAPI/NumVerify/Bing/DuckDuckGo/Playwright).
- `ocr-worker` — Groq Llama vision model primary, Tesseract fallback, PyMuPDF for PDF text.
- `pdf-worker` — PDF/DOCX conversion (pdf2docx, PyMuPDF, python-docx, reportlab), format detected by magic bytes.
- `telegram-bot` — the odd one out: a polling `pyTelegramBotAPI` bot (no Kafka worker) that forwards messages to `agent-team-service`.

**`frontend/`** — Angular 17.3, standalone modern builder (`@angular-devkit/build-angular:application`). Feature modules live under `frontend/src/app/features/`: `agentique`, `auth`, `card-builder`, `contact`, `creative-studio`, `cv-builder`, `dashboard`, `docfusion`, `games`, `history`, `pricing`, `rag-chat`, `results`, `search`, `settings`, `triage`; shared cross-cutting code in `guards`, `interceptors`, `services`, `shared/{components,design-editor,office-editor,ui}`. Notable deps beyond Angular: `three`/`@babylonjs/core`/`@dimforge/rapier3d-compat` (3D, used by card-builder/games), `chart.js`, `xlsx`, `tailwindcss`.

## Commands

```bash
# Whole stack (from repo root)
./start.sh              # start everything (also auto-launches control_server.py on :8490)
./start.sh stop
./start.sh restart
./start.sh status
./start.sh logs [service]
./start.sh build <service>   # rebuild + redeploy one compose service

# Fast single-service redeploy (skips tests): agent-team|api-gateway|auth|search|docfusion|frontend
./deploy.sh <service>

docker compose ps
docker compose logs -f creativeai-<name>   # container names, not compose service names (see ACCES.md)

# backend-java (run from backend-java/)
mvn clean install                 # build all 7 services
mvn -pl <module> -am clean install   # build one service + its deps

# frontend (run from frontend/)
npm start        # ng serve
npm run build    # ng build
npm test         # ng test (Karma/Jasmine)
```

`healthcheck.sh` runs as a watchdog (invoked by `start.sh`) that checks and auto-repairs "indispensable" services; `healthcheck.sh --report` or `--watch` for manual runs. `control_server.py` exposes `/api/control/{status,start,stop,restart}` on :8490 so the frontend can remotely manage the Docker stack — it shells out to `start.sh`.

## Directories that look relevant but aren't part of the app

`cardTemplage/`, `template cv/` — reference screenshots only. `ameliorationAgenntTeam/` — plain-text planning notes for agent-team-service. `BOOT-INF/` — an accidentally-exploded Spring Boot JAR at repo root, not source. `GenerateBacklog.java`/`.class` — one-off PDFBox script for generating a backlog PDF, unrelated to the running system.

## `footBall/` — 3D football game (active feature, in `frontend/src/app/features/games/football/`)

`footBall/` at repo root holds only the design docs (`cahier_des_charges_jeu_football.md`, spec txt, UI mockup screenshots) for a Babylon.js + Rapier 3D football game. **The actual code lives in `frontend/src/app/features/games/football/`**, routed live at `/games/football` (`FootballComponent`; an older, simpler standalone prototype is separately routed at `/games/football-prototype`). Engine split into plain TS service classes (not Angular services/DI, just `new`'d in the component): `stadium.service.ts` (single hardcoded pitch, no stadium selection yet), `player.service.ts` (humanoid mesh + Rapier capsule per player), `ball.service.ts` (physics + goal/out-of-bounds detection), `ai.service.ts` (per-role behavior: gk/def/mid/fwd), `referee.service.ts` (offside/fouls/cards/restart logic), `match.service.ts` (periods/extra-time/penalty-shootout logic), `teams.data.ts` (54 teams), `football.config.ts` (FIFA-scaled field/player/formation constants), `football.types.ts` (shared interfaces — note `MatchResult` is defined twice, here and in `match.service.ts`, with slightly different shapes; harmless but confusing).

**Known gap: `RefereeService` and `MatchService` are largely dead code.** `FootballComponent.startMatch()` instantiates `RefereeService` but only ever calls `.createEvent(...)`/`.updateStats(...)`/`.determineRestart(...)` on it — `checkOffside`, `checkFoul`, `checkCard`/`applyCard` are fully implemented but never invoked from the game loop, so no offside, fouls, or cards actually occur in play. `MatchService` is imported for its type only and never instantiated; half-time is instead hand-rolled ad hoc inside `FootballComponent.checkHalfTime()`, which doesn't handle extra time or penalty shootouts. There's also no tackle input (the `tackle` field exists on `PlayerInput` but no key ever sets it), no substitutions, no weather/day-night, and only one stadium. `frontend/src/app/features/games/football/PLAN.md` tracks this as unchecked-boxes Phase 1 work, which matches what's actually wired.
