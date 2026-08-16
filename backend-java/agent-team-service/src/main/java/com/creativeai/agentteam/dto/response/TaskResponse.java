package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.*;
import java.time.LocalDateTime;

public record TaskResponse(
    String id, String code, String title, String description,
    TaskType type, TaskStatus status, Priority priority,
    TaskSource source, String userId, String teamId,
    String assignedAgentId, String requesterAgentId,
    String payload, String result,
    LocalDateTime dueDate, LocalDateTime scheduledAt,
    LocalDateTime startedAt, LocalDateTime completedAt,
    String parentTaskId, String childTaskIds,
    boolean agentGenerated, int retryCount, String errorMessage,
    String contacts, String expectedResult, boolean confidential,
    // Promotion produit
    String productCodes, String productSnapshot,
    String platforms, String hashtags, String tone, String campaignObjective,
    LocalDateTime createdAt, LocalDateTime updatedAt,
    String socialPostIds
) {
    public static TaskResponse from(AgentTask t) {
        return new TaskResponse(t.getId(), t.getCode(), t.getTitle(), t.getDescription(),
            t.getType(), t.getStatus(), t.getPriority(), t.getSource(),
            t.getUserId(), t.getTeamId(), t.getAssignedAgentId(), t.getRequesterAgentId(),
            t.getPayload(), t.getResult(),
            t.getDueDate(), t.getScheduledAt(),
            t.getStartedAt(), t.getCompletedAt(),
            t.getParentTaskId(), t.getChildTaskIds(),
            t.isAgentGenerated(), t.getRetryCount(), t.getErrorMessage(),
            t.getContacts(), t.getExpectedResult(), t.isConfidential(),
            t.getProductCodes(), t.getProductSnapshot(),
            t.getPlatforms(), t.getHashtags(), t.getTone(), t.getCampaignObjective(),
            t.getCreatedAt(), t.getUpdatedAt(),
            t.getSocialPostIds());
    }
}
