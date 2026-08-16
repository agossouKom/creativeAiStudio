package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import java.time.LocalDateTime;

public record AgentResponse(
    String id, String name, String slug, String code, String description,
    AgentType type, AgentStatus status,
    String teamId, String ownerId,
    LocalDateTime lastActiveAt,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static AgentResponse from(Agent a) {
        return new AgentResponse(a.getId(), a.getName(), a.getSlug(), a.getCode(), a.getDescription(),
            a.getType(), a.getStatus(), a.getTeamId(), a.getOwnerId(),
            a.getLastActiveAt(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
