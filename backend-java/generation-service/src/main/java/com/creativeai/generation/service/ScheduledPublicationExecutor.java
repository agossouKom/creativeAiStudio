package com.creativeai.generation.service;

import com.creativeai.generation.dto.SocialPublishRequestResponse;
import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.model.ScheduledPublication;
import com.creativeai.generation.model.ScheduledPublication.Status;
import com.creativeai.generation.repository.ScheduledPublicationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Diffuse une seule programmation réservée.
 *
 * <p>Bean séparé de {@link ScheduledPublicationService} pour une raison
 * technique précise : si l'exécution restait dans la même classe, l'appel
 * {@code executor.runOne(...)} de {@code processDue()} viserait {@code this} et
 * court-circuiterait le proxy Spring — l'annotation
 * {@link Propagation#REQUIRES_NEW} serait alors silencieusement inopérante et
 * toutes les programmations d'un tick partageraient la même transaction.
 *
 * <p>Conséquence de {@code REQUIRES_NEW} : un échec de diffusion est validé
 * indépendamment, sans laisser les programmages suivantes du lot sans résultat.
 */
@Slf4j
@Service
public class ScheduledPublicationExecutor {

    private static final int MAX_ERROR_LENGTH = 1000;

    private final ScheduledPublicationRepository repository;
    private final SocialPublishService publishService;

    public ScheduledPublicationExecutor(ScheduledPublicationRepository repository,
                                        SocialPublishService publishService) {
        this.repository = repository;
        this.publishService = publishService;
    }

    /**
     * @return true si la publication a abouti
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean runOne(Long id) {
        ScheduledPublication entity = repository.findById(id).orElse(null);
        if (entity == null || entity.getStatus() != Status.DISPATCHED) {
            return false;
        }

        try {
            SocialPublishRequestResponse response = publishService.publishScheduled(
                entity.getJobId(),
                entity.getExecutionVersion(),
                entity.getOutputIndex(),
                entity.getUserEmail(),
                entity.getPlatform(),
                entity.getAgentId(),
                entity.getCaption());

            entity.setStatus(Status.PUBLISHED);
            entity.setFirstRequestId(response.requestId());
            entity.setPublishedCount((entity.getPublishedCount() == null ? 0 : entity.getPublishedCount()) + 1);
            entity.setLastErrorCode(null);
            entity.setLastError(null);
            repository.save(entity);

            log.info("[PLANNING] Publication {} diffusée sur {} ({})",
                response.requestId(), entity.getPlatform(), entity.getUserEmail());
            return true;
        } catch (PlatformApiException e) {
            fail(entity, e.getCode(), e.getMessage());
            return false;
        } catch (PublishNotAllowedException e) {
            // Non diffusable (adaptateur retiré, job non terminé, aucun compte
            // connecté) : l'échec est définitif, réessayer ne changera rien.
            fail(entity, e.getCode(), e.getMessage());
            return false;
        } catch (RuntimeException e) {
            // Panne inattendue : comptée comme une tentative. Si le problème
            // persiste, le service de programmation basculera la ligne en
            // FAILED au bout du nombre de tentatives autorisées.
            fail(entity, "UNEXPECTED_" + e.getClass().getSimpleName(), e.getMessage());
            return false;
        }
    }

    /**
     * Remet la ligne en attente après un échec. La décision d'abandonner ou de
     * réessayer appartient à {@link ScheduledPublicationService#processDue()},
     * seul à connaître la limite de tentatives : ici, on ne fait que restituer
     * l'état et la cause, ce qui évite que deux endroits ait une idée différente
     * du nombre d'essais autorisés.
     */
    private void fail(ScheduledPublication entity, String code, String message) {
        entity.setStatus(Status.SCHEDULED);
        entity.setLastErrorCode(code);
        entity.setLastError(truncate(message));
        repository.save(entity);
        log.warn("[PLANNING] Programmation {} en échec ({}), tentative {} : {}",
            entity.getId(), code, entity.getAttempts(), message);
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= MAX_ERROR_LENGTH ? message : message.substring(0, MAX_ERROR_LENGTH);
    }
}
