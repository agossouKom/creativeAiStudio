package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardBadgeEvenement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardBadgeEvenementRepository extends JpaRepository<CardBadgeEvenement, String> {
    List<CardBadgeEvenement> findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(String userId);
    Optional<CardBadgeEvenement> findByIdAndBaseUserIdAndBaseDeletedFalse(String id, String userId);
}
