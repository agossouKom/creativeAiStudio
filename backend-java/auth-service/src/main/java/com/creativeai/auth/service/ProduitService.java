package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.ProduitRequest;
import com.creativeai.auth.dto.response.ProduitFonctionResponse;
import com.creativeai.auth.dto.response.ProduitResponse;
import com.creativeai.auth.model.Categorie;
import com.creativeai.auth.model.Fonction;
import com.creativeai.auth.model.Produit;
import com.creativeai.auth.model.ProduitFonction;
import com.creativeai.auth.repository.CategorieRepository;
import com.creativeai.auth.repository.FonctionRepository;
import com.creativeai.auth.repository.ProduitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ProduitService {

    private final ProduitRepository repo;
    private final CategorieService categorieService;
    private final FonctionService fonctionService;
    private final CategorieRepository categorieRepo;
    private final FonctionRepository fonctionRepo;

    public ProduitResponse create(ProduitRequest req) {
        Produit p = buildFromRequest(new Produit(), req);
        return toResponse(repo.save(p));
    }

    public ProduitResponse update(String id, ProduitRequest req) {
        Produit p = getOrThrow(id);
        buildFromRequest(p, req);
        return toResponse(repo.save(p));
    }

    @Transactional(readOnly = true)
    public ProduitResponse findById(String id) { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<ProduitResponse> findAll(boolean deleted) {
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ProduitResponse> findByCategorie(String categorieId) {
        return repo.findByCategorieIdAndDeletedFalse(categorieId).stream().map(this::toResponse).toList();
    }

    public void delete(String id) { Produit p = getOrThrow(id); p.setDeleted(true); p.setActive(false); repo.save(p); }

    public ProduitResponse restore(String id) {
        Produit p = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Produit introuvable : " + id));
        p.setDeleted(false); p.setActive(true);
        return toResponse(repo.save(p));
    }

    private Produit buildFromRequest(Produit p, ProduitRequest req) {
        // Resolve Categorie
        Categorie cat = null;
        if (req.categorieId() != null) {
            cat = categorieRepo.findById(req.categorieId())
                    .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable : " + req.categorieId()));
        } else if (req.categorieLibelle() != null) {
            cat = categorieService.findOrCreate(req.categorieLibelle());
        }
        p.setCategorie(cat);
        p.setLibelle(req.libelle());
        p.setPrix(req.prix());
        p.setUrlImage(req.urlImage());
        if (req.active() != null) p.setActive(req.active());

        // Manage ProduitFonctions (Join Table)
        List<ProduitFonction> mappings = new ArrayList<>();
        
        // 1. Existing Fonctions by ID
        if (req.fonctionIds() != null) {
            for (String fid : req.fonctionIds()) {
                Fonction f = fonctionRepo.findById(fid)
                        .orElseThrow(() -> new IllegalArgumentException("Fonction introuvable : " + fid));
                
                boolean isDisponible = req.disponibleFonctionIds() != null && req.disponibleFonctionIds().contains(fid);
                
                mappings.add(ProduitFonction.builder()
                        .produit(p)
                        .fonction(f)
                        .disponible(isDisponible)
                        .build());
            }
        }
        
        // 2. Quick Add Fonctions
        if (req.fonctionLibelles() != null) {
            for (String lib : req.fonctionLibelles()) {
                Fonction f = fonctionService.findOrCreate(lib);
                // By default quick-added ones are available
                mappings.add(ProduitFonction.builder()
                        .produit(p)
                        .fonction(f)
                        .disponible(true)
                        .build());
            }
        }

        // Clear and update the collection (orphanRemoval will handle deletes)
        p.getProduitFonctions().clear();
        p.getProduitFonctions().addAll(mappings);

        return p;
    }

    private Produit getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable : " + id));
    }

    public ProduitResponse toResponse(Produit p) {
        List<ProduitFonctionResponse> fonctions = p.getProduitFonctions().stream()
                .map(pf -> new ProduitFonctionResponse(
                        pf.getFonction().getId(),
                        pf.getFonction().getLibelle(),
                        pf.getFonction().isActive(),
                        pf.isDisponible(),
                        pf.getFonction().getCreatedAt()
                )).toList();

        return new ProduitResponse(
                p.getId(),
                p.getCategorie() != null ? p.getCategorie().getId() : null,
                p.getCategorie() != null ? p.getCategorie().getLibelle() : null,
                p.getLibelle(), p.getPrix(),
                fonctions,
                p.getUrlImage(), p.isActive(), p.isDeleted(), p.getCreatedAt(), p.getUpdatedAt());
    }
}
