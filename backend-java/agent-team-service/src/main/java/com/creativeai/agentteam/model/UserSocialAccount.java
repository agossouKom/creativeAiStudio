package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Un compte social qu'un utilisateur a connecté — appartient à l'UTILISATEUR.
 *
 * Les jetons sont ici, chiffrés, et nulle part ailleurs. La table `channels`
 * (existante) ne garde que le lien : un canal historiquement créé sans cette
 * table continue de publier avec ses propres credentials, ce qui garantit
 * qu'aucune connexion en production n'est invalidée par cette évolution.
 *
 * Piège principal couvert ici : TikTok. Son access token vit 24 heures. Sans
 * `needsRefresh` ni `tokenExpiresAt`, la connexion expire silencieusement et
 * l'utilisateur découvre le problème au moment de publier.
 *
 * Hors {@link BaseEntity} : l'identifiant est un UUID comme dans la migration,
 * et le soft-delete est porté par `deleted` — mais pas d'héritage, pour ne pas
 * hériter d'un `id` String qui ne correspondrait pas à la colonne.
 */
@Entity
@Table(name = "user_social_accounts", indexes = {
    @Index(name = "idx_usa_user",     columnList = "user_id"),
    @Index(name = "idx_usa_platform", columnList = "platform_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserSocialAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    /** Email du propriétaire : même identifiant que agents.owner_id et que le
     *  subject du JWT, donc résoluble sans table users supplémentaire. */
    @Column(name = "user_id", nullable = false, length = 320)
    private String userId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "platform_id", nullable = false)
    private SocialPlatform platform;

    /** Identifiant côté réseau : Page ID, Channel ID, Organization URN, Open ID. */
    @Column(name = "platform_account_id", nullable = false, length = 300)
    private String platformAccountId;

    @Column(name = "platform_account_name", length = 300)
    private String platformAccountName;

    @Column(name = "access_token_enc", columnDefinition = "text")
    @JsonIgnore
    private String accessTokenEnc;

    @Column(name = "refresh_token_enc", columnDefinition = "text")
    @JsonIgnore
    private String refreshTokenEnc;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    /** Ce que l'utilisateur a réellement accordé, qui peut être moins que
     *  ce que la plateforme demande. */
    @Column(name = "scopes_granted", nullable = false, columnDefinition = "text")
    private String scopesGranted = "[]";

    /** JSON libre : igUserId, pageId parente, businessAccountId… */
    @Column(name = "extra_account_data", nullable = false, columnDefinition = "text")
    private String extraAccountData = "{}";

    /** Vrai quand l'access token est court et doit être renouvelé souvent. */
    @Column(name = "needs_refresh", nullable = false)
    private Boolean needsRefresh = false;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "CONNECTED";

    @Column(name = "connected_at", nullable = false)
    private LocalDateTime connectedAt = LocalDateTime.now();

    @Column(name = "last_refreshed_at")
    private LocalDateTime lastRefreshedAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @JsonIgnore
    public List<String> grantedScopeList() {
        if (scopesGranted == null || scopesGranted.isBlank()) return new ArrayList<>();
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(scopesGranted,
                    new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /**
     * Un compte est opérationnel s'il a un jeton, n'est pas explicitement en
     * erreur, et — s'il expire vite — n'est pas déjà périmé.
     */
    @JsonIgnore
    public boolean isUsable() {
        if (accessTokenEnc == null || accessTokenEnc.isBlank()) return false;
        if (!"CONNECTED".equals(status)) return false;
        if (Boolean.TRUE.equals(needsRefresh) && tokenExpiresAt != null
            && tokenExpiresAt.isBefore(LocalDateTime.now())) {
            return false;
        }
        return true;
    }
}
