package com.creativeai.agentteam.controller;

import com.creativeai.agentteam.model.enums.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "Enums", description = "Valeurs des énumérations exposées au frontend")
@RestController
@RequestMapping("/api/enums")
public class EnumController {

    // Index complet : nom_enum → liste de valeurs
    private static final Map<String, List<String>> ALL_ENUMS = buildAll();

    @Operation(summary = "Retourne toutes les énumérations et leurs valeurs")
    @GetMapping
    public ResponseEntity<Map<String, List<String>>> getAll() {
        return ResponseEntity.ok(ALL_ENUMS);
    }

    @Operation(summary = "Retourne les valeurs d'une énumération par son nom (insensible à la casse)")
    @GetMapping("/{name}")
    public ResponseEntity<List<String>> getByName(@PathVariable String name) {
        List<String> values = ALL_ENUMS.get(name.toUpperCase());
        if (values == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(values);
    }

    // ── Builder ───────────────────────────────────────────────────────────────

    private static Map<String, List<String>> buildAll() {
        Map<String, List<String>> map = new LinkedHashMap<>();

        map.put("ACTION_TYPE",         values(ActionType.class));
        map.put("AGENT_STATUS",        values(AgentStatus.class));
        map.put("AGENT_TYPE",          values(AgentType.class));
        map.put("ALERT_SEVERITY",      values(AlertSeverity.class));
        map.put("CHANNEL_STATUS",      values(ChannelStatus.class));
        map.put("CHANNEL_TYPE",        values(ChannelType.class));
        map.put("COLLABORATION_MODE",  values(CollaborationMode.class));
        map.put("INBOX_STATUS",        values(InboxStatus.class));
        map.put("LLM_TYPE",            values(LlmType.class));
        map.put("MEMORY_TYPE",         values(MemoryType.class));
        map.put("MESSAGE_DIRECTION",   values(MessageDirection.class));
        map.put("MESSAGE_ROLE",        values(MessageRole.class));
        map.put("PLATFORM_TYPE",       values(PlatformType.class));
        map.put("PRIORITY",            values(Priority.class));
        map.put("PROMPT_TYPE",         values(PromptType.class));
        map.put("TASK_SOURCE",         values(TaskSource.class));
        map.put("TASK_STATUS",         values(TaskStatus.class));
        map.put("TASK_TYPE",           values(TaskType.class));
        map.put("TEAM_STATUS",         values(TeamStatus.class));
        map.put("TEAM_TYPE",           values(TeamType.class));
        map.put("TONE_STYLE",          values(ToneStyle.class));
        map.put("TRIGGER_TYPE",        values(TriggerType.class));
        map.put("WORKFLOW_STATUS",     values(WorkflowStatus.class));

        return Collections.unmodifiableMap(map);
    }

    private static <E extends Enum<E>> List<String> values(Class<E> clazz) {
        return Arrays.stream(clazz.getEnumConstants())
                     .map(Enum::name)
                     .collect(Collectors.toList());
    }
}
