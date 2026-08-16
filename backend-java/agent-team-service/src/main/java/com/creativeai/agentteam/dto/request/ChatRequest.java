package com.creativeai.agentteam.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Message envoyé à un agent ou à une équipe")
public record ChatRequest(

    @Schema(
        description = "Contenu du message. Supporte le markdown.",
        example = "Rédige un email de relance pour le client Dupont.",
        maxLength = 8000
    )
    @NotBlank @Size(max = 8000)
    String message,

    @Schema(
        description = """
            Identifiant de session conversationnelle.
            Réutilisez le même ID pour maintenir le contexte entre plusieurs messages.
            Généré automatiquement (UUID) si absent.
            """,
        example = "session-abc-123"
    )
    String sessionId,

    @Schema(
        description = "Contexte additionnel injecté dans le message (contenu de document, données brutes…)",
        example = "Données client : Dupont SARL, facture n°2024-042, montant 1200€, échéance dépassée de 30 jours."
    )
    String context

) {}
