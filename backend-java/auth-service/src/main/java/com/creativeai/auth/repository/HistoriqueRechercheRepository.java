package com.creativeai.auth.repository;

import com.creativeai.auth.model.HistoriqueRecherche;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistoriqueRechercheRepository extends JpaRepository<HistoriqueRecherche, String> {
    List<HistoriqueRecherche> findByClientIdAndDeletedFalse(String clientId);
    List<HistoriqueRecherche> findByClientIdAndFoundTrueAndDeletedFalse(String clientId);
    List<HistoriqueRecherche> findByClientIdAndFoundFalseAndDeletedFalse(String clientId);
    List<HistoriqueRecherche> findByDeletedFalse();
    List<HistoriqueRecherche> findByDeletedTrue();
}
