package com.creativeai.generation.service;

import com.creativeai.generation.model.PublishStatus;
import com.creativeai.generation.model.SocialPublishRequest;
import com.creativeai.generation.repository.SocialPublishRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Écriture des demandes de publication dans des transactions indépendantes :
 * l'appel réseau vers la plateforme n'est jamais couvert par une transaction,
 * et un échec n'annule pas l'historique de la demande.
 */
@Component
@RequiredArgsConstructor
public class PublishRequestStore {

    private final SocialPublishRequestRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SocialPublishRequest create(SocialPublishRequest request) {
        return repository.save(request);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SocialPublishRequest markDispatched(Long id, String remoteMediaId) {
        SocialPublishRequest request = repository.findById(id)
            .orElseThrow(() -> new IllegalStateException("Demande de publication introuvable: " + id));
        request.setStatus(PublishStatus.DISPATCHED);
        request.setRemoteMediaId(remoteMediaId);
        request.setSubmittedAt(LocalDateTime.now());
        request.setAttempts(request.getAttempts() + 1);
        request.setErrorCode(null);
        request.setErrorMessage(null);
        return repository.save(request);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SocialPublishRequest markPublished(Long id, String remoteMediaId, String permalink) {
        SocialPublishRequest request = repository.findById(id)
            .orElseThrow(() -> new IllegalStateException("Demande de publication introuvable: " + id));
        request.setStatus(PublishStatus.PUBLISHED);
        if (remoteMediaId != null) {
            request.setRemoteMediaId(remoteMediaId);
        }
        if (permalink != null) {
            request.setRemotePermalink(permalink);
        }
        request.setPublishedAt(LocalDateTime.now());
        if (request.getSubmittedAt() == null) {
            request.setSubmittedAt(LocalDateTime.now());
        }
        request.setErrorCode(null);
        request.setErrorMessage(null);
        return repository.save(request);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SocialPublishRequest markFailed(Long id, String code, String message) {
        SocialPublishRequest request = repository.findById(id)
            .orElseThrow(() -> new IllegalStateException("Demande de publication introuvable: " + id));
        request.setStatus(PublishStatus.FAILED);
        request.setErrorCode(code);
        request.setErrorMessage(message != null && message.length() > 1000
            ? message.substring(0, 1000) : message);
        // `attempts` est déjà incrémenté par markDispatched : une seule
        // publication = une seule tentative, qu'elle aboutisse ou non.
        return repository.save(request);
    }
}
