package com.creativeai.generation.dto;

/**
 * Référence durable vers un objet MinIO : le contenu n'est jamais renvoyé par l'API,
 * seulement une URL signée à durée de vie courte (endpoint download-url).
 */
public record GenerationOutputResponse(
    int index,
    String bucket,
    String objectKey,
    long sizeBytes,
    String sha256,
    String contentType
) {
    /** Identifiant minio://bucket/objectKey, seule forme acceptée par la publication sociale. */
    public String minioUri() {
        return "minio://" + bucket + "/" + objectKey;
    }
}
