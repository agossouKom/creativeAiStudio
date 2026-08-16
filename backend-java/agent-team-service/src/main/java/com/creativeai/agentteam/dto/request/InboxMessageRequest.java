package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.MessageDirection;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InboxMessageRequest(
    @Schema(description = "UUID de l'agent qui envoie le message")
    String agentId,

    @Schema(description = "UUID de l'équipe (si message envoyé via équipe)")
    String teamId,

    @NotNull
    @Schema(description = "Canal utilisé pour l'envoi",
            allowableValues = {"GMAIL","EMAIL_SMTP","WHATSAPP","TELEGRAM","SLACK","SOCIAL_MEDIA"})
    ChannelType channel,

    @Schema(description = "Direction du message", defaultValue = "OUTBOUND",
            allowableValues = {"INBOUND","OUTBOUND"})
    MessageDirection direction,

    @Schema(description = "Expéditeur (email, numéro, handle)", example = "bot@company.com")
    String fromAddress,

    @Schema(description = "Destinataire", example = "client@example.com")
    String toAddress,

    @Schema(description = "Objet (email uniquement)", example = "Suivi de votre commande #12345")
    String subject,

    @NotBlank
    @Schema(description = "Corps du message")
    String body,

    @Schema(description = "ID de conversation pour regrouper les messages d'un même thread")
    String conversationId,

    @Schema(description = "Pièces jointes (JSON)", example = "[{\"name\":\"facture.pdf\",\"url\":\"https://...\"}]")
    String attachments,

    @Schema(description = "Métadonnées canal-spécifiques (JSON libre)")
    String metadata,

    @Schema(description = "URL de téléchargement du fichier généré (.docx)")
    String fileUrl,

    @Schema(description = "Nom du fichier généré")
    String fileName
) {}
