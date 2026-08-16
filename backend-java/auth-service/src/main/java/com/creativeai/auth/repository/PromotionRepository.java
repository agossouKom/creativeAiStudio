package com.creativeai.auth.repository;

import com.creativeai.auth.model.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, String> {
    List<Promotion> findByDeletedFalse();
    List<Promotion> findByDeletedFalseAndActiveTrue();
    List<Promotion> findByDeletedTrue();
    /** Active promotions currently running */
    List<Promotion> findByActiveTrueAndDeletedFalseAndDateDebutBeforeAndDateFinAfter(
            LocalDateTime now1, LocalDateTime now2);
}
