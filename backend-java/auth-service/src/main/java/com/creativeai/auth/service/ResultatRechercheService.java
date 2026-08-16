package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.ResultatRechercheRequest;
import com.creativeai.auth.dto.response.ResultatRechercheResponse;
import com.creativeai.auth.model.ResultatRecherche;
import com.creativeai.auth.model.enums.Abonnement;
import com.creativeai.auth.model.enums.MediaType;
import com.creativeai.auth.repository.ResultatRechercheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ResultatRechercheService {

    private final ResultatRechercheRepository repo;

    public ResultatRechercheResponse create(ResultatRechercheRequest req) {
        return toResponse(repo.save(buildFromRequest(new ResultatRecherche(), req)), null);
    }

    public ResultatRechercheResponse update(String id, ResultatRechercheRequest req) {
        ResultatRecherche r = getOrThrow(id);
        return toResponse(repo.save(buildFromRequest(r, req)), null);
    }

    @Transactional(readOnly = true)
    public ResultatRechercheResponse findById(String id, Abonnement abonnement) {
        return toResponse(getOrThrow(id), abonnement);
    }

    @Transactional(readOnly = true)
    public List<ResultatRechercheResponse> findAll(boolean deleted, Abonnement abonnement) {
        if (deleted) return repo.findByDeletedTrue().stream().map(r -> toResponse(r, abonnement)).toList();
        return repo.findByDeletedFalse().stream().map(r -> toResponse(r, abonnement)).toList();
    }

    @Transactional(readOnly = true)
    public List<ResultatRechercheResponse> findByMediaType(MediaType type, Abonnement abonnement) {
        return repo.findByMediaTypeAndDeletedFalseAndActiveTrue(type).stream()
                .map(r -> toResponse(r, abonnement)).toList();
    }

    @Transactional(readOnly = true)
    public List<ResultatRechercheResponse> search(String query, Abonnement abonnement) {
        List<ResultatRecherche> byTitle = repo.findByTitreContainingIgnoreCaseAndDeletedFalse(query);
        List<ResultatRecherche> byAuteur = repo.findByAuteurContainingIgnoreCaseAndDeletedFalse(query);
        List<ResultatRecherche> combined = new ArrayList<>(byTitle);
        byAuteur.stream().filter(r -> combined.stream().noneMatch(x -> x.getId().equals(r.getId())))
                .forEach(combined::add);
        return combined.stream().map(r -> toResponse(r, abonnement)).toList();
    }

    public void delete(String id) { ResultatRecherche r = getOrThrow(id); r.setDeleted(true); r.setActive(false); repo.save(r); }

    public ResultatRechercheResponse restore(String id) {
        ResultatRecherche r = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Résultat introuvable : " + id));
        r.setDeleted(false); r.setActive(true);
        return toResponse(repo.save(r), null);
    }

    private ResultatRecherche buildFromRequest(ResultatRecherche r, ResultatRechercheRequest req) {
        r.setMediaType(req.mediaType()); r.setAuteur(req.auteur()); r.setTitre(req.titre());
        r.setAnneeSortie(req.anneeSortie()); r.setGenre(req.genre()); r.setImageUrl(req.imageUrl());
        r.setTexteParoles(req.texteParoles());
        r.setPlateformesStreaming(req.plateformesStreaming() != null ? new ArrayList<>(req.plateformesStreaming()) : new ArrayList<>());
        r.setLienTelechargement(req.lienTelechargement()); r.setFormat(req.format());
        r.setNom(req.nom()); r.setPrenom(req.prenom()); r.setMetier(req.metier());
        r.setContact(req.contact()); r.setDomicile(req.domicile()); r.setReseauxSociaux(req.reseauxSociaux());
        r.setPays(req.pays()); r.setVille(req.ville());
        if (req.active() != null) r.setActive(req.active());
        return r;
    }

    private ResultatRecherche getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Résultat introuvable : " + id));
    }

    /** Mask lienTelechargement for FREE subscribers */
    public ResultatRechercheResponse toResponse(ResultatRecherche r, Abonnement abonnement) {
        boolean hasPremium = abonnement != null && abonnement != Abonnement.FREE;
        return new ResultatRechercheResponse(r.getId(), r.getMediaType(), r.getAuteur(), r.getTitre(),
                r.getAnneeSortie(), r.getGenre(), r.getImageUrl(), r.getTexteParoles(),
                r.getPlateformesStreaming(), hasPremium ? r.getLienTelechargement() : null,
                r.getFormat(), r.getNom(), r.getPrenom(), r.getMetier(), r.getContact(),
                r.getDomicile(), r.getReseauxSociaux(), r.getPays(), r.getVille(),
                r.isActive(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
