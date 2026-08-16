package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardDesign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CardDesignRepository extends JpaRepository<CardDesign, String> {

    List<CardDesign> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId);

    List<CardDesign> findByUserIdAndCategoryAndDeletedFalseOrderByCreatedAtDesc(String userId, String category);

    Optional<CardDesign> findByIdAndUserIdAndDeletedFalse(String id, String userId);

    @Modifying
    @Query("UPDATE CardDesign c SET c.deleted = true WHERE c.userId = :userId AND c.deleted = false")
    void softDeleteAllByUserId(String userId);
}
