package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentProposal;
import com.creativeai.agentteam.model.enums.ProposalStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgentProposalRepository extends JpaRepository<AgentProposal, String> {

    List<AgentProposal> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String userId);

    List<AgentProposal> findByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDesc(String userId, ProposalStatus status);

    Optional<AgentProposal> findByIdAndUserIdAndDeletedFalse(String id, String userId);
}