package com.creativeai.auth.repository;

import com.creativeai.auth.model.Pub;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PubRepository extends JpaRepository<Pub, String> {
    List<Pub> findByDeletedFalse();
    List<Pub> findByDeletedFalseAndActiveTrue();
    List<Pub> findByDeletedTrue();
    List<Pub> findByClientPubIdAndDeletedFalse(String clientPubId);
    /** Currently running ads */
    List<Pub> findByActiveTrueAndDeletedFalseAndDebutBeforeAndFinAfter(
            LocalDateTime now1, LocalDateTime now2);
}
