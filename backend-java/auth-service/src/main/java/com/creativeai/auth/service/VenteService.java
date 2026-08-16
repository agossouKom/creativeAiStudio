package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.VenteRequest;
import com.creativeai.auth.dto.response.LigneVenteResponse;
import com.creativeai.auth.dto.response.VenteResponse;
import com.creativeai.auth.model.LigneVente;
import com.creativeai.auth.model.Produit;
import com.creativeai.auth.model.User;
import com.creativeai.auth.model.Vente;
import com.creativeai.auth.repository.ProduitRepository;
import com.creativeai.auth.repository.UserRepository;
import com.creativeai.auth.repository.VenteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class VenteService {

    private final VenteRepository repo;
    private final UserRepository userRepo;
    private final ProduitRepository produitRepo;

    public VenteResponse create(VenteRequest req) {
        User client = userRepo.findById(req.clientId())
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + req.clientId()));

        Vente vente = new Vente();
        vente.setClient(client);
        vente.setLignes(new ArrayList<>());

        BigDecimal total = BigDecimal.ZERO;
        int qtyTotal = 0;

        for (var lr : req.lignes()) {
            Produit p = produitRepo.findById(lr.produitId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable : " + lr.produitId()));
            LigneVente ligne = new LigneVente();
            ligne.setVente(vente);
            ligne.setProduit(p);
            ligne.setQuantite(lr.quantite());
            ligne.setPrixUnitaire(p.getPrix());
            ligne.setSousTotal(p.getPrix().multiply(BigDecimal.valueOf(lr.quantite())));
            vente.getLignes().add(ligne);
            total = total.add(ligne.getSousTotal());
            qtyTotal += lr.quantite();
        }
        vente.setTotal(total);
        vente.setMontant(total);  // no discount by default
        vente.setQuantite(qtyTotal);
        if (req.paymentMode() != null) {
            vente.setPaymentMode(req.paymentMode());
        }

        return toResponse(repo.save(vente));
    }

    @Transactional(readOnly = true)
    public VenteResponse findById(String id) { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<VenteResponse> findAll(boolean deleted) {
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<VenteResponse> findByClient(String clientId) {
        return repo.findByClientIdAndDeletedFalse(clientId).stream().map(this::toResponse).toList();
    }

    public void delete(String id) { Vente v = getOrThrow(id); v.setDeleted(true); repo.save(v); }

    public VenteResponse restore(String id) {
        Vente v = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Vente introuvable : " + id));
        v.setDeleted(false);
        return toResponse(repo.save(v));
    }

    private Vente getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Vente introuvable : " + id));
    }

    public VenteResponse toResponse(Vente v) {
        List<LigneVenteResponse> lignes = v.getLignes().stream().map(l ->
                new LigneVenteResponse(l.getId(), l.getProduit().getId(),
                        l.getProduit().getLibelle(), l.getQuantite(),
                        l.getPrixUnitaire(), l.getSousTotal())).toList();
        return new VenteResponse(v.getId(),
                v.getClient().getId(), v.getClient().getFullName(),
                lignes, v.getTotal(), v.getMontant(), v.getQuantite(), v.getPaymentMode(), v.getCreatedAt());
    }
}
