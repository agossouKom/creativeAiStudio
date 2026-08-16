package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.model.AgentTask;
import com.creativeai.agentteam.model.enums.*;
import com.creativeai.agentteam.repository.AgentTaskRepository;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Component
@RequiredArgsConstructor
public class CreateTaskTool implements AgentTool {
    private final AgentTaskRepository taskRepo;
    private final ObjectMapper om;

    @Override public String getName()        { return "create_task"; }
    @Override public String getDescription() { return "Crée une tâche pour un agent ou un utilisateur"; }
    @Override public String getParametersSchema() {
        return "{\"title\":\"string\",\"description\":\"string\",\"priority\":\"LOW|MEDIUM|HIGH|CRITICAL\",\"assignedAgentId\":\"string?\"}";
    }

    @Override
    public String execute(String agentId, String userId, Map<String, Object> p) {
        AgentTask task = AgentTask.builder()
            .userId(userId)
            .assignedAgentId((String) p.getOrDefault("assignedAgentId", agentId))
            .requesterAgentId(agentId)
            .title((String) p.getOrDefault("title", "Tâche créée par l'agent"))
            .description((String) p.get("description"))
            .priority(Priority.valueOf((String) p.getOrDefault("priority", "MEDIUM")))
            .type(TaskType.GENERAL)
            .source(TaskSource.INTER_AGENT)
            .agentGenerated(true)
            .code(generateTaskCode())
            .build();
        task = taskRepo.save(task);
        try { return om.writeValueAsString(Map.of("taskId", task.getId(), "status", "CREATED")); }
        catch (Exception e) { return "{\"taskId\":\"" + task.getId() + "\"}"; }
    }

    private String generateTaskCode() {
        String code;
        do { code = String.format("%06d", ThreadLocalRandom.current().nextInt(100000, 1000000)); }
        while (taskRepo.findByCodeAndDeletedFalse(code).isPresent());
        return code;
    }
}
