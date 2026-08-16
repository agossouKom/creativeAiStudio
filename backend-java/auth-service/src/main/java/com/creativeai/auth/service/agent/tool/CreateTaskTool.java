package com.creativeai.auth.service.agent.tool;

import com.creativeai.auth.model.AgentTask;
import com.creativeai.auth.model.enums.TaskPriority;
import com.creativeai.auth.repository.AgentTaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CreateTaskTool implements AgentTool {

    private final AgentTaskRepository taskRepo;
    private final ObjectMapper        objectMapper;

    @Override public String getName()        { return "create_task"; }
    @Override public String getDescription() {
        return "Crée une tâche. Paramètres: title (string), description (string, optionnel), " +
               "priority (LOW|MEDIUM|HIGH|CRITICAL, défaut MEDIUM), dueDate (ISO datetime, optionnel), " +
               "sourceEmailId (string, optionnel).";
    }

    @Override
    public String execute(String userId, Map<String, Object> params) {
        String title = (String) params.get("title");
        if (title == null || title.isBlank())
            return "{\"error\": \"title requis\"}";

        TaskPriority priority = TaskPriority.MEDIUM;
        try { priority = TaskPriority.valueOf(((String) params.getOrDefault("priority","MEDIUM")).toUpperCase()); }
        catch (Exception ignored) {}

        LocalDateTime dueDate = null;
        if (params.containsKey("dueDate")) {
            try { dueDate = LocalDateTime.parse((String) params.get("dueDate"), DateTimeFormatter.ISO_DATE_TIME); }
            catch (Exception ignored) {}
        }

        AgentTask task = AgentTask.builder()
            .userId(userId)
            .title(title)
            .description((String) params.getOrDefault("description", null))
            .priority(priority)
            .dueDate(dueDate)
            .sourceEmailId((String) params.getOrDefault("sourceEmailId", null))
            .agentGenerated(true)
            .build();

        task = taskRepo.save(task);

        try {
            return objectMapper.writeValueAsString(
                Map.of("taskId", task.getId(), "title", task.getTitle(),
                       "priority", task.getPriority(), "status", task.getStatus()));
        } catch (Exception e) {
            return "{\"taskId\": \"" + task.getId() + "\", \"title\": \"" + task.getTitle() + "\"}";
        }
    }
}
