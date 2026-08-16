package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardCarteVisite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardCarteVisiteRepository extends JpaRepository<CardCarteVisite, String> {
    List<CardCarteVisite> findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(String userId);
    Optional<CardCarteVisite> findByIdAndBaseUserIdAndBaseDeletedFalse(String id, String userId);
}
