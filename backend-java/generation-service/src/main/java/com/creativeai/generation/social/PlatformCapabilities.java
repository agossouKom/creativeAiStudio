package com.creativeai.generation.social;

import com.creativeai.generation.model.MediaType;

import java.util.List;
import java.util.Set;

/**
 * Contraintes réelles d'une plateforme, utilisées pour refuser une publication
 * impossible avant d'appeler une API externe. Rien n'est simulé : si la plateforme
 * n'a pas d'adaptateur, le niveau reste {@link SupportLevel#PLANNED}.
 */
public record PlatformCapabilities(
    SocialPlatform platform,
    String label,
    SupportLevel supportLevel,
    Set<MediaType> supportedMedia,
    MediaReference mediaReference,
    boolean requiresProfessionalAccount,
    boolean requiresAppReview,
    List<String> requiredScopes,
    Integer maxDurationSeconds,
    List<String> allowedAspectRatios,
    String notes
) {
    public boolean accepts(MediaType mediaType) {
        return supportedMedia.contains(mediaType);
    }

    public boolean acceptsDuration(int durationSeconds) {
        return maxDurationSeconds == null || durationSeconds <= maxDurationSeconds;
    }

    /** Vrai quand la plateforme doit elle-même télécharger le média (donc URL signée). */
    public boolean requiresPublicMediaUrl() {
        return mediaReference == MediaReference.PRESIGNED_URL;
    }
}
