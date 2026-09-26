package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import java.time.LocalDateTime;

public record LlmProviderResponse(
    String id, String agentId, String userId, String teamId, LlmType type, String modelId, String baseUrl,
    String displayName, double temperature, int maxTokens,
    boolean streamingEnabled, int rateLimitRpm,
    boolean primary, boolean active, boolean deleted,
    LocalDateTime createdAt,
    boolean hasApiKey
) {
    public static LlmProviderResponse from(LlmProvider p) {
        String agentId = p.getAgent() != null ? p.getAgent().getId() : null;
        return new LlmProviderResponse(p.getId(), agentId, p.getUserId(), p.getTeamId(),
            p.getType(), p.getModelId(), p.getBaseUrl(), p.getDisplayName(),
            p.getTemperature(), p.getMaxTokens(), p.isStreamingEnabled(),
            p.getRateLimitRpm(), p.isPrimary(), p.isActive(), p.isDeleted(), p.getCreatedAt(),
            p.getEncryptedApiKey() != null && !p.getEncryptedApiKey().isBlank());
    }
}
