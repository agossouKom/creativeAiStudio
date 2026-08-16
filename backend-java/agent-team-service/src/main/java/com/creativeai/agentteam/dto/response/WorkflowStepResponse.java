package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.WorkflowStep;
import com.creativeai.agentteam.model.enums.ActionType;

public record WorkflowStepResponse(
    String id, int stepOrder, String name,
    String agentId, ActionType actionType,
    String config, String conditions,
    String onSuccessStepId, String onFailureStepId,
    int timeoutSeconds, boolean parallel, int retryCount
) {
    public static WorkflowStepResponse from(WorkflowStep s) {
        return new WorkflowStepResponse(s.getId(), s.getStepOrder(), s.getName(),
            s.getAgentId(), s.getActionType(), s.getConfig(), s.getConditions(),
            s.getOnSuccessStepId(), s.getOnFailureStepId(),
            s.getTimeoutSeconds(), s.isParallel(), s.getRetryCount());
    }
}
