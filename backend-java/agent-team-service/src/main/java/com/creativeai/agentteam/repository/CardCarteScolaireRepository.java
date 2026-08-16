package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardCarteScolaire;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardCarteScolaireRepository extends JpaRepository<CardCarteScolaire, String> {
    List<CardCarteScolaire> findByBaseUserIdAndBaseDeletedFalseOrderByBaseCreatedAtDesc(String userId);
    Optional<CardCarteScolaire> findByIdAndBaseUserIdAndBaseDeletedFalse(String id, String userId);
}
