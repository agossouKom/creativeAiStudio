package com.creativeai.generation.service;

import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.dto.SocialPublishRequestResponse;
import com.creativeai.generation.exception.ResourceNotFoundException;
import com.creativeai.generation.model.ScheduledPublication;
import com.creativeai.generation.model.ScheduledPublication.Status;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.ScheduledPublicationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;

/**
 * Pilotage des publications différées.
 *
 * <p>Le déclencheur d'horloge ({@code ScheduledPublicationTrigger}) ne fait que
 * appeler {@link #processDue()}; toute la logique est ici, ce qui la rend
 * testable sans démarrer de planificateur.
 */
@Slf4j
@Service
public class ScheduledPublicationService {

    /**
     * Nombre de publications traitées par tick. Borné parce qu'un rattrapage
     * après une panne longue ferait sinon tenir en mémoire toute la file
     * d'attente, et l'utilisateur verrait ses publications partir d'un coup
     * dans le désordre.
     */
    private final int batchSize;

    /**
     * Au-delà, on arrête d'essayer. Le but n'est pas d'epuiser la plateforme
     * avec un compte dont les credentials sont invalides depuis des jours.
     */
    private final int maxAttempts;

    private final ScheduledPublicationRepository repository;
    private final ScheduledPublicationExecutor executor;
    private final GenerationJobRepository jobRepository;
    private final Clock clock;
    private final TransactionTemplate bookingTemplate;

    @Autowired
    public ScheduledPublicationService(
        ScheduledPublicationRepository repository,
        ScheduledPublicationExecutor executor,
        GenerationJobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        @Value("${generation.scheduling.batch-size:20}") int batchSize,
        @Value("${generation.scheduling.max-attempts:3}") int maxAttempts) {
        this(repository, executor, jobRepository, transactionManager, batchSize, maxAttempts, Clock.systemUTC());
    }

