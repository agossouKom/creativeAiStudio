package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.ClientPubRequest;
import com.creativeai.auth.dto.response.ClientPubResponse;
import com.creativeai.auth.dto.response.SocialMediaClientResponse;
import com.creativeai.auth.model.ClientPub;
import com.creativeai.auth.model.SocialMediaClient;
import com.creativeai.auth.model.SocialLink;
import com.creativeai.auth.model.SocialLink.OwnerType;
import com.creativeai.auth.repository.ClientPubRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ClientPubService {

    private final ClientPubRepository repo;

    public ClientPubResponse create(ClientPubRequest req) {
        if (req.email() != null && repo.existsByEmail(req.email()))
            throw new IllegalArgumentException("Email déjà utilisé : " + req.email());
        return toResponse(repo.save(buildFromRequest(new ClientPub(), req)));
    }

    public ClientPubResponse update(String id, ClientPubRequest req) {
        ClientPub c = getOrThrow(id);
        buildFromRequest(c, req);
        return toResponse(repo.save(c));
    }

    @Transactional(readOnly = true)
    public ClientPubResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<ClientPubResponse> findAll(boolean deleted) {
        if (deleted)
            return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    public void delete(String id) {
        ClientPub c = getOrThrow(id);
        c.setDeleted(true);
        c.setActive(false);
        repo.save(c);
    }

    public ClientPubResponse restore(String id) {
        ClientPub c = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ClientPub introuvable : " + id));
        c.setDeleted(false);
        c.setActive(true);
        return toResponse(repo.save(c));
    }

    private ClientPub buildFromRequest(ClientPub c, ClientPubRequest req) {
        c.setNom(req.nom());
        c.setPrenom(req.prenom());
        c.setRaisonSociale(req.raisonSociale());
        c.setContact1(req.contact1());
        c.setContact2(req.contact2());
        c.setEmail(req.email());
        c.setResponsable(req.responsable());
        c.setSiteWeb(req.siteWeb());
        if (req.active() != null)
            c.setActive(req.active());
        if (req.reseauxSociaux() != null) {
            c.getReseauxSociaux().clear();
            req.reseauxSociaux().forEach(s -> {
                SocialMediaClient sm = new SocialMediaClient();
                sm.setClientPub(c);
                sm.setPlateforme(s.plateforme());
                sm.setUrl(s.url());
                sm.setIconClass(s.iconClass());
                c.getReseauxSociaux().add(sm);
            });
        }
        return c;
    }

    private ClientPub getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("ClientPub introuvable : " + id));
    }

    public ClientPubResponse toResponse(ClientPub c) {
        List<SocialMediaClientResponse> sm = c.getReseauxSociaux().stream()
                .map(s -> new SocialMediaClientResponse(s.getId(), s.getPlateforme(), s.getUrl(),
                        s.getIconClass(), s.isActive(), s.getCreatedAt()))
                .toList();
        return new ClientPubResponse(c.getId(), c.getNom(), c.getPrenom(), c.getRaisonSociale(),
                c.getContact1(), c.getContact2(), c.getEmail(), c.getResponsable(), c.getSiteWeb(),
                c.isActive(), c.isDeleted(), sm, c.getCreatedAt(), c.getUpdatedAt());
    }

    /** Quick-add: find or create by email */
    public ClientPub findOrCreate(ClientPubRequest req) {
        if (req.email() != null) {
            return repo.findByEmail(req.email())
                    .orElseGet(() -> repo.save(buildFromRequest(new ClientPub(), req)));
        }
        return repo.save(buildFromRequest(new ClientPub(), req));
    }
}
