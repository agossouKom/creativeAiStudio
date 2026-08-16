package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.Workflow;
import com.creativeai.agentteam.model.enums.TriggerType;
import com.creativeai.agentteam.model.enums.WorkflowStatus;
import java.time.LocalDateTime;
import java.util.List;

public record WorkflowResponse(
    String id, String name, String description,
    String teamId, String ownerId,
    WorkflowStatus status, TriggerType triggerType,
    String cronExpression, int currentStepIndex,
    LocalDateTime nextRunAt, LocalDateTime lastRunAt,
    int runCount, String lastError,
    LocalDateTime createdAt, LocalDateTime updatedAt,
    List<WorkflowStepResponse> steps
) {
    public static WorkflowResponse from(Workflow w, List<WorkflowStepResponse> steps) {
        return new WorkflowResponse(w.getId(), w.getName(), w.getDescription(),
            w.getTeamId(), w.getOwnerId(), w.getStatus(), w.getTriggerType(),
            w.getCronExpression(), w.getCurrentStepIndex(),
            w.getNextRunAt(), w.getLastRunAt(), w.getRunCount(), w.getLastError(),
            w.getCreatedAt(), w.getUpdatedAt(), steps);
    }
}
