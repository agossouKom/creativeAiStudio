package com.creativeai.agentteam.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Saisie admin d'une plateforme sociale.
 *
 * `clientSecret` est en écriture seule : s'il est absent ou vide lors d'une
 * modification, le secret déjà enregistré est conservé. C'est ce qui permet à
 * l'administrateur de corriger les scopes ou un libellé sans ressaisir — et
 * sans lui faire relire — le secret de l'application.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialPlatformRequest {

    @NotBlank(message = "L'identifiant technique est obligatoire")
    private String id;

    @NotBlank(message = "Le nom affiché est obligatoire")
    private String displayName;

    private String authType;

    private String clientId;

    /** Écriture seule : null ou vide = ne pas modifier le secret existant. */
    private String clientSecret;

    private List<String> scopes;

    private String tokenEndpoint;

    private String refreshEndpoint;

    /**
     * Domaine public de redirection OAuth (ex : https://api.ai.labibpro.com).
     * Vide → repli sur APP_PUBLIC_URL pour la plateforme.
     */
    private String baseRedirectUrl;

    /**
     * Chemin du callback OAuth (ex : /api/oauth/social/facebook/callback).
     * Vide → chemin par défaut de la plateforme.
     */
    private String callbackPath;

    private Long accessTokenTtl;

    private Long refreshTokenTtl;

    private String extraConfig;

    private Boolean isActive;

    private Integer sortOrder;
}
