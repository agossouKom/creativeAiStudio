package com.creativeai.generation.repository;

import com.creativeai.generation.model.ScheduledPublication;
import com.creativeai.generation.model.ScheduledPublication.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScheduledPublicationRepository extends JpaRepository<ScheduledPublication, Long> {

    Optional<ScheduledPublication> findByIdAndUserEmail(Long id, String userEmail);

    Page<ScheduledPublication> findByUserEmailOrderByCreatedAtDesc(String userEmail, Pageable pageable);

    List<ScheduledPublication> findByJobIdOrderByCreatedAtDesc(String jobId);

    /**
     * Demandes dont l'échéance est atteinte et qui n'ont pas encore été
     * réservées. L'instant de référence et le lot sont passés en paramètres pour
     * que le test puisse figer l'heure et la taille.
     */
    @Query("SELECT s FROM ScheduledPublication s "
         + "WHERE s.status = :status AND s.scheduledAt <= :now AND s.attempts < :maxAttempts "
         + "ORDER BY s.scheduledAt ASC")
    List<ScheduledPublication> findDue(
        @Param("status") Status status,
        @Param("now") OffsetDateTime now,
        @Param("maxAttempts") int maxAttempts,
        Pageable pageable);

    /**
     * Lignes que le tick ne retiendra pas parce qu'elles ont épuisé leurs
     * tentatives. Elles sont abandonnées explicitement plutôt que laissées en
     * attente : sans cela, l'utilisateur verrait un programmation toujours
     * « en attente » alors que plus rien ne se produira jamais.
     */
    @Query("SELECT s FROM ScheduledPublication s "
         + "WHERE s.status = :status AND s.attempts >= :maxAttempts")
    List<ScheduledPublication> findExhausted(
        @Param("status") Status status,
        @Param("maxAttempts") int maxAttempts);

    /**
     * Réservation conditionnelle : c'est le verrou de la double diffusion.
     *
     * <p>Deux ticks qui se chevauchent lisent la même ligne ; un seul UPDATE
     * renvoie 1, l'autre renvoie 0 et abandonne. Sans la clause
     * {@code AND s.status = :status}, le second tick publierait à son tour et le
     * contenu partirait deux fois sur le réseau social — un défaut qu'aucun test
     * fonctionnel séquentiel ne détecterait.
     *
     * <p>{@code updatedAt} est positionné ici parce qu'un UPDATE en masse
     * contourne {@code @PreUpdate}.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ScheduledPublication s "
         + "SET s.status = :claimed, s.attempts = s.attempts + 1, s.updatedAt = :now "
         + "WHERE s.id = :id AND s.status = :status")
    int claim(
        @Param("id") Long id,
        @Param("status") Status status,
        @Param("claimed") Status claimed,
        @Param("now") OffsetDateTime now);

    /**
     * Lignes réservées dont on n'a jamais vu le résultat. Après un redémarrage
     * elles sont à reprendre explicitement, pas à rejouer à l'aveugle : si la
     * diffusion avait en fait abouti, la plateforme refuserait un doublon mais
     * l'utilisateur verrait une erreur pour un post déjà en ligne.
     */
    @Query("SELECT s FROM ScheduledPublication s "
         + "WHERE s.status = :status AND s.updatedAt < :before "
         + "ORDER BY s.updatedAt ASC")
    List<ScheduledPublication> findStuckDispatched(
        @Param("status") Status status,
        @Param("before") OffsetDateTime before,
        Pageable pageable);

    /**
     * Campagnes dont la fenêtre est dépassée, à clore pour qu'elles ne restent
     * pas ouvertes indéfiniment et ne soient pas réactivées par erreur.
     */
    @Query("SELECT s FROM ScheduledPublication s "
         + "WHERE s.status IN :statuses "
         + "  AND s.endAt IS NOT NULL AND s.endAt < :now")
    List<ScheduledPublication> findExpired(
        @Param("statuses") Collection<Status> statuses,
        @Param("now") OffsetDateTime now);
}
