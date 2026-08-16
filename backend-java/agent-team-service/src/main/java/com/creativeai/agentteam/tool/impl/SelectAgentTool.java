package com.creativeai.agentteam.tool.impl;

import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.enums.AgentStatus;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import com.creativeai.agentteam.tool.AgentTool;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Étape 3 du workflow : Le Scrum Manager sélectionne l'agent le plus
 * compétent pour une tâche donnée, en filtrant par type, équipe et disponibilité.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SelectAgentTool implements AgentTool {

    private final AgentRepository     agentRepo;
    private final AgentTeamRepository teamRepo;
    private final ObjectMapper        objectMapper;

    @Override public String getName() { return "select_agent"; }

    @Override
    public String getDescription() {
        return "Sélectionne l'agent le plus adapté pour une tâche selon son type et ses compétences. "
             + "Retourne l'ID de l'agent sélectionné. "
             + "À utiliser AVANT delegate_to_agent quand tu ne connais pas l'ID exact de l'agent cible.";
    }

    @Override
    public String getParametersSchema() {
        return """
            {
              "agentType":        "string (optionnel) — type requis: EMAIL_MANAGER, COMMUNITY_MANAGER, MARKETING, CUSTOMER_SUPPORT, PROSPECTION, CREATIVE_LEAD, RAG_DOCUMENT, SCRUM_MASTER, etc.",
              "taskDescription":  "string (optionnel) — description de la tâche pour affiner la sélection",
              "teamId":           "string (optionnel) — restreindre la recherche aux membres d'une équipe",
              "userId":           "string (optionnel) — restreindre aux agents de cet utilisateur"
            }
            """;
    }

    @Override
    public String execute(String callerAgentId, String userId, Map<String, Object> params) {
        String agentTypeStr     = (String) params.get("agentType");
        String taskDescription  = (String) params.get("taskDescription");
        String teamId           = (String) params.get("teamId");

        List<Agent> candidates = resolveCandidates(userId, teamId, agentTypeStr);

        // Exclure l'agent appelant pour éviter la récursion
        candidates = candidates.stream()
            .filter(a -> !a.getId().equals(callerAgentId))
            .filter(a -> a.getStatus() == AgentStatus.ACTIVE)
            .toList();

        if (candidates.isEmpty()) {
            return buildError("Aucun agent disponible" +
                (agentTypeStr != null ? " de type " + agentTypeStr : "") + " dans l'équipe.");
        }

        // Si une description de tâche est fournie, scorer par pertinence
        Agent selected = (taskDescription != null && !taskDescription.isBlank())
            ? scoreAndSelect(candidates, taskDescription, agentTypeStr)
            : candidates.get(0);

        log.info("[SELECT_AGENT] Caller={} → selected={} ({})", callerAgentId, selected.getId(), selected.getType());

        try {
            return objectMapper.writeValueAsString(Map.of(
                "agentId",      selected.getId(),
                "agentName",    selected.getName() != null ? selected.getName() : "",
                "agentType",    selected.getType().name(),
                "description",  selected.getDescription() != null ? selected.getDescription() : "",
                "status",       selected.getStatus().name()
            ));
        } catch (Exception e) {
            return "{\"agentId\":\"" + selected.getId() + "\",\"agentType\":\"" + selected.getType().name() + "\"}";
        }
    }

    // ── Résolution des candidats ──────────────────────────────────────────────

    private List<Agent> resolveCandidates(String userId, String teamId, String agentTypeStr) {
        AgentType targetType = parseAgentType(agentTypeStr);

        // Chercher dans l'équipe si fournie
        if (teamId != null && !teamId.isBlank()) {
            return teamRepo.findByIdAndDeletedFalse(teamId)
                .map(team -> {
                    List<String> memberIds = parseMemberIds(team.getMemberAgentIds());
                    List<Agent> members = new ArrayList<>();
                    for (String id : memberIds) {
                        agentRepo.findByIdAndDeletedFalse(id).ifPresent(members::add);
                    }
                    if (targetType != null) {
                        return members.stream().filter(a -> a.getType() == targetType).toList();
                    }
                    return members;
                })
                .orElse(List.of());
        }

        // Chercher parmi les agents de l'utilisateur
        if (targetType != null) {
            return agentRepo.findByOwnerIdAndTypeAndDeletedFalse(userId, targetType);
        }
        return agentRepo.findByOwnerIdAndStatusAndDeletedFalse(userId, AgentStatus.ACTIVE);
    }

    // ── Scoring par pertinence de description ────────────────────────────────

    private Agent scoreAndSelect(List<Agent> candidates, String taskDescription, String agentTypeStr) {
        String task = taskDescription.toLowerCase();

        // Scoring simple par mots-clés dans la description et le nom de l'agent
        Agent best  = candidates.get(0);
        int   bestScore = 0;

        for (Agent a : candidates) {
            int score = 0;
            String desc = ((a.getDescription() != null ? a.getDescription() : "")
                          + " " + (a.getName() != null ? a.getName() : "")
                          + " " + a.getType().name()).toLowerCase();

            // +2 par mot-clé de la tâche trouvé dans la description
            for (String word : task.split("\\s+")) {
                if (word.length() > 3 && desc.contains(word)) score += 2;
            }
            // +5 si le type correspond exactement
            if (agentTypeStr != null && a.getType().name().equalsIgnoreCase(agentTypeStr)) score += 5;

            if (score > bestScore) { bestScore = score; best = a; }
        }
        return best;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AgentType parseAgentType(String typeStr) {
        if (typeStr == null || typeStr.isBlank()) return null;
        try { return AgentType.valueOf(typeStr.toUpperCase().trim()); }
        catch (IllegalArgumentException e) {
            log.warn("[SELECT_AGENT] Type inconnu '{}', ignoré", typeStr);
            return null;
        }
    }

    private List<String> parseMemberIds(String json) {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) return List.of();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return List.of(); }
    }

    private String buildError(String msg) {
        return "{\"error\":\"" + msg.replace("\"", "'") + "\"}";
    }
}
