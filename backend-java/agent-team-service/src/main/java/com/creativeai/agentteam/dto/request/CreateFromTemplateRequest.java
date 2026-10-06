package com.creativeai.agentteam.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record CreateFromTemplateRequest(
    @Schema(description = "Nom personnalisé. Si absent, le nom par défaut du template est utilisé.",
            example = "Mon Agent Email")
    String name,

    @Schema(description = "Description personnalisée. Complète celle du template si fournie.")
    String description,

    @Schema(
        description = "UUID de l'équipe à laquelle associer l'agent. Obligatoire : "
                    + "l'agent dérive son modèle de son équipe. Doit appartenir à l'appelant.",
        example = "c6b1312d-a126-4e5c-8d37-b1b7f4bab7d5")
    @NotBlank
    String teamId
) {}
