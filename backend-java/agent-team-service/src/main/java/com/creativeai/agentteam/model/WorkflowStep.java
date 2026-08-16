package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.ActionType;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

@Entity
@Table(name = "workflow_steps", indexes = {
    @Index(name = "idx_wf_step_wf", columnList = "workflow_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkflowStep extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_id", nullable = false)
    private Workflow workflow;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "agent_id", nullable = false, length = 36)
    private String agentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 30)
    private ActionType actionType;

    /** Config JSON de l'étape (prompt, paramètres outil…) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String config;

    /** Conditions d'activation JSON */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "conditions", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String conditions;

    @Column(name = "on_success_step_id", length = 36)
    private String onSuccessStepId;

    @Column(name = "on_failure_step_id", length = 36)
    private String onFailureStepId;

    @Column(name = "on_timeout_step_id", length = 36)
    private String onTimeoutStepId;

    @Builder.Default
    @Column(name = "timeout_seconds", nullable = false)
    private int timeoutSeconds = 120;

    @Builder.Default
    @Column(nullable = false)
    private boolean parallel = false;

    @Builder.Default
    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;
}
