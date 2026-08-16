package com.creativeai.auth.repository;

import com.creativeai.auth.model.ClientPub;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientPubRepository extends JpaRepository<ClientPub, String> {
    List<ClientPub> findByDeletedFalse();
    List<ClientPub> findByDeletedFalseAndActiveTrue();
    List<ClientPub> findByDeletedTrue();
    Optional<ClientPub> findByEmail(String email);
    boolean existsByEmail(String email);
}
