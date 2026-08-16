package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.KnowledgeBase;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBase, String> {
    Optional<KnowledgeBase> findByAgentIdAndDeletedFalse(String agentId);
}
