package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import java.time.LocalDateTime;

public record AgentResponse(
    String id, String name, String slug, String code, String description,
    AgentType type, AgentStatus status,
    String teamId, String ownerId,
    /**
     * Agent « Studio » créé automatiquement dans le compte. L'interface
     * l'affiche dans le filtre de chaque équipe, puisqu'il n'appartient à
     * aucune équipe en particulier.
     */
    boolean defaultSystem,
    LocalDateTime lastActiveAt,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static AgentResponse from(Agent a) {
        return new AgentResponse(a.getId(), a.getName(), a.getSlug(), a.getCode(), a.getDescription(),
            a.getType(), a.getStatus(), a.getTeamId(), a.getOwnerId(), a.isDefaultSystem(),
            a.getLastActiveAt(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
