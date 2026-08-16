package com.creativeai.auth.dto.agent;
import java.time.LocalDateTime;
public record AgentTaskResponse(String id, String title, String description, String status, String priority, LocalDateTime dueDate, boolean agentGenerated, LocalDateTime createdAt, LocalDateTime completedAt) {}
