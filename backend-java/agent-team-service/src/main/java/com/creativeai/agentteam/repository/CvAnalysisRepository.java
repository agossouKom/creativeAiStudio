package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CvAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CvAnalysisRepository extends JpaRepository<CvAnalysis, String> {

    @Query("SELECT c FROM CvAnalysis c WHERE c.userId = :userId AND c.deleted = false ORDER BY c.analyzedAt DESC")
    List<CvAnalysis> findByUserId(String userId);

    @Query("SELECT c FROM CvAnalysis c WHERE c.userId = :userId AND c.id = :id AND c.deleted = false")
    Optional<CvAnalysis> findByIdAndUserId(String id, String userId);

    @Modifying
    @Query("UPDATE CvAnalysis c SET c.deleted = true WHERE c.userId = :userId AND c.deleted = false")
    void softDeleteAllByUserId(String userId);
}
