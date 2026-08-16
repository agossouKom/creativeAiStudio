package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.PubRequest;
import com.creativeai.auth.dto.response.PubResponse;
import com.creativeai.auth.model.ClientPub;
import com.creativeai.auth.model.Pub;
import com.creativeai.auth.repository.ClientPubRepository;
import com.creativeai.auth.repository.PubRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PubService {

    private final PubRepository repo;
    private final ClientPubRepository clientPubRepo;
    private final ClientPubService clientPubService;

    public PubResponse create(PubRequest req) {
        return toResponse(repo.save(buildFromRequest(new Pub(), req)));
    }

    public PubResponse update(String id, PubRequest req) {
        Pub p = getOrThrow(id);
        return toResponse(repo.save(buildFromRequest(p, req)));
    }

    @Transactional(readOnly = true)
    public PubResponse findById(String id)       { return toResponse(getOrThrow(id)); }

    @Transactional(readOnly = true)
    public List<PubResponse> findAll(boolean deleted) {
        if (deleted) return repo.findByDeletedTrue().stream().map(this::toResponse).toList();
        return repo.findByDeletedFalse().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PubResponse> findCurrent() {
        LocalDateTime now = LocalDateTime.now();
        return repo.findByActiveTrueAndDeletedFalseAndDebutBeforeAndFinAfter(now, now)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PubResponse> findByClient(String clientPubId) {
        return repo.findByClientPubIdAndDeletedFalse(clientPubId).stream().map(this::toResponse).toList();
    }

    public void delete(String id) { Pub p = getOrThrow(id); p.setDeleted(true); p.setActive(false); repo.save(p); }

    public PubResponse restore(String id) {
        Pub p = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Pub introuvable : " + id));
        p.setDeleted(false); p.setActive(true);
        return toResponse(repo.save(p));
    }

    private Pub buildFromRequest(Pub pub, PubRequest req) {
        // QUICK ADD: resolve ClientPub by id or create inline, handling empty/blank ID strings
        ClientPub client = null;
        if (req.clientPubId() != null && !req.clientPubId().trim().isEmpty()) {
            client = clientPubRepo.findById(req.clientPubId())
                    .orElseThrow(() -> new IllegalArgumentException("ClientPub introuvable : " + req.clientPubId()));
        } else if (req.clientPub() != null) {
            client = clientPubService.findOrCreate(req.clientPub());
        }
        pub.setDebut(req.debut());
        pub.setFin(req.fin());
        pub.setImageUrls(req.imageUrls() != null ? new ArrayList<>(req.imageUrls()) : new ArrayList<>());
        pub.setClientPub(client);
        if (req.active() != null) pub.setActive(req.active());
        if (req.duree() != null) pub.setDuree(req.duree());
        pub.setPrix(req.prix());
        return pub;
    }

    private Pub getOrThrow(String id) {
        return repo.findById(id).filter(x -> !x.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Pub introuvable : " + id));
    }

    public PubResponse toResponse(Pub p) {
        return new PubResponse(p.getId(), p.getDebut(), p.getFin(), p.getImageUrls(),
                p.getClientPub() != null ? clientPubService.toResponse(p.getClientPub()) : null,
                p.isActive(), p.isDeleted(), p.getDuree(), p.getPrix(),
                p.getCreatedAt(), p.getUpdatedAt());
    }
}
