package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.model.enums.ToneStyle;
import java.time.LocalDateTime;
import java.util.List;

public record AgentDetailResponse(
    String id, String name, String slug, String code, String description,
    AgentType type, AgentStatus status,
    String teamId, String ownerId,
    // Config
    Double temperature, Integer maxTokens, Integer maxMemoryMessages,
    String responseLanguage, String timezone, Boolean streamingEnabled,
    Boolean autoReplyEnabled, String customParams,
    // Profile
    String displayName, String avatarUrl, String bio, String persona,
    ToneStyle tone, String welcomeMessage, String capabilitiesJson,
    // Extra
    String extraConfig,
    LocalDateTime lastActiveAt, LocalDateTime createdAt
) {
    public static AgentDetailResponse from(Agent a) {
        var cfg = a.getConfig();
        var prf = a.getProfile();
        return new AgentDetailResponse(
            a.getId(), a.getName(), a.getSlug(), a.getCode(), a.getDescription(),
            a.getType(), a.getStatus(), a.getTeamId(), a.getOwnerId(),
            cfg != null ? cfg.getTemperature()         : null,
            cfg != null ? cfg.getMaxTokens()           : null,
            cfg != null ? cfg.getMaxMemoryMessages()   : null,
            cfg != null ? cfg.getResponseLanguage()    : null,
            cfg != null ? cfg.getTimezone()            : null,
            cfg != null ? cfg.isStreamingEnabled()     : null,
            cfg != null ? cfg.isAutoReplyEnabled()     : null,
            cfg != null ? cfg.getCustomParams()        : null,
            prf != null ? prf.getDisplayName()         : null,
            prf != null ? prf.getAvatarUrl()           : null,
            prf != null ? prf.getBio()                 : null,
            prf != null ? prf.getPersona()             : null,
            prf != null ? prf.getTone()                : null,
            prf != null ? prf.getWelcomeMessage()      : null,
            prf != null ? prf.getCapabilitiesJson()    : null,
            a.getExtraConfig(), a.getLastActiveAt(), a.getCreatedAt()
        );
    }
}
