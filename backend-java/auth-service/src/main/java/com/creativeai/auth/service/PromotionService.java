package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.PromotionRequest;
import com.creativeai.auth.dto.response.PromotionResponse;
import com.creativeai.auth.model.Produit;
import com.creativeai.auth.model.Promotion;
import com.creativeai.auth.repository.ProduitRepository;
import com.creativeai.auth.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PromotionService {

    private final PromotionRepository repo;
    private final ProduitRepository produitRepo;
    private final ProduitService produitService;

    public PromotionResponse create(PromotionRequest req) {
        return toResponse(repo.save(buildFromRequest(new Promotion(), req)));
    }

    public PromotionResponse update(String id, PromotionRequest req) {
        Promotion p = getOrThrow(id);
        return toResponse(repo.save(buildFromRequest(p, req)));
    }

    @Transactional(readOnly = true)
    public PromotionResponse findById(String id)        { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<PromotionResponse> findAll(boolean deleted) {
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> findCurrent() {
        LocalDateTime now = LocalDateTime.now();
        return repo.findByActiveTrueAndDeletedFalseAndDateDebutBeforeAndDateFinAfter(now, now)
                .stream().map(this::toResponse).toList();
    }

    public void delete(String id) { Promotion p = getOrThrow(id); p.setDeleted(true); p.setActive(false); repo.save(p); }

    public PromotionResponse restore(String id) {
        Promotion p = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Promotion introuvable : " + id));
        p.setDeleted(false); p.setActive(true);
        return toResponse(repo.save(p));
    }

    private Promotion buildFromRequest(Promotion p, PromotionRequest req) {
        List<Produit> produits = new ArrayList<>();
        if (req.produitIds() != null) {
            for (String pid : req.produitIds()) {
                produits.add(produitRepo.findById(pid)
                        .orElseThrow(() -> new IllegalArgumentException("Produit introuvable : " + pid)));
            }
        }
        p.setLibelle(req.libelle());
        p.setDateDebut(req.dateDebut());
        p.setDateFin(req.dateFin());
        p.setProduits(produits);
        p.setPrixPromo(req.prixPromo());
        if (req.active() != null) p.setActive(req.active());
        return p;
    }

    private Promotion getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Promotion introuvable : " + id));
    }

    public PromotionResponse toResponse(Promotion p) {
        return new PromotionResponse(p.getId(), p.getLibelle(), p.getDateDebut(), p.getDateFin(),
                p.getProduits().stream().map(produitService::toResponse).toList(),
                p.getPrixPromo(), p.isActive(), p.isDeleted(), p.getCreatedAt(), p.getUpdatedAt());
    }
}
