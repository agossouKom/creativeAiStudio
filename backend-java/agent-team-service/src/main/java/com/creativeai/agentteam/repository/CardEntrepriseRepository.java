package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardEntreprise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardEntrepriseRepository extends JpaRepository<CardEntreprise, String> {

    List<CardEntreprise> findByUserIdAndDeletedFalseOrderByRaisonSocialAsc(String userId);

    Optional<CardEntreprise> findByIdAndUserIdAndDeletedFalse(String id, String userId);
}
