package com.creativeai.auth.repository;

import com.creativeai.auth.model.ResultatRecherche;
import com.creativeai.auth.model.enums.MediaType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResultatRechercheRepository extends JpaRepository<ResultatRecherche, String> {
    List<ResultatRecherche> findByDeletedFalse();
    List<ResultatRecherche> findByDeletedTrue();
    List<ResultatRecherche> findByDeletedFalseAndActiveTrue();
    List<ResultatRecherche> findByMediaTypeAndDeletedFalseAndActiveTrue(MediaType mediaType);
    List<ResultatRecherche> findByTitreContainingIgnoreCaseAndDeletedFalse(String titre);
    List<ResultatRecherche> findByAuteurContainingIgnoreCaseAndDeletedFalse(String auteur);
}
