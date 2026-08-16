package com.creativeai.agentteam.tool;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ToolRegistry {

    private final List<AgentTool>        allTools;
    private final Map<String, AgentTool> toolMap = new HashMap<>();

    @PostConstruct
    public void init() {
        for (AgentTool tool : allTools) {
            toolMap.put(tool.getName(), tool);
            log.info("Tool registered: {}", tool.getName());
        }
    }

    // ── Exécution ─────────────────────────────────────────────────────────────

    /**
     * Exécute un outil sans restriction de périmètre (usage interne / debug).
     */
    public String execute(String agentId, String userId, String toolName, Map<String, Object> params) {
        AgentTool tool = toolMap.get(toolName);
        if (tool == null) return "{\"error\":\"Outil inconnu: " + toolName + "\"}";
        if (!tool.isEnabled()) return "{\"error\":\"Outil désactivé: " + toolName + "\"}";
        try {
            return tool.execute(agentId, userId, params);
        } catch (Exception e) {
            log.error("Tool execution failed: {} - {}", toolName, e.getMessage());
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    /**
     * Exécute un outil en vérifiant qu'il est autorisé pour cet agent.
     * Si {@code enabledTools} est vide/null → tous les outils sont autorisés.
     */
    public String executeFor(String agentId, String userId, String toolName,
                             Map<String, Object> params, List<String> enabledTools) {
        if (enabledTools != null && !enabledTools.isEmpty() && !enabledTools.contains(toolName)) {
            log.warn("[TOOL] Agent {} tried to use unauthorized tool '{}'", agentId, toolName);
            return "{\"error\":\"Outil non autorisé pour cet agent: " + toolName + "\"}";
        }
        return execute(agentId, userId, toolName, params);
    }

    // ── Description (system prompt) ───────────────────────────────────────────

    /**
     * Description de TOUS les outils activés (fallback sans restriction).
     */
    public String buildToolsDescription() {
        return buildToolsDescriptionFor(List.of());
    }

    /**
     * Description filtrée par la liste des outils autorisés pour un agent donné.
     * Si {@code enabledToolNames} est vide/null → tous les outils activés sont décrits.
     */
    public String buildToolsDescriptionFor(List<String> enabledToolNames) {
        List<AgentTool> filtered = (enabledToolNames == null || enabledToolNames.isEmpty())
                ? getEnabledTools()
                : getEnabledTools().stream()
                    .filter(t -> enabledToolNames.contains(t.getName()))
                    .toList();

        if (filtered.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("\n\n[OUTILS DISPONIBLES]\n");
        sb.append("Pour utiliser un outil, réponds UNIQUEMENT avec :\n");
        sb.append("TOOL_CALL:<nom_outil>:<json_params>\n\n");
        sb.append("Outils disponibles :\n");
        for (AgentTool t : filtered) {
            sb.append("- ").append(t.getName())
              .append(" : ").append(t.getDescription())
              .append("\n  Params: ").append(t.getParametersSchema()).append("\n");
        }
        return sb.toString();
    }

    // ── Accesseurs ────────────────────────────────────────────────────────────

    public List<AgentTool> getEnabledTools() {
        return allTools.stream().filter(AgentTool::isEnabled).toList();
    }

    public List<String> getRegisteredToolNames() {
        return List.copyOf(toolMap.keySet());
    }
}
