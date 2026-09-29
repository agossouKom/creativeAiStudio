package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.UserSocialAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSocialAccountRepository extends JpaRepository<UserSocialAccount, UUID> {

    List<UserSocialAccount> findByUserIdAndDeletedFalse(String userId);

    Optional<UserSocialAccount> findByUserIdAndPlatform_IdAndPlatformAccountIdAndDeletedFalse(
        String userId, String platformId, String platformAccountId);

    long countByPlatform_IdAndDeletedFalse(String platformId);

    long countByDeletedFalse();

    long countByNeedsRefreshTrueAndTokenExpiresAtBeforeAndDeletedFalse(
        LocalDateTime limite);

    /** Vue admin paginée sur tous les comptes, tous utilisateurs confondus. */
    @org.springframework.data.jpa.repository.Query("""
        SELECT a FROM UserSocialAccount a
        WHERE a.deleted = false
          AND (:platformId IS NULL OR a.platform.id = :platformId)
          AND (:userId IS NULL OR a.userId = :userId)
        ORDER BY a.connectedAt DESC
        """)
    Page<UserSocialAccount> search(@org.springframework.data.repository.query.Param("platformId") String platformId,
                                   @org.springframework.data.repository.query.Param("userId") String userId,
                                   Pageable pageable);

    /**
     * Comptes Facebook/Instagram dont le Meta user id (app-scoped) correspond à
     * celui que Meta renvoie au webhook deauthorize. C'est par ce mapping que
     * la suppression de l'app dans les réglages Meta aboutit à la révocation de
     * nos jetons — exigence du cahier des charges RGPD de Meta.
     */
    @org.springframework.data.jpa.repository.Query(value = """
        SELECT * FROM user_social_accounts
        WHERE deleted = false
          AND platform_id = :platformId
          AND extra_account_data IS NOT NULL
          AND cast(extra_account_data as jsonb)->>'metaUserId' = :metaUserId
        """, nativeQuery = true)
    List<UserSocialAccount> findByMetaUserId(@org.springframework.data.repository.query.Param("platformId") String platformId,
                                             @org.springframework.data.repository.query.Param("metaUserId") String metaUserId);

    @org.springframework.data.jpa.repository.Query("""
        SELECT a FROM UserSocialAccount a
        WHERE a.deleted = false
          AND a.status <> 'DISCONNECTED'
          AND (a.needsRefresh = true
               OR (a.tokenExpiresAt IS NOT NULL AND a.tokenExpiresAt < :soon))
        ORDER BY a.tokenExpiresAt ASC
        """)
    List<UserSocialAccount> findRefreshCandidates(@org.springframework.data.repository.query.Param("soon") LocalDateTime soon);
}
