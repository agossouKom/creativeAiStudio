package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.SocialPlatform;
import com.creativeai.agentteam.repository.SocialPlatformRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Résout les identifiants applicatifs d'un réseau, en privilégiant ce que
 * l'administrateur a saisi dans le dashboard.
 *
 * Ordre de priorité, et pourquoi :
 *   1. la table `social_platforms` — c'est le nouvel espace de gestion ;
 *   2. les variables d'environnement — l'existant.
 *
 * Ce repli n'est pas cosmétique : la prod tourne aujourd'hui avec des variables
 * d'environnement, et tant que l'administrateur n'a rien saisi, on doit
 * continuer à fonctionner exactement comme avant. Le moment où l'un des deux
 * existe suffit à basculer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SocialPlatformConfigService {

    private final SocialPlatformRepository repository;
    private final EncryptionService encryptionService;

    @Value("${oauth.facebook.app-id:}")
    private String fbAppId;
    @Value("${oauth.facebook.app-secret:}")
    private String fbAppSecret;
    @Value("${oauth.linkedin.client-id:}")
    private String linkedinClientId;
    @Value("${oauth.linkedin.client-secret:}")
    private String linkedinClientSecret;
    @Value("${oauth.twitter.client-id:}")
    private String twitterClientId;
    @Value("${oauth.twitter.client-secret:}")
    private String twitterClientSecret;
    @Value("${oauth.tiktok.client-key:}")
    private String tiktokClientKey;
    @Value("${oauth.tiktok.client-secret:}")
    private String tiktokClientSecret;
    // YouTube réutilise l'application Google du module Gmail : les mêmes noms de
    // variables que OAuthSocialController, sinon le repli environnement serait
    // silencieusement vide en déploiement.
    @Value("${GMAIL_CLIENT_ID:}")
    private String googleClientId;
    @Value("${GMAIL_CLIENT_SECRET:}")
    private String googleClientSecret;

    /** Résultat de résolution, avec la provenance pour que l'admin sache quoi corriger. */
    public record Credentials(String clientId, String clientSecret, boolean fromDatabase) {
        public boolean isPresent() {
            return clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank();
        }
    }

    /**
     * Instagram passe par la même application que Facebook : les deux
     * plateformes partagent une entrée dans le dashboard, comme sur Meta.
     */
    public String resolvePlatformId(String platform) {
        if (platform == null) return null;
        return switch (platform.toUpperCase()) {
            case "INSTAGRAM" -> "facebook";
            case "TWITTER", "X" -> "twitter_x";
            case "GOOGLE", "YOUTUBE" -> "youtube";
            default -> platform.toLowerCase();
        };
    }

    @Transactional(readOnly = true)
    public Credentials resolve(String platform) {
        String platformId = resolvePlatformId(platform);
        if (platformId == null) return new Credentials(null, null, false);

        Optional<SocialPlatform> found = repository.findById(platformId);
        if (found.isPresent()) {
            SocialPlatform sp = found.get();
            if (sp.getClientId() != null && !sp.getClientId().isBlank()) {
                String secret = null;
                if (sp.getClientSecretEnc() != null && !sp.getClientSecretEnc().isBlank()) {
                    try {
                        secret = encryptionService.decrypt(sp.getClientSecretEnc());
                    } catch (Exception e) {
                        // Un secret illisible ne doit pas empêcher le démarrage :
                        // on retombe sur l'environnement plutôt que de planter.
                        log.error("Secret illisible pour la plateforme {} : {}", platformId, e.getMessage());
                    }
                }
                if (secret != null && !secret.isBlank()) {
                    return new Credentials(sp.getClientId(), secret, true);
                }
            }
        }
        return fromEnvironment(platform);
    }

    private Credentials fromEnvironment(String platform) {
        return switch (platform.toUpperCase()) {
            case "FACEBOOK", "INSTAGRAM" -> new Credentials(fbAppId, fbAppSecret, false);
            case "LINKEDIN"  -> new Credentials(linkedinClientId, linkedinClientSecret, false);
            case "TWITTER_X" -> new Credentials(twitterClientId, twitterClientSecret, false);
            case "TIKTOK"    -> new Credentials(tiktokClientKey, tiktokClientSecret, false);
            case "YOUTUBE"   -> new Credentials(googleClientId, googleClientSecret, false);
            default -> new Credentials(null, null, false);
        };
    }

    /**
     * Ce qu'indique le dashboard à l'administrateur : la plateforme est-elle
     * activée, et où sont ses identifiants ? Jamais le secret lui-même.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> adminStatus(String platform) {
        Map<String, Object> out = new LinkedHashMap<>();
        String platformId = resolvePlatformId(platform);
        SocialPlatform sp = platformId == null ? null : repository.findById(platformId).orElse(null);

        Credentials creds = resolve(platform);
        out.put("platform", platform);
        out.put("inDatabase", sp != null);
        out.put("isActive", sp == null || Boolean.TRUE.equals(sp.getIsActive()));
        out.put("configured", creds.isPresent());
        out.put("fromDatabase", creds.fromDatabase());
        out.put("clientIdHint", mask(creds.clientId()));
        return out;
    }

    /** Aperçu non réversible : assez pour reconnaître, pas assez pour utiliser. */
    private String mask(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.length() <= 4) return "****";
        return value.substring(0, 2) + "…" + value.substring(value.length() - 2);
    }
}
