package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.*;
import com.creativeai.agentteam.dto.response.*;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.service.AgentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion du cycle de vie complet des agents IA.
 *
 * <p>Flux typique :
 * <ol>
 *   <li>Créer un agent ({@code POST /api/agents})
 *   <li>Lui attacher un LLM provider ({@code POST /api/agents/{id}/llm-providers})
 *   <li>Optionnel : configurer son comportement ({@code PUT /api/agents/{id}/config})
 *   <li>Optionnel : définir son profil et sa persona ({@code PUT /api/agents/{id}/profile})
 *   <li>Lui envoyer un message ({@code POST /api/agents/{id}/chat/stream})
 * </ol>
 */
@Tag(
    name = "Agents",
    description = """
        Gestion complète des agents IA.

        Un **agent** est une entité autonome pilotée par un LLM (OpenAI, Anthropic, Groq…).
        Son comportement est défini par :
        - son **type** (SCRUM_MASTER, EMAIL_MANAGER, IMAGE_CREATOR…)
        - sa **configuration** (température, mémoire, itérations max)
        - son **profil** (persona, ton, message d'accueil)
        - ses **prompts** système personnalisés
        - son **provider LLM** (modèle, clé API, paramètres)

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final com.creativeai.agentteam.service.MinioService minioService;
    private final com.creativeai.agentteam.llm.LlmGateway llmGateway;

    // ── Création ─────────────────────────────────────────────────────────────

    @Operation(
        summary = "Créer un agent depuis un template (Option C)",
        description = """
            Crée un agent pré-configuré avec le system prompt, la configuration et les outils
            définis par le template du type choisi. Aucune configuration manuelle requise.

            **Avantages du template :**
            - System prompt optimisé pour le rôle
            - Température, maxTokens et maxItérations adaptés au type
            - Liste d'outils recommandés pré-chargée
            - Réponse automatique activée pour les agents de support

            **Exemple :** `POST /api/agents/from-template/SCRUM_MASTER`
            → crée un Chef de Projet IA avec `delegate_to_agent`, `create_agent`, `create_team` activés

            Il suffit ensuite d'ajouter un LLM provider (`POST /api/agents/{id}/llm-providers`)
            pour que l'agent soit opérationnel.
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Personnalisation optionnelle (tout peut rester null)",
            required = false,
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Créer un SCRUM_MASTER",
                        summary = "Agent chef de projet sans personnalisation",
                        value = "{}"
                    ),
                    @ExampleObject(
                        name = "EMAIL_MANAGER nommé",
                        summary = "Agent email avec nom personnalisé dans une équipe",
                        value = """
                            {
                              "name": "EmailBot Acme",
                              "description": "Gère tous les emails entrants pour Acme Corp",
                              "teamId": "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5"
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Agent créé depuis le template"),
        @ApiResponse(responseCode = "400", description = "Type d'agent invalide")
    })
    @PostMapping("/from-template/{type}")
    public ResponseEntity<AgentDetailResponse> createFromTemplate(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Type d'agent à instancier", example = "SCRUM_MASTER")
            @PathVariable AgentType type,
            @RequestBody(required = false) CreateFromTemplateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(agentService.createFromTemplate(userId, type, req));
    }

    @Operation(
        summary = "Créer un agent",
        description = """
            Crée un nouvel agent IA.

            Seuls `name` et `type` sont obligatoires. Le slug est auto-généré si absent.

            **Types disponibles :**
            `SCRUM_MASTER`, `EMAIL_MANAGER`, `COMMUNITY_MANAGER`, `PROSPECTION`,
            `MARKETING`, `CUSTOMER_SUPPORT`, `CREATIVE_LEAD`, `RAG_DOCUMENT`,
            `CV_CREATOR`, `IMAGE_CREATOR`, `VIDEO_CREATOR`, `SECURITY_AUDIT`…

            Après la création, attachez un LLM provider via `POST /api/agents/{id}/llm-providers`
            pour que l'agent puisse répondre au chat.
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Payload de création",
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "SCRUM_MASTER minimal",
                        summary = "Agent chef de projet (champs obligatoires seulement)",
                        value = """
                            {
                              "name": "Chef de Projet",
                              "type": "SCRUM_MASTER",
                              "description": "Coordonne les tâches et délègue aux agents spécialisés"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "EMAIL_MANAGER complet",
                        summary = "Agent email avec config et profil",
                        value = """
                            {
                              "name": "Agent Email Pro",
                              "type": "EMAIL_MANAGER",
                              "description": "Rédige et classe les emails professionnels",
                              "config": {
                                "temperature": 0.4,
                                "maxTokens": 1024,
                                "responseLanguage": "fr",
                                "maxIterations": 5
                              },
                              "profile": {
                                "displayName": "EmailBot",
                                "tone": "PROFESSIONAL",
                                "welcomeMessage": "Bonjour, je gère vos emails."
                              }
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Agent créé avec succès"),
        @ApiResponse(responseCode = "400", description = "Champs invalides (name vide, type absent…)"),
        @ApiResponse(responseCode = "409", description = "Slug déjà utilisé")
    })
    @PostMapping
    public ResponseEntity<AgentDetailResponse> create(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody CreateAgentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(agentService.createAgent(userId, req));
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    @Operation(
        summary = "Lister tous les agents",
        description = "Retourne tous les agents de l'utilisateur connecté, triés par date de création décroissante."
    )
    @ApiResponse(responseCode = "200", description = "Liste des agents")
    @GetMapping
    public ResponseEntity<List<AgentResponse>> list(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(agentService.listAgents(userId));
    }

    @Operation(
        summary = "Filtrer par type",
        description = "Retourne uniquement les agents d'un type donné (ex : tous les `EMAIL_MANAGER`)."
    )
    @ApiResponse(responseCode = "200", description = "Agents du type demandé")
    @GetMapping("/type/{type}")
    public ResponseEntity<List<AgentResponse>> listByType(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Type d'agent", example = "SCRUM_MASTER") @PathVariable AgentType type) {
        return ResponseEntity.ok(agentService.listAgentsByType(userId, type));
    }

    @Operation(
        summary = "Rechercher des agents",
        description = "Recherche fulltext sur le `name` et la `description` des agents. Résultats paginés."
    )
    @ApiResponse(responseCode = "200", description = "Page de résultats")
    @GetMapping("/search")
    public ResponseEntity<PageResponse<AgentResponse>> search(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Terme de recherche", example = "email") @RequestParam String q,
            @Parameter(description = "Numéro de page (0-based)", example = "0")  @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Nombre de résultats par page", example = "20") @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(agentService.searchAgents(userId, q,
            PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @Operation(
        summary = "Obtenir un agent (détails complets)",
        description = "Retourne toutes les informations d'un agent : config, profil, et métadonnées."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Détails de l'agent"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @GetMapping("/{agentId}")
    public ResponseEntity<AgentDetailResponse> get(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent", example = "55865815-187e-4ef1-b2d4-a4814bd05cac")
            @PathVariable String agentId) {
        return ResponseEntity.ok(agentService.getAgent(userId, agentId));
    }

    @GetMapping("/by-code/{code}")
    public ResponseEntity<AgentDetailResponse> getByCode(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "Code court 6 chiffres de l'agent", example = "123456")
            @PathVariable String code) {
        return ResponseEntity.ok(agentService.getAgentByCode(userId, code));
    }

    // ── Modification ─────────────────────────────────────────────────────────

    @Operation(
        summary = "Modifier un agent (nom, description, type)",
        description = "Met à jour les informations de base de l'agent. N'affecte pas la config ni le profil."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Agent mis à jour"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @PutMapping("/{agentId}")
    public ResponseEntity<AgentResponse> update(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Valid @RequestBody UpdateAgentRequest req) {
        return ResponseEntity.ok(agentService.updateAgent(userId, agentId, req));
    }

    @Operation(
        summary = "Changer le statut de l'agent",
        description = """
            Modifie le statut opérationnel de l'agent.

            | Statut | Comportement |
            |--------|-------------|
            | `ACTIVE` | Répond normalement au chat |
            | `INACTIVE` | Refus de répondre (endpoint retourne 503) |
            | `MAINTENANCE` | Mode silencieux |
            """
    )
    @ApiResponse(responseCode = "200", description = "Statut mis à jour")
    @PatchMapping("/{agentId}/status")
    public ResponseEntity<AgentResponse> updateStatus(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Parameter(description = "Nouveau statut", example = "ACTIVE") @RequestParam AgentStatus status) {
        return ResponseEntity.ok(agentService.updateStatus(userId, agentId, status));
    }

    @Operation(
        summary = "Mettre à jour la configuration comportementale",
        description = """
            Configure les paramètres LLM et de comportement de l'agent.

            - `temperature` : créativité (0.0 = déterministe, 2.0 = très créatif). Recommandé : 0.3–0.7.
            - `maxTokens` : longueur max de chaque réponse.
            - `maxMemoryMessages` : nombre de messages conservés en contexte.
            - `maxIterations` : nombre max d'appels LLM dans une boucle agentique.
            - `responseLanguage` : code langue ISO (`fr`, `en`, `es`…).
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(
                    name = "Config standard",
                    value = """
                        {
                          "temperature": 0.5,
                          "maxTokens": 2048,
                          "maxMemoryMessages": 20,
                          "maxIterations": 8,
                          "responseLanguage": "fr",
                          "timezone": "Europe/Paris",
                          "streamingEnabled": true
                        }
                        """
                )
            )
        )
    )
    @ApiResponse(responseCode = "200", description = "Configuration mise à jour")
    @PutMapping("/{agentId}/config")
    public ResponseEntity<AgentDetailResponse> updateConfig(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Valid @RequestBody AgentConfigRequest req) {
        return ResponseEntity.ok(agentService.updateConfig(userId, agentId, req));
    }

    @Operation(
        summary = "Mettre à jour le profil de l'agent",
        description = """
            Définit la personnalité et l'identité visible de l'agent.

            - `displayName` : nom affiché dans l'UI.
            - `persona` : description libre du rôle (ex. "Tu es un expert RH…").
            - `tone` : style de réponse — `PROFESSIONAL`, `CASUAL`, `FORMAL`, `FRIENDLY`, `CREATIVE`.
            - `welcomeMessage` : message envoyé au démarrage d'une session.
            - `capabilitiesJson` : tableau JSON des capacités déclarées (`["email","scheduling"]`).
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = @ExampleObject(
                    name = "Profil SCRUM_MASTER",
                    value = """
                        {
                          "displayName": "ChefBot",
                          "bio": "Je coordonne votre équipe d'agents IA.",
                          "persona": "Tu es un chef de projet agile expert en coordination multi-agents. Tu délègues aux bons agents et tu fais des synthèses claires.",
                          "tone": "PROFESSIONAL",
                          "welcomeMessage": "Bonjour ! Que puis-je coordonner pour vous aujourd'hui ?",
                          "capabilitiesJson": "[\\"delegation\\", \\"planning\\", \\"reporting\\"]"
                        }
                        """
                )
            )
        )
    )
    @ApiResponse(responseCode = "200", description = "Profil mis à jour")
    @PutMapping("/{agentId}/profile")
    public ResponseEntity<AgentDetailResponse> updateProfile(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Valid @RequestBody AgentProfileRequest req) {
        return ResponseEntity.ok(agentService.updateProfile(userId, agentId, req));
    }

    // ── LLM Providers ────────────────────────────────────────────────────────

    @Operation(
        summary = "Attacher un LLM provider à l'agent",
        description = """
            Connecte un modèle LLM à cet agent. Sans LLM configuré, le chat retourne une erreur.

            **Providers supportés :** `OPENAI`, `ANTHROPIC`, `GROQ`, `MISTRAL`, `GEMINI`, `OLLAMA`, `COHERE`, `TOGETHER_AI`

            Le champ `primary: true` désigne le provider principal utilisé par l'orchestrateur.
            Plusieurs providers peuvent coexister (fallback, tests A/B).
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "OpenAI GPT-4o-mini",
                        summary = "Provider OpenAI (recommandé)",
                        value = """
                            {
                              "type": "OPENAI",
                              "modelId": "gpt-4o-mini",
                              "apiKey": "sk-xxxxxxxxxxxxxxxxxxxx",
                              "primary": true,
                              "temperature": 0.5,
                              "maxTokens": 2048,
                              "streamingEnabled": true
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Groq Llama3",
                        summary = "Provider Groq (très rapide, gratuit)",
                        value = """
                            {
                              "type": "GROQ",
                              "modelId": "llama3-8b-8192",
                              "apiKey": "gsk_xxxxxxxxxxxxxxxxxxxx",
                              "primary": true
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Anthropic Claude",
                        summary = "Provider Anthropic",
                        value = """
                            {
                              "type": "ANTHROPIC",
                              "modelId": "claude-3-haiku-20240307",
                              "apiKey": "sk-ant-xxxxxxxxxxxxxxxxxxxx",
                              "primary": true
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Ollama local",
                        summary = "Modèle local Ollama (self-hosted)",
                        value = """
                            {
                              "type": "OLLAMA",
                              "modelId": "llama3",
                              "baseUrl": "http://localhost:11434",
                              "primary": true
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "LLM provider ajouté"),
        @ApiResponse(responseCode = "400", description = "Champs obligatoires manquants (type, modelId)")
    })
    @PostMapping("/{agentId}/llm-providers")
    public ResponseEntity<LlmProviderResponse> addLlm(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId,
            @Valid @RequestBody LlmProviderRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(agentService.addLlmProvider(userId, agentId, req));
    }

    @Operation(summary = "Statut quota LLM du provider actif")
    @GetMapping("/{agentId}/quota")
    public ResponseEntity<com.creativeai.agentteam.llm.LlmGateway.QuotaStatus> getQuota(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId) {
        return ResponseEntity.ok(llmGateway.getQuotaStatus(agentId));
    }

    @Operation(summary = "Lister les LLM providers de l'agent")
    @GetMapping("/{agentId}/llm-providers")
    public ResponseEntity<List<LlmProviderResponse>> getLlm(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return ResponseEntity.ok(agentService.getLlmProviders(userId, agentId, includeDeleted));
    }

    @Operation(summary = "Supprimer (soft-delete) un LLM provider")
    @DeleteMapping("/{agentId}/llm-providers/{llmId}")
    public ResponseEntity<Void> deleteLlm(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String llmId) {
        agentService.deleteLlmProvider(userId, agentId, llmId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Restaurer un LLM provider soft-deleted")
    @PostMapping("/{agentId}/llm-providers/{llmId}/restore")
    public ResponseEntity<LlmProviderResponse> restoreLlm(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(agentService.restoreLlmProvider(userId, agentId, llmId));
    }

    @Operation(summary = "Définir un LLM provider comme principal")
    @PatchMapping("/{agentId}/llm-providers/{llmId}/primary")
    public ResponseEntity<LlmProviderResponse> setPrimaryLlm(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String llmId) {
        return ResponseEntity.ok(agentService.setPrimaryLlmProvider(userId, agentId, llmId));
    }

    @Operation(summary = "Révéler la clé API d'un LLM provider (décryptée)")
    @GetMapping("/{agentId}/llm-providers/{llmId}/reveal")
    public ResponseEntity<java.util.Map<String, String>> revealLlmKey(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @PathVariable String llmId) {
        String key = agentService.revealLlmApiKey(userId, agentId, llmId);
        return ResponseEntity.ok(java.util.Map.of("apiKey", key));
    }

    // ── Upload photo ─────────────────────────────────────────────────────────

    @Operation(summary = "Upload une photo d'agent vers MinIO", description = "Accepte une image (multipart/form-data) et retourne l'URL publique.")
    @ApiResponse(responseCode = "200", description = "URL de la photo uploadée")
    @PostMapping(value = "/upload-photo", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<java.util.Map<String, String>> uploadPhoto(
            @AuthenticationPrincipal String userId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        String url = minioService.uploadAgentPhoto(file);
        return ResponseEntity.ok(java.util.Map.of("url", url));
    }

    // ── Suppression ──────────────────────────────────────────────────────────

    @Operation(
        summary = "Supprimer un agent (soft delete)",
        description = "Marque l'agent comme supprimé (`deleted=true`). Il disparaît de toutes les listes mais ses données sont conservées. Récupérable via `POST /{agentId}/restore`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Agent supprimé"),
        @ApiResponse(responseCode = "404", description = "Agent introuvable")
    })
    @DeleteMapping("/{agentId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        agentService.deleteAgent(userId, agentId);
        return ResponseEntity.noContent().build();
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────

    @Operation(
        summary = "Lister les agents supprimés",
        description = "Retourne les agents dont `deleted=true`, triés par date de suppression décroissante."
    )
    @ApiResponse(responseCode = "200", description = "Liste des agents supprimés")
    @GetMapping("/deleted")
    public ResponseEntity<List<AgentResponse>> listDeleted(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(agentService.listDeletedAgents(userId));
    }

    @Operation(
        summary = "Restaurer un agent supprimé",
        description = "Remet `deleted=false` sur l'agent. Il réapparaît dans `GET /api/agents`."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Agent restauré"),
        @ApiResponse(responseCode = "404", description = "Agent supprimé introuvable")
    })
    @PostMapping("/{agentId}/restore")
    public ResponseEntity<AgentDetailResponse> restore(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent supprimé") @PathVariable String agentId) {
        return ResponseEntity.ok(agentService.restoreAgent(userId, agentId));
    }
}
