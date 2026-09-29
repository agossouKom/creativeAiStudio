package com.creativeai.generation.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Horloge du Planning.
 *
 * <p>Délégué à {@link ScheduledPublicationService} : cette classe ne contient
 * aucune logique, ce qui permet de tester les règles (échéance, tentatives,
 * double diffusion) sans dépendre du scheduler.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "generation.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class ScheduledPublicationTrigger {

    private final ScheduledPublicationService service;

    /**
     * Un tick ne doit jamais en déclencher un autre : si la diffusion d'un lot
     * dure plus que l'intervalle (API Meta lente, base saturée), les ticks se
     * chevauchent et la réservation conditionnelle refuse la seconde passe —
     * mais on empêche surtout d'accumuler les tâches.
     */
    private final AtomicBoolean running = new AtomicBoolean(false);

    public ScheduledPublicationTrigger(ScheduledPublicationService service) {
        this.service = service;
    }

    @Scheduled(fixedDelayString = "${generation.scheduling.tick-millis:30000}")
    public void tick() {
        if (!running.compareAndSet(false, true)) {
            log.debug("[PLANNING] Tick ignoré : le précédent est encore en cours");
            return;
        }
        try {
            int published = service.processDue();
            if (published > 0) {
                log.info("[PLANNING] {} publication(s) diffusée(s) par le planificateur", published);
            }
            int stuck = service.reportStuckDispatched();
            if (stuck > 0) {
                log.warn("[PLANNING] {} programmation(s) en attente de vérification manuelle", stuck);
            }
        } catch (RuntimeException e) {
            // Une exception ne doit pas désactiver le scheduler : Spring
            // supprimerait définitivement la tâche. On la journalise et on
            // laisse le tick suivant repartir.
            log.error("[PLANNING] Le tick a échoué : {}", e.getMessage(), e);
        } finally {
            running.set(false);
        }
    }
}
