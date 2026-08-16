package com.creativeai.auth.repository;

import com.creativeai.auth.model.Vente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VenteRepository extends JpaRepository<Vente, String> {
    List<Vente> findByDeletedFalse();
    List<Vente> findByClientIdAndDeletedFalse(String clientId);
    List<Vente> findByDeletedTrue();
}
