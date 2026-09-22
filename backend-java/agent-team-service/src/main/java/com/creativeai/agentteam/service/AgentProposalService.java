package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.request.CreateFromTemplateRequest;
import com.creativeai.agentteam.dto.response.AgentDetailResponse;
import com.creativeai.agentteam.dto.response.AgentProposalResponse;
import com.creativeai.agentteam.model.Agent;
import com.creativeai.agentteam.model.AgentProposal;
import com.creativeai.agentteam.model.AgentTeam;
import com.creativeai.agentteam.model.enums.AgentType;
import com.creativeai.agentteam.model.enums.ProposalStatus;
import com.creativeai.agentteam.repository.AgentProposalRepository;
import com.creativeai.agentteam.repository.AgentRepository;
import com.creativeai.agentteam.repository.AgentTeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * File d'approbation des créations d'agent proposées par le SCRUM MANAGER.
 * Le patron valide (APPROVED) ou refuse (REFUSED) d'un clic ; l'agent n'est réellement
 * créé (tout configuré depuis son template) qu'après approbation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentProposalService {

    private final AgentProposalRepository proposalRepo;
    private final AgentRepository         agentRepo;
    private final AgentTeamRepository     teamRepo;
    private final AgentService            agentService;
    private final AuditService            auditService;

    @Transactional
    public AgentProposal create(String userId, AgentType agentType, String name, String description,
                                String teamId, String requesterAgentId) {
        AgentProposal proposal = AgentProposal.builder()
            .agentType(agentType)
            .name(name)
            .description(description)
            .teamId(teamId)
            .userId(userId)
            .requesterAgentId(requesterAgentId)
            .status(ProposalStatus.PENDING)
            .build();
        AgentProposal saved = proposalRepo.save(proposal);
        auditService.log(userId, "AGENT_PROPOSAL_CREATED", "agent_proposal", saved.getId(), true,
            AuditService.details("agentType", agentType, "name", name, "requesterAgentId", requesterAgentId));
        log.info("[AGENT_PROPOSAL] created id={} type={} by agent {} for user {}", saved.getId(), agentType, requesterAgentId, userId);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<AgentProposalResponse> list(String userId, ProposalStatus status) {
        List<AgentProposal> proposals = status != null
            ? proposalRepo.findByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, status)
            : proposalRepo.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(userId);
        return proposals.stream()
            .map(p -> new AgentProposalResponse(
                p.getId(),
                p.getAgentType(),
                p.getName(),
                p.getDescription(),
                p.getTeamId(),
                teamName(p.getTeamId()),
                requesterName(p.getRequesterAgentId()),
                p.getStatus(),
                p.getAgentId(),
                p.getCreatedAt()))
            .toList();
    }

    @Transactional
    public AgentProposalResponse approve(String userId, String proposalId) {
        AgentProposal proposal = findPending(userId, proposalId);
        AgentDetailResponse created = agentService.createFromTemplate(userId, proposal.getAgentType(),
            new CreateFromTemplateRequest(proposal.getName(), proposal.getDescription(), proposal.getTeamId()));

        proposal.setStatus(ProposalStatus.APPROVED);
        proposal.setAgentId(created.id());
        proposal.setDecidedAt(LocalDateTime.now());
        proposalRepo.save(proposal);

        auditService.log(userId, "AGENT_PROPOSAL_APPROVED", "agent_proposal", proposal.getId(), true,
            AuditService.details("agentType", proposal.getAgentType(), "agentId", created.id(), "name", created.name()));
        log.info("[AGENT_PROPOSAL] approved id={} → agent {} [{}]", proposalId, created.id(), created.name());
        return toResponse(proposalRepo.findById(proposal.getId()).orElse(proposal));
    }

    @Transactional
    public AgentProposalResponse refuse(String userId, String proposalId) {
        AgentProposal proposal = findPending(userId, proposalId);
        proposal.setStatus(ProposalStatus.REFUSED);
        proposal.setDecidedAt(LocalDateTime.now());
        proposalRepo.save(proposal);
        auditService.log(userId, "AGENT_PROPOSAL_REFUSED", "agent_proposal", proposal.getId(), true,
            AuditService.details("agentType", proposal.getAgentType()));
        log.info("[AGENT_PROPOSAL] refused id={}", proposalId);
        return toResponse(proposal);
    }

    private AgentProposal findPending(String userId, String proposalId) {
        AgentProposal proposal = proposalRepo.findByIdAndUserIdAndDeletedFalse(proposalId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Proposition de création d'agent non trouvée"));
        if (proposal.getStatus() != ProposalStatus.PENDING) {
            throw new IllegalStateException("Cette proposition a déjà été traitée");
        }
        return proposal;
    }

    private String teamName(String teamId) {
        if (teamId == null || teamId.isBlank()) return null;
        return teamRepo.findByIdAndDeletedFalse(teamId)
            .map(AgentTeam::getName)
            .orElse(null);
    }

    private String requesterName(String requesterAgentId) {
        if (requesterAgentId == null || requesterAgentId.isBlank()) return null;
        return agentRepo.findByIdAndDeletedFalse(requesterAgentId)
            .map(Agent::getName)
            .orElse(null);
    }

    private AgentProposalResponse toResponse(AgentProposal p) {
        return new AgentProposalResponse(
            p.getId(),
            p.getAgentType(),
            p.getName(),
            p.getDescription(),
            p.getTeamId(),
            teamName(p.getTeamId()),
            requesterName(p.getRequesterAgentId()),
            p.getStatus(),
            p.getAgentId(),
            p.getCreatedAt());
    }
}