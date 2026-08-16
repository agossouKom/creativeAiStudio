package com.creativeai.auth.service.agent.tool;

import com.creativeai.auth.model.AgentTask;
import com.creativeai.auth.model.enums.TaskStatus;
import com.creativeai.auth.repository.AgentTaskRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SearchTasksTool implements AgentTool {

    private final AgentTaskRepository taskRepo;
    private final ObjectMapper        objectMapper;

    @Override public String getName()        { return "search_tasks"; }
    @Override public String getDescription() {
        return "Recherche les tâches existantes. Paramètres optionnels: status (TODO|IN_PROGRESS|DONE|CANCELLED).";
    }

    @Override
    public String execute(String userId, Map<String, Object> params) {
        List<AgentTask> tasks;
        if (params.containsKey("status")) {
            try {
                TaskStatus status = TaskStatus.valueOf(((String) params.get("status")).toUpperCase());
                tasks = taskRepo.findByUserIdAndStatusAndDeletedFalse(userId, status);
            } catch (Exception e) {
                tasks = taskRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
            }
        } else {
            tasks = taskRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
        }
        try {
            return objectMapper.writeValueAsString(tasks.stream()
                .map(t -> Map.of("id", t.getId(), "title", t.getTitle(),
                                 "status", t.getStatus(), "priority", t.getPriority()))
                .toList());
        } catch (Exception e) {
            return "{\"count\": " + tasks.size() + "}";
        }
    }
}
