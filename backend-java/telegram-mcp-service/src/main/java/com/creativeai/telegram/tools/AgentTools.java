package com.creativeai.telegram.tools;

import com.creativeai.telegram.client.AgentTeamClient;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/**
 * Outils MCP pour la découverte et l'inspection des agents IA.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentTools {

    private final AgentTeamClient client;

    record GetAgentInput(
        @JsonPropertyDescription("UUID de l'agent") String agentId
    ) {}

    record ListAgentsInput(
        @JsonPropertyDescription("Numéro de page (commence à 0, défaut : 0)") Integer page,
        @JsonPropertyDescription("Taille de la page (défaut : 20)") Integer size
    ) {}

    @Tool(description = "Liste tous les agents IA disponibles pour cet utilisateur avec leurs capacités et statuts.")
    public String listAgents(ListAgentsInput input) {
        log.info("[TOOL:listAgents] userId={}", UserContextHolder.getUserId());
        int page = input.page() != null ? input.page() : 0;
        int size = input.size() != null ? input.size() : 20;
        return client.listAgents(UserContextHolder.getUserId(), UserContextHolder.getJwtToken(), page, size);
    }

    @Tool(description = "Récupère les informations détaillées d'un agent spécifique : rôle, capacités, provider LLM.")
    public String getAgent(GetAgentInput input) {
        log.info("[TOOL:getAgent] agentId={}", input.agentId());
        return client.getAgent(UserContextHolder.getUserId(), UserContextHolder.getJwtToken(), input.agentId());
    }
}
