package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.dto.request.ChatRequest;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import com.creativeai.agentteam.service.ResourceNotFoundException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;

/**
 * Point d'entrée unique pour chatter avec une équipe.
 * Le message est automatiquement routé vers le lead agent de l'équipe.
 */
@Slf4j
@Tag(
    name = "Teams",
    description = "Gestion des équipes d'agents IA."
)
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamChatController {

    private final AgentOrchestrator   orchestrator;
    private final AgentTeamRepository teamRepo;
    private final AgentRepository     agentRepo;
    private final ObjectMapper        objectMapper;

    @Operation(
        summary = "Chat avec l'équipe (streaming SSE)",
        description = """
            Envoie un message à l'équipe. Le message est **automatiquement routé** vers
            le lead agent, qui peut déléguer aux membres via l'outil `delegate_to_agent`.

            **Logique de résolution du lead agent :**
            1. Utilise `team.leadAgentId` s'il est défini et que l'agent existe
            2. Sinon, cherche le premier `SCRUM_MASTER` parmi `memberAgentIds`
            3. Sinon, utilise le premier membre disponible
            4. Si aucun agent n'est disponible → erreur 404

            **Exemple de délégation automatique :**
            L'utilisateur écrit *"Rédige un email de relance"* à l'équipe.
            Le SCRUM_MASTER reconnaît la tâche email → appelle `delegate_to_agent`
            avec l'ID de l'EMAIL_MANAGER → reçoit le brouillon → le retourne à l'utilisateur.

            **Format SSE identique à `/api/agents/{id}/chat/stream`** (tokens + `[DONE]`).

            **Exemple curl :**
            ```bash
            curl -N -X POST http://localhost:8087/api/teams/{teamId}/chat/stream \\
              -H "Authorization: Bearer $TOKEN" \\
              -H "Content-Type: application/json" \\
              -H "Accept: text/event-stream" \\
              -d '{"message": "Rédige un email de relance client.", "sessionId": "sess-001"}'
            ```
            """,
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            content = @Content(
                mediaType = MediaType.APPLICATION_JSON_VALUE,
                examples = {
                    @ExampleObject(
                        name = "Délégation email",
                        summary = "Le SCRUM_MASTER délèguera à l'EMAIL_MANAGER",
                        value = """
                            {
                              "message": "Rédige un email de relance pour le client Dupont qui n'a pas payé sa facture.",
                              "sessionId": "session-team-001"
                            }
                            """
                    ),
                    @ExampleObject(
                        name = "Question de coordination",
                        summary = "Question générale à l'équipe",
                        value = """
                            {
                              "message": "Quels agents composent cette équipe et que font-ils ?",
                              "sessionId": "session-team-001"
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
            description = "Flux SSE de tokens provenant du lead agent. Termine par `[DONE]`.",
            content = @Content(mediaType = MediaType.TEXT_EVENT_STREAM_VALUE)
        ),
        @ApiResponse(responseCode = "404", description = "Équipe introuvable ou aucun agent disponible dans l'équipe")
    })
    @PostMapping(value = "/{teamId}/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> teamChatStream(
            @AuthenticationPrincipal String userId,
            @Parameter(description = "UUID de l'équipe", example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
            @PathVariable String teamId,
            @Valid @RequestBody ChatRequest req) {

        var team = teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Équipe introuvable: " + teamId));

        String leadAgentId = resolveLeadAgent(team.getLeadAgentId(), team.getMemberAgentIds(), userId);
        log.info("[TEAM_CHAT] teamId={} → leadAgentId={}", teamId, leadAgentId);

        return orchestrator.chat(leadAgentId, userId, req.message(), req.sessionId(), null);
    }

    /**
     * Résout l'agent lead :
     * 1. leadAgentId de l'équipe s'il existe
     * 2. Premier SCRUM_MASTER dans les membres
     * 3. Premier membre disponible
     */
    private String resolveLeadAgent(String leadAgentId, String memberAgentIdsJson, String userId) {
        if (leadAgentId != null && !leadAgentId.isBlank()) {
            if (agentRepo.findByIdAndDeletedFalse(leadAgentId).isPresent()) {
                return leadAgentId;
            }
            log.warn("[TEAM_CHAT] leadAgentId {} introuvable, recherche d'un SCRUM_MASTER", leadAgentId);
        }

        List<String> memberIds = parseMemberIds(memberAgentIdsJson);
        if (memberIds.isEmpty()) {
            throw new ResourceNotFoundException("L'équipe n'a aucun agent membre et aucun lead agent configuré");
        }

        for (String memberId : memberIds) {
            var agent = agentRepo.findByIdAndDeletedFalse(memberId);
            if (agent.isPresent() && agent.get().getType() == AgentType.SCRUM_MASTER) {
                return memberId;
            }
        }

        for (String memberId : memberIds) {
            if (agentRepo.findByIdAndDeletedFalse(memberId).isPresent()) {
                return memberId;
            }
        }

        throw new ResourceNotFoundException("Aucun agent disponible dans l'équipe");
    }

    private List<String> parseMemberIds(String json) {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("[TEAM_CHAT] Impossible de parser memberAgentIds: {}", e.getMessage());
            return List.of();
        }
    }
}
