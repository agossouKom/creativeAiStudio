package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.CollaborationMode;
import com.creativeai.agentteam.model.enums.TeamStatus;
import java.util.List;

public record UpdateTeamRequest(
    String name,
    String description,
    TeamStatus status,
    String leadAgentId,
    String creativeLeadAgentId,
    CollaborationMode collaborationMode,
    Boolean sharedMemoryEnabled,
    Integer maxConcurrentTasks,
    List<String> memberAgentIds,
    String escalationRules
) {}
