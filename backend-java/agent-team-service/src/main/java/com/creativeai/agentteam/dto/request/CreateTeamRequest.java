package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.CollaborationMode;
import com.creativeai.agentteam.model.enums.TeamType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "Payload de création d'une équipe d'agents")
public record CreateTeamRequest(

    @Schema(description = "Nom de l'équipe", example = "Équipe Marketing Digital", minLength = 2, maxLength = 150)
    @NotBlank @Size(min = 2, max = 150)
    String name,

    @Schema(description = "Description du périmètre de l'équipe", example = "Gère emails, réseaux sociaux et prospection clients", maxLength = 500)
    @Size(max = 500)
    String description,

    @Schema(
        description = "Type d'équipe",
        example = "BUSINESS",
        allowableValues = {"BUSINESS", "CREATIVE"}
    )
    TeamType type,

    @Schema(description = "UUID de l'organisation (multi-tenant). Optionnel.", example = "org-uuid-xxx")
    String organizationId,

    @Schema(
        description = "UUID de l'agent lead (SCRUM_MASTER recommandé). Reçoit tous les messages et délègue.",
        example = "55865815-187e-4ef1-b2d4-a4814bd05cac"
    )
    String leadAgentId,

    @Schema(
        description = "UUID du lead créatif (pour les équipes CREATIVE). Optionnel.",
        example = "agent-uuid-creative"
    )
    String creativeLeadAgentId,

    @Schema(
        description = "Mode de collaboration entre agents",
        example = "HYBRID",
        allowableValues = {"SEQUENTIAL", "PARALLEL", "HYBRID"}
    )
    CollaborationMode collaborationMode,

    @Schema(
        description = "Si `true`, les agents partagent une mémoire commune (contexte partagé).",
        example = "true"
    )
    Boolean sharedMemoryEnabled,

    @Schema(description = "Si `true`, les agents partagent la base de connaissances.", example = "false")
    Boolean sharedKnowledgeEnabled,

    @Schema(description = "Nombre max de tâches simultanées. Défaut : 10.", example = "5")
    Integer maxConcurrentTasks,

    @Schema(
        description = "Liste des UUIDs des agents membres de l'équipe",
        example = "[\"55865815-187e-4ef1-b2d4-a4814bd05cac\", \"d82a47a7-938d-4ff3-a8be-46da5579357c\"]"
    )
    List<String> memberAgentIds,

    @Schema(
        description = "Règles d'escalade en JSON (conditions de transfert vers un agent supérieur)",
        example = "{\"escalateTo\": \"agent-uuid\", \"onFailure\": true}"
    )
    String escalationRules,

    @Schema(
        description = "Configuration des notifications en JSON",
        example = "{\"email\": true, \"slack\": false, \"webhookUrl\": \"\"}"
    )
    String notificationConfig

) {}
