package com.creativeai.agentteam.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "task_execution_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskExecutionEvent {

    @Id
    @Column(nullable = false, updatable = false, columnDefinition = "uuid")
    @Builder.Default
    private UUID id = UUID.randomUUID();

    @Column(name = "task_id", nullable = false, length = 36)
    private String taskId;

    @Column(name = "agent_id", length = 36)
    private String agentId;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    /** TASK_STARTED | TOOL_CALLED | TOOL_RESULT | LLM_CALL | EMAIL_SENT
     *  TASK_COMPLETED | TASK_FAILED | DELEGATION | WHATSAPP_SENT | SOCIAL_POSTED */
    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "tool_name", length = 100)
    private String toolName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_data", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String eventData;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
