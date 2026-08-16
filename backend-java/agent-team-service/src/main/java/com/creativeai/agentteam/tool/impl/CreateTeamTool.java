package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.dto.request.CreateTeamRequest;
import com.creativeai.agentteam.dto.response.TeamResponse;
import com.creativeai.agentteam.model.enums.TeamType;
import com.creativeai.agentteam.service.AgentTeamService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Option B : permet à un SCRUM_MASTER de créer dynamiquement une équipe d'agents.
 */
@Slf4j
@Component
public class CreateTeamTool implements AgentTool {

    private final AgentTeamService teamService;
    private final ObjectMapper     objectMapper;

    public CreateTeamTool(AgentTeamService teamService, ObjectMapper objectMapper) {
        this.teamService  = teamService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getName() { return "create_team"; }

    @Override
    public String getDescription() {
        return "Crée une équipe d'agents IA. "
             + "Spécifie un lead agent (généralement un SCRUM_MASTER) et des membres spécialisés. "
             + "Retourne l'ID et les informations de la nouvelle équipe.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "name": "string (obligatoire) — nom de l'équipe",
              "description": "string (optionnel) — description de l'équipe",
              "leadAgentId": "string (optionnel) — UUID de l'agent lead (chef de l'équipe)",
              "memberAgentIds": "array<string> (optionnel) — liste des UUIDs des agents membres",
              "type": "string (optionnel) — BUSINESS | CREATIVE | SUPPORT | TECHNICAL | MARKETING"
            }
            """;
    }

    @Override
    @SuppressWarnings("unchecked")
    public String execute(String callerAgentId, String userId, Map<String, Object> params) {
        String name = (String) params.get("name");
        if (name == null || name.isBlank()) {
            return "{\"error\":\"Le paramètre 'name' est obligatoire\"}";
        }

        String description  = (String) params.get("description");
        String leadAgentId  = (String) params.get("leadAgentId");
        String typeStr      = (String) params.get("type");

        List<String> memberIds;
        try {
            Object raw = params.get("memberAgentIds");
            memberIds = raw instanceof List ? (List<String>) raw : List.of();
        } catch (Exception e) {
            memberIds = List.of();
        }

        log.info("[CREATE_TEAM] Agent {} creating team name={} lead={}", callerAgentId, name, leadAgentId);

        TeamType teamType = null;
        if (typeStr != null && !typeStr.isBlank()) {
            try { teamType = TeamType.valueOf(typeStr.toUpperCase().trim()); }
            catch (IllegalArgumentException ignored) {}
        }

        try {
            CreateTeamRequest req = new CreateTeamRequest(
                name, description, teamType, null,
                leadAgentId, null, null, null, null, null,
                memberIds, null, null
            );
            TeamResponse created = teamService.createTeam(userId, req);

            return objectMapper.writeValueAsString(Map.of(
                "teamId",      created.id(),
                "name",        created.name(),
                "type",        created.type(),
                "leadAgentId", created.leadAgentId() != null ? created.leadAgentId() : "",
                "memberCount", memberIds.size(),
                "message",     "Équipe créée avec succès."
            ));
        } catch (Exception e) {
            log.error("[CREATE_TEAM] Error: {}", e.getMessage(), e);
            return "{\"error\":\"Erreur lors de la création de l'équipe: " + e.getMessage() + "\"}";
        }
    }
}
