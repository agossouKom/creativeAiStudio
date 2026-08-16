package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.FonctionRequest;
import com.creativeai.auth.dto.response.FonctionResponse;
import com.creativeai.auth.model.Fonction;
import com.creativeai.auth.repository.FonctionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class FonctionService {

    private final FonctionRepository repo;

    public FonctionResponse create(FonctionRequest req) {
        if (repo.existsByLibelleIgnoreCase(req.libelle()))
            throw new IllegalArgumentException("Fonction déjà existante : " + req.libelle());
        return toResponse(repo.save(Fonction.builder()
                .libelle(req.libelle())
                .active(req.active() == null || req.active())
                .build()));
    }

    public FonctionResponse update(String id, FonctionRequest req) {
        Fonction f = getOrThrow(id);
        f.setLibelle(req.libelle());
        if (req.active() != null) f.setActive(req.active());
        return toResponse(repo.save(f));
    }

    @Transactional(readOnly = true)
    public FonctionResponse findById(String id) { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<FonctionResponse> findAll(Boolean deleted) {
        if (deleted == null) return repo.findAll().stream().map(this::toResponse).toList();
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    public List<FonctionResponse> createBulk(List<String> libelles) {
        return libelles.stream()
                .filter(l -> l != null && !l.isBlank())
                .map(String::trim)
                .map(this::findOrCreate)
                .map(this::toResponse)
                .toList();
    }

    public void delete(String id)  { Fonction f = getOrThrow(id); f.setDeleted(true); f.setActive(false); repo.save(f); }

    public FonctionResponse restore(String id) {
        Fonction f = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Fonction introuvable : " + id));
        f.setDeleted(false); f.setActive(true);
        return toResponse(repo.save(f));
    }

    private Fonction getOrThrow(String id) {
        return repo.findById(id).filter(f -> !f.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Fonction introuvable : " + id));
    }

    public FonctionResponse toResponse(Fonction f) {
        return new FonctionResponse(f.getId(), f.getLibelle(), f.isActive(),
                f.isDeleted(), f.getCreatedAt(), f.getUpdatedAt());
    }

    /** Quick-add: find or create by libelle */
    public Fonction findOrCreate(String libelle) {
        return repo.findByLibelleIgnoreCase(libelle)
                .orElseGet(() -> repo.save(Fonction.builder().libelle(libelle).active(true).build()));
    }
}
