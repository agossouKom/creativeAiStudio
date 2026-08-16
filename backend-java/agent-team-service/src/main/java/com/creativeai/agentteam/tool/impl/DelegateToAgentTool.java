package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.Priority;
import com.creativeai.agentteam.model.enums.TaskSource;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.model.enums.TaskType;
import com.creativeai.agentteam.orchestrator.AgentOrchestrator;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Étapes 4-6 du workflow :
 * - 4. Assigne la tâche à l'agent (crée un AgentTask en base pour traçabilité)
 * - 5. Déclenche l'exécution (appel orchestrator synchrone)
 * - 6. Récupère et retourne le résultat au Scrum
 */
@Slf4j
@Component
public class DelegateToAgentTool implements AgentTool {

    private final AgentRepository     agentRepo;
    private final AgentTaskRepository taskRepo;
    private final ObjectMapper        objectMapper;

    // @Lazy casse le cycle: AgentOrchestrator → ToolRegistry → DelegateToAgentTool → AgentOrchestrator
    @Lazy
    @Autowired
    private AgentOrchestrator orchestrator;

    public DelegateToAgentTool(AgentRepository agentRepo,
                               AgentTaskRepository taskRepo,
                               ObjectMapper objectMapper) {
        this.agentRepo    = agentRepo;
        this.taskRepo     = taskRepo;
        this.objectMapper = objectMapper;
    }

    @Override public String getName() { return "delegate_to_agent"; }

    @Override
    public String getDescription() {
        return "Délègue une tâche à un agent spécialisé, crée un enregistrement de tâche pour la traçabilité, "
             + "déclenche l'exécution et retourne le résultat. "
             + "Utilise select_agent si tu ne connais pas encore l'ID de l'agent cible.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "targetAgentId": "string (obligatoire) — ID de l'agent à qui déléguer",
              "message":       "string (obligatoire) — instruction complète à transmettre",
              "taskTitle":     "string (optionnel) — titre descriptif de la tâche (ex: 'Envoyer email VIP')",
              "priority":      "string (optionnel) — LOW | MEDIUM | HIGH | CRITICAL (défaut: MEDIUM)",
              "sessionId":     "string (optionnel) — session partagée pour la mémoire"
            }
            """;
    }

    @Override
    public String execute(String callerAgentId, String userId, Map<String, Object> params) {
        String targetAgentId = (String) params.get("targetAgentId");
        String message       = (String) params.get("message");
        String taskTitle     = (String) params.getOrDefault("taskTitle", "Tâche déléguée par le Scrum");
        String priorityStr   = (String) params.getOrDefault("priority", "MEDIUM");
        String sessionId     = params.containsKey("sessionId")
                ? (String) params.get("sessionId")
                : UUID.randomUUID().toString();

        if (targetAgentId == null || targetAgentId.isBlank())
            return "{\"error\":\"targetAgentId est obligatoire\"}";
        if (message == null || message.isBlank())
            return "{\"error\":\"message est obligatoire\"}";
        if (agentRepo.findByIdAndDeletedFalse(targetAgentId).isEmpty())
            return "{\"error\":\"Agent introuvable: " + targetAgentId + "\"}";

        Priority priority = parsePriority(priorityStr);

        // ── Étape 4 : créer le task record (QUEUED) ──────────────────────────
        AgentTask task = AgentTask.builder()
            .userId(userId)
            .assignedAgentId(targetAgentId)
            .requesterAgentId(callerAgentId)
            .title(taskTitle)
            .description(message.length() > 500 ? message.substring(0, 500) + "…" : message)
            .type(TaskType.GENERAL)
            .status(TaskStatus.QUEUED)
            .priority(priority)
            .source(TaskSource.INTER_AGENT)
            .agentGenerated(true)
            .code(generateTaskCode())
            .startedAt(LocalDateTime.now())
            .build();
        task = taskRepo.save(task);
        final String taskId = task.getId();

        log.info("[DELEGATE] step4: task created taskId={} | caller={} → target={}",
            taskId, callerAgentId, targetAgentId);

        // ── Étapes 5-6 : exécuter + récupérer ────────────────────────────────
        try {
            // Marquer IN_PROGRESS
            task.setStatus(TaskStatus.IN_PROGRESS);
            taskRepo.save(task);

            List<String> tokens = orchestrator
                .chatAsSubAgent(targetAgentId, userId, message, sessionId)
                .collectList()
                .block();

            String response = (tokens == null) ? "" : tokens.stream()
                .filter(t -> !"[DONE]".equals(t) && !t.startsWith("[SESSION:"))
                .reduce("", String::concat);

            // Marquer DONE + stocker le résultat
            task.setStatus(TaskStatus.DONE);
            task.setCompletedAt(LocalDateTime.now());
            try { task.setResult(objectMapper.writeValueAsString(Map.of("response", response))); }
            catch (Exception ignored) {}
            taskRepo.save(task);

            log.info("[DELEGATE] step6: task {} DONE | response-length={}", taskId, response.length());

            return objectMapper.writeValueAsString(Map.of(
                "taskId",    taskId,
                "agentId",   targetAgentId,
                "sessionId", sessionId,
                "response",  response,
                "status",    TaskStatus.DONE.name()
            ));
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setErrorMessage(e.getMessage());
            taskRepo.save(task);
            log.error("[DELEGATE] Error calling agent {}: {}", targetAgentId, e.getMessage(), e);
            return "{\"error\":\"Erreur lors de la délégation: " + e.getMessage().replace("\"","'") + "\","
                 + "\"taskId\":\"" + taskId + "\"}";
        }
    }

    private Priority parsePriority(String s) {
        try { return Priority.valueOf(s.toUpperCase()); }
        catch (Exception e) { return Priority.MEDIUM; }
    }

    private String generateTaskCode() {
        String code;
        do { code = String.format("%06d", ThreadLocalRandom.current().nextInt(100000, 1000000)); }
        while (taskRepo.findByCodeAndDeletedFalse(code).isPresent());
        return code;
    }
}
