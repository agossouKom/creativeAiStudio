package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class UpdateTaskStatusTool implements AgentTool {

    private final AgentTaskRepository taskRepo;
    private final ObjectMapper        om;

    @Override public String getName() { return "update_task_status"; }

    @Override
    public String getDescription() {
        return "Met à jour le statut d'une tâche existante. "
             + "Statuts disponibles : PENDING, IN_PROGRESS, DONE, FAILED, CANCELLED. "
             + "Utilise cet outil pour marquer une tâche patron comme IN_PROGRESS quand tu commences à la traiter, "
             + "puis DONE quand le travail est terminé.";
    }

    @Override
    public String getParametersSchema() {
        return "{\"taskId\":\"string (obligatoire) — UUID de la tâche à mettre à jour\","
             + "\"status\":\"string (obligatoire) — IN_PROGRESS | DONE | FAILED | CANCELLED\","
             + "\"errorMessage\":\"string (optionnel) — message d'erreur si status=FAILED\"}";
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> params) {
        String taskId    = (String) params.get("taskId");
        String statusStr = (String) params.get("status");

        if (taskId == null || taskId.isBlank())
            return "{\"error\":\"taskId est obligatoire\"}";
        if (statusStr == null || statusStr.isBlank())
            return "{\"error\":\"status est obligatoire\"}";

        TaskStatus newStatus;
        try { newStatus = TaskStatus.valueOf(statusStr.toUpperCase()); }
        catch (Exception e) { return "{\"error\":\"Statut invalide: " + statusStr + "\"}"; }

        return taskRepo.findByIdAndDeletedFalse(taskId)
            .map(task -> {
                TaskStatus oldStatus = task.getStatus();
                task.setStatus(newStatus);
                switch (newStatus) {
                    case IN_PROGRESS -> { if (task.getStartedAt() == null) task.setStartedAt(LocalDateTime.now()); }
                    case DONE        -> task.setCompletedAt(LocalDateTime.now());
                    case FAILED      -> {
                        task.setCompletedAt(LocalDateTime.now());
                        String errMsg = (String) params.getOrDefault("errorMessage", "Échec lors du traitement");
                        task.setErrorMessage(errMsg);
                    }
                    default -> {}
                }
                taskRepo.save(task);
                log.info("[UPDATE_TASK_STATUS] taskId={} {} → {}", taskId, oldStatus, newStatus);
                try {
                    return om.writeValueAsString(Map.of(
                        "taskId", taskId, "oldStatus", oldStatus.name(), "newStatus", newStatus.name(), "success", true
                    ));
                } catch (Exception ex) {
                    return "{\"success\":true,\"taskId\":\"" + taskId + "\"}";
                }
            })
            .orElse("{\"error\":\"Tâche introuvable: " + taskId + "\"}");
    }
}
