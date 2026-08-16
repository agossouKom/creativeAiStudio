package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.ColumnTransformer;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_agent",     columnList = "agent_id"),
    @Index(name = "idx_audit_user",      columnList = "user_id"),
    @Index(name = "idx_audit_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_resource",  columnList = "resource, resource_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(name = "agent_id", length = 36)
    private String agentId;

    @Column(name = "user_id", length = 36)
    private String userId;

    @Column(name = "team_id", length = 36)
    private String teamId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(length = 100)
    private String resource;

    @Column(name = "resource_id", length = 36)
    private String resourceId;

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "CAST(? AS TEXT)::jsonb")
    private String details;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "trace_id", length = 100)
    private String traceId;

    @Builder.Default
    @Column(nullable = false)
    private boolean success = true;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void prePersist() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
    }
}
