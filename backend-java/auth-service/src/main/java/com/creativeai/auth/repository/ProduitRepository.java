package com.creativeai.auth.repository;

import com.creativeai.auth.model.Produit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProduitRepository extends JpaRepository<Produit, String> {
    List<Produit> findByDeletedFalse();
    List<Produit> findByDeletedFalseAndActiveTrue();
    List<Produit> findByDeletedTrue();
    List<Produit> findByCategorieIdAndDeletedFalse(String categorieId);
    List<Produit> findByCategorieIdAndDeletedFalseAndActiveTrue(String categorieId);
    boolean existsByLibelleIgnoreCaseAndDeletedFalse(String libelle);
}
