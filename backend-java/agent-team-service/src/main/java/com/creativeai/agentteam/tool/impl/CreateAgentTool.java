package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.AgentProposal;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.service.AgentProposalService;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Le SCRUM_MASTER PROPOSE la création d'un agent spécialisé au patron de l'équipe.
 * Aucun agent n'est créé directement : une proposition PENDING est enregistrée et
 * l'utilisateur la valide (ou refuse) d'un clic dans l'interface. L'agent n'est créé,
 * tout configuré depuis son template, qu'après approbation.
 */
@Slf4j
@Component
public class CreateAgentTool implements AgentTool {

    private final AgentProposalService proposalService;
    private final AgentRepository      agentRepo;
    private final ObjectMapper         objectMapper;

    public CreateAgentTool(AgentProposalService proposalService, AgentRepository agentRepo, ObjectMapper objectMapper) {
        this.proposalService = proposalService;
        this.agentRepo       = agentRepo;
        this.objectMapper    = objectMapper;
    }

    @Override
    public String getName() { return "create_agent"; }

    @Override
    public String getDescription() {
        return "Propose au patron (utilisateur de l'équipe) la création d'un nouvel agent IA spécialisé à partir d'un type prédéfini. "
             + "Ne crée PAS directement : enregistre une proposition PENDING que le patron validera d'un clic. "
             + "L'agent sera créé tout configuré (outils, modèle IA, prompt) après approbation.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "type": "string (obligatoire) — type d'agent parmi : SCRUM_MASTER, EMAIL_MANAGER, COMMUNITY_MANAGER, CUSTOMER_SUPPORT, PROSPECTION, MARKETING, CV_CREATOR, CV_EDITOR, IMAGE_CREATOR, VIDEO_CREATOR, RAG_DOCUMENT, SECURITY_AUDIT, CREATIVE_LEAD, ONLY_OFFICE, ANIMATION, AD_SPOT",
              "name": "string (optionnel) — nom personnalisé suggéré, sinon nom par défaut du template",
              "description": "string (optionnel) — description personnalisée suggérée",
              "teamId": "string (optionnel) — UUID de l'équipe à laquelle attacher l'agent (déduit de l'agent appelant si absent)"
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

        // Déduire l'équipe de l'agent appelant si non fournie
        if ((teamId == null || teamId.isBlank()) && callerAgentId != null) {
            teamId = agentRepo.findByIdAndDeletedFalse(callerAgentId)
                .map(Agent::getTeamId)
                .orElse(null);
        }

        log.info("[CREATE_AGENT] Agent {} proposing new agent type={} name={} for user {}", callerAgentId, type, name, userId);

        try {
            AgentProposal proposal = proposalService.create(userId, type, name, description, teamId, callerAgentId);
            return objectMapper.writeValueAsString(Map.of(
                "proposalId", proposal.getId(),
                "status",     "PENDING_VALIDATION",
                "agentType",  type.name(),
                "name",       proposal.getName() != null ? proposal.getName() : type.name(),
                "message",    "Proposition de création d'agent envoyée au patron pour validation. "
                            + "Le patron validera d'un clic dans l'interface. L'agent n'est pas encore disponible : "
                            + "informe le patron dans ta réponse finale que la proposition est en attente de son approbation.")
            );
        } catch (Exception e) {
            log.error("[CREATE_AGENT] Error proposing agent: {}", e.getMessage(), e);
            return "{\"error\":\"Erreur lors de la proposition de création d'agent: " + e.getMessage() + "\"}";
        }
    }
}