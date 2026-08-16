package com.creativeai.auth.service.agent;

import com.creativeai.auth.model.AgentMemory;
import com.creativeai.auth.model.enums.MessageRole;
import com.creativeai.auth.repository.AgentMemoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentMemoryService {

    private final AgentMemoryRepository memoryRepo;

    public static final String EMAIL_AGENT_ID = "email-agent";

    @Value("${agent.max-memory-messages:20}")
    private int maxMessages;

    // ── Read ───────────────────────────────────────────────────────────────

    public List<AgentMemory> getHistory(String userId) {
        return memoryRepo.findByUserIdAndAgentIdAndDeletedFalseOrderBySequenceNumberAsc(
                userId, EMAIL_AGENT_ID);
    }

    public List<ChatMessage> buildContextMessages(String userId) {
        List<AgentMemory> history = getHistory(userId);
        // Keep only last maxMessages to stay within context window
        if (history.size() > maxMessages) {
            history = history.subList(history.size() - maxMessages, history.size());
        }
        List<ChatMessage> messages = new ArrayList<>();
        for (AgentMemory m : history) {
            messages.add(switch (m.getRole()) {
                case USER        -> ChatMessage.user(m.getContent());
                case ASSISTANT   -> ChatMessage.assistant(m.getContent());
                case TOOL_RESULT -> ChatMessage.tool(m.getToolName(), m.getContent());
                case SYSTEM      -> ChatMessage.system(m.getContent());
            });
        }
        return messages;
    }

    // ── Write ──────────────────────────────────────────────────────────────

    @Transactional
    public AgentMemory save(String userId, MessageRole role, String content, String toolName) {
        long seq = memoryRepo.countByUserIdAndAgentIdAndDeletedFalse(userId, EMAIL_AGENT_ID) + 1;
        AgentMemory m = AgentMemory.builder()
            .userId(userId)
            .agentId(EMAIL_AGENT_ID)
            .role(role)
            .content(content)
            .toolName(toolName)
            .sequenceNumber(seq)
            .build();
        return memoryRepo.save(m);
    }

    public void saveUser(String userId, String content)              { save(userId, MessageRole.USER,        content, null); }
    public void saveAssistant(String userId, String content)         { save(userId, MessageRole.ASSISTANT,   content, null); }
    public void saveToolResult(String userId, String tool, String r) { save(userId, MessageRole.TOOL_RESULT, r,       tool); }

    // ── Clear ──────────────────────────────────────────────────────────────

    @Transactional
    public void clearMemory(String userId) {
        List<AgentMemory> all = getHistory(userId);
        all.forEach(m -> m.setDeleted(true));
        memoryRepo.saveAll(all);
        log.info("Cleared memory for userId={}", userId);
    }
}
