package com.creativeai.generation.config;

import io.minio.MinioClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;

@Configuration
public class MinioConfig {

    private static final Logger log = LoggerFactory.getLogger(MinioConfig.class);

    @Value("${minio.url:http://localhost:9000}")
    private String url;

    /**
     * Endpoint atteignable depuis l'extérieur du réseau Docker. Il sert
     * exclusivement à signer des URLs : la signature SigV4 porte sur l'hôte,
     * on ne peut donc pas réécrire l'URL interne, il faut signer avec le client
     * construit sur l'endpoint public.
     */
    @Value("${minio.public-url:${minio.url:http://localhost:9000}}")
    private String publicUrl;

    @Value("${minio.access-key:creativeai}")
    private String accessKey;

    @Value("${minio.secret-key:creativeai123}")
    private String secretKey;

    /**
     * Région déclarée explicitement : sans elle, le SDK fait un appel réseau
     * (getRegion) sur l'endpoint avant de signer, ce qui échoue dès que
     * l'endpoint public n'est pas joignable depuis le service (Cloudflare en
     * production, localhost:9400 en local).
     */
    @Value("${minio.region:us-east-1}")
    private String region;

    /** Client interne : opérations serveur (lecture d'octets). */
    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
            .endpoint(url)
            .credentials(accessKey, secretKey)
            .region(region)
            .build();
    }

    /** Client public : génération d'URLs signées consommables par un tiers. */
    @Bean
    @Qualifier("minioPublicClient")
    public MinioClient minioPublicClient() {
        return MinioClient.builder()
            .endpoint(endpointOf(publicUrl))
            .credentials(accessKey, secretKey)
            .region(region)
            .build();
    }

    /**
     * Le SDK MinIO refuse tout endpoint porteur d'un path
     * ({@code no path allowed in endpoint}), ce qui faisait échouer le
     * démarrage du service quand {@code minio.public-url} pointait un reverse
     * proxy ({@code https://ai.labibpro.com/minio}). On ne garde donc que
     * schéma + authority pour le client.
     *
     * <p>Attention : la signature SigV4 porte sur le chemin canonique, on ne
     * peut pas le réinjecter après coup. Un préfixe de path est donc supporté
     * pour la concaténation d'URLs ({@code SocialMediaReferenceResolver},
     * mode {@code MINIO_URL}) mais pas pour les URLs signées
     * ({@code PRESIGNED_URL}, Instagram) : exposez MinIO sur un hôte dédié.
     */
    static String endpointOf(String baseUrl) {
        URI uri = URI.create(baseUrl.trim());
        String authority = uri.getRawAuthority();
        if (uri.getScheme() == null || authority == null) {
            throw new IllegalArgumentException("minio url invalide (schéma+hôte requis): " + baseUrl);
        }
        String path = uri.getRawPath() == null ? "" : uri.getRawPath();
        if (!path.isEmpty() && !"/".equals(path)) {
            log.warn("minio.public-url contient un path ({}), ignoré pour le client MinIO : "
                + "les URLs signées seront servies à la racine de {} — utilisez un hôte dédié "
                + "pour la publication Instagram (PRESIGNED_URL).", path, authority);
        }
        return uri.getScheme() + "://" + authority;
    }
}
