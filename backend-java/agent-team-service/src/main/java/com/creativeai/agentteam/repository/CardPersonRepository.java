package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.CardPerson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface CardPersonRepository extends JpaRepository<CardPerson, String> {

    List<CardPerson> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId);

    List<CardPerson> findByUserIdAndCategoryAndDeletedFalseOrderByCreatedAtDesc(
            String userId, String category);

    List<CardPerson> findByUserIdAndEntrepriseAndDeletedFalseOrderByCreatedAtDesc(
            String userId, String entreprise);

    List<CardPerson> findByUserIdAndCategoryAndEntrepriseAndDeletedFalseOrderByCreatedAtDesc(
            String userId, String category, String entreprise);

    Optional<CardPerson> findByIdAndUserIdAndDeletedFalse(String id, String userId);

    @Query("SELECT DISTINCT p.entreprise FROM CardPerson p WHERE p.userId = :userId AND p.deleted = false AND p.entreprise IS NOT NULL ORDER BY p.entreprise")
    List<String> findDistinctEntreprisesByUserId(String userId);

    @Query("SELECT DISTINCT p.entreprise FROM CardPerson p WHERE p.userId = :userId AND p.category = :category AND p.deleted = false AND p.entreprise IS NOT NULL ORDER BY p.entreprise")
    List<String> findDistinctEntreprisesByUserIdAndCategory(String userId, String category);

    @Modifying
    @Transactional
    @Query("UPDATE CardPerson p SET p.deleted = true WHERE p.userId = :userId AND p.deleted = false")
    void softDeleteAllByUserId(String userId);

    long countByUserIdAndCategoryAndDeletedFalse(String userId, String category);
}
