package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "subscription_usage")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SubscriptionUsage {

    @Id
    @Column(nullable = false, updatable = false, length = 36)
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    /** Période mensuelle — format YYYY-MM. */
    @Column(nullable = false, length = 7)
    private String period;

    @Column(name = "tasks_used", nullable = false)
    @Builder.Default
    private int tasksUsed = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }
}
