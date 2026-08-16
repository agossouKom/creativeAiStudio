package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.AgentTeam;
import com.creativeai.agentteam.model.enums.CollaborationMode;
import com.creativeai.agentteam.model.enums.TeamStatus;
import com.creativeai.agentteam.model.enums.TeamType;
import java.time.LocalDateTime;

public record TeamResponse(
    String id, String name, String description,
    TeamType type, TeamStatus status,
    String ownerId, String organizationId,
    String leadAgentId, String creativeLeadAgentId,
    CollaborationMode collaborationMode,
    boolean sharedMemoryEnabled, int maxConcurrentTasks,
    String memberAgentIds,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static TeamResponse from(AgentTeam t) {
        return new TeamResponse(t.getId(), t.getName(), t.getDescription(),
            t.getType(), t.getStatus(), t.getOwnerId(), t.getOrganizationId(),
            t.getLeadAgentId(), t.getCreativeLeadAgentId(), t.getCollaborationMode(),
            t.isSharedMemoryEnabled(), t.getMaxConcurrentTasks(), t.getMemberAgentIds(),
            t.getCreatedAt(), t.getUpdatedAt());
    }
}
