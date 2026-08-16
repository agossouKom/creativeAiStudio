package com.creativeai.agentteam.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record InboxReplyRequest(
    @NotBlank
    @Schema(description = "Sujet de la réponse", example = "Re: Demande de relance")
    String replySubject,

    @NotBlank
    @Schema(description = "Corps de la réponse envoyée")
    String replyBody,

    @Schema(description = "Si true, envoie directement la réponse ; sinon elle reste en attente d'approbation", defaultValue = "false")
    Boolean autoSend
) {}
