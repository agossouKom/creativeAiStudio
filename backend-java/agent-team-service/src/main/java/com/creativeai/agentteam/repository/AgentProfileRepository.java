package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AgentProfileRepository extends JpaRepository<AgentProfile, String> {
    Optional<AgentProfile> findByAgentIdAndDeletedFalse(String agentId);
    void deleteByAgentId(String agentId);
}
