package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.AuditLog;
import java.time.LocalDateTime;

public record AuditLogResponse(
    String id,
    String userId,
    String agentId,
    String teamId,
    String action,
    String resource,
    String resourceId,
    String details,
    boolean success,
    String errorMessage,
    LocalDateTime timestamp
) {
    public static AuditLogResponse from(AuditLog a) {
        return new AuditLogResponse(
            a.getId(), a.getUserId(), a.getAgentId(), a.getTeamId(),
            a.getAction(), a.getResource(), a.getResourceId(),
            a.getDetails(), a.isSuccess(), a.getErrorMessage(),
            a.getTimestamp()
        );
    }
}
