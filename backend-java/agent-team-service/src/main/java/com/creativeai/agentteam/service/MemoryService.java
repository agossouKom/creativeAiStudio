package com.creativeai.agentteam.service;

import com.creativeai.agentteam.dto.response.MemoryResponse;
import com.creativeai.agentteam.model.AgentMemory;
import com.creativeai.agentteam.model.enums.MemoryType;
import com.creativeai.agentteam.model.enums.MessageRole;
import com.creativeai.agentteam.repository.AgentMemoryRepository;
import com.creativeai.agentteam.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemoryService {

    private final AgentMemoryRepository memoryRepo;
    private final AgentRepository       agentRepo;
    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${agent.max-memory-messages:30}")
    private int maxMemoryMessages;

    @Value("${agent.memory-ttl-hours:24}")
    private int memoryTtlHours;

    private static final String CACHE_PREFIX = "agent:memory:";

    // ── Write ────────────────────────────────────────────────────────────────

    @Transactional
    public AgentMemory saveUserMessage(String userId, String agentId, String sessionId, String content) {
        return save(userId, agentId, sessionId, MessageRole.USER, content, null);
    }

    @Transactional
    public AgentMemory saveAssistantMessage(String userId, String agentId, String sessionId, String content) {
        return save(userId, agentId, sessionId, MessageRole.ASSISTANT, content, null);
    }

    @Transactional
    public AgentMemory saveToolResult(String userId, String agentId, String sessionId,
                                      String toolName, String result) {
        return save(userId, agentId, sessionId, MessageRole.TOOL_RESULT, result, toolName);
    }

    private AgentMemory save(String userId, String agentId, String sessionId,
                              MessageRole role, String content, String toolName) {
        long seq = memoryRepo.maxSequenceNumber(userId, agentId) + 1;
        AgentMemory memory = AgentMemory.builder()
            .userId(userId)
            .agentId(agentId)
            .sessionId(sessionId != null ? sessionId : UUID.randomUUID().toString())
            .role(role)
            .content(content)
            .toolName(toolName)
            .sequenceNumber(seq)
            .memoryType(MemoryType.SHORT_TERM)
            .expiresAt(LocalDateTime.now().plusHours(memoryTtlHours))
            .build();
        memory = memoryRepo.save(memory);
        invalidateCache(userId, agentId);
        return memory;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AgentMemory> getHistory(String userId, String agentId) {
        return memoryRepo.findLastN(userId, agentId, maxMemoryMessages);
    }

    @Transactional(readOnly = true)
    public List<MemoryResponse> getHistoryAsDto(String userId, String agentId) {
        return getHistory(userId, agentId).stream().map(MemoryResponse::from).toList();
    }

    // ── Context for LLM (ordered ASC for prompt) ─────────────────────────────

    @Transactional(readOnly = true)
    public List<AgentMemory> buildContextMessages(String userId, String agentId, String sessionId) {
        List<AgentMemory> messages = memoryRepo.findLastNBySession(userId, agentId, sessionId, maxMemoryMessages);
        // findLastNBySession retourne DESC, le LLM a besoin d'ASC
        java.util.Collections.reverse(messages);
        return messages;
    }

    // ── Clear ────────────────────────────────────────────────────────────────

    @Transactional
    public void clearMemory(String userId, String agentId) {
        memoryRepo.deleteByUserIdAndAgentId(userId, agentId);
        invalidateCache(userId, agentId);
        log.info("Memory cleared for userId={} agentId={}", userId, agentId);
    }

    @Transactional
    public void clearSession(String sessionId) {
        memoryRepo.deleteBySessionId(sessionId);
    }

    // ── Redis cache ───────────────────────────────────────────────────────────

    private void invalidateCache(String userId, String agentId) {
        String key = CACHE_PREFIX + userId + ":" + agentId;
        redisTemplate.delete(key);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public long countMessages(String userId, String agentId) {
        return memoryRepo.countByUserIdAndAgentIdAndDeletedFalse(userId, agentId);
    }
}
