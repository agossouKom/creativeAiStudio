package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AgentConfigRepository extends JpaRepository<AgentConfig, String> {
    Optional<AgentConfig> findByAgentIdAndDeletedFalse(String agentId);
    void deleteByAgentId(String agentId);
}
