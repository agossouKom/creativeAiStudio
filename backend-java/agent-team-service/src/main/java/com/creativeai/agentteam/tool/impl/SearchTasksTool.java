package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.TaskStatus;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class SearchTasksTool implements AgentTool {
    private final AgentTaskRepository taskRepo;
    private final ObjectMapper        om;

    @Override public String getName()        { return "search_tasks"; }
    @Override public String getDescription() { return "Recherche les tâches par statut ou priorité"; }
    @Override public String getParametersSchema() {
        return "{\"status\":\"PENDING|IN_PROGRESS|DONE|FAILED?\",\"limit\":\"number?\"}";
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> p) {
        try {
            String statusStr = (String) p.get("status");
            List<AgentTask> tasks = statusStr != null
                ? taskRepo.findByUserIdAndStatusAndDeletedFalse(userId, TaskStatus.valueOf(statusStr))
                : taskRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
            int limit = p.containsKey("limit") ? ((Number) p.get("limit")).intValue() : 10;
            List<Map<String, Object>> result = tasks.stream().limit(limit)
                .map(t -> {
                    Map<String, Object> m = new java.util.HashMap<>();
                    m.put("id",       t.getId());
                    m.put("title",    t.getTitle());
                    m.put("status",   t.getStatus().name());
                    m.put("priority", t.getPriority().name());
                    return m;
                })
                .collect(Collectors.toList());
            return om.writeValueAsString(Map.of("tasks", result, "count", result.size()));
        } catch (Exception e) { return "{\"error\":\"" + e.getMessage() + "\"}"; }
    }
}
