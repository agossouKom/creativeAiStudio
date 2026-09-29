package com.creativeai.agentteam.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Vue admin d'un compte social connecté, tous utilisateurs confondus.
 *
 * Aucun jeton ne figure dans ce DTO, et il n'y a pas de champ qui pourrait en
 * contenir un. L'administrateur voit « qui a connecté quoi, sur quelle
 * plateforme, et est-ce encore valable » — jamais le secret.
 */
@Data
@Builder
public class SocialAccountResponse {

    private UUID id;
    private String userId;
    private String platformId;
    private String platformName;
    private String platformAccountId;
    private String platformAccountName;
    private List<String> scopesGranted;
    private String status;
    private boolean needsRefresh;
    private boolean usable;
    private LocalDateTime tokenExpiresAt;
    private LocalDateTime connectedAt;
    private LocalDateTime lastRefreshedAt;
    private String lastError;
}
