package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.CreateTeamRequest;
import com.creativeai.agentteam.dto.request.UpdateTeamRequest;
import com.creativeai.agentteam.dto.response.TeamResponse;
import com.creativeai.agentteam.model.AgentTeam;
import com.creativeai.agentteam.model.enums.CollaborationMode;
import com.creativeai.agentteam.model.enums.TeamStatus;
import com.creativeai.agentteam.model.enums.TeamType;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentTeamService {

    private final AgentTeamRepository teamRepo;
    private final LlmProviderProvisioningService llmProvisioning;
    private final AuditService        auditService;
    private final ObjectMapper        objectMapper;

    @Transactional
    public TeamResponse createTeam(String ownerId, CreateTeamRequest req) {
        String memberIds = "[]";
        if (req.memberAgentIds() != null && !req.memberAgentIds().isEmpty()) {
            try { memberIds = objectMapper.writeValueAsString(req.memberAgentIds()); }
            catch (Exception e) { memberIds = "[]"; }
        }

        AgentTeam team = AgentTeam.builder()
            .name(req.name()).description(req.description())
            .type(req.type() != null ? req.type() : TeamType.BUSINESS)
            .ownerId(ownerId).organizationId(req.organizationId())
            .leadAgentId(req.leadAgentId()).creativeLeadAgentId(req.creativeLeadAgentId())
            .collaborationMode(req.collaborationMode() != null ? req.collaborationMode() : CollaborationMode.HYBRID)
            .sharedMemoryEnabled(req.sharedMemoryEnabled()  != null ? req.sharedMemoryEnabled()  : true)
            .sharedKnowledgeEnabled(req.sharedKnowledgeEnabled() != null ? req.sharedKnowledgeEnabled() : false)
            .maxConcurrentTasks(req.maxConcurrentTasks() != null ? req.maxConcurrentTasks() : 10)
            .memberAgentIds(memberIds)
            .escalationRules(req.escalationRules()).notificationConfig(req.notificationConfig())
            .build();

        team = teamRepo.save(team);

        // L'équipe reçoit son modèle dès sa création, et non à la création de
        // son premier agent. Déclencher l'attribution sur la création d'un agent
        // laissait les équipes déjà peuplées sans provider, et faisait dépendre
        // l'attribution d'un appel qui répond 201 : une équipe vide pouvait
        // rester sans modèle indéfiniment, et rien ne signalait ce retard.
        //
        // REQUIRES_NEW : la copie est écrite dans sa propre transaction. Sans
        // cela elle resterait en FlushMode.MANUAL et ne serait jamais flushée,
        // comme ce fut le cas pour le provisionnement du compte.
        llmProvisioning.ensureTeamProviderFromPlatformDefault(team.getId());

        auditService.log(ownerId, "CREATE_TEAM", "team", team.getId(), true,
            AuditService.details("name", team.getName(), "type", team.getType(),
                "leadAgentId", team.getLeadAgentId()));
        log.info("Team created: {} by {}", team.getName(), ownerId);
        return TeamResponse.from(team);
    }

    @Transactional(readOnly = true)
    public TeamResponse getTeam(String ownerId, String teamId) {
        return TeamResponse.from(
            teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Équipe non trouvée: " + teamId)));
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> listTeams(String ownerId) {
        return teamRepo.findByOwnerIdAndDeletedFalseOrderByCreatedAtDesc(ownerId)
            .stream().map(TeamResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> listTeamsFiltered(String ownerId, TeamStatus status, TeamType type) {
        if (status != null && type != null) {
            return teamRepo.findByOwnerIdAndStatusAndTypeAndDeletedFalseOrderByCreatedAtDesc(ownerId, status, type)
                .stream().map(TeamResponse::from).toList();
        }
        if (status != null) {
            return teamRepo.findByOwnerIdAndStatusAndDeletedFalse(ownerId, status)
                .stream().map(TeamResponse::from).toList();
        }
        if (type != null) {
            return teamRepo.findByOwnerIdAndTypeAndDeletedFalseOrderByCreatedAtDesc(ownerId, type)
                .stream().map(TeamResponse::from).toList();
        }
        return listTeams(ownerId);
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> listDeletedTeams(String ownerId) {
        return teamRepo.findByOwnerIdAndDeletedTrueOrderByUpdatedAtDesc(ownerId)
            .stream().map(TeamResponse::from).toList();
    }

    @Transactional
    public TeamResponse updateTeam(String ownerId, String teamId, UpdateTeamRequest req) {
        AgentTeam team = teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Équipe non trouvée: " + teamId));

        if (req.name()               != null) team.setName(req.name());
        if (req.description()        != null) team.setDescription(req.description());
        if (req.status()             != null) team.setStatus(req.status());
        if (req.leadAgentId()        != null) team.setLeadAgentId(req.leadAgentId());
        if (req.creativeLeadAgentId() != null) team.setCreativeLeadAgentId(req.creativeLeadAgentId());
        if (req.collaborationMode()  != null) team.setCollaborationMode(req.collaborationMode());
        if (req.sharedMemoryEnabled() != null) team.setSharedMemoryEnabled(req.sharedMemoryEnabled());
        if (req.maxConcurrentTasks() != null) team.setMaxConcurrentTasks(req.maxConcurrentTasks());
        if (req.escalationRules()    != null) team.setEscalationRules(req.escalationRules());
        if (req.memberAgentIds()     != null) {
            try { team.setMemberAgentIds(objectMapper.writeValueAsString(req.memberAgentIds())); }
            catch (Exception ignored) {}
        }

        team = teamRepo.save(team);
        auditService.log(ownerId, "UPDATE_TEAM", "team", teamId, true,
            AuditService.details("name", team.getName()));
        return TeamResponse.from(team);
    }

    @Transactional
    public void deleteTeam(String ownerId, String teamId) {
        AgentTeam team = teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Équipe non trouvée: " + teamId));
        team.setDeleted(true);
        teamRepo.save(team);
        auditService.log(ownerId, "DELETE_TEAM", "team", teamId, true,
            AuditService.details("name", team.getName(), "softDelete", true));
        log.info("Team soft-deleted: {} by {}", teamId, ownerId);
    }

    @Transactional
    public TeamResponse restoreTeam(String ownerId, String teamId) {
        AgentTeam team = teamRepo.findByIdAndOwnerIdAndDeletedTrue(teamId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Équipe supprimée introuvable: " + teamId));
        team.setDeleted(false);
        team = teamRepo.save(team);
        auditService.log(ownerId, "RESTORE_TEAM", "team", teamId, true,
            AuditService.details("name", team.getName()));
        log.info("Team restored: {} by {}", teamId, ownerId);
        return TeamResponse.from(team);
    }

    @Transactional
    public TeamResponse addMember(String ownerId, String teamId, String agentId) {
        AgentTeam team = teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Équipe non trouvée: " + teamId));
        try {
            List<String> members = objectMapper.readValue(team.getMemberAgentIds(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            if (!members.contains(agentId)) {
                members.add(agentId);
                team.setMemberAgentIds(objectMapper.writeValueAsString(members));
                teamRepo.save(team);
                auditService.log(ownerId, "ADD_MEMBER", "team", teamId, true,
                    AuditService.details("teamName", team.getName(), "agentId", agentId));
            }
        } catch (Exception e) { log.warn("Failed to add member", e); }
        return TeamResponse.from(team);
    }

    @Transactional
    public TeamResponse removeMember(String ownerId, String teamId, String agentId) {
        AgentTeam team = teamRepo.findByIdAndOwnerIdAndDeletedFalse(teamId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Équipe non trouvée: " + teamId));
        try {
            List<String> members = objectMapper.readValue(team.getMemberAgentIds(),
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            members.remove(agentId);
            team.setMemberAgentIds(objectMapper.writeValueAsString(members));
            teamRepo.save(team);
            auditService.log(ownerId, "REMOVE_MEMBER", "team", teamId, true,
                AuditService.details("teamName", team.getName(), "agentId", agentId));
        } catch (Exception e) { log.warn("Failed to remove member", e); }
        return TeamResponse.from(team);
    }
}
