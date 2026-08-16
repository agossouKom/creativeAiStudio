package com.creativeai.agentteam.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

public record CreateFromTemplateRequest(
    @Schema(description = "Nom personnalisé. Si absent, le nom par défaut du template est utilisé.",
            example = "Mon Agent Email")
    String name,

    @Schema(description = "Description personnalisée. Complète celle du template si fournie.")
    String description,

    @Schema(description = "UUID de l'équipe à laquelle associer l'agent dès la création")
    String teamId
) {}
