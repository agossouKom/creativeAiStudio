package com.creativeai.agentteam.dto.response;

import com.creativeai.agentteam.model.InboxMessage;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.InboxStatus;
import com.creativeai.agentteam.model.enums.MessageDirection;

import java.time.LocalDateTime;

public record InboxMessageResponse(
    String id,
    String userId,
    String agentId,
    String teamId,
    ChannelType channel,
    MessageDirection direction,
    String fromAddress,
    String toAddress,
    String subject,
    String body,
    String externalId,
    String conversationId,
    InboxStatus status,
    String attachments,
    String metadata,
    LocalDateTime receivedAt,
    String scrumAgentId,
    String rejectionReason,
    LocalDateTime approvedAt,
    boolean deleted,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    String fileUrl,
    String fileName
) {
    public static InboxMessageResponse from(InboxMessage m) {
        return new InboxMessageResponse(
            m.getId(),
            m.getUserId(),
            m.getAgentId(),
            m.getTeamId(),
            m.getChannel(),
            m.getDirection(),
            m.getFromAddress(),
            m.getToAddress(),
            m.getSubject(),
            m.getBody(),
            m.getExternalId(),
            m.getConversationId(),
            m.getStatus(),
            m.getAttachments(),
            m.getMetadata(),
            m.getReceivedAt(),
            m.getScrumAgentId(),
            m.getRejectionReason(),
            m.getApprovedAt(),
            m.isDeleted(),
            m.getCreatedAt(),
            m.getUpdatedAt(),
            m.getFileUrl(),
            m.getFileName()
        );
    }
}
