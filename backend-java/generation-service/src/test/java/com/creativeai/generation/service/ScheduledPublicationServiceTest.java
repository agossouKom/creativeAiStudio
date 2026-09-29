package com.creativeai.generation.service;

import com.creativeai.generation.exception.PlatformApiException;
import com.creativeai.generation.exception.PublishNotAllowedException;
import com.creativeai.generation.exception.ResourceNotFoundException;
import com.creativeai.generation.model.GenerationJob;
import com.creativeai.generation.model.JobStatus;
import com.creativeai.generation.model.ScheduledPublication;
import com.creativeai.generation.model.ScheduledPublication.Status;
import com.creativeai.generation.repository.GenerationJobRepository;
import com.creativeai.generation.repository.ScheduledPublicationRepository;
import com.creativeai.generation.social.SocialPlatform;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Règles de programmation. L'horloge est figée : ces tests portent sur la
 * logique d'échéance, pas sur le temps réel.
 */
@ExtendWith(MockitoExtension.class)
class ScheduledPublicationServiceTest {

    private static final String USER = "user@example.com";
    private static final Instant NOW = Instant.parse("2026-03-10T12:00:00Z");
    private static final int MAX_ATTEMPTS = 3;

    @Mock private ScheduledPublicationRepository repository;
    @Mock private ScheduledPublicationExecutor executor;
    @Mock private GenerationJobRepository jobRepository;
    @Mock private SocialPublishService publishService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private TransactionStatus transactionStatus;

    private ScheduledPublicationService service;

