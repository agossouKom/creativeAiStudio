package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.ChatRequest;
import com.creativeai.agentteam.dto.response.MemoryResponse;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.service.MemoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;

/**
 * Chat temps-réel avec un agent via Server-Sent Events.
 *
 * <p>Protocole de streaming :
 * <ul>
 *   <li>Chaque token est envoyé sous la forme {@code data: <token>\n\n}
 *   <li>Les appels d'outils envoient une notification : {@code data: 🔧 *Utilisation de l'outil* `nom`...\n\n}
 *   <li>Le flux se termine par {@code data: [DONE]\n\n}
 * </ul>
 */
@Tag(
    name = "Chat",
    description = """
        Conversation en temps réel avec un agent IA via **Server-Sent Events (SSE)**.

        Les tokens arrivent au fil de l'eau — pas d'attente de la réponse complète.
        La mémoire conversationnelle est sauvegardée automatiquement entre les requêtes.

        **Format SSE reçu :**
        ```
        data: Bonjour
        data:  !
        data:  Comment
        data:  puis-je
        data:  vous
        data:  aider
        data:  ?
        data: [DONE]
        ```

        **Pré-requis :** l'agent doit avoir un LLM provider configuré
        (`POST /api/agents/{id}/llm-providers`).

        Authentification requise : `Authorization: Bearer <JWT>`
        """
)
@Slf4j
@RestController
@RequestMapping("/api/agents/{agentId}/chat")
@RequiredArgsConstructor
public class ChatController {

    private final AgentOrchestrator orchestrator;
    private final MemoryService     memoryService;
    private final com.creativeai.agentteam.llm.LlmGateway llmGateway;
    private final com.creativeai.agentteam.service.AgentService agentService;

    @Operation(
        summary = "Envoyer un message à l'agent (streaming SSE)",
        description = """
            Envoie un message à l'agent et reçoit la réponse en streaming token par token.

            **Comportement agentic loop :**
            1. L'agent construit son contexte (prompt système + historique mémoire)
            2. Il appelle son LLM
            3. Si le LLM répond `TOOL_CALL:<nom>:<json>`, l'outil est exécuté et le résultat
               est injecté en mémoire pour le prochain appel
            4. La boucle continue jusqu'à obtenir une réponse finale (max `maxIterations`)
            5. La réponse finale est streamée token par token puis `[DONE]` est envoyé

            **`sessionId` :**
            Identifiant de session pour grouper les messages d'une même conversation.
            Si absent, une nouvelle session UUID est créée automatiquement.
            Réutilisez le même `sessionId` pour maintenir le contexte d'une conversation.

            **Exemple curl :**
            ```bash
            curl -N -X POST http://localhost:8087/api/agents/{agentId}/chat/stream \\
              -H "Authorization: Bearer $TOKEN" \\
              -H "Content-Type: application/json" \\
              -H "Accept: text/event-stream" \\
              -d '{"message": "Bonjour, quelle heure est-il ?", "sessionId": "session-abc"}'
            ```
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Message à envoyer à l'agent",
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Message simple",
                        summary = "Nouvelle session",
                        value = """
                            {
                              "message": "Bonjour, que peux-tu faire pour moi ?"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Session existante",
                        summary = "Continuer une conversation",
                        value = """
                            {
                              "message": "Délègue la rédaction d'un email de relance à l'agent email.",
                              "sessionId": "session-abc-123"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Avec contexte",
                        summary = "Message avec contexte additionnel",
                        value = """
                            {
                              "message": "Analyse ce document et fais un résumé.",
                              "sessionId": "session-xyz",
                              "context": "Document : Rapport Q4 2024..."
                            }
                            """
                    )
                }
            )
        )
    )
    @ApiResponses({
        @ApiResponse(
            responseCode = "200",
            description = "Flux SSE de tokens. Se termine par `[DONE]`.",
            content = @Content(
                mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
                examples = @ExampleObject(
                    value = "data: Bonjour\n\ndata:  !\n\ndata: [DONE]\n\n"
                )
            )
        ),
        @ApiResponse(responseCode = "404", description = "Agent introuvable"),
        @ApiResponse(
            responseCode = "200",
            description = "Pas de LLM configuré — message d'avertissement streamé suivi de [DONE]"
        )
    })
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chatStream(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent", example = "55865815-187e-4ef1-b2d4-a4814bd05cac")
            @PathVariable String agentId,
            @Valid @RequestBody ChatRequest req) {
        log.info("[CHAT] /stream hit agentId={} userId={} sid={}", agentId, userId, req.sessionId());
        agentService.requireOwnedAgent(userId, agentId);
        return orchestrator.chat(agentId, userId, req.message(), req.sessionId(), req.context());
    }

    @PostMapping("/generate-description")
    public ResponseEntity<java.util.Map<String, String>> generateDescription(
            @AuthenticationPrincipal String userId,
            @PathVariable String agentId,
            @RequestBody java.util.Map<String, String> req) {
        log.info("[CHAT] /generate-description hit agentId={} userId={}", agentId, userId);
        // Même raison que /social/caption : le provider est déduit de l'agent, donc
        // sans ce contrôle la requête pouvait consommer la clé du propriétaire.
        agentService.requireOwnedAgent(userId, agentId);
        String prompt = req.getOrDefault("prompt", "");
        String result = llmGateway.chat(agentId, List.of(
            new com.creativeai.agentteam.llm.ChatMessage("user", prompt)
        ));
        return ResponseEntity.ok(java.util.Map.of("description", result));
    }

    @Operation(
        summary = "Historique de la conversation",
        description = """
            Retourne tous les messages de la mémoire de l'agent pour cet utilisateur,
            triés chronologiquement.

            Les rôles possibles : `USER`, `ASSISTANT`, `TOOL_RESULT`, `SYSTEM`.
            """
    )
    @ApiResponse(responseCode = "200", description = "Liste des messages en mémoire")
    @GetMapping("/history")
    public ResponseEntity<List<MemoryResponse>> getHistory(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        return ResponseEntity.ok(memoryService.getHistoryAsDto(userId, agentId));
    }

    @Operation(
        summary = "Effacer la mémoire de l'agent",
        description = """
            Supprime tout l'historique conversationnel entre cet utilisateur et cet agent.
            La prochaine conversation repartira de zéro.
            """
    )
    @ApiResponse(responseCode = "204", description = "Mémoire effacée")
    @DeleteMapping("/memory")
    public ResponseEntity<Void> clearMemory(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'agent") @PathVariable String agentId) {
        memoryService.clearMemory(userId, agentId);
        return ResponseEntity.noContent().build();
    }
}
