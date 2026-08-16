package com.creativeai.auth.repository;

import com.creativeai.auth.model.Fonction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FonctionRepository extends JpaRepository<Fonction, String> {
    List<Fonction> findByDeletedFalse();
    List<Fonction> findByDeletedFalseAndActiveTrue();
    List<Fonction> findByDeletedTrue();
    Optional<Fonction> findByLibelleIgnoreCase(String libelle);
    boolean existsByLibelleIgnoreCase(String libelle);
}
