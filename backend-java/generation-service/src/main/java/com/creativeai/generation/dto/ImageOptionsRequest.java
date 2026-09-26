package com.creativeai.generation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

/**
 * Contraintes alignées sur la validation du worker (ai-workers/image-generation-worker/app/events.py).
 * Le format "url" est refusé : le worker télécharge puis stocke localement en MinIO,
 * donc b64_json reste le format recommandé.
 */
public record ImageOptionsRequest(
    @Pattern(regexp = "[0-9]{2,4}x[0-9]{2,4}", message = "size doit ressembler à 1024x1024")
    String size,

    @Min(value = 1, message = "count doit être >= 1")
    @Max(value = 10, message = "count doit être <= 10")
    Integer count,

    @Pattern(regexp = "[A-Za-z0-9._-]{1,64}", message = "model contient des caractères non autorisés")
    String model,

    @Pattern(regexp = "[A-Za-z0-9._-]{1,64}", message = "style contient des caractères non autorisés")
    String style,

    @Pattern(regexp = "[A-Za-z0-9._-]{1,64}", message = "quality contient des caractères non autorisés")
    String quality,

    @Min(value = 0, message = "seed doit être >= 0")
    @Max(value = 2147483647L, message = "seed doit être <= 2147483647")
    Long seed,

    @Pattern(regexp = "b64_json|url", message = "responseFormat doit valoir b64_json ou url")
    String responseFormat
) {
    public static ImageOptionsRequest defaults() {
        return new ImageOptionsRequest("1024x1024", 1, null, null, null, null, "b64_json");
    }

    public ImageOptionsRequest normalized() {
        ImageOptionsRequest fallback = defaults();
        return new ImageOptionsRequest(
            size != null ? size : fallback.size(),
            count != null ? count : fallback.count(),
            model,
            style,
            quality,
            seed,
            responseFormat != null ? responseFormat : fallback.responseFormat());
    }

    public boolean dimensionsWithinProviderLimits() {
        String[] parts = size.split("x");
        int width = Integer.parseInt(parts[0]);
        int height = Integer.parseInt(parts[1]);
        return width >= 64 && width <= 4096 && height >= 64 && height <= 4096;
    }
}
