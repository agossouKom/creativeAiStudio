package com.creativeai.generation.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "generation_outputs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerationOutput {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Référence au job métier (generation_jobs.job_id). */
    @Column(name = "job_id", nullable = false, length = 64)
    private String jobId;

    @Column(name = "execution_version", nullable = false)
    private Integer executionVersion;

    @Column(name = "output_index", nullable = false)
    private Integer outputIndex;

    @Column(name = "bucket", nullable = false, length = 80)
    private String bucket;

    @Column(name = "object_key", nullable = false, length = 500)
    private String objectKey;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "sha256", length = 64)
    private String sha256;

    @Column(name = "content_type", nullable = false, length = 80)
    private String contentType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
    }
}
