package com.creativeai.auth.repository;

import com.creativeai.auth.model.AgentMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AgentMemoryRepository extends JpaRepository<AgentMemory, String> {

    List<AgentMemory> findByUserIdAndAgentIdAndDeletedFalseOrderBySequenceNumberAsc(
            String userId, String agentId);

    @Query("SELECT m FROM AgentMemory m WHERE m.userId = :userId AND m.agentId = :agentId " +
           "AND m.deleted = false ORDER BY m.sequenceNumber DESC LIMIT :limit")
    List<AgentMemory> findLastN(String userId, String agentId, int limit);

    long countByUserIdAndAgentIdAndDeletedFalse(String userId, String agentId);

    void deleteByUserIdAndAgentId(String userId, String agentId);
}
