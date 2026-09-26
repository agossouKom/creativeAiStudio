package com.creativeai.generation.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "generation_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerationJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Identifiant métier exposé au client et propagé dans les événements Kafka. */
    @Column(name = "job_id", nullable = false, unique = true, length = 64)
    private String jobId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "agent_id", length = 64)
    private String agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false, length = 20)
    private MediaType mediaType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private JobStatus status;

    /** Dernier stage publie par le worker : VALIDATING, RENDERING, STORAGE, FINALIZE... */
    @Column(name = "stage", length = 40)
    private String stage;

    @Column(name = "progress", nullable = false)
    private Integer progress;

    @Column(name = "prompt", nullable = false, columnDefinition = "text")
    private String prompt;

    @Column(name = "negative_prompt", columnDefinition = "text")
    private String negativePrompt;

    /** Options normalisées sérialisées en JSON (rejouées à l'identique lors d'un retry). */
    @Column(name = "options_json", columnDefinition = "text")
    private String optionsJson;

    /** Incrémenté à chaque retry : un worker peut émettre des résultats obsolètes, ils sont ignorés. */
    @Column(name = "execution_version", nullable = false)
    private Integer executionVersion;

    @Column(name = "provider", length = 60)
    private String provider;

    @Column(name = "provider_task_id", length = 128)
    private String providerTaskId;

    @Column(name = "error_code", length = 80)
    private String errorCode;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) this.status = JobStatus.QUEUED;
        if (this.progress == null) this.progress = 0;
        if (this.executionVersion == null) this.executionVersion = 1;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
