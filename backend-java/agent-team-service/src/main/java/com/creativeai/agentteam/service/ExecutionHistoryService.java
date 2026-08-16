package com.creativeai.agentteam.service;

import com.creativeai.agentteam.model.TaskExecutionEvent;
import com.creativeai.agentteam.repository.TaskExecutionEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Trace les actions agent dans task_execution_events.
 *
 * Toutes les méthodes sont @Async pour ne pas bloquer le thread agent principal.
 * Les erreurs d'enregistrement sont avalées (non critiques).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionHistoryService {

    private final TaskExecutionEventRepository repo;
    private final ObjectMapper objectMapper;

    // ── Enregistrement d'événements ───────────────────────────────────────────

    @Async
    public void logTaskStarted(String taskId, String agentId, String userId) {
        save(taskId, agentId, userId, "TASK_STARTED", null,
            Map.of("agentId", nvl(agentId)));
    }

    @Async
    public void logTaskCompleted(String taskId, String agentId, String userId, String summary) {
        save(taskId, agentId, userId, "TASK_COMPLETED", null,
            Map.of("summary", nvl(summary)));
    }

    @Async
    public void logTaskFailed(String taskId, String agentId, String userId, String error) {
        save(taskId, agentId, userId, "TASK_FAILED", null,
            Map.of("error", nvl(error)));
    }

    @Async
    public void logToolCall(String taskId, String agentId, String userId,
                            String toolName, Map<String, Object> params) {
        save(taskId, agentId, userId, "TOOL_CALLED", toolName,
            Map.of("params", params != null ? params : Map.of()));
    }

    @Async
    public void logToolResult(String taskId, String agentId, String userId,
                              String toolName, String result) {
        save(taskId, agentId, userId, "TOOL_RESULT", toolName,
            Map.of("result", truncate(result, 2000)));
    }

    @Async
    public void logEmailSent(String taskId, String agentId, String userId,
                             String to, String subject, String messageId) {
        save(taskId, agentId, userId, "EMAIL_SENT", "send_email",
            Map.of("to", nvl(to), "subject", nvl(subject), "messageId", nvl(messageId)));
    }

    @Async
    public void logDelegation(String taskId, String agentId, String userId,
                              String targetAgentId, String message) {
        save(taskId, agentId, userId, "DELEGATION", "delegate_to_agent",
            Map.of("targetAgentId", nvl(targetAgentId), "message", truncate(message, 500)));
    }

    @Async
    public void logSocialPost(String taskId, String agentId, String userId,
                              String platform, String content) {
        save(taskId, agentId, userId, "SOCIAL_POSTED", "post_social",
            Map.of("platform", nvl(platform), "content", truncate(content, 500)));
    }

    // ── Lecture ───────────────────────────────────────────────────────────────

    public List<TaskExecutionEvent> getTaskTimeline(String taskId) {
        return repo.findByTaskIdOrderByCreatedAtAsc(taskId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void save(String taskId, String agentId, String userId,
                      String eventType, String toolName, Object data) {
        if (taskId == null || userId == null) return;
        try {
            String json = objectMapper.writeValueAsString(data);
            repo.save(TaskExecutionEvent.builder()
                .taskId(taskId)
                .agentId(agentId)
                .userId(userId)
                .eventType(eventType)
                .toolName(toolName)
                .eventData(json)
                .build());
        } catch (Exception e) {
            log.warn("[HISTORY] Impossible d'enregistrer l'événement {} pour taskId={}: {}",
                eventType, taskId, e.getMessage());
        }
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
