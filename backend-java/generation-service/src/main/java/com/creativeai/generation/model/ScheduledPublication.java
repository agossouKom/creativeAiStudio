package com.creativeai.generation.model;

import com.creativeai.generation.social.SocialPlatform;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.OffsetDateTime;

/**
 * Une publication différée : « publie ce rendu sur cette plateforme, à cette
 * date, avec ce texte ».
 *
 * <p>Les instants sont manipulés en {@link OffsetDateTime} / {@link Instant} et
 * stockés en {@code TIMESTAMP WITH TIME ZONE}. C'est volontaire : une
 * programmation est une promesse d'heure civile faite à l'utilisateur, et
 * l'heure d'été doit être gérée par PostgreSQL, pas par un décalage calculé à
 * la main dans le conteneur.
 */
@Entity
@Table(name = "scheduled_publications")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ScheduledPublication {

    public enum Status {
        /** programmed, en attente d'échéance. */
        SCHEDULED,
        /** réservé par le déclencheur, diffusion en cours. */
        DISPATCHED,
        /** au moins une diffusion réussie. */
        PUBLISHED,
        /** échec définitif, ou épuisement des tentatives. */
        FAILED,
        /** annulée par l'utilisateur avant diffusion. */
        CANCELLED,
        /** fenêtre (end_at) dépassée sans diffusion. */
        EXPIRED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_email", nullable = false, length = 255)
    private String userEmail;

    @Column(name = "job_id", nullable = false, length = 64)
    private String jobId;

    /** Fige le rendu visé : une relance du job ne doit pas changer la cible. */
    @Column(name = "execution_version", nullable = false)
    private Integer executionVersion;

    @Column(name = "output_index", nullable = false)
    private Integer outputIndex;

    @Column(name = "agent_id", length = 64)
    private String agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 30)
    private SocialPlatform platform;

    @Column(name = "caption", length = 2200)
    private String caption;

    @Column(name = "scheduled_at", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime scheduledAt;

    /** Fin de campagne. Null = diffusion unique. */
    @Column(name = "end_at", columnDefinition = "timestamptz")
    private OffsetDateTime endAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.SCHEDULED;

    @Column(name = "attempts", nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @Column(name = "last_error_code", length = 80)
    private String lastErrorCode;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "first_request_id", length = 36)
    private String firstRequestId;

    @Column(name = "published_count", nullable = false)
    @Builder.Default
    private Integer publishedCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = OffsetDateTime.ofInstant(now, java.time.ZoneOffset.UTC);
        if (updatedAt == null) updatedAt = createdAt;
        if (status == null) status = Status.SCHEDULED;
        if (attempts == null) attempts = 0;
        if (publishedCount == null) publishedCount = 0;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.ofInstant(Instant.now(), java.time.ZoneOffset.UTC);
    }
}
