package com.creativeai.auth.service;

import com.creativeai.auth.dto.request.SocialLinkRequest;
import com.creativeai.auth.dto.response.SocialLinkResponse;
import com.creativeai.auth.model.SocialLink;
import com.creativeai.auth.repository.SocialLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class SocialLinkService {

    private final SocialLinkRepository repo;

    // ─── Create ────────────────────────────────────────────────────────────────

    public SocialLinkResponse create(SocialLinkRequest req) {
        return toResponse(repo.save(buildFromRequest(new SocialLink(), req)));
    }

    // ─── Update ────────────────────────────────────────────────────────────────

    public SocialLinkResponse update(String id, SocialLinkRequest req) {
        SocialLink link = getOrThrow(id);
        return toResponse(repo.save(buildFromRequest(link, req)));
    }

    // ─── Read ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public SocialLinkResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<SocialLinkResponse> findAll() {
        return repo.findAll().stream()
                .sorted((a, b) -> Integer.compare(
                        a.getDisplayOrder() == null ? 0 : a.getDisplayOrder(),
                        b.getDisplayOrder() == null ? 0 : b.getDisplayOrder()))
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SocialLinkResponse> findByOwnerType(SocialLink.OwnerType ownerType) {
        return repo.findByOwnerTypeOrderByDisplayOrderAsc(ownerType)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SocialLinkResponse> findActiveByOwnerType(SocialLink.OwnerType ownerType) {
        return repo.findByOwnerTypeAndIsActiveTrueOrderByDisplayOrderAsc(ownerType)
                .stream().map(this::toResponse).toList();
    }

    // ─── Delete ────────────────────────────────────────────────────────────────

    public void delete(String id) {
        repo.delete(getOrThrow(id));
    }

    // ─── Toggle active ─────────────────────────────────────────────────────────

    public SocialLinkResponse toggleActive(String id) {
        SocialLink link = getOrThrow(id);
        link.setIsActive(!Boolean.TRUE.equals(link.getIsActive()));
        return toResponse(repo.save(link));
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private SocialLink buildFromRequest(SocialLink link, SocialLinkRequest req) {
        link.setPlatform(req.platform());
        link.setUrl(req.url());
        link.setIconClass(req.iconClass());
        link.setOwnerType(req.ownerType());
        if (req.displayOrder() != null) link.setDisplayOrder(req.displayOrder());
        if (req.isActive()     != null) link.setIsActive(req.isActive());
        return link;
    }

    private SocialLink getOrThrow(String id) {
        return repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("SocialLink introuvable : " + id));
    }

    public SocialLinkResponse toResponse(SocialLink l) {
        return new SocialLinkResponse(
                l.getId(),
                l.getPlatform(),
                l.getUrl(),
                l.getIconClass(),
                l.getDisplayOrder() == null ? 0 : l.getDisplayOrder(),
                Boolean.TRUE.equals(l.getIsActive()),
                l.getOwnerType(),
                l.getCreatedAt(),
                l.getUpdatedAt()
        );
    }
}
