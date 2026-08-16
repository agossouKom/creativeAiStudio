package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.InboxMessageRequest;
import com.creativeai.agentteam.dto.response.InboxMessageResponse;
import com.creativeai.agentteam.model.InboxMessage;
import com.creativeai.agentteam.model.enums.ChannelType;
import com.creativeai.agentteam.model.enums.InboxStatus;
import com.creativeai.agentteam.model.enums.MessageDirection;
import com.creativeai.agentteam.repository.InboxMessageRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InboxService {

    private final InboxMessageRepository inboxRepo;
    private final AuditService           auditService;
    private final ObjectMapper           objectMapper;
    @Lazy private final ChannelSenderService channelSenderService;

    // ── Recherche / Lecture ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<InboxMessageResponse> search(
            String userId,
            String agentId,
            String teamId,
            ChannelType channel,
            InboxStatus status,
            MessageDirection direction,
            String conversationId,
            String search,
            Pageable pageable) {
        return inboxRepo.search(
            userId,
            agentId,
            teamId,
            channel  != null ? channel.name()    : null,
            status   != null ? status.name()     : null,
            direction != null ? direction.name() : null,
            conversationId,
            search,
            pageable
        ).map(InboxMessageResponse::from);
    }

    @Transactional(readOnly = true)
    public InboxMessageResponse getMessage(String userId, String messageId) {
        return InboxMessageResponse.from(resolve(userId, messageId));
    }

    @Transactional(readOnly = true)
    public Page<InboxMessageResponse> listDeleted(String userId, Pageable pageable) {
        return inboxRepo.findDeletedByUserId(userId, pageable)
            .map(InboxMessageResponse::from);
    }

    public long countUnread(String userId) {
        return inboxRepo.countByUserIdAndStatusAndDeletedFalse(userId, InboxStatus.UNREAD);
    }

    // ── Création (message sortant ou import manuel) ───────────────────────────

    @Transactional
    public InboxMessageResponse createMessage(String userId, InboxMessageRequest req) {
        InboxMessage msg = InboxMessage.builder()
            .userId(userId)
            .agentId(req.agentId())
            .teamId(req.teamId())
            .channel(req.channel())
            .direction(req.direction() != null ? req.direction() : MessageDirection.OUTBOUND)
            .fromAddress(req.fromAddress())
            .toAddress(req.toAddress())
            .subject(req.subject())
            .body(req.body())
            .conversationId(req.conversationId())
            .attachments(req.attachments())
            .metadata(req.metadata())
            .fileUrl(req.fileUrl())
            .fileName(req.fileName())
            .status(InboxStatus.UNREAD)
            .build();
        InboxMessage saved = inboxRepo.save(msg);
        log.info("Inbox message created: channel={} direction={} userId={}", req.channel(), msg.getDirection(), userId);
        return InboxMessageResponse.from(saved);
    }

    // ── Mise à jour du statut ─────────────────────────────────────────────────

    @Transactional
    public InboxMessageResponse updateStatus(String userId, String messageId, InboxStatus newStatus) {
        InboxMessage msg = resolve(userId, messageId);
        InboxStatus prev = msg.getStatus();
        msg.setStatus(newStatus);
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "UPDATE_INBOX_STATUS", "inbox", messageId, true,
            AuditService.details("from", prev, "to", newStatus, "channel", msg.getChannel()));
        return InboxMessageResponse.from(saved);
    }

    // ── Soft-delete / Restore ─────────────────────────────────────────────────

    @Transactional
    public void deleteMessage(String userId, String messageId) {
        InboxMessage msg = resolve(userId, messageId);
        msg.setDeleted(true);
        inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "DELETE_INBOX", "inbox", messageId, true,
            AuditService.details("channel", msg.getChannel(), "softDelete", true));
    }

    @Transactional
    public InboxMessageResponse restoreMessage(String userId, String messageId) {
        InboxMessage msg = inboxRepo.findById(messageId)
            .filter(m -> m.getUserId().equals(userId) && m.isDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Message supprimé introuvable : " + messageId));
        msg.setDeleted(false);
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "RESTORE_INBOX", "inbox", messageId, true,
            AuditService.details("channel", msg.getChannel()));
        return InboxMessageResponse.from(saved);
    }

    // ── Approbation / Rejet ───────────────────────────────────────────────────

    @Transactional
    public InboxMessageResponse prepareReply(String userId, String messageId, String replySubject, String replyBody) {
        InboxMessage msg = resolve(userId, messageId);
        msg.setStatus(InboxStatus.PENDING_APPROVAL);
        msg.setMetadata(writeReplyMetadata(msg.getMetadata(), replySubject, replyBody));
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "PREPARE_INBOX_REPLY", "inbox", messageId, true,
            AuditService.details("channel", msg.getChannel(), "replySubject", replySubject));
        return InboxMessageResponse.from(saved);
    }

    @Transactional
    public InboxMessageResponse sendReply(String userId, String messageId, String replySubject, String replyBody) {
        InboxMessage msg = resolve(userId, messageId);
        if (!StringUtils.hasText(replyBody)) {
            throw new IllegalArgumentException("Le corps de la réponse est requis");
        }
        String subject = StringUtils.hasText(replySubject)
            ? replySubject
            : (StringUtils.hasText(msg.getSubject()) ? "Re: " + msg.getSubject() : "Réponse");
        var result = channelSenderService.sendEmail(
            userId,
            msg.getAgentId(),
            msg.getFromAddress(),
            subject,
            replyBody,
            msg.getConversationId()
        );
        if (!result.success()) {
            throw new IllegalStateException(result.error() != null ? result.error() : "Échec de l'envoi de la réponse");
        }
        msg.setStatus(InboxStatus.REPLIED);
        msg.setMetadata(writeReplyMetadata(msg.getMetadata(), subject, replyBody));
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "SEND_INBOX_REPLY", "inbox", messageId, true,
            AuditService.details("channel", msg.getChannel(), "subject", subject));
        return InboxMessageResponse.from(saved);
    }

    @Transactional
    public InboxMessageResponse approve(String userId, String messageId) {
        InboxMessage msg = resolve(userId, messageId);
        String pendingReplyBody = readReplyBody(msg.getMetadata());
        String pendingReplySubject = readReplySubject(msg.getMetadata());
        if (msg.getStatus() == InboxStatus.PENDING_APPROVAL && StringUtils.hasText(pendingReplyBody)) {
            var result = channelSenderService.sendEmail(
                userId,
                msg.getAgentId(),
                msg.getFromAddress(),
                StringUtils.hasText(pendingReplySubject) ? pendingReplySubject : (StringUtils.hasText(msg.getSubject()) ? "Re: " + msg.getSubject() : "Réponse"),
                pendingReplyBody,
                msg.getConversationId()
            );
            if (!result.success()) {
                throw new IllegalStateException(result.error() != null ? result.error() : "Échec de l'envoi après approbation");
            }
            msg.setStatus(InboxStatus.REPLIED);
            msg.setApprovedAt(java.time.LocalDateTime.now());
            msg.setMetadata(writeReplyMetadata(msg.getMetadata(), pendingReplySubject, pendingReplyBody));
            InboxMessage saved = inboxRepo.save(msg);
            auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
                "APPROVE_INBOX", "inbox", messageId, true,
                AuditService.details("channel", msg.getChannel(), "sent", true));
            return InboxMessageResponse.from(saved);
        }
        msg.setStatus(InboxStatus.APPROVED);
        msg.setApprovedAt(java.time.LocalDateTime.now());
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "APPROVE_INBOX", "inbox", messageId, true,
            AuditService.details("channel", msg.getChannel()));
        return InboxMessageResponse.from(saved);
    }

    @Transactional
    public InboxMessageResponse reject(String userId, String messageId, String reason) {
        InboxMessage msg = resolve(userId, messageId);
        msg.setStatus(InboxStatus.REJECTED);
        msg.setRejectionReason(reason);
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, msg.getAgentId(), msg.getTeamId(),
            "REJECT_INBOX", "inbox", messageId, true,
            AuditService.details("channel", msg.getChannel(), "reason", reason));
        return InboxMessageResponse.from(saved);
    }

    // ── Livraison de résultat (clôture automatique, sans approbation) ──────────

    /**
     * Appelé par DeliverResultTool : enregistre l'agent Scrum qui a livré
     * et place le message en UNREAD dans l'inbox du patron.
     */
    @Transactional
    public InboxMessageResponse markAsDelivered(String userId, String messageId, String scrumAgentId) {
        InboxMessage msg = resolve(userId, messageId);
        msg.setScrumAgentId(scrumAgentId);
        InboxMessage saved = inboxRepo.save(msg);
        auditService.log(userId, scrumAgentId, msg.getTeamId(),
            "DELIVER_RESULT", "inbox", messageId, true,
            AuditService.details("scrumAgentId", scrumAgentId));
        log.info("[INBOX] Rapport de clôture {} livré par agent {}", messageId, scrumAgentId);
        return InboxMessageResponse.from(saved);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private InboxMessage resolve(String userId, String messageId) {
        return inboxRepo.findById(messageId)
            .filter(m -> m.getUserId().equals(userId) && !m.isDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Message introuvable : " + messageId));
    }

    private String writeReplyMetadata(String existingMetadata, String replySubject, String replyBody) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (StringUtils.hasText(existingMetadata)) {
            try {
                payload = objectMapper.readValue(existingMetadata, new TypeReference<>() {});
            } catch (Exception ignored) {
                payload = new LinkedHashMap<>();
            }
        }
        payload.put("replySubject", replySubject);
        payload.put("replyBody", replyBody);
        payload.put("replyDraftedAt", java.time.LocalDateTime.now().toString());
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("Failed to serialize inbox reply metadata: {}", e.getMessage());
            return existingMetadata;
        }
    }

    private String readReplyBody(String metadata) {
        if (!StringUtils.hasText(metadata)) return null;
        try {
            Map<String, Object> payload = objectMapper.readValue(metadata, new TypeReference<Map<String, Object>>() {});
            Object body = payload.get("replyBody");
            return body instanceof String s ? s : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String readReplySubject(String metadata) {
        if (!StringUtils.hasText(metadata)) return null;
        try {
            Map<String, Object> payload = objectMapper.readValue(metadata, new TypeReference<Map<String, Object>>() {});
            Object subject = payload.get("replySubject");
            return subject instanceof String s ? s : null;
        } catch (Exception e) {
            return null;
        }
    }
}
