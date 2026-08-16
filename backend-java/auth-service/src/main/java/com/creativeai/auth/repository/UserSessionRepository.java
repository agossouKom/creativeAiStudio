package com.creativeai.auth.repository;

import com.creativeai.auth.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, String> {
    List<UserSession> findByUserIdAndRevokedFalse(String userId);
    Optional<UserSession> findByAccessToken(String accessToken);
    List<UserSession> findByUserId(String userId);
}
