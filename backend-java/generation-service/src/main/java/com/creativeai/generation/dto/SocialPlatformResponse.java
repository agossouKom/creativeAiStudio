package com.creativeai.generation.dto;

import com.creativeai.generation.model.MediaType;
import com.creativeai.generation.social.MediaReference;
import com.creativeai.generation.social.PlatformCapabilities;
import com.creativeai.generation.social.SupportLevel;

import java.util.List;
import java.util.Set;

/**
 * Exposé par GET /api/generation/social/platforms pour que le frontend sache
 * ce qu'il peut réellement publier, sans découvrir les limites en production.
 */
public record SocialPlatformResponse(
    String platform,
    String label,
    SupportLevel supportLevel,
    Set<MediaType> supportedMedia,
    MediaReference mediaReference,
    boolean requiresPublicMediaUrl,
    boolean requiresProfessionalAccount,
    boolean requiresAppReview,
    List<String> requiredScopes,
    Integer maxDurationSeconds,
    List<String> allowedAspectRatios,
    String notes
) {
    public static SocialPlatformResponse from(PlatformCapabilities capabilities) {
        return new SocialPlatformResponse(
            capabilities.platform().name(),
            capabilities.label(),
            capabilities.supportLevel(),
            capabilities.supportedMedia(),
            capabilities.mediaReference(),
            capabilities.requiresPublicMediaUrl(),
            capabilities.requiresProfessionalAccount(),
            capabilities.requiresAppReview(),
            capabilities.requiredScopes(),
            capabilities.maxDurationSeconds(),
            capabilities.allowedAspectRatios(),
            capabilities.notes());
    }
}
