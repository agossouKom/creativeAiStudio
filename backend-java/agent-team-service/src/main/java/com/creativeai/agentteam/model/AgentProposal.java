package com.creativeai.agentteam.model;

import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.model.enums.ProposalStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Proposition de création d'agent initiée par un agent orchestrateur (SCRUM_MASTER).
 * Statut PENDING tant que le patron n'a pas validé (APPROVED) ou refusé (REFUSED).
 * L'agent réel n'est créé qu'après approbation.
 */
@Entity
@Table(name = "agent_proposals", indexes = {
    @Index(name = "idx_agent_prop_user_status", columnList = "user_id, status"),
    @Index(name = "idx_agent_prop_team", columnList = "team_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AgentProposal extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "agent_type", nullable = false, length = 30)
    private AgentType agentType;

    @Column(length = 150)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "team_id", length = 36)
    private String teamId;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "requester_agent_id", length = 36)
    private String requesterAgentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ProposalStatus status = ProposalStatus.PENDING;

    @Column(name = "agent_id", length = 36)
    private String agentId;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
}