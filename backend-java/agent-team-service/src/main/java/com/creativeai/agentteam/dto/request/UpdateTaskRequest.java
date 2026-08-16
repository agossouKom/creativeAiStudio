package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskStatus;
import java.time.LocalDateTime;

public record UpdateTaskRequest(
    String title,
    String description,
    TaskStatus status,
    Priority priority,
    String assignedAgentId,
    LocalDateTime dueDate
) {}
