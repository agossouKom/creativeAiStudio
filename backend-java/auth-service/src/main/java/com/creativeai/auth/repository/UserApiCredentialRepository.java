package com.creativeai.auth.repository;

import com.creativeai.auth.model.UserApiCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserApiCredentialRepository extends JpaRepository<UserApiCredential, String> {
    Optional<UserApiCredential> findByUserIdAndProviderAndActiveTrue(String userId, String provider);
    List<UserApiCredential>     findByUserIdAndActiveTrueAndDeletedFalse(String userId);
    boolean existsByUserIdAndProviderAndDeletedFalse(String userId, String provider);
}
