package com.creativeai.auth.repository;

import com.creativeai.auth.model.Categorie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategorieRepository extends JpaRepository<Categorie, String> {
    List<Categorie> findByDeletedFalse();
    List<Categorie> findByDeletedFalseAndActiveTrue();
    List<Categorie> findByDeletedTrue();
    Optional<Categorie> findByLibelleIgnoreCase(String libelle);
    boolean existsByLibelleIgnoreCase(String libelle);
}