    @BeforeEach
    void setUp() {
        service = new ScheduledPublicationService(repository, executor, jobRepository,
            transactionManager, 20, MAX_ATTEMPTS, Clock.fixed(NOW, ZoneOffset.UTC));
        // La réservation est un commit explicite (TransactionTemplate) : sans
        // manager, un processDue qui réserve tomberait en NPE. Lenient parce
        // que les tests « rien à faire » ne réserve aucune ligne.
        lenient().when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);
    }

    /**
     * Garde-fou de régression : ces tests n'exposent pas le contexte Spring, et
     * un constructeur public non marqué {@code @Autowired} (deuxième constructeur
     * de test) fait échouer le démarrage du service en prod avec
     * « No default constructor found ». Le test reflète ce que Spring résout.
     */
    @Test
    void springSelectionneLeConstructeurPublic() throws ReflectiveOperationException {
        Constructor<ScheduledPublicationService> only = ScheduledPublicationService.class.getConstructor(
            ScheduledPublicationRepository.class,
            ScheduledPublicationExecutor.class,
            GenerationJobRepository.class,
            PlatformTransactionManager.class,
            int.class,
            int.class);
        org.junit.jupiter.api.Assertions.assertNotNull(only.getAnnotation(Autowired.class),
            "Le constructeur public doit porter @Autowired pour que Spring le choisisse");
    }

    /** Job de l'utilisateur, en version 2 : c'est lui qui fige la version programmée. */
    private void givenOwnedJob() {
        when(jobRepository.findByJobIdAndUserEmail(eq("job-1"), eq(USER)))
            .thenReturn(Optional.of(GenerationJob.builder().jobId("job-1").userEmail(USER)
                .executionVersion(2).status(JobStatus.DONE).build()));
    }

    private ScheduledPublication draft(OffsetDateTime at) {
        return ScheduledPublication.builder()
            .userEmail(USER).jobId("job-1").executionVersion(2).outputIndex(0)
            .platform(SocialPlatform.FACEBOOK).agentId("agent-1")
            .caption("Bonjour").scheduledAt(at).build();
    }

    private OffsetDateTime at(String iso) {
        return OffsetDateTime.parse(iso);
    }

    // ── programmation ──────────────────────────────────────────────────────────

    @Test
    void programmeEtFigeLaVersionDuJobAffichee() {
        givenOwnedJob();
        ScheduledPublication saved = draft(at("2026-03-12T14:00:00Z"));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        ScheduledPublication result = service.schedule(saved);

        assertEquals(Status.SCHEDULED, result.getStatus());
        assertEquals(0, result.getAttempts());
        // La version vient du job, elle n'est pas devinée par le client.
        assertEquals(2, result.getExecutionVersion());
    }

    @Test
    void refuseUneEcheanceDejaPassee() {
        ScheduledPublication past = draft(at("2026-03-09T10:00:00Z"));

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
            () -> service.schedule(past));
        assertTrue(e.getMessage().contains("futur"), e.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void refuseUneFinAnterieureAuDebut() {
        ScheduledPublication incoherent = draft(at("2026-03-12T14:00:00Z"));
        incoherent.setEndAt(at("2026-03-11T14:00:00Z"));

        assertThrows(IllegalArgumentException.class, () -> service.schedule(incoherent));
        verify(repository, never()).save(any());
    }

    /**
     * Le jobId vient du client et l'exécution se fait sans jeton : sans cette
     * vérification, deviner un identifiant suffirait à programmer la publication
     * du média d'un autre utilisateur.
     */
    @Test
    void refuseUnJobQuiNAppartientPasALUtilisateur() {
        when(jobRepository.findByJobIdAndUserEmail(eq("job-dautre"), eq(USER)))
            .thenReturn(Optional.empty());
        ScheduledPublication vol = draft(at("2026-03-12T14:00:00Z"));
        vol.setJobId("job-dautre");

        assertThrows(ResourceNotFoundException.class, () -> service.schedule(vol));
        verify(repository, never()).save(any());
    }

    // ── annulation ─────────────────────────────────────────────────────────────

    @Test
    void annuleUneProgrammationEnAttente() {
        ScheduledPublication entity = draft(at("2026-03-12T14:00:00Z"));
        entity.setId(7L);
        when(repository.findByIdAndUserEmail(7L, USER)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertEquals(Status.CANCELLED, service.cancel(7L, USER).getStatus());
    }

    /**
     * Annuler pendant la diffusion donnerait l'illusion que le post n'est pas
     * parti, alors qu'il peut l'être dans les secondes suivantes.
     */
    @Test
    void refuseDAnnulerUneDiffusionEnCours() {
        ScheduledPublication entity = draft(at("2026-03-12T14:00:00Z"));
        entity.setId(7L);
        entity.setStatus(Status.DISPATCHED);
        when(repository.findByIdAndUserEmail(7L, USER)).thenReturn(Optional.of(entity));

        PublishNotAllowedException e =
            assertThrows(PublishNotAllowedException.class, () -> service.cancel(7L, USER));
        assertEquals("DISPATCH_IN_PROGRESS", e.getCode());
    }

    @Test
    void refuseDAnnulerUneProgrammationDejaDiffusee() {
        ScheduledPublication entity = draft(at("2026-03-12T14:00:00Z"));
        entity.setId(7L);
        entity.setStatus(Status.PUBLISHED);
        when(repository.findByIdAndUserEmail(7L, USER)).thenReturn(Optional.of(entity));

        assertThrows(PublishNotAllowedException.class, () -> service.cancel(7L, USER));
    }

    // ── exécution ──────────────────────────────────────────────────────────────

    /**
     * L'invariant central. Deux ticks qui se chevauchent lisent la même ligne ;
     * un seul doit la exécuter, sinon le contenu part deux fois sur le réseau
     * social — défaut qu'aucun test séquentiel ne détecterait.
     */
    @Test
    void neTraiteQueLesLignesReserveesAvecSucces() {
        ScheduledPublication due = draft(at("2026-03-10T11:59:00Z"));
        due.setId(1L);
        when(repository.findDue(eq(Status.SCHEDULED), any(), eq(MAX_ATTEMPTS), any(Pageable.class)))
            .thenReturn(List.of(due));
        // Le tick A réserve, puis le tick B tente et se fait refuser.
        when(repository.claim(eq(1L), eq(Status.SCHEDULED), eq(Status.DISPATCHED), any()))
            .thenReturn(1, 0);
        when(repository.findExhausted(eq(Status.SCHEDULED), eq(MAX_ATTEMPTS))).thenReturn(List.of());
        when(repository.findExpired(any(), any())).thenReturn(List.of());
        when(executor.runOne(1L)).thenReturn(true);

        assertEquals(1, service.processDue());
        // Le second passage ne doit surtout pas ré-exécuter.
        assertEquals(0, service.processDue());
        verify(executor, times(1)).runOne(1L);
    }

    @Test
    void neTraiteRienQuandAucuneEcheanceNEstAtteinte() {
        when(repository.findDue(eq(Status.SCHEDULED), any(), eq(MAX_ATTEMPTS), any(Pageable.class)))
            .thenReturn(List.of());
        when(repository.findExhausted(eq(Status.SCHEDULED), eq(MAX_ATTEMPTS))).thenReturn(List.of());
        when(repository.findExpired(any(), any())).thenReturn(List.of());

        assertEquals(0, service.processDue());
        verify(executor, never()).runOne(anyLong());
    }

    /**
     * Une programmation qui échoue toujours doit finir signalée à l'utilisateur,
     * pas rester « en attente » indéfiniment.
     */
    @Test
    void abandonneLesProgrammationsQuiOntEpuiserLeursTentatives() {
        ScheduledPublication exhausted = draft(at("2026-03-10T11:00:00Z"));
        exhausted.setId(3L);
        exhausted.setAttempts(MAX_ATTEMPTS);
        when(repository.findExhausted(Status.SCHEDULED, MAX_ATTEMPTS))
            .thenReturn(List.of(exhausted));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(repository.findDue(eq(Status.SCHEDULED), any(), eq(MAX_ATTEMPTS), any(Pageable.class)))
            .thenReturn(List.of());
        when(repository.findExpired(any(), any())).thenReturn(List.of());

        service.processDue();

        assertEquals(Status.FAILED, exhausted.getStatus());
    }

    @Test
    void clotureLesCampagnesDontLaFinEstDepassee() {
        ScheduledPublication over = draft(at("2026-02-01T10:00:00Z"));
        over.setId(4L);
        over.setEndAt(at("2026-03-01T10:00:00Z"));
        when(repository.findExpired(any(), any())).thenReturn(List.of(over));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(repository.findExhausted(eq(Status.SCHEDULED), eq(MAX_ATTEMPTS))).thenReturn(List.of());
        when(repository.findDue(eq(Status.SCHEDULED), any(), eq(MAX_ATTEMPTS), any(Pageable.class)))
            .thenReturn(List.of());

        service.processDue();

        assertEquals(Status.EXPIRED, over.getStatus());
    }

    @Test
    void listeLesProgrammationsDeLUtilisateur() {
        when(repository.findByUserEmailOrderByCreatedAtDesc(eq(USER), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(draft(at("2026-03-12T14:00:00Z")))));

        assertEquals(1, service.listForUser(USER, 0, 50).size());
    }

    /** Une taille de page absurde ne doit pas faire tomber la requête. */
    @Test
    void borneLaTailleDePageDemandee() {
        when(repository.findByUserEmailOrderByCreatedAtDesc(eq(USER), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        service.listForUser(USER, 0, 100_000);

        verify(repository).findByUserEmailOrderByCreatedAtDesc(eq(USER), any(Pageable.class));
    }

    // ── exécution isolée (exécuteur) ───────────────────────────────────────────

    /**
     * Le redimensionnement du lot existe pour qu'un rattrapage après une panne
     * ne charge pas toute la file d'attente en mémoire.
     */
    @Test
    void borneLeLotTraiteParTick() {
        when(repository.findExhausted(eq(Status.SCHEDULED), eq(MAX_ATTEMPTS))).thenReturn(List.of());
        when(repository.findExpired(any(), any())).thenReturn(List.of());
        when(repository.findDue(eq(Status.SCHEDULED), any(), eq(MAX_ATTEMPTS), any(Pageable.class)))
            .thenReturn(List.of());

        service.processDue();

        var captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findDue(eq(Status.SCHEDULED), any(), eq(MAX_ATTEMPTS), captor.capture());
        assertEquals(20, captor.getValue().getPageSize());
    }

    // ── relance manuelle ───────────────────────────────────────────────────────

    private ScheduledPublication owned(long id, ScheduledPublication.Status status) {
        ScheduledPublication p = draft(at("2026-03-12T14:00:00Z"));
        p.setId(id);
        p.setStatus(status);
        when(repository.findByIdAndUserEmail(id, USER)).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    void relanceUnePublicationEnEchec() {
        ScheduledPublication failed = owned(10L, Status.FAILED);
        failed.setAttempts(MAX_ATTEMPTS);
        failed.setLastErrorCode("PLATFORM_REJECTED");
        failed.setLastError("Message Meta");
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        ScheduledPublication updated = service.retry(10L, USER);

        assertEquals(Status.SCHEDULED, updated.getStatus());
        assertEquals(0, updated.getAttempts());
        assertNull(updated.getLastErrorCode());
        assertNull(updated.getLastError());
    }

    @Test
    void relanceUnePublicationExpiree() {
        ScheduledPublication expired = owned(11L, Status.EXPIRED);
        expired.setEndAt(at("2026-03-01T10:00:00Z"));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        ScheduledPublication updated = service.retry(11L, USER);

        assertEquals(Status.SCHEDULED, updated.getStatus());
        // La fin de campagne est déjà passée : relancer est un nouveau départ,
        // elle est levée pour ne pas être refermée au tick suivant.
        assertNull(updated.getEndAt());
    }

    @Test
    void relanceRefuseeQuandDiffusionDejaReussie() {
        ScheduledPublication published = owned(12L, Status.PUBLISHED);

        assertThrows(PublishNotAllowedException.class, () -> service.retry(12L, USER));
    }

    @Test
    void relanceRefuseeQuandDiffusionEnCours() {
        ScheduledPublication dispatched = owned(13L, Status.DISPATCHED);

        assertThrows(PublishNotAllowedException.class, () -> service.retry(13L, USER));
    }

    @Test
    void relanceDuneProgrammationEnAttenteEstSansEffet() {
        ScheduledPublication scheduled = owned(14L, Status.SCHEDULED);

        assertEquals(Status.SCHEDULED, service.retry(14L, USER).getStatus());
        verify(repository, never()).save(any());
    }
}
