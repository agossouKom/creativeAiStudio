package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.SocialPlatform;
import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Vue d'une plateforme pour le dashboard admin.
 *
 * Le champ `clientSecret` n'existe pas ici, volontairement : la réponse ne peut
 * donc pas le contenir, quelle que soit la façon dont elle est sérialisée. On
 * expose seulement `clientSecretConfigured`, ce qui suffit à l'écran pour
 * savoir s'il reste à le saisir.
 */
@Data
@Builder
public class SocialPlatformResponse {

    private String id;
    private String displayName;
    private String authType;
    private String clientId;
    private boolean clientSecretConfigured;
    private List<String> scopes;
    private String tokenEndpoint;
    private String refreshEndpoint;
    private String baseRedirectUrl;
    private String callbackPath;
    private Long accessTokenTtl;
    private Long refreshTokenTtl;
    private String extraConfig;
    private boolean isActive;
    private Integer sortOrder;
    /** Combien d'utilisateurs ont connecté un compte sur cette plateforme. */
    private long connectedAccounts;
    /** La plateforme est-elle réellement utilisable pour lancer un OAuth. */
    private boolean configured;

    public static SocialPlatformResponse from(SocialPlatform sp, long connectedAccounts,
                                             boolean configured) {
        return SocialPlatformResponse.builder()
            .id(sp.getId())
            .displayName(sp.getDisplayName())
            .authType(sp.getAuthType())
            .clientId(sp.getClientId())
            .clientSecretConfigured(sp.getClientSecretEnc() != null
                && !sp.getClientSecretEnc().isBlank())
            .scopes(sp.scopeList())
            .tokenEndpoint(sp.getTokenEndpoint())
            .refreshEndpoint(sp.getRefreshEndpoint())
            .baseRedirectUrl(sp.getBaseRedirectUrl())
            .callbackPath(sp.getCallbackPath())
            .accessTokenTtl(sp.getAccessTokenTtl())
            .refreshTokenTtl(sp.getRefreshTokenTtl())
            .extraConfig(sp.getExtraConfig())
            .isActive(Boolean.TRUE.equals(sp.getIsActive()))
            .sortOrder(sp.getSortOrder())
            .connectedAccounts(connectedAccounts)
            .configured(configured)
            .build();
    }
}
