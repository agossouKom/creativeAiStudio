package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.AgentType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Payload de création d'un agent IA")
public record CreateAgentRequest(

    @Schema(description = "Nom de l'agent affiché dans l'UI", example = "Chef de Projet", minLength = 2, maxLength = 150)
    @NotBlank @Size(min = 2, max = 150)
    String name,

    @Schema(
        description = "Type fonctionnel de l'agent. Détermine ses capacités par défaut.",
        example = "SCRUM_MASTER",
        allowableValues = {
            "SCRUM_MASTER", "EMAIL_MANAGER", "COMMUNITY_MANAGER",
            "PROSPECTION", "MARKETING", "CUSTOMER_SUPPORT",
            "CREATIVE_LEAD", "RAG_DOCUMENT", "CV_CREATOR", "CV_EDITOR",
            "IMAGE_CREATOR", "VIDEO_CREATOR", "ANIMATION",
            "AD_SPOT", "SECURITY_AUDIT", "ONLY_OFFICE"
        }
    )
    @NotNull
    AgentType type,

    @Schema(description = "Description du rôle et des responsabilités de l'agent", example = "Coordonne les tâches et délègue aux agents spécialisés", maxLength = 500)
    @Size(max = 500)
    String description,

    @Schema(description = "Identifiant URL unique. Auto-généré depuis `name` si absent.", example = "chef-de-projet-01", maxLength = 100)
    @Size(max = 100)
    String slug,

    @Schema(
        description = "UUID de l'équipe à laquelle associer cet agent. Obligatoire : "
                    + "l'agent dérive son modèle de son équipe, il ne peut pas en être détaché. "
                    + "Doit appartenir à l'appelant.",
        example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
    @NotBlank
    String teamId,

    @Schema(description = "Configuration comportementale (température, tokens, mémoire…). Valeurs par défaut appliquées si absent.")
    AgentConfigRequest config,

    @Schema(description = "Profil visible (nom affiché, persona, ton…). Peut être défini plus tard via PUT /profile.")
    AgentProfileRequest profile

) {}
