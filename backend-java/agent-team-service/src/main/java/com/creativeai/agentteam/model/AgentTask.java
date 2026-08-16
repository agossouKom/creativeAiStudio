package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.*;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "agent_tasks", indexes = {
    @Index(name = "idx_task_user",          columnList = "user_id"),
    @Index(name = "idx_task_agent",         columnList = "assigned_agent_id"),
    @Index(name = "idx_task_team",          columnList = "team_id"),
    @Index(name = "idx_task_status",        columnList = "status"),
    @Index(name = "idx_task_priority",      columnList = "priority"),
    @Index(name = "idx_task_user_status",   columnList = "user_id, status"),
    @Index(name = "idx_task_due",           columnList = "due_date")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentTask extends BaseEntity {

    @Column(nullable = false, unique = true, length = 6)
    private String code;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private TaskType type = TaskType.GENERAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TaskStatus status = TaskStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    @Builder.Default
    private Priority priority = Priority.MEDIUM;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "team_id", length = 36)
    private String teamId;

    @Column(name = "assigned_agent_id", length = 36)
    private String assignedAgentId;

    @Column(name = "requester_agent_id", length = 36)
    private String requesterAgentId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private TaskSource source = TaskSource.MANUAL;

    /** Données d'entrée (email ID, image URL, prompt…) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String payload;

    /** Résultat de l'exécution */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String result;

    /** IDs des publications sociales créées par l'agent — JSON map {"FACEBOOK":"postId","INSTAGRAM":"postId"} */
    @Column(name = "social_post_ids", columnDefinition = "text")
    private String socialPostIds;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "parent_task_id", length = 36)
    private String parentTaskId;

    /** IDs des tâches enfants JSON array */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "child_task_ids", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String childTaskIds = "[]";

    @Builder.Default
    @Column(name = "agent_generated", nullable = false)
    private boolean agentGenerated = false;

    @Builder.Default
    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "workflow_id", length = 36)
    private String workflowId;

    @Column(name = "workflow_step_id", length = 36)
    private String workflowStepId;

    /** Date/heure d'exécution programmée (null = immédiat). */
    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    /** Contacts ciblés — liste JSON [{email, phone, name}]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "contacts", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String contacts;

    /** Résultat attendu défini par l'utilisateur. */
    @Column(name = "expected_result", columnDefinition = "text")
    private String expectedResult;

    /** Tâche confidentielle. */
    @Builder.Default
    @Column(name = "confidential", nullable = false)
    private boolean confidential = false;

    // ── Promotion produit ─────────────────────────────────────────────────────

    /** Codes uniques des produits à promouvoir (JSON array: ["CODE1","CODE2"]). */
    @Column(name = "product_codes", columnDefinition = "text")
    private String productCodes;

    /** Snapshot JSON des produits au moment de la création. */
    @Column(name = "product_snapshot", columnDefinition = "text")
    private String productSnapshot;

    /** Plateformes cibles (JSON array: ["INSTAGRAM","FACEBOOK","TIKTOK"]). */
    @Column(name = "platforms", columnDefinition = "text")
    private String platforms;

    /** Hashtags personnalisés (#promo #nouveauté …). */
    @Column(name = "hashtags", length = 500)
    private String hashtags;

    /** Ton souhaité : dynamique, professionnel, humoristique… */
    @Column(name = "tone", length = 50)
    private String tone;

    /** Objectif de campagne : VENTES, NOTORIETE, ENGAGEMENT. */
    @Column(name = "campaign_objective", length = 50)
    private String campaignObjective;
}
