package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.CollaborationMode;
import com.creativeai.agentteam.model.enums.TeamStatus;
import com.creativeai.agentteam.model.enums.TeamType;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "agent_teams", indexes = {
    @Index(name = "idx_team_org",    columnList = "organization_id"),
    @Index(name = "idx_team_status", columnList = "status")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentTeam extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TeamType type = TeamType.BUSINESS;

    @Column(name = "organization_id", length = 36)
    private String organizationId;

    @Column(name = "owner_id", nullable = false, length = 36)
    private String ownerId;

    @Column(name = "lead_agent_id", length = 36)
    private String leadAgentId;

    @Column(name = "creative_lead_agent_id", length = 36)
    private String creativeLeadAgentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TeamStatus status = TeamStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "collaboration_mode", nullable = false, length = 20)
    @Builder.Default
    private CollaborationMode collaborationMode = CollaborationMode.HYBRID;

    @Builder.Default
    @Column(name = "shared_memory_enabled", nullable = false)
    private boolean sharedMemoryEnabled = true;

    @Builder.Default
    @Column(name = "shared_knowledge_enabled", nullable = false)
    private boolean sharedKnowledgeEnabled = false;

    @Builder.Default
    @Column(name = "max_concurrent_tasks", nullable = false)
    private int maxConcurrentTasks = 10;

    /** IDs des membres (agents) JSON array */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "member_agent_ids", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    @Builder.Default
    private String memberAgentIds = "[]";

    /** Règles d'escalade JSON */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "escalation_rules", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String escalationRules;

    /** Config notifications JSON */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "notification_config", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String notificationConfig;
}
