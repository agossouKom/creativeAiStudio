package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.llm.LlmSource;
import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import java.time.LocalDateTime;

public record LlmProviderResponse(
    String id, String agentId, String userId, String teamId, LlmType type, String modelId, String baseUrl,
    String displayName, double temperature, int maxTokens,
    boolean streamingEnabled, int rateLimitRpm,
    boolean primary, boolean active, boolean deleted,
    boolean platformDefault,
    /** Provider déposé automatiquement sur l'équipe, plutôt que choisi par l'utilisateur. */
    boolean autoAssigned,
    LocalDateTime createdAt,
    boolean hasApiKey,
    /**
     * Tier de la chaîne de résolution qui a fourni ce provider : AGENT, TEAM,
     * TEAM_AUTO, ACCOUNT, PLATFORM_DEFAULT, ADMIN ou ENVIRONMENT.
     *
     * <p>Renseigné uniquement par {@code GET /resolved}, qui est le seul point
     * d'entrée à avoir réellement exécuté la chaîne. Les attributs du provider
     * ne permettent pas de le déduire : deux providers actifs peuvent n'être
     * rattachés ni à une équipe ni à un compte, et ne se distinguer que par leur
     * origine. Sans ce champ, vérifier d'où vient le modèle d'un agent impose de
     * comparer des identifiants à la main.
     */
    LlmSource resolutionSource
) {
    public static LlmProviderResponse from(LlmProvider p) {
        String agentId = p.getAgent() != null ? p.getAgent().getId() : null;
        return new LlmProviderResponse(p.getId(), agentId, p.getUserId(), p.getTeamId(),
            p.getType(), p.getModelId(), p.getBaseUrl(), p.getDisplayName(),
            p.getTemperature(), p.getMaxTokens(), p.isStreamingEnabled(),
            p.getRateLimitRpm(), p.isPrimary(), p.isActive(), p.isDeleted(),
            p.isPlatformDefault(), p.isAutoAssigned(), p.getCreatedAt(),
            p.getEncryptedApiKey() != null && !p.getEncryptedApiKey().isBlank(),
            null);
    }

    /** Renseigne le tier d'origine, pour la réponse de {@code GET /resolved}. */
    public LlmProviderResponse withResolutionSource(LlmSource source) {
        return new LlmProviderResponse(id, agentId, userId, teamId, type, modelId, baseUrl,
            displayName, temperature, maxTokens, streamingEnabled, rateLimitRpm, primary,
            active, deleted, platformDefault, autoAssigned, createdAt, hasApiKey, source);
    }
}
