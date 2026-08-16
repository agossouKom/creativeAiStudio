package com.creativeai.auth.repository;

import com.creativeai.auth.model.GmailToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GmailTokenRepository extends JpaRepository<GmailToken, String> {
    Optional<GmailToken> findByUserId(String userId);
    boolean existsByUserId(String userId);
    void deleteByUserId(String userId);
}
