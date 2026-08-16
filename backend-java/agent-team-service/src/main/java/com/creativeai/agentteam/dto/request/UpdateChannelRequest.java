package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.PlatformType;
import io.swagger.v3.oas.annotations.media.Schema;

public record UpdateChannelRequest(
    @Schema(description = "Nom d'affichage du canal", example = "Gmail Pro")
    String displayName,

    @Schema(description = "Sous-plateforme (pour SOCIAL_MEDIA uniquement)",
            allowableValues = {"TIKTOK","FACEBOOK","INSTAGRAM","LINKEDIN","TWITTER_X","YOUTUBE","PINTEREST","SNAPCHAT","THREADS"})
    PlatformType platformType,

    @Schema(description = "Credentials en clair — chiffrées AES-256-GCM avant stockage",
            example = "{\"smtpHost\":\"smtp.gmail.com\",\"smtpPort\":587,\"user\":\"bot@company.com\",\"password\":\"secret\"}")
    String credentials,

    @Schema(description = "Configuration canal-spécifique (JSON libre)",
            example = "{\"labels\":[\"INBOX\",\"UNREAD\"],\"maxEmails\":50}")
    String config,

    @Schema(description = "Identifiant du compte côté provider", example = "bot@company.com")
    String accountId,

    @Schema(description = "Nom du compte côté provider", example = "Bot Marketing")
    String accountName
) {}
