package com.creativeai.agentteam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "agents", indexes = {
    @Index(name = "idx_agent_owner",  columnList = "owner_id"),
    @Index(name = "idx_agent_team",   columnList = "team_id"),
    @Index(name = "idx_agent_type",   columnList = "type"),
    @Index(name = "idx_agent_status", columnList = "status"),
    @Index(name = "idx_agent_slug",   columnList = "slug", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Agent extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(nullable = false, unique = true, length = 6)
    private String code;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AgentType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private AgentStatus status = AgentStatus.ACTIVE;

    @Column(name = "owner_id", nullable = false, length = 36)
    private String ownerId;

    @Column(name = "team_id", length = 36)
    private String teamId;

    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;

    /** Config spécifique au type d'agent, stockée en JSON (flexible, évolutif) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_config", columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String extraConfig;

    // Relations
    // JsonIgnore : Agent et AgentConfig se referencent mutuellement
    // (config->agent, agent->config). Sans ca, serialiser une entite qui
    // porte une de ces relations part en recursion infinie et renvoie un
    // JSON coupe. Symptome observe sur GET /api/agents/{id}/prompts, qui
    // renvoyait 600 Ko de JSON invalide avant correction.
    @JsonIgnore
    @OneToOne(mappedBy = "agent", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private AgentConfig config;

    @OneToOne(mappedBy = "agent", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private AgentProfile profile;

    @OneToOne(mappedBy = "agent", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private KnowledgeBase knowledgeBase;
}
