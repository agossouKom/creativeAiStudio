package com.creativeai.auth.repository;

import com.creativeai.auth.model.LigneVente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LigneVenteRepository extends JpaRepository<LigneVente, String> {
    List<LigneVente> findByVenteId(String venteId);
    List<LigneVente> findByVenteIdAndDeletedFalse(String venteId);
}
