package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.dto.request.CreateFromTemplateRequest;
import com.creativeai.agentteam.dto.response.AgentDetailResponse;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.service.AgentService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Option B : permet à un SCRUM_MASTER de créer dynamiquement un agent spécialisé.
 * Utilise l'Option C en interne (createFromTemplate) pour un agent pré-configuré.
 */
@Slf4j
@Component
public class CreateAgentTool implements AgentTool {

    private final AgentService agentService;
    private final ObjectMapper objectMapper;

    public CreateAgentTool(AgentService agentService, ObjectMapper objectMapper) {
        this.agentService = agentService;
        this.objectMapper  = objectMapper;
    }

    @Override
    public String getName() { return "create_agent"; }

    @Override
    public String getDescription() {
        return "Crée un nouvel agent IA spécialisé à partir d'un type prédéfini. "
             + "L'agent est immédiatement opérationnel avec son system prompt et sa configuration. "
             + "Retourne l'ID et les informations du nouvel agent.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "type": "string (obligatoire) — type d'agent parmi : SCRUM_MASTER, EMAIL_MANAGER, COMMUNITY_MANAGER, CUSTOMER_SUPPORT, PROSPECTION, MARKETING, CV_CREATOR, CV_EDITOR, IMAGE_CREATOR, VIDEO_CREATOR, RAG_DOCUMENT, SECURITY_AUDIT, CREATIVE_LEAD, ONLY_OFFICE, ANIMATION, AD_SPOT",
              "name": "string (optionnel) — nom personnalisé, sinon nom par défaut du template",
              "description": "string (optionnel) — description personnalisée",
              "teamId": "string (optionnel) — UUID de l'équipe à laquelle attacher l'agent"
            }
            """;
    }

    @Override
    public String execute(String callerAgentId, String userId, Map<String, Object> params) {
        String typeStr = (String) params.get("type");
        if (typeStr == null || typeStr.isBlank()) {
            return "{\"error\":\"Le paramètre 'type' est obligatoire\"}";
        }

        AgentType type;
        try {
            type = AgentType.valueOf(typeStr.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            return "{\"error\":\"Type d'agent invalide: " + typeStr + "\"}";
        }

        String name        = (String) params.get("name");
        String description = (String) params.get("description");
        String teamId      = (String) params.get("teamId");

        log.info("[CREATE_AGENT] Agent {} creating new agent type={} name={}", callerAgentId, type, name);

        try {
            CreateFromTemplateRequest req = new CreateFromTemplateRequest(name, description, teamId);
            AgentDetailResponse created = agentService.createFromTemplate(userId, type, req);

            return objectMapper.writeValueAsString(Map.of(
                "agentId",     created.id(),
                "name",        created.name(),
                "type",        created.type(),
                "status",      created.status(),
                "description", created.description() != null ? created.description() : "",
                "message",     "Agent créé avec succès. Pensez à lui attacher un LLM provider via POST /api/agents/{id}/llm-providers"
            ));
        } catch (Exception e) {
            log.error("[CREATE_AGENT] Error: {}", e.getMessage(), e);
            return "{\"error\":\"Erreur lors de la création de l'agent: " + e.getMessage() + "\"}";
        }
    }
}
