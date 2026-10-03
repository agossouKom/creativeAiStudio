package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.Channel;
import com.creativeai.agentteam.model.enums.ChannelStatus;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.PlatformType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

public record ChannelResponse(
    String id,
    String agentId,
    ChannelType type,
    PlatformType platformType,
    String displayName,
    ChannelStatus status,
    String accountId,
    String accountName,
    String config,
    String metrics,
    LocalDateTime lastSyncAt,
    LocalDateTime tokenExpiresAt,
    boolean deleted,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    /** URL webhook unique à copier dans le Meta App Dashboard (null hors Meta). */
    String webhookUrl,
    /** Token de vérification Meta unique à ce canal (null hors Meta). */
    String verifyToken
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ChannelResponse from(Channel c) {
        return fromWithUrl(c, null);
    }

    public static ChannelResponse fromWithUrl(Channel c, String publicUrl) {
        String webhookUrl  = null;
        String verifyToken = null;
        if (c.getType() == ChannelType.SOCIAL_MEDIA) {
            // Facebook et Instagram sont deux objets Meta distincts, avec deux
            // URLs de webhook distinctes : le payload de l'un (`object: "page"`)
            // serait rejeté par le contrôleur de l'autre (`object: "instagram"`).
            String webhookPath = webhookPathFor(c.getPlatformType());
            if (webhookPath != null) {
                if (publicUrl != null && c.getId() != null) {
                    webhookUrl = publicUrl + webhookPath + c.getId();
                }
                verifyToken = extractVerifyToken(c.getConfig());
            }
        }
        return new ChannelResponse(
            c.getId(),
            c.getAgent() != null ? c.getAgent().getId() : null,
            c.getType(),
            c.getPlatformType(),
            c.getDisplayName(),
            c.getStatus(),
            c.getAccountId(),
            c.getAccountName(),
            c.getConfig(),
            c.getMetrics(),
            c.getLastSyncAt(),
            c.getTokenExpiresAt(),
            c.isDeleted(),
            c.getCreatedAt(),
            c.getUpdatedAt(),
            webhookUrl,
            verifyToken
        );
    }

    /** Préfixe de l'URL webhook par canal, ou {@code null} pour une plateforme sans webhook. */
    private static String webhookPathFor(PlatformType platformType) {
        if (platformType == PlatformType.FACEBOOK)  return "/api/facebook/webhook/";
        if (platformType == PlatformType.INSTAGRAM) return "/api/instagram/webhook/";
        return null;
    }

    private static String extractVerifyToken(String config) {
        if (config == null || config.isBlank()) return null;
        try {
            JsonNode node = MAPPER.readTree(config);
            JsonNode vt   = node.get("verifyToken");
            return vt != null && !vt.isNull() ? vt.asText() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
