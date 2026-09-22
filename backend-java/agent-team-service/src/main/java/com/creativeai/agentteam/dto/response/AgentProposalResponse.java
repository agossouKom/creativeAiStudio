package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.AgentProposal;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.model.enums.ProposalStatus;

import java.time.LocalDateTime;

public record AgentProposalResponse(
    String id,
    AgentType agentType,
    String name,
    String description,
    String teamId,
    String teamName,
    String requesterAgentName,
    ProposalStatus status,
    String agentId,
    LocalDateTime createdAt
) {
    public static AgentProposalResponse from(AgentProposal p, String teamName, String requesterAgentName) {
        return new AgentProposalResponse(
            p.getId(),
            p.getAgentType(),
            p.getName(),
            p.getDescription(),
            p.getTeamId(),
            teamName,
            requesterAgentName,
            p.getStatus(),
            p.getAgentId(),
            p.getCreatedAt()
        );
    }
}