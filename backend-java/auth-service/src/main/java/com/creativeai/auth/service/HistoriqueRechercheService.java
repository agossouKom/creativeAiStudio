package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.HistoriqueRechercheRequest;
import com.creativeai.auth.dto.response.HistoriqueRechercheResponse;
import com.creativeai.auth.model.HistoriqueRecherche;
import com.creativeai.auth.model.ResultatRecherche;
import com.creativeai.auth.model.User;
import com.creativeai.auth.repository.HistoriqueRechercheRepository;
import com.creativeai.auth.repository.ResultatRechercheRepository;
import com.creativeai.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class HistoriqueRechercheService {

    private final HistoriqueRechercheRepository repo;
    private final UserRepository userRepo;
    private final ResultatRechercheRepository resultatRepo;

    public HistoriqueRechercheResponse create(HistoriqueRechercheRequest req) {
        User client = userRepo.findById(req.clientId())
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + req.clientId()));

        ResultatRecherche resultat = null;
        if (req.resultatId() != null) {
            resultat = resultatRepo.findById(req.resultatId())
                    .orElseThrow(() -> new IllegalArgumentException("Résultat introuvable : " + req.resultatId()));
        }

        HistoriqueRecherche h = HistoriqueRecherche.builder()
                .client(client)
                .resultat(resultat)
                .requete(req.requete())
                .found(req.found())
                .build();

        return toResponse(repo.save(h));
    }

    @Transactional(readOnly = true)
    public HistoriqueRechercheResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<HistoriqueRechercheResponse> findAll(boolean deleted) {
        if (deleted)
            return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    public HistoriqueRechercheResponse restore(String id) {
        HistoriqueRecherche h = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Historique introuvable : " + id));
        h.setDeleted(false);
        return toResponse(repo.save(h));
    }

    @Transactional(readOnly = true)
    public List<HistoriqueRechercheResponse> findByClient(String clientId) {
        return repo.findByClientIdAndDeletedFalse(clientId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<HistoriqueRechercheResponse> findByClientFound(String clientId) {
        return repo.findByClientIdAndFoundTrueAndDeletedFalse(clientId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<HistoriqueRechercheResponse> findByClientNotFound(String clientId) {
        return repo.findByClientIdAndFoundFalseAndDeletedFalse(clientId).stream().map(this::toResponse).toList();
    }

    /** Soft-delete a single entry */
    public void delete(String id) {
        HistoriqueRecherche h = getOrThrow(id);
        h.setDeleted(true);
        repo.save(h);
    }

    /** Clear all history for a specific user */
    public void clearForClient(String clientId) {
        repo.findByClientIdAndDeletedFalse(clientId)
                .forEach(h -> {
                    h.setDeleted(true);
                    repo.save(h);
                });
    }

    private HistoriqueRecherche getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Historique introuvable : " + id));
    }

    public HistoriqueRechercheResponse toResponse(HistoriqueRecherche h) {
        return new HistoriqueRechercheResponse(
                h.getId(),
                h.getClient().getId(),
                h.getClient().getFullName(),
                h.getResultat() != null ? h.getResultat().getId() : null,
                h.getResultat() != null ? h.getResultat().getTitre() : null,
                h.getRequete(),
                h.isFound(),
                h.getCreatedAt());
    }
}
