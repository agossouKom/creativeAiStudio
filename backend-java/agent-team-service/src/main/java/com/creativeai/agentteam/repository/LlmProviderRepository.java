package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.LlmProvider;
import com.creativeai.agentteam.model.enums.LlmType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LlmProviderRepository extends JpaRepository<LlmProvider, String> {
    List<LlmProvider>     findByAgentIdAndDeletedFalseOrderByPrimaryDesc(String agentId);
    List<LlmProvider>     findByAgentIdAndPrimaryTrueAndDeletedFalse(String agentId);
    Optional<LlmProvider> findByAgentIdAndTypeAndDeletedFalse(String agentId, LlmType type);
    List<LlmProvider>     findByAgentIdOrderByPrimaryDescCreatedAtDesc(String agentId);
    void deleteByAgentId(String agentId);
}
