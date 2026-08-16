package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardBadgeIdentite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardBadgeIdentiteRepository extends JpaRepository<CardBadgeIdentite, String> {
    List<CardBadgeIdentite> findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(String userId);
    Optional<CardBadgeIdentite> findByIdAndBaseUserIdAndBaseDeletedFalse(String id, String userId);
}
