package com.creativeai.auth.repository;

import com.creativeai.auth.model.Otp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OtpRepository extends JpaRepository<Otp, String> {
    Optional<Otp> findTopByEmailAndCodeAndUsedFalseOrderByCreatedAtDesc(String email, String code);
    void deleteByEmailAndUsedTrue(String email);
}
