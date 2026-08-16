package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardProduction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CardProductionRepository extends JpaRepository<CardProduction, String> {

    @Query("SELECT p FROM CardProduction p WHERE p.userId = :userId AND p.deleted = false ORDER BY p.createdAt DESC")
    List<CardProduction> findByUserIdOrderByCreatedAtDesc(String userId);

    @Query("SELECT p FROM CardProduction p WHERE p.userId = :userId AND p.entreprise = :entreprise AND p.deleted = false ORDER BY p.createdAt DESC")
    List<CardProduction> findByUserIdAndEntreprise(String userId, String entreprise);
}
