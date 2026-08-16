package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.EntrepriseRequest;
import com.creativeai.auth.dto.response.EntrepriseResponse;
import com.creativeai.auth.dto.response.SocialMediaEntrepriseResponse;
import com.creativeai.auth.model.Entreprise;
import com.creativeai.auth.model.SocialMediaEntreprise;
import com.creativeai.auth.repository.EntrepriseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class EntrepriseService {

    private final EntrepriseRepository repo;

    public EntrepriseResponse create(EntrepriseRequest req) {
        return toResponse(repo.save(buildFromRequest(new Entreprise(), req)));
    }

    public EntrepriseResponse update(String id, EntrepriseRequest req) {
        Entreprise e = getOrThrow(id);
        return toResponse(repo.save(buildFromRequest(e, req)));
    }

    @Transactional(readOnly = true)
    public EntrepriseResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<EntrepriseResponse> findAll(boolean deleted) {
        if (deleted)
            return repo.findByDeletedFalseAndActiveTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalseAndActiveTrue().stream().map(this::toResponse).toList();
    }

    public void delete(String id) {
        Entreprise e = getOrThrow(id);
        e.setDeleted(true);
        e.setActive(false);
        repo.save(e);
    }

    public EntrepriseResponse restore(String id) {
        Entreprise e = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Entreprise introuvable : " + id));
        e.setDeleted(false);
        e.setActive(true);
        return toResponse(repo.save(e));
    }

    private Entreprise buildFromRequest(Entreprise e, EntrepriseRequest req) {
        e.setNom(req.nom());
        e.setRaisonSociale(req.raisonSociale());
        e.setEmail(req.email());
        e.setTelephone(req.telephone());
        e.setAdresse(req.adresse());
        e.setVille(req.ville());
        e.setPays(req.pays());
        e.setSiteWeb(req.siteWeb());
        e.setLogoUrl(req.logoUrl());
        e.setDescription(req.description());
        if (req.active() != null)
            e.setActive(req.active());
        if (req.reseauxSociaux() != null) {
            e.getReseauxSociaux().clear();
            req.reseauxSociaux().forEach(s -> {
                SocialMediaEntreprise sm = new SocialMediaEntreprise();
                sm.setEntreprise(e);
                sm.setPlateforme(s.plateforme());
                sm.setUrl(s.url());
                sm.setIconClass(s.iconClass());
                e.getReseauxSociaux().add(sm);
            });
        }
        return e;
    }

    private Entreprise getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Entreprise introuvable : " + id));
    }

    public EntrepriseResponse toResponse(Entreprise e) {
        List<SocialMediaEntrepriseResponse> sm = e.getReseauxSociaux().stream()
                .map(s -> new SocialMediaEntrepriseResponse(s.getId(), s.getPlateforme(),
                        s.getUrl(), s.getIconClass(), s.isActive(), s.getCreatedAt()))
                .toList();
        return new EntrepriseResponse(e.getId(), e.getNom(), e.getRaisonSociale(), e.getEmail(),
                e.getTelephone(), e.getAdresse(), e.getVille(), e.getPays(), e.getSiteWeb(),
                e.getLogoUrl(), e.getDescription(), e.isActive(), sm, e.getCreatedAt(), e.getUpdatedAt());
    }
}
