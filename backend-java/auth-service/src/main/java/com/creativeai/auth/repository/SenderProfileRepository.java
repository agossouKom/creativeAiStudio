package com.creativeai.auth.repository;

import com.creativeai.auth.model.SenderProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SenderProfileRepository extends JpaRepository<SenderProfile, String> {
    Optional<SenderProfile> findByUserId(String userId);
}
