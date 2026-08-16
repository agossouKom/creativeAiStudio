package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.TriggerType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(description = "Payload de création d'un workflow d'automatisation")
public record CreateWorkflowRequest(

    @Schema(description = "Nom du workflow", example = "Traitement emails matinal", maxLength = 200)
    @NotBlank @Size(max = 200)
    String name,

    @Schema(description = "Description du workflow et de son objectif", example = "Classe et répond aux emails prioritaires chaque matin à 9h", maxLength = 1000)
    @Size(max = 1000)
    String description,

    @Schema(description = "UUID de l'équipe qui exécute ce workflow", example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
    String teamId,

    @Schema(
        description = "Mode de déclenchement du workflow",
        example = "SCHEDULED",
        allowableValues = {"MANUAL", "SCHEDULED", "WEBHOOK", "EMAIL", "SOCIAL_EVENT", "INTER_AGENT"}
    )
    TriggerType triggerType,

    @Schema(
        description = "Expression cron de planification (requis si `triggerType = SCHEDULED`). Format : `secondes minutes heures jour-mois mois jour-semaine`",
        example = "0 9 * * 1-5"
    )
    String cronExpression,

    @Schema(
        description = "UUID de l'agent qui déclenche ce workflow (pour `triggerType = INTER_AGENT`)",
        example = "55865815-187e-4ef1-b2d4-a4814bd05cac"
    )
    String triggerAgentId,

    @Schema(description = "Étapes ordonnées du workflow. Chaque étape est exécutée par un agent.")
    List<WorkflowStepRequest> steps

) {}