    /** Constructeur de test : l'horloge est injectée pour figer le temps. */
    ScheduledPublicationService(ScheduledPublicationRepository repository,
                                ScheduledPublicationExecutor executor,
                                GenerationJobRepository jobRepository,
                                PlatformTransactionManager transactionManager,
                                int batchSize, int maxAttempts, Clock clock) {
        this.repository = repository;
        this.executor = executor;
        this.jobRepository = jobRepository;
        this.bookingTemplate = new TransactionTemplate(transactionManager);
        this.bookingTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        this.batchSize = Math.max(1, batchSize);
        this.maxAttempts = Math.max(1, maxAttempts);
        this.clock = clock;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    // ── CRUD utilisateur ───────────────────────────────────────────────────────

    /**
     * Programme une publication.
     *
     * <p>La validation de la plateforme et du média est volontairement absente
     * ici : elle est rejouée à l'exécution par
     * {@link SocialPublishService#publishScheduled}. En revanche, l'échéance est
     * validée maintenant, parce qu'une date déjà passée est une erreur de saisie
     * qu'aucune exécution future ne pourra rattraper.
     */
    @Transactional
    public ScheduledPublication schedule(ScheduledPublication draft) {
        OffsetDateTime now = now();

        if (draft.getScheduledAt() == null) {
            throw new IllegalArgumentException("La date de programmation est obligatoire");
        }
        if (!draft.getScheduledAt().isAfter(now)) {
            throw new IllegalArgumentException(
                "La date de programmation doit être dans le futur (reçu : " + draft.getScheduledAt() + ")");
        }
        if (draft.getEndAt() != null && draft.getEndAt().isBefore(draft.getScheduledAt())) {
            throw new IllegalArgumentException(
                "La date de fin ne peut pas précéder la date de début");
        }
        if (draft.getPlatform() == null) {
            throw new IllegalArgumentException("La plateforme cible est obligatoire");
        }

        // Le jobId vient du client : sans cette vérification, un utilisateur
        // pourrait programmer la publication du média de quelqu'un d'autre en
        // devinant l'identifiant, puisque l'exécution se fait sans jeton. Le job
        // est donc résolu ici, au moment où le contexte utilisateur existe.
        GenerationJob job = jobRepository.findByJobIdAndUserEmail(draft.getJobId(), draft.getUserEmail())
            .orElseThrow(() -> ResourceNotFoundException.of("Job", draft.getJobId()));
        draft.setExecutionVersion(job.getExecutionVersion());

        draft.setStatus(Status.SCHEDULED);
        draft.setAttempts(0);
        draft.setPublishedCount(0);
        // Rattaché au job pour que l'écran Historique puisse regrouper une
        // publication programmée et sa diffusion réelle.
        return repository.save(draft);
    }

    @Transactional(readOnly = true)
    public ScheduledPublication require(long id, String userEmail) {
        return repository.findByIdAndUserEmail(id, userEmail)
            .orElseThrow(() -> ResourceNotFoundException.of("Programmation", String.valueOf(id)));
    }

    @Transactional
    public ScheduledPublication cancel(long id, String userEmail) {
        ScheduledPublication entity = require(id, userEmail);
        if (entity.getStatus() == Status.PUBLISHED) {
            throw new PublishNotAllowedException("ALREADY_PUBLISHED",
                "Cette programmation a déjà été diffusée : elle ne peut plus être annulée.");
        }
        if (entity.getStatus() == Status.DISPATCHED) {
            // Fenêtre étroite : la diffusion est en cours et son issue est
            // inconnue. Annuler ici donnerait l'illusion que le post n'est pas
            // parti alors qu'il peut l'être dans les secondes qui suivent.
            throw new PublishNotAllowedException("DISPATCH_IN_PROGRESS",
                "La diffusion de cette programmation est en cours : son issue est inconnue. "
                    + "Vérifiez la plateforme dans quelques instants.");
        }
        if (entity.getStatus() == Status.CANCELLED) {
            return entity;
        }
        entity.setStatus(Status.CANCELLED);
        return repository.save(entity);
    }

    /**
     * Relance manuelle d'une programmation échouée ou expirée, après que
     * l'utilisateur a corrigé la cause (compte reconnecté, job relancé…).
     *
     * <p>La date de fin reste la limite d'origine : si elle est déjà dépassée,
     * un nouvel essai serait immédiatement refermé par le déclencheur. La relance
     * est donc le moment où l'utilisateur décide explicitement que la campagne
     * repart, et la date de fin périmée est levée.
     */
    @Transactional
    public ScheduledPublication retry(long id, String userEmail) {
        ScheduledPublication entity = require(id, userEmail);
        switch (entity.getStatus()) {
            case FAILED, EXPIRED -> {
                entity.setStatus(Status.SCHEDULED);
                entity.setAttempts(0);
                entity.setLastErrorCode(null);
                entity.setLastError(null);
                if (entity.getEndAt() != null && !entity.getEndAt().isAfter(now())) {
                    log.warn("[PLANNING] Relance {} : la date de fin {} est passée, elle est levée",
                        entity.getId(), entity.getEndAt());
                    entity.setEndAt(null);
                }
                return repository.save(entity);
            }
            case SCHEDULED -> {
                return entity;
            }
            case PUBLISHED -> throw new PublishNotAllowedException("ALREADY_PUBLISHED",
                "Cette programmation a déjà été diffusée : il n'y a rien à relancer.");
            case DISPATCHED -> throw new PublishNotAllowedException("DISPATCH_IN_PROGRESS",
                "La diffusion de cette programmation est en cours : son issue est inconnue. "
                    + "Vérifiez la plateforme dans quelques instants.");
            case CANCELLED -> throw new PublishNotAllowedException("CANCELLED",
                "Cette programmation a été annulée : reprogrammez-la si vous voulez la diffuser.");
            default -> throw new PublishNotAllowedException("UNKNOWN_STATUS",
                "Statut inattendu : " + entity.getStatus());
        }
    }

    @Transactional(readOnly = true)
    public List<ScheduledPublication> listForUser(String userEmail, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        return repository.findByUserEmailOrderByCreatedAtDesc(userEmail,
            org.springframework.data.domain.PageRequest.of(safePage, safeSize)).getContent();
    }

    // ── exécution ──────────────────────────────────────────────────────────────

    /**
     * Traite les programmages dont l'échéance est atteinte.
     *
     * <p>Appelé périodiquement. Résiste volontairement à la panne : une ligne en
     * erreur est marquée FAILED et le tick continue, sinon une publication dont
     * le compte est déconnecté bloquerait indéfiniment toutes les autres.
     *
     * @return nombre de programmages effectivement diffusés
     */
    public int processDue() {
        OffsetDateTime now = now();
        expireFinishedCampaigns(now);
        abandonExhausted();

        List<ScheduledPublication> due = repository.findDue(
            Status.SCHEDULED, now, maxAttempts,
            org.springframework.data.domain.PageRequest.of(0, batchSize));
        if (due.isEmpty()) {
            return 0;
        }

        int published = 0;
        for (ScheduledPublication candidate : due) {
            // Réservation COMMITTÉE AVANT l'exécution : l'exécuteur démarre sa
            // propre transaction (REQUIRES_NEW) et doit VOIR le statut DISPATCHED.
            // Sans ce commit, un UPDATE encore non committé lui cacherait la
            // réservation et le runOne renoncerait silencieusement.
            // Si un tick concurrent a déjà pris la ligne, on n'insiste pas.
            boolean booked = bookingTemplate.execute(status ->
                repository.claim(candidate.getId(), Status.SCHEDULED, Status.DISPATCHED, now) == 1);
            if (!Boolean.TRUE.equals(booked)) {
                continue;
            }
            if (executor.runOne(candidate.getId())) {
                published++;
            }
        }
        return published;
    }

    private void fail(ScheduledPublication entity, String code, String message) {
        boolean exhausted = entity.getAttempts() != null && entity.getAttempts() >= maxAttempts;
        entity.setStatus(exhausted ? Status.FAILED : Status.SCHEDULED);
        entity.setLastErrorCode(code);
        entity.setLastError(truncate(message));
        if (exhausted) {
            log.error("[PLANNING] Abandon de la programmation {} après {} tentatives : {}",
                entity.getId(), entity.getAttempts(), message);
        } else {
            log.warn("[PLANNING] Échec {} ({}), nouvel essai au prochain tick : {}",
                entity.getId(), code, message);
        }
        repository.save(entity);
    }

    /** Clôture des programmages qui ont épuisé leurs tentatives. */
    private void abandonExhausted() {
        for (ScheduledPublication entity : repository.findExhausted(Status.SCHEDULED, maxAttempts)) {
            entity.setStatus(Status.FAILED);
            repository.save(entity);
            log.error("[PLANNING] Programmation {} abandonnée après {} tentatives ({}). "
                    + "Déconnectez puis reconnectez le compte, ou relancez à la main.",
                entity.getId(), entity.getAttempts(), entity.getLastErrorCode());
        }
    }

    private void expireFinishedCampaigns(OffsetDateTime now) {
        List<ScheduledPublication> expired = repository.findExpired(
            EnumSet.of(Status.SCHEDULED, Status.DISPATCHED), now);
        for (ScheduledPublication entity : expired) {
            entity.setStatus(Status.EXPIRED);
            repository.save(entity);
        }
    }

    /**
     * Repère les lignes réservées dont l'issue n'a jamais été vue, sans les
     * rediffuser : la plateforme est la seule à savoir si le post est passé, et
     * un rejeu automatique risquerait de doubler le contenu en ligne.
     */
    @Transactional
    public int reportStuckDispatched() {
        OffsetDateTime before = now().minus(15, ChronoUnit.MINUTES);
        List<ScheduledPublication> stuck = repository.findStuckDispatched(
            Status.DISPATCHED, before,
            org.springframework.data.domain.PageRequest.of(0, batchSize));
        for (ScheduledPublication entity : stuck) {
            log.warn("[PLANNING] Programmation {} réservée depuis {} sans confirmation. "
                    + "Vérifiez la plateforme avant de relancer manuellement.",
                entity.getId(), entity.getUpdatedAt());
        }
        return stuck.size();
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= 1000 ? message : message.substring(0, 1000);
    }

    /** Utile aux tests : l'état courant de l'horloge. */
    Instant currentInstant() {
        return clock.instant();
    }
}
