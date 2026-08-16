package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.AgentMemory;
import com.creativeai.agentteam.model.enums.MemoryType;
import com.creativeai.agentteam.model.enums.MessageRole;
import java.time.LocalDateTime;

public record MemoryResponse(
    String id, String agentId, String sessionId,
    MessageRole role, String content, String toolName,
    long sequenceNumber, MemoryType memoryType,
    LocalDateTime createdAt
) {
    public static MemoryResponse from(AgentMemory m) {
        return new MemoryResponse(m.getId(), m.getAgentId(), m.getSessionId(),
            m.getRole(), m.getContent(), m.getToolName(),
            m.getSequenceNumber(), m.getMemoryType(), m.getCreatedAt());
    }
}
