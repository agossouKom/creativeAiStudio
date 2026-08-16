package com.creativeai.agentteam.dto.request;

import com.creativeai.agentteam.model.enums.ActionType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WorkflowStepRequest(
    @Min(0) int stepOrder,
    @NotBlank String name,
    @NotBlank String agentId,
    @NotNull ActionType actionType,
    String config,
    String conditions,
    String onSuccessStepId,
    String onFailureStepId,
    Integer timeoutSeconds,
    Boolean parallel
) {}
