package com.creativeai.auth.repository;

import com.creativeai.auth.model.Entreprise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EntrepriseRepository extends JpaRepository<Entreprise, String> {
    List<Entreprise> findByDeletedFalseAndActiveTrue();
    List<Entreprise> findByDeletedFalse();
    List<Entreprise> findByDeletedTrue();
}
