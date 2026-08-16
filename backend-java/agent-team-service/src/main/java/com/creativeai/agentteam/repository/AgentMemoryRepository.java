package com.creativeai.agentteam.repository;

import com.creativeai.agentteam.model.AgentMemory;
import com.creativeai.agentteam.model.enums.MemoryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface AgentMemoryRepository extends JpaRepository<AgentMemory, String> {

    @Query("SELECT m FROM AgentMemory m WHERE m.userId = :userId AND m.agentId = :agentId " +
           "AND m.deleted = false ORDER BY m.sequenceNumber DESC LIMIT :limit")
    List<AgentMemory> findLastN(String userId, String agentId, int limit);

    @Query("SELECT m FROM AgentMemory m WHERE m.userId = :userId AND m.agentId = :agentId " +
           "AND m.sessionId = :sessionId AND m.deleted = false ORDER BY m.sequenceNumber DESC LIMIT :limit")
    List<AgentMemory> findLastNBySession(String userId, String agentId, String sessionId, int limit);

    List<AgentMemory>  findByUserIdAndAgentIdAndDeletedFalseOrderBySequenceNumberAsc(String userId, String agentId);
    List<AgentMemory>  findBySessionIdAndDeletedFalseOrderBySequenceNumberAsc(String sessionId);
    List<AgentMemory>  findByTeamIdAndMemoryTypeAndDeletedFalse(String teamId, MemoryType type);
    long               countByUserIdAndAgentIdAndDeletedFalse(String userId, String agentId);

    @Query("SELECT COALESCE(MAX(m.sequenceNumber), 0) FROM AgentMemory m WHERE m.userId = :userId AND m.agentId = :agentId")
    long maxSequenceNumber(String userId, String agentId);

    void deleteByUserIdAndAgentId(String userId, String agentId);
    void deleteBySessionId(String sessionId);
}
