package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.CategorieRequest;
import com.creativeai.auth.dto.response.CategorieResponse;
import com.creativeai.auth.model.Categorie;
import com.creativeai.auth.repository.CategorieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CategorieService {

    private final CategorieRepository repo;

    public CategorieResponse create(CategorieRequest req) {
        if (repo.existsByLibelleIgnoreCase(req.libelle()))
            throw new IllegalArgumentException("Catégorie déjà existante : " + req.libelle());
        Categorie entity = Categorie.builder()
                .libelle(req.libelle())
                .active(req.active() == null || req.active())
                .build();
        return toResponse(repo.save(entity));
    }

    public CategorieResponse update(String id, CategorieRequest req) {
        Categorie entity = getOrThrow(id);
        entity.setLibelle(req.libelle());
        if (req.active() != null) entity.setActive(req.active());
        return toResponse(repo.save(entity));
    }

    @Transactional(readOnly = true)
    public CategorieResponse findById(String id) { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<CategorieResponse> findAll(Boolean deleted) {
        if (deleted == null) return repo.findAll().stream().map(this::toResponse).toList();
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    public List<CategorieResponse> createBulk(List<String> libelles) {
        return libelles.stream()
                .filter(l -> l != null && !l.isBlank())
                .map(String::trim)
                .map(this::findOrCreate)
                .map(this::toResponse)
                .toList();
    }

    /** Soft-delete */
    public void delete(String id) {
        Categorie entity = getOrThrow(id);
        entity.setDeleted(true);
        entity.setActive(false);
        repo.save(entity);
    }

    /** Restore a soft-deleted record */
    public CategorieResponse restore(String id) {
        Categorie entity = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable : " + id));
        entity.setDeleted(false);
        entity.setActive(true);
        return toResponse(repo.save(entity));
    }

    private Categorie getOrThrow(String id) {
        return repo.findById(id)
                .filter(c -> !c.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable : " + id));
    }

    public CategorieResponse toResponse(Categorie c) {
        return new CategorieResponse(c.getId(), c.getLibelle(), c.isActive(),
                c.isDeleted(), c.getCreatedAt(), c.getUpdatedAt());
    }

    /** Quick-add: find or create by libelle */
    public Categorie findOrCreate(String libelle) {
        return repo.findByLibelleIgnoreCase(libelle)
                .orElseGet(() -> repo.save(Categorie.builder().libelle(libelle).active(true).build()));
    }
}
