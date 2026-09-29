package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Paramètres applicatifs d'un réseau social — appartiennent à la PLATEFORME.
 *
 * Séparation volontaire avec {@link UserSocialAccount} : ici on stocke ce que
 * la plateforme possède (client_id / client_secret de notre application), là-bas
 * ce que chaque utilisateur a autorisé (ses jetons). C'est le modèle de
 * Buffer et Metricool, et c'est ce qui permet d'ajouter YouTube ou TikTok plus
 * tard sans migration de structure.
 *
 * `clientSecretEnc` n'est jamais sérialisé : un secret d'application ne doit pas
 * sortir du serveur, pas même vers le dashboard qui le saisit.
 *
 * Volontairement hors de {@link BaseEntity} : une table de configuration
 * n'est pas une entité métier. Elle n'a pas d'identifiant interne ni de
 * corbeille — la désactivation passe par `isActive`, ce qui évite qu'un réseau
 * devienne introuvable pour des comptes déjà rattachés.
 */
@Entity
@Table(name = "social_platforms", indexes = {
    @Index(name = "idx_social_platform_active", columnList = "is_active")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SocialPlatform {

    /** Identifiant technique stable : 'facebook', 'youtube', … Jamais modifié
     *  une fois des comptes utilisateurs rattachés. */
    @Id
    @Column(name = "id", length = 40)
    private String id;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    /** oauth2 | oauth1 | api_key */
    @Column(name = "auth_type", nullable = false, length = 20)
    private String authType = "oauth2";

    @Column(name = "client_id", length = 255)
    private String clientId;

    /** Chiffré au repos (AES-GCM). Jamais renvoyé par l'API. */
    @Column(name = "client_secret_enc", columnDefinition = "text")
    @JsonIgnore
    private String clientSecretEnc;

    /**
     * Permissions demandées à l'utilisateur. Volontairement fixe par
     * plateforme : les permissions réellement accordées sont stockées dans
     * {@link UserSocialAccount#scopesGranted}, qui peut être plus restrictif.
     */
    @Column(name = "scopes", nullable = false, columnDefinition = "text")
    private String scopes = "[]";

    @Column(name = "token_endpoint", length = 500)
    private String tokenEndpoint;

    @Column(name = "refresh_endpoint", length = 500)
    private String refreshEndpoint;

    /**
     * Domaine de redirection OAuth, saisissable dans le dashboard :
     * l'administrateur peut changer de domaine (https://ai.labibpro.com →
     * https://api.ai.labibpro.com) ou de réseau sans redéployer, exactement
     * comme les identifiants applicatifs. Vide → repli sur
     * {@code APP_PUBLIC_URL} (l'historique).
     */
    @Column(name = "base_redirect_url", length = 500)
    private String baseRedirectUrl;

    /**
     * Chemin de l'endpoint callback, ex : /api/oauth/social/facebook/callback.
     * Vide → chemin par défaut de la plateforme. L'URI finale vaut
     * {@code base_redirect_url + callback_path}.
     */
    @Column(name = "callback_path", length = 300)
    private String callbackPath;

    /** Durée de vie de l'access token, en secondes. */
    @Column(name = "access_token_ttl")
    private Long accessTokenTtl;

    /** Durée de vie du refresh token, en secondes. */
    @Column(name = "refresh_token_ttl")
    private Long refreshTokenTtl;

    /** JSON libre : graphVersion, chunkSize TikTok, ClientType YouTube… */
    @Column(name = "extra_config", nullable = false, columnDefinition = "text")
    private String extraConfig = "{}";

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** Scopes demandés, lus sans faire planter si le JSON est corrompu. */
    @JsonIgnore
    public List<String> scopeList() {
        if (scopes == null || scopes.isBlank()) return new ArrayList<>();
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(scopes,
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /**
     * Une plateforme est « configurée » quand l'administrateur a saisi les
     * identifiants de notre application. Tant que ce n'est pas le cas, les
     * variables d'environnement restent la source de vérité et rien ne casse.
     */
    @JsonIgnore
    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
            && clientSecretEnc != null && !clientSecretEnc.isBlank();
    }
}
