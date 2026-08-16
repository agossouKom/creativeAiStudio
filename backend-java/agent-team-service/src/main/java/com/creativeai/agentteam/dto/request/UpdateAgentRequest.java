package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.AgentStatus;
import jakarta.validation.constraints.Size;

public record UpdateAgentRequest(
    @Size(min=2, max=150) String name,
    @Size(max=500) String description,
    AgentStatus status,
    String teamId,
    String extraConfig
) {}
