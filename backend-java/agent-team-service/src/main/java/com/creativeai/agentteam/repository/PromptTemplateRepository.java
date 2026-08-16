package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.PromptTemplate;
import com.creativeai.agentteam.model.enums.PromptType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, String> {
    List<PromptTemplate>     findByAgentIdAndDeletedFalseOrderByVersionDesc(String agentId);
    List<PromptTemplate>     findByAgentIdAndTypeAndDeletedFalse(String agentId, PromptType type);
    Optional<PromptTemplate> findByAgentIdAndTypeAndActiveTrueAndDeletedFalse(String agentId, PromptType type);
    Optional<PromptTemplate> findByIdAndAgentIdAndDeletedFalse(String id, String agentId);
    void                     deleteByAgentId(String agentId);

    // Soft-delete / restore
    List<PromptTemplate>     findByAgentIdAndDeletedTrueOrderByUpdatedAtDesc(String agentId);
    Optional<PromptTemplate> findByIdAndAgentIdAndDeletedTrue(String id, String agentId);
}
