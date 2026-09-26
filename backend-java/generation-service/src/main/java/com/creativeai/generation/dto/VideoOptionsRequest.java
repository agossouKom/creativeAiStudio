package com.creativeai.generation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Contraintes alignées sur la validation du worker (ai-workers/video-generation-worker/app/events.py).
 */
public record VideoOptionsRequest(
    @Pattern(regexp = "16:9|9:16|1:1", message = "aspectRatio doit valoir 16:9, 9:16 ou 1:1")
    String aspectRatio,

    @Size(max = 32, message = "language ne doit pas dépasser 32 caractères")
    String language,

    @Size(max = 128, message = "voice ne doit pas dépasser 128 caractères")
    String voice,

    Boolean subtitles,

    @Min(value = 1, message = "videoCount doit être >= 1")
    @Max(value = 10, message = "videoCount doit être <= 10")
    Integer videoCount,

    @Min(value = 1, message = "clipDurationSeconds doit être >= 1")
    @Max(value = 60, message = "clipDurationSeconds doit être <= 60")
    Integer clipDurationSeconds,

    @Pattern(regexp = "pexels|pixabay|coverr", message = "source doit valoir pexels, pixabay ou coverr")
    String source
) {
    public static VideoOptionsRequest defaults() {
        return new VideoOptionsRequest("9:16", null, null, true, 1, 5, "pexels");
    }

    public VideoOptionsRequest normalized() {
        VideoOptionsRequest fallback = defaults();
        return new VideoOptionsRequest(
            aspectRatio != null ? aspectRatio : fallback.aspectRatio(),
            language,
            voice,
            subtitles != null ? subtitles : fallback.subtitles(),
            videoCount != null ? videoCount : fallback.videoCount(),
            clipDurationSeconds != null ? clipDurationSeconds : fallback.clipDurationSeconds(),
            source != null ? source : fallback.source());
    }
}
