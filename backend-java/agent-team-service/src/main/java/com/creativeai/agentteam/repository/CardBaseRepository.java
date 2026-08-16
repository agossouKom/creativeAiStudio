package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardBase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CardBaseRepository extends JpaRepository<CardBase, String> {

    List<CardBase> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId);

    List<CardBase> findByUserIdAndCategoryAndDeletedFalseOrderByCreatedAtDesc(String userId, String category);

    Optional<CardBase> findByIdAndUserIdAndDeletedFalse(String id, String userId);
}
