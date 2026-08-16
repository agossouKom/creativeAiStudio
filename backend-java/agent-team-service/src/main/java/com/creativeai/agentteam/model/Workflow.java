package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.TriggerType;
import com.creativeai.agentteam.model.enums.WorkflowStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "workflows", indexes = {
    @Index(name = "idx_wf_team",       columnList = "team_id"),
    @Index(name = "idx_wf_status",     columnList = "status"),
    @Index(name = "idx_wf_next_run",   columnList = "next_run_at")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Workflow extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(name = "team_id", length = 36)
    private String teamId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private String ownerId;

    @Column(name = "trigger_agent_id", length = 36)
    private String triggerAgentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private WorkflowStatus status = WorkflowStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 20)
    @Builder.Default
    private TriggerType triggerType = TriggerType.MANUAL;

    @Column(name = "cron_expression", length = 100)
    private String cronExpression;

    @Builder.Default
    @Column(name = "current_step_index", nullable = false)
    private int currentStepIndex = 0;

    /** Contexte partagé entre les étapes (JSON) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String context;

    @Column(name = "next_run_at")
    private LocalDateTime nextRunAt;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Builder.Default
    @Column(name = "run_count", nullable = false)
    private int runCount = 0;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @OneToMany(mappedBy = "workflow", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    @Builder.Default
    private List<WorkflowStep> steps = new ArrayList<>();
}
