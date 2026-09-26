package com.creativeai.generation.service;

import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.model.GenerationOutput;
import com.creativeai.generation.social.MediaReference;
import com.creativeai.generation.social.PlatformCapabilities;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Traduit une sortie stockée en MinIO dans la référence attendue par la plateforme.
 *
 * - {@link MediaReference#PRESIGNED_URL} : Meta/TikTok téléchargent le média eux-mêmes,
 *   il faut donc une URL signée à durée de vie longue.
 * - {@link MediaReference#MINIO_URL} : le service appelant télécharge l'objet avec ses
 *   propres credentials puis envoie les octets. agent-team-service reconnaît
 *   {@code http://minio:9000/bucket/cle} et fait un téléchargement cross-bucket,
 *   d'où une URL MinIO simple, sans query string qui polluerait la clé d'objet.
 */
@Service
public class SocialMediaReferenceResolver {

    /** Les API qui récupèrent le média sur Internet ont besoin d'une marge large. */
    private static final int PRESIGNED_EXPIRY_MINUTES = 360;

    private final MediaStorageService storageService;
    private final String publicBaseUrl;

    public SocialMediaReferenceResolver(MediaStorageService storageService,
                                        @Value("${minio.public-url}") String publicBaseUrl) {
        this.storageService = storageService;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    public String resolve(PlatformCapabilities capabilities, GenerationOutput output) {
        return switch (capabilities.mediaReference()) {
            case PRESIGNED_URL -> storageService.presignedPublicUrl(output, PRESIGNED_EXPIRY_MINUTES);
            case MINIO_URL -> publicBaseUrl + "/" + output.getBucket() + "/" + output.getObjectKey();
            case BYTES_UPLOAD -> throw new PublishNotAllowedException("PLATFORM_ADAPTER_MISSING",
                "Aucun adaptateur d'upload direct pour " + capabilities.label()
                    + " : les octets ne sont pas envoyés pour l'instant.");
        };
    }
}
