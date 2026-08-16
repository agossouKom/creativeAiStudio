package com.creativeai.auth.service.agent;

import com.creativeai.auth.service.agent.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ToolRegistry {

    private final List<AgentTool> tools;
    private final ObjectMapper    objectMapper;

    private Map<String, AgentTool> toolMap;

    @PostConstruct
    void init() {
        toolMap = new HashMap<>();
        tools.forEach(t -> toolMap.put(t.getName(), t));
        log.info("ToolRegistry loaded {} tools: {}", toolMap.size(), toolMap.keySet());
    }

    public String execute(String userId, String name, Map<String, Object> params) {
        AgentTool tool = toolMap.get(name);
        if (tool == null) return "{\"error\": \"Outil inconnu: " + name + "\"}";
        log.info("[TOOL] {} called by userId={}", name, userId);
        try {
            return tool.execute(userId, params);
        } catch (Exception e) {
            log.error("[TOOL] {} error: {}", name, e.getMessage());
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    public String buildSystemPrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            Tu es l'Agent Email de Creative AI Studio.
            Tu es un assistant intelligent qui aide l'utilisateur à gérer sa boîte mail.

            Tu peux utiliser les outils suivants en écrivant TOOL_CALL:nom_outil:{paramètres JSON}:

            """);
        for (AgentTool t : tools) {
            sb.append("- ").append(t.getName()).append(": ").append(t.getDescription()).append("\n");
        }
        sb.append("""

            Règles:
            - Utilise les outils pour répondre aux demandes concrètes (lire/envoyer des emails, créer des tâches).
            - Réponds toujours en français sauf si l'utilisateur écrit dans une autre langue.
            - Sois concis, précis et professionnel.
            - Pour appeler un outil, écris exactement: TOOL_CALL:nom_outil:{"param":"valeur"}
            - Après avoir obtenu le résultat d'un outil, formule une réponse claire pour l'utilisateur.
            """);
        return sb.toString();
    }

    public List<AgentTool> getAll() { return tools; }
}
