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
}
