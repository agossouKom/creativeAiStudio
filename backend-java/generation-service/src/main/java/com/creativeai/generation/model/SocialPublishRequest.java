package com.creativeai.generation.model;

import com.creativeai.generation.social.SocialPlatform;
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
@Table(name = "social_publish_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialPublishRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true, length = 36)
    private String requestId;

    @Column(name = "job_id", nullable = false, length = 64)
    private String jobId;

    @Column(name = "execution_version", nullable = false)
    private Integer executionVersion;

    @Column(name = "output_index", nullable = false)
    private Integer outputIndex;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 30)
    private SocialPlatform platform;

    /** Agent dont les canaux connectés portent les credentials de la plateforme. */
    @Column(name = "agent_id", length = 64)
    private String agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PublishStatus status;

    @Column(name = "caption", length = 2200)
    private String caption;

    @Column(name = "remote_media_id", length = 255)
    private String remoteMediaId;

    @Column(name = "remote_permalink", length = 1000)
    private String remotePermalink;

    @Column(name = "error_code", length = 80)
    private String errorCode;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "attempts", nullable = false)
    private Integer attempts;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) this.status = PublishStatus.PENDING;
        if (this.attempts == null) this.attempts = 0;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
