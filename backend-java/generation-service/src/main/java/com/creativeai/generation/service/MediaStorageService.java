package com.creativeai.generation.service;

import com.creativeai.generation.model.GenerationOutput;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.Instant;

/**
 * Accès MinIO en lecture : URL signée pour le téléchargement côté client, et
 * octets pour les plateformes qui acceptent un upload direct plutôt qu'une URL
 * publique. Le bucket n'est jamais rendu public.
 *
 * Les URLs signées sont émises par le client configuré sur l'endpoint public
 * ({@code minio.public-url}) : une URL signée sur l'hôte interne du réseau Docker
 * ({@code minio.url}) est inutilisable pour le navigateur comme pour les API de
 * Meta, et la signature ne survit pas à la réécriture de l'hôte.
 */
@Slf4j
@Service
public class MediaStorageService {

    private final MinioClient minioClient;
    private final MinioClient minioPublicClient;
    private final int defaultExpiryMinutes;

    public MediaStorageService(MinioClient minioClient,
                               @Qualifier("minioPublicClient") MinioClient minioPublicClient,
                               @Value("${generation.download-url-expiry-minutes:120}") int defaultExpiryMinutes) {
        this.minioClient = minioClient;
        this.minioPublicClient = minioPublicClient;
        this.defaultExpiryMinutes = defaultExpiryMinutes;
    }

    public record PresignedDownload(String url, String contentType, long sizeBytes, Instant expiresAt) {}

    public PresignedDownload presignedDownload(GenerationOutput output) {
        return presignedDownload(output, defaultExpiryMinutes);
    }

    public PresignedDownload presignedDownload(GenerationOutput output, int expiryMinutes) {
        try {
            String url = minioPublicClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                .method(Method.GET)
                .bucket(output.getBucket())
                .object(output.getObjectKey())
                .expiry(expiryMinutes, java.util.concurrent.TimeUnit.MINUTES)
                .build());
            return new PresignedDownload(url, output.getContentType(),
                output.getSizeBytes() != null ? output.getSizeBytes() : 0L,
                Instant.now().plusSeconds(expiryMinutes * 60L));
        } catch (Exception e) {
            throw new IllegalStateException("Génération d'URL signée impossible pour "
                + output.getBucket() + "/" + output.getObjectKey() + ": " + e.getMessage(), e);
        }
    }

    /** URL signée longue durée, destinée aux APIs sociales qui doivent récupérer le média. */
    public String presignedPublicUrl(GenerationOutput output, int expiryMinutes) {
        return presignedDownload(output, expiryMinutes).url();
    }

    public byte[] download(GenerationOutput output) {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
            .bucket(output.getBucket())
            .object(output.getObjectKey())
            .build())) {
            return stream.readAllBytes();
        } catch (Exception e) {
            throw new IllegalStateException("Lecture de l'objet "
                + output.getBucket() + "/" + output.getObjectKey() + " impossible: " + e.getMessage(), e);
        }
    }
}
