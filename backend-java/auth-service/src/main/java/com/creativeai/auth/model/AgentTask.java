package com.creativeai.auth.model;

import com.creativeai.auth.model.enums.TaskPriority;
import com.creativeai.auth.model.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "agent_tasks", indexes = {
    @Index(name = "idx_task_user",        columnList = "user_id"),
    @Index(name = "idx_task_user_status", columnList = "user_id, status")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class AgentTask extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 150)
    private String userId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status = TaskStatus.TODO;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    /** Gmail message ID that generated this task */
    @Column(name = "source_email_id", length = 200)
    private String sourceEmailId;

    /** True if the LLM created this via the create_task tool */
    @Builder.Default
    @Column(name = "agent_generated", nullable = false)
    private boolean agentGenerated = false;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
